from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, UploadFile

from services.api.app.config import UPLOADS_DIR, settings
from services.api.app.schemas import UploadResponse


router = APIRouter(prefix="/api/v1/media", tags=["media"])


@router.post("/upload", response_model=UploadResponse)
async def upload_media(file: UploadFile = File(...)) -> UploadResponse:
    safe_name = file.filename or "upload.bin"
    extension = Path(safe_name).suffix or ".bin"
    generated_name = f"{uuid4().hex[:12]}{extension}"
    target_path = UPLOADS_DIR / generated_name

    content = await file.read()
    target_path.write_bytes(content)

    return UploadResponse(
        filename=safe_name,
        storedPath=str(target_path),
        publicUrl=f"{settings.public_base_url}/storage/uploads/{generated_name}",
    )
