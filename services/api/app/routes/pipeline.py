from __future__ import annotations

from fastapi import APIRouter, HTTPException

from services.api.app.schemas import PipelineRequest, PipelineResponse
from services.api.app.services.pipeline import pipeline_service


router = APIRouter(prefix="/api/v1/ai", tags=["pipeline"])


@router.post("/pipeline", response_model=PipelineResponse)
def run_pipeline(payload: PipelineRequest) -> PipelineResponse:
    try:
        return pipeline_service.run(payload)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
