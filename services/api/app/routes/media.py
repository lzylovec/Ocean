from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from services.api.app.config import UPLOADS_DIR
from services.api.app.database_resilience import (
    DatabaseUnavailableError,
    raise_database_http_error,
    run_database_write,
)
from services.api.app.schemas import UploadResponse
from services.api.app.services.media_migration import media_migration_service
from services.api.app.services.media_storage import media_storage_service


router = APIRouter(prefix="/api/v1/media", tags=["media"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/upload", response_model=UploadResponse)
async def upload_media(file: UploadFile = File(...)) -> UploadResponse:
    safe_name = file.filename or "upload.bin"
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, and WebP images are supported.",
        )

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be an image.",
        )

    generated_name = f"{uuid4().hex[:12]}{extension}"
    target_path = UPLOADS_DIR / generated_name

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Uploaded image must not exceed 10 MB.",
        )

    target_path.write_bytes(content)
    stored_media = media_storage_service.store_upload(
        target_path,
        content_type=file.content_type,
    )

    return UploadResponse(
        filename=safe_name,
        storedPath=str(target_path),
        publicUrl=stored_media.public_url,
    )


@router.post("/migrate-storage")
def migrate_local_media_to_storage() -> dict[str, int | str]:
    try:
        result = run_database_write(
            media_migration_service.migrate_local_media_to_storage
        )
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DatabaseUnavailableError:
        raise_database_http_error("历史图片回迁暂时不可用，请稍后重试。")

    return {
        "status": "ok",
        "migratedOriginal": result.migrated_original,
        "migratedEnhanced": result.migrated_enhanced,
        "updatedJobs": result.updated_jobs,
    }


@router.get("/object/{object_path:path}")
def get_remote_media(object_path: str) -> Response:
    try:
        media = media_storage_service.download_object(object_path)
    except Exception as error:
        raise HTTPException(status_code=404, detail="Remote media not found.") from error

    return Response(content=media.content, media_type=media.content_type)
