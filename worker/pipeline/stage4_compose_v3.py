"""Stage 4 v3: Artifact-Driven Creative Composition Engine.

Replaces v2's bg-removal / overlay-only approach with an artifact catalog
approach: pre-built SVG blobs, gradient backgrounds, CTA buttons, and
mask shapes are loaded from Neon (design_artifacts), injected into a
GLM-5 prompt, and assembled into complete HTML creatives.

Key differences from v2:
  - No bg removal (full actor photos used throughout)
  - No overlay PNG rendering (single composed PNG per creative)
  - No AVIF conversion
  - Artifact catalog injected into GLM-5 prompt
  - Archetype selected per (pillar, platform) via archetype_selector
  - Top 2 pillars (from pillar_weighting) × actors × platforms

Pipeline:
  1. Load artifact catalog from design_artifacts (Neon)
  2. Attach actor photo URLs from base_image assets
  3. Build pillar → platform → copy lookup from copy assets
  4. Resolve platforms from brief channels
  5. Build composition matrix: actor × pillar (top 2) × platform
  6. Run compositions with asyncio.Semaphore (COMPOSE_CONCURRENCY)
  7. Per composition: build prompt → call GLM-5 → render PNG →
     VQA gate → retry with feedback if needed → save to Blob + Neon
  8. Return {"asset_count": int}
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from typing import Any

import httpx

from ai.compositor import PLATFORM_SPECS, render_to_png
from ai.creative_vqa import CREATIVE_VQA_THRESHOLD, evaluate_creative
from blob_uploader import upload_to_blob
from config import (
    COMPOSE_CONCURRENCY,
    NVIDIA_NIM_BASE_URL,
    NVIDIA_NIM_DESIGN_MODEL,
)
from neon_client import get_active_artifacts, get_actors, get_assets, save_asset
from nim_key_pool import get_nim_key
from pipeline.archetype_selector import select_archetype
from pipeline.stage4_graphic_copy import generate_graphic_copy
from prompts.compositor_prompt import build_compositor_prompt, filter_catalog, inject_vqa_feedback
from prompts.design_base_knowledge import get_base_knowledge, classify_persona_type, get_template_recs
from prompts.project_context import build_project_context

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

MAX_RETRIES = 3  # Total retry attempts after initial failure

DEFAULT_PLATFORMS = ["ig_feed", "linkedin_feed", "facebook_feed", "ig_story"]

CHANNEL_TO_PLATFORM: dict[str, str] = {
    "instagram": "ig_feed",
    "instagram feed": "ig_feed",
    "ig": "ig_feed",
    "instagram stories": "ig_story",
    "ig stories": "ig_story",
    "ig story": "ig_story",
    "facebook": "facebook_feed",
    "facebook feed": "facebook_feed",
    "fb": "facebook_feed",
    "linkedin": "linkedin_feed",
    "linkedin feed": "linkedin_feed",
    "tiktok": "tiktok_feed",
    "tiktok feed": "tiktok_feed",
    "telegram": "telegram_card",
    "telegram card": "telegram_card",
    "twitter": "twitter_post",
    "x": "twitter_post",
    "x/twitter": "twitter_post",
    "wechat": "wechat_moments",
    "wechat moments": "wechat_moments",
    "whatsapp": "whatsapp_story",
    "whatsapp status": "whatsapp_story",
    "google display": "google_display",
    "google ads": "google_display",
    "indeed": "indeed_banner",
}


# ── Main entry point ───────────────────────────────────────────────────────

async def run_stage4(context: dict) -> dict:
    """Artifact-driven composition: build GLM-5 prompts, render, VQA, save.

    Parameters
    ----------
    context : dict
        Must contain ``request_id``. May contain ``brief``, ``design_direction``,
        ``personas``, ``feedback``, ``actors``.

    Returns
    -------
    dict
        ``{"asset_count": int}``
    """
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design_direction: dict = context.get("design_direction", {})
    feedback: str | None = context.get("feedback")

    logger.info("Stage 4 v3 start: request_id=%s", request_id)

    # ── 1. Load artifact catalog ────────────────────────────────────────
    catalog = await get_active_artifacts()
    if not catalog:
        logger.warning("No active design artifacts found — stage 4 v3 cannot compose")
        return {"asset_count": 0}

    logger.info("Artifact catalog loaded: %d artifacts", len(catalog))

    # ── 2. Load actors ──────────────────────────────────────────────────
    # Prefer pre-loaded actors from context (set by orchestrator), else fetch.
    actors: list[dict] = context.get("actors") or await get_actors(request_id)
    if not actors:
        logger.warning("No actors found for request %s — skipping stage 4", request_id)
        return {"asset_count": 0}

    # ── 3. Load base_image assets and attach photo URLs to actors ───────
    image_assets = await get_assets(request_id, asset_type="base_image")
    actors = _attach_photo_urls(actors, image_assets)

    # ── 4. Load copy assets, build lookup ───────────────────────────────
    copy_assets = await get_assets(request_id, asset_type="copy")
    copy_lookup = _build_copy_lookup(copy_assets)

    # ── 5. Resolve platforms from brief channels ─────────────────────────
    channels_dict = brief.get("channels", {})
    all_channels = (
        channels_dict.get("primary", []) + channels_dict.get("secondary", [])
        if isinstance(channels_dict, dict)
        else list(channels_dict) if isinstance(channels_dict, list)
        else []
    )
    if all_channels:
        platforms = _resolve_channels(all_channels)
        logger.info("Platforms from brief channels: %s", platforms)
    elif design_direction.get("format_matrix"):
        platforms = list(design_direction["format_matrix"].keys())
        logger.info("Platforms from design format_matrix: %s", platforms)
    else:
        platforms = DEFAULT_PLATFORMS
        logger.info("Using default platforms: %s", platforms)

    # Filter to only platforms with known PLATFORM_SPECS
    platforms = [p for p in platforms if p in PLATFORM_SPECS]
    if not platforms:
        platforms = DEFAULT_PLATFORMS

    # ── 6. Get derived_requirements for pillar_weighting and visual_direction
    derived: dict = brief.get("derived_requirements", {})
    pillar_weighting: dict = derived.get("pillar_weighting", {})
    visual_direction: dict = derived.get("visual_direction", {})

    # Load cultural research, personas, and strategies from context
    cultural_research: dict = context.get("cultural_research", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    strategies: list[dict] = context.get("strategies", [])

    # Top 2 pillars by weight (fallback to ["earn", "grow"])
    top_pillars = _get_top_pillars(pillar_weighting)
    logger.info("Top 2 pillars for composition: %s", top_pillars)

    # ── 7. Build composition matrix and dispatch ─────────────────────────
    semaphore = asyncio.Semaphore(COMPOSE_CONCURRENCY)
    matrix = _build_composition_matrix(actors, top_pillars, platforms)

    logger.info(
        "Composition matrix: %d tasks (%d actors × %d pillars × %d platforms)",
        len(matrix),
        len(actors),
        len(top_pillars),
        len(platforms),
    )

    tasks = [
        _compose_one(
            semaphore=semaphore,
            request_id=request_id,
            actor=item["actor"],
            pillar=item["pillar"],
            platform=item["platform"],
            catalog=catalog,
            copy_lookup=copy_lookup,
            visual_direction=visual_direction,
            brief=brief,
            user_feedback=feedback,
            cultural_research=cultural_research,
            personas=personas,
            strategies=strategies,
        )
        for item in matrix
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    asset_count = 0
    for r in results:
        if isinstance(r, Exception):
            logger.error("Composition task failed: %s", r)
        elif isinstance(r, int):
            asset_count += r

    logger.info("Stage 4 v3 complete: %d composed creatives saved", asset_count)
    return {"asset_count": asset_count}


# ── Composition worker ─────────────────────────────────────────────────────

async def _compose_one(
    semaphore: asyncio.Semaphore,
    request_id: str,
    actor: dict,
    pillar: str,
    platform: str,
    catalog: list[dict],
    copy_lookup: dict,
    visual_direction: dict,
    brief: dict,
    user_feedback: str | None,
    cultural_research: dict | None = None,
    personas: list[dict] | None = None,
    strategies: list[dict] | None = None,
) -> int:
    """Compose one creative: prompt → LLM → render → VQA → save.

    Returns number of assets saved (0 or 1).
    """
    async with semaphore:
        spec = PLATFORM_SPECS[platform]
        w, h = spec["width"], spec["height"]
        actor_name = actor.get("name", "contributor")

        logger.info(
            "Composing: actor=%s pillar=%s platform=%s (%dx%d)",
            actor_name, pillar, platform, w, h,
        )

        # Resolve copy for this pillar/platform
        copy = _get_copy_for_pillar_platform(copy_lookup, pillar, platform)

        # ── Phase 1: Match actor to persona ──────────────────────────
        actor_name_full = actor.get("name", "")
        matched_persona = {}
        for p in (personas or []):
            pname = p.get("persona_name", p.get("name", ""))
            if pname and actor_name_full and (
                pname.lower().startswith(actor_name_full.split()[0].lower()) or
                actor_name_full.lower().startswith(pname.split()[0].lower())
            ):
                matched_persona = p
                break
        if not matched_persona and personas:
            matched_persona = personas[0]

        # Resolve strategy for persona's region
        persona_region = matched_persona.get("region", "")
        matched_strategy = {}
        for s in (strategies or []):
            if isinstance(s, dict) and s.get("country", "").upper() == persona_region.upper():
                matched_strategy = s.get("strategy_data", s)
                break

        # Build project context (diamond persona mini brief)
        project_ctx = build_project_context(
            request=brief,
            brief=brief,
            persona=matched_persona,
            cultural_research=cultural_research,
            strategy=matched_strategy,
            stage3_copy=copy,
        )

        # Generate graphic copy via Phase 1 (Gemma 4)
        base_knowledge = get_base_knowledge()
        graphic_copy = await generate_graphic_copy(
            base_knowledge=base_knowledge,
            project_context=project_ctx,
            language=copy.get("language", "en"),
            platform=platform,
            platform_spec=spec,
        )

        # Filter artifact catalog for this pillar/platform
        filtered_catalog = filter_catalog(catalog, pillar, platform)

        # Select archetype
        archetype = select_archetype(pillar, visual_direction, platform)

        # Build initial prompt (Phase 2 — compositor receives Phase 1 graphic copy)
        prompt = build_compositor_prompt(
            catalog=filtered_catalog,
            archetype=archetype,
            platform=platform,
            platform_spec=spec,
            pillar=pillar,
            actor=actor,
            copy=graphic_copy,
            visual_direction=visual_direction,
            project_context=project_ctx,
            design_intent=graphic_copy.get("design_intent", ""),
        )

        # If user feedback exists, append to initial prompt
        if user_feedback:
            prompt = f"{prompt}\n\n---\n\nAdditional context from reviewer:\n{user_feedback}"

        design: dict | None = None
        rendered_png: bytes | None = None
        vqa_result: dict | None = None
        attempts = 0

        # ── Initial attempt ────────────────────────────────────────────
        raw = await _call_compositor_model(prompt)
        design = _parse_compositor_response(raw)

        if not design or not design.get("html"):
            logger.warning(
                "No HTML in compositor response for actor=%s pillar=%s platform=%s",
                actor_name, pillar, platform,
            )
            return 0

        try:
            rendered_png = await render_to_png(design["html"], w, h)
        except Exception as exc:
            logger.error("Render failed for actor=%s platform=%s: %s", actor_name, platform, exc)
            return 0

        vqa_result = await evaluate_creative(
            design=design, rendered_png=rendered_png, spec=spec, platform=platform,
        )
        attempts = 1

        # ── Retry loop ─────────────────────────────────────────────────
        while not vqa_result.get("passed", False) and attempts <= MAX_RETRIES:
            score = vqa_result.get("score", 0)
            logger.info(
                "  VQA FAIL (score=%.2f) attempt %d/%d — retrying with feedback",
                score, attempts, MAX_RETRIES + 1,
            )

            retry_prompt = inject_vqa_feedback(prompt, vqa_result)
            raw = await _call_compositor_model(retry_prompt)
            retry_design = _parse_compositor_response(raw)

            if not retry_design or not retry_design.get("html"):
                logger.warning("Retry returned no HTML — keeping previous design")
                break

            try:
                retry_png = await render_to_png(retry_design["html"], w, h)
            except Exception as exc:
                logger.warning("Retry render failed: %s — keeping previous design", exc)
                break

            retry_vqa = await evaluate_creative(
                design=retry_design, rendered_png=retry_png, spec=spec, platform=platform,
            )
            attempts += 1

            # Accept if improved, even if still below threshold
            if retry_vqa.get("score", 0) >= vqa_result.get("score", 0):
                design = retry_design
                rendered_png = retry_png
                vqa_result = retry_vqa

            if vqa_result.get("passed", False):
                break

        # ── Save (always save, even if VQA failed after retries) ───────
        final_score = vqa_result.get("score", 0.0) if vqa_result else 0.0
        final_passed = vqa_result.get("passed", False) if vqa_result else False

        logger.info(
            "  Final: actor=%s pillar=%s platform=%s score=%.2f (%s) attempts=%d",
            actor_name, pillar, platform, final_score,
            "PASS" if final_passed else "FAIL", attempts,
        )

        return await _save_composition(
            request_id=request_id,
            actor=actor,
            design=design,
            rendered_png=rendered_png,
            platform=platform,
            pillar=pillar,
            archetype=archetype,
            spec=spec,
            copy=copy,
            vqa_result=vqa_result,
            attempts=attempts,
        )


# ── NIM API call ───────────────────────────────────────────────────────────

async def _call_compositor_model(prompt: str) -> str:
    """Call GLM-5 via NIM and return the raw response text.

    Handles 429 rate limiting with exponential backoff (up to 3 attempts).
    """
    api_key = get_nim_key()
    backoff = 5.0

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{NVIDIA_NIM_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": NVIDIA_NIM_DESIGN_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 4096,
                    },
                )

                if resp.status_code == 429:
                    logger.warning(
                        "NIM rate limit (attempt %d) — waiting %.1fs", attempt + 1, backoff
                    )
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    # Rotate to next key on 429
                    api_key = get_nim_key()
                    continue

                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning(
                    "NIM 429 (attempt %d) — waiting %.1fs", attempt + 1, backoff
                )
                await asyncio.sleep(backoff)
                backoff *= 2
                api_key = get_nim_key()
                continue
            logger.error("NIM HTTP error: %s", exc)
            return ""
        except Exception as exc:
            logger.error("NIM call failed: %s", exc)
            return ""

    logger.error("NIM call failed after 3 attempts (rate limit)")
    return ""


# ── Save composition ───────────────────────────────────────────────────────

async def _save_composition(
    request_id: str,
    actor: dict,
    design: dict,
    rendered_png: bytes,
    platform: str,
    pillar: str,
    archetype: str,
    spec: dict,
    copy: dict,
    vqa_result: dict | None,
    attempts: int,
) -> int:
    """Upload PNG + HTML to Blob, save asset record to Neon. Returns 1 on success."""
    actor_id = str(actor.get("actor_id", actor.get("id", "")))
    actor_name = actor.get("name", "contributor").lower().replace(" ", "_")
    uid = uuid.uuid4().hex[:8]

    # Upload PNG
    png_filename = f"{actor_name}_{pillar}_{platform}_{uid}.png"
    try:
        png_url = await upload_to_blob(
            rendered_png, png_filename, folder="stage4_v3", content_type="image/png"
        )
    except Exception as exc:
        logger.error("Failed to upload PNG: %s", exc)
        return 0

    # Upload HTML source
    html_bytes = design.get("html", "").encode("utf-8")
    html_filename = f"{actor_name}_{pillar}_{platform}_{uid}.html"
    try:
        html_url = await upload_to_blob(
            html_bytes, html_filename, folder="stage4_v3_html", content_type="text/html"
        )
    except Exception as exc:
        logger.warning("Failed to upload HTML source: %s — proceeding without it", exc)
        html_url = ""

    vqa_score = (vqa_result or {}).get("score", 0.0)
    vqa_passed = (vqa_result or {}).get("passed", False)

    metadata: dict[str, Any] = {
        "actor_id": actor_id,
        "actor_name": actor.get("name", ""),
        "pillar": pillar,
        "archetype": archetype,
        "platform": platform,
        "width": spec["width"],
        "height": spec["height"],
        "vqa_score": vqa_score,
        "vqa_passed": vqa_passed,
        "vqa_issues": (vqa_result or {}).get("issues", []),
        "compose_attempts": attempts,
        "artifacts_used": design.get("artifacts_used", []),
        "layer_manifest": design.get("layer_manifest", []),
        "html_url": html_url,
        "headline": copy.get("headline", ""),
        "subheadline": copy.get("subheadline", ""),
        "cta": copy.get("cta", ""),
        "language": copy.get("language", "en"),
        "version": 3,
    }

    await save_asset(
        request_id,
        {
            "asset_type": "composed_creative",
            "platform": platform,
            "format": "png",
            "language": copy.get("language", "en"),
            "blob_url": png_url,
            "stage": 4,
            "metadata": metadata,
        },
    )

    logger.info(
        "  Saved: actor=%s pillar=%s platform=%s vqa=%.2f",
        actor.get("name"), pillar, platform, vqa_score,
    )
    return 1


# ── Pure logic helpers ─────────────────────────────────────────────────────

def _resolve_channels(channel_list: list[str]) -> list[str]:
    """Convert human-readable channel names to PLATFORM_SPECS keys.

    Strips annotations like "WhatsApp (98.3% penetração)" → "whatsapp"
    before lookup. Deduplicates while preserving order.

    Parameters
    ----------
    channel_list : list[str]
        Raw channel names from brief (may include stats in parentheses).

    Returns
    -------
    list[str]
        Deduplicated platform keys (e.g. "ig_feed", "linkedin_feed").
    """
    resolved: list[str] = []
    for ch in channel_list:
        # Strip everything after "(" — handles "WhatsApp (98.3% penetração)"
        clean = ch.split("(")[0].lower().strip()
        key = CHANNEL_TO_PLATFORM.get(clean, clean.replace(" ", "_"))
        if key not in resolved:
            resolved.append(key)
    return resolved


def _get_top_pillars(pillar_weighting: dict[str, float]) -> list[str]:
    """Return top 2 pillars by weight. Falls back to ["earn", "grow"]."""
    if not pillar_weighting:
        return ["earn", "grow"]
    sorted_pillars = sorted(pillar_weighting.items(), key=lambda kv: kv[1], reverse=True)
    return [p for p, _ in sorted_pillars[:2]]


def _build_composition_matrix(
    actors: list[dict],
    pillars: list[str],
    platforms: list[str],
) -> list[dict[str, Any]]:
    """Build actor × pillar × platform composition matrix.

    Returns one entry per (actor, pillar, platform) combination.
    Actors without photo URLs are excluded.

    Parameters
    ----------
    actors : list[dict]
        Actor profile dicts (must have photo_url attached).
    pillars : list[str]
        Top 2 pillars to compose for.
    platforms : list[str]
        Target platform keys.

    Returns
    -------
    list[dict]
        Each dict: {"actor": ..., "pillar": ..., "platform": ...}
    """
    matrix: list[dict[str, Any]] = []
    for actor in actors:
        if not actor.get("photo_url"):
            logger.debug(
                "Actor '%s' has no photo_url — skipping from matrix",
                actor.get("name", "?"),
            )
            continue
        for pillar in pillars:
            for platform in platforms:
                matrix.append({"actor": actor, "pillar": pillar, "platform": platform})
    return matrix


def _parse_compositor_response(raw: str) -> dict[str, Any]:
    """Parse GLM-5 response into a design dict.

    Handles three formats:
    1. Raw JSON object
    2. Markdown-fenced JSON (```json ... ```)
    3. Brace-matching fallback for partial responses

    Parameters
    ----------
    raw : str
        Raw LLM response text.

    Returns
    -------
    dict
        Parsed design dict, or empty dict on failure.
    """
    if not raw:
        return {}

    # ── 1. Try direct JSON parse ───────────────────────────────────────
    stripped = raw.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # ── 2. Try markdown fence extraction ──────────────────────────────
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # ── 3. Brace-matching fallback — find outermost {...} ─────────────
    start = stripped.find("{")
    if start == -1:
        logger.warning("No JSON object found in compositor response")
        return {}

    depth = 0
    end = -1
    in_string = False
    escape_next = False

    for i, ch in enumerate(stripped[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    if end == -1:
        logger.warning("Could not find matching closing brace in compositor response")
        return {}

    try:
        return json.loads(stripped[start : end + 1])
    except json.JSONDecodeError as exc:
        logger.warning("Brace-matched JSON parse failed: %s", exc)
        return {}


def _build_copy_lookup(copy_assets: list[dict]) -> dict[str, dict[str, Any]]:
    """Build a two-level lookup: pillar → platform → copy_data.

    Falls back to a flat platform → copy_data mapping when pillar info
    is absent from the asset metadata.

    Parameters
    ----------
    copy_assets : list[dict]
        ``asset_type="copy"`` rows from ``get_assets()``.

    Returns
    -------
    dict
        ``{"pillar_key": {"platform_key": copy_data_dict, ...}, ...}``
        Plus a ``"__any__"`` top-level key containing platform → copy for
        assets with no pillar, so ``_get_copy_for_pillar_platform`` can
        fall back to them.
    """
    lookup: dict[str, dict[str, Any]] = {}

    for asset in copy_assets:
        # copy_data is the primary source; content is fallback
        data = asset.get("copy_data") or asset.get("content") or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                data = {}

        platform = (asset.get("platform") or "").lower().strip() or "global"

        # Pillar may be stored in content/metadata under "pillar" key
        meta = asset.get("content") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        pillar = (meta.get("pillar") or data.get("pillar") or "__any__").lower().strip()

        if pillar not in lookup:
            lookup[pillar] = {}
        lookup[pillar][platform] = data

    return lookup


def _get_copy_for_pillar_platform(
    copy_lookup: dict[str, dict[str, Any]],
    pillar: str,
    platform: str,
) -> dict[str, Any]:
    """Find the best matching copy for a (pillar, platform) pair.

    Matching priority:
    1. Exact pillar + exact platform
    2. Exact pillar + "global" fallback platform
    3. "__any__" pillar + exact platform
    4. "__any__" pillar + "global"
    5. Empty dict (no copy available — GLM-5 will use brand defaults)

    Parameters
    ----------
    copy_lookup : dict
        Output of ``_build_copy_lookup()``.
    pillar : str
        Pillar key (e.g. "earn", "grow", "shape").
    platform : str
        Platform key (e.g. "ig_feed", "linkedin_feed").

    Returns
    -------
    dict
        Copy data with keys like headline, subheadline, cta, language.
    """
    pillar_map = copy_lookup.get(pillar, {})

    # 1. Exact match
    if platform in pillar_map:
        return pillar_map[platform]

    # 2. Pillar + global fallback
    if "global" in pillar_map:
        return pillar_map["global"]

    # 3. Any pillar + exact platform
    any_map = copy_lookup.get("__any__", {})
    if platform in any_map:
        return any_map[platform]

    # 4. Any pillar + global
    if "global" in any_map:
        return any_map["global"]

    # 5. First available copy from any pillar/platform
    for _pillar, pmap in copy_lookup.items():
        if pmap:
            first = next(iter(pmap.values()))
            return first

    return {}


def _attach_photo_urls(actors: list[dict], image_assets: list[dict]) -> list[dict]:
    """Attach photo_url and cutout_url to each actor dict from image assets.

    Matches images to actors via actor_id. Takes the first available image
    per actor. Actors with no matching image get an empty photo_url.

    Parameters
    ----------
    actors : list[dict]
        Actor profile dicts from ``get_actors()``.
    image_assets : list[dict]
        ``asset_type="base_image"`` assets from ``get_assets()``.

    Returns
    -------
    list[dict]
        Actors with ``photo_url`` and ``cutout_url`` fields added.
    """
    # Build actor_id → first image mapping
    actor_image_map: dict[str, dict] = {}
    for asset in image_assets:
        aid = str(asset.get("actor_id", ""))
        if aid and aid not in actor_image_map:
            meta = asset.get("content") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except json.JSONDecodeError:
                    meta = {}
            actor_image_map[aid] = {
                "photo_url": asset.get("blob_url", ""),
                "cutout_url": meta.get("cutout_url", asset.get("blob_url", "")),
                "scene": meta.get("scene", "default"),
            }

    enriched = []
    for actor in actors:
        actor_id = str(actor.get("id", ""))
        img = actor_image_map.get(actor_id, {})
        enriched_actor = dict(actor)
        enriched_actor.setdefault("photo_url", img.get("photo_url", ""))
        enriched_actor.setdefault("cutout_url", img.get("cutout_url", ""))
        enriched.append(enriched_actor)

    actors_with_photos = sum(1 for a in enriched if a.get("photo_url"))
    logger.info(
        "Actors enriched: %d total, %d with photos", len(enriched), actors_with_photos
    )
    return enriched
