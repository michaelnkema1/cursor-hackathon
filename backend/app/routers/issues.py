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
    IssuePublic,
    PatchIssueRequest,
)
from app.services import issues as issues_service
from app.services.ai_dispatch import dispatch_self_http_process_issue

logger = logging.getLogger(__name__)

router = APIRouter(tags=["issues"])


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
        description=r.get("description"),
        photo_path=r.get("photo_path"),
        ai_category=r.get("ai_category"),
        ai_severity=r.get("ai_severity"),
        ai_summary=r.get("ai_summary"),
        routed_organization_id=r.get("routed_organization_id"),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


def _row_to_detail(r: dict) -> IssueDetail:
    base = _row_to_public(r).model_dump()
    base.update(
        {
            "voice_transcript": r.get("voice_transcript"),
            "audio_path": r.get("audio_path"),
            "structured_report": r.get("structured_report"),
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
        payload={"lat": body.lat, "lng": body.lng},
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
                voice_transcript=body.voice_transcript,
                photo_path=body.photo_path,
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
    return _row_to_detail(row)


@router.patch("/issues/{issue_id}", response_model=IssueDetail)
def patch_issue(
    issue_id: UUID,
    body: PatchIssueRequest,
    staff: dict = Depends(require_staff_profile),
    supabase: Client = Depends(get_supabase),
) -> IssueDetail:
    if body.status is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update",
        )
    row = issues_service.fetch_issue(supabase, issue_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    _ensure_authority_can_patch(staff, row)
    updated = issues_service.patch_issue_status(supabase, issue_id, status=body.status)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    issues_service.append_event(
        supabase,
        issue_id=issue_id,
        actor_id=staff["sub"],
        event_type="status_changed",
        payload={"status": body.status},
    )
    return _row_to_detail(updated)
