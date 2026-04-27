"""Stage 4 — Graphic Design Agent pipeline.

Uses the new design agent stack:
  Creative Director LLM → CreativeConfig schema → deterministic renderer
  → Tier 1 HTML checks → Tier 2 batch VQA → auto-fix loop → Blob + Neon save.

Activated when STAGE4_ENGINE == "design_agent" (default).
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List

from ai.creative_director import generate_creative_configs
from blob_uploader import upload_to_blob
from compositor.render_png import render_html_to_png
from compositor.renderer import assemble_html
from compositor.schema import CreativeConfig, validate_batch
from neon_client import get_actors, get_assets, save_asset
from vqa.auto_fix import MAX_FIX_CYCLES, apply_fixes
from vqa.tier1_checks import run_tier1_checks
from vqa.tier2_batch_vqa import run_tier2_batch_vqa

logger = logging.getLogger(__name__)

# Default canvas size (hero format — Phase 1)
_WIDTH = 1080
_HEIGHT = 1080


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_headlines(copy_assets: List[Dict[str, Any]]) -> List[str]:
    """Extract unique headline strings from Stage 3 copy assets.

    Each asset has a ``content`` field that is either a JSON string or a dict.
    Looks for keys: ``headline``, ``overlay_headline``, ``primary_text``.
    Caps at 8 variants.
    """
    headlines: list[str] = []
    seen: set[str] = set()

    for asset in copy_assets:
        content = asset.get("content")
        if content is None:
            continue

        # Parse JSON string if needed
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                continue

        if not isinstance(content, dict):
            continue

        # Also check copy_data field (some copy assets store data there)
        copy_data = asset.get("copy_data")
        if isinstance(copy_data, str):
            try:
                copy_data = json.loads(copy_data)
            except (json.JSONDecodeError, TypeError):
                copy_data = {}
        if not isinstance(copy_data, dict):
            copy_data = {}

        # Merge both dicts for headline extraction
        for source in (content, copy_data):
            for key in ("headline", "overlay_headline", "primary_text"):
                val = source.get(key)
                if val and isinstance(val, str) and val not in seen:
                    seen.add(val)
                    headlines.append(val)

    return headlines[:8]


def _attach_photo_urls(
    actors: List[Dict[str, Any]],
    image_assets: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Attach photo_url to each actor from image assets (base_image type).

    Matches via actor_id. Skips actors with no photo.
    """
    # Build actor_id → first image URL mapping
    actor_photos: Dict[str, str] = {}
    for asset in image_assets:
        aid = str(asset.get("actor_id", ""))
        if not aid or aid in actor_photos:
            continue

        # Photo URL is in blob_url
        url = asset.get("blob_url", "")
        if not url:
            # Try content metadata
            content = asset.get("content")
            if isinstance(content, dict):
                url = content.get("blob_url", "") or content.get("photo_url", "")
        if url:
            actor_photos[aid] = url

    # Attach to actors
    for actor in actors:
        aid = str(actor.get("id", actor.get("actor_id", "")))
        actor["actor_id"] = aid
        actor["photo_url"] = actor_photos.get(aid, "")

    return actors


# ---------------------------------------------------------------------------
# Render + save pipeline for a single creative
# ---------------------------------------------------------------------------


