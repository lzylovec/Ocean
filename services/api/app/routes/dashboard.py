from __future__ import annotations

from fastapi import APIRouter

from services.api.app.schemas import DashboardMetric, DashboardOverviewResponse


router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview() -> DashboardOverviewResponse:
    return DashboardOverviewResponse(
        status="mock",
        metrics=[
            DashboardMetric(label="累计潜点", value="24", note="覆盖 6 个重点海域"),
            DashboardMetric(
                label="识别垃圾件数", value="1,286", note="当前为模拟识别结果"
            ),
            DashboardMetric(label="高风险热点", value="7", note="旅游岸线与渔区叠加"),
            DashboardMetric(label="反馈标签", value="19", note="待接入真实语义模型"),
        ],
        topSites=[
            {"name": "深圳湾东潜点", "risk": "高", "topCategory": "塑料瓶 / 包装袋"},
            {"name": "外伶仃北坡", "risk": "高", "topCategory": "废弃渔网 / 绳索"},
            {"name": "三亚礁盘区", "risk": "中", "topCategory": "金属罐 / 包装碎片"},
        ],
    )
