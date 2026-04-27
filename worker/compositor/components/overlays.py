"""Overlay components — SVG blobs, gradient bars, badges, and brand frames.

Each category is a dict of ID → HTML string template.  The
:func:`render_overlay_elements` function assembles selected IDs into a
single ``<div class="layer-overlay">`` wrapper.
"""
from __future__ import annotations

from typing import Dict, List

# ---------------------------------------------------------------------------
# Intensity → opacity mapping
# ---------------------------------------------------------------------------
_INTENSITY_OPACITY: Dict[str, float] = {
    "subtle": 0.4,
    "medium": 0.65,
    "bold": 0.9,
    # Legacy names used by schema (light/heavy)
    "light": 0.4,
    "heavy": 0.9,
}

# ---------------------------------------------------------------------------
# SVG blob clusters (6)
# ---------------------------------------------------------------------------
BLOB_CLUSTERS: Dict[str, str] = {
    "blob_warm_1": (
        '<div style="position:absolute;{pos};width:180px;height:180px;opacity:{opacity};pointer-events:none">'
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'
        '<path d="M44.2,-62.1C56.6,-52.4,65.7,-38.3,71.2,-22.5C76.7,-6.7,78.7,10.8,'
        '72.3,24.8C65.9,38.8,51.1,49.3,36,57.4C20.9,65.5,5.5,71.2,-10.6,70.9C'
        '-26.7,70.6,-43.5,64.3,-54.7,53C-65.9,41.7,-71.5,25.4,-73.3,8.6C-75.1,'
        '-8.2,-73.1,-25.5,-64.3,-38.4C-55.5,-51.3,-39.9,-59.8,-24.6,-68.1C-9.3,'
        '-76.4,5.7,-84.5,19.6,-80.3C33.5,-76.1,31.8,-71.8,44.2,-62.1Z" '
        'transform="translate(100,100)" fill="#FF8C42"/>'
        '</svg></div>'
    ),
    "blob_warm_2": (
        '<div style="position:absolute;{pos};width:140px;height:140px;opacity:{opacity};pointer-events:none">'
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'
        '<circle cx="100" cy="100" r="90" fill="#E05252"/>'
        '</svg></div>'
    ),
    "blob_cool_1": (
        '<div style="position:absolute;{pos};width:180px;height:180px;opacity:{opacity};pointer-events:none">'
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'
        '<path d="M38.5,-51.2C52.5,-44.3,68.3,-36.6,74.5,-23.8C80.7,-11,77.3,6.9,'
        '69.6,21.2C61.9,35.5,49.9,46.2,36.7,55.1C23.5,64,9.1,71.1,-5.4,71.1C'
        '-19.9,71.1,-34.5,64,-46.4,53.3C-58.3,42.6,-67.5,28.3,-71.1,12.5C-74.7,'
        '-3.3,-72.7,-20.6,-64,-33.4C-55.3,-46.2,-39.9,-54.5,-25.1,-61.1C-10.3,'
        '-67.7,3.9,-72.6,17.4,-69.8C30.9,-67,24.5,-58.1,38.5,-51.2Z" '
        'transform="translate(100,100)" fill="#2563EB"/>'
        '</svg></div>'
    ),
    "blob_cool_2": (
        '<div style="position:absolute;{pos};width:140px;height:140px;opacity:{opacity};pointer-events:none">'
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'
        '<circle cx="100" cy="100" r="90" fill="#0891B2"/>'
        '</svg></div>'
    ),
    "blob_pro_1": (
        '<div style="position:absolute;{pos};width:180px;height:180px;opacity:{opacity};pointer-events:none">'
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'
        '<path d="M42.8,-57.2C55.9,-50.5,67.1,-38.5,72.6,-24.1C78.1,-9.7,77.9,7.1,'
        '71.5,20.5C65.1,33.9,52.5,43.9,39.2,52.5C25.9,61.1,11.9,68.3,-2.7,69.8C'
        '-17.3,71.3,-32.4,67.1,-44.8,58.4C-57.2,49.7,-66.9,36.5,-71.2,21.6C-75.5,'
        '6.7,-74.4,-9.9,-67.5,-23.2C-60.6,-36.5,-47.9,-46.5,-34.8,-53.2C-21.7,'
        '-59.9,-8.2,-63.3,3.9,-65.1C16,-66.9,29.7,-63.9,42.8,-57.2Z" '
        'transform="translate(100,100)" fill="#7C3AED"/>'
        '</svg></div>'
    ),
    "blob_pro_2": (
        '<div style="position:absolute;{pos};width:140px;height:140px;opacity:{opacity};pointer-events:none">'
        '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'
        '<circle cx="100" cy="100" r="90" fill="#4F46E5"/>'
        '</svg></div>'
    ),
}

# ---------------------------------------------------------------------------
# Gradient bars (4)
# ---------------------------------------------------------------------------
GRADIENT_BARS: Dict[str, str] = {
    "bar_bottom_dark": (
        '<div style="position:absolute;inset:0;pointer-events:none;opacity:{opacity};'
        'background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,0.85) 100%)"></div>'
    ),
    "bar_top_light": (
        '<div style="position:absolute;inset:0;pointer-events:none;opacity:{opacity};'
        'background:linear-gradient(0deg,transparent 60%,rgba(255,255,255,0.7) 100%)"></div>'
    ),
    "bar_diagonal_accent": (
        '<div style="position:absolute;inset:0;pointer-events:none;opacity:{opacity};'
        'background:linear-gradient(135deg,rgba(6,147,227,0.3) 0%,transparent 40%,'
        'transparent 60%,rgba(155,81,224,0.3) 100%)"></div>'
    ),
    "bar_side_fade": (
        '<div style="position:absolute;inset:0;pointer-events:none;opacity:{opacity};'
        'background:linear-gradient(90deg,rgba(0,0,0,0.7) 0%,transparent 50%)"></div>'
    ),
}

