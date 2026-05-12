"""Schema for reference-driven editable graphic compositions.

This is deliberately richer than ``CreativeConfig``. The goal is to let a
vision/model step describe a real design as typed layers, then keep the final
HTML deterministic, editable, and repeatable.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


VALID_LAYER_TYPES = frozenset({
    "image",
    "rect",
    "text",
    "dot_pattern",
    "oneforma_logo",
})

VALID_BLEND_MODES = frozenset({
    "normal",
    "multiply",
    "screen",
    "overlay",
    "soft-light",
    "hard-light",
    "color-dodge",
    "color-burn",
    "darken",
    "lighten",
})

VALID_OBJECT_FITS = frozenset({"cover", "contain", "fill"})
VALID_TEXT_ALIGNS = frozenset({"left", "center", "right"})


def _num(value: Any, fallback: float = 0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return fallback


@dataclass(frozen=True)
class Canvas:
    width: int
    height: int
    background: str = "#000000"

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> Canvas:
        width = int(_num(d.get("width"), 1080))
        height = int(_num(d.get("height"), 1080))
        if width < 100 or height < 100:
            raise ValueError("Canvas width/height must be at least 100px")
        return cls(width=width, height=height, background=str(d.get("background", "#000000")))


@dataclass(frozen=True)
class TextRun:
    text: str
    weight: int = 400

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> TextRun:
        return cls(text=str(d.get("text", "")), weight=int(_num(d.get("weight"), 400)))


@dataclass(frozen=True)
class ReferenceLayer:
    id: str
    type: str
    role: str
    z: int
    x: float = 0
    y: float = 0
    width: float = 0
    height: float = 0
    opacity: float = 1
    visible: bool = True
    blend_mode: str = "normal"
    background: str = ""
    border: str = ""
    border_radius: float = 0
    box_shadow: str = ""
    filter: str = ""
    src: str = ""
    object_fit: str = "cover"
    object_position: str = "center center"
    text: str = ""
    runs: List[TextRun] = field(default_factory=list)
    font_family: str = "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif"
    font_size: float = 32
    line_height: float = 1.2
    font_weight: int = 400
    color: str = "#FFFFFF"
    text_align: str = "left"
    letter_spacing: float = 0
    text_shadow: str = ""
    editable: bool = False
    pattern_size: float = 20
    dot_size: float = 2
    dot_color: str = "rgba(255,255,255,0.2)"

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ReferenceLayer:
        layer_type = str(d.get("type", ""))
        if layer_type not in VALID_LAYER_TYPES:
            raise ValueError(f"Invalid reference layer type '{layer_type}'")

        blend_mode = str(d.get("blend_mode", d.get("blendMode", "normal")))
        if blend_mode not in VALID_BLEND_MODES:
            raise ValueError(f"Invalid blend mode '{blend_mode}'")

        object_fit = str(d.get("object_fit", d.get("objectFit", "cover")))
        if object_fit not in VALID_OBJECT_FITS:
            raise ValueError(f"Invalid object-fit '{object_fit}'")

        text_align = str(d.get("text_align", d.get("textAlign", "left")))
        if text_align not in VALID_TEXT_ALIGNS:
            raise ValueError(f"Invalid text align '{text_align}'")

        runs = [TextRun.from_dict(r) for r in d.get("runs", []) if isinstance(r, dict)]

        opacity = max(0.0, min(1.0, _num(d.get("opacity"), 1)))

        return cls(
            id=str(d.get("id", "")),
            type=layer_type,
            role=str(d.get("role", d.get("id", ""))),
            z=int(_num(d.get("z"), 0)),
            x=_num(d.get("x"), 0),
            y=_num(d.get("y"), 0),
            width=_num(d.get("width"), 0),
            height=_num(d.get("height"), 0),
            opacity=opacity,
            visible=bool(d.get("visible", True)),
            blend_mode=blend_mode,
            background=str(d.get("background", "")),
            border=str(d.get("border", "")),
            border_radius=_num(d.get("border_radius", d.get("borderRadius", 0)), 0),
            box_shadow=str(d.get("box_shadow", d.get("boxShadow", ""))),
            filter=str(d.get("filter", "")),
            src=str(d.get("src", "")),
            object_fit=object_fit,
            object_position=str(d.get("object_position", d.get("objectPosition", "center center"))),
            text=str(d.get("text", "")),
            runs=runs,
            font_family=str(d.get("font_family", d.get("fontFamily", "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif"))),
            font_size=_num(d.get("font_size", d.get("fontSize", 32)), 32),
            line_height=_num(d.get("line_height", d.get("lineHeight", 1.2)), 1.2),
            font_weight=int(_num(d.get("font_weight", d.get("fontWeight", 400)), 400)),
            color=str(d.get("color", "#FFFFFF")),
            text_align=text_align,
            letter_spacing=_num(d.get("letter_spacing", d.get("letterSpacing", 0)), 0),
            text_shadow=str(d.get("text_shadow", d.get("textShadow", ""))),
            editable=bool(d.get("editable", False)),
            pattern_size=_num(d.get("pattern_size", d.get("patternSize", 20)), 20),
            dot_size=_num(d.get("dot_size", d.get("dotSize", 2)), 2),
            dot_color=str(d.get("dot_color", d.get("dotColor", "rgba(255,255,255,0.2)"))),
        )


@dataclass(frozen=True)
class ReferenceCreativeManifest:
    name: str
    version: int
    canvas: Canvas
    layers: List[ReferenceLayer]

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> ReferenceCreativeManifest:
        canvas = Canvas.from_dict(d.get("canvas", {}))
        layers = [ReferenceLayer.from_dict(l) for l in d.get("layers", []) if isinstance(l, dict)]
        if not layers:
            raise ValueError("Reference manifest must include at least one layer")
        layer_ids = [l.id for l in layers]
        if len(layer_ids) != len(set(layer_ids)):
            raise ValueError("Reference manifest layer ids must be unique")
        return cls(
            name=str(d.get("name", "reference_creative")),
            version=int(_num(d.get("version"), 1)),
            canvas=canvas,
            layers=sorted(layers, key=lambda layer: layer.z),
        )

    def with_replacements(self, replacements: Optional[Dict[str, str]] = None) -> ReferenceCreativeManifest:
        """Return a copy with image src replacements by role or layer id."""
        if not replacements:
            return self
        new_layers: list[ReferenceLayer] = []
        for layer in self.layers:
            src = replacements.get(layer.role, replacements.get(layer.id, layer.src))
            if src != layer.src:
                new_layers.append(ReferenceLayer(**{**layer.__dict__, "src": src}))
            else:
                new_layers.append(layer)
        return ReferenceCreativeManifest(
            name=self.name,
            version=self.version,
            canvas=self.canvas,
            layers=new_layers,
        )
