"""Stage 4 — reference-layout composition engine.

This engine renders a typed layer manifest instead of asking an LLM to write
HTML/CSS directly. A future VLM decomposition step can generate the manifest;
today we ship the first premium fixture so the pipeline has a deterministic
path for reference-style recreation and base-image swaps.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from blob_uploader import upload_to_blob
from compositor.reference_renderer import render_reference_html
from compositor.reference_schema import ReferenceCreativeManifest
from compositor.render_png import render_html_to_png
from neon_client import get_actors, get_assets, save_asset

logger = logging.getLogger(__name__)

_FIXTURE_PATH = (
    Path(__file__).resolve().parents[1]
    / "templates"
    / "reference_layouts"
    / "oneforma_pet_frame.json"
)


def _load_manifest_dict(context: dict) -> dict:
    """Resolve the manifest for this request.

    Priority:
      1. ``context["reference_manifest"]`` from a future analyzer/upload flow.
      2. ``form_data.reference_manifest`` if present.
      3. Built-in OneForma pet-frame fixture.
    """
    manifest = context.get("reference_manifest")
    if isinstance(manifest, dict):
        return manifest

    form_data = context.get("form_data", {})
    form_manifest = form_data.get("reference_manifest") if isinstance(form_data, dict) else None
    if isinstance(form_manifest, str):
        try:
            parsed = json.loads(form_manifest)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            logger.warning("form_data.reference_manifest was not valid JSON")
    if isinstance(form_manifest, dict):
        return form_manifest

    with _FIXTURE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _extract_best_copy(copy_assets: List[Dict[str, Any]]) -> Dict[str, str]:
    """Pull a simple headline/subheadline pair from Stage 3 copy assets."""
    for asset in copy_assets:
        candidates = []
        for key in ("content", "copy_data"):
            raw = asset.get(key)
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    raw = {}
            if isinstance(raw, dict):
                candidates.append(raw)

        for data in candidates:
            headline = (
                data.get("overlay_headline")
                or data.get("headline")
                or data.get("primary_text")
                or ""
            )
            subheadline = (
                data.get("overlay_sub")
                or data.get("subheadline")
                or data.get("description")
                or ""
            )
            cta = data.get("cta") or data.get("cta_text") or ""
            if headline:
                return {
                    "headline": str(headline),
                    "subheadline": str(subheadline),
                    "cta": str(cta),
                    "language": str(asset.get("language") or data.get("language") or "en"),
                }
    return {
        "headline": "Get Paid to Spend Time",
        "subheadline": "Take part in a simple, real-life onsite session",
        "cta": "",
        "language": "en",
    }


def _apply_copy(manifest: dict, copy: Dict[str, str]) -> dict:
    """Patch editable text layers while preserving the reference geometry."""
    patched = json.loads(json.dumps(manifest))
    headline = copy.get("headline", "").strip()
    subheadline = copy.get("subheadline", "").strip()

    # Preserve the two-line structure from the reference fixture.
    if headline:
        words = headline.split()
        midpoint = max(1, min(len(words) - 1, (len(words) + 1) // 2))
        line_1 = " ".join(words[:midpoint])
        line_2 = " ".join(words[midpoint:])
    else:
        line_1 = "Get Paid to Spend Time"
        line_2 = "with Your Pet"

    for layer in patched.get("layers", []):
        role = layer.get("role")
        if role == "headline_primary":
            layer["text"] = line_1
        elif role == "headline_secondary":
            layer["text"] = line_2
        elif role == "subheadline" and subheadline:
            layer["text"] = subheadline.replace(". ", ".\n")
    return patched


def _attach_photo_urls(
    actors: List[Dict[str, Any]],
    image_assets: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    actor_photos: Dict[str, str] = {}
    for asset in image_assets:
        aid = str(asset.get("actor_id", ""))
        url = asset.get("blob_url", "")
        if aid and url and aid not in actor_photos:
            actor_photos[aid] = url

    for actor in actors:
        aid = str(actor.get("id", actor.get("actor_id", "")))
        actor["actor_id"] = aid
        actor["photo_url"] = actor.get("photo_url") or actor_photos.get(aid, "")
    return actors


async def _render_and_save_one(
    request_id: str,
    actor: Dict[str, Any],
    manifest_dict: dict,
    copy: Dict[str, str],
    country: str | None,
) -> int:
    manifest_with_copy = _apply_copy(manifest_dict, copy)
    manifest = ReferenceCreativeManifest.from_dict(manifest_with_copy)
    html = render_reference_html(
        manifest,
        replacements={"base_photo": actor["photo_url"]},
        editable=True,
    )
    png_bytes = await render_html_to_png(html, manifest.canvas.width, manifest.canvas.height)

    actor_name = str(actor.get("name") or "actor").lower().replace(" ", "_")
    filename_base = f"{request_id}_{actor_name}_{manifest.name}"

    png_url = await upload_to_blob(
        png_bytes,
        f"{filename_base}.png",
        folder="generated/stage4_reference",
        content_type="image/png",
    )
    html_url = await upload_to_blob(
        html.encode("utf-8"),
        f"{filename_base}.html",
        folder="generated/stage4_reference_html",
        content_type="text/html",
    )

    metadata = {
        "engine": "reference_layout_agent",
        "manifest_name": manifest.name,
        "manifest_version": manifest.version,
        "actor_id": actor.get("actor_id"),
        "actor_name": actor.get("name", ""),
        "width": manifest.canvas.width,
        "height": manifest.canvas.height,
        "html_url": html_url,
        "html": html,
        "vqa_score": 1.0,
        "headline": copy.get("headline", ""),
        "subheadline": copy.get("subheadline", ""),
        "cta": copy.get("cta", ""),
        "language": copy.get("language", "en"),
        "layer_manifest": [
            {"id": layer.id, "role": layer.role, "type": layer.type, "z": layer.z}
            for layer in manifest.layers
        ],
    }

    await save_asset(
        request_id,
        {
            "asset_type": "composed_creative",
            "platform": "reference_square",
            "format": f"{manifest.canvas.width}x{manifest.canvas.height}",
            "language": copy.get("language", "en"),
            "blob_url": png_url,
            "stage": 4,
            "country": country,
            "metadata": metadata,
        },
    )
    logger.info("Saved reference-layout creative for actor=%s", actor.get("name"))
    return 1


async def run_stage4(context: dict) -> dict:
    request_id: str = context["request_id"]
    country: str | None = context.get("country")
    logger.info("Stage 4 (reference_layout_agent) start: request_id=%s", request_id)

    actors = context.get("actors") or await get_actors(request_id)
    if not actors:
        logger.warning("No actors found for request %s", request_id)
        return {"asset_count": 0}

    image_assets = await get_assets(request_id, asset_type="base_image")
    actors = _attach_photo_urls(actors, image_assets)
    actors = [a for a in actors if a.get("photo_url")]
    if not actors:
        logger.warning("No actor photos found for request %s", request_id)
        return {"asset_count": 0}

    copy = _extract_best_copy(await get_assets(request_id, asset_type="copy"))
    manifest_dict = _load_manifest_dict(context)

    tasks = [
        _render_and_save_one(request_id, actor, manifest_dict, copy, country)
        for actor in actors[:4]
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    asset_count = 0
    for result in results:
        if isinstance(result, Exception):
            logger.error("Reference-layout render failed: %s", result, exc_info=True)
        else:
            asset_count += int(result)

    logger.info("Stage 4 (reference_layout_agent) complete: %d assets", asset_count)
    return {"asset_count": asset_count}
