from uuid import UUID
from unittest.mock import MagicMock

from app.services.issues import update_issue_ai


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")


def test_update_issue_ai_omits_none_values_to_preserve_existing_fields():
    supabase = MagicMock()

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

    payload = supabase.table.return_value.update.call_args.args[0]
    assert payload == {"ai_severity": 4, "ai_model": "gemini-test"}


def test_update_issue_ai_skips_empty_payload():
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

    supabase.table.return_value.update.assert_not_called()
