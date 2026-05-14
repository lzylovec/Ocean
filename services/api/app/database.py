from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from services.api.app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine_kwargs = {"connect_args": connect_args}
if not settings.database_url.startswith("sqlite"):
    engine_kwargs.update(
        pool_pre_ping=True,
        pool_recycle=300,
    )

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_database() -> None:
    from services.api.app.models import (
        PipelineJobRecord,
        PipelineWorkerRecord,
        TrashIdentityRecord,
    )

    Base.metadata.create_all(bind=engine)
    _ensure_pipeline_job_columns()


def _ensure_pipeline_job_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    required_columns = {
        "retry_count": "ALTER TABLE pipeline_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
        "cache_hit_count": "ALTER TABLE pipeline_jobs ADD COLUMN cache_hit_count INTEGER NOT NULL DEFAULT 0",
        "inflight_reuse_count": "ALTER TABLE pipeline_jobs ADD COLUMN inflight_reuse_count INTEGER NOT NULL DEFAULT 0",
        "last_reuse_reason": "ALTER TABLE pipeline_jobs ADD COLUMN last_reuse_reason VARCHAR(32)",
        "canceled_at": "ALTER TABLE pipeline_jobs ADD COLUMN canceled_at DATETIME",
        "timeout_at": "ALTER TABLE pipeline_jobs ADD COLUMN timeout_at DATETIME",
        "last_reused_at": "ALTER TABLE pipeline_jobs ADD COLUMN last_reused_at DATETIME",
        "request_fingerprint": "ALTER TABLE pipeline_jobs ADD COLUMN request_fingerprint VARCHAR(64)",
        "media_hash": "ALTER TABLE pipeline_jobs ADD COLUMN media_hash VARCHAR(64)",
    }

    with engine.begin() as connection:
        table_exists = connection.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='pipeline_jobs'"
            )
        ).first()
        if table_exists is None:
            return

        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('pipeline_jobs')"))
        }

        for column_name, statement in required_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))
