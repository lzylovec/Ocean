from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from services.api.app.database import Base


class TrashIdentityRecord(Base):
    __tablename__ = "trash_identities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    identity_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    site_name: Mapped[str] = mapped_column(String(255), index=True)
    volunteer_note: Mapped[str] = mapped_column(Text, default="")
    original_url: Mapped[str] = mapped_column(Text)
    original_path: Mapped[str] = mapped_column(Text)
    enhanced_url: Mapped[str] = mapped_column(Text)
    enhanced_path: Mapped[str] = mapped_column(Text)
    enhancement_model: Mapped[str] = mapped_column(String(255))
    enhancement_mode: Mapped[str] = mapped_column(String(128))
    detection_model: Mapped[str] = mapped_column(String(255))
    detection_mode: Mapped[str] = mapped_column(String(128))
    ocr_model: Mapped[str] = mapped_column(String(255))
    ocr_mode: Mapped[str] = mapped_column(String(128))
    semantic_model: Mapped[str] = mapped_column(String(255))
    semantic_mode: Mapped[str] = mapped_column(String(128))
    primary_category: Mapped[str] = mapped_column(String(128), default="待补充")
    material_hint: Mapped[str] = mapped_column(String(128), default="待补充")
    source_hint: Mapped[str] = mapped_column(String(255), default="待补充")
    top_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    review_status: Mapped[str] = mapped_column(String(64), default="待复核", index=True)
    volunteer_summary: Mapped[str] = mapped_column(Text, default="")
    volunteer_risk_level: Mapped[str] = mapped_column(String(32), default="medium")
    categories: Mapped[list[str]] = mapped_column(JSON, default=list)
    detections: Mapped[list[dict]] = mapped_column(JSON, default=list)
    ocr_texts: Mapped[list[str]] = mapped_column(JSON, default=list)
    ocr_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    volunteer_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    action_suggestions: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PipelineJobRecord(Base):
    __tablename__ = "pipeline_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default="queued")
    stage: Mapped[str] = mapped_column(String(64), default="queued")
    progress: Mapped[int] = mapped_column(default=0)
    message: Mapped[str] = mapped_column(String(255), default="任务已排队")
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    identity_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    request_fingerprint: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    media_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    retry_count: Mapped[int] = mapped_column(default=0)
    cache_hit_count: Mapped[int] = mapped_column(default=0)
    inflight_reuse_count: Mapped[int] = mapped_column(default=0)
    last_reuse_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    result_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timeout_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PipelineWorkerRecord(Base):
    __tablename__ = "pipeline_workers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    worker_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="idle", index=True)
    current_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    last_claimed_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_completed_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
