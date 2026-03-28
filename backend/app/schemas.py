from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SignUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)


class SignedUploadResponse(BaseModel):
    path: str
    signed_url: str
    token: str


class SignReadRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=1024)


class SignReadResponse(BaseModel):
    signed_url: str
    expires_in: int


class CreateReportRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    title: str | None = Field(default=None, max_length=160)
    description: str | None = None
    description_language: str | None = Field(default=None, max_length=32)
    voice_transcript: str | None = None
    voice_language: str | None = Field(default=None, max_length=32)
    photo_path: str | None = None
    audio_path: str | None = None


class CreateReportResponse(BaseModel):
    issue_id: UUID
    message: str = "Report received. Classification runs in the background."


class IssuePublic(BaseModel):
    id: UUID
    reporter_id: UUID | None
    status: Literal["open", "in_progress", "resolved"]
    lat: float
    lng: float
    title: str | None = None
    description: str | None = None
    photo_path: str | None = None
    ai_category: str | None = None
    ai_severity: int | None = None
    ai_summary: str | None = None
    routed_organization_id: UUID | None = None
    category: str | None = None
    subcategory: str | None = None
    severity: int | None = None
    ai_model: str | None = None
    ai_confidence: float | None = None
    duplicate_of_id: UUID | None = None
    duplicate_score: float | None = None
    is_likely_duplicate: bool = False
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IssueMedia(BaseModel):
    id: UUID
    issue_id: UUID
    storage_path: str
    kind: str
    mime_type: str | None
    bytes: int | None
    sort_order: int
    source: str
    created_at: datetime


class IssueTimelineEntry(BaseModel):
    issue_id: UUID
    occurred_at: datetime
    source: str
    action: str
    actor_id: UUID | None
    payload: dict[str, Any]


class IssueDuplicateSuggestion(BaseModel):
    id: UUID
    issue_id: UUID
    candidate_issue_id: UUID
    score: float
    source: str | None
    dismissed: bool
    created_at: datetime
    candidate_issue: IssuePublic | None = None


class IssueDetail(IssuePublic):
    voice_transcript: str | None = None
    audio_path: str | None = None
    structured_report: dict[str, Any] | None = None
    media: list[IssueMedia] = Field(default_factory=list)
    timeline: list[IssueTimelineEntry] = Field(default_factory=list)
    duplicate_suggestions: list[IssueDuplicateSuggestion] = Field(default_factory=list)


class IssueMapPoint(BaseModel):
    id: UUID
    status: Literal["open", "in_progress", "resolved"]
    category: str | None = None
    subcategory: str | None = None
    severity: int | None = None
    organization_id: UUID | None = None
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    is_likely_duplicate: bool = False
    duplicate_of_id: UUID | None = None
    latitude: float
    longitude: float


class PatchIssueRequest(BaseModel):
    status: Literal["open", "in_progress", "resolved"] | None = None
    note: str | None = Field(default=None, max_length=2000)
    title: str | None = Field(default=None, max_length=160)
    category: str | None = Field(default=None, max_length=80)
    subcategory: str | None = Field(default=None, max_length=120)
    severity: int | None = Field(default=None, ge=1, le=5)
    routed_organization_id: UUID | None = None
    duplicate_of_id: UUID | None = None
    duplicate_score: float | None = Field(default=None, ge=0, le=1)
    is_likely_duplicate: bool | None = None


class OrganizationPublic(BaseModel):
    id: UUID
    slug: str
    name: str
    kind: str
    region: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class RoutingRulePublic(BaseModel):
    id: UUID
    category: str
    organization_id: UUID
    organization_slug: str | None = None
    organization_name: str | None = None
    created_at: datetime


class ProfilePublic(BaseModel):
    id: UUID
    display_name: str | None = None
    role: str
    organization_id: UUID | None = None
    phone: str | None = None
    created_at: datetime
    updated_at: datetime


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


class PushSubscriptionCreateRequest(BaseModel):
    endpoint: str = Field(..., min_length=1, max_length=2048)
    p256dh: str = Field(..., min_length=1, max_length=512)
    auth_secret: str = Field(..., min_length=1, max_length=512)
    user_agent: str | None = Field(default=None, max_length=512)


class PushSubscriptionPublic(BaseModel):
    id: UUID
    user_id: UUID
    endpoint: str
    p256dh: str
    user_agent: str | None = None
    created_at: datetime


class AssignRoleByEmailRequest(BaseModel):
    email: str
    role: Literal["citizen", "authority", "admin"]
    organization_slug: str | None = None


class RoleAssignmentResult(BaseModel):
    user_id: UUID
    email: str
    role: str
    organization_id: UUID | None = None


class UserContext(BaseModel):
    sub: str
    email: str | None = None


class TranslateTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    source_language: str = Field(..., min_length=2, max_length=32)
    target_language: str = Field(default="en", min_length=2, max_length=32)


class TranslateTextResponse(BaseModel):
    text: str
    translated_text: str
    source_language: str
    target_language: str
