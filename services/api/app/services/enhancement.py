from __future__ import annotations

import json
import logging
import shutil
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from services.api.app.config import ENHANCED_DIR, settings

logger = logging.getLogger(__name__)

try:
    import cv2
    import numpy as np
    from modelscope.hub.snapshot_download import snapshot_download
    from modelscope.outputs import OutputKeys
    from modelscope.pipelines import pipeline as modelscope_pipeline
    from modelscope.utils.constant import Tasks
except ImportError:  # pragma: no cover - optional runtime dependency
    cv2 = None
    np = None
    OutputKeys = None
    Tasks = None
    modelscope_pipeline = None
    snapshot_download = None


class EnhancementService:
    def enhance(self, source_path: Path) -> tuple[Path, str, str]:
        enhanced_name = f"enhanced_{uuid4().hex[:10]}_{source_path.name}"
        enhanced_path = ENHANCED_DIR / enhanced_name

        if settings.modelscope_enable_local_sdk and self._enhance_with_modelscope(
            source_path, enhanced_path
        ):
            return (
                enhanced_path,
                settings.modelscope_enhance_model,
                "modelscope-local-sdk+underwater-postprocess",
            )

        if self._enhance_with_underwater_opencv(source_path, enhanced_path):
            return (
                enhanced_path,
                settings.modelscope_enhance_model,
                "opencv-underwater-fallback",
            )

        # 最后兜底仍保留一份原图副本，避免业务链路中断。
        shutil.copyfile(source_path, enhanced_path)
        return enhanced_path, settings.modelscope_enhance_model, "mock-copy"

    def _enhance_with_modelscope(self, source_path: Path, target_path: Path) -> bool:
        if (
            cv2 is None
            or np is None
            or OutputKeys is None
            or Tasks is None
            or modelscope_pipeline is None
            or snapshot_download is None
        ):
            logger.info(
                "ModelScope vision dependencies are not installed, fallback to OpenCV underwater enhancement."
            )
            return False

        try:
            pipeline_instance = self._get_modelscope_pipeline()
            result = pipeline_instance(str(source_path))
            output_image = result.get(OutputKeys.OUTPUT_IMG)
            if output_image is None:
                raise ValueError("ModelScope pipeline returned no output image")

            enhanced_image = self._apply_underwater_postprocess(output_image)

            if not cv2.imwrite(str(target_path), enhanced_image):
                raise ValueError(f"Failed to write enhanced image: {target_path}")

            return True
        except Exception:  # pragma: no cover - depends on local model runtime
            logger.exception(
                "ModelScope enhancement failed, fallback to OpenCV underwater enhancement."
            )
            return False

    def _enhance_with_underwater_opencv(
        self, source_path: Path, target_path: Path
    ) -> bool:
        if cv2 is None or np is None:
            logger.info("OpenCV is unavailable, fallback to mock copy.")
            return False

        image = cv2.imread(str(source_path), cv2.IMREAD_COLOR)
        if image is None:
            logger.warning("Failed to read source image for OpenCV enhancement: %s", source_path)
            return False

        try:
            enhanced_image = self._apply_underwater_postprocess(image)
            if not cv2.imwrite(str(target_path), enhanced_image):
                raise ValueError(f"Failed to write enhanced image: {target_path}")
            return True
        except Exception:  # pragma: no cover - depends on image contents/runtime
            logger.exception("OpenCV underwater enhancement failed, fallback to mock copy.")
            return False

    def _apply_underwater_postprocess(self, image):
        working = self._to_uint8_bgr(image)
        balanced = self._underwater_white_balance(working)
        contrasted = self._enhance_local_contrast(balanced)
        vivid = self._boost_color_and_brightness(contrasted)
        return self._sharpen(vivid)

    def _to_uint8_bgr(self, image):
        if np is None:
            raise RuntimeError("numpy is required for underwater enhancement")

        working = np.asarray(image)
        if working.ndim == 2:
            working = cv2.cvtColor(working, cv2.COLOR_GRAY2BGR)
        if working.dtype != np.uint8:
            working = np.clip(working, 0, 255).astype(np.uint8)
        return working

    def _underwater_white_balance(self, image):
        working = image.astype(np.float32)
        blue, green, red = cv2.split(working)

        red_mean = max(float(red.mean()), 1.0)
        green_mean = max(float(green.mean()), 1.0)
        blue_mean = max(float(blue.mean()), 1.0)
        gray_mean = (red_mean + green_mean + blue_mean) / 3.0

        red *= np.clip((gray_mean / red_mean) * 1.18, 1.1, 1.9)
        green *= np.clip((gray_mean / green_mean) * 1.04, 0.95, 1.25)
        blue *= np.clip((gray_mean / blue_mean) * 0.94, 0.82, 1.05)

        merged = cv2.merge([blue, green, red])
        stretched = self._percentile_stretch(merged)
        return stretched

    def _percentile_stretch(self, image):
        working = image.astype(np.float32)
        stretched_channels = []
        for channel in cv2.split(working):
            low, high = np.percentile(channel, (1.0, 99.2))
            if high - low < 1.0:
                stretched_channels.append(np.clip(channel, 0, 255))
                continue
            normalized = (channel - low) * (255.0 / (high - low))
            stretched_channels.append(np.clip(normalized, 0, 255))
        merged = cv2.merge(stretched_channels)
        return merged.astype(np.uint8)

    def _enhance_local_contrast(self, image):
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.2, tileGridSize=(8, 8))
        enhanced_l = clahe.apply(l_channel)
        return cv2.cvtColor(
            cv2.merge([enhanced_l, a_channel, b_channel]),
            cv2.COLOR_LAB2BGR,
        )

    def _boost_color_and_brightness(self, image):
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[..., 1] = np.clip(hsv[..., 1] * 1.16, 0, 255)
        hsv[..., 2] = np.clip(hsv[..., 2] * 1.06 + 4.0, 0, 255)
        return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    def _sharpen(self, image):
        blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=1.6)
        return cv2.addWeighted(image, 1.18, blurred, -0.18, 0)

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_modelscope_pipeline():
        model_dir = snapshot_download(settings.modelscope_enhance_model)
        EnhancementService._sanitize_modelscope_config(
            Path(model_dir) / "configuration.json"
        )

        return modelscope_pipeline(
            Tasks.image_denoising,
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


enhancement_service = EnhancementService()
