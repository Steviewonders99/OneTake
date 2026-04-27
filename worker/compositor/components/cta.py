"""CTA bar components — 5 button styles with position support."""
from __future__ import annotations

from typing import Dict

# ---------------------------------------------------------------------------
# Brand constants
# ---------------------------------------------------------------------------
_CHARCOAL = "#32373C"
_FONT_STACK = "-apple-system,system-ui,'Segoe UI',Roboto,sans-serif"
_PILL_RADIUS = "9999px"
_BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))"

# ---------------------------------------------------------------------------
# Position CSS snippets
# ---------------------------------------------------------------------------
_POSITION_CSS: Dict[str, str] = {
    "bottom-center": "position:absolute;bottom:24px;left:50%;transform:translateX(-50%)",
    "bottom-right": "position:absolute;bottom:24px;right:24px",
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
        One of ``bottom-center``, ``bottom-right``, ``inline``.

    Raises
    ------
    KeyError
        If *style* is unknown.
    """
    if style == "pill_primary":
        btn = (
            f'<span style="display:inline-block;padding:12px 32px;'
            f"background:{_CHARCOAL};color:#FFFFFF;font-family:{_FONT_STACK};"
            f"font-size:16px;font-weight:600;border-radius:{_PILL_RADIUS};"
            f'letter-spacing:0.02em">'
            f"{text}</span>"
        )
        return _wrap_positioned(btn, position)

    if style == "pill_outline":
        btn = (
            f'<span style="display:inline-block;padding:12px 32px;'
            f"background:transparent;color:{_CHARCOAL};font-family:{_FONT_STACK};"
            f"font-size:16px;font-weight:600;border-radius:{_PILL_RADIUS};"
            f"border:2px solid {_CHARCOAL};"
            f'letter-spacing:0.02em">'
            f"{text}</span>"
        )
        return _wrap_positioned(btn, position)

    if style == "banner_full":
        btn = (
            f'<div style="width:100%;padding:14px 0;'
            f"background:{_CHARCOAL};color:#FFFFFF;font-family:{_FONT_STACK};"
            f"font-size:16px;font-weight:600;text-align:center;"
            f'letter-spacing:0.02em">'
            f"{text}</div>"
        )
        return _wrap_positioned(btn, position)

    if style == "floating_circle":
        btn = (
            f'<span style="display:inline-flex;align-items:center;justify-content:center;'
            f"width:64px;height:64px;border-radius:50%;background:{_BRAND_GRADIENT};"
            f"color:#FFFFFF;font-family:{_FONT_STACK};font-size:14px;font-weight:700;"
            f'text-align:center;line-height:1.2">'
            f"{text}</span>"
        )
        return _wrap_positioned(btn, position)

    if style == "inline_text":
        btn = (
            f'<span style="display:inline-block;padding:8px 0;'
            f"background:transparent;color:{_CHARCOAL};font-family:{_FONT_STACK};"
            f'font-size:16px;font-weight:600;letter-spacing:0.02em">'
            f"{text} &#8594;</span>"
        )
        return _wrap_positioned(btn, position)

    raise KeyError(
        f"Unknown CTA style '{style}'. "
        f"Must be one of: pill_primary, pill_outline, banner_full, "
        f"floating_circle, inline_text"
    )
