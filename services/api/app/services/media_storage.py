from __future__ import annotations

import logging
import mimetypes
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path, PurePosixPath
from urllib.parse import quote
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from services.api.app.config import UPLOADS_DIR, settings

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import ClientError
except ImportError:  # pragma: no cover - optional runtime dependency
    boto3 = None
    BotoConfig = None
    ClientError = None

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - optional runtime dependency
    Client = None
    create_client = None


@dataclass(frozen=True)
class StoredMedia:
    public_url: str
    provider: str
    object_path: str | None = None


@dataclass(frozen=True)
class DownloadedMedia:
    content: bytes
    content_type: str


class MediaStorageService:
    def __init__(self) -> None:
        self._bucket_ready = False

    def is_supabase_enabled(self) -> bool:
        return self._is_s3_configured() or self._is_supabase_configured()

    def ensure_local_source(self, media_path: str, media_url: str | None) -> Path:
        if media_path and not self._looks_like_url(media_path):
            candidate = Path(media_path)
            if candidate.exists():
                return candidate

        source_url = media_url or (media_path if self._looks_like_url(media_path) else "")
        if not source_url:
            raise FileNotFoundError(f"Media file not found: {media_path}")

        extension = Path(urlparse(source_url).path).suffix.lower() or ".bin"
        target_path = UPLOADS_DIR / f"remote_{uuid4().hex[:12]}{extension}"

        try:
            response = httpx.get(
                source_url,
                follow_redirects=True,
                timeout=settings.supabase_storage_download_timeout_seconds,
            )
            response.raise_for_status()
        except Exception as error:
            raise FileNotFoundError(f"Media file not found: {media_path}") from error

        target_path.write_bytes(response.content)
        return target_path

    def resolve_original_url(self, source_path: Path, current_url: str | None) -> str:
        if current_url and not self._is_local_storage_url(current_url):
            return current_url

        if self.is_supabase_enabled():
            return self.store_upload(source_path).public_url

        return current_url or self._local_public_url("uploads", source_path.name)

    def store_upload(self, local_path: Path, content_type: str | None = None) -> StoredMedia:
        return self._store_file(
            local_path,
            prefix=settings.supabase_storage_uploads_prefix,
            local_group="uploads",
            content_type=content_type,
        )

    def store_enhanced(
        self, local_path: Path, content_type: str | None = None
    ) -> StoredMedia:
        return self._store_file(
            local_path,
            prefix=settings.supabase_storage_enhanced_prefix,
            local_group="enhanced",
            content_type=content_type,
        )

    def _store_file(
        self,
        local_path: Path,
        *,
        prefix: str,
        local_group: str,
        content_type: str | None,
    ) -> StoredMedia:
        local_url = self._local_public_url(local_group, local_path.name)
        if self._is_s3_configured():
            try:
                self._ensure_s3_bucket()
                object_path = str(PurePosixPath(prefix) / local_path.name)
                extra_args = {
                    "CacheControl": str(
                        settings.supabase_storage_cache_control_seconds
                    ),
                }
                resolved_content_type = content_type or mimetypes.guess_type(local_path.name)[0]
                if resolved_content_type:
                    extra_args["ContentType"] = resolved_content_type

                with local_path.open("rb") as file_handle:
                    self._get_s3_client().put_object(
                        Bucket=settings.supabase_storage_bucket,
                        Key=object_path,
                        Body=file_handle,
                        **extra_args,
                    )

                return StoredMedia(
                    public_url=self._build_supabase_public_url(object_path, local_group),
                    provider="supabase-s3",
                    object_path=object_path,
                )
            except Exception:  # pragma: no cover - depends on S3 runtime
                logger.exception(
                    "Supabase S3 upload failed for %s, fallback to next provider.",
                    local_path,
                )

        if self._is_supabase_configured():
            self._ensure_bucket()
            object_path = str(PurePosixPath(prefix) / local_path.name)
            upload_options: dict[str, object] = {
                "cache-control": str(
                    settings.supabase_storage_cache_control_seconds
                ),
                "upsert": "true",
            }
            resolved_content_type = content_type or mimetypes.guess_type(local_path.name)[0]
            if resolved_content_type:
                upload_options["content-type"] = resolved_content_type

            bucket = self._get_client().storage.from_(settings.supabase_storage_bucket)
            bucket.upload(object_path, local_path, file_options=upload_options)
            return StoredMedia(
                public_url=self._build_supabase_public_url(object_path, local_group),
                provider="supabase-storage",
                object_path=object_path,
            )

        return StoredMedia(
            public_url=local_url,
            provider="local-static-fallback" if self.is_supabase_enabled() else "local-static",
        )

    def download_object(self, object_path: str) -> DownloadedMedia:
        if self._is_s3_configured():
            response = self._get_s3_client().get_object(
                Bucket=settings.supabase_storage_bucket,
                Key=object_path,
            )
            content_type = response.get("ContentType") or mimetypes.guess_type(
                object_path
            )[0] or "application/octet-stream"
            return DownloadedMedia(
                content=response["Body"].read(),
                content_type=content_type,
            )

        if self._is_supabase_configured():
            content = self._get_client().storage.from_(
                settings.supabase_storage_bucket
            ).download(object_path)
            content_type = mimetypes.guess_type(object_path)[0] or "application/octet-stream"
            return DownloadedMedia(content=content, content_type=content_type)

        raise FileNotFoundError(f"Remote media not found: {object_path}")

    def normalize_public_url_for_request(
        self,
        url: str,
        request_base_url: str | None,
    ) -> str:
        if not url or not request_base_url:
            return url

        normalized_base_url = request_base_url.rstrip("/")
        parsed_base_url = urlparse(normalized_base_url)
        parsed_url = urlparse(url)

        if url.startswith("/"):
            return f"{normalized_base_url}{url}"

        if not parsed_url.scheme or not parsed_url.netloc:
            return url

        if not self._is_local_media_path(parsed_url.path):
            return url

        if parsed_url.netloc == parsed_base_url.netloc:
            return url

        normalized_url = f"{normalized_base_url}{parsed_url.path}"
        if parsed_url.query:
            normalized_url = f"{normalized_url}?{parsed_url.query}"
        if parsed_url.fragment:
            normalized_url = f"{normalized_url}#{parsed_url.fragment}"
        return normalized_url

    def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return

        client = self._get_client()
        bucket_name = settings.supabase_storage_bucket
        try:
            client.storage.get_bucket(bucket_name)
        except Exception:
            client.storage.create_bucket(
                bucket_name,
                options={
                    "public": settings.supabase_storage_public,
                    "file_size_limit": 10 * 1024 * 1024,
                    "allowed_mime_types": [
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                    ],
                },
            )

        self._bucket_ready = True

    def _ensure_s3_bucket(self) -> None:
        if self._bucket_ready:
            return

        client = self._get_s3_client()
        bucket_name = settings.supabase_storage_bucket
        try:
            client.head_bucket(Bucket=bucket_name)
        except Exception as error:
            if ClientError and isinstance(error, ClientError):
                error_code = error.response.get("Error", {}).get("Code", "")
                if error_code not in {"404", "NoSuchBucket"}:
                    raise
            create_params = {"Bucket": bucket_name}
            if settings.supabase_s3_region and settings.supabase_s3_region != "us-east-1":
                create_params["CreateBucketConfiguration"] = {
                    "LocationConstraint": settings.supabase_s3_region
                }
            client.create_bucket(**create_params)

        self._bucket_ready = True

    def _build_supabase_public_url(self, object_path: str, local_group: str) -> str:
        if settings.supabase_url and settings.supabase_storage_public:
            return (
                f"{settings.supabase_url}/storage/v1/object/public/"
                f"{settings.supabase_storage_bucket}/{object_path}"
            )

        if self.is_supabase_enabled():
            return (
                f"{settings.public_base_url}/api/v1/media/object/"
                f"{quote(object_path, safe='/')}"
            )

        return self._local_public_url(local_group, Path(object_path).name)

    def _is_s3_configured(self) -> bool:
        return bool(
            boto3
            and BotoConfig
            and settings.supabase_s3_endpoint
            and settings.supabase_s3_region
            and settings.supabase_s3_access_key_id
            and settings.supabase_s3_secret_access_key
            and settings.supabase_storage_bucket
        )

    def _is_supabase_configured(self) -> bool:
        return bool(
            create_client
            and settings.supabase_url
            and settings.supabase_service_role_key
            and settings.supabase_storage_bucket
        )

    def _is_local_storage_url(self, url: str) -> bool:
        return url.startswith("/storage/") or url.startswith(
            f"{settings.public_base_url}/storage/"
        )

    def _is_local_media_path(self, path: str) -> bool:
        return path.startswith("/storage/") or path.startswith("/api/v1/media/object/")

    def _local_public_url(self, group: str, filename: str) -> str:
        return f"{settings.public_base_url}/storage/{group}/{filename}"

    def _looks_like_url(self, value: str) -> bool:
        return value.startswith("http://") or value.startswith("https://")

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_s3_client():
        if boto3 is None or BotoConfig is None:
            raise RuntimeError("boto3 dependency is not installed.")

        config = BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path" if settings.supabase_s3_force_path_style else "auto"},
        )
        return boto3.client(
            "s3",
            endpoint_url=settings.supabase_s3_endpoint,
            region_name=settings.supabase_s3_region,
            aws_access_key_id=settings.supabase_s3_access_key_id,
            aws_secret_access_key=settings.supabase_s3_secret_access_key,
            config=config,
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def _get_client() -> Client:
        if create_client is None:
            raise RuntimeError("supabase dependency is not installed.")

        return create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )


media_storage_service = MediaStorageService()
