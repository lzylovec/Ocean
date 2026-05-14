"""initial schema

Revision ID: 20260502_000001
Revises:
Create Date: 2026-05-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260502_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pipeline_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("stage", sa.String(length=64), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=255), nullable=False),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("identity_id", sa.String(length=64), nullable=True),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("media_hash", sa.String(length=64), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_hit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "inflight_reuse_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("last_reuse_reason", sa.String(length=32), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("result_payload", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timeout_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_reused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id"),
    )
    op.create_index("ix_pipeline_jobs_job_id", "pipeline_jobs", ["job_id"], unique=False)
    op.create_index(
        "ix_pipeline_jobs_identity_id", "pipeline_jobs", ["identity_id"], unique=False
    )
    op.create_index(
        "ix_pipeline_jobs_media_hash", "pipeline_jobs", ["media_hash"], unique=False
    )
    op.create_index(
        "ix_pipeline_jobs_request_fingerprint",
        "pipeline_jobs",
        ["request_fingerprint"],
        unique=False,
    )
    op.create_index("ix_pipeline_jobs_status", "pipeline_jobs", ["status"], unique=False)

    op.create_table(
        "trash_identities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("identity_id", sa.String(length=64), nullable=False),
        sa.Column("site_name", sa.String(length=255), nullable=False),
        sa.Column("volunteer_note", sa.Text(), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=False),
        sa.Column("original_path", sa.Text(), nullable=False),
        sa.Column("enhanced_url", sa.Text(), nullable=False),
        sa.Column("enhanced_path", sa.Text(), nullable=False),
        sa.Column("enhancement_model", sa.String(length=255), nullable=False),
        sa.Column("enhancement_mode", sa.String(length=128), nullable=False),
        sa.Column("detection_model", sa.String(length=255), nullable=False),
        sa.Column("detection_mode", sa.String(length=128), nullable=False),
        sa.Column("ocr_model", sa.String(length=255), nullable=False),
        sa.Column("ocr_mode", sa.String(length=128), nullable=False),
        sa.Column("semantic_model", sa.String(length=255), nullable=False),
        sa.Column("semantic_mode", sa.String(length=128), nullable=False),
        sa.Column("primary_category", sa.String(length=128), nullable=False),
        sa.Column("material_hint", sa.String(length=128), nullable=False),
        sa.Column("source_hint", sa.String(length=255), nullable=False),
        sa.Column("top_confidence", sa.Float(), nullable=False),
        sa.Column("review_status", sa.String(length=64), nullable=False),
        sa.Column("volunteer_summary", sa.Text(), nullable=False),
        sa.Column("volunteer_risk_level", sa.String(length=32), nullable=False),
        sa.Column("categories", sa.JSON(), nullable=False),
        sa.Column("detections", sa.JSON(), nullable=False),
        sa.Column("ocr_texts", sa.JSON(), nullable=False),
        sa.Column("ocr_keywords", sa.JSON(), nullable=False),
        sa.Column("volunteer_tags", sa.JSON(), nullable=False),
        sa.Column("action_suggestions", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("identity_id"),
    )
    op.create_index(
        "ix_trash_identities_identity_id",
        "trash_identities",
        ["identity_id"],
        unique=False,
    )
    op.create_index(
        "ix_trash_identities_review_status",
        "trash_identities",
        ["review_status"],
        unique=False,
    )
    op.create_index(
        "ix_trash_identities_site_name",
        "trash_identities",
        ["site_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_trash_identities_site_name", table_name="trash_identities")
    op.drop_index("ix_trash_identities_review_status", table_name="trash_identities")
    op.drop_index("ix_trash_identities_identity_id", table_name="trash_identities")
    op.drop_table("trash_identities")

    op.drop_index("ix_pipeline_jobs_status", table_name="pipeline_jobs")
    op.drop_index(
        "ix_pipeline_jobs_request_fingerprint", table_name="pipeline_jobs"
    )
    op.drop_index("ix_pipeline_jobs_media_hash", table_name="pipeline_jobs")
    op.drop_index("ix_pipeline_jobs_identity_id", table_name="pipeline_jobs")
    op.drop_index("ix_pipeline_jobs_job_id", table_name="pipeline_jobs")
    op.drop_table("pipeline_jobs")
