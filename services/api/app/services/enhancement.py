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
    from modelscope.hub.snapshot_download import snapshot_download
    from modelscope.outputs import OutputKeys
    from modelscope.pipelines import pipeline as modelscope_pipeline
    from modelscope.utils.constant import Tasks
except ImportError:  # pragma: no cover - optional runtime dependency
    cv2 = None
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
                "modelscope-local-sdk",
            )

        # 模型依赖或运行条件不满足时，保留一份原图副本继续打通业务链路。
        shutil.copyfile(source_path, enhanced_path)
        return enhanced_path, settings.modelscope_enhance_model, "mock-copy"

    def _enhance_with_modelscope(self, source_path: Path, target_path: Path) -> bool:
        if (
            cv2 is None
            or OutputKeys is None
            or Tasks is None
            or modelscope_pipeline is None
            or snapshot_download is None
        ):
            logger.info(
                "ModelScope vision dependencies are not installed, fallback to mock copy."
            )
            return False

        try:
            pipeline_instance = self._get_modelscope_pipeline()
            result = pipeline_instance(str(source_path))
            output_image = result.get(OutputKeys.OUTPUT_IMG)
            if output_image is None:
                raise ValueError("ModelScope pipeline returned no output image")

            if not cv2.imwrite(str(target_path), output_image):
                raise ValueError(f"Failed to write enhanced image: {target_path}")

            return True
        except Exception:  # pragma: no cover - depends on local model runtime
            logger.exception("ModelScope enhancement failed, fallback to mock copy.")
            return False

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
