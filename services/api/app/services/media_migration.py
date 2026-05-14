from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

from services.api.app.database import SessionLocal
from services.api.app.models import PipelineJobRecord, TrashIdentityRecord
from services.api.app.services.media_storage import media_storage_service


@dataclass(frozen=True)
class MediaMigrationResult:
    migrated_original: int
    migrated_enhanced: int
    updated_jobs: int


class MediaMigrationService:
    def migrate_local_media_to_storage(self) -> MediaMigrationResult:
        if not media_storage_service.is_supabase_enabled():
            raise RuntimeError(
                "对象存储尚未配置，无法执行历史图片回迁。"
            )

        migrated_original = 0
        migrated_enhanced = 0
        updated_jobs = 0

        with SessionLocal() as session:
            identities = list(session.scalars(select(TrashIdentityRecord)))
            for identity in identities:
                original_updated = False
                enhanced_updated = False

                original_path = Path(identity.original_path)
                if original_path.exists() and _uses_local_storage_url(identity.original_url):
                    identity.original_url = media_storage_service.store_upload(
                        original_path
                    ).public_url
                    migrated_original += 1
                    original_updated = True

                enhanced_path = Path(identity.enhanced_path)
                if enhanced_path.exists() and _uses_local_storage_url(identity.enhanced_url):
                    identity.enhanced_url = media_storage_service.store_enhanced(
                        enhanced_path
                    ).public_url
                    migrated_enhanced += 1
                    enhanced_updated = True

                if original_updated or enhanced_updated:
                    jobs = list(
                        session.scalars(
                            select(PipelineJobRecord).where(
                                PipelineJobRecord.identity_id == identity.identity_id
                            )
                        )
                    )
                    for job in jobs:
                        changed = False
                        payload = dict(job.payload or {})
                        result_payload = (
                            dict(job.result_payload or {}) if job.result_payload else None
                        )

                        if original_updated and payload.get("mediaUrl"):
                            payload["mediaUrl"] = identity.original_url
                            changed = True
                        if result_payload is not None:
                            if original_updated:
                                result_payload["originalUrl"] = identity.original_url
                                changed = True
                            if enhanced_updated:
                                result_payload["enhancedUrl"] = identity.enhanced_url
                                changed = True
                        if changed:
                            job.payload = payload
                            if result_payload is not None:
                                job.result_payload = result_payload
                            updated_jobs += 1

            session.commit()

        return MediaMigrationResult(
            migrated_original=migrated_original,
            migrated_enhanced=migrated_enhanced,
            updated_jobs=updated_jobs,
        )


def _uses_local_storage_url(url: str) -> bool:
    return url.startswith("/storage/") or "/storage/" in url


media_migration_service = MediaMigrationService()
