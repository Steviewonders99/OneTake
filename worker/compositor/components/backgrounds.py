"""Background layer -- gradient presets, solid colors, and color wash overlays.

All colors sourced from worker/brand/oneforma.py PALETTE.
Washes are SUBTLE (20-35% opacity MAX) -- the actor photo must show through.
"""
from __future__ import annotations

from typing import Dict

# ---------------------------------------------------------------------------
# Gradient presets -- brand-correct from PALETTE + artifacts
# ---------------------------------------------------------------------------
GRADIENT_PRESETS: Dict[str, str] = {
    # Primary brand gradient: Sapphire -> Pink
    "gradient_brand_primary": "linear-gradient(135deg, #0452BF 0%, #CD128A 100%)",
    # Artifact gradient: deep purple -> purple -> pink (gradient_sapphire_pink.css)
    "gradient_sapphire_pink": "linear-gradient(135deg, #3D1059 0%, #6B21A8 40%, #E91E8C 100%)",
    # Subtle warm wash (pink-dominant, 20-25% opacity)
    "gradient_warm_wash": "linear-gradient(135deg, rgba(205,18,138,0.25), rgba(4,82,191,0.2))",
    # Subtle cool wash (sapphire-dominant, 20-25% opacity)
    "gradient_cool_wash": "linear-gradient(135deg, rgba(4,82,191,0.25), rgba(35,125,251,0.2))",
    # Cinematic dark wash using brand dark #001427
    "gradient_dark_wash": "linear-gradient(180deg, rgba(0,20,39,0.2) 0%, rgba(0,20,39,0.65) 100%)",
    # Light bottom fade
    "gradient_light_fade": "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.85) 100%)",
}

# Legacy aliases -- map old names to new brand-correct gradients
# so existing configs / tests don't break
GRADIENT_PRESETS["gradient_warm_sunset"] = GRADIENT_PRESETS["gradient_brand_primary"]
GRADIENT_PRESETS["gradient_cool_ocean"] = GRADIENT_PRESETS["gradient_cool_wash"]
GRADIENT_PRESETS["gradient_pro_charcoal"] = GRADIENT_PRESETS["gradient_dark_wash"]
GRADIENT_PRESETS["gradient_earn_gold"] = GRADIENT_PRESETS["gradient_warm_wash"]
GRADIENT_PRESETS["gradient_grow_teal"] = GRADIENT_PRESETS["gradient_cool_wash"]
GRADIENT_PRESETS["gradient_shape_purple"] = GRADIENT_PRESETS["gradient_sapphire_pink"]
GRADIENT_PRESETS["gradient_brand_accent"] = GRADIENT_PRESETS["gradient_brand_primary"]
GRADIENT_PRESETS["gradient_soft_neutral"] = "linear-gradient(135deg, #D7E0EA, #F1F4F9, #FFFFFF)"
GRADIENT_PRESETS["gradient_luminous_dusk"] = GRADIENT_PRESETS["gradient_sapphire_pink"]
GRADIENT_PRESETS["gradient_cool_spectrum"] = GRADIENT_PRESETS["gradient_cool_wash"]

# ---------------------------------------------------------------------------
# Solid color presets -- from PALETTE
# ---------------------------------------------------------------------------
SOLID_PRESETS: Dict[str, str] = {
    "bg_white": "#FFFFFF",
    "bg_ui": "#F1F4F9",
    "bg_dark": "#001427",
    "bg_border": "#D7E0EA",
    # Legacy aliases
    "bg_charcoal": "#001427",
    "bg_warm_cream": "#FDECF7",   # pink-10 as warm cream substitute
    "bg_cool_gray": "#F1F4F9",
    "bg_deep_navy": "#001427",
    "bg_soft_sage": "#D7E7FE",    # sapphire-10
}

# ---------------------------------------------------------------------------
# Color wash presets -- SUBTLE overlays for photo-first layouts
# Applied ON TOP of actor photos. Max 20-35% opacity.
# ---------------------------------------------------------------------------
WASH_PRESETS: Dict[str, str] = {
    # Brand pink wash -- subtle
    "wash_pink_sapphire": "linear-gradient(135deg, rgba(205,18,138,0.25), rgba(4,82,191,0.2))",
    # Sapphire cool wash -- subtle
    "wash_sapphire_blue": "linear-gradient(135deg, rgba(4,82,191,0.25), rgba(35,125,251,0.2))",
    # Dark cinematic -- brand dark #001427
    "wash_dark_cinematic": "linear-gradient(180deg, rgba(0,20,39,0.2) 0%, rgba(0,20,39,0.65) 100%)",
    # Light clean -- white fade
    "wash_light_clean": "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.85))",
    # Legacy aliases -- point to brand-correct versions
    "wash_purple_pink": "linear-gradient(135deg, rgba(205,18,138,0.25), rgba(4,82,191,0.2))",
    "wash_purple_blue": "linear-gradient(135deg, rgba(4,82,191,0.25), rgba(35,125,251,0.2))",
    "wash_warm_gold": "linear-gradient(135deg, rgba(205,18,138,0.2), rgba(4,82,191,0.15))",
    "wash_cool_teal": "linear-gradient(135deg, rgba(4,82,191,0.25), rgba(35,125,251,0.2))",
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
        One of ``gradient``, ``solid``, ``wash``, ``scene_blur``, ``scene_photo``.
    preset:
        A key from :data:`GRADIENT_PRESETS`, :data:`SOLID_PRESETS`,
        :data:`WASH_PRESETS`, or a URL/path for scene types.
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

    if bg_type == "wash":
        if preset not in WASH_PRESETS:
            raise KeyError(
                f"Unknown wash preset '{preset}'. "
                f"Available: {sorted(WASH_PRESETS)}"
            )
        return f"background: {WASH_PRESETS[preset]}"

    if bg_type in ("scene_blur", "scene_photo"):
        # preset is a URL or path to the scene image
        return (
            f"background: url('{preset}') center/cover no-repeat; "
            f"background-size: cover"
        )

    raise KeyError(
        f"Unknown background type '{bg_type}'. "
        f"Must be one of: gradient, solid, wash, scene_blur, scene_photo"
    )
