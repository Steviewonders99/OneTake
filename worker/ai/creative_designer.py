"""Creative designer: Kimi K2.5 generates HTML/CSS ad overlays.

Builds the mega-prompt from campaign context and calls Kimi K2.5
via OpenRouter. Parses the JSON array of HTML creative designs.

Each call produces 2-3 unique creatives for one persona x platform
combination, using different actors, scenes, and persona-driven hooks.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import NVIDIA_NIM_API_KEY, NVIDIA_NIM_BASE_URL, OPENROUTER_API_KEY
from prompts.creative_overlay import (
    BRAND_KIT,
    DESIGN_AUDIT,
    OVERLAY_INSTRUCTIONS,
    get_frontend_design_skill,
)

logger = logging.getLogger(__name__)


async def design_creatives(
    persona: dict[str, Any],
    actors: list[dict[str, Any]],
    platform: str,
    platform_spec: dict[str, Any],
    brief: dict[str, Any],
    platform_copy: dict[str, Any],
    cultural_research: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Call Kimi K2.5 to design 2-3 creatives for a persona x platform combo.

    Parameters
    ----------
    persona : dict
        Persona archetype with psychology profile, pain points, trigger words.
    actors : list[dict]
        The 3 actors for this persona, each with image URLs and scene data.
    platform : str
        Target platform key (e.g., "ig_feed").
    platform_spec : dict
        Width, height, safe_margin for this platform.
    brief : dict
        Campaign brief with objectives, compensation, messaging strategy.
    platform_copy : dict
        Stage 3 ad copy for this platform (for reference — overlay must not duplicate).
    cultural_research : dict, optional
        Cultural research data for the target region.

    Returns
    -------
    list[dict]
        Each dict has: actor_name, scene, overlay_headline, overlay_sub,
        overlay_cta, image_treatment, html.
    """
    if not NVIDIA_NIM_API_KEY and not OPENROUTER_API_KEY:
        logger.warning("No LLM API key configured — returning empty designs")
        return []

    w = platform_spec["width"]
    h = platform_spec["height"]
    margin = platform_spec["safe_margin"]

    # Build actor context block
    actor_blocks = []
    for actor in actors[:3]:
        name = actor.get("name", "Contributor")
        images = actor.get("images", {})
        scenes = []
        for scene_key, scene_data in images.items():
            desc = scene_data.get('scene_description', '')
            desc_line = f"\n    SCENE DESCRIPTION: {desc}" if desc else ""
            scenes.append(
                f"  Scene '{scene_key}':{desc_line}\n"
                f"    full_image_url={scene_data.get('full_url', '')}\n"
                f"    cutout_url={scene_data.get('cutout_url', '')}\n"
                f"    cutout_shadow_url={scene_data.get('shadow_url', '')}"
            )
        actor_blocks.append(
            f"Actor: {name} (region: {actor.get('region', 'global')})\n"
            + "\n".join(scenes)
        )
    actors_text = "\n\n".join(actor_blocks)

    # Build persona context
    persona_text = (
        f"Archetype: {persona.get('archetype_key', 'unknown')}\n"
        f"Age range: {persona.get('age_range', 'unknown')}\n"
        f"Lifestyle: {persona.get('lifestyle', 'unknown')}\n"
        f"Pain points: {json.dumps(persona.get('pain_points', []), default=str)}\n"
        f"Motivations: {json.dumps(persona.get('motivations', []), default=str)}\n"
        f"Trigger words: {json.dumps(persona.get('trigger_words', []), default=str)}\n"
        f"Psychology: {json.dumps(persona.get('psychology_profile', {}), default=str)[:500]}"
    )

    # Build brief context
    brief_text = (
        f"Campaign: {brief.get('campaign_objective', 'Recruit contributors')}\n"
        f"Task type: {brief.get('task_type', 'data annotation')}\n"
        f"Compensation: {json.dumps(brief.get('compensation', {}), default=str)}\n"
        f"Messaging: {json.dumps(brief.get('messaging_strategy', {}), default=str)[:400]}"
    )

    # Platform copy reference
    copy_ref = json.dumps(platform_copy, default=str)[:600] if platform_copy else "None available"

    # Build overlay instructions with dimensions injected
    instructions = OVERLAY_INSTRUCTIONS.format(
        width=w, height=h, safe_margin=margin,
    )

    # Assemble the mega-prompt
    system_prompt = (
        f"{get_frontend_design_skill()}\n\n"
        f"{BRAND_KIT}\n\n"
        f"{DESIGN_AUDIT}\n\n"
        f"{instructions}"
    )

    user_prompt = (
        f"Design 2-3 unique ad creatives for OneForma recruitment.\n\n"
        f"CAMPAIGN BRIEF:\n{brief_text}\n\n"
        f"TARGET PERSONA:\n{persona_text}\n\n"
        f"ACTORS (use different actors and scenes for each creative):\n{actors_text}\n\n"
        f"PLATFORM: {platform} ({w}x{h}px, {margin}px safe area)\n\n"
        f"PLATFORM AD COPY (for reference — do NOT duplicate on creative):\n{copy_ref}\n\n"
        f"Return a JSON array of 2-3 creative objects. Each must have: "
        f"actor_name, scene, overlay_headline, overlay_sub, overlay_cta, "
        f"image_treatment, html."
    )

    logger.info(
        "Designing creatives: persona=%s, platform=%s, prompt=%d chars",
        persona.get("archetype_key", "?"), platform,
        len(system_prompt) + len(user_prompt),
    )

    # Try NVIDIA NIM (free) first, fallback to OpenRouter (paid)
    providers = []
    if NVIDIA_NIM_API_KEY:
        providers.append(("NIM", f"{NVIDIA_NIM_BASE_URL}/chat/completions", NVIDIA_NIM_API_KEY))
    if OPENROUTER_API_KEY:
        providers.append(("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", OPENROUTER_API_KEY))

    content = ""
    for provider_name, url, key in providers:
        try:
            payload = {
                "model": "moonshotai/kimi-k2.5",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 16384,
                "temperature": 0.8,
                "stream": False,
            }
            if provider_name == "NIM":
                payload["chat_template_kwargs"] = {"thinking": False}

            async with httpx.AsyncClient(timeout=180) as client:
                resp = await client.post(url, headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                }, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"].get("content", "")
                logger.info("Creative designer via %s (%d chars)", provider_name, len(content))
                break
        except Exception as e:
            logger.warning("Creative designer via %s failed: %s", provider_name, e)
            continue

    if not content:
        logger.error("All providers failed for creative design")
        return []

    # Parse JSON array from response
    designs = _parse_designs(content)
    logger.info(
        "Kimi returned %d creative designs for %s/%s",
        len(designs), persona.get("archetype_key", "?"), platform,
    )
    return designs


