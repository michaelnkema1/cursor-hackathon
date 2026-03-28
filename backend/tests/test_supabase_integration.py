"""
Integration tests against the real Supabase instance.

These tests use the actual service-role key and hit the live database.
They clean up after themselves — any rows inserted are deleted at the end.

Run from repo root (so root `.env` loads) with opt-in:

    RUN_SUPABASE_INTEGRATION=1 PYTHONPATH=backend pytest backend/tests/test_supabase_integration.py -v
"""
import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_SUPABASE_INTEGRATION", "").lower() not in ("1", "true", "yes"),
    reason="Opt-in live tests: RUN_SUPABASE_INTEGRATION=1 and repo root .env with Supabase + Gemini keys",
)
from supabase import Client

from app.config import get_settings
from app.deps import _supabase
from app.services.issues import (
    append_event,
    create_issue_row,
    fetch_issue,
    list_staff_issues,
    patch_issue_status,
)


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def settings():
    """Load settings from the real .env file."""
    return get_settings()


@pytest.fixture(scope="module")
def supabase(settings) -> Client:
    """Real Supabase client using the service role key."""
    return _supabase(settings.supabase_url, settings.supabase_service_role_key)


@pytest.fixture(scope="module")
def test_user_id(supabase: Client):
    """
    Create a temporary auth user for the tests, yield their UUID,
    then delete the user afterwards.
    """
    email = f"integration-test-{uuid.uuid4().hex[:8]}@fixghana-test.invalid"
    password = "TestPass1234!"

    res = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
    })
    user_id = res.user.id

    # Ensure a profile row exists (might be auto-created by trigger)
    supabase.table("profiles").upsert({
        "id": user_id,
        "role": "citizen",
    }).execute()

    yield user_id

    # Cleanup: delete auth user (cascades to profile)
    supabase.auth.admin.delete_user(user_id)


@pytest.fixture()
def created_issue_id(supabase: Client, test_user_id: str):
    """
    Insert a test issue row, yield its UUID, then delete it after the test.
    """
    issue_id = create_issue_row(
        supabase,
        reporter_id=test_user_id,
        lat=5.6037,
        lng=-0.1870,
        description="Integration test: pothole on main road",
        voice_transcript=None,
        photo_path=None,
        audio_path=None,
    )
    yield issue_id

    # Cleanup
    supabase.table("issues").delete().eq("id", str(issue_id)).execute()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSupabaseConnection:
    """Basic connectivity checks."""

    def test_can_connect_and_read_profiles_table(self, supabase: Client):
        """Service-role key can query the profiles table."""
        res = supabase.table("profiles").select("id").limit(1).execute()
        # No exception = connection is good; data may be empty list, that's fine
        assert isinstance(res.data, list), "Expected a list response from Supabase"

    def test_can_connect_and_read_issues_table(self, supabase: Client):
        """Service-role key can query the issues table."""
        res = supabase.table("issues").select("id").limit(1).execute()
        assert isinstance(res.data, list)

    def test_storage_bucket_exists(self, supabase: Client, settings):
        """The 'reports' storage bucket should exist."""
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        assert settings.supabase_storage_bucket in bucket_names, (
            f"Bucket '{settings.supabase_storage_bucket}' not found. "
            f"Found: {bucket_names}"
        )


class TestIssuesCRUD:
    """Create / Read / Update operations on the issues table."""

    def test_create_issue_returns_uuid(self, supabase: Client, test_user_id: str):
        """create_issue_row should insert a row and return a valid UUID."""
        issue_id = create_issue_row(
            supabase,
            reporter_id=test_user_id,
            lat=5.6037,
            lng=-0.1870,
            description="Test pothole",
            voice_transcript="Voice test",
            photo_path=None,
            audio_path=None,
        )
        assert isinstance(issue_id, uuid.UUID)
        # Cleanup
        supabase.table("issues").delete().eq("id", str(issue_id)).execute()

    def test_fetch_issue_returns_correct_row(self, supabase: Client, created_issue_id):
        """fetch_issue should return the row we just created."""
        row = fetch_issue(supabase, created_issue_id)
        assert row is not None, "fetch_issue returned None — row not found in DB"
        assert row["status"] == "open"
        assert abs(row["lat"] - 5.6037) < 0.001
        assert abs(row["lng"] - (-0.1870)) < 0.001
        assert row["description"] == "Integration test: pothole on main road"

    def test_fetch_nonexistent_issue_returns_none(self, supabase: Client):
        """Fetching a random UUID that doesn't exist should return None."""
        fake_id = uuid.uuid4()
        row = fetch_issue(supabase, fake_id)
        assert row is None

    def test_patch_issue_status_to_in_progress(self, supabase: Client, created_issue_id):
        """patch_issue_status should update the status in the DB."""
        updated = patch_issue_status(supabase, created_issue_id, status="in_progress")
        assert updated is not None
        assert updated["status"] == "in_progress"

    def test_patch_issue_status_to_resolved(self, supabase: Client, created_issue_id):
        """Status can be moved to resolved."""
        updated = patch_issue_status(supabase, created_issue_id, status="resolved")
        assert updated is not None
        assert updated["status"] == "resolved"


class TestIssueEvents:
    """Audit event log."""

    def test_append_event_is_stored(self, supabase: Client, created_issue_id):
        """append_event should insert a row in issue_events."""
        append_event(
            supabase,
            issue_id=created_issue_id,
            actor_id=None,
            event_type="integration_test_event",
            payload={"check": True},
        )
        res = (
            supabase.table("issue_events")
            .select("event_type, payload")
            .eq("issue_id", str(created_issue_id))
            .eq("event_type", "integration_test_event")
            .execute()
        )
        assert len(res.data) >= 1
        assert res.data[0]["payload"]["check"] is True


class TestStaffIssuesQuery:
    """Staff issue list queries."""

    def test_admin_sees_all_issues(self, supabase: Client, created_issue_id):
        """list_staff_issues with role=admin should return at least our test issue."""
        rows = list_staff_issues(
            supabase,
            role="admin",
            organization_id=None,
            status=None,
            limit=200,
            offset=0,
        )
        ids = [r["id"] for r in rows]
        assert str(created_issue_id) in ids, (
            "Admin staff query did not return the test issue we inserted"
        )

    def test_authority_without_org_returns_empty(self, supabase: Client):
        """Authority with no org_id should get an empty list (guard in service layer)."""
        rows = list_staff_issues(
            supabase,
            role="authority",
            organization_id=None,
            status=None,
            limit=50,
            offset=0,
        )
        assert rows == []


class TestGeminiConnection:
    """Quick sanity check that the Gemini API key works."""

    def test_gemini_classify_returns_expected_keys(self, settings):
        """classify_issue should return category, severity, summary, routing_hint."""
        from app.services.gemini import classify_issue

        result = classify_issue(
            settings,
            description="Large pothole blocking one lane on Liberation Road",
            voice_transcript=None,
            image_bytes=None,
            image_mime=None,
        )
        assert "category" in result, f"Missing 'category' key. Got: {result}"
        assert "severity" in result, f"Missing 'severity' key. Got: {result}"
        assert "summary" in result, f"Missing 'summary' key. Got: {result}"
        sev = result["severity"]
        assert isinstance(sev, int) and 1 <= sev <= 5, (
            f"Severity should be int 1-5, got: {sev}"
        )
