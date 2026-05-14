from __future__ import annotations

from sqlalchemy import func, select
from fastapi import APIRouter

from services.api.app.database import SessionLocal
from services.api.app.models import PipelineJobRecord
from services.api.app.schemas import HealthResponse
from services.api.app.services.pipeline_workers import pipeline_worker_service


router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def healthcheck() -> HealthResponse:
    try:
        with SessionLocal() as session:
            counts_rows = session.execute(
                select(PipelineJobRecord.status, func.count()).group_by(
                    PipelineJobRecord.status
                )
            ).all()

        counts_map = {job_status: count for job_status, count in counts_rows}
        worker_monitoring = pipeline_worker_service.summarize(
            queued_jobs=counts_map.get("queued", 0),
            running_jobs=counts_map.get("running", 0),
        )

        overall_status = "ok"
        if worker_monitoring.status in {"offline", "degraded"} and (
            worker_monitoring.queued_jobs > 0 or worker_monitoring.running_jobs > 0
        ):
            overall_status = "degraded"

        return HealthResponse(
            status=overall_status,
            database="ok",
            worker=worker_monitoring,
        )
    except Exception:
        return HealthResponse(
            status="degraded",
            database="error",
            databaseMessage="数据库当前不可用，队列与 worker 状态可能不是最新。",
            worker=pipeline_worker_service.build_unavailable_summary(
                message="数据库不可用，无法获取 worker 心跳与队列状态。"
            ),
        )
