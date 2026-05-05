"""Stage 4 Organic: Compose social graphics and flyers with QR codes.

Produces layered HTML compositions (same engine as paid carousel panels)
for social media posts and print flyers. Flyers include auto-generated
QR codes linking to Aidaform (with UTM) or job posting page.

All outputs are saved as design_artifacts for designer portal + Figma export.
"""
from __future__ import annotations

import json
import logging
import asyncio

from ai.nim_client import generate_text
from neon_client import (
    get_actors,
    get_intake_request,
    save_generated_asset,
    get_generated_assets,
)
from config import COMPOSE_CONCURRENCY

logger = logging.getLogger(__name__)

ORGANIC_SOCIAL_PLATFORMS = [
    {"name": "linkedin_feed", "width": 1200, "height": 627},
    {"name": "ig_feed", "width": 1080, "height": 1080},
    {"name": "ig_story", "width": 1080, "height": 1920},
    {"name": "facebook_feed", "width": 1200, "height": 630},
]

FLYER_FORMAT = {"name": "flyer_a4", "width": 2480, "height": 3508}

COMPOSE_SYSTEM = """You are a senior graphic designer creating layered HTML compositions for recruitment marketing.
Output ONLY valid HTML that uses inline styles. The HTML will be rendered as a static image.
Use modern design principles: strong typography hierarchy, generous whitespace, brand colors.
OneForma brand: gradient accent (blue #0693E3 to purple #9B51E0), dark text on light backgrounds.
All text must be real content from the provided copy — never use placeholder text."""


async def run_stage4_organic(context: dict) -> dict:
    """Generate organic social graphics and flyers with QR codes."""
    request_id: str = context["request_id"]
    request = await get_intake_request(request_id)
    form_data = context.get("form_data", request.get("form_data", {}))
    country = context.get("country", "")
    target_regions = context.get("target_regions", [])
    if country:
        target_regions = [country]

    actors = context.get("actors", [])
    if not actors:
        actors = await get_actors(request_id)
        context["actors"] = actors

    all_assets = await get_generated_assets(request_id)
    social_captions = [a for a in all_assets if a.get("asset_type") == "social_caption"]
    flyer_copies = [a for a in all_assets if a.get("asset_type") == "flyer_copy"]

    design_direction = context.get("design_direction", {})
    brief = context.get("brief", {})

    semaphore = asyncio.Semaphore(COMPOSE_CONCURRENCY)
    tasks = []

    for actor in actors[:3]:
        for platform_spec in ORGANIC_SOCIAL_PLATFORMS:
            caption_asset = _find_caption(social_captions, platform_spec["name"], country)
            tasks.append(_compose_social_graphic(
                semaphore, request_id, actor, platform_spec,
                caption_asset, design_direction, brief, form_data
            ))

    for actor in actors[:2]:
        for region in target_regions:
            flyer_copy = _find_flyer_copy(flyer_copies, region)
            tasks.append(_compose_flyer(
                semaphore, request_id, actor, flyer_copy,
                design_direction, brief, form_data, region
            ))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    asset_count = sum(1 for r in results if isinstance(r, int) and r > 0)

    logger.info("Stage 4 Organic complete: %d compositions generated", asset_count)
    return {"asset_count": asset_count}


async def _compose_social_graphic(
    semaphore: asyncio.Semaphore,
    request_id: str,
    actor: dict,
    platform_spec: dict,
    caption_asset: dict | None,
    design_direction: dict,
    brief: dict,
    form_data: dict,
) -> int:
    """Compose a single social graphic via GLM-5."""
    async with semaphore:
        platform_name = platform_spec["name"]
        width = platform_spec["width"]
        height = platform_spec["height"]

        actor_name = actor.get("persona_label", "Unknown")
        actor_photo = actor.get("photo_url") or actor.get("blob_url", "")

        caption_text = ""
        if caption_asset and caption_asset.get("content"):
            content = caption_asset["content"]
            if isinstance(content, str):
                content = json.loads(content)
            caption_text = content.get("caption", "")

        prompt = f"""Create an HTML composition for an organic social media post.

PLATFORM: {platform_name} ({width}x{height}px)
ACTOR PHOTO URL: {actor_photo}
ACTOR PERSONA: {actor_name}
CAPTION PREVIEW: {caption_text[:200]}
JOB TITLE: {form_data.get('title', brief.get('campaign_objective', 'Join Our Team'))}
DESIGN DIRECTION: {design_direction.get('visual_world', 'Modern, clean, professional')}

Requirements:
- Dimensions: {width}x{height}px (set on root element)
- Include actor photo as a prominent visual element (use img tag with src)
- Overlay key text from the caption (headline or hook only, not full caption)
- OneForma brand gradient accent
- Must be visually complete — no placeholder images or text
- Include subtle OneForma logo text in corner

Output ONLY the HTML (no markdown fences, no explanation)."""

        try:
            html_result = await generate_text(COMPOSE_SYSTEM, prompt, model="glm5")

            await save_generated_asset(
                request_id=request_id,
                asset_type="social_graphic",
                platform=platform_name,
                format="html",
                language="en",
                country=caption_asset.get("country", "") if caption_asset else "",
                content={"html": html_result, "width": width, "height": height},
                copy_data={"actor_id": actor.get("id"), "persona": actor_name},
                stage=4,
            )
            return 1
        except Exception as e:
            logger.warning("Social graphic failed for %s/%s: %s", actor_name, platform_name, e)
            return 0


