from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from services.api.app.schemas import (
    TrashIdentityCounts,
    TrashIdentityListItem,
    TrashIdentityListResponse,
    TrashIdentityReviewRequest,
)
from services.api.app.services.trash_identity_store import trash_identity_store


router = APIRouter(prefix="/api/v1/trash-identities", tags=["trash-identities"])


@router.get("", response_model=TrashIdentityListResponse)
def list_trash_identities(
    limit: int = Query(default=50, ge=1, le=200),
) -> TrashIdentityListResponse:
    items = trash_identity_store.list_identities(limit=limit)
    counts = trash_identity_store.count_by_status()

    return TrashIdentityListResponse(
        items=[
            TrashIdentityListItem(
                identityId=item.identity_id,
                siteName=item.site_name,
                volunteerNote=item.volunteer_note,
                originalUrl=item.original_url,
                enhancedUrl=item.enhanced_url,
                primaryCategory=item.primary_category,
                materialHint=item.material_hint,
                sourceHint=item.source_hint,
                topConfidence=item.top_confidence,
                reviewStatus=item.review_status,
                volunteerRiskLevel=item.volunteer_risk_level,
                categories=item.categories,
                volunteerTags=item.volunteer_tags,
                volunteerSummary=item.volunteer_summary,
                ocrTexts=item.ocr_texts,
                ocrKeywords=item.ocr_keywords,
                actionSuggestions=item.action_suggestions,
                createdAt=item.created_at.isoformat() if item.created_at else "",
            )
            for item in items
        ],
        counts=TrashIdentityCounts(
            pendingReview=counts.get("待复核", 0),
            needsOcr=counts.get("待补OCR", 0),
            confirmed=counts.get("已确认", 0),
        ),
    )


@router.patch("/{identity_id}")
def update_trash_identity_review_status(
    identity_id: str,
    payload: TrashIdentityReviewRequest,
) -> dict[str, str]:
    updated = trash_identity_store.update_review_status(
        identity_id=identity_id,
        review_status=payload.review_status,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Trash identity not found.")

    return {"status": "ok"}
