from datetime import UTC, datetime
from unittest.mock import MagicMock, patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")
REPORTER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
ORG_ID = "33333333-3333-3333-3333-333333333333"


def _settings() -> Settings:
    return Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
    )


def _issue_row(**overrides):
    now = datetime.now(UTC)
    row = {
        "id": ISSUE_ID,
        "reporter_id": REPORTER_ID,
        "status": "open",
        "lat": 5.0,
        "lng": -0.2,
        "title": "Broken bridge",
        "description": "Bridge is unsafe",
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
        "created_at": now,
        "updated_at": now,
        "voice_transcript": "private transcript",
        "structured_report": {"hazard": "bridge"},
    }
    row.update(overrides)
    return row


def _client_without_auth_override() -> TestClient:
    settings = _settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    return TestClient(app)


def _client_as(user_id: str) -> TestClient:
    settings = _settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    app.dependency_overrides[require_user] = lambda: {"sub": user_id}
    return TestClient(app)


def test_sensitive_issue_reads_require_authentication():
    with _client_without_auth_override() as client:
        for path in (
            f"/issues/{ISSUE_ID}",
            f"/issues/{ISSUE_ID}/media",
            f"/issues/{ISSUE_ID}/timeline",
            f"/issues/{ISSUE_ID}/duplicate-suggestions",
        ):
            response = client.get(path)
            assert response.status_code == 401


@patch("app.routers.issues.issues_service.fetch_issue")
@patch("app.routers.issues.get_profile")
def test_issue_detail_forbids_unrelated_citizen(mock_get_profile, mock_fetch_issue):
    mock_fetch_issue.return_value = _issue_row()
    mock_get_profile.return_value = {"role": "citizen", "organization_id": None}

    with _client_as(OTHER_USER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403


@patch("app.routers.issues.issues_service.list_issue_duplicate_suggestions")
@patch("app.routers.issues.issues_service.list_issue_timeline")
@patch("app.routers.issues.issues_service.list_issue_media")
@patch("app.routers.issues.issues_service.fetch_issue")
def test_issue_detail_allows_reporter(
    mock_fetch_issue,
    mock_list_media,
    mock_list_timeline,
    mock_list_duplicates,
):
    mock_fetch_issue.return_value = _issue_row()
    mock_list_media.return_value = []
    mock_list_timeline.return_value = []
    mock_list_duplicates.return_value = []

    with _client_as(REPORTER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    assert response.json()["voice_transcript"] == "private transcript"


@patch("app.routers.issues.issues_service.list_issue_media")
@patch("app.routers.issues.issues_service.fetch_issue")
@patch("app.routers.issues.get_profile")
def test_issue_media_allows_assigned_authority(
    mock_get_profile,
    mock_fetch_issue,
    mock_list_media,
):
    mock_fetch_issue.return_value = _issue_row(routed_organization_id=ORG_ID)
    mock_get_profile.return_value = {"role": "authority", "organization_id": ORG_ID}
    mock_list_media.return_value = []

    with _client_as(OTHER_USER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}/media")

    assert response.status_code == 200


def test_report_rejects_media_path_outside_reporter_prefix(client):
    response = client.post(
        "/reports",
        json={
            "lat": 5.0,
            "lng": -0.2,
            "description": "Pothole with photo",
            "photo_path": "other-user/photo.jpg",
        },
    )

    assert response.status_code == 400
    assert "photo_path" in response.json()["detail"]
