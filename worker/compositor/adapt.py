"""Phase 2 aspect ratio adaptation — deterministic format variants.

Takes an approved 1080x1080 creative config and produces all platform format
variants (square, tall, wide) by adjusting layout parameters and re-rendering.

No LLM call required — purely config adjustments + re-render.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List

from compositor.renderer import assemble_html
from compositor.render_png import render_html_to_png
from compositor.schema import CreativeConfig

# ---------------------------------------------------------------------------
# Platform format definitions
# ---------------------------------------------------------------------------

PLATFORM_FORMATS: Dict[str, Dict[str, Any]] = {
    "square": {"width": 1080, "height": 1080, "platforms": ["meta_feed"]},
    "tall": {"width": 1080, "height": 1920, "platforms": ["meta_story", "tiktok", "snapchat"]},
    "wide": {"width": 1200, "height": 627, "platforms": ["linkedin", "reddit"]},
}


def adapt_config_for_format(config_dict: dict, fmt: str) -> dict:
    """Deep-copy a creative config dict and adjust for the target format.

    Parameters
    ----------
    config_dict:
        Original creative config dictionary (1080x1080 square format).
    fmt:
        Target format key — one of ``"square"``, ``"tall"``, ``"wide"``.

    Returns
    -------
    dict
        Adapted config dict ready for ``CreativeConfig.from_dict()``.

    Raises
    ------
    ValueError
        If *fmt* is not a recognised format key.
    """
    if fmt not in PLATFORM_FORMATS:
        raise ValueError(
            f"Unknown format '{fmt}'. Must be one of {sorted(PLATFORM_FORMATS)}"
        )

    adapted = copy.deepcopy(config_dict)

    if fmt == "square":
        # No changes needed — this is the default format.
        return adapted

    if fmt == "tall":
        # 9:16 — more vertical space, actor can be larger, push text to bottom
        # so it doesn't compete with the actor in the upper area.
        actor = adapted.get("actor", {})
        actor["scale"] = min(actor.get("scale", 0.7) + 0.1, 1.0)
        adapted["actor"] = actor

        text = adapted.get("text", {})
        position = text.get("position", "")
        if position.startswith("top"):
            # top-left -> bottom-left, top-right -> bottom-right, top-center -> bottom-center
            text["position"] = position.replace("top", "bottom", 1)
        adapted["text"] = text

    elif fmt == "wide":
        # 1.91:1 — landscape, push centered actor to right, shrink slightly.
        actor = adapted.get("actor", {})
        if actor.get("position") == "center":
            actor["position"] = "right"
        actor["scale"] = max(actor.get("scale", 0.7) - 0.1, 0.5)
        adapted["actor"] = actor

    return adapted


async def adapt_creative(
    config_dict: dict,
    actor_photo_url: str,
) -> List[Dict[str, Any]]:
    """Produce all platform format variants for a single creative config.

    For each format in :data:`PLATFORM_FORMATS`, adapts the config,
    assembles HTML, and renders to PNG.

    Parameters
    ----------
    config_dict:
        Original creative config dictionary (1080x1080 square format).
    actor_photo_url:
        Absolute URL (or base64 data-URI) for the actor photo.

    Returns
    -------
    list[dict]
        One entry per format with keys:
        ``format``, ``width``, ``height``, ``html``, ``png``, ``platforms``.
    """
    results: List[Dict[str, Any]] = []

    for fmt_name, fmt_spec in PLATFORM_FORMATS.items():
        width = fmt_spec["width"]
        height = fmt_spec["height"]
        platforms = fmt_spec["platforms"]

        # 1. Adapt config for this format
        adapted_dict = adapt_config_for_format(config_dict, fmt_name)

        # 2. Parse into validated CreativeConfig
        config = CreativeConfig.from_dict(adapted_dict)

        # 3. Assemble HTML
        html = assemble_html(config, actor_photo_url, width, height)

        # 4. Render to PNG
        png = await render_html_to_png(html, width, height)

        results.append({
            "format": fmt_name,
            "width": width,
            "height": height,
            "html": html,
            "png": png,
            "platforms": platforms,
        })

    return results
