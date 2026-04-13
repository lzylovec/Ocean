from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[3]
STORAGE_DIR = ROOT_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
ENHANCED_DIR = STORAGE_DIR / "enhanced"

load_dotenv(ROOT_DIR / "services" / "api" / ".env")


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000")
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{(STORAGE_DIR / 'ocean.db').as_posix()}"
    )
    modelscope_api_key: str = os.getenv("MODELSCOPE_API_KEY", "")
    modelscope_base_url: str = os.getenv("MODELSCOPE_BASE_URL", "")
    modelscope_enable_semantic_llm: bool = _get_bool(
        "MODELSCOPE_ENABLE_SEMANTIC_LLM", True
    )
    modelscope_llm_base_url: str = os.getenv(
        "MODELSCOPE_LLM_BASE_URL", "https://api-inference.modelscope.cn/v1"
    )
    modelscope_llm_api_key: str = os.getenv("MODELSCOPE_LLM_API_KEY", "")
    modelscope_llm_model: str = os.getenv(
        "MODELSCOPE_LLM_MODEL", "Qwen/Qwen3.5-397B-A17B"
    )
    onnx_execution_provider: str = os.getenv("ONNX_EXECUTION_PROVIDER", "auto")
    modelscope_enable_local_sdk: bool = _get_bool("MODELSCOPE_ENABLE_LOCAL_SDK", True)
    modelscope_enable_local_detection: bool = _get_bool(
        "MODELSCOPE_ENABLE_LOCAL_DETECTION", True
    )
    modelscope_enable_local_ocr: bool = _get_bool("MODELSCOPE_ENABLE_LOCAL_OCR", True)
    modelscope_enhance_model: str = os.getenv(
        "MODELSCOPE_ENHANCE_MODEL", "iic/cv_nafnet_image-denoise_sidd"
    )
    modelscope_detect_model: str = os.getenv(
        "MODELSCOPE_DETECT_MODEL", "CVHub520/damo_yolo_t"
    )
    modelscope_ocr_detection_model: str = os.getenv(
        "MODELSCOPE_OCR_DETECTION_MODEL",
        "damo/cv_resnet18_ocr-detection-db-line-level_damo",
    )
    modelscope_ocr_model: str = os.getenv(
        "MODELSCOPE_OCR_MODEL", "iic/cv_convnextTiny_ocr-recognition-general_damo"
    )


settings = Settings()

for directory in (STORAGE_DIR, UPLOADS_DIR, ENHANCED_DIR):
    directory.mkdir(parents=True, exist_ok=True)
