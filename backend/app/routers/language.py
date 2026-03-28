from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.deps import require_user
from app.schemas import TranslateTextRequest, TranslateTextResponse
from app.services import khaya

router = APIRouter(prefix="/language", tags=["language"])


@router.post("/translate", response_model=TranslateTextResponse)
def translate_text(
    body: TranslateTextRequest,
    _: dict = Depends(require_user),
    settings: Settings = Depends(get_settings),
) -> TranslateTextResponse:
    if not khaya.is_enabled(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Khaya translation is not configured",
        )

    translated = khaya.translate_text(
        settings,
        text=body.text,
        source_language=body.source_language,
        target_language=body.target_language,
    )
    return TranslateTextResponse(
        text=body.text,
        translated_text=translated,
        source_language=body.source_language,
        target_language=body.target_language,
    )
