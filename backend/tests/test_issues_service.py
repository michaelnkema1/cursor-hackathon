from uuid import UUID
from unittest.mock import MagicMock

from app.services.issues import update_issue_ai


ISSUE_ID = UUID("00000000-0000-0000-0000-000000000001")


def test_update_issue_ai_omits_missing_fields_to_preserve_existing_classification():
    supabase = MagicMock()

    update_issue_ai(
        supabase,
        ISSUE_ID,
        ai_category=None,
        ai_severity=None,
        ai_summary=None,
        ai_model="gemini-test",
        routed_organization_id=None,
        structured_report=None,
    )

    supabase.table.return_value.update.assert_called_once_with(
        {"ai_model": "gemini-test"}
    )


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

    supabase.table.assert_not_called()


def test_update_issue_ai_writes_non_null_ai_fields():
    supabase = MagicMock()
    structured_report = {"title": "Pothole hazard"}

    update_issue_ai(
        supabase,
        ISSUE_ID,
        ai_category="pothole",
        ai_severity=4,
        ai_summary="Large pothole blocking a lane",
        ai_model="gemini-test",
        routed_organization_id="11111111-1111-1111-1111-111111111111",
        structured_report=structured_report,
    )

    supabase.table.return_value.update.assert_called_once_with(
        {
            "ai_category": "pothole",
            "ai_severity": 4,
            "ai_summary": "Large pothole blocking a lane",
            "ai_model": "gemini-test",
            "routed_organization_id": "11111111-1111-1111-1111-111111111111",
            "structured_report": structured_report,
        }
    )
