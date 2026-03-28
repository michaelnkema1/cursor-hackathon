from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_storage_bucket: str = "reports"
    supabase_jwt_verify_aud: bool = True

    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"

    khaya_api_base_url: str | None = None
    khaya_api_key: str | None = None
    khaya_translate_path: str = "/translate"
    khaya_transcribe_path: str | None = (
        "https://translation-api.ghananlp.org/asr/v2/transcribe?language={language}"
    )
    khaya_target_language: str = "en"
    khaya_timeout_seconds: float = 30.0

    cors_origins: str = "http://localhost:3000"

    # development | production — controls error detail in global exception handler
    environment: str = "development"

    # AI after POST /reports:
    # - ai_inline=True: run Gemini in the same request (works on Vercel within timeout; BackgroundTasks does not).
    # - ai_inline=False: skip AI here; call POST /internal/process-issue/{id} (e.g. Supabase webhook) with X-Internal-Key.
    ai_inline: bool = True
    # Best-effort second invocation (unreliable on some serverless; prefer webhook + internal route).
    ai_trigger_self_http: bool = False
    app_base_url: str | None = None
    internal_process_secret: str | None = None

    storage_sign_read_ttl_seconds: int = 3600

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


def get_settings() -> Settings:
    return Settings()
