"""Component registry -- facade the renderer calls to resolve IDs to HTML.

Each ``get_*_html`` function returns a positioned ``<div>`` containing the
rendered layer fragment. The renderer stacks these in z-order to assemble
the final creative.

Brand-correct: all colors, fonts, sizes from worker/brand/oneforma.py.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from compositor.components.backgrounds import render_background
from compositor.components.context_elements import render_context_element
from compositor.components.cta import render_cta
from compositor.components.overlays import render_overlay_elements

# ---------------------------------------------------------------------------
# Constants -- from worker/brand/oneforma.py PALETTE + TYPOGRAPHY
# ---------------------------------------------------------------------------
_FONT_STACK = "Roboto,-apple-system,system-ui,'Segoe UI',Arial,sans-serif"
_BRAND_GRADIENT = "linear-gradient(135deg, #0452BF 0%, #CD128A 100%)"
_CTA_GRADIENT = "linear-gradient(135deg, #6B21A8, #E91E8C)"

# Text size presets -- from TYPOGRAPHY scale
# Maps to (headline_px, subheadline_px, headline_weight, headline_line_height)
_TEXT_SIZES: Dict[str, tuple] = {
    "small":  (22, 16),   # H3: 22px/500
    "medium": (32, 16),   # H2: 32px/700
    "large":  (44, 18),   # H1: 44px/700
    "xlarge": (64, 20),   # Display: 64px/900
    "hero":   (64, 22),   # Display alias
}

# Font weight by size preset (from brand typography)
_TEXT_WEIGHTS: Dict[str, int] = {
    "small": 500,    # H3
    "medium": 700,   # H2
    "large": 700,    # H1
    "xlarge": 900,   # Display
    "hero": 900,     # Display
}

# Line height by size preset (from brand typography)
_TEXT_LINE_HEIGHTS: Dict[str, float] = {
    "small": 1.25,   # H3
    "medium": 1.15,  # H2
    "large": 1.1,    # H1
    "xlarge": 1.05,  # Display
    "hero": 1.05,    # Display
}

# Contrast backdrop CSS snippets -- frosted glass uses brand border #D7E0EA
_CONTRAST_BACKDROPS: Dict[str, str] = {
    "none": "",
    "dark_gradient": (
        "background:linear-gradient(180deg,rgba(0,20,39,0.6),rgba(0,20,39,0.85));"
        "padding:24px;border-radius:12px"
    ),
    "light_blur": (
        "background:rgba(255,255,255,0.85);"
        "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
        "padding:24px;border-radius:20px;"
        "border:1px solid rgba(215,224,234,0.3);"
        "box-shadow:0 8px 32px rgba(0,0,0,0.1)"
    ),
    "frosted_card": (
        "background:rgba(255,255,255,0.85);"
        "backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
        "padding:32px;border-radius:20px;"
        "border:1px solid rgba(215,224,234,0.3);"
        "box-shadow:0 8px 32px rgba(0,0,0,0.1)"
    ),
    "solid_pill": (
        "background:rgba(0,20,39,0.8);padding:16px 28px;border-radius:9999px"
    ),
    "brand_accent": (
        f"background:{_CTA_GRADIENT};padding:20px 28px;border-radius:12px"
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
# OneForma Logo SVG -- brand pink #CD128A for spiral mark
# ---------------------------------------------------------------------------

_ONEFORMA_LOGO_WHITE = (
    '<div style="display:inline-flex;align-items:center;gap:10px">'
    '<svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M20 4C18 4 14 6 12 10C10 14 10 18 12 22C14 26 16 28 20 30'
    'C24 28 26 26 28 22C30 18 30 14 28 10C26 6 22 4 20 4Z" '
    'fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2.5"/>'
    '<path d="M20 8C17 10 15 14 16 18C17 22 19 24 20 26'
    'C21 24 23 22 24 18C25 14 23 10 20 8Z" '
    'fill="rgba(255,255,255,0.9)"/>'
    '</svg>'
    f'<span style="font-family:{_FONT_STACK};'
    'font-size:18px;font-weight:700;color:rgba(255,255,255,0.95);letter-spacing:0.02em">'
    'OneForma</span>'
    '</div>'
)

_ONEFORMA_LOGO_DARK = (
    '<div style="display:inline-flex;align-items:center;gap:10px">'
    '<svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M20 4C18 4 14 6 12 10C10 14 10 18 12 22C14 26 16 28 20 30'
    'C24 28 26 26 28 22C30 18 30 14 28 10C26 6 22 4 20 4Z" '
    'fill="none" stroke="#CD128A" stroke-width="2.5"/>'
    '<path d="M20 8C17 10 15 14 16 18C17 22 19 24 20 26'
    'C21 24 23 22 24 18C25 14 23 10 20 8Z" '
    'fill="#CD128A"/>'
    '</svg>'
    f'<span style="font-family:{_FONT_STACK};'
    'font-size:18px;font-weight:700;color:#001427;letter-spacing:0.02em">'
    'OneForma</span>'
    '</div>'
)


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
    """Return a positioned ``<div class="layer-actor">`` with ``<img>``.

    Actor photos fill their container with object-fit:cover. The layout
    controls sizing -- no percentage-based height here.
    """
    mask_css = _ACTOR_MASKS.get(mask, "")
    return (
        f'<div class="layer-actor" data-position="{position}">'
        f'<img src="{photo_url}" style="display:block;width:100%;height:100%;'
        f'object-fit:cover;object-position:top center;{mask_css}" alt="actor"/>'
        f"</div>"
    )


def get_text_block_html(
    headline: str,
    subheadline: str,
    position: str = "top-left",
    size: str = "large",
    contrast_backdrop: str = "none",
) -> str:
    """Return a positioned ``<div class="layer-text">`` with headline/subheadline.

    Text over photos gets text-shadow for readability. Headlines use
    tight letter-spacing (-0.02em) for agency punch. Colors and sizes
    from brand/oneforma.py TYPOGRAPHY.
    """
    pos_css = _TEXT_POSITIONS.get(position, _TEXT_POSITIONS["top-left"])

    h_px, sub_px = _TEXT_SIZES.get(size, _TEXT_SIZES["large"])
    h_weight = _TEXT_WEIGHTS.get(size, 700)
    h_line = _TEXT_LINE_HEIGHTS.get(size, 1.1)

    # Text color auto-selection -- brand primary #001427 on light, #FFFFFF on dark
    is_dark_backdrop = contrast_backdrop in _DARK_BACKDROPS
    text_color = "#FFFFFF" if is_dark_backdrop else "#001427"

    # Text shadow for readability over photos
    if text_color == "#FFFFFF":
        text_shadow = "text-shadow:0 2px 12px rgba(0,0,0,0.5)"
    elif contrast_backdrop == "none":
        text_shadow = "text-shadow:0 1px 4px rgba(0,0,0,0.1)"
    else:
        text_shadow = ""

    backdrop_css = _CONTRAST_BACKDROPS.get(contrast_backdrop, "")

    # Build inner content
    headline_html = (
        f'<div style="font-size:{h_px}px;font-weight:{h_weight};line-height:{h_line};'
        f"font-family:{_FONT_STACK};color:{text_color};"
        f'letter-spacing:-0.02em;{text_shadow}">'
        f"{headline}</div>"
    )
    sub_html = ""
    if subheadline:
        sub_html = (
            f'<div style="font-size:{sub_px}px;font-weight:400;line-height:1.5;'
            f"font-family:{_FONT_STACK};color:{text_color};"
            f'margin-top:8px;opacity:0.9;{text_shadow}">'
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
    """Return positioned CTA HTML -- delegates to :func:`compositor.components.cta.render_cta`."""
    return render_cta(style, text, position)


def get_logo_html(variant: str = "white") -> str:
    """Return the OneForma logo SVG markup.

    Parameters
    ----------
    variant:
        ``"white"`` for dark/washed backgrounds, ``"dark"`` for light backgrounds.
        Dark variant uses brand pink #CD128A for spiral, #001427 for text.
    """
    if variant == "dark":
        return _ONEFORMA_LOGO_DARK
    return _ONEFORMA_LOGO_WHITE


def get_edge_glow_html() -> str:
    """Return an edge glow overlay div with brand pink/sapphire inset box-shadow.

    Uses brand colors: #CD128A (pink-80) and #0452BF (sapphire-80).
    Creates depth and cinematic feel without a flat colored border.
    """
    return (
        '<div style="position:absolute;top:0;left:0;width:100%;height:100%;'
        'pointer-events:none;z-index:10;'
        'box-shadow:inset 0 0 80px rgba(205,18,138,0.08),'
        'inset 0 0 40px rgba(4,82,191,0.06)">'
        '</div>'
    )
