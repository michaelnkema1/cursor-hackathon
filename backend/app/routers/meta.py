from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from supabase import Client

from app.deps import get_supabase, require_admin_profile, require_user
from app.schemas import (
    AssignRoleByEmailRequest,
    OrganizationPublic,
    ProfilePublic,
    PushSubscriptionCreateRequest,
    PushSubscriptionPublic,
    RoleAssignmentResult,
    RoutingRulePublic,
    UpdateProfileRequest,
)
from app.services import meta as meta_service

router = APIRouter(tags=["meta"])


def _to_profile(row: dict) -> ProfilePublic:
    return ProfilePublic(**row)


def _to_push_subscription(row: dict) -> PushSubscriptionPublic:
    return PushSubscriptionPublic(
        id=row["id"],
        user_id=row["user_id"],
        endpoint=row["endpoint"],
        p256dh=row["p256dh"],
        user_agent=row.get("user_agent"),
        created_at=row["created_at"],
    )


@router.get("/organizations", response_model=list[OrganizationPublic])
def organizations(
    supabase: Client = Depends(get_supabase),
) -> list[OrganizationPublic]:
    rows = meta_service.list_organizations(supabase)
    return [OrganizationPublic(**row) for row in rows]


@router.get("/routing-rules", response_model=list[RoutingRulePublic])
def routing_rules(
    supabase: Client = Depends(get_supabase),
) -> list[RoutingRulePublic]:
    rows = meta_service.list_routing_rules(supabase)
    return [RoutingRulePublic(**row) for row in rows]


@router.get("/me/profile", response_model=ProfilePublic)
def my_profile(
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
) -> ProfilePublic:
    row = meta_service.fetch_profile(supabase, user["sub"])
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return _to_profile(row)


@router.patch("/me/profile", response_model=ProfilePublic)
def update_my_profile(
    body: UpdateProfileRequest,
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
) -> ProfilePublic:
    changes = {
        key: value
        for key, value in body.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update",
        )
    row = meta_service.patch_profile(supabase, user["sub"], changes=changes)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return _to_profile(row)


@router.get("/me/push-subscriptions", response_model=list[PushSubscriptionPublic])
def my_push_subscriptions(
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
) -> list[PushSubscriptionPublic]:
    rows = meta_service.list_push_subscriptions(supabase, user["sub"])
    return [_to_push_subscription(row) for row in rows]


@router.post(
    "/me/push-subscriptions",
    response_model=PushSubscriptionPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_push_subscription(
    body: PushSubscriptionCreateRequest,
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
) -> PushSubscriptionPublic:
    row = meta_service.upsert_push_subscription(
        supabase,
        user_id=user["sub"],
        endpoint=body.endpoint,
        p256dh=body.p256dh,
        auth_secret=body.auth_secret,
        user_agent=body.user_agent,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not save push subscription",
        )
    return _to_push_subscription(row)


@router.delete(
    "/me/push-subscriptions/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_push_subscription(
    subscription_id: UUID,
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
) -> Response:
    row = meta_service.fetch_push_subscription(supabase, subscription_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Push subscription not found",
        )
    if str(row["user_id"]) != str(user["sub"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This push subscription does not belong to you",
        )
    meta_service.delete_push_subscription(supabase, subscription_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/admin/profiles/role-by-email", response_model=RoleAssignmentResult)
def assign_role_by_email(
    body: AssignRoleByEmailRequest,
    _: dict = Depends(require_admin_profile),
    supabase: Client = Depends(get_supabase),
) -> RoleAssignmentResult:
    row = meta_service.assign_role_by_email(
        supabase,
        email=body.email,
        role=body.role,
        organization_slug=body.organization_slug,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Role assignment returned no data",
        )
    return RoleAssignmentResult(**row)
