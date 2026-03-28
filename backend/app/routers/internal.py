"""
Internal routes for AI processing.

Vercel note: FastAPI BackgroundTasks often do not finish after the HTTP response.
Use ai_inline=True (default) to classify in the same request, or set ai_inline=False
and invoke POST /internal/process-issue/{id} from a Supabase Database Webhook (or
ai_trigger_self_http for a best-effort second HTTP call).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.deps import get_supabase, verify_internal_key
from app.services import issues as issues_service

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/process-issue/{issue_id}")
def process_issue(
    issue_id: UUID,
    _: None = Depends(verify_internal_key),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> dict:
    row = issues_service.fetch_issue(supabase, issue_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    context = issues_service.fetch_issue_context(supabase, issue_id)
    issues_service.run_post_create_ai(
        settings,
        supabase,
        issue_id,
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        description=row.get("description"),
        description_language=context.get("description_language"),
        voice_transcript=row.get("voice_transcript"),
        voice_language=context.get("voice_language"),
        photo_path=row.get("photo_path"),
        audio_path=row.get("audio_path"),
    )
    return {"ok": True, "issue_id": str(issue_id)}
