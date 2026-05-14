from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from services.api.app.config import settings
from services.api.app.database_resilience import (
    DatabaseUnavailableError,
    raise_database_http_error,
    run_database_read,
    run_database_write,
)
from services.api.app.schemas import (
    PipelineJobEnqueueResponse,
    PipelineJobListResponse,
    PipelineJobStatusResponse,
    PipelineRequest,
)
from services.api.app.services.pipeline_jobs import pipeline_job_service


router = APIRouter(prefix="/api/v1/ai", tags=["pipeline"])


@router.post(
    "/pipeline",
    response_model=PipelineJobEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def run_pipeline(
    payload: PipelineRequest,
) -> PipelineJobEnqueueResponse:
    try:
        enqueue_result = run_database_write(
            lambda: pipeline_job_service.create_job(payload)
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except DatabaseUnavailableError:
        raise_database_http_error("任务暂时无法入队，请稍后重试。")

    return pipeline_job_service.to_enqueue_response(
        enqueue_result.job,
        cache_hit=enqueue_result.cache_hit,
        dedupe_reason=enqueue_result.dedupe_reason,
    )


@router.post("/pipeline/{job_id}/retry", response_model=PipelineJobEnqueueResponse)
def retry_pipeline_job(
    job_id: str,
) -> PipelineJobEnqueueResponse:
    try:
        job = run_database_write(lambda: pipeline_job_service.retry_job(job_id))
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except DatabaseUnavailableError:
        raise_database_http_error("任务暂时无法重试，请稍后重试。")

    return pipeline_job_service.to_enqueue_response(job)


@router.post("/pipeline/{job_id}/cancel", response_model=PipelineJobStatusResponse)
def cancel_pipeline_job(
    job_id: str,
    request: Request,
) -> PipelineJobStatusResponse:
    try:
        job = run_database_write(lambda: pipeline_job_service.cancel_job(job_id))
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except DatabaseUnavailableError:
        raise_database_http_error("任务暂时无法取消，请稍后重试。")

    return pipeline_job_service.to_status_response(
        job,
        request_base_url=str(request.base_url),
    )


@router.get("/pipeline-jobs", response_model=PipelineJobListResponse)
def list_pipeline_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(
        default=settings.pipeline_job_default_page_size, alias="pageSize", ge=1, le=100
    ),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, min_length=1, max_length=100),
) -> PipelineJobListResponse:
    try:
        return run_database_read(
            lambda: pipeline_job_service.list_jobs(
                page=page,
                page_size=page_size,
                status=status,
                query=q,
            )
        )
    except DatabaseUnavailableError:
        raise_database_http_error("任务历史暂时不可用，请稍后重试。")


@router.get("/pipeline/{job_id}", response_model=PipelineJobStatusResponse)
def get_pipeline_job(
    job_id: str,
    request: Request,
) -> PipelineJobStatusResponse:
    try:
        job = run_database_read(lambda: pipeline_job_service.get_job(job_id))
    except DatabaseUnavailableError:
        raise_database_http_error("任务状态暂时不可用，请稍后重试。")
    if job is None:
        raise HTTPException(status_code=404, detail="Pipeline job not found.")

    return pipeline_job_service.to_status_response(
        job,
        request_base_url=str(request.base_url),
    )
