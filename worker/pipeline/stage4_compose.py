"""Stage 4: Layout Composition — the money stage.

Takes good AI photos and turns them into HIGH CTR, high engagement
works of art. Each actor x platform x hook combination gets a
UNIQUE layout (not a crop — a full reflow for the aspect ratio).

Pipeline:
  1. Load actors + images + copy from Neon
  2. For each actor:
     a. For each platform (7-10 native dimensions):
        - Select template (deterministic, LLM override wired in)
        - Build HTML/CSS overlay on UGC base image (full reflow)
        - Render via Playwright → PNG (Remotion MP4 wired for future)
        - Upload to Vercel Blob
        - Save as composed_creative asset in Neon
  3. Track total asset count for notification

Hook variant matrix: each creative can be generated in multiple
hook variants (earnings, identity, curiosity, social_proof, etc.)
Let the data decide which performs best — we don't lock into money hook.
"""
from __future__ import annotations

import json
import logging
import uuid

from ai.compositor import (
    PLATFORM_SPECS,
    compose_creative,
    select_template,
)
from blob_uploader import upload_to_blob
from neon_client import get_actors, get_assets, save_asset

logger = logging.getLogger(__name__)

# Platforms to compose for (subset for MVP — can expand)
DEFAULT_PLATFORMS = [
    "ig_feed",         # 1080x1080 (square)
    "ig_story",        # 1080x1920 (vertical)
    "linkedin_feed",   # 1200x627 (landscape)
    "facebook_feed",   # 1200x628 (landscape)
    "telegram_card",   # 1280x720 (landscape)
]

# Hook variants to generate per creative (subset for MVP)
# Don't lock to money hook — generate multiple, let data decide
DEFAULT_HOOKS = ["earnings", "identity", "effort_min"]


async def run_stage4(context: dict) -> dict:
    """Compose final creatives for every actor x platform x hook combination.

    Full reflow per platform — NOT cropping. Each platform gets a
    completely different layout built for its native aspect ratio.
    """
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})
    personas: list = context.get("personas", [])

    # Load actors and assets from Neon
    actors = await get_actors(request_id)
    image_assets = await get_assets(request_id, asset_type="base_image")
    copy_assets = await get_assets(request_id, asset_type="copy")

    if not actors:
        logger.warning("No actors found for request %s — skipping composition", request_id)
        return {"asset_count": 0}

    # Build lookup: actor_id → best image URL (highest VQA score)
    actor_images: dict[str, str] = {}
    for asset in image_assets:
        aid = str(asset.get("actor_id", ""))
        url = asset.get("blob_url", "")
        score = asset.get("evaluation_score", 0) or 0
        if aid and url:
            existing_score = actor_images.get(f"{aid}_score", 0)
            if score >= existing_score:
                actor_images[aid] = url
                actor_images[f"{aid}_score"] = score

    # Build lookup: platform → Stage 3 copy data (for ad manager text fields)
    # This is the PLATFORM copy, not the creative overlay copy
    channel_copy: dict[str, dict] = {}
    for asset in copy_assets:
        platform = asset.get("platform", "")
        # Try content column first (JSONB), then copy_data
        raw = asset.get("content") or asset.get("copy_data") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                raw = {}
        if isinstance(raw, dict) and raw:
            # content may wrap copy_data inside it
            channel_copy[platform] = raw.get("copy_data", raw)

    # Determine platforms
    format_matrix = design.get("format_matrix", {})
    platforms = list(format_matrix.keys()) if format_matrix else DEFAULT_PLATFORMS

    # Hook variants = SHORT creative overlay copy (burned into image)
    # These are DIFFERENT from Stage 3 platform copy (text fields in ad manager).
    # Creative overlay: 3-7 words, scroll-stopping, minimal
    # Platform copy: 50-500 chars, persuasive, detailed
    # They COMPLEMENT each other but never duplicate.
    hooks = DEFAULT_HOOKS

    # Build short punchy overlay copy per hook type (from brief data)
    overlay_copy = _build_overlay_copy(brief, personas)

    asset_count = 0
    variant_idx = 0  # Rotates templates for visual variety

    for actor in actors:
        actor_id = str(actor.get("id", ""))
        actor_name = actor.get("name", "Contributor")
        hero_url = actor_images.get(actor_id, "")

        if not hero_url:
            logger.warning("No image for actor %s — skipping", actor_name)
            continue

        logger.info("Composing creatives for actor '%s' (%d platforms x %d hooks)",
                     actor_name, len(platforms), len(hooks))

        for platform in platforms:
            spec = PLATFORM_SPECS.get(platform)
            if not spec:
                continue

            # Get copy for this platform (or nearest match)
            copy_data = _find_copy(channel_copy, platform)

            for hook_type in hooks:
                # Select template (deterministic by default, LLM wired in)
                template = await select_template(
                    platform=platform,
                    copy=copy_data,
                    hook_type=hook_type,
                    variant_index=variant_idx,
                    use_llm=False,  # Flip to True when ready for LLM intelligence
                    actor_data=actor,
                    brief=brief,
                )

                # Creative overlay copy (SHORT — burned into image)
                # This is NOT the platform ad copy from Stage 3.
                # Overlay = 3-7 word scroll-stopper on the creative
                # Platform copy = detailed text in ad manager fields
                ov = overlay_copy.get(hook_type, overlay_copy.get("earnings", {}))
                headline = ov.get("headline", "Join OneForma")
                subheadline = ov.get("sub", "")
                cta_text = ov.get("cta", "Apply Now")

                # Compose props — full reflow for this platform's dimensions
                props = {
                    "platform": platform,
                    "template": template,
                    "hero_image_url": hero_url,
                    "headline": headline,
                    "subheadline": subheadline,
                    "cta_text": cta_text,
                    "hook_type": hook_type,
                    "actor_name": actor_name,
                    "actor_region": actor.get("region", ""),
                    "gradient_opacity": 0.65,
                    "proof_badge": "Powered by Centific",
                    "metric_claim": "",
                    "logo_url": "",  # OneForma logo URL
                }

                # Add metric for social proof hook
                if hook_type == "social_proof":
                    props["metric_claim"] = "50,000+ contributors worldwide"

                logger.info(
                    "  %s / %s / %s → template=%s (%dx%d)",
                    actor_name, platform, hook_type, template,
                    spec["width"], spec["height"],
                )

                try:
                    png_bytes = await compose_creative(props)

                    # Upload to Vercel Blob
                    filename = f"creative_{platform}_{hook_type}_{uuid.uuid4().hex[:8]}.png"
                    blob_url = await upload_to_blob(
                        png_bytes, filename,
                        folder=f"requests/{request_id}/composed",
                    )

                    # Save to Neon — track BOTH overlay and platform copy
                    await save_asset(request_id, {
                        "asset_type": "composed_creative",
                        "platform": platform,
                        "format": f"{spec['width']}x{spec['height']}",
                        "language": copy_data.get("language", ""),
                        "blob_url": blob_url,
                        "metadata": {
                            "actor_id": actor_id,
                            "actor_name": actor_name,
                            "template": template,
                            "hook_type": hook_type,
                            # Overlay copy (burned into image)
                            "overlay_headline": headline,
                            "overlay_sub": subheadline,
                            "overlay_cta": cta_text,
                            # Platform copy reference (for ad manager text fields)
                            "platform_headline": copy_data.get("headline", ""),
                            "platform_description": copy_data.get("description", copy_data.get("primary_text", "")),
                        },
                        "stage": 4,
                    })
                    asset_count += 1

                except Exception as e:
                    logger.error(
                        "  FAILED: %s/%s/%s — %s", actor_name, platform, hook_type, e,
                    )
                    # Continue with next variant, don't crash entire stage
                    continue

                variant_idx += 1

    logger.info("Stage 4 complete: %d composed creatives", asset_count)
    return {"asset_count": asset_count}


