from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from services.api.app.models import PipelineJobRecord, TrashIdentityRecord


def build_session_factory(database_url: str):
    connect_args = (
        {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    )
    engine = create_engine(database_url, connect_args=connect_args)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def sync_trash_identities(source: Session, target: Session) -> int:
    existing_keys = {
        key
        for key in target.scalars(select(TrashIdentityRecord.identity_id))
    }
    inserted = 0

    for record in source.scalars(select(TrashIdentityRecord)):
        if record.identity_id in existing_keys:
            continue

        target.add(
            TrashIdentityRecord(
                identity_id=record.identity_id,
                site_name=record.site_name,
                volunteer_note=record.volunteer_note,
                original_url=record.original_url,
                original_path=record.original_path,
                enhanced_url=record.enhanced_url,
                enhanced_path=record.enhanced_path,
                enhancement_model=record.enhancement_model,
                enhancement_mode=record.enhancement_mode,
                detection_model=record.detection_model,
                detection_mode=record.detection_mode,
                ocr_model=record.ocr_model,
                ocr_mode=record.ocr_mode,
                semantic_model=record.semantic_model,
                semantic_mode=record.semantic_mode,
                primary_category=record.primary_category,
                material_hint=record.material_hint,
                source_hint=record.source_hint,
                top_confidence=record.top_confidence,
                review_status=record.review_status,
                volunteer_summary=record.volunteer_summary,
                volunteer_risk_level=record.volunteer_risk_level,
                categories=list(record.categories or []),
                detections=list(record.detections or []),
                ocr_texts=list(record.ocr_texts or []),
                ocr_keywords=list(record.ocr_keywords or []),
                volunteer_tags=list(record.volunteer_tags or []),
                action_suggestions=list(record.action_suggestions or []),
                created_at=record.created_at,
                updated_at=record.updated_at,
            )
        )
        existing_keys.add(record.identity_id)
        inserted += 1

    target.commit()
    return inserted


def sync_pipeline_jobs(source: Session, target: Session) -> int:
    existing_keys = {
        key
        for key in target.scalars(select(PipelineJobRecord.job_id))
    }
    inserted = 0

    for record in source.scalars(select(PipelineJobRecord)):
        if record.job_id in existing_keys:
            continue

        target.add(
            PipelineJobRecord(
                job_id=record.job_id,
                status=record.status,
                stage=record.stage,
                progress=record.progress,
                message=record.message,
                error_detail=record.error_detail,
                identity_id=record.identity_id,
                request_fingerprint=record.request_fingerprint,
                media_hash=record.media_hash,
                retry_count=record.retry_count,
                cache_hit_count=record.cache_hit_count,
                inflight_reuse_count=record.inflight_reuse_count,
                last_reuse_reason=record.last_reuse_reason,
                payload=dict(record.payload or {}),
                result_payload=dict(record.result_payload) if record.result_payload else None,
                created_at=record.created_at,
                started_at=record.started_at,
                finished_at=record.finished_at,
                canceled_at=record.canceled_at,
                timeout_at=record.timeout_at,
                last_reused_at=record.last_reused_at,
                updated_at=record.updated_at,
            )
        )
        existing_keys.add(record.job_id)
        inserted += 1

    target.commit()
    return inserted


def main() -> None:
    source_url = os.getenv(
        "SOURCE_DATABASE_URL",
        "sqlite:////Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/storage/ocean.db",
    )
    target_url = os.getenv("TARGET_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not target_url:
        raise RuntimeError("TARGET_DATABASE_URL or DATABASE_URL is required.")

    source_factory = build_session_factory(source_url)
    target_factory = build_session_factory(target_url)

    with source_factory() as source_session, target_factory() as target_session:
        inserted_jobs = sync_pipeline_jobs(source_session, target_session)
        inserted_identities = sync_trash_identities(source_session, target_session)

    print(
        f"migrated pipeline_jobs={inserted_jobs} trash_identities={inserted_identities}"
    )


if __name__ == "__main__":
    main()
