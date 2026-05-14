from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

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


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        return default


def _infer_supabase_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    host = parsed.hostname or ""
    if host.startswith("db.") and host.endswith(".supabase.co"):
        return f"https://{host.removeprefix('db.')}"

    if host.endswith(".pooler.supabase.com"):
        username = parsed.username or ""
        if "." in username:
            return f"https://{username.split('.', 1)[1]}.supabase.co"

    return ""


def _infer_supabase_s3_endpoint(supabase_url: str) -> str:
    if not supabase_url:
        return ""

    parsed = urlparse(supabase_url)
    host = parsed.hostname or ""
    if not host:
        return ""

    return f"{parsed.scheme}://{host.removesuffix('.supabase.co')}.storage.supabase.co/storage/v1/s3"


DEFAULT_DATABASE_URL = os.getenv(
    "DATABASE_URL", f"sqlite:///{(STORAGE_DIR / 'ocean.db').as_posix()}"
)
DEFAULT_SUPABASE_URL = os.getenv("SUPABASE_URL") or _infer_supabase_url(
    DEFAULT_DATABASE_URL
)
DEFAULT_SUPABASE_S3_ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT") or _infer_supabase_s3_endpoint(
    DEFAULT_SUPABASE_URL
)


@dataclass(frozen=True)
class Settings:
    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000")
    database_url: str = DEFAULT_DATABASE_URL
    modelscope_api_key: str = os.getenv("MODELSCOPE_API_KEY", "")
    modelscope_base_url: str = os.getenv("MODELSCOPE_BASE_URL", "")
    supabase_url: str = DEFAULT_SUPABASE_URL
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_s3_endpoint: str = DEFAULT_SUPABASE_S3_ENDPOINT
    supabase_s3_region: str = os.getenv("SUPABASE_S3_REGION", "")
    supabase_s3_access_key_id: str = os.getenv("SUPABASE_S3_ACCESS_KEY_ID", "")
    supabase_s3_secret_access_key: str = os.getenv(
        "SUPABASE_S3_SECRET_ACCESS_KEY", ""
    )
    supabase_s3_force_path_style: bool = _get_bool(
        "SUPABASE_S3_FORCE_PATH_STYLE", True
    )
    supabase_storage_bucket: str = os.getenv(
        "SUPABASE_STORAGE_BUCKET", "ocean-media"
    )
    supabase_storage_public: bool = _get_bool("SUPABASE_STORAGE_PUBLIC", True)
    supabase_storage_uploads_prefix: str = os.getenv(
        "SUPABASE_STORAGE_UPLOADS_PREFIX", "uploads"
    )
    supabase_storage_enhanced_prefix: str = os.getenv(
        "SUPABASE_STORAGE_ENHANCED_PREFIX", "enhanced"
    )
    supabase_storage_cache_control_seconds: int = _get_int(
        "SUPABASE_STORAGE_CACHE_CONTROL_SECONDS", 3600
    )
    supabase_storage_download_timeout_seconds: int = _get_int(
        "SUPABASE_STORAGE_DOWNLOAD_TIMEOUT_SECONDS", 30
    )
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
    pipeline_job_retention_days: int = _get_int("PIPELINE_JOB_RETENTION_DAYS", 14)
    pipeline_job_retention_max_records: int = _get_int(
        "PIPELINE_JOB_RETENTION_MAX_RECORDS", 500
    )
    pipeline_job_default_page_size: int = _get_int(
        "PIPELINE_JOB_DEFAULT_PAGE_SIZE", 20
    )
    pipeline_worker_poll_seconds: int = _get_int(
        "PIPELINE_WORKER_POLL_SECONDS", 2
    )
    pipeline_worker_heartbeat_seconds: int = _get_int(
        "PIPELINE_WORKER_HEARTBEAT_SECONDS", 3
    )
    pipeline_worker_stale_seconds: int = _get_int(
        "PIPELINE_WORKER_STALE_SECONDS", 12
    )
    pipeline_worker_retention_seconds: int = _get_int(
        "PIPELINE_WORKER_RETENTION_SECONDS", 86400
    )
    pipeline_job_timeout_seconds: int = _get_int(
        "PIPELINE_JOB_TIMEOUT_SECONDS", 180
    )
    modelscope_llm_timeout_seconds: int = _get_int(
        "MODELSCOPE_LLM_TIMEOUT_SECONDS", 12
    )
    modelscope_llm_max_attempts: int = _get_int(
        "MODELSCOPE_LLM_MAX_ATTEMPTS", 1
    )
    pipeline_cache_version: str = os.getenv("PIPELINE_CACHE_VERSION", "v1")


settings = Settings()

for directory in (STORAGE_DIR, UPLOADS_DIR, ENHANCED_DIR):
    directory.mkdir(parents=True, exist_ok=True)
