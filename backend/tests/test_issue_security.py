from datetime import UTC, datetime
from unittest.mock import MagicMock, patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app


OWNER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_ID = "22222222-2222-2222-2222-222222222222"
ISSUE_ID = UUID("33333333-3333-3333-3333-333333333333")


def _settings() -> Settings:
    return Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="service-role-test",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="gemini-test-key",
        ai_inline=False,
    )


def _issue_row() -> dict:
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(ISSUE_ID),
        "reporter_id": OWNER_ID,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.187,
        "title": "Broken road",
        "description": "Large pothole",
        "voice_transcript": "private transcript",
        "photo_path": f"{OWNER_ID}/photo.jpg",
        "audio_path": None,
        "video_path": None,
        "ai_category": None,
        "ai_severity": None,
        "ai_summary": None,
        "routed_organization_id": None,
        "structured_report": None,
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
    }


def _app_with_user(user_sub: str | None, mock_supabase: MagicMock | None = None):
    settings = _settings()
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_supabase or MagicMock()
    if user_sub is not None:
        app.dependency_overrides[require_user] = lambda: {"sub": user_sub}
    return app


def test_submit_report_rejects_media_path_outside_user_prefix(mock_supabase: MagicMock):
    app = _app_with_user(OWNER_ID, mock_supabase)
    with TestClient(app) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Large pothole",
                "photo_path": f"{OTHER_ID}/stolen-photo.jpg",
            },
        )

    assert response.status_code == 403
    mock_supabase.table.assert_not_called()


@patch("app.routers.issues.issues_service.append_event")
@patch("app.routers.issues.issues_service.create_issue_row")
def test_submit_report_accepts_own_media_path(
    mock_create_issue_row,
    mock_append_event,
    mock_supabase: MagicMock,
):
    mock_create_issue_row.return_value = ISSUE_ID
    app = _app_with_user(OWNER_ID, mock_supabase)

    with TestClient(app) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Large pothole",
                "photo_path": f"/{OWNER_ID}/photo.jpg",
            },
        )

    assert response.status_code == 200
    mock_create_issue_row.assert_called_once()
    assert mock_create_issue_row.call_args.kwargs["photo_path"] == f"{OWNER_ID}/photo.jpg"
    mock_append_event.assert_called_once()


def test_get_issue_requires_authentication(mock_supabase: MagicMock):
    app = _app_with_user(None, mock_supabase)
    with TestClient(app) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 401


@patch("app.routers.issues.issues_service.fetch_issue")
def test_get_issue_forbids_non_reporter(mock_fetch_issue, mock_supabase: MagicMock):
    mock_fetch_issue.return_value = _issue_row()
    profile_result = MagicMock()
    profile_result.data = []
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = profile_result
    app = _app_with_user(OTHER_ID, mock_supabase)

    with TestClient(app) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403


@patch("app.routers.issues.issues_service.list_issue_duplicate_suggestions")
@patch("app.routers.issues.issues_service.list_issue_timeline")
@patch("app.routers.issues.issues_service.list_issue_media")
@patch("app.routers.issues.issues_service.fetch_issue")
def test_get_issue_allows_reporter(
    mock_fetch_issue,
    mock_list_media,
    mock_list_timeline,
    mock_list_duplicates,
    mock_supabase: MagicMock,
):
    mock_fetch_issue.return_value = _issue_row()
    mock_list_media.return_value = []
    mock_list_timeline.return_value = []
    mock_list_duplicates.return_value = []
    app = _app_with_user(OWNER_ID, mock_supabase)

    with TestClient(app) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(ISSUE_ID)
    assert body["voice_transcript"] == "private transcript"
