"""Creative config schema and validation for the Stage 4 graphic design agent.

The LLM Creative Director outputs structured JSON configs. This module defines
the dataclasses that parse and validate those configs before they reach the
deterministic renderer.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Layout ID constants — one set per messaging pillar
# ---------------------------------------------------------------------------
EARN_LAYOUTS = frozenset({
    "earn_hero_badge",
    "earn_split_stat",
    "earn_testimonial_card",
    "earn_minimal_cta",
})

GROW_LAYOUTS = frozenset({
    "grow_editorial",
    "grow_career_path",
    "grow_community_grid",
    "grow_opportunity_map",
})

SHAPE_LAYOUTS = frozenset({
    "shape_impact_counter",
    "shape_mission_statement",
    "shape_data_viz",
    "shape_contributor_spotlight",
})

ALL_LAYOUTS = EARN_LAYOUTS | GROW_LAYOUTS | SHAPE_LAYOUTS

# Map pillar name → its layout set for cross-pillar validation
_PILLAR_LAYOUTS = {
    "earn": EARN_LAYOUTS,
    "grow": GROW_LAYOUTS,
    "shape": SHAPE_LAYOUTS,
}

# ---------------------------------------------------------------------------
# Valid enum constants
# ---------------------------------------------------------------------------
VALID_POSITIONS = frozenset({
    "left",
    "right",
    "center",
    "bottom-left",
    "bottom-right",
    "bottom-center",
    "top-left",
    "top-right",
    "top-center",
})

VALID_MASKS = frozenset({
    "none",
    "soft_fade",
    "circle_crop",
    "diagonal_slice",
    "gradient_fade",
})

VALID_TEXT_SIZES = frozenset({
    "small",
    "medium",
    "large",
    "xlarge",
})

VALID_CTA_STYLES = frozenset({
    "pill_primary",
    "pill_secondary",
    "outline",
    "ghost",
    "gradient",
})

VALID_BACKGROUND_TYPES = frozenset({
    "gradient",
    "solid",
    "image",
    "pattern",
})

VALID_OVERLAY_INTENSITIES = frozenset({
    "light",
    "medium",
    "heavy",
})

# ---------------------------------------------------------------------------
# Actor-text spatial separation rules
# When the actor occupies a side, only certain text positions are safe.
# ---------------------------------------------------------------------------
_SAFE_TEXT_POSITIONS: Dict[str, frozenset] = {
    "left": frozenset({"top-right", "right", "bottom-right", "top-center", "bottom-center", "center"}),
    "right": frozenset({"top-left", "left", "bottom-left", "top-center", "bottom-center", "center"}),
    "center": frozenset({"top-left", "top-right", "top-center", "bottom-left", "bottom-right", "bottom-center"}),
    "bottom-left": frozenset({"top-left", "top-right", "top-center", "right", "bottom-right", "center"}),
    "bottom-right": frozenset({"top-left", "top-right", "top-center", "left", "bottom-left", "center"}),
    "bottom-center": frozenset({"top-left", "top-right", "top-center", "left", "right", "center"}),
    "top-left": frozenset({"bottom-left", "bottom-right", "bottom-center", "right", "top-right", "center"}),
    "top-right": frozenset({"bottom-left", "bottom-right", "bottom-center", "left", "top-left", "center"}),
    "top-center": frozenset({"bottom-left", "bottom-right", "bottom-center", "left", "right", "center"}),
}


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class BackgroundConfig:
    type: str
    preset: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> BackgroundConfig:
        bg_type = d.get("type", "")
        if bg_type not in VALID_BACKGROUND_TYPES:
            raise ValueError(f"Invalid background type '{bg_type}'. Must be one of {sorted(VALID_BACKGROUND_TYPES)}")
        return cls(type=bg_type, preset=d.get("preset", ""))


@dataclass(frozen=True)
class ActorConfig:
    actor_id: str
    position: str
    scale: float
    mask: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ActorConfig:
        position = d.get("position", "")
        if position not in VALID_POSITIONS:
            raise ValueError(f"Invalid actor position '{position}'. Must be one of {sorted(VALID_POSITIONS)}")

        scale = d.get("scale", 0.0)
        if not (0.1 <= scale <= 1.0):
            raise ValueError(f"Actor scale {scale} out of range. Must be between 0.1 and 1.0")

        mask = d.get("mask", "")
        if mask not in VALID_MASKS:
            raise ValueError(f"Invalid actor mask '{mask}'. Must be one of {sorted(VALID_MASKS)}")

        return cls(
            actor_id=d.get("actor_id", ""),
            position=position,
            scale=scale,
            mask=mask,
        )


@dataclass(frozen=True)
class OverlayConfig:
    elements: List[str]
    intensity: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> OverlayConfig:
        intensity = d.get("intensity", "medium")
        if intensity not in VALID_OVERLAY_INTENSITIES:
            raise ValueError(
                f"Invalid overlay intensity '{intensity}'. Must be one of {sorted(VALID_OVERLAY_INTENSITIES)}"
            )
        return cls(
            elements=list(d.get("elements", [])),
            intensity=intensity,
        )


@dataclass(frozen=True)
class TextConfig:
    headline: str
    subheadline: str
    position: str
    size: str
    contrast_backdrop: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> TextConfig:
        position = d.get("position", "")
        if position not in VALID_POSITIONS:
            raise ValueError(f"Invalid text position '{position}'. Must be one of {sorted(VALID_POSITIONS)}")

        size = d.get("size", "")
        if size not in VALID_TEXT_SIZES:
            raise ValueError(f"Invalid text size '{size}'. Must be one of {sorted(VALID_TEXT_SIZES)}")

        return cls(
            headline=d.get("headline", ""),
            subheadline=d.get("subheadline", ""),
            position=position,
            size=size,
            contrast_backdrop=d.get("contrast_backdrop", ""),
        )


@dataclass(frozen=True)
class CTAConfig:
    text: str
    style: str
    position: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> CTAConfig:
        style = d.get("style", "")
        if style not in VALID_CTA_STYLES:
            raise ValueError(f"Invalid CTA style '{style}'. Must be one of {sorted(VALID_CTA_STYLES)}")

        position = d.get("position", "")
        if position not in VALID_POSITIONS:
            raise ValueError(f"Invalid CTA position '{position}'. Must be one of {sorted(VALID_POSITIONS)}")

        return cls(
            text=d.get("text", ""),
            style=style,
            position=position,
        )


@dataclass(frozen=True)
class ContextElementConfig:
    type: str
    position: str
    content: str

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ContextElementConfig:
        position = d.get("position", "")
        if position not in VALID_POSITIONS:
            raise ValueError(
                f"Invalid context element position '{position}'. Must be one of {sorted(VALID_POSITIONS)}"
            )
        return cls(
            type=d.get("type", ""),
            position=position,
            content=d.get("content", ""),
        )


@dataclass(frozen=True)
class CreativeConfig:
    layout: str
    background: BackgroundConfig
    actor: ActorConfig
    overlay: OverlayConfig
    text: TextConfig
    cta: CTAConfig
    context_element: Optional[ContextElementConfig]

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> CreativeConfig:
        layout = d.get("layout", "")
        if layout not in ALL_LAYOUTS:
            raise ValueError(f"Invalid layout '{layout}'. Must be one of {sorted(ALL_LAYOUTS)}")

        context_element = None
        ce_data = d.get("context_element")
        if ce_data is not None:
            context_element = ContextElementConfig.from_dict(ce_data)

        return cls(
            layout=layout,
            background=BackgroundConfig.from_dict(d.get("background", {})),
            actor=ActorConfig.from_dict(d.get("actor", {})),
            overlay=OverlayConfig.from_dict(d.get("overlay", {})),
            text=TextConfig.from_dict(d.get("text", {})),
            cta=CTAConfig.from_dict(d.get("cta", {})),
            context_element=context_element,
        )


# ---------------------------------------------------------------------------
# Batch validation
# ---------------------------------------------------------------------------

def validate_batch(
    configs: List[Dict[str, Any]],
    pillar: str,
    copy_variants: List[str],
) -> List[str]:
    """Validate a batch of creative configs for consistency and quality.

    Returns a list of error strings. Empty list means the batch is valid.
    """
    errors: List[str] = []
    pillar_layouts = _PILLAR_LAYOUTS.get(pillar, frozenset())

    # Parse all configs first
    parsed: List[CreativeConfig] = []
    for i, cfg_dict in enumerate(configs):
        try:
            parsed.append(CreativeConfig.from_dict(cfg_dict))
        except ValueError as e:
            errors.append(f"Config {i}: {e}")

    if errors:
        return errors

    # --- Check: duplicate layouts ---
    seen_layouts: List[str] = []
    for i, cfg in enumerate(parsed):
        if cfg.layout in seen_layouts:
            errors.append(f"Config {i}: duplicate layout '{cfg.layout}' — each creative must use a unique layout")
        seen_layouts.append(cfg.layout)

    # --- Check: cross-pillar layout alignment ---
    for i, cfg in enumerate(parsed):
        if cfg.layout not in pillar_layouts:
            errors.append(
                f"Config {i}: layout '{cfg.layout}' does not belong to pillar '{pillar}'. "
                f"Expected one of {sorted(pillar_layouts)}"
            )

    # --- Check: headline must come from copy variants ---
    for i, cfg in enumerate(parsed):
        if cfg.text.headline not in copy_variants:
            errors.append(
                f"Config {i}: headline '{cfg.text.headline}' not found in copy variants. "
                f"Headlines must be selected from the provided copy variants."
            )

    # --- Check: actor-text spatial separation ---
    for i, cfg in enumerate(parsed):
        actor_pos = cfg.actor.position
        text_pos = cfg.text.position
        safe_positions = _SAFE_TEXT_POSITIONS.get(actor_pos, frozenset())
        if text_pos not in safe_positions:
            errors.append(
                f"Config {i}: text position '{text_pos}' overlaps with actor position '{actor_pos}'. "
                f"Use adequate separation to avoid visual collision."
            )

    return errors
