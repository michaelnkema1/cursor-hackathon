import logging
from typing import Any
from uuid import UUID

from supabase import Client

from app.config import Settings
from app.db_contract import (
    ISSUE_COLUMNS,
    ISSUE_EVENTS_TABLE,
    ISSUES_NEARBY_RPC,
    ISSUES_TABLE,
)
from app.services import gemini

logger = logging.getLogger(__name__)

ROUTING_RULES_TABLE = "routing_rules"


def _download_storage_object(
    supabase: Client,
    bucket: str,
    path: str,
) -> tuple[bytes, str] | None:
    try:
        data = supabase.storage.from_(bucket).download(path)
    except Exception as e:
        logger.warning("Storage download failed for %s: %s", path, e)
        return None
    if not data:
        return None
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    mime = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
    }.get(ext, "application/octet-stream")
    return (data if isinstance(data, bytes) else bytes(data), mime)


def create_issue_row(
    supabase: Client,
    *,
    reporter_id: str,
    lat: float,
    lng: float,
    description: str | None,
    voice_transcript: str | None,
    photo_path: str | None,
    audio_path: str | None,
) -> UUID:
    row = {
        "reporter_id": reporter_id,
        "status": "open",
        "lat": lat,
        "lng": lng,
        "description": description,
        "voice_transcript": voice_transcript,
        "photo_path": photo_path,
        "audio_path": audio_path,
    }
    res = supabase.table(ISSUES_TABLE).insert(row).execute()
    if not res.data:
        raise RuntimeError("Insert issue returned no data")
    return UUID(str(res.data[0]["id"]))


def append_event(
    supabase: Client,
    *,
    issue_id: UUID,
    actor_id: str | None,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    supabase.table(ISSUE_EVENTS_TABLE).insert(
        {
            "issue_id": str(issue_id),
            "actor_id": actor_id,
            "event_type": event_type,
            "payload": payload,
        }
    ).execute()


def fetch_issue(supabase: Client, issue_id: UUID) -> dict[str, Any] | None:
    res = (
        supabase.table(ISSUES_TABLE)
        .select(ISSUE_COLUMNS)
        .eq("id", str(issue_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def list_my_reports(
    supabase: Client,
    reporter_id: str,
    *,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    end = offset + max(limit, 1) - 1
    res = (
        supabase.table(ISSUES_TABLE)
        .select(ISSUE_COLUMNS)
        .eq("reporter_id", reporter_id)
        .order("created_at", desc=True)
        .range(offset, end)
        .execute()
    )
    return list(res.data or [])


def list_staff_issues(
    supabase: Client,
    *,
    role: str,
    organization_id: str | None,
    status: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    if role == "authority" and not organization_id:
        return []
    q = (
        supabase.table(ISSUES_TABLE)
        .select(ISSUE_COLUMNS)
        .order("created_at", desc=True)
    )
    if role == "authority":
        q = q.eq("routed_organization_id", str(organization_id))
    if status:
        q = q.eq("status", status)
    end = offset + max(limit, 1) - 1
    res = q.range(offset, end).execute()
    return list(res.data or [])


def list_nearby(
    supabase: Client,
    *,
    lat: float,
    lng: float,
    radius_m: float,
    status: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    params = {
        "lat": lat,
        "lng": lng,
        "radius_m": radius_m,
        "max_count": limit,
    }
    if status is not None:
        params["status_filter"] = status
    else:
        params["status_filter"] = None
    res = supabase.rpc(ISSUES_NEARBY_RPC, params).execute()
    return list(res.data or [])


def resolve_routed_org(supabase: Client, category: str | None) -> str | None:
    if not category:
        return None
    try:
        res = (
            supabase.table(ROUTING_RULES_TABLE)
            .select("organization_id")
            .eq("category", category.lower())
            .limit(1)
            .execute()
        )
        if res.data:
            return str(res.data[0]["organization_id"])
    except Exception as e:
        logger.debug("Routing lookup skipped: %s", e)
    return None


def update_issue_ai(
    supabase: Client,
    issue_id: UUID,
    *,
    ai_category: str | None,
    ai_severity: int | None,
    ai_summary: str | None,
    routed_organization_id: str | None,
    structured_report: dict[str, Any] | None,
) -> None:
    payload: dict[str, Any] = {
        "ai_category": ai_category,
        "ai_severity": ai_severity,
        "ai_summary": ai_summary,
        "routed_organization_id": routed_organization_id,
    }
    if structured_report is not None:
        payload["structured_report"] = structured_report
    supabase.table(ISSUES_TABLE).update(payload).eq("id", str(issue_id)).execute()


def patch_issue_status(
    supabase: Client,
    issue_id: UUID,
    *,
    status: str,
) -> dict[str, Any] | None:
    # Update the status (some supabase-py versions don't support chaining
    # .select() after .update().eq(), so we update then re-fetch separately)
    supabase.table(ISSUES_TABLE).update({"status": status}).eq("id", str(issue_id)).execute()
    return fetch_issue(supabase, issue_id)


def run_post_create_ai(
    settings: Settings,
    supabase: Client,
    issue_id: UUID,
    *,
    lat: float,
    lng: float,
    description: str | None,
    voice_transcript: str | None,
    photo_path: str | None,
) -> None:
    image_tuple: tuple[bytes, str] | None = None
    if photo_path:
        image_tuple = _download_storage_object(
            supabase, settings.supabase_storage_bucket, photo_path
        )
    image_bytes = image_tuple[0] if image_tuple else None
    image_mime = image_tuple[1] if image_tuple else None

    try:
        ai = gemini.classify_issue(
            settings,
            description=description,
            voice_transcript=voice_transcript,
            image_bytes=image_bytes,
            image_mime=image_mime,
        )
    except Exception as e:
        logger.exception("Gemini classification failed: %s", e)
        append_event(
            supabase,
            issue_id=issue_id,
            actor_id=None,
            event_type="ai_failed",
            payload={"error": str(e)},
        )
        return

    category = ai.get("category")
    if isinstance(category, str):
        category = category.strip().lower().replace(" ", "_")
    sev = ai.get("severity")
    try:
        ai_severity = int(sev) if sev is not None else None
    except (TypeError, ValueError):
        ai_severity = None
    if ai_severity is not None:
        ai_severity = max(1, min(5, ai_severity))
    summary = ai.get("summary")
    if summary is not None:
        summary = str(summary)[:2000]

    routed = resolve_routed_org(supabase, category if isinstance(category, str) else None)

    structured_report: dict[str, Any] | None = None
    try:
        structured_report = gemini.build_structured_report(
            settings,
            description=description,
            voice_transcript=voice_transcript,
            category=category if isinstance(category, str) else None,
            summary=summary if isinstance(summary, str) else None,
            lat=lat,
            lng=lng,
        )
    except Exception as e:
        logger.warning("Structured report step failed: %s", e)

    update_issue_ai(
        supabase,
        issue_id,
        ai_category=category if isinstance(category, str) else None,
        ai_severity=ai_severity,
        ai_summary=summary if isinstance(summary, str) else None,
        routed_organization_id=routed,
        structured_report=structured_report,
    )
    append_event(
        supabase,
        issue_id=issue_id,
        actor_id=None,
        event_type="ai_completed",
        payload={
            "category": category,
            "severity": ai_severity,
            "routed_organization_id": routed,
        },
    )