# ---------------------------------------------------------------------------
# Badge sets (3)
# ---------------------------------------------------------------------------
BADGE_SETS: Dict[str, str] = {
    "badge_earnings": (
        '<div style="position:absolute;{pos};display:inline-flex;align-items:center;'
        'gap:6px;padding:8px 16px;background:#059669;color:#FFFFFF;'
        'border-radius:9999px;font-family:-apple-system,system-ui,sans-serif;'
        'font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);'
        'opacity:{opacity};pointer-events:none">{content}</div>'
    ),
    "badge_skills": (
        '<div style="position:absolute;{pos};display:inline-flex;align-items:center;'
        'gap:6px;padding:8px 16px;background:#2563EB;color:#FFFFFF;'
        'border-radius:10px;font-family:-apple-system,system-ui,sans-serif;'
        'font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);'
        'opacity:{opacity};pointer-events:none">{content}</div>'
    ),
    "badge_verification": (
        '<div style="position:absolute;{pos};display:inline-flex;align-items:center;'
        'gap:6px;padding:8px 16px;background:#FFFFFF;color:#1A1A1A;'
        'border-radius:10px;font-family:-apple-system,system-ui,sans-serif;'
        'font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.12);'
        'opacity:{opacity};pointer-events:none">'
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" '
        'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
        '<polyline points="20 6 9 17 4 12"></polyline></svg>'
        '{content}</div>'
    ),
}

# ---------------------------------------------------------------------------
# Brand frames (3)
# ---------------------------------------------------------------------------
BRAND_FRAMES: Dict[str, str] = {
    "frame_accent_border": (
        '<div style="position:absolute;inset:8px;border:3px solid transparent;'
        'border-image:linear-gradient(135deg,rgb(6,147,227),rgb(155,81,224)) 1;'
        'pointer-events:none;opacity:{opacity}"></div>'
    ),
    "frame_corner_marks": (
        '<div style="position:absolute;inset:0;pointer-events:none;opacity:{opacity}">'
        # top-left corner
        '<div style="position:absolute;top:12px;left:12px;width:28px;height:28px;'
        'border-top:3px solid rgb(6,147,227);border-left:3px solid rgb(6,147,227)"></div>'
        # top-right corner
        '<div style="position:absolute;top:12px;right:12px;width:28px;height:28px;'
        'border-top:3px solid rgb(155,81,224);border-right:3px solid rgb(155,81,224)"></div>'
        # bottom-left corner
        '<div style="position:absolute;bottom:12px;left:12px;width:28px;height:28px;'
        'border-bottom:3px solid rgb(155,81,224);border-left:3px solid rgb(155,81,224)"></div>'
        # bottom-right corner
        '<div style="position:absolute;bottom:12px;right:12px;width:28px;height:28px;'
        'border-bottom:3px solid rgb(6,147,227);border-right:3px solid rgb(6,147,227)"></div>'
        '</div>'
    ),
    "frame_subtle_outline": (
        '<div style="position:absolute;inset:6px;border:1px solid rgba(255,255,255,0.35);'
        'border-radius:12px;pointer-events:none;opacity:{opacity}"></div>'
    ),
}

# ---------------------------------------------------------------------------
# Combined lookup — all categories merged
# ---------------------------------------------------------------------------
_ALL_OVERLAYS: Dict[str, str] = {
    **BLOB_CLUSTERS,
    **GRADIENT_BARS,
    **BADGE_SETS,
    **BRAND_FRAMES,
}

# Default position for blob elements when no explicit pos in the template
_DEFAULT_BLOB_POS = "top:10%;right:5%"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_overlay_elements(
    elements: List[str],
    intensity: str = "medium",
) -> str:
    """Assemble selected overlay elements into a single positioned wrapper.

    Parameters
    ----------
    elements:
        List of overlay element IDs (e.g. ``["blob_warm_1", "bar_bottom_dark"]``).
    intensity:
        One of ``subtle``, ``medium``, ``bold`` (also accepts legacy
        ``light``/``heavy``).  Maps to opacity applied to each element.

    Returns
    -------
    str
        An outer ``<div class="layer-overlay">`` containing all resolved elements.
        Unknown IDs are silently skipped.
    """
    opacity = _INTENSITY_OPACITY.get(intensity, 0.65)

    inner_parts: List[str] = []
    for el_id in elements:
        template = _ALL_OVERLAYS.get(el_id)
        if template is None:
            continue
        # Fill placeholders
        html = template.replace("{opacity}", str(opacity))
        html = html.replace("{pos}", _DEFAULT_BLOB_POS)
        html = html.replace("{content}", "")
        inner_parts.append(html)

    inner_html = "".join(inner_parts)
    return (
        '<div class="layer-overlay" style="position:absolute;inset:0;pointer-events:none;">'
        f"{inner_html}"
        "</div>"
    )
