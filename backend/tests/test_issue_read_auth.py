from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app
from app.routers import issues as issues_router


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")
REPORTER_ID = UUID("00000000-0000-0000-0000-000000000002")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000003")
AUTHORITY_ID = UUID("00000000-0000-0000-0000-000000000004")
ORG_ID = UUID("00000000-0000-0000-0000-000000000005")


def _issue_row(
    *,
    reporter_id: UUID = REPORTER_ID,
    routed_organization_id: UUID | None = ORG_ID,
) -> dict[str, Any]:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "id": ISSUE_ID,
        "reporter_id": reporter_id,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.187,
        "title": "Unsafe bridge",
        "description": "Bridge has collapsed near the school.",
        "photo_path": "reporter/photo.jpg",
        "audio_path": None,
        "video_path": None,
        "ai_category": "roads",
        "ai_severity": 4,
        "ai_summary": "Collapsed bridge",
        "routed_organization_id": routed_organization_id,
        "category": "roads",
        "subcategory": "bridge",
        "severity": 4,
        "ai_model": "test-model",
        "ai_confidence": 0.9,
        "duplicate_of_id": None,
        "duplicate_score": None,
        "is_likely_duplicate": False,
        "resolved_at": None,
        "structured_report": {"hazard": True},
        "voice_transcript": "The bridge is down.",
        "created_at": now,
        "updated_at": now,
    }


def _client(
    settings: Settings,
    mock_supabase: MagicMock,
    *,
    user_id: UUID | None,
) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    if user_id is not None:
        app.dependency_overrides[require_user] = lambda: {"sub": str(user_id)}
    return TestClient(app)


def _stub_issue_services(monkeypatch, row: dict[str, Any]) -> None:
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        lambda _supabase, _issue_id: row,
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_media",
        lambda _supabase, _issue_id: [],
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_timeline",
        lambda _supabase, _issue_id, *, limit=100, offset=0: [],
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_duplicate_suggestions",
        lambda _supabase, _issue_id: [],
    )


def test_issue_detail_requires_authentication(settings, mock_supabase):
    with _client(settings, mock_supabase, user_id=None) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 401


def test_issue_detail_rejects_unrelated_user(settings, mock_supabase, monkeypatch):
    _stub_issue_services(monkeypatch, _issue_row())
    monkeypatch.setattr(
        issues_router,
        "get_profile",
        lambda _supabase, _user_id: {"role": "citizen", "organization_id": None},
    )

    with _client(settings, mock_supabase, user_id=OTHER_USER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403


def test_issue_detail_allows_reporter(settings, mock_supabase, monkeypatch):
    _stub_issue_services(monkeypatch, _issue_row())

    with _client(settings, mock_supabase, user_id=REPORTER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == str(ISSUE_ID)
    assert response.json()["voice_transcript"] == "The bridge is down."


def test_issue_media_allows_assigned_authority(settings, mock_supabase, monkeypatch):
    _stub_issue_services(monkeypatch, _issue_row())
    monkeypatch.setattr(
        issues_router,
        "get_profile",
        lambda _supabase, _user_id: {"role": "authority", "organization_id": str(ORG_ID)},
    )

    with _client(settings, mock_supabase, user_id=AUTHORITY_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}/media")

    assert response.status_code == 200
    assert response.json() == []
