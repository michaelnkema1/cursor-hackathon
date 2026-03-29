import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from app.config import Settings
from app.db_contract import (
    ISSUE_COLUMNS,
    ISSUE_DUPLICATE_SUGGESTION_COLUMNS,
    ISSUE_DUPLICATE_SUGGESTIONS_TABLE,
    ISSUE_EVENTS_TABLE,
    ISSUE_MEDIA_COLUMNS,
    ISSUE_MEDIA_TABLE,
    ISSUE_TIMELINE_COLUMNS,
    ISSUE_TIMELINE_VIEW,
    ISSUES_MAP_COLUMNS,
    ISSUES_MAP_VIEW,
    ISSUES_NEARBY_RPC,
    ISSUES_TABLE,
    ROUTING_RULES_TABLE,
)
from app.services import gemini, khaya
from app.services.media import extract_audio_from_video

logger = logging.getLogger(__name__)

_LEGACY_ISSUE_COLUMNS = ISSUE_COLUMNS.replace("video_path, ", "")


def _is_missing_video_path_error(exc: Exception) -> bool:
    if not isinstance(exc, APIError):
        return False

    payload = exc.args[0] if exc.args else None
    code = None
    if isinstance(payload, dict):
        code = payload.get("code")

    message = str(exc)
    mentions_video_column = "video_path" in message and "issues" in message
    return mentions_video_column and code in {"PGRST204", "42703", None}


def _with_video_path_fallback(
    full_query: Any,
    legacy_query: Any,
) -> list[dict[str, Any]]:
    try:
        res = full_query().execute()
    except Exception as exc:
        if not _is_missing_video_path_error(exc):
            raise
        logger.warning(
            "Supabase schema cache is missing issues.video_path; retrying without video support"
        )
        res = legacy_query().execute()

    rows = list(res.data or [])
    for row in rows:
        row.setdefault("video_path", None)
    return rows


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
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "m4a": "audio/mp4",
        "mp4": "video/mp4",
        "mov": "video/quicktime",
        "webm": "video/webm",
        "mkv": "video/x-matroska",
    }.get(ext, "application/octet-stream")
    return (data if isinstance(data, bytes) else bytes(data), mime)


def create_issue_row(
    supabase: Client,
    *,
    reporter_id: str,
    lat: float,
    lng: float,
    title: str | None = None,
    description: str | None = None,
    voice_transcript: str | None = None,
    photo_path: str | None = None,
    audio_path: str | None = None,
    video_path: str | None = None,
) -> UUID:
    row = {
        "reporter_id": reporter_id,
        "status": "open",
        "lat": lat,
        "lng": lng,
        "title": title,
        "description": description,
        "voice_transcript": voice_transcript,
        "photo_path": photo_path,
        "audio_path": audio_path,
        "video_path": video_path,
    }
    try:
        res = supabase.table(ISSUES_TABLE).insert(row).execute()
    except Exception as exc:
        if not _is_missing_video_path_error(exc):
            raise
        legacy_row = dict(row)
        legacy_row.pop("video_path", None)
        logger.warning(
            "Supabase schema cache is missing issues.video_path; creating issue without video_path"
        )
        res = supabase.table(ISSUES_TABLE).insert(legacy_row).execute()
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


