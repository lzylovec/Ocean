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
    source_hint: str = Field(alias="sourceHint")
    ocr_keywords: list[str] = Field(alias="ocrKeywords")
    detections: list[Detection]
    volunteer_tags: list[str] = Field(alias="volunteerTags")
    volunteer_summary: str = Field(alias="volunteerSummary")
    volunteer_risk_level: str = Field(alias="volunteerRiskLevel")
    action_suggestions: list[str] = Field(alias="actionSuggestions")


class VolunteerSemanticResult(BaseModel):
    tags: list[str]
    summary: str
    risk_level: str = Field(alias="riskLevel")
    action_suggestions: list[str] = Field(alias="actionSuggestions")


class TrashIdentityListItem(BaseModel):
    identity_id: str = Field(alias="identityId")
    site_name: str = Field(alias="siteName")
    volunteer_note: str = Field(alias="volunteerNote")
    original_url: str = Field(alias="originalUrl")
    enhanced_url: str = Field(alias="enhancedUrl")
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
    review_status: Literal["待复核", "已确认", "待补OCR"] = Field(alias="reviewStatus")


class DashboardMetric(BaseModel):
    label: str
    value: str
    note: str


class DashboardOverviewResponse(BaseModel):
    status: Literal["mock"]
    metrics: list[DashboardMetric]
    top_sites: list[dict[str, str]] = Field(alias="topSites")
