from uuid import UUID
from unittest.mock import MagicMock, patch

from app.services.issues import patch_issue_status, update_issue_ai


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")


def test_update_issue_ai_omits_none_values_from_update_payload():
    supabase = MagicMock()
    table = supabase.table.return_value

    update_issue_ai(
        supabase,
        ISSUE_ID,
        ai_category=None,
        ai_severity=4,
        ai_summary=None,
        ai_model="gemini-test",
        routed_organization_id=None,
        structured_report=None,
    )

    table.update.assert_called_once_with({
        "ai_severity": 4,
        "ai_model": "gemini-test",
    })


def test_update_issue_ai_skips_empty_update_payload():
    supabase = MagicMock()

    update_issue_ai(
        supabase,
        ISSUE_ID,
        ai_category=None,
        ai_severity=None,
        ai_summary=None,
        ai_model=None,
        routed_organization_id=None,
        structured_report=None,
    )

    supabase.table.assert_not_called()


def test_patch_issue_status_delegates_to_patch_issue():
    supabase = MagicMock()
    with patch("app.services.issues.patch_issue") as patch_issue:
        patch_issue.return_value = {"id": str(ISSUE_ID), "status": "resolved"}

        result = patch_issue_status(supabase, ISSUE_ID, status="resolved")

    assert result == {"id": str(ISSUE_ID), "status": "resolved"}
    patch_issue.assert_called_once_with(
        supabase,
        ISSUE_ID,
        changes={"status": "resolved"},
    )
