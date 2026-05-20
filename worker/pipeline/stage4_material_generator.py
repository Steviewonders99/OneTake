"""Stage 4: Material Generator — base images (3 ratios) + HTML asset sheet.

Generates raw creative materials for designer handoff via Figma:
1. For each actor: generate images in 1:1, 4:5, 9:16 using Stage 2 seed as reference
2. Package copy per persona (headline, subheading, CTA) from Stage 3 assets
3. Build self-contained HTML asset sheet
4. Upload all to Vercel Blob + save to Neon
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from ai.deglosser import degloss
from ai.seedream import generate_image
from blob_uploader import upload_to_blob
from config import IMAGE_CONCURRENCY
from neon_client import get_actors, get_assets, get_brief, get_intake_request, save_asset
from prompts.recruitment_actors import build_image_prompt

logger = logging.getLogger(__name__)

# The 3 standard ratios every campaign needs
RATIOS = [
    ("square", "1:1", "1080x1080"),
    ("feed_portrait", "4:5", "1080x1350"),
    ("portrait", "9:16", "1080x1920"),
]

MAX_RETRIES = 2


async def run_stage4(context: dict) -> dict:
    """Generate base creative materials for Figma handoff.

    Produces 3-ratio images per actor + HTML asset sheet.
    Organic carousels run separately after this (orchestrator handles that).
    """
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})

    # Load request for campaign name + summary
    request = await get_intake_request(request_id)
    campaign_name = request.get("title", "Untitled Campaign")
    task_type = request.get("task_type", "")

    # Load actors (with seed images from Stage 2)
    actors = context.get("actors") or await get_actors(request_id)
    if not actors:
        logger.warning("No actors found for %s — skipping material generation", request_id)
        return {"asset_count": 0}

    # Load copy assets from Stage 3
    copy_assets = await get_assets(request_id, asset_type="copy")
    social_captions = await get_assets(request_id, asset_type="social_caption")
    all_copy = copy_assets + social_captions

    # Build persona → copy lookup
    copy_by_persona = _build_copy_lookup(all_copy)

    # Generate images for all actors in parallel (semaphore-gated)
    semaphore = asyncio.Semaphore(IMAGE_CONCURRENCY)
    total_assets = 0

    async def _gen_actor_materials(actor: dict) -> int:
        async with semaphore:
            return await _generate_actor_ratios(
                actor=actor,
                request_id=request_id,
                brief=brief,
                context=context,
            )

    results = await asyncio.gather(
        *[_gen_actor_materials(a) for a in actors],
        return_exceptions=True,
    )

    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.error("Actor '%s' material gen failed: %s", actors[i].get("name", "?"), r)
        else:
            total_assets += r

    # Build + upload HTML asset sheet
    sheet_url = await _build_asset_sheet(
        request_id=request_id,
        campaign_name=campaign_name,
        task_type=task_type,
        actors=actors,
        copy_by_persona=copy_by_persona,
        brief=brief,
    )
    if sheet_url:
        total_assets += 1

    logger.info("Stage 4 complete: %d total assets generated", total_assets)
    return {"asset_count": total_assets}


async def _generate_actor_ratios(
    *,
    actor: dict,
    request_id: str,
    brief: dict,
    context: dict,
) -> int:
    """Generate 3-ratio images for a single actor. Returns count of saved assets."""
    actor_id = actor.get("id", "")
    actor_name = actor.get("name", "Unknown")
    seed_url = actor.get("validated_seed_url", "")
    persona_key = (
        actor.get("persona_key")
        or (actor.get("face_lock", {}) or {}).get("persona_key", "")
    )
    country = context.get("country")
    language = context.get("form_data", {}).get("language", "English")

    # Pick the best scene for each ratio
    scenes = actor.get("scenes", {})
    scene_keys = list(scenes.keys())
    design = context.get("design_direction", {})

    saved = 0

    for dim_key, ratio_label, format_str in RATIOS:
        # Rotate scenes across ratios for variety
        scene_idx = RATIOS.index((dim_key, ratio_label, format_str))
        scene_key = scene_keys[scene_idx % len(scene_keys)] if scene_keys else "default"

        image_prompt, comp_key = build_image_prompt(
            actor,
            outfit_key=scene_key,
            backdrop_index=scene_idx,
            design=design,
            region=context.get("target_regions", ["Global"])[0] if context.get("target_regions") else "Global",
            image_index=scene_idx,
            used_compositions=[],
        )

        # Add seed reference for identity consistency
        if seed_url:
            image_prompt += f"\n\nREFERENCE IMAGE (use this face as the identity anchor): {seed_url}"

        # Generate with retry
        image_bytes = None
        for attempt in range(MAX_RETRIES):
            try:
                raw_bytes = await generate_image(image_prompt, dimension_key=dim_key)
                image_bytes = degloss(raw_bytes, intensity="heavy" if attempt == 0 else "medium")
                break
            except Exception as e:
                logger.warning(
                    "Image gen failed for %s %s (attempt %d): %s",
                    actor_name, ratio_label, attempt + 1, e,
                )
                if attempt == MAX_RETRIES - 1:
                    logger.error("Giving up on %s %s after %d attempts", actor_name, ratio_label, MAX_RETRIES)

        if not image_bytes:
            continue

        # Convert to AVIF for storage
        avif_bytes = _convert_to_avif(image_bytes)
        is_avif = len(avif_bytes) < len(image_bytes)
        ext = "avif" if is_avif else "png"

        filename = f"base_{actor_id}_{ratio_label.replace(':', 'x')}_{uuid.uuid4().hex[:8]}.{ext}"
        blob_url = await upload_to_blob(
            avif_bytes, filename,
            folder=f"requests/{request_id}/base_creatives",
            content_type=f"image/{ext}",
        )

        await save_asset(request_id, {
            "asset_type": "base_creative",
            "platform": "all",
            "format": format_str,
            "language": language,
            "blob_url": blob_url,
            "country": country,
            "metadata": {
                "actor_id": actor_id,
                "actor_name": actor_name,
                "persona_key": persona_key,
                "ratio": ratio_label,
                "dimensions": format_str,
                "seed_reference": seed_url,
                "scene_key": scene_key,
                "composition": comp_key,
            },
        })
        saved += 1
        logger.info("Saved base_creative: %s %s (%s)", actor_name, ratio_label, format_str)

    return saved


def _build_copy_lookup(copy_assets: list[dict]) -> dict[str, dict]:
    """Build persona_key -> {headline, subheading, cta} from Stage 3 copy assets."""
    lookup: dict[str, dict] = {}
    for asset in copy_assets:
        content = asset.get("content", {})
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                content = {}

        persona_key = (
            content.get("persona_key")
            or content.get("actor_name", "")
            .lower()
            .replace(" ", "_")
        )
        if not persona_key:
            continue

        # Keep the first (best) copy per persona
        if persona_key not in lookup:
            lookup[persona_key] = {
                "headline": (
                    content.get("overlay_headline")
                    or content.get("headline")
                    or content.get("hook_line")
                    or ""
                ),
                "subheading": (
                    content.get("subheadline")
                    or content.get("body_text", "")[:120]
                    or ""
                ),
                "cta": content.get("cta_text") or content.get("cta") or "Apply Now",
            }
    return lookup


async def _build_asset_sheet(
    *,
    request_id: str,
    campaign_name: str,
    task_type: str,
    actors: list[dict],
    copy_by_persona: dict[str, dict],
    brief: dict,
) -> str | None:
    """Build self-contained HTML asset sheet and upload to Blob."""
    # Build 12-word summary from brief
    objective = brief.get("campaign_objective", "")
    summary = " ".join(objective.split()[:12]) if objective else task_type.replace("_", " ").title()

    # Load the base_creative assets we just generated
    base_assets = await get_assets(request_id, asset_type="base_creative")

    # Group by actor
    assets_by_actor: dict[str, list[dict]] = {}
    for asset in base_assets:
        content = asset.get("content", {})
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                content = {}
        actor_name = content.get("actor_name", "Unknown")
        assets_by_actor.setdefault(actor_name, []).append({
            "ratio": content.get("ratio", "?"),
            "url": asset.get("blob_url", ""),
            "dimensions": content.get("dimensions", ""),
        })

    # Build HTML
    persona_sections = []
    for actor in actors:
        name = actor.get("name", "Unknown")
        persona_key = (
            actor.get("persona_key")
            or (actor.get("face_lock", {}) or {}).get("persona_key", "")
        )
        persona_name = actor.get("persona_name", persona_key)

        actor_assets = assets_by_actor.get(name, [])
        # Sort: 1:1, 4:5, 9:16
        ratio_order = {"1:1": 0, "4:5": 1, "9:16": 2}
        actor_assets.sort(key=lambda a: ratio_order.get(a["ratio"], 9))

        images_html = ""
        for asset in actor_assets:
            w = int(asset["dimensions"].split("x")[0]) if "x" in asset.get("dimensions", "") else 200
            h = int(asset["dimensions"].split("x")[1]) if "x" in asset.get("dimensions", "") else 200
            # Scale down for display (max 300px wide)
            scale = min(300 / w, 1.0)
            dw = int(w * scale)
            dh = int(h * scale)
            images_html += (
                f'<div style="text-align:center">'
                f'<img src="{asset["url"]}" width="{dw}" height="{dh}" '
                f'style="border-radius:8px;object-fit:cover" />'
                f'<div style="font-size:12px;color:#737373;margin-top:4px">{asset["ratio"]} ({asset["dimensions"]})</div>'
                f'</div>'
            )

        copy = copy_by_persona.get(persona_key, copy_by_persona.get(name.lower().replace(" ", "_"), {}))

        persona_sections.append(f"""
    <div style="margin-bottom:48px;padding:24px;border:1px solid #E5E5E5;border-radius:12px">
      <h2 style="margin:0 0 4px 0;font-size:18px">{name}</h2>
      <div style="font-size:13px;color:#737373;margin-bottom:20px">{persona_name}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
        {images_html}
      </div>
      <div style="display:grid;gap:12px">
        <div><span style="font-size:11px;text-transform:uppercase;color:#737373;letter-spacing:0.05em">Headline</span>
          <div style="font-size:16px;font-weight:600;margin-top:2px;user-select:all">{copy.get("headline", "—")}</div></div>
        <div><span style="font-size:11px;text-transform:uppercase;color:#737373;letter-spacing:0.05em">Subheading</span>
          <div style="font-size:14px;margin-top:2px;user-select:all">{copy.get("subheading", "—")}</div></div>
        <div><span style="font-size:11px;text-transform:uppercase;color:#737373;letter-spacing:0.05em">CTA</span>
          <div style="font-size:14px;font-weight:600;margin-top:2px;user-select:all">{copy.get("cta", "Apply Now")}</div></div>
      </div>
    </div>""")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{campaign_name} — Asset Sheet</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #1A1A1A; background: #FFFFFF; padding: 40px; max-width: 1200px; margin: 0 auto; }}
</style>
</head>
<body>
  <h1 style="font-size:28px;margin-bottom:8px">{campaign_name}</h1>
  <p style="font-size:15px;color:#737373;margin-bottom:40px">{summary}</p>
  {"".join(persona_sections)}
</body>
</html>"""

    # Upload to Blob
    try:
        sheet_bytes = html.encode("utf-8")
        filename = f"asset_sheet_{request_id}_{uuid.uuid4().hex[:8]}.html"
        blob_url = await upload_to_blob(
            sheet_bytes, filename,
            folder=f"requests/{request_id}",
            content_type="text/html",
        )
        await save_asset(request_id, {
            "asset_type": "asset_sheet",
            "platform": "all",
            "format": "html",
            "language": "en",
            "blob_url": blob_url,
            "metadata": {
                "actor_count": len(actors),
                "persona_count": len(set(
                    a.get("persona_key", a.get("name", "")) for a in actors
                )),
            },
        })
        logger.info("Asset sheet uploaded: %s", blob_url)
        return blob_url
    except Exception as e:
        logger.error("Failed to build/upload asset sheet: %s", e)
        return None


def _convert_to_avif(image_bytes: bytes, quality: int = 65) -> bytes:
    """Convert to AVIF for storage. Falls back to original on failure."""
    try:
        import io as _io
        from PIL import Image
        img = Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        buf = _io.BytesIO()
        img.save(buf, format="AVIF", quality=quality)
        return buf.getvalue()
    except Exception:
        return image_bytes
