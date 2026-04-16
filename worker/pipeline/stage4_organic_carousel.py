"""Organic carousel orchestrator — 12 carousels per campaign.

Guardrail: 3 personas × 2 platforms (LinkedIn + IG) × 2 variations = 12 max.
Reuses the existing carousel engine (stage4_carousel.py) for slide generation.
Generates recruiter-voice captions via Gemma 4 31B.
Validates captions for drift before saving.

Saves as asset_type='organic_carousel' — separate from paid 'carousel_panel'.

Variation variety is enforced:
  V1 = primary pillar angle (opportunity/benefit framing)
  V2 = secondary pillar angle (social proof/impact framing)
"""
from __future__ import annotations

import json
import logging

from ai.compositor import PLATFORM_SPECS
from ai.local_llm import generate_copy
from neon_client import get_assets, save_asset
from prompts.organic_caption_copy import (
    ORGANIC_CAPTION_SYSTEM_PROMPT,
    build_ig_caption_prompt,
    build_linkedin_caption_prompt,
)

from pipeline.organic_caption_validator import validate_caption
from pipeline.stage4_carousel import CAROUSEL_PLATFORMS, _generate_carousel

logger = logging.getLogger(__name__)

# ── Guardrails ────────────────────────────────────────────────────────

ORGANIC_PLATFORMS = ["linkedin_carousel", "ig_carousel"]
VARIATIONS_PER_PERSONA = 2
MAX_CAROUSELS = 12


