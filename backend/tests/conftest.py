from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="service-role-test",
        supabase_jwt_secret="x" * 32,
        supabase_storage_bucket="reports",
        supabase_jwt_verify_aud=True,
        gemini_api_key="gemini-test-key",
        gemini_model="gemini-2.0-flash",
        cors_origins="*",
        environment="development",
        ai_inline=True,
        ai_trigger_self_http=False,
        app_base_url=None,
        internal_process_secret=None,
        storage_sign_read_ttl_seconds=3600,
    )


@pytest.fixture
def mock_supabase() -> MagicMock:
    return MagicMock()


@pytest.fixture
def client(settings: Settings, mock_supabase: MagicMock) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[require_user] = lambda: {"sub": "citizen-uuid-1"}
    with TestClient(app) as test_client:
        yield test_client
