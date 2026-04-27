"""Context element components -- show what the contributor will actually do.

Device mockups, task cards, stat badges, and icon clusters that give
prospective contributors a concrete preview of the work experience.

All colors from worker/brand/oneforma.py PALETTE.

Export :func:`render_context_element` which returns a positioned HTML fragment.
"""
from __future__ import annotations

from typing import Dict

# ---------------------------------------------------------------------------
# Brand constants -- from worker/brand/oneforma.py
# ---------------------------------------------------------------------------
_FONT_STACK = "Roboto,-apple-system,system-ui,'Segoe UI',Arial,sans-serif"
_BRAND_GRADIENT = "linear-gradient(135deg, #0452BF 0%, #CD128A 100%)"
_TEXT_PRIMARY = "#001427"
_TEXT_SECONDARY = "#495766"
_BG_UI = "#F1F4F9"
_BORDER = "#D7E0EA"

# ---------------------------------------------------------------------------
# Position CSS map
# ---------------------------------------------------------------------------
_POSITION_CSS: Dict[str, str] = {
    "bottom-left": "bottom:24px;left:24px;",
    "bottom-right": "bottom:24px;right:24px;",
    "center-left": "top:50%;left:24px;transform:translateY(-50%);",
    "center-right": "top:50%;right:24px;transform:translateY(-50%);",
    # Fallbacks for schema positions that may come through
    "bottom-center": "bottom:24px;left:50%;transform:translateX(-50%);",
    "top-left": "top:24px;left:24px;",
    "top-right": "top:24px;right:24px;",
}

# ---------------------------------------------------------------------------
# Component templates
# ---------------------------------------------------------------------------

def _device_mockup(pos_css: str, content: str) -> str:
    """iPhone-style device frame with a fake OneForma task UI inside."""
    task_title = content or "Image Annotation Task"
    return (
        f'<div class="ctx-device-mockup" style="position:absolute;{pos_css}'
        f'width:200px;pointer-events:none">'
        # Phone frame
        f'<div style="background:{_TEXT_PRIMARY};border-radius:24px;padding:8px;'
        f'box-shadow:0 8px 32px rgba(0,0,0,0.25)">'
        # Notch
        f'<div style="width:80px;height:6px;background:#000;border-radius:3px;'
        f'margin:0 auto 8px"></div>'
        # Screen
        f'<div style="background:#FFFFFF;border-radius:16px;padding:16px;'
        f'min-height:260px;display:flex;flex-direction:column;gap:12px">'
        # App header
        f'<div style="font-family:{_FONT_STACK};font-size:14px;font-weight:700;'
        f'color:{_TEXT_SECONDARY};letter-spacing:0.04em;text-transform:uppercase">OneForma</div>'
        # Task title
        f'<div style="font-family:{_FONT_STACK};font-size:14px;font-weight:600;'
        f'color:{_TEXT_PRIMARY};line-height:1.3">{task_title}</div>'
        # Progress bars
        f'<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">'
        f'<div style="height:6px;background:{_BG_UI};border-radius:3px;overflow:hidden">'
        f'<div style="width:72%;height:100%;background:{_BRAND_GRADIENT};border-radius:3px"></div></div>'
        f'<div style="height:6px;background:{_BG_UI};border-radius:3px;overflow:hidden">'
        f'<div style="width:45%;height:100%;background:{_BRAND_GRADIENT};border-radius:3px"></div></div>'
        f'</div>'
        # Submit button
        f'<div style="margin-top:auto;padding:10px 0;background:{_BRAND_GRADIENT};'
        f'color:#FFFFFF;font-family:{_FONT_STACK};font-size:14px;font-weight:600;'
        f'text-align:center;border-radius:9999px">Submit Task</div>'
        f'</div>'  # end screen
        f'</div>'  # end frame
        f'</div>'  # end wrapper
    )


