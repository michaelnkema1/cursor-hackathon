from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app
from app.routers import issues as issues_router


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")
REPORTER_ID = "00000000-0000-0000-0000-000000000101"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000202"
AUTHORITY_ID = "00000000-0000-0000-0000-000000000303"
ORG_ID = "00000000-0000-0000-0000-000000000404"


def _settings(**overrides) -> Settings:
    values = {
        "supabase_url": "https://test.supabase.co",
        "supabase_service_role_key": "service-role-test",
        "supabase_jwt_secret": "x" * 32,
        "supabase_storage_bucket": "reports",
        "supabase_jwt_verify_aud": True,
        "gemini_api_key": "gemini-test-key",
        "gemini_model": "gemini-2.0-flash",
        "cors_origins": "*",
        "environment": "development",
        "ai_inline": False,
        "ai_trigger_self_http": False,
        "app_base_url": None,
        "internal_process_secret": None,
        "storage_sign_read_ttl_seconds": 3600,
    }
    values.update(overrides)
    return Settings(**values)


def _client(
    *,
    user_sub: str | None = REPORTER_ID,
    settings: Settings | None = None,
) -> TestClient:
    app = create_app(settings or _settings())
    app.dependency_overrides[get_settings] = lambda: settings or _settings()
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    if user_sub is not None:
        app.dependency_overrides[require_user] = lambda: {"sub": user_sub}
    return TestClient(app)


def _issue_row(**overrides) -> dict:
    row = {
        "id": str(ISSUE_ID),
        "reporter_id": REPORTER_ID,
        "status": "open",
        "lat": 5.6037,
        "lng": -0.1870,
        "title": "Flooding",
        "description": "Water has entered the road",
        "voice_transcript": "voice details",
        "photo_path": f"{REPORTER_ID}/photo.jpg",
        "audio_path": None,
        "video_path": None,
        "ai_category": "flooding",
        "ai_severity": 4,
        "ai_summary": "Road flooding",
        "routed_organization_id": ORG_ID,
        "structured_report": {"hazard": "water"},
        "category": None,
        "subcategory": None,
        "severity": None,
        "ai_model": "gemini",
        "ai_confidence": None,
        "duplicate_of_id": None,
        "duplicate_score": None,
        "is_likely_duplicate": False,
        "resolved_at": None,
        "created_at": "2026-06-02T10:00:00Z",
        "updated_at": "2026-06-02T10:00:00Z",
    }
    row.update(overrides)
    return row


def test_issue_detail_requires_auth_before_service_role_read(monkeypatch):
    fetch_issue = MagicMock(return_value=_issue_row())
    monkeypatch.setattr(issues_router.issues_service, "fetch_issue", fetch_issue)

    with _client(user_sub=None) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 401
    fetch_issue.assert_not_called()


def test_unrelated_citizen_cannot_read_full_issue(monkeypatch):
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        MagicMock(return_value=_issue_row()),
    )
    monkeypatch.setattr(issues_router, "get_profile", lambda _supabase, _user_id: None)

    with _client(user_sub=OTHER_USER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 403


def test_reporter_can_read_own_issue_without_candidate_leak(monkeypatch):
    candidate_issue = _issue_row(
        id="00000000-0000-0000-0000-000000000999",
        reporter_id=OTHER_USER_ID,
        description="another reporter secret",
        photo_path=f"{OTHER_USER_ID}/secret.jpg",
    )
    duplicate = {
        "id": "00000000-0000-0000-0000-000000000888",
        "issue_id": str(ISSUE_ID),
        "candidate_issue_id": candidate_issue["id"],
        "score": 0.91,
        "source": "ai",
        "dismissed": False,
        "created_at": "2026-06-02T10:00:00Z",
        "candidate_issue": candidate_issue,
    }
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        MagicMock(return_value=_issue_row()),
    )
    monkeypatch.setattr(issues_router.issues_service, "list_issue_media", lambda *_: [])
    monkeypatch.setattr(issues_router.issues_service, "list_issue_timeline", lambda *_: [])
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_duplicate_suggestions",
        lambda *_: [duplicate],
    )
    monkeypatch.setattr(issues_router, "get_profile", lambda _supabase, _user_id: None)

    with _client(user_sub=REPORTER_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["reporter_id"] == REPORTER_ID
    assert body["duplicate_suggestions"][0]["candidate_issue"] is None


def test_assigned_authority_can_read_issue_media(monkeypatch):
    monkeypatch.setattr(
        issues_router.issues_service,
        "fetch_issue",
        MagicMock(return_value=_issue_row()),
    )
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_issue_media",
        lambda *_: [
            {
                "id": "00000000-0000-0000-0000-000000000505",
                "issue_id": str(ISSUE_ID),
                "storage_path": f"{REPORTER_ID}/photo.jpg",
                "kind": "photo",
                "mime_type": "image/jpeg",
                "bytes": 123,
                "sort_order": 0,
                "source": "issue_photo_path",
                "created_at": "2026-06-02T10:00:00Z",
            }
        ],
    )
    monkeypatch.setattr(
        issues_router,
        "get_profile",
        lambda _supabase, _user_id: {
            "role": "authority",
            "organization_id": ORG_ID,
        },
    )

    with _client(user_sub=AUTHORITY_ID) as client:
        response = client.get(f"/issues/{ISSUE_ID}/media")

    assert response.status_code == 200
    assert response.json()[0]["storage_path"] == f"{REPORTER_ID}/photo.jpg"


def test_report_rejects_foreign_media_path_before_insert(monkeypatch):
    create_issue_row = MagicMock(return_value=ISSUE_ID)
    monkeypatch.setattr(issues_router.issues_service, "create_issue_row", create_issue_row)

    with _client(user_sub=REPORTER_ID) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.1870,
                "photo_path": f"{OTHER_USER_ID}/stolen.jpg",
            },
        )

    assert response.status_code == 403
    create_issue_row.assert_not_called()


def test_report_accepts_and_normalizes_own_media_path(monkeypatch):
    create_issue_row = MagicMock(return_value=ISSUE_ID)
    monkeypatch.setattr(issues_router.issues_service, "create_issue_row", create_issue_row)
    monkeypatch.setattr(issues_router.issues_service, "append_event", lambda *_, **__: None)

    with _client(user_sub=REPORTER_ID) as client:
        response = client.post(
            "/reports",
            json={
                "lat": 5.6037,
                "lng": -0.1870,
                "photo_path": f"/{REPORTER_ID}/own.jpg",
            },
        )

    assert response.status_code == 200
    assert response.json()["issue_id"] == str(ISSUE_ID)
    assert create_issue_row.call_args.kwargs["photo_path"] == f"{REPORTER_ID}/own.jpg"


def test_nearby_uses_map_safe_response(monkeypatch):
    monkeypatch.setattr(
        issues_router.issues_service,
        "list_nearby",
        lambda *_, **__: [
            _issue_row(
                description="sensitive details",
                photo_path=f"{REPORTER_ID}/photo.jpg",
            )
        ],
    )

    with _client(user_sub=None) as client:
        response = client.get("/issues/nearby?lat=5.6037&lng=-0.1870")

    assert response.status_code == 200
    body = response.json()[0]
    assert body["id"] == str(ISSUE_ID)
    assert body["latitude"] == 5.6037
    assert body["longitude"] == -0.187
    assert "reporter_id" not in body
    assert "description" not in body
    assert "photo_path" not in body
