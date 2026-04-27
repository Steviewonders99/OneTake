"""Creative Director LLM — builds prompts and parses structured JSON configs.

The Creative Director is the "brain" of the Stage 4 graphic design agent.
It receives available layouts, actors, and copy variants, then outputs
structured JSON configs that the deterministic renderer can execute.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

import httpx

from config import (
    CREATIVE_DIRECTOR_MODEL,
    CREATIVE_DIRECTOR_FALLBACK,
    OPENROUTER_API_KEY,
)
from compositor.schema import EARN_LAYOUTS, GROW_LAYOUTS, SHAPE_LAYOUTS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pillar → layout mapping
# ---------------------------------------------------------------------------
PILLAR_LAYOUTS: Dict[str, frozenset] = {
    "earn": EARN_LAYOUTS,
    "grow": GROW_LAYOUTS,
    "shape": SHAPE_LAYOUTS,
}

# ---------------------------------------------------------------------------
# Layout descriptions (one-line each)
# ---------------------------------------------------------------------------
LAYOUT_DESCRIPTIONS: Dict[str, str] = {
    "earn_hero_badge": "Full actor + floating earnings badge + warm gradient. Actor right, text top-left.",
    "earn_split_stat": "Diagonal split — actor left, stat callout right ($X/hr oversized).",
    "earn_full_bleed": "Full bleed actor photo, gradient overlay bar at bottom with headline + CTA.",
    "earn_card_stack": "Testimonial card overlapping actor photo. Trust-building.",
    "grow_device_mockup": "Actor + device mockup showing task UI. Shows 'what you'll do.'",
    "grow_editorial": "Magazine editorial — large serif headline, actor portrait, generous whitespace.",
    "grow_diagonal_split": "Diagonal split with actor + skill badge cluster overlay. Dynamic energy.",
    "grow_bold_type": "Minimal photo + oversized bold headline. Typography-forward, modern.",
    "shape_portrait_cred": "Professional portrait + credential bar. Authority signals.",
    "shape_multi_grid": "2-3 image grid + impact stats overlay. Data-rich, credibility.",
    "shape_clean_card": "White card container + actor + professional overlay. Corporate, approachable.",
    "shape_photo_frame": "Photo-first with subtle brand frame border. Premium, minimal text.",
}

# ---------------------------------------------------------------------------
# OpenRouter endpoint
# ---------------------------------------------------------------------------
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def build_prompt(
    actors: List[Dict[str, Any]],
    copy_variants: List[str],
    brief: Dict[str, Any],
    pillar: str,
    cultural_context: str = "",
) -> str:
    """Build the Creative Director system prompt.

    Tells the LLM what layouts, actors, and copy are available, then asks
    it to return a JSON array of creative configs.
    """
    # Resolve layouts for this pillar
    layouts = PILLAR_LAYOUTS.get(pillar, frozenset())
    num_creatives = min(len(actors) * 2, 6)

    # Build layout section
    layout_lines = []
    for layout_id in sorted(layouts):
        desc = LAYOUT_DESCRIPTIONS.get(layout_id, "")
        layout_lines.append(f"  - {layout_id}: {desc}")
    layout_block = "\n".join(layout_lines)

    # Build actor section
    actor_lines = []
    for actor in actors:
        actor_lines.append(
            f"  - actor_id: \"{actor['actor_id']}\" | name: {actor.get('name', 'Unknown')} | "
            f"persona: {actor.get('persona_summary', 'N/A')}"
        )
    actor_block = "\n".join(actor_lines)

    # Build copy variants section
    copy_lines = []
    for i, variant in enumerate(copy_variants):
        copy_lines.append(f"  {i + 1}. \"{variant}\"")
    copy_block = "\n".join(copy_lines)

    # Build brief summary
    brief_block = (
        f"  Pillar: {brief.get('pillar', pillar)}\n"
        f"  Task type: {brief.get('task_type', 'N/A')}\n"
        f"  Compensation: {brief.get('compensation', 'N/A')}\n"
        f"  Country: {brief.get('country', 'N/A')}"
    )

    # Cultural context section
    cultural_block = ""
    if cultural_context:
        cultural_block = f"""
