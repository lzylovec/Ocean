from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from uuid import uuid4

from services.api.app.schemas import PipelineRequest, PipelineResponse
from services.api.app.services.detection import detection_service
from services.api.app.services.enhancement import enhancement_service
from services.api.app.services.media_storage import media_storage_service
from services.api.app.services.ocr import ocr_service
from services.api.app.services.semantic import semantic_service
from services.api.app.services.trash_identity_store import (
    classify_trash_identity,
    trash_identity_store,
)


class PipelineService:
    def run(
        self,
        payload: PipelineRequest,
        *,
        guard: Callable[[], None] | None = None,
        on_stage_change: Callable[[str, int, str], None] | None = None,
    ) -> PipelineResponse:
        source_path = media_storage_service.ensure_local_source(
            payload.media_path,
            payload.media_url,
        )
        original_url = media_storage_service.resolve_original_url(
            source_path,
            payload.media_url,
        )

        self._guard(guard)
        self._emit_stage(on_stage_change, "enhancing", 30, "正在执行图像增强")
        enhanced_path, enhancement_model, enhancement_mode = (
            enhancement_service.enhance(source_path)
        )
        enhanced_media = media_storage_service.store_enhanced(enhanced_path)

        self._guard(guard)
        self._emit_stage(on_stage_change, "detecting", 50, "正在执行目标检测")
        detections, detection_model, detection_mode = detection_service.detect(
            enhanced_path, payload.volunteer_note or ""
        )
        categories = sorted({item.label for item in detections})
        self._guard(guard)
        self._emit_stage(on_stage_change, "recognizing", 65, "正在执行 OCR 识别")
        ocr_texts, ocr_keywords, ocr_model, ocr_mode = ocr_service.recognize(
            enhanced_path, detections, payload.volunteer_note or ""
        )
        source_hint = self._infer_source(categories)
        self._guard(guard)
        self._emit_stage(on_stage_change, "analyzing", 80, "正在分析语义与来源")
        semantic_result, semantic_model, semantic_mode = semantic_service.analyze(
            note=payload.volunteer_note or "",
            site_name=payload.site_name,
            categories=categories,
            ocr_keywords=ocr_keywords,
            ocr_texts=ocr_texts,
            source_hint=source_hint,
        )
        normalized_ocr_keywords = ocr_keywords or self._mock_ocr_keywords(
            categories, payload.volunteer_note or ""
        )
        classification = classify_trash_identity(
            primary_category=categories[0] if categories else None,
            categories=categories,
            volunteer_note=payload.volunteer_note or "",
            volunteer_summary=semantic_result.summary,
            source_hint=source_hint,
            ocr_texts=ocr_texts,
            ocr_keywords=normalized_ocr_keywords,
        )

        response = PipelineResponse(
            identityId=f"TI-{uuid4().hex[:8].upper()}",
            originalUrl=original_url,
            enhancedUrl=enhanced_media.public_url,
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
            recognizedCategory=classification.item_name,
            professionalCategory=classification.professional_category,
            sourceHint=source_hint,
            ocrKeywords=normalized_ocr_keywords,
            detections=detections,
            volunteerTags=semantic_result.tags,
            volunteerSummary=semantic_result.summary,
            volunteerRiskLevel=semantic_result.risk_level,
            actionSuggestions=semantic_result.action_suggestions,
        )

        self._guard(guard)
        self._emit_stage(on_stage_change, "persisting", 95, "正在写入垃圾身份证")
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

    def _emit_stage(
        self,
        callback: Callable[[str, int, str], None] | None,
        stage: str,
        progress: int,
        message: str,
    ) -> None:
        if callback is not None:
            callback(stage, progress, message)

    def _guard(self, callback: Callable[[], None] | None) -> None:
        if callback is not None:
            callback()


pipeline_service = PipelineService()
