import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.config import Settings, get_settings
from app.db_contract import ISSUES_NEARBY_RPC
from app.deps import get_supabase, require_staff_profile, require_user
from app.schemas import (
    CreateReportRequest,
    CreateReportResponse,
    IssueDetail,
    IssueDuplicateSuggestion,
    IssueMapPoint,
    IssueMedia,
    IssuePublic,
    IssueTimelineEntry,
    PatchIssueRequest,
)
from app.services import issues as issues_service
from app.services.ai_dispatch import dispatch_self_http_process_issue

logger = logging.getLogger(__name__)

router = APIRouter(tags=["issues"])

_ADMIN_ONLY_PATCH_FIELDS = (
    "routed_organization_id",
    "duplicate_of_id",
    "duplicate_score",
    "is_likely_duplicate",
)


def _report_message(settings: Settings) -> str:
    if settings.ai_inline:
        return "Report saved; classification completed in this request."
    parts = [
        "Report saved. Run AI via POST /internal/process-issue/{id} with header X-Internal-Key, "
        "or trigger the same URL from a Supabase Database Webhook."
    ]
    if settings.ai_trigger_self_http and settings.app_base_url and settings.internal_process_secret:
        parts.append("A best-effort self-HTTP dispatch was also started (may not finish on all hosts).")
    return " ".join(parts)


def _row_to_public(r: dict) -> IssuePublic:
    return IssuePublic(
        id=r["id"],
        reporter_id=r.get("reporter_id"),
        status=r["status"],
        lat=float(r["lat"]),
        lng=float(r["lng"]),
        title=r.get("title"),
        description=r.get("description"),
        photo_path=r.get("photo_path"),
        ai_category=r.get("ai_category"),
        ai_severity=r.get("ai_severity"),
        ai_summary=r.get("ai_summary"),
        routed_organization_id=r.get("routed_organization_id"),
        category=r.get("category"),
        subcategory=r.get("subcategory"),
        severity=r.get("severity"),
        ai_model=r.get("ai_model"),
        ai_confidence=r.get("ai_confidence"),
        duplicate_of_id=r.get("duplicate_of_id"),
        duplicate_score=r.get("duplicate_score"),
        is_likely_duplicate=bool(r.get("is_likely_duplicate") or False),
        resolved_at=r.get("resolved_at"),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


def _row_to_media(r: dict) -> IssueMedia:
    return IssueMedia(**r)


def _row_to_timeline(r: dict) -> IssueTimelineEntry:
    return IssueTimelineEntry(**r)


def _row_to_duplicate(r: dict) -> IssueDuplicateSuggestion:
    candidate_issue = r.get("candidate_issue")
    return IssueDuplicateSuggestion(
        id=r["id"],
        issue_id=r["issue_id"],
        candidate_issue_id=r["candidate_issue_id"],
        score=float(r["score"]),
        source=r.get("source"),
        dismissed=bool(r.get("dismissed") or False),
        created_at=r["created_at"],
        candidate_issue=_row_to_public(candidate_issue) if candidate_issue else None,
    )


def _row_to_detail(
    row: dict,
    *,
    media: list[dict] | None = None,
    timeline: list[dict] | None = None,
    duplicate_suggestions: list[dict] | None = None,
) -> IssueDetail:
    base = _row_to_public(row).model_dump()
    base.update(
        {
            "voice_transcript": row.get("voice_transcript"),
            "audio_path": row.get("audio_path"),
            "structured_report": row.get("structured_report"),
            "media": [_row_to_media(item) for item in media or []],
            "timeline": [_row_to_timeline(item) for item in timeline or []],
            "duplicate_suggestions": [
                _row_to_duplicate(item) for item in duplicate_suggestions or []
            ],
        }
    )
    return IssueDetail(**base)


def _ensure_authority_can_patch(staff: dict, issue_row: dict) -> None:
    if staff["role"] == "admin":
        return
    rid = issue_row.get("routed_organization_id")
    oid = staff.get("organization_id")
    if rid is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Issue is not assigned to an organization yet; only admins can update it",
        )
    if str(rid) != str(oid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This issue is not assigned to your organization",
        )


def _ensure_patch_permissions(staff: dict, body: PatchIssueRequest) -> None:
    if staff["role"] == "admin":
        return
    if any(getattr(body, field) is not None for field in _ADMIN_ONLY_PATCH_FIELDS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update routing or duplicate controls",
        )


