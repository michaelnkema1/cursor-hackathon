from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app
from app.routers import issues as issues_router


ISSUE_ID = "00000000-0000-0000-0000-000000000001"
REPORTER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
STAFF_ID = "33333333-3333-3333-3333-333333333333"
ORG_ID = "44444444-4444-4444-4444-444444444444"


def _settings() -> Settings:
    return Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
        ai_inline=False,
    )


def _app(settings: Settings | None = None):
    app = create_app(settings or _settings())
    app.dependency_overrides[get_settings] = lambda: settings or _settings()
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    return app


def _issue_row(**overrides):
    row = {
        "id": ISSUE_ID,
        "reporter_id": REPORTER_ID,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.187,
        "title": "Pothole",
        "description": "Large pothole near the market",
        "photo_path": None,
        "audio_path": None,
        "video_path": None,
        "ai_category": None,
        "ai_severity": None,
        "ai_summary": None,
        "routed_organization_id": None,
        "category": None,
        "subcategory": None,
        "severity": None,
        "ai_model": None,
        "ai_confidence": None,
        "duplicate_of_id": None,
        "duplicate_score": None,
        "is_likely_duplicate": False,
        "resolved_at": None,
        "voice_transcript": "private caller transcript",
        "structured_report": {"private": True},
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    "path",
    [
        f"/issues/{ISSUE_ID}",
        f"/issues/{ISSUE_ID}/media",
        f"/issues/{ISSUE_ID}/timeline",
        f"/issues/{ISSUE_ID}/duplicate-suggestions",
    ],
)
def test_issue_detail_endpoints_require_auth(path):
    app = _app()
    with TestClient(app) as client:
        response = client.get(path)

    assert response.status_code == 401


def test_issue_detail_forbids_unrelated_citizen(monkeypatch):
    app = _app()
    app.dependency_overrides[require_user] = lambda: {"sub": OTHER_USER_ID}
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        lambda _supabase, _issue_id: _issue_row(),
    )
    monkeypatch.setattr(
        issues_router,
        "get_profile",
        lambda _supabase, _user_id: {"role": "citizen", "organization_id": None},
    )
    list_media = MagicMock(return_value=[])
    monkeypatch.setattr(issues_router.issues_service, "list_issue_media", list_media)

    with TestClient(app) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403
    list_media.assert_not_called()


def test_issue_detail_allows_assigned_authority(monkeypatch):
    app = _app()
    app.dependency_overrides[require_user] = lambda: {"sub": STAFF_ID}
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        lambda _supabase, _issue_id: _issue_row(routed_organization_id=ORG_ID),
    )
    monkeypatch.setattr(
        issues_router,
        "get_profile",
        lambda _supabase, _user_id: {"role": "authority", "organization_id": ORG_ID},
    )
    monkeypatch.setattr(issues_router.issues_service, "list_issue_media", lambda *_: [])
    monkeypatch.setattr(issues_router.issues_service, "list_issue_timeline", lambda *_: [])
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_duplicate_suggestions",
        lambda *_: [],
    )

    with TestClient(app) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    assert response.json()["voice_transcript"] == "private caller transcript"


def test_submit_report_rejects_media_path_outside_reporter_prefix(monkeypatch):
    app = _app()
    app.dependency_overrides[require_user] = lambda: {"sub": REPORTER_ID}
    create_issue = MagicMock(return_value=ISSUE_ID)
    monkeypatch.setattr(issues_router.issues_service, "create_issue_row", create_issue)

    with TestClient(app) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Broken bridge",
                "photo_path": f"{OTHER_USER_ID}/private.jpg",
            },
        )

    assert response.status_code == 400
    create_issue.assert_not_called()


def test_submit_report_accepts_normalized_reporter_media_path(monkeypatch):
    app = _app()
    app.dependency_overrides[require_user] = lambda: {"sub": REPORTER_ID}
    create_issue = MagicMock(return_value=ISSUE_ID)
    append_event = MagicMock()
    monkeypatch.setattr(issues_router.issues_service, "create_issue_row", create_issue)
    monkeypatch.setattr(issues_router.issues_service, "append_event", append_event)

    with TestClient(app) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Broken bridge",
                "photo_path": f"/{REPORTER_ID}/photo.jpg",
            },
        )

    assert response.status_code == 200
    create_issue.assert_called_once()
    assert create_issue.call_args.kwargs["photo_path"] == f"{REPORTER_ID}/photo.jpg"
