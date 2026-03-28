import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.deps import get_profile, get_supabase, require_user
from app.schemas import (
    SignReadRequest,
    SignReadResponse,
    SignedUploadResponse,
    SignUploadRequest,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


def _validate_storage_path(path: str) -> str:
    p = path.strip().lstrip("/")
    if not p or ".." in p.split("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage path",
        )
    return p


@router.post("/sign", response_model=SignedUploadResponse)
def create_signed_upload(
    body: SignUploadRequest,
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> SignedUploadResponse:
    raw = body.filename.replace("\\", "/").split("/")[-1]
    safe = _SAFE_NAME.sub("_", raw) or "upload.bin"
    path = f"{user['sub']}/{uuid.uuid4()}_{safe}"
    data = supabase.storage.from_(settings.supabase_storage_bucket).create_signed_upload_url(
        path
    )
    return SignedUploadResponse(
        path=data["path"],
        signed_url=data["signed_url"],
        token=data["token"],
    )


@router.post("/sign-read", response_model=SignReadResponse)
def create_signed_read_url(
    body: SignReadRequest,
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> SignReadResponse:
    path = _validate_storage_path(body.path)
    profile = get_profile(supabase, user["sub"])
    role = (profile or {}).get("role") or "citizen"
    if role not in ("authority", "admin"):
        prefix = f"{user['sub']}/"
        if not path.startswith(prefix):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only request read URLs for files under your user prefix",
            )
    data = supabase.storage.from_(settings.supabase_storage_bucket).create_signed_url(
        path,
        settings.storage_sign_read_ttl_seconds,
    )
    url = data.get("signedUrl") or data.get("signedURL") or ""
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create signed URL",
        )
    return SignReadResponse(
        signed_url=url,
        expires_in=settings.storage_sign_read_ttl_seconds,
    )