CULTURAL CONTEXT:
{cultural_context}
"""

    # JSON schema example
    json_example = json.dumps(
        {
            "layout": "<layout_id>",
            "background": {"type": "gradient|solid|image|pattern", "preset": "<preset_name>"},
            "actor": {"actor_id": "<actor_id>", "position": "<position>", "scale": 0.85, "mask": "soft_fade|none|circle_crop|diagonal_slice|gradient_fade"},
            "overlay": {"elements": ["<element_id>"], "intensity": "light|medium|heavy"},
            "text": {"headline": "<from copy variants>", "subheadline": "<short context>", "position": "<position>", "size": "small|medium|large|xlarge", "contrast_backdrop": "<backdrop_style>"},
            "cta": {"text": "<cta_text>", "style": "pill_primary|pill_outline|banner_full|floating_circle|inline_text", "position": "<position>"},
            "context_element": None,
        },
        indent=2,
    )

    prompt = f"""You are a Creative Director for recruitment ad creatives. Your job is to design {num_creatives} ad creatives by selecting layouts, actors, copy, and styling — then output structured JSON configs.

AVAILABLE LAYOUTS (use ONLY these):
{layout_block}

AVAILABLE ACTORS:
{actor_block}

COPY VARIANTS (select headlines from this list ONLY — do NOT write new copy):
{copy_block}

BRIEF:
{brief_block}
{cultural_block}
COMPOSITION RULES:
1. Each creative MUST use a DIFFERENT layout — no repeated layouts.
2. Layouts must match the "{pillar}" pillar — only use {pillar}_* layouts.
3. Actor and text must NOT overlap — if actor is "right", text must be on the left side (e.g. "top-left", "left", "bottom-left").
4. Headlines MUST be selected verbatim from the copy variants above. Do NOT invent new headlines.
5. Use context_element (badge, stat callout, device mockup) where the layout supports it. Set to null otherwise.
6. Every creative must have a UNIQUE headline — no two creatives share the same headline text.
7. Distribute actors across creatives for visual diversity — avoid using the same actor for all creatives.

OUTPUT FORMAT:
Return ONLY a JSON array of {num_creatives} creative config objects. No explanation, no markdown fences, no extra text.

Each object must follow this schema:
{json_example}

Valid positions: left, right, center, top-left, top-right, top-center, bottom-left, bottom-right, bottom-center.

Return ONLY the JSON array now."""

    return prompt


def parse_response(raw: str) -> List[Dict[str, Any]]:
    """Parse the LLM response into a list of config dicts.

    Handles markdown fences, single-dict responses, and parse failures.
    """
    # Strip markdown fences if present
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Creative Director response failed JSON parse: %s", raw[:200])
        return []

    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        return [parsed]

    logger.warning("Creative Director response was not a list or dict: %s", type(parsed))
    return []


async def generate_creative_configs(
    actors: List[Dict[str, Any]],
    copy_variants: List[str],
    brief: Dict[str, Any],
    pillar: str,
    cultural_context: str = "",
) -> List[Dict[str, Any]]:
    """Call the LLM via OpenRouter to generate creative configs.

    Tries CREATIVE_DIRECTOR_MODEL first, falls back to CREATIVE_DIRECTOR_FALLBACK.
    Returns list of parsed config dicts, or [] if all models fail.
    """
    prompt = build_prompt(actors, copy_variants, brief, pillar, cultural_context)

    models = [CREATIVE_DIRECTOR_MODEL, CREATIVE_DIRECTOR_FALLBACK]

    for model in models:
        try:
            configs = await _call_openrouter(model, prompt)
            if configs:
                logger.info(
                    "Creative Director (%s) returned %d configs", model, len(configs)
                )
                return configs
            logger.warning("Creative Director (%s) returned empty configs, trying fallback", model)
        except Exception:
            logger.exception("Creative Director (%s) failed", model)

    logger.error("All Creative Director models failed — returning empty configs")
    return []


async def _call_openrouter(model: str, prompt: str) -> List[Dict[str, Any]]:
    """Make a single OpenRouter API call and parse the response."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4096,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(OPENROUTER_URL, json=payload, headers=headers)
        resp.raise_for_status()

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return parse_response(content)