def fetch_issue_context(supabase: Client, issue_id: UUID) -> dict[str, Any]:
    res = (
        supabase.table(ISSUE_EVENTS_TABLE)
        .select("payload")
        .eq("issue_id", str(issue_id))
        .eq("event_type", "created")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not res.data:
        return {}
    payload = res.data[0].get("payload")
    return payload if isinstance(payload, dict) else {}


def fetch_issue(supabase: Client, issue_id: UUID) -> dict[str, Any] | None:
    rows = _with_video_path_fallback(
        lambda: (
            supabase.table(ISSUES_TABLE)
            .select(ISSUE_COLUMNS)
            .eq("id", str(issue_id))
            .limit(1)
        ),
        lambda: (
            supabase.table(ISSUES_TABLE)
            .select(_LEGACY_ISSUE_COLUMNS)
            .eq("id", str(issue_id))
            .limit(1)
        ),
    )
    if not rows:
        return None
    return rows[0]


def list_my_reports(
    supabase: Client,
    reporter_id: str,
    *,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    end = offset + max(limit, 1) - 1
    return _with_video_path_fallback(
        lambda: (
            supabase.table(ISSUES_TABLE)
            .select(ISSUE_COLUMNS)
            .eq("reporter_id", reporter_id)
            .order("created_at", desc=True)
            .range(offset, end)
        ),
        lambda: (
            supabase.table(ISSUES_TABLE)
            .select(_LEGACY_ISSUE_COLUMNS)
            .eq("reporter_id", reporter_id)
            .order("created_at", desc=True)
            .range(offset, end)
        ),
    )


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
    end = offset + max(limit, 1) - 1

    def build_query(columns: str):
        query = (
            supabase.table(ISSUES_TABLE)
            .select(columns)
            .order("created_at", desc=True)
        )
        if role == "authority":
            query = query.eq("routed_organization_id", str(organization_id))
        if status:
            query = query.eq("status", status)
        return query.range(offset, end)

    return _with_video_path_fallback(
        lambda: build_query(ISSUE_COLUMNS),
        lambda: build_query(_LEGACY_ISSUE_COLUMNS),
    )


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
        "status_filter": status,
    }
    res = supabase.rpc(ISSUES_NEARBY_RPC, params).execute()
    return list(res.data or [])


def list_map_points(
    supabase: Client,
    *,
    status: str | None,
    category: str | None,
    organization_id: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    q = (
        supabase.table(ISSUES_MAP_VIEW)
        .select(ISSUES_MAP_COLUMNS)
        .order("created_at", desc=True)
    )
    if status:
        q = q.eq("status", status)
    if category:
        q = q.eq("category", category)
    if organization_id:
        q = q.eq("organization_id", organization_id)
    end = offset + max(limit, 1) - 1
    res = q.range(offset, end).execute()
    return list(res.data or [])


def list_issue_media(
    supabase: Client,
    issue_id: UUID,
) -> list[dict[str, Any]]:
    res = (
        supabase.table(ISSUE_MEDIA_TABLE)
        .select(ISSUE_MEDIA_COLUMNS)
        .eq("issue_id", str(issue_id))
        .order("sort_order")
        .order("created_at")
        .execute()
    )
    return list(res.data or [])


def list_issue_timeline(
    supabase: Client,
    issue_id: UUID,
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    end = offset + max(limit, 1) - 1
    res = (
        supabase.table(ISSUE_TIMELINE_VIEW)
        .select(ISSUE_TIMELINE_COLUMNS)
        .eq("issue_id", str(issue_id))
        .order("occurred_at", desc=True)
        .range(offset, end)
        .execute()
    )
    return list(res.data or [])


def list_issue_duplicate_suggestions(
    supabase: Client,
    issue_id: UUID,
) -> list[dict[str, Any]]:
    res = (
        supabase.table(ISSUE_DUPLICATE_SUGGESTIONS_TABLE)
        .select(ISSUE_DUPLICATE_SUGGESTION_COLUMNS)
        .eq("issue_id", str(issue_id))
        .order("created_at", desc=True)
        .execute()
    )
    rows = list(res.data or [])
    if not rows:
        return rows

    candidate_ids = [str(row["candidate_issue_id"]) for row in rows]
    candidate_rows = _with_video_path_fallback(
        lambda: (
            supabase.table(ISSUES_TABLE)
            .select(ISSUE_COLUMNS)
            .in_("id", candidate_ids)
        ),
        lambda: (
            supabase.table(ISSUES_TABLE)
            .select(_LEGACY_ISSUE_COLUMNS)
            .in_("id", candidate_ids)
        ),
    )
    candidates = {
        str(row["id"]): row
        for row in candidate_rows
    }
    return [
        {
            **row,
            "candidate_issue": candidates.get(str(row["candidate_issue_id"])),
        }
        for row in rows
    ]


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
    ai_model: str | None,
    routed_organization_id: str | None,
    structured_report: dict[str, Any] | None,
) -> None:
    payload: dict[str, Any] = {
        "ai_category": ai_category,
        "ai_severity": ai_severity,
        "ai_summary": ai_summary,
        "ai_model": ai_model,
        "routed_organization_id": routed_organization_id,
    }
    if structured_report is not None:
        payload["structured_report"] = structured_report
    supabase.table(ISSUES_TABLE).update(payload).eq("id", str(issue_id)).execute()


def patch_issue(
    supabase: Client,
    issue_id: UUID,
    *,
    changes: dict[str, Any],
) -> dict[str, Any] | None:
    if not changes:
        return fetch_issue(supabase, issue_id)
    # Some supabase-py versions are flaky when chaining .select() after update,
    # so update first, then fetch the row in a second call.
    supabase.table(ISSUES_TABLE).update(changes).eq("id", str(issue_id)).execute()
    return fetch_issue(supabase, issue_id)


def patch_issue_status(
    supabase: Client,
    issue_id: UUID,
    *,
    status: str,
) -> dict[str, Any] | None:
    changes: dict[str, Any] = {"status": status}
    changes["resolved_at"] = datetime.now(timezone.utc).isoformat() if status == "resolved" else None
    return patch_issue(supabase, issue_id, changes=changes)


def run_post_create_ai(
    settings: Settings,
    supabase: Client,
    issue_id: UUID,
    *,
    lat: float,
    lng: float,
    description: str | None,
    description_language: str | None,
    voice_transcript: str | None,
    voice_language: str | None,
    photo_path: str | None,
    audio_path: str | None,
    video_path: str | None,
) -> None:
    image_tuple: tuple[bytes, str] | None = None
    if photo_path:
        image_tuple = _download_storage_object(
            supabase, settings.supabase_storage_bucket, photo_path
        )
    image_bytes = image_tuple[0] if image_tuple else None
    image_mime = image_tuple[1] if image_tuple else None

    effective_voice_transcript = voice_transcript
    transcribed_from_audio = False
    transcription_source = None
    if not effective_voice_transcript and audio_path:
        audio_tuple = _download_storage_object(
            supabase,
            settings.supabase_storage_bucket,
            audio_path,
        )
        if audio_tuple:
            transcript = khaya.transcribe_audio(
                settings,
                audio_bytes=audio_tuple[0],
                filename=audio_path.rsplit("/", 1)[-1] or "audio.bin",
                language=voice_language,
            )
            if transcript:
                effective_voice_transcript = transcript
                transcribed_from_audio = True
                transcription_source = "audio"
                patch_issue(
                    supabase,
                    issue_id,
                    changes={"voice_transcript": transcript},
                )

    if not effective_voice_transcript and video_path:
        video_tuple = _download_storage_object(
            supabase,
            settings.supabase_storage_bucket,
            video_path,
        )
        if video_tuple:
            extracted_audio = extract_audio_from_video(
                video_tuple[0],
                source_filename=video_path.rsplit("/", 1)[-1] or "video.bin",
            )
            if extracted_audio:
                transcript = khaya.transcribe_audio(
                    settings,
                    audio_bytes=extracted_audio[0],
                    filename=extracted_audio[1],
                    language=voice_language,
                )
                if transcript:
                    effective_voice_transcript = transcript
                    transcribed_from_audio = True
                    transcription_source = "video"
                    patch_issue(
                        supabase,
                        issue_id,
                        changes={"voice_transcript": transcript},
                    )

    normalized_description = description
    translated_description = False
    if description and description_language:
        try:
            normalized_description = khaya.translate_text(
                settings,
                text=description,
                source_language=description_language,
            )
            translated_description = normalized_description != description
        except Exception as e:
            logger.warning("Khaya text translation failed for issue %s: %s", issue_id, e)

    normalized_voice_transcript = effective_voice_transcript
    translated_voice = False
    if effective_voice_transcript and voice_language:
        try:
            normalized_voice_transcript = khaya.translate_text(
                settings,
                text=effective_voice_transcript,
                source_language=voice_language,
            )
            translated_voice = normalized_voice_transcript != effective_voice_transcript
        except Exception as e:
            logger.warning("Khaya voice translation failed for issue %s: %s", issue_id, e)

    if transcribed_from_audio or translated_description or translated_voice:
        append_event(
            supabase,
            issue_id=issue_id,
            actor_id=None,
            event_type="language_processed",
            payload={
                "description_language": description_language,
                "voice_language": voice_language,
                "transcribed_from_audio": transcribed_from_audio,
                "transcription_source": transcription_source,
                "translated_description": translated_description,
                "translated_voice_transcript": translated_voice,
            },
        )

    try:
        ai = gemini.classify_issue(
            settings,
            description=normalized_description,
            voice_transcript=normalized_voice_transcript,
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
            description=normalized_description,
            voice_transcript=normalized_voice_transcript,
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
        ai_model=settings.gemini_model,
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
