from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase, require_user
from app.main import create_app


def test_validation_error_shape():
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
    )
    app = create_app(settings)
    mock_sb = __import__("unittest.mock", fromlist=["MagicMock"]).MagicMock()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[require_user] = lambda: {"sub": "u1"}
    with TestClient(app) as client:
        r = client.post("/uploads/sign", json={})
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)


def test_production_hides_unhandled_detail():
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="x" * 32,
        gemini_api_key="g",
        environment="production",
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    @app.get("/boom")
    def boom():
        raise ValueError("secret-internals")

    with TestClient(app, raise_server_exceptions=False) as client:
        r = client.get("/boom")
    assert r.status_code == 500
    assert r.json()["detail"] == "Internal server error"