@router.post("/reports", response_model=CreateReportResponse)
def submit_report(
    body: CreateReportRequest,
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> CreateReportResponse:
    reporter_id = user["sub"]
    issue_id = issues_service.create_issue_row(
        supabase,
        reporter_id=reporter_id,
        lat=body.lat,
        lng=body.lng,
        title=body.title,
        description=body.description,
        voice_transcript=body.voice_transcript,
        photo_path=body.photo_path,
        audio_path=body.audio_path,
    )
    issues_service.append_event(
        supabase,
        issue_id=issue_id,
        actor_id=reporter_id,
        event_type="created",
        payload={
            "lat": body.lat,
            "lng": body.lng,
            "title": body.title,
            "description_language": body.description_language,
            "voice_language": body.voice_language,
        },
    )

    if settings.ai_inline:
        try:
            issues_service.run_post_create_ai(
                settings,
                supabase,
                issue_id,
                lat=body.lat,
                lng=body.lng,
                description=body.description,
                description_language=body.description_language,
                voice_transcript=body.voice_transcript,
                voice_language=body.voice_language,
                photo_path=body.photo_path,
                audio_path=body.audio_path,
            )
        except Exception:
            logger.exception("Inline AI failed for issue %s", issue_id)
    elif (
        settings.ai_trigger_self_http
        and settings.app_base_url
        and settings.internal_process_secret
    ):
        dispatch_self_http_process_issue(
            settings.app_base_url,
            settings.internal_process_secret,
            str(issue_id),
        )

    return CreateReportResponse(issue_id=issue_id, message=_report_message(settings))


@router.get("/me/reports", response_model=list[IssuePublic])
def my_reports(
    user: dict = Depends(require_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
) -> list[IssuePublic]:
    rows = issues_service.list_my_reports(
        supabase,
        user["sub"],
        limit=limit,
        offset=offset,
    )
    return [_row_to_public(r) for r in rows]


@router.get("/staff/issues", response_model=list[IssuePublic])
def staff_issues(
    staff: dict = Depends(require_staff_profile),
    status_filter: str | None = Query(None, pattern="^(open|in_progress|resolved)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
) -> list[IssuePublic]:
    rows = issues_service.list_staff_issues(
        supabase,
        role=staff["role"],
        organization_id=str(staff["organization_id"]) if staff["organization_id"] else None,
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return [_row_to_public(r) for r in rows]


@router.get("/issues/map", response_model=list[IssueMapPoint])
def issues_map(
    status_filter: str | None = Query(None, pattern="^(open|in_progress|resolved)$"),
    category: str | None = Query(None, max_length=80),
    organization_id: UUID | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
) -> list[IssueMapPoint]:
    rows = issues_service.list_map_points(
        supabase,
        status=status_filter,
        category=category,
        organization_id=str(organization_id) if organization_id else None,
        limit=limit,
        offset=offset,
    )
    return [IssueMapPoint(**row) for row in rows]


@router.get("/issues/nearby", response_model=list[IssuePublic])
def issues_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: float = Query(5000, ge=100, le=100_000),
    status_filter: str | None = Query(None, pattern="^(open|in_progress|resolved)$"),
    limit: int = Query(100, ge=1, le=500),
    supabase: Client = Depends(get_supabase),
) -> list[IssuePublic]:
    try:
        rows = issues_service.list_nearby(
            supabase,
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            status=status_filter,
            limit=limit,
        )
    except Exception as e:
        logger.warning("issues_nearby RPC failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Map query unavailable. Ensure the database teammate has created "
                f"the `{ISSUES_NEARBY_RPC}` RPC (see app/db_contract.py)."
            ),
        ) from e
    return [_row_to_public(r) for r in rows]


@router.get("/issues/{issue_id}", response_model=IssueDetail)
def get_issue(
    issue_id: UUID,
    supabase: Client = Depends(get_supabase),
) -> IssueDetail:
    row = issues_service.fetch_issue(supabase, issue_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    media = issues_service.list_issue_media(supabase, issue_id)
    timeline = issues_service.list_issue_timeline(supabase, issue_id)
    duplicates = issues_service.list_issue_duplicate_suggestions(supabase, issue_id)
    return _row_to_detail(
        row,
        media=media,
        timeline=timeline,
        duplicate_suggestions=duplicates,
    )


@router.get("/issues/{issue_id}/media", response_model=list[IssueMedia])
def get_issue_media(
    issue_id: UUID,
    supabase: Client = Depends(get_supabase),
) -> list[IssueMedia]:
    if not issues_service.fetch_issue(supabase, issue_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    rows = issues_service.list_issue_media(supabase, issue_id)
    return [_row_to_media(r) for r in rows]


@router.get("/issues/{issue_id}/timeline", response_model=list[IssueTimelineEntry])
def get_issue_timeline(
    issue_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
) -> list[IssueTimelineEntry]:
    if not issues_service.fetch_issue(supabase, issue_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    rows = issues_service.list_issue_timeline(supabase, issue_id, limit=limit, offset=offset)
    return [_row_to_timeline(r) for r in rows]


@router.get(
    "/issues/{issue_id}/duplicate-suggestions",
    response_model=list[IssueDuplicateSuggestion],
)
def get_issue_duplicate_suggestions(
    issue_id: UUID,
    supabase: Client = Depends(get_supabase),
) -> list[IssueDuplicateSuggestion]:
    if not issues_service.fetch_issue(supabase, issue_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    rows = issues_service.list_issue_duplicate_suggestions(supabase, issue_id)
    return [_row_to_duplicate(r) for r in rows]


@router.patch("/issues/{issue_id}", response_model=IssueDetail)
def patch_issue(
    issue_id: UUID,
    body: PatchIssueRequest,
    staff: dict = Depends(require_staff_profile),
    supabase: Client = Depends(get_supabase),
) -> IssueDetail:
    changes = {
        key: value
        for key, value in body.model_dump(exclude_unset=True).items()
        if key != "note" and value is not None
    }
    if not changes and not body.note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update",
        )

    row = issues_service.fetch_issue(supabase, issue_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    _ensure_authority_can_patch(staff, row)
    _ensure_patch_permissions(staff, body)

    updated = issues_service.patch_issue(supabase, issue_id, changes=changes)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    if body.status is not None:
        payload: dict[str, str] = {"status": body.status}
        if body.note:
            payload["note"] = body.note
        issues_service.append_event(
            supabase,
            issue_id=issue_id,
            actor_id=staff["sub"],
            event_type="status_changed",
            payload=payload,
        )
    elif body.note:
        issues_service.append_event(
            supabase,
            issue_id=issue_id,
            actor_id=staff["sub"],
            event_type="issue_note",
            payload={"note": body.note},
        )

    media = issues_service.list_issue_media(supabase, issue_id)
    timeline = issues_service.list_issue_timeline(supabase, issue_id)
    duplicates = issues_service.list_issue_duplicate_suggestions(supabase, issue_id)
    return _row_to_detail(
        updated,
        media=media,
        timeline=timeline,
        duplicate_suggestions=duplicates,
    )
