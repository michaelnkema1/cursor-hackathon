from unittest.mock import MagicMock, patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_staff_profile, require_user
from app.main import create_app
from app.services.issues import patch_issue_status, update_issue_ai


ISSUE_ID = "00000000-0000-0000-0000-000000000001"
REPORTER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
ORG_ID = "33333333-3333-3333-3333-333333333333"


def issue_row(**overrides):
    row = {
        "id": ISSUE_ID,
        "reporter_id": REPORTER_ID,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.187,
        "title": "Sensitive report",
        "description": "private description",
        "photo_path": f"{REPORTER_ID}/photo.jpg",
        "audio_path": None,
        "video_path": None,
        "voice_transcript": "private transcript",
        "structured_report": {"private": True},
        "ai_category": "roads",
        "ai_severity": 4,
        "ai_summary": "private summary",
        "routed_organization_id": ORG_ID,
        "category": "roads",
        "subcategory": None,
        "severity": 4,
        "ai_model": "model",
        "ai_confidence": 0.9,
        "duplicate_of_id": None,
        "duplicate_score": None,
        "is_likely_duplicate": False,
        "resolved_at": None,
        "created_at": "2026-05-30T11:00:00Z",
        "updated_at": "2026-05-30T11:00:00Z",
    }
    row.update(overrides)
    return row


def make_client(
    settings: Settings,
    mock_supabase: MagicMock,
    *,
    user: dict | None = None,
    staff: dict | None = None,
) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    if user is not None:
        app.dependency_overrides[require_user] = lambda: user
    if staff is not None:
        app.dependency_overrides[require_staff_profile] = lambda: staff
    return TestClient(app)


@patch("app.routers.issues.issues_service.fetch_issue")
def test_issue_detail_requires_auth_before_service_role_read(mock_fetch, settings, mock_supabase):
    with make_client(settings, mock_supabase) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 401
    mock_fetch.assert_not_called()


@patch("app.routers.issues.get_profile", return_value={"role": "citizen"})
@patch("app.routers.issues.issues_service.fetch_issue", return_value=issue_row())
def test_issue_detail_rejects_unrelated_citizen(_mock_fetch, _mock_profile, settings, mock_supabase):
    with make_client(settings, mock_supabase, user={"sub": OTHER_USER_ID}) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403


@patch("app.routers.issues.issues_service.list_issue_duplicate_suggestions")
@patch("app.routers.issues.issues_service.list_issue_timeline", return_value=[])
@patch("app.routers.issues.issues_service.list_issue_media", return_value=[])
@patch("app.routers.issues.issues_service.fetch_issue", return_value=issue_row())
def test_reporter_can_read_own_issue_without_duplicate_leak(
    _mock_fetch,
    _mock_media,
    _mock_timeline,
    mock_duplicates,
    settings,
    mock_supabase,
):
    with make_client(settings, mock_supabase, user={"sub": REPORTER_ID}) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    assert response.json()["id"] == ISSUE_ID
    assert response.json()["duplicate_suggestions"] == []
    mock_duplicates.assert_not_called()


@patch("app.routers.issues.issues_service.list_nearby", return_value=[issue_row()])
def test_nearby_redacts_sensitive_fields(_mock_nearby, settings, mock_supabase):
    with make_client(settings, mock_supabase) as client:
        response = client.get("/issues/nearby?lat=5.6&lng=-0.18")

    assert response.status_code == 200
    body = response.json()[0]
    assert body["reporter_id"] is None
    assert body["description"] is None
    assert body["photo_path"] is None
    assert body["audio_path"] is None
    assert body["video_path"] is None
    assert body["ai_summary"] is None
    assert body["routed_organization_id"] is None


@patch("app.routers.issues.issues_service.create_issue_row")
def test_submit_report_rejects_media_path_outside_reporter_prefix(
    mock_create,
    settings,
    mock_supabase,
):
    with make_client(settings, mock_supabase, user={"sub": REPORTER_ID}) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.187,
                "description": "Pothole",
                "photo_path": f"{OTHER_USER_ID}/victim.jpg",
            },
        )

    assert response.status_code == 403
    mock_create.assert_not_called()


@patch("app.routers.uploads.issues_service.storage_path_is_readable_by_staff", return_value=False)
@patch("app.routers.uploads.get_profile", return_value={"role": "authority", "organization_id": ORG_ID})
def test_authority_signed_read_requires_assigned_issue_media(
    _mock_profile,
    mock_readable,
    settings,
    mock_supabase,
):
    with make_client(settings, mock_supabase, user={"sub": OTHER_USER_ID}) as client:
        response = client.post(
            "/uploads/sign-read",
            json={"path": f"{REPORTER_ID}/photo.jpg"},
        )

    assert response.status_code == 403
    mock_readable.assert_called_once()
    mock_supabase.storage.from_.assert_not_called()


def test_update_issue_ai_omits_none_fields_to_preserve_existing_values():
    supabase = MagicMock()
    update_issue_ai(
        supabase,
        UUID(ISSUE_ID),
        ai_category=None,
        ai_severity=3,
        ai_summary=None,
        ai_model="gemini-test",
        routed_organization_id=None,
        structured_report=None,
    )

    supabase.table.return_value.update.assert_called_once_with(
        {"ai_severity": 3, "ai_model": "gemini-test"}
    )


def test_patch_issue_status_delegates_to_status_patch():
    supabase = MagicMock()
    with patch("app.services.issues.patch_issue", return_value={"status": "resolved"}) as mock_patch:
        result = patch_issue_status(supabase, UUID(ISSUE_ID), status="resolved")

    assert result == {"status": "resolved"}
    mock_patch.assert_called_once_with(
        supabase,
        UUID(ISSUE_ID),
        changes={"status": "resolved"},
    )
