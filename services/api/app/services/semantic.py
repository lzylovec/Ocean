from __future__ import annotations

import json
import logging
from functools import lru_cache

from openai import APITimeoutError, OpenAI

from services.api.app.config import settings
from services.api.app.schemas import VolunteerSemanticResult

logger = logging.getLogger(__name__)


class SemanticService:
    def analyze(
        self,
        *,
        note: str,
        site_name: str,
        categories: list[str],
        ocr_keywords: list[str],
        ocr_texts: list[str],
        source_hint: str,
    ) -> tuple[VolunteerSemanticResult, str, str]:
        if settings.modelscope_enable_semantic_llm and settings.modelscope_llm_api_key:
            result = self._analyze_with_llm(
                note=note,
                site_name=site_name,
                categories=categories,
                ocr_keywords=ocr_keywords,
                ocr_texts=ocr_texts,
                source_hint=source_hint,
            )
            if result is not None:
                return (
                    result,
                    settings.modelscope_llm_model,
                    "modelscope-openai-compatible",
                )

        fallback = self._fallback_result(
            note=note,
            site_name=site_name,
            categories=categories,
            ocr_keywords=ocr_keywords,
            source_hint=source_hint,
        )
        return fallback, settings.modelscope_llm_model, "rule-fallback"

    def _analyze_with_llm(
        self,
        *,
        note: str,
        site_name: str,
        categories: list[str],
        ocr_keywords: list[str],
        ocr_texts: list[str],
        source_hint: str,
    ) -> VolunteerSemanticResult | None:
        last_error: Exception | None = None
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "你是海洋垃圾治理项目的语义分析助手。"
                        "请根据志愿者反馈和识别上下文，输出严格 JSON，字段必须为"
                        " tags, summary, riskLevel, actionSuggestions。"
                        " riskLevel 只能是 low、medium、high。"
                        " tags 输出 2 到 5 个中文短标签。"
                        " summary 用 1 句中文总结，不超过 60 字。"
                        " actionSuggestions 输出 1 到 3 个中文行动建议。"
                        " 不要输出 Markdown，不要输出额外解释。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "siteName": site_name,
                            "volunteerNote": note,
                            "detectedCategories": categories,
                            "ocrKeywords": ocr_keywords,
                            "ocrTexts": ocr_texts,
                            "sourceHint": source_hint,
                        },
                        ensure_ascii=False,
                    ),
                },
            ]

            max_attempts = max(settings.modelscope_llm_max_attempts, 1)
            for attempt in range(max_attempts):
                try:
                    completion = self._get_client().chat.completions.create(
                        model=settings.modelscope_llm_model,
                        temperature=0.1,
                        messages=messages,
                    )
                except APITimeoutError as error:
                    last_error = error
                    logger.warning(
                        "Semantic request timed out on attempt %s/%s, fallback to rules.",
                        attempt + 1,
                        max_attempts,
                    )
                    break

                payload_dict = completion.model_dump()
                choices = payload_dict.get("choices") or []
                if not choices:
                    last_error = ValueError(
                        f"Semantic response returned no choices: {payload_dict}"
                    )
                    if attempt + 1 < max_attempts:
                        logger.warning(
                            "Semantic response had no choices on attempt %s/%s, retrying.",
                            attempt + 1,
                            max_attempts,
                        )
                        continue
                    raise last_error

                message = choices[0].get("message") or {}
                content = message.get("content") or ""
                payload = self._extract_json(content)
                normalized_payload = self._coerce_payload(payload)
                return VolunteerSemanticResult(
                    tags=self._normalize_list(
                        normalized_payload.get("tags"), fallback=[]
                    ),
                    summary=self._normalize_text(
                        normalized_payload.get("summary"), fallback="待补人工总结"
                    ),
                    riskLevel=self._normalize_risk(normalized_payload.get("riskLevel")),
                    actionSuggestions=self._normalize_list(
                        normalized_payload.get("actionSuggestions"),
                        fallback=["建议人工复核"],
                    ),
                )

            if last_error is not None:
                raise last_error
        except Exception:
            logger.exception("Semantic LLM analysis failed, fallback to rules.")
            return None

    def _fallback_result(
        self,
        *,
        note: str,
        site_name: str,
        categories: list[str],
        ocr_keywords: list[str],
        source_hint: str,
    ) -> VolunteerSemanticResult:
        tags: list[str] = []

        if "能见度" in note:
            tags.append("能见度差")
        if "渔" in note or "废弃渔网" in categories:
            tags.append("渔具类")
        if "塑料" in note or "塑料瓶" in categories:
            tags.append("塑料包装")
        if source_hint:
            tags.append("需溯源复核")
        if not tags:
            tags.append("待人工补充")

        risk_level = "medium"
        if "危险" in note:
            risk_level = "high"
        elif not note and not categories:
            risk_level = "low"

        summary_parts = [site_name, "现场反馈"]
        if note:
            summary_parts.append(note[:40])
        elif categories:
            summary_parts.append(f"识别到{','.join(categories[:2])}")

        suggestions = ["建议后台复核"]
        if "渔具类" in tags:
            suggestions.append("联动渔业巡查")
        if "塑料包装" in tags:
            suggestions.append("关注岸线来源")
        if ocr_keywords:
            suggestions.append("结合 OCR 线索做溯源")

        return VolunteerSemanticResult(
            tags=self._dedupe(tags)[:5],
            summary="，".join(part for part in summary_parts if part),
            riskLevel=risk_level,
            actionSuggestions=self._dedupe(suggestions)[:3],
        )

    def _extract_json(self, content: str) -> dict:
        text = content.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()

        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError(f"No JSON object found in semantic response: {content}")

        return json.loads(text[start : end + 1])

    def _coerce_payload(self, payload: dict) -> dict:
        tags = payload.get("tags") or payload.get("semantic_tags") or []
        summary = payload.get("summary") or payload.get("analysis_summary")
        risk = (
            payload.get("riskLevel")
            or payload.get("risk_level")
            or self._get_nested(payload, "risk_evaluation", "level")
            or self._get_nested(payload, "riskAssessment", "level")
        )
        action_suggestions = (
            payload.get("actionSuggestions")
            or payload.get("recommended_actions")
            or self._get_nested(payload, "recommendations", "actions")
            or payload.get("action_plan")
            or []
        )

        if summary is None:
            reasoning = self._get_nested(
                payload, "semantic_analysis", "pollution_assessment", "reasoning"
            )
            detected_items = self._get_nested(
                payload, "semantic_analysis", "pollution_assessment", "detected_items"
            )
            if isinstance(reasoning, str) and reasoning.strip():
                summary = reasoning.strip()[:60]
            elif isinstance(detected_items, list) and detected_items:
                summary = (
                    f"重点关注{','.join(str(item) for item in detected_items[:2])}"
                )

        return {
            "tags": tags,
            "summary": summary,
            "riskLevel": risk,
            "actionSuggestions": action_suggestions,
        }

    def _get_nested(self, payload: dict, *path: str):
        current = payload
        for key in path:
            if not isinstance(current, dict):
                return None
            current = current.get(key)
        return current

    def _normalize_text(self, value, *, fallback: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return fallback

    def _normalize_list(self, value, *, fallback: list[str]) -> list[str]:
        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            return self._dedupe(normalized) or fallback
        if isinstance(value, str) and value.strip():
            normalized = [part.strip() for part in value.split(",") if part.strip()]
            return self._dedupe(normalized) or fallback
        return fallback

    def _normalize_risk(self, value) -> str:
        if isinstance(value, str):
            normalized = value.strip().lower()
            risk_map = {
                "low": "low",
                "medium": "medium",
                "high": "high",
                "低": "low",
                "中": "medium",
                "中等": "medium",
                "中高": "high",
                "高": "high",
            }
            if normalized in risk_map:
                return risk_map[normalized]
        return "medium"

    def _dedupe(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for value in values:
            if not value or value in seen:
                continue
            seen.add(value)
            deduped.append(value)
        return deduped

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client() -> OpenAI:
        return OpenAI(
            base_url=settings.modelscope_llm_base_url,
            api_key=settings.modelscope_llm_api_key,
            timeout=settings.modelscope_llm_timeout_seconds,
            max_retries=0,
        )


semantic_service = SemanticService()
