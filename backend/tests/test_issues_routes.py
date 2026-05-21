from datetime import UTC, datetime
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase
from app.main import create_app


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")
REPORTER_ID = "citizen-uuid-1"


def issue_row(**overrides):
    now = datetime(2026, 1, 1, tzinfo=UTC).isoformat()
    row = {
        "id": str(ISSUE_ID),
        "reporter_id": REPORTER_ID,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.187,
        "title": "private title",
        "description": "private report text",
        "voice_transcript": "private transcript",
        "photo_path": f"{REPORTER_ID}/photo.jpg",
        "audio_path": None,
        "video_path": None,
        "ai_category": "roads",
        "ai_severity": 4,
        "ai_summary": "private summary",
        "routed_organization_id": None,
        "structured_report": {"private": True},
        "category": "roads",
        "subcategory": None,
        "severity": 4,
        "ai_model": "gemini-test",
        "ai_confidence": None,
        "duplicate_of_id": None,
        "duplicate_score": None,
        "is_likely_duplicate": False,
        "resolved_at": None,
        "created_at": now,
        "updated_at": now,
    }
    row.update(overrides)
    return row


def test_submit_report_rejects_foreign_media_path(client):
    with patch("app.routers.issues.issues_service.create_issue_row") as create_issue:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Pothole",
                "photo_path": "someone-else/private.jpg",
            },
        )

    assert response.status_code == 403
    create_issue.assert_not_called()


@patch("app.routers.issues.issues_service.run_post_create_ai")
@patch("app.routers.issues.issues_service.append_event")
@patch("app.routers.issues.issues_service.create_issue_row")
def test_submit_report_allows_reporter_owned_media_path(create_issue, append_event, run_ai, client):
    create_issue.return_value = ISSUE_ID

    response = client.post(
        "/reports",
        json={
            "lat": 5.6037,
            "lng": -0.187,
            "description": "Pothole",
            "photo_path": f"/{REPORTER_ID}/photo.jpg",
        },
    )

    assert response.status_code == 200
    assert response.json()["issue_id"] == str(ISSUE_ID)
    create_issue.assert_called_once()
    assert create_issue.call_args.kwargs["photo_path"] == f"{REPORTER_ID}/photo.jpg"
    append_event.assert_called_once()
    run_ai.assert_called_once()


def test_issue_detail_requires_auth(settings: Settings, mock_supabase):
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    with TestClient(app) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 401


@patch("app.routers.issues.issues_service.list_issue_duplicate_suggestions", return_value=[])
@patch("app.routers.issues.issues_service.list_issue_timeline", return_value=[])
@patch("app.routers.issues.issues_service.list_issue_media", return_value=[])
@patch("app.routers.issues.issues_service.fetch_issue")
def test_issue_detail_allows_reporter(fetch_issue, list_media, list_timeline, list_duplicates, client):
    fetch_issue.return_value = issue_row()

    response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    assert response.json()["reporter_id"] == REPORTER_ID
    list_media.assert_called_once()
    list_timeline.assert_called_once()
    list_duplicates.assert_called_once()


@patch("app.routers.issues.get_profile", return_value={"role": "citizen", "organization_id": None})
@patch("app.routers.issues.issues_service.fetch_issue")
def test_issue_detail_rejects_unrelated_citizen(fetch_issue, get_profile, client):
    fetch_issue.return_value = issue_row(reporter_id="different-user")

    response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403
    get_profile.assert_called_once()


@patch("app.routers.issues.issues_service.list_nearby")
def test_nearby_response_redacts_private_issue_fields(list_nearby, client):
    list_nearby.return_value = [issue_row()]

    response = client.get("/issues/nearby?lat=5.6037&lng=-0.187")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["reporter_id"] is None
    assert body[0]["description"] is None
    assert body[0]["photo_path"] is None
    assert body[0]["audio_path"] is None
    assert body[0]["video_path"] is None
    assert body[0]["ai_summary"] is None
    assert body[0]["routed_organization_id"] is None