# ── Creative overlay copy builder ────────────────────────────────
# These are SHORT scroll-stopping phrases for the image overlay.
# NOT the platform ad copy (Stage 3) — that goes in ad manager text fields.
# Overlay: 3-7 words. Clean. Minimal. Scroll-stopping.

def _build_overlay_copy(brief: dict, personas: list) -> dict[str, dict]:
    """Build SHORT overlay copy per hook type from brief data.

    Pulls real data from the brief — rates, task types, contributor counts.
    Each hook is a different psychological angle on the SAME campaign.

    Returns dict: hook_type → {headline, sub, cta}
    """
    # Extract real data from brief (not hardcoded)
    comp = brief.get("compensation", {})
    rate = comp.get("rate", "") or comp.get("hourly_rate", "")
    task = brief.get("task_type", "")
    task_short = task.split("_")[0].title() if task else "AI Tasks"
    objective = brief.get("campaign_objective", "")

    # Pull persona hooks if available
    persona_hooks: list[str] = []
    for p in (personas or []):
        hooks = p.get("psychology_hooks", p.get("trigger_words", []))
        if isinstance(hooks, list):
            persona_hooks.extend(hooks[:2])
        elif isinstance(hooks, dict):
            persona_hooks.extend(list(hooks.values())[:2])

    return {
        "earnings": {
            "headline": f"Earn {rate} From Home" if rate else "Earn From Home",
            "sub": "Flexible hours. Weekly pay.",
            "cta": "Start Earning",
        },
        "identity": {
            "headline": "Your Language.\nAI's Future.",
            "sub": "",  # Clean — let the image breathe
            "cta": "Join Now",
        },
        "curiosity": {
            "headline": "What If Your\nKnowledge Paid?",
            "sub": "",
            "cta": "Find Out",
        },
        "social_proof": {
            "headline": "50,000+",
            "sub": "contributors in 40 countries",
            "cta": "Join Them",
        },
        "effort_min": {
            "headline": f"Simple {task_short}.\nReal Pay.",
            "sub": "No experience needed.",
            "cta": "Apply Now",
        },
        "loss_aversion": {
            "headline": "Spots Filling Fast.",
            "sub": "Limited positions available.",
            "cta": "Apply Today",
        },
    }


def _find_copy(channel_copy: dict, platform: str) -> dict:
    """Find copy data for a platform, with fuzzy matching."""
    if platform in channel_copy:
        return channel_copy[platform]

    # Fuzzy: ig_feed → facebook_feed, telegram_card → linkedin_feed
    fallback_map = {
        "ig_feed": ["facebook_feed", "linkedin_feed"],
        "ig_story": ["tiktok_feed", "whatsapp_story"],
        "tiktok_feed": ["ig_story", "facebook_feed"],
        "telegram_card": ["linkedin_feed", "facebook_feed"],
        "twitter_post": ["linkedin_feed", "facebook_feed"],
        "indeed_banner": ["google_display", "linkedin_feed"],
        "whatsapp_story": ["ig_story", "tiktok_feed"],
    }
    for fallback in fallback_map.get(platform, []):
        if fallback in channel_copy:
            return channel_copy[fallback]

    # Last resort: return first available copy
    if channel_copy:
        return next(iter(channel_copy.values()))

    return {}
