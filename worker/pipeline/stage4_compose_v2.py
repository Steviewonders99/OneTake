"""Stage 4 v2: LLM-Designed Creative Composition — the money stage, upgraded.

Replaces the deterministic template approach with Kimi K2.5 creative design.
Each persona × platform pair gets 2-3 Kimi-designed HTML/CSS creatives, each
rendered as both a final PNG and a transparent overlay-only PNG.

Pipeline:
  1. Load actors + images + copy from Neon
  2. Run bg removal on all images in parallel (rembg → cutout + shadow PNGs)
  3. Upload cutouts to Vercel Blob
  4. Group actors by persona archetype (from face_lock.persona_key)
  5. For each persona × platform (parallel, semaphore-gated):
     a. Call design_creatives() — Kimi K2.5 returns 2-3 HTML designs
     b. For each design: dual render via Playwright (final PNG + overlay PNG)
     c. Upload both to Vercel Blob
     d. Save metadata to Neon (composed_creative asset)
  6. Return total asset count

DEFAULT_PLATFORMS covers: ig_feed, ig_story, linkedin_feed, facebook_feed, telegram_card
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import httpx

from ai.bg_remover import create_cutout_with_shadow, remove_background
from ai.compositor import PLATFORM_SPECS, render_overlay_only, render_to_png
from ai.creative_designer import design_creatives
from blob_uploader import upload_to_blob
from config import COMPOSE_CONCURRENCY
from neon_client import get_actors, get_assets, save_asset

logger = logging.getLogger(__name__)

DEFAULT_PLATFORMS = [
    "ig_feed",        # 1080x1080
    "ig_story",       # 1080x1920
    "linkedin_feed",  # 1200x627
    "facebook_feed",  # 1200x628
    "telegram_card",  # 1280x720
]


# ── Main entry point ─────────────────────────────────────────────

async def run_stage4(context: dict) -> dict:
    """Coordinate bg removal → Kimi design → dual render → upload → save.

    Parameters
    ----------
    context : dict
        Must contain request_id. May contain brief, design_direction, personas.

    Returns
    -------
    dict
        {"asset_count": int}
    """
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})

    # ── 1. Load Neon data ────────────────────────────────────────
    actors = await get_actors(request_id)
    image_assets = await get_assets(request_id, asset_type="base_image")
    copy_assets = await get_assets(request_id, asset_type="copy")

    if not actors:
        logger.warning("No actors found for request %s — skipping stage 4", request_id)
        return {"asset_count": 0}

    # ── 2. Prepare image data (NO bg removal — use full images) ───
    # BG removal produced messy cutouts with rough edges and artifacts.
    # Full images with gradient overlays look better for ad creatives.
    image_data = await _prepare_images_simple(image_assets, request_id)

    # ── 3. Group actors by persona, attach image data ────────────
    personas_map = _group_actors_by_persona(actors, image_data)

    if not personas_map:
        logger.warning("No persona groups found — skipping stage 4")
        return {"asset_count": 0}

    # ── 4. Build copy lookup ─────────────────────────────────────
    channel_copy = _build_copy_lookup(copy_assets)

    # ── 5. Determine platforms from channel strategy ──────────────
    # Priority: brief channels > design format_matrix > DEFAULT_PLATFORMS
    # The channel strategy from Stage 1 tells us WHERE to advertise.
    # Each persona may have different best_channels — we respect that.
    brief_channels = brief.get("channels", {})
    primary_channels = brief_channels.get("primary", [])
    secondary_channels = brief_channels.get("secondary", [])
    all_brief_channels = primary_channels + secondary_channels

    format_matrix = design.get("format_matrix", {})

    # Map human-readable channel names to platform keys
    CHANNEL_TO_PLATFORM = {
        "instagram": "ig_feed", "instagram feed": "ig_feed", "ig": "ig_feed",
        "instagram stories": "ig_story", "ig stories": "ig_story", "ig story": "ig_story",
        "facebook": "facebook_feed", "facebook feed": "facebook_feed", "fb": "facebook_feed",
        "facebook stories": "facebook_stories", "fb stories": "facebook_stories",
        "linkedin": "linkedin_feed", "linkedin feed": "linkedin_feed",
        "tiktok": "tiktok_feed", "tiktok feed": "tiktok_feed",
        "telegram": "telegram_card", "telegram card": "telegram_card",
        "twitter": "twitter_post", "x": "twitter_post", "x/twitter": "twitter_post",
        "wechat": "wechat_moments", "wechat moments": "wechat_moments",
        "wechat channels": "wechat_channels",
        "whatsapp": "whatsapp_story", "whatsapp status": "whatsapp_story",
        "google display": "google_display", "google ads": "google_display",
        "indeed": "indeed_banner",
    }

    def _resolve_channels(channel_list: list[str]) -> list[str]:
        """Convert human-readable channel names to platform keys.

        Handles channels with stats appended like "WhatsApp (98.3% penetração)"
        by stripping everything after the first parenthesis.
        """
        resolved = []
        for ch in channel_list:
            # Strip stats/annotations: "WhatsApp (98.3% penetração)" → "whatsapp"
            clean = ch.split("(")[0].lower().strip()
            key = CHANNEL_TO_PLATFORM.get(clean, clean.replace(" ", "_"))
            if key not in resolved:
                resolved.append(key)
        return resolved

    # Global platform list from brief (applies to all personas)
    global_platforms = _resolve_channels(all_brief_channels) if all_brief_channels else None

    if global_platforms:
        logger.info("Channel strategy from brief: %s", global_platforms)
    elif format_matrix:
        global_platforms = list(format_matrix.keys())
        logger.info("Platforms from design format_matrix: %s", global_platforms)
    else:
        global_platforms = None  # Will use per-persona best_channels or DEFAULT

    # ── 6. Run actor × scene × platform batches in parallel ────────
    # Each batch = 1 actor photo × 1 platform → 3 creative options (different hooks)
    # This produces the full creative testing matrix.
    semaphore = asyncio.Semaphore(COMPOSE_CONCURRENCY)

    tasks = []
    for persona_key, persona_actors in personas_map.items():
        persona = _build_persona_dict(persona_key, persona_actors, context)

        # Determine platforms for THIS persona
        persona_channels = persona.get("best_channels", [])
        if global_platforms:
            platforms = global_platforms
        elif persona_channels:
            platforms = _resolve_channels(persona_channels)
            logger.info("Persona '%s' channels: %s", persona_key, platforms)
        else:
            platforms = DEFAULT_PLATFORMS

        # Iterate each actor in this persona group
        for actor_data in persona_actors:
            actor_id = str(actor_data.get("actor_id", actor_data.get("id", "")))
            actor_name = actor_data.get("name", "contributor")

            # Get this actor's scene images from image_data
            actor_images = {
                k: v for k, v in image_data.items()
                if str(v.get("actor_id", "")) == actor_id
            }

            if not actor_images:
                continue

            # Group images by scene key
            scene_images: dict[str, dict] = {}
            for asset_id, img in actor_images.items():
                scene_key = img.get("scene", "default")
                if scene_key not in scene_images:
                    scene_images[scene_key] = img

            # For each scene photo × each platform → 1 batch (3 creative options)
            for scene_key, scene_img in scene_images.items():
                # Build single-actor list with just this scene's image
                single_actor = [{
                    "name": actor_name,
                    "region": actor_data.get("region", "Global"),
                    "images": {
                        scene_key: {
                            "full_url": scene_img.get("full_url", ""),
                            "cutout_url": scene_img.get("cutout_url", ""),
                            "shadow_url": scene_img.get("shadow_url", ""),
                            "scene_description": scene_img.get("scene_description", ""),
                        }
                    },
                }]

                for platform in platforms:
                    spec = PLATFORM_SPECS.get(platform)
                    if not spec:
                        logger.warning("Unknown platform spec: %s — skipping", platform)
                        continue

                    platform_copy = _find_copy(channel_copy, platform)

                    tasks.append(
                        _design_and_render_batch(
                            semaphore=semaphore,
                            request_id=request_id,
                            persona=persona,
                            persona_key=persona_key,
                            actors=single_actor,
                            platform=platform,
                            spec=spec,
                            brief=brief,
                            platform_copy=platform_copy,
                        )
                    )

    logger.info(
        "Stage 4 dispatching %d batches (actor×scene×platform, 3 creatives each)",
        len(tasks),
    )

    results = await asyncio.gather(*tasks, return_exceptions=True)

    asset_count = 0
    for r in results:
        if isinstance(r, Exception):
            logger.error("Batch failed: %s", r)
        elif isinstance(r, int):
            asset_count += r

    logger.info("Stage 4 v2 complete: %d composed creatives", asset_count)
    return {"asset_count": asset_count}


# ── Batch: design + render ────────────────────────────────────────

async def _design_and_render_batch(
    semaphore: asyncio.Semaphore,
    request_id: str,
    persona: dict,
    persona_key: str,
    actors: list[dict],
    platform: str,
    spec: dict,
    brief: dict,
    platform_copy: dict,
) -> int:
    """Design 2-3 Kimi creatives for one persona × platform, render all.

    Dual render per design:
      - final PNG  (full composite with background image)
      - overlay PNG (transparent, overlay elements only)

    Both are uploaded to Blob, one Neon asset record saved per design
    (overlay_url stored in metadata).

    Parameters
    ----------
    semaphore : asyncio.Semaphore
        Gates concurrency across all batches.
    request_id : str
        Intake request ID.
    persona : dict
        Persona archetype dict passed to design_creatives().
    persona_key : str
        Short key for logging and filenames.
    actors : list[dict]
        Actors for this persona with images attached.
    platform : str
        Target platform key.
    spec : dict
        PLATFORM_SPECS entry for this platform.
    brief : dict
        Campaign brief.
    platform_copy : dict
        Stage 3 copy data for this platform.

    Returns
    -------
    int
        Number of assets saved.
    """
    async with semaphore:
        logger.info(
            "Designing creatives: persona=%s, platform=%s (%dx%d)",
            persona_key, platform, spec["width"], spec["height"],
        )

        # ── PHASE 1: Generate overlay copy (Gemma 27B + marketing skills) ──
        # Copy is generated and validated BEFORE design.
        # This keeps prompts small and each model focused on its strength.
        from ai.overlay_copywriter import generate_overlay_copy

        copy_sets = await generate_overlay_copy(
            persona=persona,
            actors=actors,
            platform=platform,
            platform_spec=spec,
            brief=brief,
            platform_copy=platform_copy,
            num_creatives=3,
        )

        if not copy_sets:
            logger.warning(
                "No copy generated for persona=%s platform=%s — skipping design",
                persona_key, platform,
            )
            return 0

        logger.info(
            "Phase 1 complete: %d copy sets for %s/%s",
            len(copy_sets), persona_key, platform,
        )

        # ── PHASE 2: Design HTML creatives (GLM-5) with approved copy ──
        # Pass pre-approved copy so the designer focuses on LAYOUT only
        designs = await design_creatives(
            persona=persona,
            actors=actors,
            platform=platform,
            platform_spec=spec,
            brief=brief,
            platform_copy=platform_copy,
            approved_copy=copy_sets,
        )

        if not designs:
            logger.warning(
                "No designs returned for persona=%s platform=%s", persona_key, platform
            )
            return 0

        w, h = spec["width"], spec["height"]

        # ── Fix #3: Parallel render + eval ────────────────────
        # Render ALL designs in parallel, then eval ALL in parallel.
        # 1 render cycle + 1 eval cycle instead of 3 serial rounds.
        from ai.creative_vqa import (
            MAX_CREATIVE_RETRIES,
            evaluate_creative,
        )

        valid_designs = [d for d in designs if d.get("html")]
        if not valid_designs:
            logger.warning("No valid HTML in designs for %s/%s", persona_key, platform)
            return 0

        # Step 1: Render all designs in parallel
        render_results = await asyncio.gather(
            *[render_to_png(d["html"], w, h) for d in valid_designs],
            return_exceptions=True,
        )

        # Step 2: Evaluate all renders in parallel
        eval_tasks = []
        for i, (design, png) in enumerate(zip(valid_designs, render_results)):
            if isinstance(png, Exception):
                logger.error("  Render failed for design %d: %s", i, png)
                eval_tasks.append(None)
            else:
                eval_tasks.append(evaluate_creative(
                    design=design, rendered_png=png, spec=spec, platform=platform,
                ))

        async def _noop():
            return None

        eval_results = await asyncio.gather(
            *[t if t is not None else _noop() for t in eval_tasks],
            return_exceptions=True,
        )

        # Step 3: Process results — save passes, collect failures for retry
        saved = 0
        retry_needed: list[tuple[dict, list[str]]] = []

        for i, design in enumerate(valid_designs):
            png = render_results[i] if i < len(render_results) else None
            ev = eval_results[i] if i < len(eval_results) else None

            if isinstance(png, Exception) or png is None:
                continue
            if isinstance(ev, Exception) or ev is None:
                # Eval failed — save anyway with score 0
                ev = {"passed": True, "score": 0.0, "issues": []}

            score = ev.get("score", 0)
            passed = ev.get("passed", False)
            actor_name = design.get("actor_name", "contributor")

            logger.info(
                "  Creative eval: persona=%s platform=%s actor=%s — score=%.2f (%s)",
                persona_key, platform, actor_name, score,
                "PASS" if passed else "FAIL",
            )

            if passed:
                saved += await _save_creative(
                    request_id=request_id, design=design, final_png=png,
                    w=w, h=h, spec=spec, persona_key=persona_key,
                    platform=platform, platform_copy=platform_copy,
                    eval_score=score, eval_attempts=1,
                )
            else:
                retry_needed.append((design, ev.get("issues", [])))

        # Step 4: Retry failed designs (Fix #5: use approved_copy path)
        for failed_design, feedback in retry_needed:
            if not feedback:
                continue

            # Build single-item approved copy from the failed design's copy
            retry_copy = [{
                "actor_name": failed_design.get("actor_name", ""),
                "scene": failed_design.get("scene", ""),
                "headline": failed_design.get("overlay_headline", ""),
                "sub": failed_design.get("overlay_sub", ""),
                "cta": failed_design.get("overlay_cta", ""),
            }]

            for attempt in range(MAX_CREATIVE_RETRIES):
                logger.info(
                    "  Retrying %s/%s (attempt %d/%d, %d feedback items)",
                    platform, failed_design.get("actor_name", "?"),
                    attempt + 2, 1 + MAX_CREATIVE_RETRIES, len(feedback),
                )

                # Fix #5: Pass approved_copy so retry skips marketing skills injection
                retry_designs = await design_creatives(
                    persona=persona,
                    actors=actors,
                    platform=platform,
                    platform_spec=spec,
                    brief=brief,
                    platform_copy=platform_copy,
                    approved_copy=retry_copy,
                    feedback=feedback,
                )

                if not retry_designs:
                    logger.warning("  Retry returned no designs — skipping")
                    break

                retry_design = retry_designs[0]
                retry_html = retry_design.get("html", "")
                if not retry_html:
                    break

                try:
                    retry_png = await render_to_png(retry_html, w, h)
                    retry_eval = await evaluate_creative(
                        design=retry_design, rendered_png=retry_png,
                        spec=spec, platform=platform,
                    )

                    retry_score = retry_eval.get("score", 0)
                    logger.info(
                        "  Retry eval: score=%.2f (%s)",
                        retry_score, "PASS" if retry_eval["passed"] else "FAIL",
                    )

                    if retry_eval["passed"]:
                        saved += await _save_creative(
                            request_id=request_id, design=retry_design,
                            final_png=retry_png, w=w, h=h, spec=spec,
                            persona_key=persona_key, platform=platform,
                            platform_copy=platform_copy,
                            eval_score=retry_score, eval_attempts=attempt + 2,
                        )
                        break

                    feedback = retry_eval.get("issues", [])

                except Exception as retry_err:
                    logger.warning("  Retry render/eval error: %s", retry_err)
                    break

        return saved


async def _save_creative(
    *,
    request_id: str,
    design: dict,
    final_png: bytes,
    w: int,
    h: int,
    spec: dict,
    persona_key: str,
    platform: str,
    platform_copy: dict,
    eval_score: float,
    eval_attempts: int,
) -> int:
    """Render overlay, convert formats, upload to Blob, save to Neon. Returns 1 on success, 0 on failure."""
    actor_name = design.get("actor_name", "contributor")
    scene = design.get("scene", "default")
    uid = uuid.uuid4().hex[:8]
    safe_persona = persona_key.replace(" ", "_")[:24]

    try:
        # Render overlay-only version
        overlay_png = await render_overlay_only(design.get("html", ""), w, h)

        # Convert to AVIF for storage optimization
        final_bytes = convert_to_avif(final_png)
        is_avif = len(final_bytes) < len(final_png)
        ext = "avif" if is_avif else "png"
        content_type = "image/avif" if is_avif else "image/png"

        # Upload final + overlay in parallel
        final_filename = f"creative_{platform}_{safe_persona}_{uid}.{ext}"
        overlay_webp = _convert_to_webp(overlay_png)
        overlay_filename = f"overlay_{platform}_{safe_persona}_{uid}.webp"

        final_url, overlay_url = await asyncio.gather(
            upload_to_blob(
                final_bytes, final_filename,
                folder=f"requests/{request_id}/composed",
                content_type=content_type,
            ),
            upload_to_blob(
                overlay_webp, overlay_filename,
                folder=f"requests/{request_id}/composed",
                content_type="image/webp",
            ),
        )

        # Save to Neon
        await save_asset(request_id, {
            "asset_type": "composed_creative",
            "platform": platform,
            "format": f"{w}x{h}",
            "language": platform_copy.get("language", ""),
            "blob_url": final_url,
            "metadata": {
                "actor_name": actor_name,
                "scene": scene,
                "overlay_headline": design.get("overlay_headline", ""),
                "overlay_sub": design.get("overlay_sub", ""),
                "overlay_cta": design.get("overlay_cta", ""),
                "image_treatment": design.get("image_treatment", ""),
                "overlay_url": overlay_url,
                "persona": persona_key,
                "eval_score": eval_score,
                "eval_attempts": eval_attempts,
                "platform_headline": platform_copy.get("headline", ""),
                "platform_description": platform_copy.get(
                    "description",
                    platform_copy.get("primary_text", ""),
                ),
            },
            "stage": 4,
        })

        logger.info(
            "  Saved: %s/%s/%s → %s (score=%.2f, attempts=%d)",
            persona_key, platform, actor_name, final_url,
            eval_score, eval_attempts,
        )
        return 1

    except Exception as e:
        logger.error(
            "  FAILED render/upload: persona=%s platform=%s actor=%s — %s",
            persona_key, platform, actor_name, e,
        )
        return 0


# ── Image preparation (simple — NO bg removal) ────────────────────

async def _prepare_images_simple(
    image_assets: list[dict],
    request_id: str,
) -> dict[str, dict]:
    """Prepare image data WITHOUT background removal.

    Full images with gradient overlays look better than messy cutouts.
    Still runs VLM captioning (throttled to 5 concurrent).

    Returns
    -------
    dict
        Mapping asset_id → {full_url, cutout_url, shadow_url, actor_id, scene, scene_description}
        cutout_url and shadow_url point to full_url (no cutout available).
    """
    import json as _json

    result: dict[str, dict] = {}

    for asset in image_assets:
        asset_id = str(asset.get("id", uuid.uuid4()))
        actor_id = str(asset.get("actor_id", ""))
        full_url = asset.get("blob_url", "")

        content = asset.get("content") or {}
        if isinstance(content, str):
            try:
                content = _json.loads(content)
            except (_json.JSONDecodeError, TypeError):
                content = {}
        scene = content.get("outfit_key", content.get("scene", "default"))

        result[asset_id] = {
            "full_url": full_url,
            "cutout_url": full_url,   # No cutout — use full image
            "shadow_url": full_url,   # No shadow — use full image
            "actor_id": actor_id,
            "scene": scene,
            "scene_description": "",
        }

    logger.info("Image prep (simple, no bg removal): %d images", len(result))

    # VLM captioning — throttled to 5 concurrent
    caption_sem = asyncio.Semaphore(5)
    angle_keywords = ["front", "side", "back", "3q_", "close_up", "eye_detail", "full_front", "full_back"]

    async def _caption_one(asset_id: str, data: dict) -> None:
        scene = data.get("scene", "")
        full_url = data.get("full_url", "")
        if not full_url:
            return
        if any(kw in scene.lower() for kw in angle_keywords):
            return

        async with caption_sem:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.get(full_url)
                    resp.raise_for_status()
                    image_bytes = resp.content

                data["scene_description"] = await _caption_image(image_bytes)
                logger.info(
                    "Captioned: actor=%s scene=%s caption='%s'",
                    data.get("actor_id", "?"), scene, data["scene_description"][:60],
                )
            except Exception as e:
                logger.warning("Caption failed for %s: %s", asset_id, e)

    caption_tasks = [_caption_one(aid, d) for aid, d in result.items()]
    await asyncio.gather(*caption_tasks, return_exceptions=True)

    return result


# ── Image preparation (legacy — with bg removal) ──────────────────

async def _prepare_images(
    image_assets: list[dict],
    request_id: str,
) -> dict[str, dict]:
    """Download all actor images, remove backgrounds, upload cutout PNGs.

    Runs all downloads and bg-removal tasks concurrently.

    Parameters
    ----------
    image_assets : list[dict]
        base_image assets from Neon. Each has id, actor_id, blob_url, content.
    request_id : str
        Used to build the Blob folder path.

    Returns
    -------
    dict
        Mapping asset_id (str) → {full_url, cutout_url, shadow_url, actor_id, scene}
        On per-asset failure, cutout_url and shadow_url fall back to full_url.
    """
    async def _process_one(asset: dict) -> tuple[str, dict]:
        asset_id = str(asset.get("id", uuid.uuid4()))
        actor_id = str(asset.get("actor_id", ""))
        full_url = asset.get("blob_url", "")

        # Extract scene from content JSONB
        content = asset.get("content") or {}
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                content = {}
        scene = content.get("outfit_key", content.get("scene", "default"))

        fallback = {
            "full_url": full_url,
            "cutout_url": full_url,
            "shadow_url": full_url,
            "actor_id": actor_id,
            "scene": scene,
            "scene_description": "",
        }

        if not full_url:
            return asset_id, fallback

        # ── Fix #2: Skip re-processing if cutouts already exist ──
        # On resume, cutouts from the previous run are still in Blob.
        # Check metadata for existing cutout URLs to avoid re-downloading
        # and re-running rembg on every resume.
        metadata = asset.get("metadata") or {}
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}
        existing_cutout = metadata.get("cutout_url", "")
        existing_shadow = metadata.get("shadow_url", "")
        existing_caption = metadata.get("scene_description", "")
        if existing_cutout and existing_shadow:
            logger.info("Cutout cached: actor=%s scene=%s (skipping rembg)", actor_id, scene)
            return asset_id, {
                "full_url": full_url,
                "cutout_url": existing_cutout,
                "shadow_url": existing_shadow,
                "actor_id": actor_id,
                "scene": scene,
                "scene_description": existing_caption,
            }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(full_url)
                resp.raise_for_status()
                image_bytes = resp.content

            # Run bg removal — both plain cutout and cutout-with-shadow
            cutout_bytes, shadow_bytes = await asyncio.gather(
                remove_background(image_bytes),
                create_cutout_with_shadow(image_bytes),
            )

            uid = uuid.uuid4().hex[:8]
            cutout_filename = f"cutout_{actor_id}_{uid}.png"
            shadow_filename = f"shadow_{actor_id}_{uid}.png"
            folder = f"requests/{request_id}/cutouts"

            cutout_url, shadow_url = await asyncio.gather(
                upload_to_blob(cutout_bytes, cutout_filename, folder=folder),
                upload_to_blob(shadow_bytes, shadow_filename, folder=folder),
            )

            logger.info("Cutout + upload done: actor=%s scene=%s", actor_id, scene)
            return asset_id, {
                "full_url": full_url,
                "cutout_url": cutout_url,
                "shadow_url": shadow_url,
                "actor_id": actor_id,
                "scene": scene,
                "scene_description": "",  # Captioned in parallel phase below
                "_image_bytes": image_bytes,  # Keep for captioning
            }

        except Exception as e:
            logger.error(
                "BG removal failed for asset %s (actor %s): %s — using full image",
                asset_id, actor_id, e,
            )
            return asset_id, fallback

    # ── Phase A: BG removal + upload (fully parallel, local CPU) ──
    tasks = [_process_one(a) for a in image_assets]
    pairs = await asyncio.gather(*tasks, return_exceptions=True)

    result: dict[str, dict] = {}
    for item in pairs:
        if isinstance(item, Exception):
            logger.error("Image prep task raised: %s", item)
        else:
            asset_id, data = item
            result[asset_id] = data

    logger.info("BG removal complete: %d images processed", len(result))

    # ── Phase B: VLM captioning (throttled to 5 concurrent — NIM rate limits) ──
    caption_sem = asyncio.Semaphore(5)
    angle_keywords = ["front", "side", "back", "3q_", "close_up", "eye_detail", "full_front", "full_back"]

    async def _caption_one(asset_id: str, data: dict) -> None:
        scene = data.get("scene", "")
        image_bytes = data.pop("_image_bytes", None)
        if not image_bytes:
            return
        if any(kw in scene.lower() for kw in angle_keywords):
            return  # Skip angle reference shots

        async with caption_sem:
            try:
                data["scene_description"] = await _caption_image(image_bytes)
                logger.info(
                    "Cutout ready: actor=%s scene=%s caption='%s'",
                    data.get("actor_id", "?"), scene, data["scene_description"][:60],
                )
            except Exception as e:
                logger.warning("Caption failed for %s: %s", asset_id, e)

    caption_tasks = [_caption_one(aid, d) for aid, d in result.items()]
    await asyncio.gather(*caption_tasks, return_exceptions=True)

    # Clean up _image_bytes from results
    for d in result.values():
        d.pop("_image_bytes", None)

    return result


# ── Image captioning ─────────────────────────────────────────────

async def _caption_image(image_bytes: bytes) -> str:
    """Get a 1-2 sentence scene description via Kimi K2.5 Vision.

    This tells the creative designer what's ACTUALLY in the photo
    so overlay copy matches the scene (desk ≠ couch, cafe ≠ home).
    """
    try:
        from ai.local_vlm import analyze_image
        import tempfile, os

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(image_bytes)
        tmp.close()

        caption = await analyze_image(
            tmp.name,
            "Describe this photo in 1-2 SHORT sentences. Focus on: "
            "what the person is doing, where they are, what objects are visible, "
            "and the mood/lighting. Be specific and factual.",
        )
        os.unlink(tmp.name)
        return caption.strip()[:300]

    except Exception as e:
        logger.warning("Image captioning failed: %s", e)
        return ""


# ── AVIF conversion ──────────────────────────────────────────────

def convert_to_avif(png_bytes: bytes, quality: int = 65) -> bytes:
    """Convert PNG bytes to AVIF for storage optimization.

    AVIF typically achieves 50-70% smaller file sizes than PNG
    with near-identical visual quality at quality=65.
    Falls back to returning original PNG if pillow-avif not available.
    """
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(png_bytes))
        buf = io.BytesIO()
        img.save(buf, format="AVIF", quality=quality)
        avif_bytes = buf.getvalue()
        logger.debug(
            "AVIF conversion: %d bytes → %d bytes (%.0f%% reduction)",
            len(png_bytes), len(avif_bytes),
            (1 - len(avif_bytes) / len(png_bytes)) * 100,
        )
        return avif_bytes
    except Exception as e:
        logger.warning("AVIF conversion failed (%s) — keeping PNG", e)
        return png_bytes


def _convert_to_webp(png_bytes: bytes, quality: int = 80) -> bytes:
    """Convert transparent PNG to WebP (supports alpha, ~68% smaller)."""
    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(png_bytes))
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=quality, lossless=False)
        return buf.getvalue()
    except Exception as e:
        logger.warning("WebP conversion failed (%s) — keeping PNG", e)
        return png_bytes


# ── Grouping helpers ──────────────────────────────────────────────

def _group_actors_by_persona(
    actors: list[dict],
    image_data: dict[str, dict],
) -> dict[str, list[dict]]:
    """Group actors by persona archetype, attaching their processed images.

    Persona key is read from actor.face_lock.persona_key (JSONB). Actors
    without a persona key go into an "unassigned" group.

    Parameters
    ----------
    actors : list[dict]
        Actor rows from Neon.
    image_data : dict
        asset_id → image dict from _prepare_images().

    Returns
    -------
    dict
        persona_key → list of actor dicts, each with an "images" key:
        {scene_key: {full_url, cutout_url, shadow_url, ...}}
    """
    # Build actor_id → list of image scene dicts
    actor_images: dict[str, dict[str, dict]] = {}
    for asset_id, img in image_data.items():
        aid = img.get("actor_id", "")
        if not aid:
            continue
        scene = img.get("scene", "default")
        if aid not in actor_images:
            actor_images[aid] = {}
        actor_images[aid][scene] = img

    groups: dict[str, list[dict]] = {}

    for actor in actors:
        actor_id = str(actor.get("id", ""))

        # Extract persona_key from face_lock JSONB
        face_lock = actor.get("face_lock") or {}
        if isinstance(face_lock, str):
            try:
                face_lock = json.loads(face_lock)
            except (json.JSONDecodeError, TypeError):
                face_lock = {}
        persona_key = face_lock.get("persona_key", "unassigned")

        # Attach images dict to actor copy
        actor_with_images = dict(actor)
        actor_with_images["images"] = actor_images.get(actor_id, {})

        if persona_key not in groups:
            groups[persona_key] = []
        groups[persona_key].append(actor_with_images)

    logger.info(
        "Grouped %d actors into %d personas: %s",
        len(actors), len(groups), list(groups.keys()),
    )
    return groups


# ── Copy helpers ──────────────────────────────────────────────────

def _build_copy_lookup(copy_assets: list[dict]) -> dict[str, dict]:
    """Build platform → copy data dict from Stage 3 assets.

    Parameters
    ----------
    copy_assets : list[dict]
        copy-type assets from Neon. content JSONB may wrap copy_data inside.

    Returns
    -------
    dict
        platform → copy data dict.
    """
    channel_copy: dict[str, dict] = {}
    for asset in copy_assets:
        platform = asset.get("platform", "")
        raw = asset.get("content") or asset.get("copy_data") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                raw = {}
        if isinstance(raw, dict) and raw:
            # content may wrap copy_data inside it
            channel_copy[platform] = raw.get("copy_data", raw)
    return channel_copy


def _find_copy(channel_copy: dict, platform: str) -> dict:
    """Fuzzy platform copy matching — exact → fallback chain → first available.

    Parameters
    ----------
    channel_copy : dict
        Output of _build_copy_lookup().
    platform : str
        Target platform key.

    Returns
    -------
    dict
        Copy data for this platform (possibly from a fallback). Empty dict if none.
    """
    if platform in channel_copy:
        return channel_copy[platform]

    fallback_map = {
        "ig_feed": ["facebook_feed", "linkedin_feed"],
        "ig_story": ["tiktok_feed", "whatsapp_story"],
        "tiktok_feed": ["ig_story", "facebook_feed"],
        "telegram_card": ["linkedin_feed", "facebook_feed"],
        "twitter_post": ["linkedin_feed", "facebook_feed"],
        "indeed_banner": ["google_display", "linkedin_feed"],
        "whatsapp_story": ["ig_story", "tiktok_feed"],
        "linkedin_feed": ["facebook_feed", "ig_feed"],
        "facebook_feed": ["linkedin_feed", "ig_feed"],
    }
    for fallback in fallback_map.get(platform, []):
        if fallback in channel_copy:
            return channel_copy[fallback]

    if channel_copy:
        return next(iter(channel_copy.values()))

    return {}


# ── Internal utility ──────────────────────────────────────────────

def _build_persona_dict(
    persona_key: str,
    actors: list[dict],
    context: dict,
) -> dict[str, Any]:
    """Build a persona dict for design_creatives() from available context.

    design_creatives() expects: archetype_key, age_range, lifestyle,
    pain_points, motivations, trigger_words, psychology_profile.

    We reconstruct this from the pipeline context personas list (if present)
    or fall back to a minimal dict derived from the persona_key string.
    """
    # Try to find matching persona from pipeline context
    for p in context.get("personas", []):
        key = (
            p.get("archetype_key")
            or p.get("persona_key")
            or p.get("key")
            or ""
        )
        if key == persona_key or key.lower() == persona_key.lower():
            return p

    # Fallback: minimal persona dict from key
    return {
        "archetype_key": persona_key,
        "age_range": "unknown",
        "lifestyle": persona_key.replace("_", " "),
        "pain_points": [],
        "motivations": [],
        "trigger_words": [],
        "psychology_profile": {},
    }
