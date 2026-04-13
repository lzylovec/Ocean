from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import yaml

from services.api.app.config import settings
from services.api.app.schemas import Detection

logger = logging.getLogger(__name__)

try:
    import cv2
    import onnxruntime as ort
    from modelscope.hub.snapshot_download import snapshot_download
except ImportError:  # pragma: no cover - optional runtime dependency
    cv2 = None
    ort = None
    snapshot_download = None


TRASH_LABEL_MAP = {
    "backpack": "织物垃圾",
    "bottle": "塑料瓶",
    "book": "纸质垃圾",
    "bowl": "塑料容器",
    "cell phone": "电子垃圾",
    "cup": "塑料杯",
    "fork": "一次性餐具",
    "handbag": "织物垃圾",
    "knife": "一次性餐具",
    "skateboard": "板类垃圾",
    "spoon": "一次性餐具",
    "sports ball": "橡胶球类",
    "suitcase": "大型容器垃圾",
    "surfboard": "板类垃圾",
    "toothbrush": "塑料制品",
    "wine glass": "玻璃容器",
}


class DetectionService:
    def detect(self, image_path: Path, note: str) -> tuple[list[Detection], str, str]:
        if settings.modelscope_enable_local_detection:
            detections, provider_name = self._detect_with_onnx(image_path)
            if detections:
                mode = self._provider_to_mode(provider_name)
                return detections, settings.modelscope_detect_model, mode

        return (
            self._mock_detections(image_path.name, note),
            settings.modelscope_detect_model,
            "mock-fallback",
        )

    def _detect_with_onnx(self, image_path: Path) -> tuple[list[Detection], str]:
        if cv2 is None or ort is None or snapshot_download is None:
            logger.info(
                "ONNX detection dependencies are not installed, fallback to mock."
            )
            return [], "unavailable"

        try:
            session, classes, input_shape, provider_name = (
                self._get_detector_artifacts()
            )
            image = cv2.imread(str(image_path))
            if image is None:
                raise FileNotFoundError(f"Could not read image: {image_path}")

            blob, ratio = self._preprocess(image, input_shape)
            input_name = session.get_inputs()[0].name
            predictions = session.run(None, {input_name: blob})
            return self._postprocess(predictions, ratio, classes), provider_name
        except Exception:  # pragma: no cover - depends on local model runtime
            logger.exception("DAMO-YOLO ONNX detection failed, fallback to mock.")
            return [], "failed"

    def _preprocess(
        self, input_image: np.ndarray, input_shape: tuple[int, ...]
    ) -> tuple[np.ndarray, float]:
        src_h, src_w, _ = input_image.shape
        _, dst_c, dst_h, dst_w = input_shape
        transformed_image = np.ones((dst_h, dst_w, dst_c), dtype=np.uint8)
        ratio_hw = min(dst_h / src_h, dst_w / src_w)
        new_h, new_w = int(ratio_hw * src_h), int(ratio_hw * src_w)
        image = cv2.resize(input_image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        transformed_image[:new_h, :new_w, :] = image
        transformed_image = transformed_image.transpose((2, 0, 1))
        transformed_image = np.ascontiguousarray(transformed_image).astype("float32")
        return transformed_image[None], ratio_hw

    def _postprocess(
        self,
        predictions: list[np.ndarray],
        ratio_hw: float,
        classes: list[str],
    ) -> list[Detection]:
        scores = predictions[0].squeeze(axis=0)
        bboxes = predictions[1].squeeze(axis=0)
        bboxes /= ratio_hw

        boxes: list[list[int]] = []
        confidences: list[float] = []
        class_ids: list[int] = []

        for index in range(len(bboxes)):
            score = float(np.max(scores[index, :]))
            if score < 0.25:
                continue

            class_id = int(np.argmax(scores[index, :]))
            mapped_label = self._map_trash_label(classes[class_id])
            if not mapped_label:
                continue

            xmin, ymin, xmax, ymax = bboxes[index, :].astype(np.int32)
            width = int(xmax - xmin)
            height = int(ymax - ymin)
            boxes.append([int(xmin), int(ymin), width, height])
            confidences.append(score)
            class_ids.append(class_id)

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.25, 0.45)
        if len(indices) == 0:
            return []

        detections: list[Detection] = []
        for raw_index in np.array(indices).reshape(-1):
            index = int(raw_index)
            x, y, w, h = boxes[index]
            detections.append(
                Detection(
                    label=self._map_trash_label(classes[class_ids[index]])
                    or classes[class_ids[index]],
                    confidence=round(confidences[index], 4),
                    bbox=(x, y, x + w, y + h),
                )
            )

        return detections

    def _map_trash_label(self, label: str) -> str | None:
        return TRASH_LABEL_MAP.get(label)

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_detector_artifacts() -> tuple[
        ort.InferenceSession, list[str], tuple[int, ...], str
    ]:
        model_dir = Path(snapshot_download(settings.modelscope_detect_model))
        yaml_path = next(model_dir.glob("*.yaml"))
        config = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))

        remote_model_path = str(config["model_path"])
        model_filename = Path(urlparse(remote_model_path).path).name
        local_model_path = model_dir / model_filename
        if not local_model_path.exists():
            raise FileNotFoundError(f"Could not locate ONNX model: {local_model_path}")

        providers = DetectionService._resolve_execution_providers()
        session = ort.InferenceSession(str(local_model_path), providers=providers)
        input_shape = tuple(session.get_inputs()[0].shape)
        classes = list(config["classes"])
        provider_name = session.get_providers()[0]
        logger.info("DAMO-YOLO using ONNX provider: %s", provider_name)
        return session, classes, input_shape, provider_name

    @staticmethod
    def _resolve_execution_providers() -> list[str]:
        available = set(ort.get_available_providers())
        preferred = settings.onnx_execution_provider.strip().lower()

        if preferred == "cuda":
            if "CUDAExecutionProvider" in available:
                return ["CUDAExecutionProvider", "CPUExecutionProvider"]

            logger.warning(
                "ONNX_EXECUTION_PROVIDER=cuda but CUDAExecutionProvider is unavailable, fallback to CPU."
            )
            return ["CPUExecutionProvider"]

        if preferred == "coreml":
            if "CoreMLExecutionProvider" in available:
                return ["CoreMLExecutionProvider", "CPUExecutionProvider"]

            logger.warning(
                "ONNX_EXECUTION_PROVIDER=coreml but CoreMLExecutionProvider is unavailable, fallback to CPU."
            )
            return ["CPUExecutionProvider"]

        if preferred == "cpu":
            return ["CPUExecutionProvider"]

        if "CUDAExecutionProvider" in available:
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]

        if "CoreMLExecutionProvider" in available:
            return ["CoreMLExecutionProvider", "CPUExecutionProvider"]

        return ["CPUExecutionProvider"]

    @staticmethod
    def _provider_to_mode(provider_name: str) -> str:
        mode_map = {
            "CPUExecutionProvider": "onnx-local-cpu",
            "CUDAExecutionProvider": "onnx-local-cuda",
            "CoreMLExecutionProvider": "onnx-local-coreml",
        }
        return mode_map.get(provider_name, f"onnx-local-{provider_name.lower()}")

    def _mock_detections(self, filename: str, note: str) -> list[Detection]:
        text = f"{filename} {note}".lower()

        if "net" in text or "渔" in note:
            return [
                Detection(label="废弃渔网", confidence=0.88, bbox=(42, 80, 300, 240)),
                Detection(label="绳索碎段", confidence=0.73, bbox=(310, 125, 468, 260)),
            ]

        if "can" in text or "罐" in note:
            return [
                Detection(
                    label="金属易拉罐", confidence=0.81, bbox=(120, 96, 282, 252)
                ),
            ]

        return [
            Detection(label="塑料瓶", confidence=0.91, bbox=(78, 92, 236, 344)),
            Detection(label="包装碎片", confidence=0.76, bbox=(260, 180, 420, 322)),
        ]


detection_service = DetectionService()
