from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app
from app.routers import issues as issues_router


ISSUE_ID = "00000000-0000-0000-0000-000000000001"
REPORTER_ID = "00000000-0000-0000-0000-000000000002"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000003"
ORG_ID = "00000000-0000-0000-0000-000000000004"


def _settings() -> Settings:
    return Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
        ai_inline=False,
    )


def _issue_row(**overrides):
    row = {
        "id": ISSUE_ID,
        "reporter_id": REPORTER_ID,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.187,
        "title": "Broken bridge",
        "description": "Private reporter narrative",
        "photo_path": "reporter/photo.jpg",
        "audio_path": None,
        "video_path": None,
        "ai_category": "roads",
        "ai_severity": 4,
        "ai_summary": "Bridge hazard",
        "routed_organization_id": ORG_ID,
        "category": None,
        "subcategory": None,
        "severity": None,
        "ai_model": None,
        "ai_confidence": None,
        "duplicate_of_id": None,
        "duplicate_score": None,
        "is_likely_duplicate": False,
        "resolved_at": None,
        "structured_report": {"risk": "high"},
        "voice_transcript": "private transcript",
        "created_at": "2026-05-14T11:00:00Z",
        "updated_at": "2026-05-14T11:00:00Z",
    }
    row.update(overrides)
    return row


def _client(user_sub: str | None = REPORTER_ID) -> TestClient:
    settings = _settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    if user_sub is not None:
        app.dependency_overrides[require_user] = lambda: {"sub": user_sub}
    return TestClient(app)


@pytest.mark.parametrize(
    "path",
    [
        f"/issues/{ISSUE_ID}",
        f"/issues/{ISSUE_ID}/media",
        f"/issues/{ISSUE_ID}/timeline",
        f"/issues/{ISSUE_ID}/duplicate-suggestions",
    ],
)
def test_issue_detail_routes_require_auth(path, monkeypatch):
    fetch_issue = MagicMock(return_value=_issue_row())
    monkeypatch.setattr(issues_router.issues_service, "fetch_issue", fetch_issue)

    with _client(user_sub=None) as client:
        response = client.get(path)

    assert response.status_code == 401
    fetch_issue.assert_not_called()


def test_issue_detail_allows_reporter(monkeypatch):
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        MagicMock(return_value=_issue_row()),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_media",
        MagicMock(return_value=[]),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_timeline",
        MagicMock(return_value=[]),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_duplicate_suggestions",
        MagicMock(return_value=[]),
    )

    with _client(user_sub=REPORTER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == ISSUE_ID
    assert response.json()["voice_transcript"] == "private transcript"


def test_issue_detail_allows_assigned_authority(monkeypatch):
    get_profile = MagicMock(return_value={"role": "authority", "organization_id": ORG_ID})
    monkeypatch.setattr(issues_router, "get_profile", get_profile)
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        MagicMock(return_value=_issue_row()),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_media",
        MagicMock(return_value=[]),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_timeline",
        MagicMock(return_value=[]),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_duplicate_suggestions",
        MagicMock(return_value=[]),
    )

    with _client(user_sub=OTHER_USER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    get_profile.assert_called_once()


def test_issue_media_rejects_unrelated_user(monkeypatch):
    list_media = MagicMock(return_value=[])
    monkeypatch.setattr(issues_router, "get_profile", MagicMock(return_value={"role": "citizen"}))
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        MagicMock(return_value=_issue_row()),
    )
    monkeypatch.setattr(issues_router.issues_service, "list_issue_media", list_media)

    with _client(user_sub=OTHER_USER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}/media")

    assert response.status_code == 403
    list_media.assert_not_called()


def test_report_rejects_media_path_outside_reporter_prefix(monkeypatch):
    create_issue = MagicMock()
    monkeypatch.setattr(issues_router.issues_service, "create_issue_row", create_issue)

    with _client(user_sub=REPORTER_ID) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Unsafe bridge",
                "photo_path": f"{OTHER_USER_ID}/private-photo.jpg",
            },
        )

    assert response.status_code == 400
    assert "photo_path" in response.json()["detail"]
    create_issue.assert_not_called()
