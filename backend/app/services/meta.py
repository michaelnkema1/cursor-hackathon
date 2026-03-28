from typing import Any
from uuid import UUID

from supabase import Client

from app.db_contract import (
    ORGANIZATION_COLUMNS,
    ORGANIZATIONS_TABLE,
    PROFILE_COLUMNS,
    PROFILES_TABLE,
    PUSH_SUBSCRIPTION_COLUMNS,
    PUSH_SUBSCRIPTIONS_TABLE,
    ROUTING_RULE_COLUMNS,
    ROUTING_RULES_TABLE,
    SET_PROFILE_ROLE_BY_EMAIL_RPC,
)


def fetch_profile(supabase: Client, user_id: str) -> dict[str, Any] | None:
    res = (
        supabase.table(PROFILES_TABLE)
        .select(PROFILE_COLUMNS)
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def patch_profile(
    supabase: Client,
    user_id: str,
    *,
    changes: dict[str, Any],
) -> dict[str, Any] | None:
    res = (
        supabase.table(PROFILES_TABLE)
        .update(changes)
        .eq("id", user_id)
        .select(PROFILE_COLUMNS)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def list_organizations(supabase: Client) -> list[dict[str, Any]]:
    res = (
        supabase.table(ORGANIZATIONS_TABLE)
        .select(ORGANIZATION_COLUMNS)
        .order("name")
        .execute()
    )
    return list(res.data or [])


def list_routing_rules(supabase: Client) -> list[dict[str, Any]]:
    rules_res = (
        supabase.table(ROUTING_RULES_TABLE)
        .select(ROUTING_RULE_COLUMNS)
        .order("category")
        .execute()
    )
    rules = list(rules_res.data or [])
    if not rules:
        return rules

    org_rows = list_organizations(supabase)
    org_by_id = {
        str(row["id"]): {"organization_slug": row["slug"], "organization_name": row["name"]}
        for row in org_rows
    }
    enriched: list[dict[str, Any]] = []
    for row in rules:
        extra = org_by_id.get(str(row["organization_id"]), {})
        enriched.append({**row, **extra})
    return enriched


def list_push_subscriptions(supabase: Client, user_id: str) -> list[dict[str, Any]]:
    res = (
        supabase.table(PUSH_SUBSCRIPTIONS_TABLE)
        .select(PUSH_SUBSCRIPTION_COLUMNS)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return list(res.data or [])


def upsert_push_subscription(
    supabase: Client,
    *,
    user_id: str,
    endpoint: str,
    p256dh: str,
    auth_secret: str,
    user_agent: str | None,
) -> dict[str, Any] | None:
    res = (
        supabase.table(PUSH_SUBSCRIPTIONS_TABLE)
        .upsert(
            {
                "user_id": user_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth_secret": auth_secret,
                "user_agent": user_agent,
            },
            on_conflict="user_id,endpoint",
        )
        .select(PUSH_SUBSCRIPTION_COLUMNS)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def fetch_push_subscription(
    supabase: Client,
    subscription_id: UUID,
) -> dict[str, Any] | None:
    res = (
        supabase.table(PUSH_SUBSCRIPTIONS_TABLE)
        .select(PUSH_SUBSCRIPTION_COLUMNS)
        .eq("id", str(subscription_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def delete_push_subscription(
    supabase: Client,
    subscription_id: UUID,
) -> None:
    supabase.table(PUSH_SUBSCRIPTIONS_TABLE).delete().eq("id", str(subscription_id)).execute()


def assign_role_by_email(
    supabase: Client,
    *,
    email: str,
    role: str,
    organization_slug: str | None,
) -> dict[str, Any] | None:
    res = supabase.rpc(
        SET_PROFILE_ROLE_BY_EMAIL_RPC,
        {
            "target_email": email,
            "new_role": role,
            "new_organization_slug": organization_slug,
        },
    ).execute()
    if not res.data:
        return None
    return res.data[0]
