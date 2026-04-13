from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
