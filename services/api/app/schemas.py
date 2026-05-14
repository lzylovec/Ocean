from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    filename: str
    stored_path: str = Field(alias="storedPath")
    public_url: str = Field(alias="publicUrl")


class PipelineRequest(BaseModel):
    media_path: str = Field(alias="mediaPath")
    media_url: str = Field(alias="mediaUrl")
    site_name: str = Field(alias="siteName")
    volunteer_note: str | None = Field(default=None, alias="volunteerNote")


class Detection(BaseModel):
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]


class PipelineResponse(BaseModel):
    identity_id: str = Field(alias="identityId")
    original_url: str = Field(alias="originalUrl")
    enhanced_url: str = Field(alias="enhancedUrl")
    enhancement_model: str = Field(alias="enhancementModel")
    enhancement_mode: str = Field(alias="enhancementMode")
    detection_model: str = Field(alias="detectionModel")
    detection_mode: str = Field(alias="detectionMode")
    ocr_model: str = Field(alias="ocrModel")
    ocr_mode: str = Field(alias="ocrMode")
    ocr_texts: list[str] = Field(alias="ocrTexts")
    semantic_model: str = Field(alias="semanticModel")
    semantic_mode: str = Field(alias="semanticMode")
    categories: list[str]
    recognized_category: str | None = Field(default=None, alias="recognizedCategory")
    professional_category: str | None = Field(default=None, alias="professionalCategory")
    source_hint: str = Field(alias="sourceHint")
    ocr_keywords: list[str] = Field(alias="ocrKeywords")
    detections: list[Detection]
    volunteer_tags: list[str] = Field(alias="volunteerTags")
    volunteer_summary: str = Field(alias="volunteerSummary")
    volunteer_risk_level: str = Field(alias="volunteerRiskLevel")
    action_suggestions: list[str] = Field(alias="actionSuggestions")


PipelineJobStatus = Literal["queued", "running", "succeeded", "failed", "canceled"]
PipelineJobStage = Literal[
    "queued",
    "enhancing",
    "detecting",
    "recognizing",
    "analyzing",
    "persisting",
    "completed",
    "failed",
    "canceled",
]
PipelineJobDedupeReason = Literal["new", "inflight", "completed"]


class PipelineJobEnqueueResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: PipelineJobStatus
    stage: PipelineJobStage
    progress: int
    message: str
    retry_count: int = Field(alias="retryCount")
    cache_hit: bool = Field(alias="cacheHit")
    dedupe_reason: PipelineJobDedupeReason = Field(alias="dedupeReason")


class PipelineJobStatusResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: PipelineJobStatus
    stage: PipelineJobStage
    progress: int
    message: str
    retry_count: int = Field(alias="retryCount")
    cache_hit_count: int = Field(alias="cacheHitCount")
    inflight_reuse_count: int = Field(alias="inflightReuseCount")
    last_reuse_reason: PipelineJobDedupeReason | None = Field(
        default=None, alias="lastReuseReason"
    )
    identity_id: str | None = Field(default=None, alias="identityId")
    error_detail: str | None = Field(default=None, alias="errorDetail")
    result: PipelineResponse | None = None
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    started_at: str | None = Field(default=None, alias="startedAt")
    finished_at: str | None = Field(default=None, alias="finishedAt")
    canceled_at: str | None = Field(default=None, alias="canceledAt")
    last_reused_at: str | None = Field(default=None, alias="lastReusedAt")


class PipelineJobListItem(BaseModel):
    job_id: str = Field(alias="jobId")
    status: PipelineJobStatus
    stage: PipelineJobStage
    progress: int
    message: str
    retry_count: int = Field(alias="retryCount")
    cache_hit_count: int = Field(alias="cacheHitCount")
    inflight_reuse_count: int = Field(alias="inflightReuseCount")
    last_reuse_reason: PipelineJobDedupeReason | None = Field(
        default=None, alias="lastReuseReason"
    )
    identity_id: str | None = Field(default=None, alias="identityId")
    site_name: str = Field(alias="siteName")
    recognized_category: str | None = Field(default=None, alias="recognizedCategory")
    professional_category: str | None = Field(default=None, alias="professionalCategory")
    primary_category: str | None = Field(default=None, alias="primaryCategory")
    error_detail: str | None = Field(default=None, alias="errorDetail")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    finished_at: str | None = Field(default=None, alias="finishedAt")
    canceled_at: str | None = Field(default=None, alias="canceledAt")
    last_reused_at: str | None = Field(default=None, alias="lastReusedAt")


