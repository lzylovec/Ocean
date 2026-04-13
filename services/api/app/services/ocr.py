from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

from services.api.app.config import settings
from services.api.app.schemas import Detection

logger = logging.getLogger(__name__)

try:
    import cv2
    from modelscope.hub.snapshot_download import snapshot_download
    from modelscope.pipelines import pipeline as modelscope_pipeline
    from modelscope.utils.constant import Tasks
except ImportError:  # pragma: no cover - optional runtime dependency
    cv2 = None
    Tasks = None
    modelscope_pipeline = None
    snapshot_download = None


TEXT_BEARING_LABELS = {
    "一次性餐具",
    "大型容器垃圾",
    "塑料制品",
    "塑料容器",
    "塑料杯",
    "塑料瓶",
    "玻璃容器",
    "电子垃圾",
    "纸质垃圾",
}


class OCRService:
    def recognize(
        self, image_path: Path, detections: list[Detection], note: str
    ) -> tuple[list[str], list[str], str, str]:
        if settings.modelscope_enable_local_ocr:
            texts = self._recognize_with_modelscope(image_path, detections)
            if texts:
                return (
                    texts,
                    self._extract_keywords(texts),
                    self._current_model_label(),
                    "detection+recognition-local-sdk",
                )

        fallback_texts = self._mock_ocr_texts(detections, note)
        return (
            fallback_texts,
            self._extract_keywords(fallback_texts),
            self._current_model_label(),
            "mock-fallback",
        )

    def _recognize_with_modelscope(
        self, image_path: Path, detections: list[Detection]
    ) -> list[str]:
        if (
            cv2 is None
            or Tasks is None
            or modelscope_pipeline is None
            or snapshot_download is None
        ):
            logger.info("OCR dependencies are not installed, fallback to mock.")
            return []

        try:
            image = cv2.imread(str(image_path))
            if image is None:
                raise FileNotFoundError(f"Could not read image: {image_path}")

            recognizer = self._get_modelscope_pipeline()
            texts = self._recognize_detected_text_regions(image, detections, recognizer)
            if texts:
                return self._dedupe_texts(texts)

            # 整图文字检测没有结果时，回退到既有的物体框裁剪识别，避免链路中断。
            return self._dedupe_texts(
                self._recognize_detection_crops(image, detections, recognizer)
            )
        except Exception:  # pragma: no cover - depends on local model runtime
            logger.exception("OCR recognition failed, fallback to mock.")
            return []

    def _recognize_detected_text_regions(
        self, image, detections: list[Detection], recognizer
    ) -> list[str]:
        detector = self._get_modelscope_detection_pipeline()
        result = detector(image)
        raw_polygons = result.get("polygons")
        polygons = self._normalize_polygons(
            [] if raw_polygons is None else raw_polygons
        )
        if not polygons:
            return []

        candidate_detections = [
            detection
            for detection in detections
            if detection.label in TEXT_BEARING_LABELS
        ]
        filtered_polygons = self._filter_polygons_by_detections(
            polygons, candidate_detections
        )
        target_polygons = filtered_polygons or polygons

        texts: list[str] = []
        for polygon in self._sort_polygons(target_polygons):
            crop = self._crop_polygon(image, polygon)
            if crop is None:
                continue

            result = recognizer(crop)
            texts.extend(self._normalize_ocr_output(result))

        return texts

    def _recognize_detection_crops(
        self, image, detections: list[Detection], recognizer
    ) -> list[str]:
        texts: list[str] = []
        candidate_detections = [
            detection
            for detection in detections
            if detection.label in TEXT_BEARING_LABELS
        ]
        if not candidate_detections:
            candidate_detections = detections[:1]

        for detection in candidate_detections:
            crop = self._crop_detection(image, detection.bbox)
            if crop is None:
                continue

            result = recognizer(crop)
            texts.extend(self._normalize_ocr_output(result))

        return texts

    def _crop_detection(self, image, bbox: tuple[int, int, int, int]):
        x1, y1, x2, y2 = bbox
        height, width = image.shape[:2]
        pad_x = max(8, int((x2 - x1) * 0.08))
        pad_y = max(8, int((y2 - y1) * 0.08))
        left = max(0, x1 - pad_x)
        top = max(0, y1 - pad_y)
        right = min(width, x2 + pad_x)
        bottom = min(height, y2 + pad_y)
        crop = image[top:bottom, left:right]
        if crop.size == 0:
            return None

        if crop.shape[0] < 32:
            scale = 32 / max(1, crop.shape[0])
            resized_width = max(32, int(crop.shape[1] * scale))
            crop = cv2.resize(crop, (resized_width, 32), interpolation=cv2.INTER_CUBIC)

        return crop

    def _crop_polygon(self, image, polygon: list[int]):
        points = np.array(polygon, dtype=np.int32).reshape(-1, 2)
        x, y, w, h = cv2.boundingRect(points)
        return self._crop_detection(image, (x, y, x + w, y + h))

    def _normalize_polygons(self, polygons: list) -> list[list[int]]:
        normalized: list[list[int]] = []
        for polygon in polygons:
            values = np.array(polygon).astype(int).reshape(-1).tolist()
            if len(values) >= 8:
                normalized.append(values)
        return normalized

    def _filter_polygons_by_detections(
        self, polygons: list[list[int]], detections: list[Detection]
    ) -> list[list[int]]:
        if not detections:
            return polygons

        filtered: list[list[int]] = []
        for polygon in polygons:
            poly_bbox = self._polygon_to_bbox(polygon)
            if any(
                self._boxes_overlap(poly_bbox, detection.bbox)
                for detection in detections
            ):
                filtered.append(polygon)
        return filtered

    def _sort_polygons(self, polygons: list[list[int]]) -> list[list[int]]:
        return sorted(
            polygons,
            key=lambda polygon: (
                self._polygon_to_bbox(polygon)[1],
                self._polygon_to_bbox(polygon)[0],
            ),
        )

    def _polygon_to_bbox(self, polygon: list[int]) -> tuple[int, int, int, int]:
        points = np.array(polygon, dtype=np.int32).reshape(-1, 2)
        x, y, w, h = cv2.boundingRect(points)
        return x, y, x + w, y + h

    def _boxes_overlap(
        self, first: tuple[int, int, int, int], second: tuple[int, int, int, int]
    ) -> bool:
        ax1, ay1, ax2, ay2 = first
        bx1, by1, bx2, by2 = second
        inter_x1 = max(ax1, bx1)
        inter_y1 = max(ay1, by1)
        inter_x2 = min(ax2, bx2)
        inter_y2 = min(ay2, by2)
        return inter_x2 > inter_x1 and inter_y2 > inter_y1

    def _normalize_ocr_output(self, result: dict) -> list[str]:
        raw_texts = result.get("text") or result.get("texts") or []
        texts: list[str] = []
        for raw_text in raw_texts:
            cleaned = str(raw_text).strip()
            if cleaned:
                texts.append(cleaned)
        return texts

    def _extract_keywords(self, texts: list[str]) -> list[str]:
        keywords: list[str] = []
        for text in texts:
            normalized = text.strip()
            if not normalized:
                continue

            keywords.append(normalized)
            for match in re.findall(r"[A-Za-z0-9]{2,}", normalized):
                keywords.append(match.upper())

        return self._dedupe_texts(keywords)[:8]

    def _mock_ocr_texts(self, detections: list[Detection], note: str) -> list[str]:
        labels = {detection.label for detection in detections}
        if "塑料瓶" in labels:
            return ["PET", "DRINK"]
        if "金属易拉罐" in labels:
            return ["AL", "CAN"]
        if "渔" in note:
            return ["NYLON"]
        return []

    def _dedupe_texts(self, texts: list[str]) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for text in texts:
            key = text.strip()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(key)
        return deduped

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_modelscope_pipeline():
        model_dir = snapshot_download(settings.modelscope_ocr_model)
        OCRService._sanitize_modelscope_config(Path(model_dir) / "configuration.json")
        return modelscope_pipeline(
            Tasks.ocr_recognition,
            model=model_dir,
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_modelscope_detection_pipeline():
        model_dir = snapshot_download(settings.modelscope_ocr_detection_model)
        OCRService._sanitize_modelscope_config(Path(model_dir) / "configuration.json")
        return modelscope_pipeline(
            Tasks.ocr_detection,
            model=model_dir,
        )

    @staticmethod
    def _sanitize_modelscope_config(config_path: Path) -> None:
        raw_text = config_path.read_text(encoding="utf-8")
        decoder = json.JSONDecoder()
        parsed, end = decoder.raw_decode(raw_text)
        trailing = raw_text[end:].strip()

        if not trailing:
            return

        logger.warning(
            "ModelScope config contained duplicated JSON payloads, rewriting %s",
            config_path,
        )
        config_path.write_text(
            json.dumps(parsed, ensure_ascii=False, indent=4) + "\n",
            encoding="utf-8",
        )

    def _current_model_label(self) -> str:
        return (
            f"{settings.modelscope_ocr_detection_model} + "
            f"{settings.modelscope_ocr_model}"
        )


ocr_service = OCRService()
