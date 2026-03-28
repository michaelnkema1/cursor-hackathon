"""
What the database teammate should expose in Supabase.
Backend calls assume these names; adjust here if they choose different ones.

Tables (public schema)
----------------------
profiles
  - id: uuid (FK auth.users)
  - role: text — 'citizen' | 'authority' | 'admin'
  - organization_id: uuid | null (which assembly/utility for authority users)

issues
  - id, reporter_id, status ('open' | 'in_progress' | 'resolved')
  - lat, lng: double precision (teammate can derive PostGIS geom via trigger)
  - description, voice_transcript: text | null
  - photo_path, audio_path: text | null (Storage object paths)
  - ai_category, ai_summary: text | null
  - ai_severity: int | null (1–5)
  - routed_organization_id: uuid | null
  - structured_report: jsonb | null
  - created_at, updated_at: timestamptz

issue_events (append-only audit / timeline)
  - id, issue_id, actor_id, event_type, payload (jsonb), created_at

Optional: organizations, routing_rules — routing can stay in app if they prefer.

RPC (PostgREST)
---------------
issues_nearby(lat float, lng float, radius_m float, status_filter text default null, max_count int default 100)
  → returns rows compatible with IssueRow (same columns as issues the API selects).

If they use different RPC/table names, change ISSUES_TABLE, ISSUES_NEARBY_RPC below.
"""

ISSUES_TABLE = "issues"
ISSUE_EVENTS_TABLE = "issue_events"
PROFILES_TABLE = "profiles"
ISSUES_NEARBY_RPC = "issues_nearby"

ISSUE_COLUMNS = (
    "id, reporter_id, status, lat, lng, description, voice_transcript, "
    "photo_path, audio_path, ai_category, ai_severity, ai_summary, "
    "routed_organization_id, structured_report, created_at, updated_at"
)
