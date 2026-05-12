"""Deterministic HTML renderer for reference-driven layer manifests."""
from __future__ import annotations

import html
import json
from typing import Any, Dict, Optional

from compositor.reference_schema import ReferenceCreativeManifest, ReferenceLayer


def _esc(value: str) -> str:
    return html.escape(value, quote=True)


def _style(layer: ReferenceLayer) -> str:
    rules = [
        "position:absolute",
        f"left:{layer.x:g}px",
        f"top:{layer.y:g}px",
        f"width:{layer.width:g}px",
        f"height:{layer.height:g}px",
        f"z-index:{layer.z}",
        f"opacity:{layer.opacity:g}",
        f"mix-blend-mode:{layer.blend_mode}",
        "box-sizing:border-box",
    ]
    if not layer.visible:
        rules.append("display:none")
    if layer.background:
        rules.append(f"background:{layer.background}")
    if layer.border:
        rules.append(f"border:{layer.border}")
    if layer.border_radius:
        rules.append(f"border-radius:{layer.border_radius:g}px")
    if layer.box_shadow:
        rules.append(f"box-shadow:{layer.box_shadow}")
    if layer.filter:
        rules.append(f"filter:{layer.filter}")
    return ";".join(rules)


def _render_image(layer: ReferenceLayer) -> str:
    src = _esc(layer.src)
    return (
        f'<div class="ref-layer ref-image" data-role="{_esc(layer.role)}" '
        f'data-layer-id="{_esc(layer.id)}" style="{_style(layer)};overflow:hidden">'
        f'<img src="{src}" alt="" style="display:block;width:100%;height:100%;'
        f'object-fit:{layer.object_fit};object-position:{_esc(layer.object_position)}"/>'
        "</div>"
    )


def _render_rect(layer: ReferenceLayer) -> str:
    return (
        f'<div class="ref-layer ref-rect" data-role="{_esc(layer.role)}" '
        f'data-layer-id="{_esc(layer.id)}" style="{_style(layer)}"></div>'
    )


def _render_text(layer: ReferenceLayer, editable: bool = True) -> str:
    editable_attr = ' contenteditable="true" spellcheck="false"' if editable and layer.editable else ""
    runs = layer.runs or []
    if runs:
        inner = "".join(
            f'<span style="font-weight:{run.weight}">{_esc(run.text)}</span>'
            for run in runs
        )
    else:
        inner = "<br/>".join(_esc(line) for line in layer.text.splitlines())

    text_rules = [
        _style(layer),
        "display:flex",
        "align-items:flex-start",
        "justify-content:center",
        "flex-direction:column",
        f"font-family:{layer.font_family}",
        f"font-size:{layer.font_size:g}px",
        f"font-weight:{layer.font_weight}",
        f"line-height:{layer.line_height:g}",
        f"color:{layer.color}",
        f"text-align:{layer.text_align}",
        f"letter-spacing:{layer.letter_spacing:g}px",
        "white-space:pre-wrap",
        "overflow:hidden",
    ]
    if layer.text_shadow:
        text_rules.append(f"text-shadow:{layer.text_shadow}")
    if layer.text_align == "center":
        text_rules.append("align-items:center")
    elif layer.text_align == "right":
        text_rules.append("align-items:flex-end")

    return (
        f'<div class="ref-layer ref-text" data-role="{_esc(layer.role)}" '
        f'data-layer-id="{_esc(layer.id)}" style="{";".join(text_rules)}"{editable_attr}>'
        f"{inner}</div>"
    )


def _render_dot_pattern(layer: ReferenceLayer) -> str:
    style = (
        f"{_style(layer)};"
        f"background-image:radial-gradient(circle,{layer.dot_color} 0 {layer.dot_size:g}px,transparent {layer.dot_size + 0.6:g}px);"
        f"background-size:{layer.pattern_size:g}px {layer.pattern_size:g}px"
    )
    return (
        f'<div class="ref-layer ref-dot-pattern" data-role="{_esc(layer.role)}" '
        f'data-layer-id="{_esc(layer.id)}" style="{style}"></div>'
    )


def _render_oneforma_logo(layer: ReferenceLayer) -> str:
    style = _style(layer)
    return f"""
<div class="ref-layer ref-logo" data-role="{_esc(layer.role)}" data-layer-id="{_esc(layer.id)}" style="{style};color:{layer.color}">
  <svg viewBox="0 0 292 76" aria-label="OneForma" role="img" style="display:block;width:100%;height:100%;overflow:visible">
    <g fill="currentColor">
      <ellipse cx="34" cy="30" rx="31" ry="17" transform="rotate(-25 34 30)"/>
      <ellipse cx="63" cy="34" rx="25" ry="17" transform="rotate(43 63 34)"/>
      <ellipse cx="43" cy="55" rx="24" ry="12" transform="rotate(-17 43 55)"/>
    </g>
    <text x="92" y="54" fill="currentColor"
      style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:39px;font-weight:650;letter-spacing:0">
      OneForma
    </text>
  </svg>
</div>""".strip()


def _render_layer(layer: ReferenceLayer, editable: bool = True) -> str:
    if layer.type == "image":
        return _render_image(layer)
    if layer.type == "rect":
        return _render_rect(layer)
    if layer.type == "text":
        return _render_text(layer, editable=editable)
    if layer.type == "dot_pattern":
        return _render_dot_pattern(layer)
    if layer.type == "oneforma_logo":
        return _render_oneforma_logo(layer)
    raise ValueError(f"Unsupported reference layer type: {layer.type}")


def render_reference_html(
    manifest: ReferenceCreativeManifest | Dict[str, Any],
    *,
    replacements: Optional[Dict[str, str]] = None,
    editable: bool = True,
) -> str:
    """Render a complete editable HTML document from a reference manifest."""
    if isinstance(manifest, dict):
        parsed = ReferenceCreativeManifest.from_dict(manifest)
    else:
        parsed = manifest
    parsed = parsed.with_replacements(replacements)

    canvas = parsed.canvas
    layer_html = "\n  ".join(_render_layer(layer, editable=editable) for layer in parsed.layers)
    manifest_json = _esc(json.dumps({
        "name": parsed.name,
        "version": parsed.version,
        "canvas": {"width": canvas.width, "height": canvas.height},
        "layers": [
            {"id": layer.id, "role": layer.role, "type": layer.type, "z": layer.z}
            for layer in parsed.layers
        ],
    }, separators=(",", ":")))

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{_esc(parsed.name)}</title>
<style>
*{{box-sizing:border-box}}
html,body{{margin:0;width:{canvas.width}px;height:{canvas.height}px;overflow:hidden;background:{canvas.background}}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif}}
.creative-root{{position:relative;width:{canvas.width}px;height:{canvas.height}px;overflow:hidden;background:{canvas.background};isolation:isolate}}
.ref-layer{{position:absolute;pointer-events:none}}
.ref-text[contenteditable="true"]{{pointer-events:auto;outline:none;caret-color:currentColor}}
.ref-text[contenteditable="true"]:focus{{outline:2px solid rgba(255,255,255,.35);outline-offset:6px}}
</style>
</head>
<body>
<main class="creative-root" data-reference-manifest="{manifest_json}">
  {layer_html}
</main>
</body>
</html>"""
