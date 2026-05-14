from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from services.api.app.database_resilience import (
    DatabaseUnavailableError,
    raise_database_http_error,
    run_database_read,
    run_database_write,
)
from services.api.app.schemas import (
    TrashIdentityCounts,
    TrashIdentityListItem,
    TrashIdentityListResponse,
    TrashIdentityReviewRequest,
)
from services.api.app.services.media_storage import media_storage_service
from services.api.app.services.trash_identity_store import (
    TrashIdentityFilters,
    trash_identity_store,
)


router = APIRouter(prefix="/api/v1/trash-identities", tags=["trash-identities"])


@router.get("", response_model=TrashIdentityListResponse)
def list_trash_identities(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    review_status: str | None = Query(default=None, alias="reviewStatus"),
    site: str | None = Query(default=None, min_length=1, max_length=100),
    category: str | None = Query(default=None, min_length=1, max_length=100),
    risk_level: str | None = Query(default=None, alias="riskLevel"),
    q: str | None = Query(default=None, min_length=1, max_length=100),
) -> TrashIdentityListResponse:
    filters = TrashIdentityFilters(
        review_status=review_status,
        site=site,
        category=category,
        risk_level=risk_level,
        query=q,
    )
    try:
        items, counts = run_database_read(
            lambda: (
                trash_identity_store.list_identities(limit=limit, filters=filters),
                trash_identity_store.count_by_status(filters),
            )
        )
    except DatabaseUnavailableError:
        raise_database_http_error("垃圾身份证列表暂时不可用，请稍后重试。")

    return TrashIdentityListResponse(
        items=[
            TrashIdentityListItem(
                identityId=item.identity_id,
                siteName=item.site_name,
                volunteerNote=trash_identity_store.base_volunteer_note(item.volunteer_note),
                manualTextClue=trash_identity_store.extract_manual_text_clue(item.volunteer_note),
                originalUrl=media_storage_service.normalize_public_url_for_request(
                    item.original_url,
                    str(request.base_url),
                ),
                enhancedUrl=media_storage_service.normalize_public_url_for_request(
                    item.enhanced_url,
                    str(request.base_url),
                ),
                recognizedCategory=trash_identity_store.display_category(item),
                professionalCategory=trash_identity_store.professional_category(item),
                primaryCategory=item.primary_category,
                materialHint=item.material_hint,
                sourceHint=item.source_hint,
                topConfidence=item.top_confidence,
                reviewStatus=trash_identity_store.normalize_review_status(item.review_status),
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
            needsOcr=counts.get("待补文字线索", 0) + counts.get("待补OCR", 0),
            confirmed=counts.get("已确认", 0),
        ),
    )


@router.patch("/{identity_id}")
def update_trash_identity_review_status(
    identity_id: str,
    payload: TrashIdentityReviewRequest,
) -> dict[str, str]:
    if payload.review_status is None and payload.manual_text_clue is None:
        raise HTTPException(status_code=400, detail="No review payload provided.")

    try:
        updated = run_database_write(
            lambda: trash_identity_store.update_review_payload(
                identity_id=identity_id,
                review_status=payload.review_status,
                manual_text_clue=payload.manual_text_clue,
            )
        )
    except DatabaseUnavailableError:
        raise_database_http_error("审核状态暂时无法更新，请稍后重试。")
    if not updated:
        raise HTTPException(status_code=404, detail="Trash identity not found.")

    return {"status": "ok"}


@router.delete("/{identity_id}")
def delete_trash_identity(identity_id: str) -> dict[str, str]:
    try:
        deleted = run_database_write(
            lambda: trash_identity_store.delete_identity(identity_id)
        )
    except DatabaseUnavailableError:
        raise_database_http_error("垃圾身份证暂时无法删除，请稍后重试。")
    if not deleted:
        raise HTTPException(status_code=404, detail="Trash identity not found.")

    return {"status": "ok"}
