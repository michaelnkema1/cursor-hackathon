"""
Shared database contract for the Supabase backend.

These names mirror the SQL migrations under `supabase/migrations`.
"""

ISSUES_TABLE = "issues"
ISSUE_EVENTS_TABLE = "issue_events"
PROFILES_TABLE = "profiles"
ORGANIZATIONS_TABLE = "organizations"
ROUTING_RULES_TABLE = "routing_rules"
ISSUE_MEDIA_TABLE = "issue_media"
ISSUE_STATUS_EVENTS_TABLE = "issue_status_events"
ISSUE_DUPLICATE_SUGGESTIONS_TABLE = "issue_duplicate_suggestions"
PUSH_SUBSCRIPTIONS_TABLE = "push_subscriptions"

ISSUES_NEARBY_RPC = "issues_nearby"
SET_PROFILE_ROLE_BY_EMAIL_RPC = "set_profile_role_by_email"

ISSUES_MAP_VIEW = "issues_map"
ISSUE_TIMELINE_VIEW = "issue_timeline"

ISSUE_COLUMNS = (
    "id, reporter_id, status, lat, lng, description, voice_transcript, "
    "photo_path, audio_path, ai_category, ai_severity, ai_summary, "
    "routed_organization_id, structured_report, title, category, subcategory, "
    "severity, ai_model, ai_confidence, duplicate_of_id, duplicate_score, "
    "is_likely_duplicate, resolved_at, created_at, updated_at"
)

PROFILE_COLUMNS = (
    "id, display_name, role, organization_id, phone, created_at, updated_at"
)

ORGANIZATION_COLUMNS = (
    "id, slug, name, kind, region, contact_email, contact_phone, metadata, "
    "created_at, updated_at"
)

ROUTING_RULE_COLUMNS = "id, category, organization_id, created_at"

ISSUE_MEDIA_COLUMNS = (
    "id, issue_id, storage_path, kind, mime_type, bytes, sort_order, source, created_at"
)

ISSUE_STATUS_EVENT_COLUMNS = (
    "id, issue_id, old_status, new_status, note, changed_by, created_at"
)

ISSUE_DUPLICATE_SUGGESTION_COLUMNS = (
    "id, issue_id, candidate_issue_id, score, source, dismissed, created_at"
)

PUSH_SUBSCRIPTION_COLUMNS = (
    "id, user_id, endpoint, p256dh, auth_secret, user_agent, created_at"
)

ISSUES_MAP_COLUMNS = (
    "id, status, category, subcategory, severity, organization_id, title, "
    "created_at, updated_at, is_likely_duplicate, duplicate_of_id, latitude, longitude"
)

ISSUE_TIMELINE_COLUMNS = "issue_id, occurred_at, source, action, actor_id, payload"