def _parse_designs(text: str) -> list[dict[str, Any]]:
    """Parse JSON array of creative designs from Kimi output.

    Handles markdown code fences and embedded JSON.
    """
    cleaned = text.strip()

    # Strip markdown fences
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    # Try direct parse
    try:
        result = json.loads(cleaned)
        if isinstance(result, list):
            return [d for d in result if isinstance(d, dict) and "html" in d]
        if isinstance(result, dict) and "html" in result:
            return [result]
    except json.JSONDecodeError:
        pass

    # Search for JSON array in text
    bracket_depth = 0
    arr_start = -1
    for i, char in enumerate(cleaned):
        if char == '[':
            if bracket_depth == 0:
                arr_start = i
            bracket_depth += 1
        elif char == ']':
            bracket_depth -= 1
            if bracket_depth == 0 and arr_start >= 0:
                candidate = cleaned[arr_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        return [d for d in parsed if isinstance(d, dict) and "html" in d]
                except json.JSONDecodeError:
                    pass
                arr_start = -1

    # Search for individual JSON objects with html key
    brace_depth = 0
    obj_start = -1
    results = []
    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                obj_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and obj_start >= 0:
                candidate = cleaned[obj_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and "html" in parsed:
                        results.append(parsed)
                except json.JSONDecodeError:
                    pass
                obj_start = -1
    if results:
        return results

    logger.warning("Failed to parse any creative designs from Kimi output (%d chars)", len(text))
    return []
