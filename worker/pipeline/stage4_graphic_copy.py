"""Stage 4 Phase 1: Graphic Overlay Copy Generation.

Generates persona-aware, language-correct overlay text (headline, sub, CTA)
using Gemma 4 31B-IT via NVIDIA NIM. Complements Stage 3 ad copy.

Key constraints:
  - Text in target language (persona-specific — pt-BR for Brazil, de for Germany)
  - Total text under 25% of canvas area
  - Must COMPLEMENT (not duplicate) Stage 3 ad copy
  - Design intent output guides Phase 2 composition
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GEMMA4_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))

# Language code → display name for prompt clarity
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English", "pt": "Portuguese", "pt-BR": "Brazilian Portuguese",
    "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
    "ar": "Arabic", "ja": "Japanese", "ko": "Korean", "zh": "Mandarin Chinese",
    "hi": "Hindi", "id": "Indonesian", "th": "Thai", "vi": "Vietnamese",
    "tr": "Turkish", "pl": "Polish", "ro": "Romanian", "nl": "Dutch",
    "ru": "Russian", "uk": "Ukrainian", "sv": "Swedish", "da": "Danish",
    "fi": "Finnish", "no": "Norwegian", "el": "Greek", "he": "Hebrew",
    "tl": "Filipino",
}


def _compute_text_budget(width: int, height: int) -> dict[str, int]:
    """Compute text budget for 25% overlay limit."""
    canvas_pixels = width * height
    max_text_pixels = int(canvas_pixels * 0.25)
    # Rough: each char ~20px wide × ~40px tall at typical overlay sizes
    max_chars = max_text_pixels // (20 * 40)
    return {
        "canvas_pixels": canvas_pixels,
        "max_text_pixels": max_text_pixels,
        "max_chars": max(max_chars, 30),  # floor at 30 chars minimum
    }


async def generate_graphic_copy(
    base_knowledge: str,
    project_context: str,
    language: str,
    platform: str,
    platform_spec: dict[str, Any],
) -> dict[str, str]:
    """Generate graphic overlay copy via Gemma 4 on NIM.

    Returns dict with overlay_headline, overlay_sub, overlay_cta, design_intent.
    Falls back to safe defaults on failure.
    """
    if not GEMMA4_KEY:
        logger.warning("No Gemma 4 key — returning default graphic copy")
        return _default_copy(language)

    lang_name = LANGUAGE_NAMES.get(language, language)
    budget = _compute_text_budget(platform_spec["width"], platform_spec["height"])

    prompt = f"""{base_knowledge}

{project_context}

═══ TASK: GENERATE GRAPHIC OVERLAY TEXT ═══

Platform: {platform} ({platform_spec['width']}x{platform_spec['height']})

LANGUAGE: Write ALL overlay text in {lang_name} ({language}).
Use natural, local phrasing — not translated-from-English.

TEXT BUDGET (25% canvas limit):
  Canvas: {platform_spec['width']}x{platform_spec['height']} = {budget['canvas_pixels']:,} pixels
  Max text area: {budget['max_text_pixels']:,} pixels (~{budget['max_chars']} characters total)
  Keep it SHORT. Every word must earn its place.

RULES:
- The overlay text goes ON the image — it must stop the scroll in <1 second.
- It must COMPLEMENT (not duplicate) the Stage 3 ad copy shown above.
- Headline: 3-7 words MAX. Scroll-stopping. In {lang_name}.
- Subheadline: 1 short supporting line. In {lang_name}. Can be omitted if headline is strong enough.
- CTA: 2-4 words. Button text. In {lang_name}.
- Design intent: 1 sentence in ENGLISH explaining your creative angle for Phase 2.

Return ONLY valid JSON:
{{
  "overlay_headline": "3-7 words in {lang_name}",
  "overlay_sub": "1 short line in {lang_name} (or empty string if not needed)",
  "overlay_cta": "2-4 words in {lang_name}",
  "design_intent": "1 sentence in English: why this angle works for this persona",
  "language": "{language}"
}}"""

    try:
        payload = {
            "model": GEMMA4_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 512,
            "temperature": 0.7,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GEMMA4_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"].get("content", "")
        result = _parse_json(content)

        if result and "overlay_headline" in result:
            result.setdefault("language", language)
            logger.info(
                "Phase 1 graphic copy: headline='%s' lang=%s",
                result["overlay_headline"][:50], language,
            )
            return result

        logger.warning("Phase 1: could not parse Gemma 4 response — using defaults")
        return _default_copy(language)

    except Exception as e:
        logger.error("Phase 1 graphic copy failed: %s — using defaults", e)
        return _default_copy(language)


def _parse_json(text: str) -> dict | None:
    """Parse JSON from LLM response with fallbacks."""
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Brace-matching fallback
    start = cleaned.find("{")
    if start == -1:
        return None

    depth = 0
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _default_copy(language: str) -> dict[str, str]:
    """Safe fallback copy when Gemma 4 fails."""
    defaults: dict[str, dict[str, str]] = {
        "pt": {"overlay_headline": "Comece a Ganhar Hoje", "overlay_sub": "Trabalhe de qualquer lugar", "overlay_cta": "Inscreva-se"},
        "pt-BR": {"overlay_headline": "Comece a Ganhar Hoje", "overlay_sub": "Trabalhe de qualquer lugar", "overlay_cta": "Inscreva-se"},
        "es": {"overlay_headline": "Empieza a Ganar Hoy", "overlay_sub": "Trabaja desde cualquier lugar", "overlay_cta": "Únete Ahora"},
        "fr": {"overlay_headline": "Commencez à Gagner", "overlay_sub": "Travaillez de n'importe où", "overlay_cta": "Postulez"},
        "de": {"overlay_headline": "Jetzt Geld Verdienen", "overlay_sub": "Arbeiten Sie von überall", "overlay_cta": "Jetzt Bewerben"},
        "ar": {"overlay_headline": "ابدأ الكسب اليوم", "overlay_sub": "اعمل من أي مكان", "overlay_cta": "سجّل الآن"},
    }
    fallback = defaults.get(language, {
        "overlay_headline": "Start Earning Today",
        "overlay_sub": "Work from anywhere",
        "overlay_cta": "Apply Now",
    })
    return {**fallback, "design_intent": "Default fallback — Gemma 4 unavailable", "language": language}
