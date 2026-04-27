"""Component registry — facade the renderer calls to resolve IDs to HTML.

Each ``get_*_html`` function returns a positioned ``<div>`` containing the
rendered layer fragment. The renderer stacks these in z-order to assemble
the final creative.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from compositor.components.backgrounds import render_background
from compositor.components.context_elements import render_context_element
from compositor.components.cta import render_cta
from compositor.components.overlays import render_overlay_elements

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_FONT_STACK = "-apple-system,system-ui,'Segoe UI',Roboto,sans-serif"
_BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))"

# Text size presets — (headline_px, subheadline_px)
_TEXT_SIZES: Dict[str, tuple] = {
    "small": (16, 12),
    "medium": (22, 14),
    "large": (32, 16),
    "hero": (48, 18),
}

# Contrast backdrop CSS snippets
_CONTRAST_BACKDROPS: Dict[str, str] = {
    "none": "",
    "dark_gradient": (
        "background:linear-gradient(180deg,rgba(0,0,0,0.6),rgba(0,0,0,0.85));"
        "padding:24px;border-radius:12px"
    ),
    "light_blur": (
        "background:rgba(255,255,255,0.7);"
        "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);"
        "padding:24px;border-radius:12px"
    ),
    "solid_pill": (
        "background:rgba(0,0,0,0.8);padding:16px 28px;border-radius:9999px"
    ),
    "brand_accent": (
        f"background:{_BRAND_GRADIENT};padding:20px 28px;border-radius:12px"
    ),
}

# Backdrops that imply white text
_DARK_BACKDROPS = frozenset({"dark_gradient", "solid_pill", "brand_accent"})

# Actor mask CSS
_ACTOR_MASKS: Dict[str, str] = {
    "none": "",
    "soft_fade": (
        "-webkit-mask-image:linear-gradient(to bottom,black 60%,transparent 100%);"
        "mask-image:linear-gradient(to bottom,black 60%,transparent 100%)"
    ),
    "circle": "border-radius:50%;overflow:hidden",
    "arch": "border-radius:50% 50% 0 0;overflow:hidden",
    "diagonal": "clip-path:polygon(15% 0,100% 0,100% 100%,0 100%)",
}

# Actor position CSS
_ACTOR_POSITIONS: Dict[str, str] = {
    "left": "position:absolute;left:0;bottom:0",
    "center": "position:absolute;left:50%;transform:translateX(-50%);bottom:0",
    "right": "position:absolute;right:0;bottom:0",
}

# Text position CSS
_TEXT_POSITIONS: Dict[str, str] = {
    "top-left": "position:absolute;top:32px;left:32px",
    "top-center": "position:absolute;top:32px;left:50%;transform:translateX(-50%);text-align:center",
    "top-right": "position:absolute;top:32px;right:32px;text-align:right",
    "center": "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center",
    "bottom-left": "position:absolute;bottom:80px;left:32px",
    "bottom-center": "position:absolute;bottom:80px;left:50%;transform:translateX(-50%);text-align:center",
    "bottom-right": "position:absolute;bottom:80px;right:32px;text-align:right",
    "left": "position:absolute;top:50%;left:32px;transform:translateY(-50%)",
    "right": "position:absolute;top:50%;right:32px;transform:translateY(-50%);text-align:right",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_background_html(
    bg_type: str,
    preset: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    """Return a full ``<div class="layer-background">`` with CSS background.

    Delegates to :func:`compositor.components.backgrounds.render_background`
    for the CSS value, then wraps it in a sized div.
    """
    css_value = render_background(bg_type, preset, width, height)
    return (
        f'<div class="layer-background" style="'
        f"position:absolute;top:0;left:0;width:{width}px;height:{height}px;"
        f'{css_value}">'
        f"</div>"
    )


def get_actor_html(
    photo_url: str,
    position: str = "right",
    scale: float = 0.85,
    mask: str = "none",
) -> str:
    """Return a positioned ``<div class="layer-actor">`` with ``<img>`` and CSS mask."""
    pos_css = _ACTOR_POSITIONS.get(position, _ACTOR_POSITIONS["right"])
    mask_css = _ACTOR_MASKS.get(mask, "")

    # Scale expressed as a percentage of container height
    scale_pct = int(scale * 100)

    img_style = f"display:block;height:{scale_pct}%;width:auto;object-fit:contain"
    if mask_css:
        img_style = f"{img_style};{mask_css}"

    return (
        f'<div class="layer-actor" data-position="{position}" style="{pos_css}">'
        f'<img src="{photo_url}" style="{img_style}" alt="actor"/>'
        f"</div>"
    )


def get_text_block_html(
    headline: str,
    subheadline: str,
    position: str = "top-left",
    size: str = "large",
    contrast_backdrop: str = "none",
) -> str:
    """Return a positioned ``<div class="layer-text">`` with headline/subheadline."""
    pos_css = _TEXT_POSITIONS.get(position, _TEXT_POSITIONS["top-left"])

    h_px, sub_px = _TEXT_SIZES.get(size, _TEXT_SIZES["large"])

    # Text color auto-selection
    text_color = "#FFFFFF" if contrast_backdrop in _DARK_BACKDROPS else "#1A1A1A"

    backdrop_css = _CONTRAST_BACKDROPS.get(contrast_backdrop, "")

    # Build inner content
    headline_html = (
        f'<div style="font-size:{h_px}px;font-weight:700;line-height:1.15;'
        f'font-family:{_FONT_STACK};color:{text_color}">'
        f"{headline}</div>"
    )
    sub_html = ""
    if subheadline:
        sub_html = (
            f'<div style="font-size:{sub_px}px;font-weight:400;line-height:1.4;'
            f"font-family:{_FONT_STACK};color:{text_color};"
            f'margin-top:8px;opacity:0.9">'
            f"{subheadline}</div>"
        )

    # Outer wrapper
    outer_style = pos_css
    if backdrop_css:
        outer_style = f"{outer_style};{backdrop_css}"

    return (
        f'<div class="layer-text" style="{outer_style}">'
        f"{headline_html}{sub_html}"
        f"</div>"
    )


def get_overlay_html(
    elements: Optional[List[str]] = None,
    intensity: str = "medium",
) -> str:
    """Return a decorative overlay div with SVG blobs, gradient bars, etc.

    Delegates to :func:`compositor.components.overlays.render_overlay_elements`
    which resolves element IDs to concrete HTML and wraps them in a
    ``<div class="layer-overlay">``.
    """
    return render_overlay_elements(elements or [], intensity)


def get_context_element_html(
    el_type: str,
    position: str,
    content: str = "",
) -> str:
    """Return positioned HTML for a context element (device mockup, task card, etc.).

    Delegates to :func:`compositor.components.context_elements.render_context_element`.
    """
    return render_context_element(el_type, position, content)


def get_cta_html(
    style: str,
    text: str,
    position: str = "bottom-center",
) -> str:
    """Return positioned CTA HTML — delegates to :func:`compositor.components.cta.render_cta`."""
    return render_cta(style, text, position)
