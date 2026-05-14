from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path

from sqlalchemy import func, or_, select

from services.api.app.database import SessionLocal
from services.api.app.models import TrashIdentityRecord
from services.api.app.schemas import PipelineRequest, PipelineResponse
from services.api.app.services.trash_taxonomy import classify_trash_identity

LEGACY_NEEDS_TEXT_STATUS = "待补OCR"
NEEDS_TEXT_STATUS = "待补文字线索"
MANUAL_TEXT_CLUE_MARKER = "\n\n[人工补充文字线索]\n"


class TrashIdentityFilters:
    def __init__(
        self,
        *,
        review_status: str | None = None,
        site: str | None = None,
        category: str | None = None,
        risk_level: str | None = None,
        query: str | None = None,
    ) -> None:
        self.review_status = review_status
        self.site = site
        self.category = category
        self.risk_level = risk_level
        self.query = query


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

    def list_identities(
        self,
        *,
        limit: int = 50,
        filters: TrashIdentityFilters | None = None,
    ) -> list[TrashIdentityRecord]:
        with SessionLocal() as session:
            statement = (
                select(TrashIdentityRecord)
                .where(*self._filter_conditions(filters))
                .order_by(
                    TrashIdentityRecord.created_at.desc(), TrashIdentityRecord.id.desc()
                )
                .limit(limit)
            )
            return list(session.scalars(statement))

    def count_by_status(
        self, filters: TrashIdentityFilters | None = None
    ) -> dict[str, int]:
        with SessionLocal() as session:
            statement = select(
                TrashIdentityRecord.review_status, func.count()
            ).where(*self._filter_conditions(filters)).group_by(TrashIdentityRecord.review_status)
            rows = session.execute(statement).all()
            return {status: count for status, count in rows}

    def dashboard_overview(self) -> dict:
        with SessionLocal() as session:
            records = list(session.scalars(select(TrashIdentityRecord)))

        total_records = len(records)
        site_names = {record.site_name for record in records if record.site_name}
        high_risk_count = sum(
            1 for record in records if record.volunteer_risk_level == "high"
        )
        pending_count = sum(1 for record in records if record.review_status == "待复核")
        unique_tags = {
            tag
            for record in records
            for tag in (record.volunteer_tags or [])
            if tag
        }

        return {
            "status": "live" if records else "empty",
            "metrics": [
                {
                    "label": "累计潜点",
                    "value": str(len(site_names)),
                    "note": "来自垃圾身份证真实入库记录",
                },
                {
                    "label": "垃圾身份证",
                    "value": f"{total_records:,}",
                    "note": "已持久化到数据库的记录数",
                },
                {
                    "label": "高风险样本",
                    "value": str(high_risk_count),
                    "note": "语义分析标记为 high 的记录",
                },
                {
                    "label": "待复核",
                    "value": str(pending_count),
                    "note": "仍需人工确认的识别结果",
                },
                {
                    "label": "反馈标签",
                    "value": str(len(unique_tags)),
                    "note": "由志愿者反馈语义分析抽取",
                },
            ],
            "top_sites": self._top_sites(records),
        }

    def update_review_status(self, identity_id: str, review_status: str) -> bool:
        with SessionLocal() as session:
            record = session.scalar(
                select(TrashIdentityRecord).where(
                    TrashIdentityRecord.identity_id == identity_id
                )
            )
            if record is None:
                return False

            record.review_status = self.normalize_review_status(review_status)
            session.commit()
            return True

    def update_review_payload(
        self,
        *,
        identity_id: str,
        review_status: str | None = None,
        manual_text_clue: str | None = None,
    ) -> bool:
        with SessionLocal() as session:
            record = session.scalar(
                select(TrashIdentityRecord).where(
                    TrashIdentityRecord.identity_id == identity_id
                )
            )
            if record is None:
                return False

            if review_status is not None:
                record.review_status = self.normalize_review_status(review_status)
            if manual_text_clue is not None:
                record.volunteer_note = self.merge_manual_text_clue(
                    record.volunteer_note,
                    manual_text_clue,
                )

            session.commit()
            return True

    def delete_identity(self, identity_id: str) -> bool:
        with SessionLocal() as session:
            record = session.scalar(
                select(TrashIdentityRecord).where(
                    TrashIdentityRecord.identity_id == identity_id
                )
            )
            if record is None:
                return False

            session.delete(record)
            session.commit()
            return True

    def display_category(self, record: TrashIdentityRecord) -> str:
        return classify_trash_identity(
            primary_category=record.primary_category,
            categories=record.categories,
            volunteer_note=self.base_volunteer_note(record.volunteer_note),
            volunteer_summary=record.volunteer_summary,
            source_hint=record.source_hint,
            ocr_texts=record.ocr_texts,
            ocr_keywords=record.ocr_keywords,
        ).item_name

    def professional_category(self, record: TrashIdentityRecord) -> str:
        return classify_trash_identity(
            primary_category=record.primary_category,
            categories=record.categories,
            volunteer_note=self.base_volunteer_note(record.volunteer_note),
            volunteer_summary=record.volunteer_summary,
            source_hint=record.source_hint,
            ocr_texts=record.ocr_texts,
            ocr_keywords=record.ocr_keywords,
        ).professional_category

    def _review_status(self, ocr_texts: list[str]) -> str:
        if not ocr_texts:
            return NEEDS_TEXT_STATUS
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

    def _filter_conditions(
        self, filters: TrashIdentityFilters | None
    ) -> list:
        if filters is None:
            return []

        conditions = []
        if filters.review_status:
            normalized_status = self.normalize_review_status(filters.review_status)
            if normalized_status == NEEDS_TEXT_STATUS:
                conditions.append(
                    TrashIdentityRecord.review_status.in_(
                        [NEEDS_TEXT_STATUS, LEGACY_NEEDS_TEXT_STATUS]
                    )
                )
            else:
                conditions.append(TrashIdentityRecord.review_status == normalized_status)
        if filters.risk_level:
            conditions.append(TrashIdentityRecord.volunteer_risk_level == filters.risk_level)
        if filters.site:
            conditions.append(TrashIdentityRecord.site_name.ilike(f"%{filters.site}%"))
        if filters.category:
            conditions.append(
                TrashIdentityRecord.primary_category.ilike(f"%{filters.category}%")
            )
        if filters.query:
            keyword = f"%{filters.query}%"
            conditions.append(
                or_(
                    TrashIdentityRecord.identity_id.ilike(keyword),
                    TrashIdentityRecord.site_name.ilike(keyword),
                    TrashIdentityRecord.primary_category.ilike(keyword),
                    TrashIdentityRecord.volunteer_note.ilike(keyword),
                    TrashIdentityRecord.source_hint.ilike(keyword),
                )
            )
        return conditions

    def _top_sites(self, records: list[TrashIdentityRecord]) -> list[dict]:
        grouped: dict[str, list[TrashIdentityRecord]] = defaultdict(list)
        for record in records:
            if record.site_name:
                grouped[record.site_name].append(record)

        site_rows = []
        for site_name, site_records in grouped.items():
            category_counter = Counter(
                self.professional_category(record) or "待补充" for record in site_records
            )
            top_category = category_counter.most_common(1)[0][0]
            high_risk_count = sum(
                1 for record in site_records if record.volunteer_risk_level == "high"
            )
            needs_ocr_count = sum(
                1
                for record in site_records
                if self.normalize_review_status(record.review_status) == NEEDS_TEXT_STATUS
            )
            pending_count = sum(
                1 for record in site_records if record.review_status == "待复核"
            )

            if high_risk_count or needs_ocr_count:
                risk = "高"
                risk_score = 3
            elif pending_count:
                risk = "中"
                risk_score = 2
            else:
                risk = "低"
                risk_score = 1

            site_rows.append(
                {
                    "name": site_name,
                    "risk": risk,
                    "riskScore": risk_score,
                    "topCategory": top_category,
                    "recordCount": len(site_records),
                }
            )

        sorted_rows = sorted(
            site_rows,
            key=lambda row: (row["riskScore"], row["recordCount"], row["name"]),
            reverse=True,
        )
        return [
            {
                "name": row["name"],
                "risk": row["risk"],
                "topCategory": row["topCategory"],
                "recordCount": row["recordCount"],
            }
            for row in sorted_rows[:5]
        ]

    def normalize_review_status(self, review_status: str) -> str:
        if review_status == LEGACY_NEEDS_TEXT_STATUS:
            return NEEDS_TEXT_STATUS
        return review_status

    def extract_manual_text_clue(self, volunteer_note: str) -> str:
        if MANUAL_TEXT_CLUE_MARKER not in volunteer_note:
            return ""
        return volunteer_note.split(MANUAL_TEXT_CLUE_MARKER, 1)[1].strip()

    def base_volunteer_note(self, volunteer_note: str) -> str:
        if MANUAL_TEXT_CLUE_MARKER not in volunteer_note:
            return volunteer_note
        return volunteer_note.split(MANUAL_TEXT_CLUE_MARKER, 1)[0].strip()

    def merge_manual_text_clue(self, volunteer_note: str, manual_text_clue: str) -> str:
        base_note = self.base_volunteer_note(volunteer_note).strip()
        cleaned_clue = manual_text_clue.strip()
        if not cleaned_clue:
            return base_note
        if base_note:
            return f"{base_note}{MANUAL_TEXT_CLUE_MARKER}{cleaned_clue}"
        return f"[人工补充文字线索]\n{cleaned_clue}"


trash_identity_store = TrashIdentityStore()