class PipelineJobCounts(BaseModel):
    queued: int = 0
    running: int = 0
    succeeded: int = 0
    failed: int = 0
    canceled: int = 0


class PipelineJobPagination(BaseModel):
    page: int
    page_size: int = Field(alias="pageSize")
    total_items: int = Field(alias="totalItems")
    total_pages: int = Field(alias="totalPages")
    has_prev: bool = Field(alias="hasPrev")
    has_next: bool = Field(alias="hasNext")


class PipelineWorkerStatusSummary(BaseModel):
    worker_id: str = Field(alias="workerId")
    status: str
    current_job_id: str | None = Field(default=None, alias="currentJobId")
    last_claimed_job_id: str | None = Field(default=None, alias="lastClaimedJobId")
    last_completed_job_id: str | None = Field(default=None, alias="lastCompletedJobId")
    heartbeat_at: str = Field(alias="heartbeatAt")
    started_at: str = Field(alias="startedAt")
    is_online: bool = Field(alias="isOnline")


class PipelineQueueMonitoring(BaseModel):
    status: Literal["healthy", "busy", "offline", "degraded"] = "healthy"
    message: str
    queued_jobs: int = Field(alias="queuedJobs")
    running_jobs: int = Field(alias="runningJobs")
    online_workers: int = Field(alias="onlineWorkers")
    busy_workers: int = Field(alias="busyWorkers")
    registered_workers: int = Field(alias="registeredWorkers")
    stale_workers: int = Field(alias="staleWorkers")
    last_heartbeat_at: str | None = Field(default=None, alias="lastHeartbeatAt")
    stale_after_seconds: int = Field(alias="staleAfterSeconds")
    workers: list[PipelineWorkerStatusSummary]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    api: Literal["ok"] = "ok"
    database: Literal["ok", "error"] = "ok"
    database_message: str | None = Field(default=None, alias="databaseMessage")
    worker: PipelineQueueMonitoring


class PipelineJobListResponse(BaseModel):
    items: list[PipelineJobListItem]
    counts: PipelineJobCounts
    pagination: PipelineJobPagination
    monitoring: PipelineQueueMonitoring


class VolunteerSemanticResult(BaseModel):
    tags: list[str]
    summary: str
    risk_level: str = Field(alias="riskLevel")
    action_suggestions: list[str] = Field(alias="actionSuggestions")


class TrashIdentityListItem(BaseModel):
    identity_id: str = Field(alias="identityId")
    site_name: str = Field(alias="siteName")
    volunteer_note: str = Field(alias="volunteerNote")
    manual_text_clue: str = Field(alias="manualTextClue")
    original_url: str = Field(alias="originalUrl")
    enhanced_url: str = Field(alias="enhancedUrl")
    recognized_category: str = Field(alias="recognizedCategory")
    professional_category: str = Field(alias="professionalCategory")
    primary_category: str = Field(alias="primaryCategory")
    material_hint: str = Field(alias="materialHint")
    source_hint: str = Field(alias="sourceHint")
    top_confidence: float = Field(alias="topConfidence")
    review_status: str = Field(alias="reviewStatus")
    volunteer_risk_level: str = Field(alias="volunteerRiskLevel")
    categories: list[str]
    volunteer_tags: list[str] = Field(alias="volunteerTags")
    volunteer_summary: str = Field(alias="volunteerSummary")
    ocr_texts: list[str] = Field(alias="ocrTexts")
    ocr_keywords: list[str] = Field(alias="ocrKeywords")
    action_suggestions: list[str] = Field(alias="actionSuggestions")
    created_at: str = Field(alias="createdAt")


class TrashIdentityCounts(BaseModel):
    pending_review: int = Field(alias="pendingReview")
    needs_ocr: int = Field(alias="needsOcr")
    confirmed: int = 0


class TrashIdentityListResponse(BaseModel):
    items: list[TrashIdentityListItem]
    counts: TrashIdentityCounts


class TrashIdentityReviewRequest(BaseModel):
    review_status: Literal["待复核", "已确认", "待补文字线索", "待补OCR"] | None = Field(default=None, alias="reviewStatus")
    manual_text_clue: str | None = Field(default=None, alias="manualTextClue")


class DashboardMetric(BaseModel):
    label: str
    value: str
    note: str


class DashboardTopSite(BaseModel):
    name: str
    risk: str
    top_category: str = Field(alias="topCategory")
    record_count: int = Field(alias="recordCount")


class DashboardOverviewResponse(BaseModel):
    status: Literal["live", "empty"]
    metrics: list[DashboardMetric]
    top_sites: list[DashboardTopSite] = Field(alias="topSites")
