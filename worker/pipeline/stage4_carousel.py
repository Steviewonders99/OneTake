"""Carousel Pipeline — generates multi-slide carousels for LinkedIn, IG, TikTok.

Each platform gets a structurally different carousel:

LinkedIn (text-first, authority):
  - 1080x1080, 6-8 slides
  - Slide 1: hook (optional character photo), rest: text blocks, Lucide icons, stats
  - Professional, data-driven, thought-leadership PDF feel

Instagram (visual story):
  - 1080x1350 (4:5), 5-7 slides
  - Actor cutouts, depth layering, emotional arc
  - Hook → person → benefits → social proof → CTA

TikTok (polished-casual):
  - 1080x1920 (9:16), 5-8 slides
  - Bold text on solid colors, minimal design, actor photos on some slides
  - Meme-format hooks, "made on Canva" energy, NOT polished agency look
  - CRITICAL: bottom 400px is dead zone (caption/music bar)

All slides rendered via Playwright (same as Stage 4 single creatives).
Evaluation gate runs per-slide with adapted thresholds.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from ai.compositor import PLATFORM_SPECS, render_to_png
from ai.creative_vqa import check_deterministic
from blob_uploader import upload_to_blob
from neon_client import save_asset

logger = logging.getLogger(__name__)

# ── Carousel platform configs ──────────────────────────────────────

CAROUSEL_PLATFORMS = {
    "linkedin_carousel": {
        "slide_count": {"min": 6, "max": 8},
        "structure": [
            {"role": "hook", "has_photo": "optional", "description": "Bold claim, question, or provocative stat. Optional character photo. Must stop the scroll."},
            {"role": "problem", "has_photo": False, "description": "Pain point the audience feels. Lucide icon + bold text block. Dark text on light bg."},
            {"role": "solution", "has_photo": False, "description": "What OneForma offers. Icon + 2-3 bullet points. Purple accent block."},
            {"role": "how_it_works", "has_photo": False, "description": "3 numbered steps with Lucide icons. Clean layout, generous spacing."},
            {"role": "social_proof", "has_photo": False, "description": "Stat callout: '50K+ contributors', '100+ countries'. Large number + context line."},
            {"role": "benefit", "has_photo": False, "description": "Key differentiator. Icon + headline + 1-2 lines. Purple gradient accent."},
            {"role": "cta", "has_photo": False, "description": "Clear CTA button. 'Powered by Centific' trust badge. Professional close."},
        ],
    },
    "ig_carousel": {
        "slide_count": {"min": 5, "max": 7},
        "structure": [
            {"role": "hook", "has_photo": True, "description": "Actor cutout + scroll-stopping headline. Z-index depth with blobs behind person. Most important slide."},
            {"role": "person_story", "has_photo": True, "description": "Full actor photo with emotional overlay text. Show the lifestyle."},
            {"role": "benefit_1", "has_photo": True, "description": "Different actor/scene. Cutout with headline about key benefit. Depth layering."},
            {"role": "benefit_2", "has_photo": "optional", "description": "Second benefit. Can be text-focused with small photo or full visual."},
            {"role": "social_proof", "has_photo": False, "description": "Stat callout or testimonial style. Numbers + trust signals."},
            {"role": "cta", "has_photo": True, "description": "Actor photo + gradient CTA pill + urgency text. 'Limited spots' energy."},
        ],
    },
    "tiktok_carousel": {
        "slide_count": {"min": 5, "max": 8},
        "structure": [
            {"role": "hook", "has_photo": False, "description": "Bold text on solid color bg. Meme-format: 'POV: you just got paid $25/hr to talk into a mic'. Large sans-serif font. NO blobs, NO gradients."},
            {"role": "actor_reveal", "has_photo": True, "description": "Actor photo with minimal text overlay. 1-2 lines max. Keep text ABOVE the 400px bottom dead zone."},
            {"role": "point_1", "has_photo": False, "description": "Big bold text on solid color. One benefit. Maybe a simple icon. Different bg color from hook."},
            {"role": "point_2", "has_photo": False, "description": "Another benefit. Bold text. Different solid bg color. Keep it punchy — max 10 words."},
            {"role": "point_3", "has_photo": "optional", "description": "Third point or actor photo peek from side. Optional small photo with text."},
            {"role": "cta", "has_photo": False, "description": "Simple 'Link in bio' energy. Not over-designed. Solid bg + centered text + simple arrow."},
        ],
    },
    "wechat_carousel": {
        "slide_count": {"min": 3, "max": 6},
        "structure": [
            {"role": "hook", "has_photo": True, "description": "Actor photo as hero visual. MINIMAL text — 3-4 words max. WeChat enforces 20% text overlay limit per card. Clean, premium, let the image do the work."},
            {"role": "benefit", "has_photo": True, "description": "Different actor/angle. One short benefit headline (3-4 words). Purple accent element. Text must stay under 20% of card area."},
            {"role": "social_proof", "has_photo": False, "description": "Large stat number ('50K+') with minimal context line. Centific trust badge. Clean white/light bg. Text still under 20%."},
            {"role": "cta", "has_photo": True, "description": "Actor photo + tiny CTA pill. 2 words max on CTA. QR code optional (WeChat native behavior). Most of the card is visual."},
        ],
    },
}

# Lucide icons available for LinkedIn text slides (SVG paths)
LUCIDE_ICONS = {
    "globe": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    "dollar_sign": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    "clock": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    "users": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    "shield_check": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    "laptop": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>',
    "mic": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    "trending_up": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
}


async def run_carousel_stage(context: dict) -> dict:
    """Generate carousels for all carousel platforms.

    Plugs into the Stage 4 pipeline. Uses the same actors, brief,
    and copy data. Generates slides as individual PNGs, uploads to
    Blob, and saves carousel metadata to Neon.

    Parameters
    ----------
    context : dict
        Pipeline context with request_id, actors, brief, personas, etc.

    Returns
    -------
    dict
        carousel_count, slide_count, platforms generated.
    """
    request_id = context["request_id"]
    actors = context.get("actors", [])
    brief = context.get("brief", {})
    personas = context.get("personas", brief.get("personas", []))

    # Determine which carousel platforms to generate based on channel strategy
    brief_channels = brief.get("channels", {})
    primary = brief_channels.get("primary", [])
    secondary = brief_channels.get("secondary", [])
    all_channels = [ch.lower().strip() for ch in primary + secondary]

    # Map channel names to carousel platform keys
    CAROUSEL_CHANNEL_MAP = {
        "linkedin": "linkedin_carousel",
        "instagram": "ig_carousel", "ig": "ig_carousel",
        "tiktok": "tiktok_carousel",
        "wechat": "wechat_carousel", "wechat moments": "wechat_carousel",
    }

    # Filter carousel platforms to only those in the channel strategy
    if all_channels:
        active_carousels = set()
        for ch in all_channels:
            for trigger, platform_key in CAROUSEL_CHANNEL_MAP.items():
                if trigger in ch:
                    active_carousels.add(platform_key)
        if not active_carousels:
            logger.info("No carousel platforms in channel strategy — skipping carousel generation")
            return {"carousel_count": 0, "slide_count": 0}
        logger.info("Carousel platforms from channel strategy: %s", sorted(active_carousels))
    else:
        # No channel strategy — generate all carousel platforms
        active_carousels = set(CAROUSEL_PLATFORMS.keys())

    total_carousels = 0
    total_slides = 0

    for platform_key, config in CAROUSEL_PLATFORMS.items():
        if platform_key not in active_carousels:
            continue
        spec = PLATFORM_SPECS.get(platform_key)
        if not spec:
            logger.warning("No spec for carousel platform %s — skipping", platform_key)
            continue

        logger.info(
            "Generating %s carousel (%dx%d, %d-%d slides)",
            platform_key, spec["width"], spec["height"],
            config["slide_count"]["min"], config["slide_count"]["max"],
        )

        try:
            slides = await _generate_carousel(
                platform_key=platform_key,
                config=config,
                spec=spec,
                actors=actors,
                brief=brief,
                personas=personas,
                request_id=request_id,
            )

            if slides:
                total_carousels += 1
                total_slides += len(slides)
                logger.info(
                    "%s carousel complete: %d slides",
                    platform_key, len(slides),
                )

        except Exception as e:
            logger.error("Carousel generation failed for %s: %s", platform_key, e)

    return {
        "carousel_count": total_carousels,
        "slide_count": total_slides,
    }


async def _generate_carousel(
    *,
    platform_key: str,
    config: dict,
    spec: dict,
    actors: list[dict],
    brief: dict,
    personas: list[dict],
    request_id: str,
) -> list[dict]:
    """Generate all slides for one carousel platform.

    1. Build the slide structure prompt with per-slide roles
    2. Call LLM to generate HTML for each slide
    3. Render each slide via Playwright
    4. Run deterministic checks per slide
    5. Upload to Blob + save to Neon
    """
    from ai.creative_designer import design_creatives

    w, h = spec["width"], spec["height"]
    structure = config["structure"]
    content_style = spec.get("content_style", "visual_story")

    # Build safe zone info for the LLM
    safe_zones = _build_safe_zone_instructions(spec)

    # Build the carousel-specific system prompt addition
    carousel_instructions = _build_carousel_prompt(
        platform_key=platform_key,
        structure=structure,
        spec=spec,
        safe_zones=safe_zones,
        content_style=content_style,
    )

    # Inject Lucide icon SVGs for LinkedIn text slides
    if "linkedin" in platform_key:
        icon_block = "\n\nAVAILABLE LUCIDE ICONS (copy-paste these inline SVGs into your HTML):\n"
        for name, svg in LUCIDE_ICONS.items():
            icon_block += f"  {name}: {svg}\n"
        icon_block += "\nWrap each icon in a purple circle: <div style='width:56px;height:56px;border-radius:50%;background:#F3E5F5;display:flex;align-items:center;justify-content:center;flex-shrink:0;'>{icon_svg}</div>\n"
        carousel_instructions += icon_block

    # Build actor context — limit to 1 actor for carousels (keeps prompt lean)
    # Carousel text slides don't use photos; only hook/reveal slides need 1 actor
    actor_context = []
    if actors:
        a = actors[0]
        # Only include first scene to keep prompt small
        images = a.get("images", {})
        first_scene = {}
        if images:
            first_key = next(iter(images))
            first_scene = {first_key: images[first_key]}
        actor_context.append({
            "name": a.get("name", "Contributor"),
            "images": first_scene,
            "region": a.get("region", "Global"),
        })

    # Build persona (use first available)
    persona = personas[0] if personas else {"archetype_key": "contributor"}

    # Call the LLM with carousel-specific instructions
    # We request all slides in one call for narrative coherence
    from neon_client import get_assets
    copy_assets = await get_assets(request_id, asset_type="copy")
    platform_copy = {}
    if copy_assets:
        platform_copy = copy_assets[0].get("metadata", {})

    slides_html = await design_creatives(
        persona=persona,
        actors=actor_context,
        platform=platform_key,
        platform_spec=spec,
        brief=brief,
        platform_copy=platform_copy,
        carousel_instructions=carousel_instructions,
    )

    if not slides_html:
        logger.warning("No carousel slides returned for %s", platform_key)
        return []

    # Render + evaluate + upload each slide
    saved_slides = []
    for slide_idx, slide in enumerate(slides_html):
        html = slide.get("html", "")
        if not html:
            continue

        try:
            # Render via Playwright
            slide_png = await render_to_png(html, w, h)

            # Quick deterministic check (skip VLM for slides — too expensive)
            check = check_deterministic(slide, slide_png, spec)
            if not check["passed"]:
                logger.warning(
                    "  Slide %d/%d failed checks: %s",
                    slide_idx + 1, len(slides_html),
                    "; ".join(check["issues"][:2]),
                )
                # Still save — flag in metadata for review

            # Upload
            uid = uuid.uuid4().hex[:8]
            filename = f"carousel_{platform_key}_slide{slide_idx + 1:02d}_{uid}.png"
            blob_url = await upload_to_blob(
                slide_png,
                filename,
                folder=f"requests/{request_id}/carousels/{platform_key}",
                content_type="image/png",
            )

            # Save to Neon
            # Get persona key from context
            _persona_key = persona.get("archetype_key", persona.get("persona_key", "unassigned"))

            slide_meta = {
                "platform": platform_key,
                "slide_index": slide_idx + 1,
                "slide_role": slide.get("role", structure[slide_idx]["role"] if slide_idx < len(structure) else "extra"),
                "slide_headline": slide.get("overlay_headline", ""),
                "slide_body": slide.get("overlay_sub", ""),
                "has_photo": slide.get("has_photo", False),
                "actor_name": slide.get("actor_name", ""),
                "deterministic_passed": check["passed"],
                "carousel_total_slides": len(slides_html),
                "persona": _persona_key,
            }

            await save_asset(request_id, {
                "asset_type": "carousel_panel",
                "platform": platform_key,
                "format": f"{w}x{h}",
                "blob_url": blob_url,
                "metadata": slide_meta,
                "stage": 4,
            })

            saved_slides.append({"blob_url": blob_url, **slide_meta})
            logger.info(
                "  Slide %d/%d saved: %s (%s)",
                slide_idx + 1, len(slides_html),
                slide_meta["slide_role"], blob_url,
            )

        except Exception as e:
            logger.error("  Slide %d render/upload failed: %s", slide_idx + 1, e)

    return saved_slides


def _build_safe_zone_instructions(spec: dict) -> str:
    """Build human-readable safe zone description from spec."""
    # Check for per-side safe zones
    if "safe_top" in spec:
        return (
            f"SAFE ZONES (pixels from edge where platform UI covers content):\n"
            f"  Top: {spec['safe_top']}px (status bar, navigation)\n"
            f"  Right: {spec['safe_right']}px (action buttons on TikTok)\n"
            f"  Bottom: {spec['safe_bottom']}px (caption, dots, music bar)\n"
            f"  Left: {spec['safe_left']}px (minimal overlay)\n"
            f"  ALL text and important elements MUST be inside these margins."
        )
    else:
        m = spec.get("safe_margin", 60)
        return f"SAFE ZONE: {m}px from all edges. ALL text must be inside this margin."


def _build_carousel_prompt(
    *,
    platform_key: str,
    structure: list[dict],
    spec: dict,
    safe_zones: str,
    content_style: str,
) -> str:
    """Build carousel-specific instructions appended to the design prompt."""
    w, h = spec["width"], spec["height"]

    slide_descriptions = []
    for i, slide in enumerate(structure):
        photo_note = ""
        if slide["has_photo"] is True:
            photo_note = " [USE ACTOR PHOTO]"
        elif slide["has_photo"] == "optional":
            photo_note = " [ACTOR PHOTO OPTIONAL]"
        else:
            photo_note = " [TEXT ONLY — NO actor photo]"

        slide_descriptions.append(
            f"  Slide {i + 1} ({slide['role']}){photo_note}:\n"
            f"    {slide['description']}"
        )

    slides_text = "\n".join(slide_descriptions)

    # Platform-specific design rules
    platform_rules = {
        "linkedin_carousel": (
            "LINKEDIN CAROUSEL RULES:\n"
            "- This is a PDF-style document carousel, NOT a flashy ad.\n"
            "- Slides 2+ are TEXT ONLY. No actor photos. Use Lucide icon SVGs for visual interest.\n"
            "- Professional, clean, authoritative. Think McKinsey report meets Medium article.\n"
            "- White or very light gray backgrounds. Dark text (#1A1A1A).\n"
            "- Purple accent blocks and divider lines for visual structure.\n"
            "- Large clear typography. One idea per slide.\n"
            "- Page number in bottom right corner of each slide (e.g., '3/7').\n"
            "- First slide can optionally include a character photo — rest MUST be text/icon only.\n"
            "- Use inline SVG icons from the Lucide set for visual anchors on EVERY text slide.\n"
            "\n"
            "VERTICAL SPACE RULES (CRITICAL — slides look empty without this):\n"
            "- Content must fill at LEAST 70% of the vertical canvas height.\n"
            "- Use display:flex; flex-direction:column; justify-content:center; min-height:100% on the body.\n"
            "- For numbered lists (how-it-works): space items evenly across the full height with gap:48px.\n"
            "- For stat slides: center the number vertically AND add a supporting element below (accent line, context text, trust badge).\n"
            "- The bottom 20% of each slide should have SOMETHING — a decorative element, page number, accent line, or trust badge.\n"
            "- NEVER leave the bottom half of a slide completely empty.\n"
            "\n"
            "ICON USAGE (MANDATORY on text-only slides):\n"
            "- Every bullet point or numbered step MUST have an inline SVG Lucide icon (48x48px) to the left.\n"
            "- Icons use stroke='#6B21A8' (purple) for brand consistency.\n"
            "- Available icons: globe, dollar_sign, clock, users, shield_check, laptop, mic, trending_up.\n"
            "- Place icons in a purple circle background (48px, border-radius:50%, bg:#F3E5F5) for depth.\n"
        ),
        "ig_carousel": (
            "INSTAGRAM CAROUSEL RULES:\n"
            "- Visual story arc — each slide reveals the next chapter.\n"
            "- Actor cutouts with z-index depth layering (blobs behind, text in front).\n"
            "- Swipe cue on slides 1-5: subtle arrow or 'Swipe →' indicator near right edge.\n"
            "- Bold emotional headlines. 4:5 ratio gives premium vertical real estate.\n"
            "- Purple/pink brand palette. Organic blob shapes. OneForma visual identity.\n"
            "- Each slide must be compelling standalone (people skip around).\n"
            "- Bottom 130px is danger zone (dots + caption preview).\n"
            "\n"
            "VERTICAL SPACE (CRITICAL):\n"
            "- Content must fill at LEAST 70% of the 1350px height.\n"
            "- Use display:flex; flex-direction:column; justify-content:space-between on the body.\n"
            "- Photo slides: photo fills top 60%, text zone fills bottom 40%.\n"
            "- Text slides: center content vertically with generous top/bottom padding.\n"
            "- NEVER leave the bottom 40% of a slide empty.\n"
        ),
        "tiktok_carousel": (
            "TIKTOK CAROUSEL RULES — CRITICAL READ:\n"
            "- Polished-casual aesthetic. Looks like a smart 22-year-old made it on Canva.\n"
            "- NOT agency-polished. NO blobs. NO gradients. NO depth layering.\n"
            "- Solid color backgrounds (purple, pink, white, dark gray). ONE color per slide.\n"
            "  VARY the background color between slides for visual variety.\n"
            "- MASSIVE text. The text IS the content. 56-80px font minimum.\n"
            "- Maximum 10 words per slide. Preferably 3-7.\n"
            "- Hook slide = meme format: 'POV:', 'Nobody:', 'Things I wish I knew:', etc.\n"
            "\n"
            "TEXT POSITIONING (CRITICAL — TikTok dead zones):\n"
            "- BOTTOM 400px IS DEAD ZONE — caption, music bar, nav cover this area.\n"
            "- RIGHT 164px has action buttons (like/comment/share).\n"
            "- ALL text must be positioned in the TOP-CENTER of the slide.\n"
            "- Use: position:absolute; top:25%; left:60px; right:180px; to center text in safe area.\n"
            "- Or use: display:flex; align-items:center; justify-content:center; padding-top:150px; padding-bottom:500px;\n"
            "  This pushes content UP and away from the dead zone.\n"
            "- NEVER use vertical centering (top:50%) — this puts text in the dead zone.\n"
            "- Actor photos: show on 1-2 slides max, positioned in UPPER 60% of canvas.\n"
        ),
        "wechat_carousel": (
            "WECHAT MOMENTS CAROUSEL RULES — CRITICAL:\n"
            "- WeChat enforces a STRICT 20% TEXT OVERLAY LIMIT per card.\n"
            "  If text covers more than 20% of the 1080x1080 card area, the ad gets rejected.\n"
            "  That means: ~233,280 pixels of text max out of 1,166,400 total.\n"
            "- This means VISUAL-FIRST design. The image does the heavy lifting.\n"
            "- Headline: 3-4 words MAX. Subheadline: NONE (use empty string).\n"
            "- CTA: 2 words MAX. Small pill button, not a banner.\n"
            "- Actor photos are the primary content. Text is an accent.\n"
            "- Clean, premium, aspirational. Think luxury brand ad, not performance ad.\n"
            "- White or very light backgrounds. Purple accent MINIMAL.\n"
            "- 3-6 cards only (WeChat carousel limit).\n"
            "- Each card should be compelling standalone — users don't always swipe.\n"
            "- NO cluttered text. NO stat callouts. NO trust badges on every card.\n"
            "- Safe margin: 108px (10%) from all edges for device clipping.\n"
        ),
    }

    num_slides = len(structure)

    return (
        f"\n\n=== CAROUSEL MODE ===\n"
        f"You are generating a MULTI-SLIDE CAROUSEL with EXACTLY {num_slides} slides.\n"
        f"Platform: {platform_key} ({w}x{h}px per slide)\n"
        f"Content style: {content_style}\n\n"
        f"{safe_zones}\n\n"
        f"{platform_rules.get(platform_key, '')}\n"
        f"SLIDE STRUCTURE — YOU MUST GENERATE ALL {num_slides} SLIDES:\n"
        f"{slides_text}\n\n"
        f"MANDATORY: Return a JSON array with EXACTLY {num_slides} objects.\n"
        f"Each object MUST have these fields:\n"
        f"  - role: string (matches the slide role above)\n"
        f"  - overlay_headline: string (the main text for this slide)\n"
        f"  - overlay_sub: string (supporting text, can be empty)\n"
        f"  - overlay_cta: string (CTA text, only on CTA slide)\n"
        f"  - has_photo: boolean (true if this slide uses an actor photo)\n"
        f"  - actor_name: string (actor name if photo used, empty otherwise)\n"
        f"  - html: string (complete HTML document for this slide)\n\n"
        f"CRITICAL RULES:\n"
        f"- You MUST return EXACTLY {num_slides} slide objects in the JSON array.\n"
        f"- Each slide is a SEPARATE self-contained HTML document ({w}x{h}px).\n"
        f"- The slides tell a coherent story: {' → '.join(s['role'] for s in structure)}.\n"
        f"- DO NOT return fewer slides. DO NOT skip any slide.\n"
        f"- DO NOT return just 1 slide. You MUST return all {num_slides}.\n"
    )
