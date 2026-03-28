import json
import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


def is_enabled(settings: Settings) -> bool:
    return bool(settings.khaya_api_base_url and settings.khaya_api_key)


def _headers(settings: Settings) -> dict[str, str]:
    return {
        "Ocp-Apim-Subscription-Key": settings.khaya_api_key or "",
    }


def _url(base_url: str, path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _parse_translation_payload(payload: Any) -> str:
    if isinstance(payload, str):
        return payload.strip()
    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, str):
            return first.strip()
        if isinstance(first, dict):
            return _parse_translation_payload(first)
    if isinstance(payload, dict):
        for key in ("out", "translation", "translatedText", "text", "result"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        if "data" in payload:
            return _parse_translation_payload(payload["data"])
    raise ValueError("Could not parse Khaya translation response")


def translate_text(
    settings: Settings,
    *,
    text: str,
    source_language: str,
    target_language: str | None = None,
) -> str:
    if not is_enabled(settings):
        return text

    target = (target_language or settings.khaya_target_language).strip().lower()
    source = source_language.strip().lower()
    if not source or source == target:
        return text

    url = _url(settings.khaya_api_base_url or "", settings.khaya_translate_path)
    response = httpx.post(
        url,
        json={"in": text, "lang": f"{source}-{target}"},
        headers=_headers(settings),
        timeout=settings.khaya_timeout_seconds,
    )
    response.raise_for_status()
    try:
        payload = response.json()
    except json.JSONDecodeError:
        return response.text.strip()
    return _parse_translation_payload(payload)


def transcribe_audio(
    settings: Settings,
    *,
    audio_bytes: bytes,
    filename: str,
    language: str | None,
) -> str | None:
    if not is_enabled(settings) or not settings.khaya_transcribe_path:
        return None

    language_code = (language or settings.khaya_target_language).strip().lower()
    transcribe_path = settings.khaya_transcribe_path.replace("{language}", language_code)
    files = {
        "file": (filename, audio_bytes, "application/octet-stream"),
    }
    data = {}
    if "{language}" not in settings.khaya_transcribe_path:
        data["language"] = language_code

    url = _url(settings.khaya_api_base_url or "", transcribe_path)
    response = httpx.post(
        url,
        data=data,
        files=files,
        headers=_headers(settings),
        timeout=settings.khaya_timeout_seconds,
    )
    response.raise_for_status()
    try:
        payload = response.json()
    except json.JSONDecodeError:
        transcript = response.text.strip()
        return transcript or None

    for key in ("transcript", "text", "result", "out"):
        value = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(value, str) and value.strip():
            return value.strip()

    logger.warning("Could not parse Khaya transcription response payload")
    return None
