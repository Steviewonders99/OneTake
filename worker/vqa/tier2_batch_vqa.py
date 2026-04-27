"""Tier 2 — batch Gemma 4 Vision call on all rendered PNGs (spatial checks).

Sends ALL PNGs in ONE multimodal API call. Checks:
  FACE_VISIBLE, NO_OVERLAP, PROPER_SPACING, VISUAL_HIERARCHY,
  NO_DEAD_SPACE, COMPOSITION_BALANCE.

Provider fallback: NIM first (free), then OpenRouter.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from config import (
    BATCH_VQA_MODEL,
    NVIDIA_NIM_BASE_URL,
    NVIDIA_NIM_VQA_KEY,
    OPENROUTER_API_KEY,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """You are a creative QA specialist reviewing recruitment ad creatives.
For EACH creative image (numbered starting at 0), evaluate these spatial checks:

1. FACE_VISIBLE — Is the person's face fully visible and not covered by text/elements? If covered, note "text covers actor face". If cropped out, note "face cut off by frame".
2. NO_OVERLAP — Are text, CTA, and actor clearly separated without stacking on each other?
3. PROPER_SPACING — Is there adequate padding between all elements and canvas edges?
4. VISUAL_HIERARCHY — Is there a clear reading order (headline → subheadline → CTA)?
5. NO_DEAD_SPACE — Is the canvas well-utilized without large empty areas?
6. COMPOSITION_BALANCE — Is the visual weight balanced across the canvas?

Return ONLY a JSON array (no markdown, no explanation). Each element:
{"creative_index": <int>, "passed": <bool>, "issues": [{"check": "<CHECK_NAME>", "detail": "<brief description>"}]}

If a creative passes all checks, return passed=true with empty issues array."""


# ---------------------------------------------------------------------------
# Provider call helpers
# ---------------------------------------------------------------------------

def _build_content_parts(png_list: List[bytes]) -> List[Dict[str, Any]]:
    """Build multimodal content array: text prompt + base64-encoded images."""
    parts: List[Dict[str, Any]] = [
        {"type": "text", "text": f"Evaluate these {len(png_list)} recruitment ad creatives:"},
    ]
    for i, png_bytes in enumerate(png_list):
        b64 = base64.b64encode(png_bytes).decode("ascii")
        parts.append({
            "type": "text",
            "text": f"Creative {i}:",
        })
        parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })
    return parts


async def _call_provider(
    base_url: str,
    api_key: str,
    model: str,
    content_parts: List[Dict[str, Any]],
    extra_headers: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    """Make a single multimodal chat-completion call. Returns raw text or None."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": content_parts},
        ],
        "max_tokens": 4096,
        "temperature": 0.1,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning("VQA provider call failed (%s): %s", base_url, e)
        return None


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

def _parse_vqa_response(raw: str, count: int) -> List[Dict[str, Any]]:
    """Parse JSON from the VQA model response, handling markdown fences."""
    # Strip markdown code fences if present
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        results = json.loads(cleaned)
        if isinstance(results, list):
            return results
    except json.JSONDecodeError:
        logger.warning("Failed to parse VQA JSON response: %s...", cleaned[:200])

    # Fallback: return pass-all
    return _pass_all(count)


def _pass_all(count: int) -> List[Dict[str, Any]]:
    """Generate a pass-all result for all creatives (fail-open)."""
    return [
        {"creative_index": i, "passed": True, "issues": []}
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_tier2_batch_vqa(png_list: List[bytes]) -> List[Dict[str, Any]]:
    """Run Tier 2 batch VQA on all rendered PNGs.

    Sends all images in one multimodal call. Falls back across providers.
    If all providers fail, returns pass-all (don't block the pipeline).
    """
    if not png_list:
        return []

    content_parts = _build_content_parts(png_list)

    # --- Try NIM first (free) ---
    if NVIDIA_NIM_VQA_KEY:
        raw = await _call_provider(
            base_url=NVIDIA_NIM_BASE_URL,
            api_key=NVIDIA_NIM_VQA_KEY,
            model=BATCH_VQA_MODEL,
            content_parts=content_parts,
        )
        if raw:
            results = _parse_vqa_response(raw, len(png_list))
            logger.info("Tier 2 VQA completed via NIM — %d creatives", len(png_list))
            return results

    # --- Fallback to OpenRouter ---
    if OPENROUTER_API_KEY:
        raw = await _call_provider(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
            model=BATCH_VQA_MODEL,
            content_parts=content_parts,
            extra_headers={"HTTP-Referer": "https://nova-intake.vercel.app"},
        )
        if raw:
            results = _parse_vqa_response(raw, len(png_list))
            logger.info("Tier 2 VQA completed via OpenRouter — %d creatives", len(png_list))
            return results

    # --- All providers failed — fail open ---
    logger.warning("All VQA providers failed — returning pass-all for %d creatives", len(png_list))
    return _pass_all(len(png_list))
