from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from services.api.app.config import settings
from services.api.app.database import SessionLocal
from services.api.app.models import PipelineWorkerRecord
from services.api.app.schemas import PipelineQueueMonitoring, PipelineWorkerStatusSummary


@dataclass
class PipelineWorkerHeartbeatPayload:
    worker_id: str
    status: str
    current_job_id: str | None = None
    last_claimed_job_id: str | None = None
    last_completed_job_id: str | None = None


class PipelineWorkerService:
    def heartbeat(self, payload: PipelineWorkerHeartbeatPayload) -> None:
        now = datetime.now(timezone.utc)
        with SessionLocal() as session:
            self._prune_stale_workers(session, now=now)
            worker = session.scalar(
                select(PipelineWorkerRecord).where(
                    PipelineWorkerRecord.worker_id == payload.worker_id
                )
            )
            if worker is None:
                worker = PipelineWorkerRecord(
                    worker_id=payload.worker_id,
                    status=payload.status,
                    current_job_id=payload.current_job_id,
                    last_claimed_job_id=payload.last_claimed_job_id,
                    last_completed_job_id=payload.last_completed_job_id,
                    heartbeat_at=now,
                    started_at=now,
                )
                session.add(worker)
            else:
                worker.status = payload.status
                worker.current_job_id = payload.current_job_id
                if payload.last_claimed_job_id:
                    worker.last_claimed_job_id = payload.last_claimed_job_id
                if payload.last_completed_job_id:
                    worker.last_completed_job_id = payload.last_completed_job_id
                worker.heartbeat_at = now
            session.commit()

    def summarize(
        self,
        *,
        queued_jobs: int,
        running_jobs: int,
    ) -> PipelineQueueMonitoring:
        with SessionLocal() as session:
            self._prune_stale_workers(session)
            workers = list(
                session.scalars(
                    select(PipelineWorkerRecord).order_by(
                        PipelineWorkerRecord.heartbeat_at.desc(),
                        PipelineWorkerRecord.worker_id.asc(),
                    )
                )
            )

        now = datetime.now(timezone.utc)
        stale_after_seconds = max(settings.pipeline_worker_stale_seconds, 1)
        worker_summaries: list[PipelineWorkerStatusSummary] = []
        online_workers = 0
        busy_workers = 0
        stale_workers = 0
        latest_heartbeat_at: datetime | None = None

        for worker in workers:
            heartbeat_at = self._ensure_utc(worker.heartbeat_at)
            is_online = (now - heartbeat_at).total_seconds() <= stale_after_seconds
            if latest_heartbeat_at is None or heartbeat_at > latest_heartbeat_at:
                latest_heartbeat_at = heartbeat_at
            if is_online:
                online_workers += 1
                if worker.status == "running":
                    busy_workers += 1
            else:
                stale_workers += 1

            worker_summaries.append(
                PipelineWorkerStatusSummary(
                    workerId=worker.worker_id,
                    status=worker.status,
                    currentJobId=worker.current_job_id,
                    lastClaimedJobId=worker.last_claimed_job_id,
                    lastCompletedJobId=worker.last_completed_job_id,
                    heartbeatAt=heartbeat_at.isoformat(),
                    startedAt=self._ensure_utc(worker.started_at).isoformat(),
                    isOnline=is_online,
                )
            )

        status = "healthy"
        message = "Worker 在线，队列空闲。"
        if queued_jobs > 0 and online_workers == 0:
            status = "offline"
            message = "存在排队任务，但没有在线 worker，任务不会继续推进。"
        elif queued_jobs > 0 and busy_workers == 0 and online_workers > 0:
            status = "degraded"
            message = "存在排队任务，worker 在线但暂未开始消费，请检查心跳和锁竞争。"
        elif queued_jobs > 0:
            status = "busy"
            message = "Worker 正在消费队列，仍有任务等待处理。"
        elif running_jobs > 0 and online_workers == 0:
            status = "degraded"
            message = "有运行中任务，但 worker 心跳已过期，请检查 worker 进程。"
        elif online_workers == 0:
            status = "offline"
            message = "当前没有在线 worker。"
        elif busy_workers > 0:
            status = "busy"
            message = "Worker 正在执行任务。"

        return PipelineQueueMonitoring(
            status=status,
            message=message,
            queuedJobs=queued_jobs,
            runningJobs=running_jobs,
            onlineWorkers=online_workers,
            busyWorkers=busy_workers,
            registeredWorkers=len(workers),
            staleWorkers=stale_workers,
            lastHeartbeatAt=latest_heartbeat_at.isoformat() if latest_heartbeat_at else None,
            staleAfterSeconds=stale_after_seconds,
            workers=worker_summaries,
        )

    def build_unavailable_summary(self, *, message: str) -> PipelineQueueMonitoring:
        return PipelineQueueMonitoring(
            status="degraded",
            message=message,
            queuedJobs=0,
            runningJobs=0,
            onlineWorkers=0,
            busyWorkers=0,
            registeredWorkers=0,
            staleWorkers=0,
            lastHeartbeatAt=None,
            staleAfterSeconds=max(settings.pipeline_worker_stale_seconds, 1),
            workers=[],
        )

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _prune_stale_workers(
        self,
        session,
        *,
        now: datetime | None = None,
    ) -> None:
        retention_seconds = max(settings.pipeline_worker_retention_seconds, 60)
        reference_time = now or datetime.now(timezone.utc)
        cutoff = reference_time - timedelta(seconds=retention_seconds)
        session.execute(
            delete(PipelineWorkerRecord).where(
                PipelineWorkerRecord.heartbeat_at < cutoff
            )
        )
        session.commit()


pipeline_worker_service = PipelineWorkerService()
