from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase
from app.main import create_app


def test_internal_missing_secret_returns_503():
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
        internal_process_secret=None,
    )
    app = create_app(settings)
    mock_sb = MagicMock()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    with TestClient(app) as client:
        r = client.post(
            "/internal/process-issue/00000000-0000-0000-0000-000000000001",
            headers={"X-Internal-Key": "any"},
        )
    assert r.status_code == 503


def test_internal_wrong_key_returns_401():
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
        internal_process_secret="good-secret",
    )
    app = create_app(settings)
    mock_sb = MagicMock()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    with TestClient(app) as client:
        r = client.post(
            "/internal/process-issue/00000000-0000-0000-0000-000000000001",
            headers={"X-Internal-Key": "bad"},
        )
    assert r.status_code == 401


@patch("app.routers.internal.issues_service.run_post_create_ai")
@patch("app.routers.internal.issues_service.fetch_issue")
def test_internal_process_ok(mock_fetch, mock_run):
    mock_fetch.return_value = {
        "lat": 5.0,
        "lng": -0.2,
        "description": "x",
        "voice_transcript": None,
        "photo_path": None,
    }
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
        internal_process_secret="good-secret",
    )
    app = create_app(settings)
    mock_sb = MagicMock()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    with TestClient(app) as client:
        r = client.post(
            "/internal/process-issue/00000000-0000-0000-0000-000000000001",
            headers={"X-Internal-Key": "good-secret"},
        )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    mock_run.assert_called_once()
