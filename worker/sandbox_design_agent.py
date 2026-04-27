#!/usr/bin/env python3
"""Sandbox: Stage 4 Graphic Design Agent — test against Centaurus campaign data.

Loads real actors + copy from Neon, runs the Creative Director LLM,
renders creatives via the component assembly system, and saves PNGs
locally for visual inspection.

Usage:
  cd worker
  python3 sandbox_design_agent.py

  # Skip LLM — use hardcoded test configs:
  python3 sandbox_design_agent.py --offline

Output:
  /tmp/design_agent/*.png — rendered creatives
  /tmp/design_agent/*.html — source HTML
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Centaurus-Alpha campaign ─────────────────────────────────────
REQUEST_ID = "11c02668-7934-40f7-b611-72d80f96efba"

# Fallback test data (if DB is empty or --offline)
FALLBACK_ACTOR = {
    "actor_id": "test-sophie",
    "name": "Sophie Tremblay",
    "photo_url": "https://nek6dllf79zuiibo.public.blob.vercel-storage.com/requests/11c02668-7934-40f7-b611-72d80f96efba/actor_6af86b06-b3e1-4fc1-9e2f-4c272a898c6d_scene_4_reward_celebration_3e9c3677-kdCK7dj1cqioG0KpFwKeHqHpIHsltT.avif",
    "persona_summary": "Bilingual student, 22, looking for flexible remote work",
}

FALLBACK_COPY = [
    "Speak English? Earn $20 CAD/hr.",
    "Record short selfie videos from home",
    "Join 10,000+ contributors worldwide",
    "Flexible data tasks that fit your schedule",
]

FALLBACK_BRIEF = {
    "pillar_primary": "earn",
    "task_type": "selfie_video_data_collection",
    "compensation": "$20 CAD/hr",
    "country": "Canada",
}

# Offline test configs (skip LLM)
OFFLINE_CONFIGS_GROW = [
    {
        "layout": "grow_device_mockup",
        "background": {"type": "gradient", "preset": "gradient_cool_ocean"},
        "actor": {"actor_id": "test-sophie", "position": "left", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_cool_1"], "intensity": "light"},
        "text": {"headline": "Speak English? Earn $20 CAD/hr.", "subheadline": "Learn new skills while earning", "position": "top-right", "size": "large", "contrast_backdrop": "none"},
        "cta": {"text": "Start Learning", "style": "pill_primary", "position": "bottom-center"},
        "context_element": {"type": "device_mockup", "position": "bottom-right", "content": "Selfie video recording task"},
    },
    {
        "layout": "grow_editorial",
        "background": {"type": "solid", "preset": "bg_cool_gray"},
        "actor": {"actor_id": "test-sophie", "position": "center", "scale": 0.8, "mask": "none"},
        "overlay": {"elements": ["frame_subtle_outline"], "intensity": "medium"},
        "text": {"headline": "Record short selfie videos from home", "subheadline": "Build your portfolio with real-world AI tasks", "position": "top-center", "size": "xlarge", "contrast_backdrop": "none"},
        "cta": {"text": "Explore Tasks", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    },
    {
        "layout": "grow_diagonal_split",
        "background": {"type": "gradient", "preset": "gradient_grow_teal"},
        "actor": {"actor_id": "test-sophie", "position": "left", "scale": 1.0, "mask": "none"},
        "overlay": {"elements": ["bar_diagonal_accent"], "intensity": "medium"},
        "text": {"headline": "Join 10,000+ contributors worldwide", "subheadline": "Flexible tasks that grow your skills", "position": "top-right", "size": "large", "contrast_backdrop": "light_blur"},
        "cta": {"text": "Join Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": {"type": "icon_cluster", "position": "bottom-right", "content": "skills"},
    },
    {
        "layout": "grow_bold_type",
        "background": {"type": "solid", "preset": "bg_white"},
        "actor": {"actor_id": "test-sophie", "position": "center", "scale": 0.65, "mask": "circle_crop"},
        "overlay": {"elements": [], "intensity": "light"},
        "text": {"headline": "Flexible data tasks that fit your schedule", "subheadline": "", "position": "center", "size": "xlarge", "contrast_backdrop": "none"},
        "cta": {"text": "Get Started", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    },
]

OFFLINE_CONFIGS_SHAPE = [
    {
        "layout": "shape_portrait_cred",
        "background": {"type": "gradient", "preset": "gradient_shape_purple"},
        "actor": {"actor_id": "test-sophie", "position": "center", "scale": 0.9, "mask": "none"},
        "overlay": {"elements": ["badge_verification"], "intensity": "light"},
        "text": {"headline": "Speak English? Earn $20 CAD/hr.", "subheadline": "Verified tasks from a trusted platform", "position": "top-left", "size": "large", "contrast_backdrop": "light_blur"},
        "cta": {"text": "Get Verified", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    },
    {
        "layout": "shape_multi_grid",
        "background": {"type": "solid", "preset": "bg_cool_gray"},
        "actor": {"actor_id": "test-sophie", "position": "left", "scale": 0.8, "mask": "none"},
        "overlay": {"elements": ["frame_accent_border"], "intensity": "medium"},
        "text": {"headline": "Record short selfie videos from home", "subheadline": "Professional tasks for skilled contributors", "position": "top-right", "size": "large", "contrast_backdrop": "none"},
        "cta": {"text": "View Tasks", "style": "pill_primary", "position": "bottom-center"},
        "context_element": {"type": "task_card", "position": "bottom-right", "content": "Record a 30s selfie video"},
    },
    {
        "layout": "shape_clean_card",
        "background": {"type": "solid", "preset": "bg_white"},
        "actor": {"actor_id": "test-sophie", "position": "left", "scale": 0.75, "mask": "none"},
        "overlay": {"elements": ["frame_subtle_outline"], "intensity": "medium"},
        "text": {"headline": "Join 10,000+ contributors worldwide", "subheadline": "Trusted by professionals in 50+ countries", "position": "top-right", "size": "medium", "contrast_backdrop": "none"},
        "cta": {"text": "Learn More", "style": "pill_outline", "position": "bottom-center"},
        "context_element": {"type": "stat_badge", "position": "bottom-right", "content": "$2,400"},
    },
    {
        "layout": "shape_photo_frame",
        "background": {"type": "gradient", "preset": "gradient_pro_charcoal"},
        "actor": {"actor_id": "test-sophie", "position": "center", "scale": 1.0, "mask": "none"},
        "overlay": {"elements": ["frame_accent_border"], "intensity": "medium"},
        "text": {"headline": "Flexible data tasks that fit your schedule", "subheadline": "Work on your terms, build your expertise", "position": "bottom-left", "size": "large", "contrast_backdrop": "dark_gradient"},
        "cta": {"text": "Explore Opportunities", "style": "inline_text", "position": "inline"},
        "context_element": None,
    },
]

OFFLINE_CONFIGS = [
    {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "test-sophie", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1", "badge_earnings"], "intensity": "medium"},
        "text": {"headline": "Speak English? Earn $20 CAD/hr.", "subheadline": "Record short selfie videos from home", "position": "top-left", "size": "large", "contrast_backdrop": "dark_gradient"},
        "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": {"type": "device_mockup", "position": "bottom-left", "content": "selfie video task"},
    },
    {
        "layout": "earn_split_stat",
        "background": {"type": "gradient", "preset": "gradient_earn_gold"},
        "actor": {"actor_id": "test-sophie", "position": "left", "scale": 0.8, "mask": "none"},
        "overlay": {"elements": ["bar_side_fade"], "intensity": "heavy"},
        "text": {"headline": "Record short selfie videos from home", "subheadline": "Flexible hours, work from anywhere", "position": "top-right", "size": "xlarge", "contrast_backdrop": "none"},
        "cta": {"text": "Start Earning", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    },
    {
        "layout": "earn_full_bleed",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "test-sophie", "position": "center", "scale": 1.0, "mask": "none"},
        "overlay": {"elements": ["bar_bottom_dark"], "intensity": "heavy"},
        "text": {"headline": "Join 10,000+ contributors worldwide", "subheadline": "Earn $20/hr from home", "position": "bottom-left", "size": "large", "contrast_backdrop": "none"},
        "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    },
    {
        "layout": "earn_card_stack",
        "background": {"type": "solid", "preset": "bg_warm_cream"},
        "actor": {"actor_id": "test-sophie", "position": "center", "scale": 0.8, "mask": "circle_crop"},
        "overlay": {"elements": ["frame_corner_marks"], "intensity": "light"},
        "text": {"headline": "Flexible data tasks that fit your schedule", "subheadline": "No experience needed", "position": "bottom-left", "size": "medium", "contrast_backdrop": "none"},
        "cta": {"text": "Learn More", "style": "pill_primary", "position": "bottom-center"},
        "context_element": {"type": "task_card", "position": "bottom-right", "content": "Record a 30s selfie video"},
    },
]


async def load_from_neon():
    """Load real actors + copy from the Centaurus campaign in Neon."""
    try:
        from neon_client import get_actors, get_assets
        logger.info("Loading actors from Neon for request %s...", REQUEST_ID)
        actors = await get_actors(REQUEST_ID)
        image_assets = await get_assets(REQUEST_ID, asset_type="base_image")
        copy_assets = await get_assets(REQUEST_ID, asset_type="copy")

        # Attach photo URLs
        actor_photos = {}
        for asset in image_assets:
            aid = str(asset.get("actor_id", ""))
            url = asset.get("blob_url", "")
            if aid and url and aid not in actor_photos:
                actor_photos[aid] = url

        for actor in actors:
            aid = str(actor.get("id", ""))
            actor["actor_id"] = aid
            actor["photo_url"] = actor_photos.get(aid, "")

        actors_with_photos = [a for a in actors if a.get("photo_url")]

        # Extract headlines
        headlines = set()
        for asset in copy_assets:
            for field_name in ("content", "copy_data"):
                raw = asset.get(field_name)
                if isinstance(raw, str):
                    try:
                        raw = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        continue
                if isinstance(raw, dict):
                    for key in ("headline", "overlay_headline", "primary_text"):
                        val = raw.get(key)
                        if val and isinstance(val, str):
                            headlines.add(val)

        return actors_with_photos, list(headlines)[:8], copy_assets
    except Exception as e:
        logger.warning("Neon load failed: %s — using fallback data", e)
        return None, None, None


async def run_sandbox(offline: bool = False):
    """Run the graphic design agent sandbox."""
    out_dir = Path("/tmp/design_agent")
    out_dir.mkdir(exist_ok=True)

    from compositor.renderer import assemble_html
    from compositor.render_png import render_html_to_png
    from compositor.schema import CreativeConfig, validate_batch
    from vqa.tier1_checks import run_tier1_checks

    # ── Load data ──────────────────────────────────────────────────
    if not offline:
        actors, headlines, _ = await load_from_neon()
    else:
        actors, headlines = None, None

    if not actors:
        logger.info("Using fallback actor: Sophie Tremblay")
        actors = [FALLBACK_ACTOR]
        headlines = FALLBACK_COPY

    logger.info("Actors: %d, Headlines: %d", len(actors), len(headlines))
    for a in actors[:3]:
        logger.info("  Actor: %s — photo: %s", a.get("name", "?"), a.get("photo_url", "?")[:80])
    for h in headlines[:4]:
        logger.info("  Headline: %s", h)

    # ── Get configs (LLM or offline) ───────────────────────────────
    if offline:
        pillar_arg = "earn"
        for arg in sys.argv:
            if arg.startswith("--pillar="):
                pillar_arg = arg.split("=")[1]
        config_map = {"earn": OFFLINE_CONFIGS, "grow": OFFLINE_CONFIGS_GROW, "shape": OFFLINE_CONFIGS_SHAPE}
        configs_raw = config_map.get(pillar_arg, OFFLINE_CONFIGS)
        logger.info("OFFLINE MODE — using %s pillar configs (%d creatives)", pillar_arg, len(configs_raw))
    else:
        logger.info("Calling Creative Director LLM...")
        from ai.creative_director import generate_creative_configs
        configs_raw = await generate_creative_configs(
            actors=actors[:3],
            copy_variants=headlines,
            brief=FALLBACK_BRIEF,
            pillar="earn",
            cultural_context="Canada, English-speaking, tech-savvy, gig economy familiar",
        )
        if not configs_raw:
            logger.error("Creative Director returned nothing — falling back to offline configs")
            configs_raw = OFFLINE_CONFIGS

    # ── Validate ───────────────────────────────────────────────────
    errors = validate_batch(configs_raw, pillar=pillar_arg if offline else "earn", copy_variants=headlines)
    if errors:
        logger.warning("Batch validation errors: %s", errors)
        logger.info("Proceeding anyway for visual inspection...")

    # ── Render each creative ───────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info("RENDERING %d CREATIVES", len(configs_raw))
    logger.info("=" * 60)

    for i, raw_config in enumerate(configs_raw):
        layout = raw_config.get("layout", "unknown")
        logger.info("\n[%d/%d] Layout: %s", i + 1, len(configs_raw), layout)

        try:
            config = CreativeConfig.from_dict(raw_config)
        except (ValueError, KeyError) as e:
            logger.error("  Config parse error: %s — skipping", e)
            continue

        # Find actor photo
        actor_id = config.actor.actor_id
        photo_url = ""
        for a in actors:
            if a.get("actor_id") == actor_id or a.get("name", "").lower() in actor_id.lower():
                photo_url = a.get("photo_url", "")
                break
        if not photo_url and actors:
            photo_url = actors[0].get("photo_url", "")

        logger.info("  Actor: %s, Photo: %s", actor_id, photo_url[:60] if photo_url else "NONE")

        # Assemble HTML
        html = assemble_html(config, actor_photo_url=photo_url)

        # Tier 1 check
        t1 = run_tier1_checks(html)
        logger.info("  Tier 1: %s%s", "PASS" if t1["passed"] else "FAIL", f" — {t1['issues']}" if t1["issues"] else "")

        # Save HTML
        html_path = out_dir / f"{i:02d}_{layout}.html"
        html_path.write_text(html)
        logger.info("  HTML: %s", html_path)

        # Render PNG
        try:
            png_bytes = await render_html_to_png(html, 1080, 1080)
            png_path = out_dir / f"{i:02d}_{layout}.png"
            png_path.write_bytes(png_bytes)
            logger.info("  PNG:  %s (%d KB)", png_path, len(png_bytes) // 1024)
        except Exception as e:
            logger.error("  PNG render failed: %s", e)

    logger.info("\n" + "=" * 60)
    logger.info("DONE — output at %s", out_dir)
    logger.info("Open PNGs to inspect visual quality!")
    logger.info("=" * 60)


if __name__ == "__main__":
    offline = "--offline" in sys.argv
    asyncio.run(run_sandbox(offline=offline))
