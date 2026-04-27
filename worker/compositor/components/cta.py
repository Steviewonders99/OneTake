"""CTA bar components -- OneForma brand-correct gradient pill buttons.

Uses the REAL brand CTA gradient from artifacts: #6B21A8 -> #E91E8C
(Purple -> Pink). Matches cta_pill_filled.html artifact exactly.
Every CTA gets an arrow character.
"""
from __future__ import annotations

from typing import Dict

# ---------------------------------------------------------------------------
# Brand constants -- from worker/brand/oneforma.py PALETTE + artifacts
# ---------------------------------------------------------------------------
_FONT_STACK = "Roboto,-apple-system,system-ui,'Segoe UI',Arial,sans-serif"
_PILL_RADIUS = "9999px"
# CTA gradient from scripts/artifacts/ctas/cta_pill_filled.html
_CTA_GRADIENT = "linear-gradient(135deg,#6B21A8,#E91E8C)"
_CTA_SHADOW = "0 4px 15px rgba(107,33,168,0.4)"
# Brand purple for outline / inline styles
_PURPLE = "#6B21A8"

# ---------------------------------------------------------------------------
# Position CSS snippets
# ---------------------------------------------------------------------------
_POSITION_CSS: Dict[str, str] = {
    "bottom-center": "position:absolute;bottom:24px;left:50%;transform:translateX(-50%)",
    "bottom-right": "position:absolute;bottom:24px;right:24px",
    "bottom-left": "position:absolute;bottom:24px;left:24px",
    "inline": "margin-top:16px",
}


def _wrap_positioned(inner_html: str, position: str) -> str:
    """Wrap *inner_html* in a positioned container div."""
    pos_css = _POSITION_CSS.get(position, _POSITION_CSS["bottom-center"])
    return (
        f'<div class="layer-cta" style="{pos_css}">'
        f"{inner_html}"
        f"</div>"
    )


def render_cta(style: str, text: str, position: str = "bottom-center") -> str:
    """Return positioned CTA HTML for the given *style*.

    Parameters
    ----------
    style:
        One of ``pill_primary``, ``pill_outline``, ``banner_full``,
        ``floating_circle``, ``inline_text``.
    text:
        Button label / CTA copy.
    position:
        One of ``bottom-center``, ``bottom-right``, ``bottom-left``, ``inline``.

    Raises
    ------
    KeyError
        If *style* is unknown.
    """
    if style == "pill_primary":
        # EXACT artifact match: cta_pill_filled.html
        # #6B21A8 -> #E91E8C gradient, white text, uppercase, 16px/700
        btn = (
            f'<span style="display:inline-block;padding:14px 36px;'
            f"background:{_CTA_GRADIENT};color:#FFFFFF;font-family:{_FONT_STACK};"
            f"font-size:16px;font-weight:700;border-radius:{_PILL_RADIUS};"
            f"text-transform:uppercase;letter-spacing:0.5px;"
            f'box-shadow:{_CTA_SHADOW}">'
            f"{text} &#8594;</span>"
        )
        return _wrap_positioned(btn, position)

    if style == "pill_outline":
        # White background, 2px border #6B21A8, text #6B21A8
        btn = (
            f'<span style="display:inline-block;padding:12px 32px;'
            f"background:#FFFFFF;color:{_PURPLE};font-family:{_FONT_STACK};"
            f"font-size:16px;font-weight:700;border-radius:{_PILL_RADIUS};"
            f"border:2px solid {_PURPLE};"
            f'text-transform:uppercase;letter-spacing:0.5px">'
            f"{text} &#8594;</span>"
        )
        return _wrap_positioned(btn, position)

    if style == "banner_full":
        # Full-width gradient banner
        btn = (
            f'<div style="width:100%;padding:16px 0;'
            f"background:{_CTA_GRADIENT};color:#FFFFFF;font-family:{_FONT_STACK};"
            f"font-size:16px;font-weight:700;text-align:center;"
            f"text-transform:uppercase;letter-spacing:0.5px;"
            f'border-radius:12px;box-shadow:{_CTA_SHADOW}">'
            f"{text} &#8594;</div>"
        )
        return _wrap_positioned(btn, position)

    if style == "floating_circle":
        # Gradient circle 64px
        btn = (
            f'<span style="display:inline-flex;align-items:center;justify-content:center;'
            f"width:64px;height:64px;border-radius:50%;background:{_CTA_GRADIENT};"
            f"color:#FFFFFF;font-family:{_FONT_STACK};font-size:14px;font-weight:700;"
            f'text-align:center;line-height:1.2;box-shadow:{_CTA_SHADOW}">'
            f"{text}</span>"
        )
        return _wrap_positioned(btn, position)

    if style == "inline_text":
        # Inline text link with arrow -- brand purple #6B21A8
        btn = (
            f'<span style="display:inline-block;padding:8px 0;'
            f"background:transparent;color:{_PURPLE};font-family:{_FONT_STACK};"
            f'font-size:16px;font-weight:700;letter-spacing:0.5px">'
            f"{text} &#8594;</span>"
        )
        return _wrap_positioned(btn, position)

    raise KeyError(
        f"Unknown CTA style '{style}'. "
        f"Must be one of: pill_primary, pill_outline, banner_full, "
        f"floating_circle, inline_text"
    )
