import uuid

from app.services import issues as issues_service


class _FakeUpdateQuery:
    def __init__(self):
        self.payload = None
        self.issue_id = None

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, column, value):
        assert column == "id"
        self.issue_id = value
        return self

    def execute(self):
        return None


class _FakeSupabase:
    def __init__(self):
        self.query = _FakeUpdateQuery()

    def table(self, table_name):
        assert table_name == "issues"
        return self.query


def test_update_issue_ai_does_not_clear_existing_fields_with_none():
    supabase = _FakeSupabase()
    issue_id = uuid.uuid4()

    issues_service.update_issue_ai(
        supabase,
        issue_id,
        ai_category=None,
        ai_severity=None,
        ai_summary="Fallen power line near road",
        ai_model="gemini-test",
        routed_organization_id=None,
        structured_report=None,
    )

    assert supabase.query.issue_id == str(issue_id)
    assert supabase.query.payload == {
        "ai_summary": "Fallen power line near road",
        "ai_model": "gemini-test",
    }
