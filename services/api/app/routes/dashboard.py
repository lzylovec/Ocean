from __future__ import annotations

from fastapi import APIRouter

from services.api.app.database_resilience import (
    DatabaseUnavailableError,
    raise_database_http_error,
    run_database_read,
)
from services.api.app.schemas import DashboardMetric, DashboardOverviewResponse
from services.api.app.services.trash_identity_store import trash_identity_store


router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview() -> DashboardOverviewResponse:
    try:
        overview = run_database_read(
            trash_identity_store.dashboard_overview,
        )
    except DatabaseUnavailableError:
        raise_database_http_error("治理看板数据暂时不可用，请稍后重试。")
    return DashboardOverviewResponse(
        status=overview["status"],
        metrics=[
            DashboardMetric(
                label=item["label"],
                value=item["value"],
                note=item["note"],
            )
            for item in overview["metrics"]
        ],
        topSites=overview["top_sites"],
    )
