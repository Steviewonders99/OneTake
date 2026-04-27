"""Background layer — gradient presets and solid colors."""
from __future__ import annotations

from typing import Dict

# ---------------------------------------------------------------------------
# Gradient presets — each is a CSS linear-gradient value
# ---------------------------------------------------------------------------
GRADIENT_PRESETS: Dict[str, str] = {
    "gradient_warm_sunset": "linear-gradient(135deg, #FF8C42, #E05252, #D94F8C)",
    "gradient_cool_ocean": "linear-gradient(135deg, #2563EB, #0891B2, #10B981)",
    "gradient_pro_charcoal": "linear-gradient(135deg, #1F2937, #374151, #4B5563)",
    "gradient_earn_gold": "linear-gradient(135deg, #B8860B, #DAA520, #F4C430)",
    "gradient_grow_teal": "linear-gradient(135deg, #0D9488, #14B8A6, #2DD4BF)",
    "gradient_shape_purple": "linear-gradient(135deg, #7C3AED, #6366F1, #4F46E5)",
    "gradient_brand_accent": "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))",
    "gradient_soft_neutral": "linear-gradient(135deg, #E5E7EB, #F3F4F6, #F9FAFB)",
}

# ---------------------------------------------------------------------------
# Solid color presets
# ---------------------------------------------------------------------------
SOLID_PRESETS: Dict[str, str] = {
    "bg_white": "#FFFFFF",
    "bg_charcoal": "#32373C",
    "bg_warm_cream": "#FFF8F0",
    "bg_cool_gray": "#F1F5F9",
    "bg_deep_navy": "#0F172A",
    "bg_soft_sage": "#F0FDF4",
}


def render_background(
    bg_type: str,
    preset: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    """Return a CSS ``background:`` declaration string for the given type/preset.

    Parameters
    ----------
    bg_type:
        One of ``gradient``, ``solid``, ``scene_blur``, ``scene_photo``.
    preset:
        A key from :data:`GRADIENT_PRESETS` or :data:`SOLID_PRESETS`, or
        a URL/path for scene types.
    width, height:
        Canvas dimensions (used for scene sizing).

    Raises
    ------
    KeyError
        If *preset* is not found in the relevant preset dict.
    """
    if bg_type == "gradient":
        if preset not in GRADIENT_PRESETS:
            raise KeyError(
                f"Unknown gradient preset '{preset}'. "
                f"Available: {sorted(GRADIENT_PRESETS)}"
            )
        return f"background: {GRADIENT_PRESETS[preset]}"

    if bg_type == "solid":
        if preset not in SOLID_PRESETS:
            raise KeyError(
                f"Unknown solid preset '{preset}'. "
                f"Available: {sorted(SOLID_PRESETS)}"
            )
        return f"background: {SOLID_PRESETS[preset]}"

    if bg_type in ("scene_blur", "scene_photo"):
        # preset is a URL or path to the scene image
        return (
            f"background: url('{preset}') center/cover no-repeat; "
            f"background-size: cover"
        )

    raise KeyError(
        f"Unknown background type '{bg_type}'. "
        f"Must be one of: gradient, solid, scene_blur, scene_photo"
    )
