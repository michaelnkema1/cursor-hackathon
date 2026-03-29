from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from supabase import Client, create_client

from app.config import Settings, get_settings

security = HTTPBearer(auto_error=False)


@lru_cache
def _supabase(url: str, key: str) -> Client:
    return create_client(url, key)


def get_supabase(settings: Settings = Depends(get_settings)) -> Client:
    return _supabase(settings.supabase_url, settings.supabase_service_role_key)


def get_settings_dep() -> Settings:
    return get_settings()


@lru_cache
def _jwks_client(supabase_url: str) -> PyJWKClient:
    return PyJWKClient(f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json")


def verify_supabase_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    settings: Settings = Depends(get_settings),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = credentials.credentials
    decode_opts: dict = {}
    decode_kwargs: dict = {
        "algorithms": ["HS256"],
    }
    if settings.supabase_jwt_verify_aud:
        decode_kwargs["audience"] = "authenticated"
    else:
        decode_opts["verify_aud"] = False

    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg", "HS256")
        if algorithm.startswith("HS"):
            signing_key = settings.supabase_jwt_secret
            decode_kwargs["algorithms"] = [algorithm]
        else:
            jwks_client = _jwks_client(settings.supabase_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token).key
            decode_kwargs["algorithms"] = [algorithm]

        payload = jwt.decode(token, signing_key, options=decode_opts, **decode_kwargs)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )
    return payload


def require_user(
    payload: dict = Depends(verify_supabase_jwt),
) -> dict:
    return payload


def require_staff_profile(
    user: dict = Depends(require_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    profile = get_profile(supabase, user["sub"])
    role = (profile or {}).get("role") or "citizen"
    if role not in ("authority", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authority or admin role required",
        )
    return {
        "sub": user["sub"],
        "role": role,
        "organization_id": (profile or {}).get("organization_id"),
    }


def require_admin_profile(
    staff: dict = Depends(require_staff_profile),
) -> dict:
    if staff["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return staff


def verify_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.internal_process_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal processing is not configured (INTERNAL_PROCESS_SECRET)",
        )
    if not x_internal_key or x_internal_key != settings.internal_process_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal key",
        )


def get_profile(supabase: Client, user_id: str) -> dict | None:
    from app.db_contract import PROFILES_TABLE

    res = (
        supabase.table(PROFILES_TABLE)
        .select("role, organization_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]