async def run_organic_carousels(context: dict) -> dict:
    """Generate organic carousels with recruiter-voice captions.

    For each persona × platform × variation:
    1. Generate slides via existing carousel engine
    2. Generate recruiter-voice caption via Gemma 4
    3. Validate caption for drift (compensation, work mode, forbidden promises)
    4. Retry once if drift detected
    5. Save as organic_carousel asset

    Returns dict with organic_carousel_count.
    """
    request_id: str = context["request_id"]
    actors: list[dict] = context.get("actors", [])
    brief: dict = context.get("brief", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    form_data: dict = context.get("form_data", {})

    if not personas:
        logger.warning("No personas — skipping organic carousel generation")
        return {"organic_carousel_count": 0}

    logger.info(
        "═" * 60 + "\n"
        "ORGANIC CAROUSELS: %d personas × %d platforms × %d variations = %d max\n"
        + "═" * 60,
        len(personas), len(ORGANIC_PLATFORMS), VARIATIONS_PER_PERSONA, MAX_CAROUSELS,
    )

    # Load Stage 3 copy for hook inspiration
    copy_assets = await get_assets(request_id, asset_type="copy")

    # Build hard facts dict for drift validation
    compensation = form_data.get("compensation_rate", "")
    hard_facts = {
        "compensation_amount": f"${compensation}" if compensation else "",
        "work_mode": form_data.get("work_mode", "remote"),
    }

    carousel_count = 0

    for persona in personas:
        persona_name = persona.get(
            "persona_name",
            persona.get("name", persona.get("archetype_key", "candidate")),
        )
        persona_key = persona.get("archetype_key", persona_name)

        # Best Stage 3 headline for this persona (hook inspiration)
        best_headline = _get_best_headline(copy_assets, persona_key)

        for platform_key in ORGANIC_PLATFORMS:
            config = CAROUSEL_PLATFORMS.get(platform_key)
            spec = PLATFORM_SPECS.get(platform_key)
            if not config or not spec:
                logger.warning("No config/spec for %s — skipping", platform_key)
                continue

            for variation in range(1, VARIATIONS_PER_PERSONA + 1):
                # ── Guardrail: max carousels ──
                if carousel_count >= MAX_CAROUSELS:
                    logger.info(
                        "Hit max carousel cap (%d) — stopping organic generation",
                        MAX_CAROUSELS,
                    )
                    return {"organic_carousel_count": carousel_count}

                platform_label = "LinkedIn" if "linkedin" in platform_key else "Instagram"
                logger.info(
                    "Organic carousel %d/%d: %s × %s × V%d",
                    carousel_count + 1, MAX_CAROUSELS,
                    persona_name, platform_label, variation,
                )

                # ── 1. Generate slides via existing carousel engine ──
                try:
                    slides = await _generate_carousel(
                        platform_key=platform_key,
                        config=config,
                        spec=spec,
                        actors=actors,
                        brief=brief,
                        personas=[persona],  # Single persona per carousel
                        request_id=request_id,
                    )
                except Exception as exc:
                    logger.error(
                        "Slide generation failed for %s/%s/V%d: %s",
                        persona_name, platform_label, variation, exc,
                        exc_info=True,
                    )
                    continue

                if not slides:
                    logger.warning(
                        "No slides generated for %s/%s/V%d — skipping",
                        persona_name, platform_label, variation,
                    )
                    continue

                slide_urls = [
                    s.get("blob_url", "")
                    for s in slides
                    if s.get("blob_url")
                ]
                logger.info("  %d slides generated", len(slide_urls))

                # ── 2. Generate recruiter-voice caption ──
                if "linkedin" in platform_key:
                    caption_prompt = build_linkedin_caption_prompt(
                        form_data=form_data,
                        persona=persona,
                        brief=brief,
                        variation=variation,
                        stage3_headline=best_headline,
                    )
                else:
                    caption_prompt = build_ig_caption_prompt(
                        form_data=form_data,
                        persona=persona,
                        brief=brief,
                        variation=variation,
                        stage3_headline=best_headline,
                    )

                caption = await generate_copy(
                    ORGANIC_CAPTION_SYSTEM_PROMPT,
                    caption_prompt,
                    skill_stage="organic",
                    max_tokens=512,
                    temperature=0.8,
                )
                caption = caption.strip()
                logger.info("  Caption generated: %d chars", len(caption))

                # ── 3. Validate caption for drift ──
                passed, drift_issues = validate_caption(caption, hard_facts)

                if not passed:
                    logger.warning(
                        "  Caption DRIFT detected: %s — retrying with correction",
                        drift_issues,
                    )
                    # One retry with explicit correction instruction
                    correction = "; ".join(drift_issues)
                    caption = await generate_copy(
                        ORGANIC_CAPTION_SYSTEM_PROMPT,
                        caption_prompt + f"\n\nCRITICAL: Your previous attempt had these errors: {correction}. Fix them ALL.",
                        skill_stage="organic",
                        max_tokens=512,
                        temperature=0.6,
                    )
                    caption = caption.strip()
                    passed, drift_issues = validate_caption(caption, hard_facts)

                    if not passed:
                        logger.warning(
                            "  Caption STILL drifting after retry: %s — saving as failed",
                            drift_issues,
                        )

                # ── 4. Save as organic_carousel asset ──
                platform_short = "linkedin" if "linkedin" in platform_key else "instagram"

                await save_asset(request_id, {
                    "asset_type": "organic_carousel",
                    "platform": platform_short,
                    "format": "carousel",
                    "language": "English",
                    "blob_url": slide_urls[0] if slide_urls else "",
                    "stage": 4,
                    "evaluation_passed": passed,
                    "evaluation_score": 1.0 if passed else 0.5,
                    "evaluation_data": {"drift_issues": drift_issues} if not passed else {},
                    "metadata": {
                        "persona_key": persona_key,
                        "persona_name": persona_name,
                        "distribution": "organic",
                        "variation": variation,
                        "caption": caption,
                        "slide_count": len(slide_urls),
                        "slide_urls": slide_urls,
                        "hook_angle": "primary_pillar" if variation == 1 else "secondary_pillar",
                        "platform": platform_key,
                    },
                })

                carousel_count += 1
                logger.info(
                    "  ✓ Saved: %s/%s/V%d — %d slides, drift=%s",
                    persona_name, platform_label, variation,
                    len(slide_urls), "PASSED" if passed else "FAILED",
                )

    logger.info(
        "Organic carousel generation complete: %d/%d carousels generated",
        carousel_count, MAX_CAROUSELS,
    )
    return {"organic_carousel_count": carousel_count}


# ── Helpers ───────────────────────────────────────────────────────────


def _get_best_headline(copy_assets: list[dict], persona_key: str) -> str:
    """Get the best-scoring Stage 3 headline for hook inspiration."""
    best_score = -1.0
    best_headline = ""

    for asset in copy_assets:
        meta = asset.get("content") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (ValueError, TypeError):
                continue

        if meta.get("persona_key") != persona_key:
            continue

        score = float(
            meta.get("eval_score", asset.get("evaluation_score", 0)) or 0
        )
        if score > best_score:
            best_score = score
            copy_data = meta.get("copy_data", {})
            if isinstance(copy_data, str):
                try:
                    copy_data = json.loads(copy_data)
                except (ValueError, TypeError):
                    copy_data = {}
            best_headline = copy_data.get(
                "headline", copy_data.get("hook", "")
            )

    return best_headline
