import json
import logging
import re
from typing import Any

from google import genai
from google.genai import types

from app.config import Settings

logger = logging.getLogger(__name__)


def _strip_json_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def parse_model_json(text: str) -> dict[str, Any]:
    raw = _strip_json_fence(text)
    return json.loads(raw)


def classify_issue(
    settings: Settings,
    *,
    description: str | None,
    voice_transcript: str | None,
    image_bytes: bytes | None,
    image_mime: str | None,
) -> dict[str, Any]:
    """
    Returns keys: category (str), severity (int 1-5), summary (str), routing_hint (str, optional).
    """
    client = genai.Client(api_key=settings.gemini_api_key)
    text_block = "\n".join(
        s
        for s in [
            f"Citizen description: {description or '(none)'}",
            f"Voice transcript: {voice_transcript or '(none)'}",
        ]
        if s
    )
    prompt = f"""You classify civic infrastructure / public service issues for a Ghana municipal reporting app.
Based on the text and optional image, output a single JSON object ONLY (no markdown), with keys:
- "category": short snake_case label (e.g. pothole, broken_streetlight, illegal_dumping, water_leak, blocked_drain)
- "severity": integer 1-5 (5 = urgent safety risk)
- "summary": one sentence suitable for a public map popup
- "routing_hint": which type of authority usually handles this (e.g. "district_assembly", "water_company")

{text_block}"""

    parts: list[types.Part] = [types.Part.from_text(text=prompt)]
    if image_bytes and image_mime:
        parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[types.Content(role="user", parts=parts)],
    )
    out_text = (response.text or "").strip()
    if not out_text:
        raise ValueError("Empty Gemini response")
    try:
        return parse_model_json(out_text)
    except json.JSONDecodeError:
        logger.warning("Gemini returned non-JSON: %s", out_text[:500])
        raise


def build_structured_report(
    settings: Settings,
    *,
    description: str | None,
    voice_transcript: str | None,
    category: str | None,
    summary: str | None,
    lat: float,
    lng: float,
) -> dict[str, Any]:
    """Produces a structured civic report object (stored as jsonb)."""
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = f"""Convert the following citizen report into a formal civic report as ONE JSON object ONLY (no markdown).
Keys:
- "title": short official title
- "what": factual description
- "where": human-readable location note (coordinates given separately)
- "when_reported": use ISO-8601 placeholder text "see system timestamp" if unknown
- "recommended_actions": array of strings
- "hazards": array of strings or empty

Coordinates: lat {lat}, lng {lng}
Category: {category or "unknown"}
Public summary: {summary or "(none)"}
Citizen description: {description or "(none)"}
Voice transcript: {voice_transcript or "(none)"}
"""
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
    )
    out_text = (response.text or "").strip()
    return parse_model_json(out_text)
