from unittest.mock import MagicMock
from uuid import UUID

from app.db_contract import ISSUES_TABLE
from app.services.issues import update_issue_ai


def test_update_issue_ai_omits_none_values_to_preserve_existing_fields():
    supabase = MagicMock()
    issue_id = UUID("00000000-0000-0000-0000-000000000001")

    update_issue_ai(
        supabase,
        issue_id,
        ai_category=None,
        ai_severity=None,
        ai_summary="Updated summary",
        ai_model=None,
        routed_organization_id=None,
        structured_report=None,
    )

    supabase.table.assert_called_once_with(ISSUES_TABLE)
    supabase.table.return_value.update.assert_called_once_with(
        {"ai_summary": "Updated summary"}
    )
    supabase.table.return_value.update.return_value.eq.assert_called_once_with(
        "id", str(issue_id)
    )
    (
        supabase.table.return_value.update.return_value.eq.return_value.execute
    ).assert_called_once_with()


def test_update_issue_ai_skips_empty_payload():
    supabase = MagicMock()
    issue_id = UUID("00000000-0000-0000-0000-000000000001")

    update_issue_ai(
        supabase,
        issue_id,
        ai_category=None,
        ai_severity=None,
        ai_summary=None,
        ai_model=None,
        routed_organization_id=None,
        structured_report=None,
    )

    supabase.table.assert_not_called()
