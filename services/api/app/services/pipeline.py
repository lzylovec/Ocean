from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from services.api.app.config import settings
from services.api.app.schemas import PipelineRequest, PipelineResponse
from services.api.app.services.detection import detection_service
from services.api.app.services.enhancement import enhancement_service
from services.api.app.services.ocr import ocr_service
from services.api.app.services.semantic import semantic_service
from services.api.app.services.trash_identity_store import trash_identity_store


class PipelineService:
    def run(self, payload: PipelineRequest) -> PipelineResponse:
        source_path = Path(payload.media_path)
        if not source_path.exists():
            raise FileNotFoundError(f"Media file not found: {source_path}")

        enhanced_path, enhancement_model, enhancement_mode = (
            enhancement_service.enhance(source_path)
        )

        detections, detection_model, detection_mode = detection_service.detect(
            enhanced_path, payload.volunteer_note or ""
        )
        categories = sorted({item.label for item in detections})
        ocr_texts, ocr_keywords, ocr_model, ocr_mode = ocr_service.recognize(
            enhanced_path, detections, payload.volunteer_note or ""
        )
        source_hint = self._infer_source(categories)
        semantic_result, semantic_model, semantic_mode = semantic_service.analyze(
            note=payload.volunteer_note or "",
            site_name=payload.site_name,
            categories=categories,
            ocr_keywords=ocr_keywords,
            ocr_texts=ocr_texts,
            source_hint=source_hint,
        )

        response = PipelineResponse(
            identityId=f"TI-{uuid4().hex[:8].upper()}",
            originalUrl=payload.media_url,
            enhancedUrl=f"{settings.public_base_url}/storage/enhanced/{enhanced_path.name}",
            enhancementModel=enhancement_model,
            enhancementMode=enhancement_mode,
            detectionModel=detection_model,
            detectionMode=detection_mode,
            ocrModel=ocr_model,
            ocrMode=ocr_mode,
            ocrTexts=ocr_texts,
            semanticModel=semantic_model,
            semanticMode=semantic_mode,
            categories=categories,
            sourceHint=source_hint,
            ocrKeywords=ocr_keywords
            or self._mock_ocr_keywords(categories, payload.volunteer_note or ""),
            detections=detections,
            volunteerTags=semantic_result.tags,
            volunteerSummary=semantic_result.summary,
            volunteerRiskLevel=semantic_result.risk_level,
            actionSuggestions=semantic_result.action_suggestions,
        )

        trash_identity_store.create_from_pipeline(
            payload=payload,
            response=response,
            enhanced_path=enhanced_path,
        )

        return response

    def _mock_ocr_keywords(self, categories: list[str], note: str) -> list[str]:
        keywords = ["PET", "近岸消费"]

        if "废弃渔网" in categories or "绳索碎段" in categories or "渔" in note:
            keywords = ["尼龙", "渔具残片"]
        elif "金属易拉罐" in categories or "罐" in note:
            keywords = ["AL", "易拉罐"]
        elif "塑料瓶" in categories:
            keywords = ["PET", "饮料包装"]

        return keywords

    def _infer_source(self, categories: list[str]) -> str:
        if "废弃渔网" in categories or "绳索碎段" in categories:
            return "近岸渔业作业"
        if "塑料瓶" in categories or "包装碎片" in categories:
            return "旅游及岸线消费"
        return "海流输入与近岸混合来源"


pipeline_service = PipelineService()