async def _render_single(
    config: CreativeConfig,
    photo_url: str,
) -> Dict[str, Any]:
    """Render a single creative config to HTML + PNG.

    Returns dict with html, png_bytes, config, and photo_url.
    """
    html = assemble_html(config, photo_url, _WIDTH, _HEIGHT)
    png_bytes = await render_html_to_png(html, _WIDTH, _HEIGHT)
    return {
        "config": config,
        "html": html,
        "png_bytes": png_bytes,
        "photo_url": photo_url,
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def run_stage4(context: dict) -> dict:
    """Graphic design agent Stage 4 pipeline.

    Parameters
    ----------
    context : dict
        Pipeline context with ``request_id``, ``brief``, ``form_data``, etc.

    Returns
    -------
    dict
        ``{"asset_count": int}``
    """
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    form_data: dict = context.get("form_data", {})
    country: str | None = context.get("country")

    logger.info("Stage 4 (design_agent) start: request_id=%s country=%s", request_id, country)

    # ── 1. Resolve pillar + language ────────────────────────────────────
    # Extract pillar — try DB column first, then derived_requirements, then fallback
    pillar = brief.get("pillar_primary")
    secondary_pillar = brief.get("pillar_secondary")
    pillar_weighting = {}
    if not pillar:
        # Stage 3 pattern: extract from derived_requirements inside brief_data
        brief_data = brief.get("brief_data", {})
        if isinstance(brief_data, str):
            import json as _json
            try:
                brief_data = _json.loads(brief_data)
            except (json.JSONDecodeError, TypeError):
                brief_data = {}
        derived = brief_data.get("derived_requirements", {})
        if isinstance(derived, str):
            try:
                derived = json.loads(derived)
            except (json.JSONDecodeError, TypeError):
                derived = {}
        pillar_weighting = derived.get("pillar_weighting", {})
        pillar = pillar_weighting.get("primary", "earn")
        if not secondary_pillar:
            secondary_pillar = pillar_weighting.get("secondary")

    if pillar not in ("earn", "grow", "shape"):
        pillar = "earn"

    logger.info("Stage 4 pillar resolved: primary=%s, secondary=%s", pillar, secondary_pillar)

    language = form_data.get("primary_language", "en") if form_data else "en"

    # ── 2. Load actors ──────────────────────────────────────────────────
    actors = context.get("actors") or await get_actors(request_id)
    if not actors:
        logger.warning("No actors found for request %s — skipping design agent", request_id)
        return {"asset_count": 0}

    # Attach photo URLs from image assets
    image_assets = await get_assets(request_id, asset_type="base_image")
    actors = _attach_photo_urls(actors, image_assets)

    # Filter actors without photos
    actors_with_photos = [a for a in actors if a.get("photo_url")]
    if not actors_with_photos:
        logger.warning("No actors with photo URLs — skipping design agent")
        return {"asset_count": 0}

    logger.info("Loaded %d actors (%d with photos)", len(actors), len(actors_with_photos))

    # ── 3. Load copy assets + extract headlines ─────────────────────────
    copy_assets = await get_assets(request_id, asset_type="copy")
    copy_variants = _extract_headlines(copy_assets)

    if not copy_variants:
        logger.warning("No copy variants extracted — skipping design agent")
        return {"asset_count": 0}

    logger.info("Extracted %d copy variants", len(copy_variants))

    # ── 4. Build cultural context string ────────────────────────────────
    cultural_research = context.get("cultural_research", {})
    cultural_ctx = ""
    if cultural_research:
        cultural_ctx = json.dumps(cultural_research, default=str)[:2000]

    # ── 5. Call Creative Director LLM ───────────────────────────────────
    raw_configs = await generate_creative_configs(
        actors_with_photos, copy_variants, brief, pillar, cultural_ctx,
    )

    if not raw_configs:
        logger.error("Creative Director returned no configs — aborting")
        return {"asset_count": 0}

    logger.info("Creative Director returned %d raw configs", len(raw_configs))

    # ── 6. Validate batch — retry once on errors ────────────────────────
    errors = validate_batch(raw_configs, pillar, copy_variants)
    if errors:
        logger.warning("Batch validation errors (attempt 1): %s", errors)
        # Retry: call Creative Director again
        raw_configs = await generate_creative_configs(
            actors_with_photos, copy_variants, brief, pillar, cultural_ctx,
        )
        errors = validate_batch(raw_configs, pillar, copy_variants)
        if errors:
            logger.error("Batch validation failed after retry: %s", errors)
            return {"asset_count": 0}

    # ── 7. Parse configs into dataclasses ───────────────────────────────
    parsed_configs: List[CreativeConfig] = []
    for i, cfg_dict in enumerate(raw_configs):
        try:
            parsed_configs.append(CreativeConfig.from_dict(cfg_dict))
        except ValueError as e:
            logger.warning("Config %d parse failed (skipping): %s", i, e)

    if not parsed_configs:
        logger.error("No configs parsed successfully — aborting")
        return {"asset_count": 0}

    # Build actor lookup for photo_url resolution
    actor_lookup: Dict[str, str] = {
        a["actor_id"]: a["photo_url"] for a in actors_with_photos
    }

    # ── 8. Render all creatives in parallel ─────────────────────────────
    render_tasks = []
    for config in parsed_configs:
        photo_url = actor_lookup.get(config.actor.actor_id, "")
        if not photo_url:
            logger.warning(
                "No photo URL for actor %s in config %s — skipping",
                config.actor.actor_id, config.layout,
            )
            continue
        render_tasks.append(_render_single(config, photo_url))

    if not render_tasks:
        logger.error("No renderable creatives — aborting")
        return {"asset_count": 0}

    rendered = await asyncio.gather(*render_tasks, return_exceptions=True)

    # Filter out exceptions
    valid_renders: List[Dict[str, Any]] = []
    for r in rendered:
        if isinstance(r, Exception):
            logger.warning("Render failed: %s", r)
        else:
            valid_renders.append(r)

    logger.info("Rendered %d / %d creatives", len(valid_renders), len(render_tasks))

    # ── 9. Tier 1 checks — filter out HTML failures ────────────────────
    tier1_passed: List[Dict[str, Any]] = []
    for render in valid_renders:
        result = run_tier1_checks(render["html"])
        if result["passed"]:
            tier1_passed.append(render)
        else:
            logger.warning(
                "Tier 1 failed for layout %s: %s",
                render["config"].layout,
                [iss["check"] for iss in result["issues"]],
            )

    if not tier1_passed:
        logger.error("All creatives failed Tier 1 checks — aborting")
        return {"asset_count": 0}

    logger.info("Tier 1: %d / %d passed", len(tier1_passed), len(valid_renders))

    # ── 10. Tier 2 batch VQA ────────────────────────────────────────────
    png_list = [r["png_bytes"] for r in tier1_passed]
    vqa_results = await run_tier2_batch_vqa(png_list)

    # Separate passed and failed
    final_creatives: List[Dict[str, Any]] = []
    vqa_failed: List[Dict[str, Any]] = []

    for render, vqa in zip(tier1_passed, vqa_results):
        render["vqa"] = vqa
        if vqa.get("passed", True):
            final_creatives.append(render)
        else:
            vqa_failed.append(render)

    logger.info(
        "Tier 2 VQA: %d passed, %d failed",
        len(final_creatives), len(vqa_failed),
    )

    # ── 11. Auto-fix VQA failures ───────────────────────────────────────
    for cycle in range(MAX_FIX_CYCLES):
        if not vqa_failed:
            break

        logger.info("Auto-fix cycle %d: fixing %d creatives", cycle + 1, len(vqa_failed))

        re_render_tasks = []
        for render in vqa_failed:
            issues = render["vqa"].get("issues", [])
            config_dict = _config_to_dict(render["config"])
            fixed_dict = apply_fixes(config_dict, issues)

            try:
                fixed_config = CreativeConfig.from_dict(fixed_dict)
            except ValueError as e:
                logger.warning("Fixed config invalid (skipping): %s", e)
                continue

            photo_url = render["photo_url"]
            re_render_tasks.append(_render_single(fixed_config, photo_url))

        if not re_render_tasks:
            break

        re_rendered = await asyncio.gather(*re_render_tasks, return_exceptions=True)
        valid_re_renders = [r for r in re_rendered if not isinstance(r, Exception)]

        # Re-run Tier 1
        tier1_re_passed = []
        for r in valid_re_renders:
            t1 = run_tier1_checks(r["html"])
            if t1["passed"]:
                tier1_re_passed.append(r)

        if not tier1_re_passed:
            break

        # Re-run Tier 2 VQA
        re_pngs = [r["png_bytes"] for r in tier1_re_passed]
        re_vqa = await run_tier2_batch_vqa(re_pngs)

        vqa_failed = []
        for r, vqa in zip(tier1_re_passed, re_vqa):
            r["vqa"] = vqa
            if vqa.get("passed", True):
                final_creatives.append(r)
            else:
                vqa_failed.append(r)

        logger.info("Auto-fix cycle %d: %d recovered", cycle + 1, len(tier1_re_passed) - len(vqa_failed))

    # ── 12. Save all final creatives to Blob + Neon ─────────────────────
    saved_count = 0
    for render in final_creatives:
        config: CreativeConfig = render["config"]
        html: str = render["html"]
        png_bytes: bytes = render["png_bytes"]

        filename = f"{request_id}_{config.actor.actor_id}_{config.layout}.png"

        try:
            blob_url = await upload_to_blob(
                png_bytes, filename, folder="generated/stage4", content_type="image/png",
            )
        except Exception as e:
            logger.warning("Blob upload failed for %s: %s", filename, e)
            continue

        asset_data: Dict[str, Any] = {
            "actor_id": config.actor.actor_id,
            "asset_type": "composed_creative",
            "platform": "universal",
            "format": "png",
            "language": language,
            "blob_url": blob_url,
            "stage": 4,
            "country": country,
            "metadata": {
                "actor_id": config.actor.actor_id,
                "engine": "design_agent",
                "layout": config.layout,
                "html": html,
                "vqa_score": 1.0,
                "vqa_dimensions": render.get("vqa", {}),
            },
        }

        try:
            asset_id = await save_asset(request_id, asset_data)
            saved_count += 1
            logger.info("Saved creative %s (layout=%s, blob=%s)", asset_id, config.layout, blob_url)
        except Exception as e:
            logger.warning("Neon save failed for %s: %s", filename, e)

    logger.info(
        "Stage 4 (design_agent) complete: %d creatives saved for request %s",
        saved_count, request_id,
    )
    return {"asset_count": saved_count}


# ---------------------------------------------------------------------------
# Internal utility
# ---------------------------------------------------------------------------


def _config_to_dict(config: CreativeConfig) -> Dict[str, Any]:
    """Convert a frozen CreativeConfig back to a mutable dict for auto-fix."""
    d: Dict[str, Any] = {
        "layout": config.layout,
        "background": {"type": config.background.type, "preset": config.background.preset},
        "actor": {
            "actor_id": config.actor.actor_id,
            "position": config.actor.position,
            "scale": config.actor.scale,
            "mask": config.actor.mask,
        },
        "overlay": {
            "elements": list(config.overlay.elements),
            "intensity": config.overlay.intensity,
        },
        "text": {
            "headline": config.text.headline,
            "subheadline": config.text.subheadline,
            "position": config.text.position,
            "size": config.text.size,
            "contrast_backdrop": config.text.contrast_backdrop,
        },
        "cta": {
            "text": config.cta.text,
            "style": config.cta.style,
            "position": config.cta.position,
        },
    }
    if config.context_element is not None:
        d["context_element"] = {
            "type": config.context_element.type,
            "position": config.context_element.position,
            "content": config.context_element.content,
        }
    else:
        d["context_element"] = None
    return d
