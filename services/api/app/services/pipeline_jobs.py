from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, func, or_, select

from services.api.app.config import settings
from services.api.app.database import SessionLocal
from services.api.app.models import PipelineJobRecord
from services.api.app.schemas import (
    PipelineJobCounts,
    PipelineJobDedupeReason,
    PipelineJobEnqueueResponse,
    PipelineJobListItem,
    PipelineJobListResponse,
    PipelineJobPagination,
    PipelineJobStatusResponse,
    PipelineRequest,
    PipelineResponse,
)
from services.api.app.services.media_storage import media_storage_service
from services.api.app.services.pipeline import pipeline_service
from services.api.app.services.pipeline_workers import pipeline_worker_service
from services.api.app.services.trash_identity_store import classify_trash_identity

logger = logging.getLogger(__name__)


class PipelineJobCanceledError(Exception):
    pass


class PipelineJobTimedOutError(Exception):
    pass


@dataclass
class PipelineJobEnqueueResult:
    job: PipelineJobRecord
    should_schedule: bool
    cache_hit: bool
    dedupe_reason: PipelineJobDedupeReason


class PipelineJobService:
    def create_job(self, payload: PipelineRequest) -> PipelineJobEnqueueResult:
        source_path = media_storage_service.ensure_local_source(
            payload.media_path,
            payload.media_url,
        )
        if str(source_path) != payload.media_path:
            payload.media_path = str(source_path)

        media_hash = self._hash_file(source_path)
        request_fingerprint = self._build_request_fingerprint(
            media_hash=media_hash,
            payload=payload,
        )

        with SessionLocal() as session:
            existing_job = session.scalar(
                select(PipelineJobRecord)
                .where(PipelineJobRecord.request_fingerprint == request_fingerprint)
                .order_by(PipelineJobRecord.created_at.desc(), PipelineJobRecord.id.desc())
            )
            if existing_job is not None:
                if existing_job.status in {"queued", "running"}:
                    self._mark_reused(existing_job, dedupe_reason="inflight")
                    session.commit()
                    session.refresh(existing_job)
                    return PipelineJobEnqueueResult(
                        job=existing_job,
                        should_schedule=False,
                        cache_hit=False,
                        dedupe_reason="inflight",
                    )
                if existing_job.status == "succeeded" and existing_job.result_payload:
                    self._mark_reused(existing_job, dedupe_reason="completed")
                    session.commit()
                    session.refresh(existing_job)
                    return PipelineJobEnqueueResult(
                        job=existing_job,
                        should_schedule=False,
                        cache_hit=True,
                        dedupe_reason="completed",
                    )

        job = PipelineJobRecord(
            job_id=f"PJ-{uuid4().hex[:10].upper()}",
            status="queued",
            stage="queued",
            progress=20,
            message="任务已排队，等待后台处理",
            request_fingerprint=request_fingerprint,
            media_hash=media_hash,
            payload=payload.model_dump(by_alias=True, mode="json"),
        )

        with SessionLocal() as session:
            session.add(job)
            session.commit()
            self._prune_terminal_jobs(session)
            session.refresh(job)
            return PipelineJobEnqueueResult(
                job=job,
                should_schedule=True,
                cache_hit=False,
                dedupe_reason="new",
            )

    def get_job(self, job_id: str) -> PipelineJobRecord | None:
        with SessionLocal() as session:
            return session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )

    def claim_next_job(self) -> str | None:
        with SessionLocal() as session:
            statement = (
                select(PipelineJobRecord)
                .where(PipelineJobRecord.status == "queued")
                .order_by(
                    PipelineJobRecord.created_at.asc(),
                    PipelineJobRecord.id.asc(),
                )
                .limit(1)
            )
            if not settings.database_url.startswith("sqlite"):
                statement = statement.with_for_update(skip_locked=True)

            job = session.scalar(statement)
            if job is None:
                return None

            now = datetime.now(timezone.utc)
            job.status = "running"
            job.stage = "enhancing"
            job.progress = 25
            job.message = "后台任务已启动"
            job.started_at = now
            job.timeout_at = now + timedelta(
                seconds=settings.pipeline_job_timeout_seconds
            )
            session.commit()
            return job.job_id

    def fail_expired_running_jobs(self) -> int:
        with SessionLocal() as session:
            now = datetime.now(timezone.utc)
            jobs = list(
                session.scalars(
                    select(PipelineJobRecord).where(
                        PipelineJobRecord.status == "running",
                        PipelineJobRecord.timeout_at.is_not(None),
                    )
                )
            )

            affected = 0
            for job in jobs:
                if now < self._ensure_utc(job.timeout_at):
                    continue

                job.status = "failed"
                job.stage = "failed"
                job.message = "任务执行失败"
                job.error_detail = "Worker detected a timed-out running job."
                job.finished_at = now
                affected += 1

            if affected:
                session.commit()

            return affected

    def run_job(self, job_id: str, *, already_claimed: bool = False) -> None:
        payload = (
            self._load_job_payload(job_id)
            if already_claimed
            else self._mark_running(job_id)
        )
        if payload is None:
            return

        try:
            response = pipeline_service.run(
                payload,
                guard=lambda: self._ensure_job_active(job_id),
                on_stage_change=lambda stage, progress, message: self._update_stage(
                    job_id,
                    stage=stage,
                    progress=progress,
                    message=message,
                ),
            )
            self._ensure_job_active(job_id)
            self._mark_success(job_id, response)
        except PipelineJobCanceledError:
            self._mark_canceled(job_id)
        except PipelineJobTimedOutError as error:
            self._mark_failure(job_id, str(error))
        except FileNotFoundError as error:
            self._mark_failure(job_id, str(error))
        except Exception as error:  # pragma: no cover - depends on local model runtime
            logger.exception("Pipeline job %s failed.", job_id)
            self._mark_failure(job_id, str(error) or error.__class__.__name__)

    def retry_job(self, job_id: str) -> PipelineJobRecord:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None:
                raise LookupError("Pipeline job not found.")
            if job.status not in {"failed", "canceled"}:
                raise ValueError("Only failed or canceled jobs can be retried.")

            job.status = "queued"
            job.stage = "queued"
            job.progress = 20
            job.message = "任务已重新排队"
            job.error_detail = None
            job.identity_id = None
            job.result_payload = None
            job.retry_count += 1
            job.started_at = None
            job.finished_at = None
            job.canceled_at = None
            job.timeout_at = None
            session.commit()
            session.refresh(job)
            return job

    def cancel_job(self, job_id: str) -> PipelineJobRecord:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None:
                raise LookupError("Pipeline job not found.")
            if job.status in {"succeeded", "failed", "canceled"}:
                raise ValueError("Completed jobs cannot be canceled.")

            now = datetime.now(timezone.utc)
            job.status = "canceled"
            job.stage = "canceled"
            job.message = "任务已取消"
            job.canceled_at = now
            job.finished_at = now
            session.commit()
            session.refresh(job)
            return job

    def to_enqueue_response(
        self,
        job: PipelineJobRecord,
        *,
        cache_hit: bool = False,
        dedupe_reason: PipelineJobDedupeReason = "new",
    ) -> PipelineJobEnqueueResponse:
        return PipelineJobEnqueueResponse(
            jobId=job.job_id,
            status=job.status,
            stage=job.stage,
            progress=job.progress,
            message=job.message,
            retryCount=job.retry_count,
            cacheHit=cache_hit,
            dedupeReason=dedupe_reason,
        )

    def to_status_response(
        self,
        job: PipelineJobRecord,
        *,
        request_base_url: str | None = None,
    ) -> PipelineJobStatusResponse:
        result = (
            PipelineResponse.model_validate(job.result_payload)
            if job.result_payload
            else None
        )
        if result is not None:
            result = result.model_copy(
                update={
                    "original_url": media_storage_service.normalize_public_url_for_request(
                        result.original_url,
                        request_base_url,
                    ),
                    "enhanced_url": media_storage_service.normalize_public_url_for_request(
                        result.enhanced_url,
                        request_base_url,
                    ),
                }
            )

        return PipelineJobStatusResponse(
            jobId=job.job_id,
            status=job.status,
            stage=job.stage,
            progress=job.progress,
            message=job.message,
            retryCount=job.retry_count,
            cacheHitCount=job.cache_hit_count,
            inflightReuseCount=job.inflight_reuse_count,
            lastReuseReason=job.last_reuse_reason,
            identityId=job.identity_id,
            errorDetail=job.error_detail,
            result=result,
            createdAt=job.created_at.isoformat(),
            updatedAt=job.updated_at.isoformat(),
            startedAt=job.started_at.isoformat() if job.started_at else None,
            finishedAt=job.finished_at.isoformat() if job.finished_at else None,
            canceledAt=job.canceled_at.isoformat() if job.canceled_at else None,
            lastReusedAt=job.last_reused_at.isoformat() if job.last_reused_at else None,
        )

    def list_jobs(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        query: str | None = None,
    ) -> PipelineJobListResponse:
        normalized_query = query.strip() if query else None
        with SessionLocal() as session:
            filters = self._build_filters(status=status, query=normalized_query)
            total_items = session.scalar(
                select(func.count()).select_from(PipelineJobRecord).where(*filters)
            ) or 0
            total_pages = max(1, (total_items + page_size - 1) // page_size)
            current_page = min(max(page, 1), total_pages)
            offset = (current_page - 1) * page_size

            jobs = list(
                session.scalars(
                    select(PipelineJobRecord)
                    .where(*filters)
                    .order_by(
                        PipelineJobRecord.created_at.desc(),
                        PipelineJobRecord.id.desc(),
                    )
                    .offset(offset)
                    .limit(page_size)
                )
            )
            counts_rows = session.execute(
                select(PipelineJobRecord.status, func.count())
                .where(*filters)
                .group_by(PipelineJobRecord.status)
            ).all()
            counts_map = {job_status: count for job_status, count in counts_rows}
            monitoring_rows = session.execute(
                select(PipelineJobRecord.status, func.count()).group_by(
                    PipelineJobRecord.status
                )
            ).all()
            monitoring_counts_map = {
                job_status: count for job_status, count in monitoring_rows
            }

        return PipelineJobListResponse(
            items=[self._to_list_item(job) for job in jobs],
            counts=PipelineJobCounts(
                queued=counts_map.get("queued", 0),
                running=counts_map.get("running", 0),
                succeeded=counts_map.get("succeeded", 0),
                failed=counts_map.get("failed", 0),
                canceled=counts_map.get("canceled", 0),
            ),
            pagination=PipelineJobPagination(
                page=current_page,
                pageSize=page_size,
                totalItems=total_items,
                totalPages=total_pages,
                hasPrev=current_page > 1,
                hasNext=current_page < total_pages,
            ),
            monitoring=pipeline_worker_service.summarize(
                queued_jobs=monitoring_counts_map.get("queued", 0),
                running_jobs=monitoring_counts_map.get("running", 0),
            ),
        )

    def _mark_running(self, job_id: str) -> PipelineRequest | None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None or job.status in {
                "running",
                "succeeded",
                "failed",
                "canceled",
            }:
                return None

            job.status = "running"
            job.stage = "enhancing"
            job.progress = 25
            job.message = "后台任务已启动"
            now = datetime.now(timezone.utc)
            job.started_at = now
            job.timeout_at = now + timedelta(
                seconds=settings.pipeline_job_timeout_seconds
            )
            session.commit()
            return PipelineRequest.model_validate(job.payload)

    def _load_job_payload(self, job_id: str) -> PipelineRequest | None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None or job.status in {"succeeded", "failed", "canceled"}:
                return None

            return PipelineRequest.model_validate(job.payload)

    def _update_stage(
        self,
        job_id: str,
        *,
        stage: str,
        progress: int,
        message: str,
    ) -> None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None or job.status in {"succeeded", "failed", "canceled"}:
                return

            job.status = "running"
            job.stage = stage
            job.progress = progress
            job.message = message
            session.commit()

    def _mark_success(self, job_id: str, response: PipelineResponse) -> None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None or job.status == "canceled":
                return

            job.status = "succeeded"
            job.stage = "completed"
            job.progress = 100
            job.message = "任务已完成"
            job.identity_id = response.identity_id
            job.error_detail = None
            job.result_payload = response.model_dump(by_alias=True, mode="json")
            job.finished_at = datetime.now(timezone.utc)
            session.commit()

    def _mark_failure(self, job_id: str, error_detail: str) -> None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None or job.status == "canceled":
                return

            job.status = "failed"
            job.stage = "failed"
            job.message = "任务执行失败"
            job.error_detail = error_detail
            job.finished_at = datetime.now(timezone.utc)
            session.commit()

    def _mark_canceled(self, job_id: str) -> None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None:
                return

            if job.status != "canceled":
                now = datetime.now(timezone.utc)
                job.status = "canceled"
                job.stage = "canceled"
                job.message = "任务已取消"
                job.canceled_at = now
                job.finished_at = now
                session.commit()

    def _build_filters(
        self,
        *,
        status: str | None,
        query: str | None,
    ) -> list:
        filters = []
        if status:
            filters.append(PipelineJobRecord.status == status)
        if query:
            keyword = f"%{query}%"
            site_name = func.coalesce(
                PipelineJobRecord.payload["siteName"].as_string(), ""
            )
            volunteer_note = func.coalesce(
                PipelineJobRecord.payload["volunteerNote"].as_string(), ""
            )
            source_hint = func.coalesce(
                PipelineJobRecord.result_payload["sourceHint"].as_string(), ""
            )
            material_hint = func.coalesce(
                PipelineJobRecord.result_payload["materialHint"].as_string(), ""
            )
            recognized_category = func.coalesce(
                PipelineJobRecord.result_payload["recognizedCategory"].as_string(), ""
            )
            professional_category = func.coalesce(
                PipelineJobRecord.result_payload["professionalCategory"].as_string(), ""
            )
            filters.append(
                or_(
                    PipelineJobRecord.job_id.ilike(keyword),
                    func.coalesce(PipelineJobRecord.identity_id, "").ilike(keyword),
                    site_name.ilike(keyword),
                    volunteer_note.ilike(keyword),
                    source_hint.ilike(keyword),
                    material_hint.ilike(keyword),
                    recognized_category.ilike(keyword),
                    professional_category.ilike(keyword),
                )
            )
        return filters

    def _to_list_item(self, job: PipelineJobRecord) -> PipelineJobListItem:
        result_payload = job.result_payload or {}
        categories = result_payload.get("categories") or []
        primary_category = None
        if isinstance(categories, list) and categories:
            primary_category = str(categories[0])
        recognized_category = result_payload.get("recognizedCategory")
        professional_category = result_payload.get("professionalCategory")
        if not recognized_category or not professional_category:
            classification = classify_trash_identity(
                primary_category=primary_category,
                categories=categories if isinstance(categories, list) else [],
                volunteer_note=str(job.payload.get("volunteerNote", "")),
                volunteer_summary=str(result_payload.get("volunteerSummary", "")),
                source_hint=str(result_payload.get("sourceHint", "")),
                ocr_texts=list(result_payload.get("ocrTexts") or []),
                ocr_keywords=list(result_payload.get("ocrKeywords") or []),
            )
            recognized_category = recognized_category or classification.item_name
            professional_category = professional_category or classification.professional_category

        return PipelineJobListItem(
            jobId=job.job_id,
            status=job.status,
            stage=job.stage,
            progress=job.progress,
            message=job.message,
            retryCount=job.retry_count,
            cacheHitCount=job.cache_hit_count,
            inflightReuseCount=job.inflight_reuse_count,
            lastReuseReason=job.last_reuse_reason,
            identityId=job.identity_id,
            siteName=str(job.payload.get("siteName", "未知潜点")),
            recognizedCategory=str(recognized_category),
            professionalCategory=str(professional_category),
            primaryCategory=primary_category,
            errorDetail=job.error_detail,
            createdAt=job.created_at.isoformat(),
            updatedAt=job.updated_at.isoformat(),
            finishedAt=job.finished_at.isoformat() if job.finished_at else None,
            canceledAt=job.canceled_at.isoformat() if job.canceled_at else None,
            lastReusedAt=job.last_reused_at.isoformat() if job.last_reused_at else None,
        )

    def _ensure_job_active(self, job_id: str) -> None:
        with SessionLocal() as session:
            job = session.scalar(
                select(PipelineJobRecord).where(PipelineJobRecord.job_id == job_id)
            )
            if job is None:
                raise PipelineJobCanceledError("Pipeline job not found.")
            if job.status == "canceled":
                raise PipelineJobCanceledError("Pipeline job was canceled.")
            if (
                job.timeout_at is not None
                and datetime.now(timezone.utc) >= self._ensure_utc(job.timeout_at)
            ):
                raise PipelineJobTimedOutError("Pipeline job exceeded timeout limit.")

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _mark_reused(
        self,
        job: PipelineJobRecord,
        *,
        dedupe_reason: PipelineJobDedupeReason,
    ) -> None:
        job.last_reuse_reason = dedupe_reason
        job.last_reused_at = datetime.now(timezone.utc)
        if dedupe_reason == "completed":
            job.cache_hit_count += 1
        elif dedupe_reason == "inflight":
            job.inflight_reuse_count += 1

    def _hash_file(self, source_path: Path) -> str:
        digest = hashlib.sha256()
        with source_path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _build_request_fingerprint(
        self, *, media_hash: str, payload: PipelineRequest
    ) -> str:
        fingerprint_payload = {
            "cacheVersion": settings.pipeline_cache_version,
            "mediaHash": media_hash,
            "siteName": self._normalize_text(payload.site_name),
            "volunteerNote": self._normalize_text(payload.volunteer_note or ""),
            "enhanceModel": settings.modelscope_enhance_model,
            "detectModel": settings.modelscope_detect_model,
            "ocrDetectModel": settings.modelscope_ocr_detection_model,
            "ocrModel": settings.modelscope_ocr_model,
            "semanticModel": settings.modelscope_llm_model,
        }
        return hashlib.sha256(
            json.dumps(
                fingerprint_payload,
                ensure_ascii=False,
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()

    def _normalize_text(self, value: str) -> str:
        return " ".join(value.strip().split())

    def _prune_terminal_jobs(self, session) -> None:
        retention_days = max(settings.pipeline_job_retention_days, 1)
        max_records = max(settings.pipeline_job_retention_max_records, 50)
        terminal_statuses = ("succeeded", "failed", "canceled")
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

        session.execute(
            delete(PipelineJobRecord).where(
                PipelineJobRecord.status.in_(terminal_statuses),
                PipelineJobRecord.finished_at.is_not(None),
                PipelineJobRecord.finished_at < cutoff,
            )
        )
        session.commit()

        terminal_ids = list(
            session.scalars(
                select(PipelineJobRecord.id)
                .where(PipelineJobRecord.status.in_(terminal_statuses))
                .order_by(
                    PipelineJobRecord.finished_at.desc().nullslast(),
                    PipelineJobRecord.id.desc(),
                )
                .offset(max_records)
            )
        )
        if terminal_ids:
            session.execute(
                delete(PipelineJobRecord).where(PipelineJobRecord.id.in_(terminal_ids))
            )
            session.commit()


pipeline_job_service = PipelineJobService()