def _task_card(pos_css: str, content: str) -> str:
    """White card with task title and tags."""
    task_title = content or "Audio Transcription"
    return (
        f'<div class="ctx-task-card" style="position:absolute;{pos_css}'
        f'width:220px;pointer-events:none">'
        f'<div style="background:#FFFFFF;border-radius:12px;padding:20px;'
        f'border:1px solid {_BORDER};'
        f'box-shadow:0 4px 16px rgba(0,0,0,0.08);'
        f'font-family:{_FONT_STACK}">'
        # Label
        f'<div style="font-size:14px;font-weight:700;color:{_TEXT_SECONDARY};'
        f'letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px">Your Task</div>'
        # Title
        f'<div style="font-size:16px;font-weight:700;color:{_TEXT_PRIMARY};'
        f'line-height:1.3;margin-bottom:12px">{task_title}</div>'
        # Tags
        f'<div style="display:flex;gap:6px;flex-wrap:wrap">'
        f'<span style="padding:4px 10px;background:#D7E7FE;color:#0452BF;'
        f'border-radius:9999px;font-size:14px;font-weight:600">Remote</span>'
        f'<span style="padding:4px 10px;background:#FDECF7;color:#CD128A;'
        f'border-radius:9999px;font-size:14px;font-weight:600">Flexible</span>'
        f'</div>'
        f'</div>'
        f'</div>'
    )


def _stat_badge(pos_css: str, content: str) -> str:
    """White card with a large stat number."""
    stat_value = content or "$420"
    return (
        f'<div class="ctx-stat-badge" style="position:absolute;{pos_css}'
        f'pointer-events:none">'
        f'<div style="background:#FFFFFF;border-radius:12px;padding:20px 28px;'
        f'border:1px solid {_BORDER};'
        f'box-shadow:0 4px 16px rgba(0,0,0,0.08);text-align:center;'
        f'font-family:{_FONT_STACK}">'
        f'<div style="font-size:32px;font-weight:900;color:{_TEXT_PRIMARY};'
        f'line-height:1">{stat_value}</div>'
        f'<div style="font-size:14px;font-weight:500;color:{_TEXT_SECONDARY};'
        f'margin-top:4px">earned this month</div>'
        f'</div>'
        f'</div>'
    )


def _icon_cluster(pos_css: str, content: str) -> str:
    """Flex-wrapped set of 3 icons in colored rounded squares."""
    _ = content  # unused
    icons = [
        ("#D7E7FE", "#0452BF", "&#128203;"),   # clipboard -- sapphire-10/sapphire-80
        ("#FDECF7", "#CD128A", "&#127991;"),    # tag -- pink-10/pink-80
        ("#D7E7FE", "#0452BF", "&#128200;"),    # chart -- sapphire-10/sapphire-80
    ]
    icon_html_parts = []
    for bg, fg, emoji in icons:
        icon_html_parts.append(
            f'<div style="width:44px;height:44px;background:{bg};border-radius:10px;'
            f'display:flex;align-items:center;justify-content:center;'
            f'font-size:20px;color:{fg}">{emoji}</div>'
        )
    icons_inner = "".join(icon_html_parts)
    return (
        f'<div class="ctx-icon-cluster" style="position:absolute;{pos_css}'
        f'pointer-events:none">'
        f'<div style="display:flex;flex-wrap:wrap;gap:8px">'
        f'{icons_inner}'
        f'</div>'
        f'</div>'
    )


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------
_RENDERERS = {
    "device_mockup": _device_mockup,
    "task_card": _task_card,
    "stat_badge": _stat_badge,
    "icon_cluster": _icon_cluster,
}


def render_context_element(
    el_type: str,
    position: str,
    content: str = "",
) -> str:
    """Return positioned HTML for the given context element type.

    Parameters
    ----------
    el_type:
        One of ``device_mockup``, ``task_card``, ``stat_badge``, ``icon_cluster``.
    position:
        Placement key -- ``bottom-left``, ``bottom-right``, ``center-left``,
        ``center-right``, or any schema position that has a CSS mapping.
    content:
        Element-specific content (task title, stat value, etc.).

    Returns
    -------
    str
        Absolutely-positioned HTML fragment.

    Raises
    ------
    KeyError
        If *el_type* is unknown.
    """
    renderer = _RENDERERS.get(el_type)
    if renderer is None:
        raise KeyError(
            f"Unknown context element type '{el_type}'. "
            f"Must be one of: {sorted(_RENDERERS)}"
        )
    pos_css = _POSITION_CSS.get(position, _POSITION_CSS.get("bottom-left", ""))
    return renderer(pos_css, content)