async def _compose_flyer(
    semaphore: asyncio.Semaphore,
    request_id: str,
    actor: dict,
    flyer_copy: dict | None,
    design_direction: dict,
    brief: dict,
    form_data: dict,
    region: str,
) -> int:
    """Compose a flyer with QR code via GLM-5."""
    async with semaphore:
        from utils.qr_generator import generate_qr_code, resolve_qr_destination, build_tracked_url

        actor_name = actor.get("persona_label", "Unknown")
        actor_photo = actor.get("photo_url") or actor.get("blob_url", "")
        campaign_slug = form_data.get("campaign_slug", request_id[:8])

        destination = resolve_qr_destination(form_data, region)
        tracked_url = build_tracked_url(destination, campaign_slug, region)
        qr_data_uri = generate_qr_code(tracked_url, size=200)

        copy_content = {}
        if flyer_copy and flyer_copy.get("content"):
            copy_content = flyer_copy["content"]
            if isinstance(copy_content, str):
                copy_content = json.loads(copy_content)

        headline = copy_content.get("headline", "Join Our Global Team")
        subheadline = copy_content.get("subheadline", "")
        body = copy_content.get("body", "")
        cta = copy_content.get("cta", "Scan to Apply")
        qr_label = copy_content.get("qr_label", "Scan for details")

        prompt = f"""Create an HTML composition for a print recruitment flyer (A4 size).

DIMENSIONS: 2480x3508px (A4 at 300dpi)
ACTOR PHOTO URL: {actor_photo}
QR CODE IMAGE: {qr_data_uri[:100]}... (base64 data URI)

COPY:
- Headline: {headline}
- Subheadline: {subheadline}
- Body: {body}
- CTA: {cta}
- QR Label: {qr_label}

DESIGN DIRECTION: {design_direction.get('visual_world', 'Modern, clean, professional')}

Requirements:
- Root element: 2480x3508px
- Hero section with actor photo (top 40%)
- Copy section in middle (headline large, body readable)
- QR code section at bottom (embed the QR as an img tag with the data URI src)
- Text below QR: "{qr_label}"
- OneForma branding: gradient accent bar, logo text
- Print-ready: high contrast, no thin fonts, clear hierarchy
- MUST include the QR code img element

Output ONLY the HTML."""

        try:
            html_result = await generate_text(COMPOSE_SYSTEM, prompt, model="glm5")

            await save_generated_asset(
                request_id=request_id,
                asset_type="flyer",
                platform="print",
                format="html",
                language=_get_language_for_region(region),
                country=region,
                content={
                    "html": html_result,
                    "width": 2480,
                    "height": 3508,
                    "qr_url": tracked_url,
                    "qr_destination": destination,
                },
                copy_data={
                    "actor_id": actor.get("id"),
                    "persona": actor_name,
                    "headline": headline,
                    "cta": cta,
                },
                stage=4,
            )
            return 1
        except Exception as e:
            logger.warning("Flyer composition failed for %s/%s: %s", actor_name, region, e)
            return 0


def _find_caption(captions: list, platform_name: str, country: str) -> dict | None:
    """Find a matching social caption asset."""
    platform_map = {
        "linkedin_feed": "linkedin",
        "ig_feed": "instagram",
        "ig_story": "instagram",
        "facebook_feed": "facebook",
    }
    target = platform_map.get(platform_name, platform_name)

    for c in captions:
        if c.get("platform") == target:
            if not country or c.get("country") == country:
                return c
    for c in captions:
        if c.get("platform") == target:
            return c
    return None


def _find_flyer_copy(copies: list, region: str) -> dict | None:
    """Find flyer copy for a specific region."""
    for c in copies:
        if c.get("country") == region:
            return c
    return copies[0] if copies else None


def _get_language_for_region(region: str) -> str:
    """Map region to language code."""
    REGION_LANGUAGES = {
        "BR": "pt", "MX": "es", "ES": "es", "JP": "ja", "KR": "ko",
        "DE": "de", "FR": "fr", "IN": "en", "PH": "en",
    }
    return REGION_LANGUAGES.get(region.upper(), "en")
