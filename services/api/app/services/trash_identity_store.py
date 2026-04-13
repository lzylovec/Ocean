from __future__ import annotations

from pathlib import Path

from sqlalchemy import func, select

from services.api.app.database import SessionLocal
from services.api.app.models import TrashIdentityRecord
from services.api.app.schemas import PipelineRequest, PipelineResponse


class TrashIdentityStore:
    def create_from_pipeline(
        self,
        *,
        payload: PipelineRequest,
        response: PipelineResponse,
        enhanced_path: Path,
    ) -> None:
        with SessionLocal() as session:
            session.add(
                TrashIdentityRecord(
                    identity_id=response.identity_id,
                    site_name=payload.site_name,
                    volunteer_note=payload.volunteer_note or "",
                    original_url=response.original_url,
                    original_path=payload.media_path,
                    enhanced_url=response.enhanced_url,
                    enhanced_path=str(enhanced_path),
                    enhancement_model=response.enhancement_model,
                    enhancement_mode=response.enhancement_mode,
                    detection_model=response.detection_model,
                    detection_mode=response.detection_mode,
                    ocr_model=response.ocr_model,
                    ocr_mode=response.ocr_mode,
                    semantic_model=response.semantic_model,
                    semantic_mode=response.semantic_mode,
                    primary_category=self._primary_category(
                        response.categories, response.detections
                    ),
                    material_hint=self._material_hint(
                        response.ocr_keywords, response.categories
                    ),
                    source_hint=response.source_hint,
                    top_confidence=self._top_confidence(response.detections),
                    review_status=self._review_status(response.ocr_texts),
                    volunteer_summary=response.volunteer_summary,
                    volunteer_risk_level=response.volunteer_risk_level,
                    categories=response.categories,
                    detections=[
                        detection.model_dump() for detection in response.detections
                    ],
                    ocr_texts=response.ocr_texts,
                    ocr_keywords=response.ocr_keywords,
                    volunteer_tags=response.volunteer_tags,
                    action_suggestions=response.action_suggestions,
                )
            )
            session.commit()

    def list_identities(self, limit: int = 50) -> list[TrashIdentityRecord]:
        with SessionLocal() as session:
            statement = (
                select(TrashIdentityRecord)
                .order_by(
                    TrashIdentityRecord.created_at.desc(), TrashIdentityRecord.id.desc()
                )
                .limit(limit)
            )
            return list(session.scalars(statement))

    def count_by_status(self) -> dict[str, int]:
        with SessionLocal() as session:
            statement = select(
                TrashIdentityRecord.review_status, func.count()
            ).group_by(TrashIdentityRecord.review_status)
            rows = session.execute(statement).all()
            return {status: count for status, count in rows}

    def update_review_status(self, identity_id: str, review_status: str) -> bool:
        with SessionLocal() as session:
            record = session.scalar(
                select(TrashIdentityRecord).where(
                    TrashIdentityRecord.identity_id == identity_id
                )
            )
            if record is None:
                return False

            record.review_status = review_status
            session.commit()
            return True

    def _review_status(self, ocr_texts: list[str]) -> str:
        if not ocr_texts:
            return "待补OCR"
        return "待复核"

    def _primary_category(self, categories: list[str], detections) -> str:
        if detections:
            top = max(detections, key=lambda item: item.confidence)
            return top.label
        if categories:
            return categories[0]
        return "待补充"

    def _material_hint(self, ocr_keywords: list[str], categories: list[str]) -> str:
        normalized = {keyword.upper() for keyword in ocr_keywords}
        if "PET" in normalized:
            return "PET"
        if "AL" in normalized:
            return "铝"
        if "NYLON" in normalized or "尼龙" in ocr_keywords:
            return "尼龙"
        if any("玻璃" in category for category in categories):
            return "玻璃"
        if any("金属" in category for category in categories):
            return "金属"
        if any("塑料" in category for category in categories):
            return "塑料"
        return "待补充"

    def _top_confidence(self, detections) -> float:
        if not detections:
            return 0.0
        return round(max(item.confidence for item in detections), 4)


trash_identity_store = TrashIdentityStore()
