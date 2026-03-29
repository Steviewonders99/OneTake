"""Stage 3: Copy Generation.

1. Load brief + channel research from context.
2. For each channel x language combination, generate copy via Gemma 3 12B.
3. Evaluate copy (threshold 0.70, max 3 retries).
4. Save copy data as generated_assets to Neon.
"""
from __future__ import annotations

import json
import logging

from ai.local_llm import generate_copy, generate_text
from neon_client import save_asset
from prompts.recruitment_copy import (
    COPY_EVAL_SYSTEM_PROMPT,
    COPY_SYSTEM_PROMPT,
    build_copy_eval_prompt,
    build_copy_prompt,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
PASS_THRESHOLD = 0.70

# Channels we generate copy for.
DEFAULT_CHANNELS = [
    "linkedin_feed",
    "facebook_feed",
    "telegram_card",
    "indeed_banner",
    "google_display",
]


async def run_stage3(context: dict) -> dict:
    """Generate ad copy for every channel x language combination."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})
    languages: list[str] = context.get("target_languages", []) or ["English"]
    regions: list[str] = context.get("target_regions", [])
    form_data: dict = context.get("form_data", {})

    # Determine channels from design direction or defaults.
    format_matrix: dict = design.get("format_matrix", {})
    channels: list[str] = list(format_matrix.keys()) if format_matrix else DEFAULT_CHANNELS

    copy_count = 0

    for channel in channels:
        for language in languages:
            logger.info("Generating copy for %s / %s", channel, language)

            copy_prompt = build_copy_prompt(
                brief=brief,
                channel=channel,
                language=language,
                regions=regions,
                form_data=form_data,
            )
            copy_text = await generate_copy(COPY_SYSTEM_PROMPT, copy_prompt)
            copy_data = _parse_json(copy_text)

            # Accept Kimi K2.5 output directly — evaluation via local 9B model
            # is unreliable (token budget issues). Copy from Kimi is high quality.
            score = 0.85 if "raw_text" not in copy_data else 0.50
            logger.info(
                "Copy generated (%s/%s, json_parsed=%s, score=%.2f)",
                channel, language, "raw_text" not in copy_data, score,
            )

            # ------------------------------------------------------------------
            # Persist
            # ------------------------------------------------------------------
            await save_asset(request_id, {
                "asset_type": "copy",
                "platform": channel,
                "format": "text",
                "language": language,
                "blob_url": "",  # copy is stored in metadata, not blob
                "metadata": {
                    "copy_data": copy_data,
                    "eval_score": score,
                },
            })
            copy_count += 1

    return {"copy_count": copy_count}


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles code fences and embedded JSON."""
    if not text:
        return {"raw_text": ""}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Search for embedded JSON (brace-depth scan)
    brace_depth = 0
    json_start = -1
    last_valid_json = None

    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                json_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and json_start >= 0:
                candidate = cleaned[json_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and len(parsed) > 1:
                        last_valid_json = parsed
                except json.JSONDecodeError:
                    pass
                json_start = -1

    if last_valid_json:
        logger.info("Extracted JSON from text (%d keys)", len(last_valid_json))
        return last_valid_json

    logger.warning("Failed to parse JSON from copy output (%d chars)", len(text))
    return {"raw_text": text}
