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
    description: str | None = None
    voice_transcript: str | None = None
    photo_path: str | None = None
    audio_path: str | None = None


class CreateReportResponse(BaseModel):
    issue_id: UUID
    message: str = "Report received. Classification runs in the background."


class IssuePublic(BaseModel):
    id: UUID
    reporter_id: UUID | None
    status: str
    lat: float
    lng: float
    description: str | None
    photo_path: str | None
    ai_category: str | None
    ai_severity: int | None
    ai_summary: str | None
    routed_organization_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IssueDetail(IssuePublic):
    voice_transcript: str | None
    audio_path: str | None
    structured_report: dict[str, Any] | None


class PatchIssueRequest(BaseModel):
    status: Literal["open", "in_progress", "resolved"] | None = None


class UserContext(BaseModel):
    sub: str
    email: str | None = None
