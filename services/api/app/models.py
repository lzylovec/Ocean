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
