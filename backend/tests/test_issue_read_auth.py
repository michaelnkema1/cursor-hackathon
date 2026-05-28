from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deps import get_supabase
from app.main import create_app


def test_issue_detail_requires_authenticated_user(settings: Settings):
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase] = lambda: MagicMock()

    with TestClient(app) as client:
        response = client.get("/issues/00000000-0000-0000-0000-000000000001")

    assert response.status_code == 401
