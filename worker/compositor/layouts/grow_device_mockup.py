"""GROW layout: Device Mockup — CSS grid 2-column.

Left column = actor, right column = text + context element (device mockup) + CTA.
Overlay spans full canvas.
"""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{width}px;height:{height}px;overflow:hidden}}
.creative{{
  position:relative;width:{width}px;height:{height}px;overflow:hidden;
  font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.layer-bg{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:2}}
.grid-container{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  display:grid;grid-template-columns:1fr 1fr;gap:0;
}}
.grid-left{{
  display:flex;align-items:flex-end;justify-content:center;
  overflow:hidden;padding:20px;
}}
.grid-left img{{display:block;max-width:100%;max-height:100%;object-fit:contain}}
.grid-right{{
  display:flex;flex-direction:column;justify-content:space-evenly;align-items:flex-end;
  padding:32px 40px;gap:24px;
}}
.grid-right .layer-text{{position:static!important;transform:none!important}}
.grid-right .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="grid-container">
    <div class="grid-left">{actor_html}</div>
    <div class="grid-right">
      {text_html}
      {context_html}
      {cta_html}
    </div>
  </div>
</div>
</body>
</html>"""
