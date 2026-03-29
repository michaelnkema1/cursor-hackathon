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


def _truncate_sentence(text: str, limit: int = 160) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return "A problem was submitted for investigation."
    if len(normalized) <= limit:
        return normalized
    shortened = normalized[: limit - 1].rsplit(" ", 1)[0].strip()
    return f"{shortened or normalized[: limit - 3]}..."


def _fallback_classification(
    *,
    description: str | None,
    voice_transcript: str | None,
) -> dict[str, Any]:
    text = " ".join(part for part in [description, voice_transcript] if part).lower()

    category = "operations_breakdown"
    routing_hint = "operations"
    if any(
        word in text
        for word in (
            "bug",
            "crash",
            "error",
            "deploy",
            "login",
            "database",
            "checkout",
            "payment",
            "sync",
            "api",
            "app",
        )
    ):
        category = "systems_bug"
        routing_hint = "engineering"
    elif any(
        word in text
        for word in (
            "unsafe",
            "injury",
            "fire",
            "threat",
            "badge",
            "security",
            "harassment",
            "breach",
        )
    ):
        category = "safety_hazard"
        routing_hint = "security"
    elif any(
        word in text
        for word in (
            "office",
            "warehouse",
            "door",
            "elevator",
            "power",
            "leak",
            "hvac",
            "facility",
            "internet",
        )
    ):
        category = "facilities_issue"
        routing_hint = "facilities"
    elif any(
        word in text
        for word in (
            "customer",
            "client",
            "ticket",
            "complaint",
            "support",
            "refund",
            "sla",
        )
    ):
        category = "customer_experience"
        routing_hint = "support"
    elif any(
        word in text
        for word in (
            "hiring",
            "staff",
            "team",
            "schedule",
            "onboarding",
            "interview",
            "people",
            "training",
        )
    ):
        category = "people_process"
        routing_hint = "operations"

    severity = 2 if text else 1
    if any(word in text for word in ("death", "electroc", "collapsed", "sinkhole", "explosion")):
        severity = 5
    elif any(
        phrase in text
        for phrase in (
            "blocking one lane",
            "blocking both lanes",
            "accident",
            "dangerous",
            "hazard",
            "urgent",
            "major",
        )
    ):
        severity = 4
    elif any(word in text for word in ("large", "deep", "flooding", "overflow", "blocked")):
        severity = 3

    return {
        "category": category,
        "severity": severity,
        "summary": _truncate_sentence(
            description
            or voice_transcript
            or "A reported problem is waiting for investigator review."
        ),
        "routing_hint": routing_hint,
    }


def _fallback_structured_report(
    *,
    description: str | None,
    voice_transcript: str | None,
    category: str | None,
    summary: str | None,
    lat: float,
    lng: float,
) -> dict[str, Any]:
    return {
        "title": _truncate_sentence(summary or category or "Problem investigation brief", 80),
        "what": _truncate_sentence(
            description
            or voice_transcript
            or "A submitted problem needs manual review.",
            400,
        ),
        "where": f"Approximate coordinates: {lat:.5f}, {lng:.5f}",
        "when_reported": "see system timestamp",
        "recommended_actions": [
            "Confirm the problem details",
            "Assign a first-response owner",
            "Update the case status after review",
        ],
        "hazards": [summary] if summary else [],
    }


def classify_issue(
    settings: Settings,
    *,
    description: str | None,
    voice_transcript: str | None,
    image_bytes: bytes | None,
    image_mime: str | None,
) -> dict[str, Any]:
    """
    Returns keys: category (str), severity (int 1-5 per rubric in prompt), summary (str), routing_hint (str, optional).
    """
    client = genai.Client(api_key=settings.gemini_api_key)
    text_block = "\n".join(
        s
        for s in [
            f"Reporter description: {description or '(none)'}",
            f"Voice transcript: {voice_transcript or '(none)'}",
        ]
        if s
    )
    prompt = f"""You classify general problem reports for an investigation workspace.
Reports may describe product bugs, operational failures, customer issues, safety hazards,
facilities breakdowns, or people/process problems.
Based on the text and optional image, output a single JSON object ONLY (no markdown), with keys:
- "category": short snake_case label (e.g. systems_bug, operations_breakdown, safety_hazard, facilities_issue, customer_experience)
- "severity": integer 1-5 using this scale only:
  1 = minor friction or cosmetic issue with little impact.
  2 = noticeable issue affecting one user, team, or workflow.
  3 = meaningful disruption, repeated failure, or moderate risk if ignored.
  4 = major disruption, urgent blocker, or high-risk situation that needs fast action.
  5 = critical failure, severe safety concern, serious data/security risk, or full outage.
- "summary": one sentence suitable for an investigation queue or map popup
- "routing_hint": which team should review first (e.g. "engineering", "operations", "support", "security", "facilities")

{text_block}"""

    parts: list[types.Part] = [types.Part.from_text(text=prompt)]
    if image_bytes and image_mime:
        parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[types.Content(role="user", parts=parts)],
        )
        out_text = (response.text or "").strip()
        if not out_text:
            raise ValueError("Empty Gemini response")
        return parse_model_json(out_text)
    except Exception as exc:
        logger.warning("Gemini classify fallback engaged: %s", exc)
        return _fallback_classification(
            description=description,
            voice_transcript=voice_transcript,
        )


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
    """Produces a structured investigation brief object (stored as jsonb)."""
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = f"""Convert the following problem intake into a formal investigation brief as ONE JSON object ONLY (no markdown).
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
Reporter description: {description or "(none)"}
Voice transcript: {voice_transcript or "(none)"}
"""
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        out_text = (response.text or "").strip()
        return parse_model_json(out_text)
    except Exception as exc:
        logger.warning("Gemini structured-report fallback engaged: %s", exc)
        return _fallback_structured_report(
            description=description,
            voice_transcript=voice_transcript,
            category=category,
            summary=summary,
            lat=lat,
            lng=lng,
        )
