"""EARN layout: Split Stat — diagonal/vertical split.

Left half for actor, right half for text + CTA. Gradient divider between.
Overlay spans full canvas behind content.
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
    half = width // 2
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
.split-left{{
  position:absolute;top:0;left:0;width:{half}px;height:{height}px;
  z-index:3;overflow:hidden;
}}
.split-left img{{display:block;width:100%;height:100%;object-fit:cover}}
.split-divider{{
  position:absolute;top:0;left:{half - 2}px;width:4px;height:{height}px;
  background:linear-gradient(180deg,rgba(6,147,227,0.8),rgba(155,81,224,0.8));
  z-index:4;
}}
.split-right{{
  position:absolute;top:0;left:{half}px;width:{half}px;height:{height}px;
  z-index:3;display:flex;flex-direction:column;justify-content:center;
  padding:40px;gap:24px;
}}
.split-right .layer-text{{position:static!important;transform:none!important}}
.split-right .layer-cta{{position:static!important;transform:none!important}}
.layer-context{{position:absolute;bottom:5%;right:5%;z-index:5}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="split-left">{actor_html}</div>
  <div class="split-divider"></div>
  <div class="split-right">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
</div>
</body>
</html>"""
