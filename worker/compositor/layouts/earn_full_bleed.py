"""EARN layout: Full Bleed — actor photo fills entire canvas.

Bottom gradient bar (0 -> 0.8 black, 50% height) provides text contrast.
Text + CTA positioned in bottom content zone over the gradient.
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
    grad_height = height // 2
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
.layer-actor-bleed{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-bleed img{{display:block;width:100%;height:100%;object-fit:cover}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:3}}
.gradient-bar{{
  position:absolute;bottom:0;left:0;width:100%;height:{grad_height}px;
  background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);
  z-index:4;
}}
.content-zone{{
  position:absolute;bottom:0;left:0;width:100%;z-index:5;
  padding:40px;display:flex;flex-direction:column;gap:20px;
}}
.layer-context{{position:absolute;top:5%;left:5%;z-index:5}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-bleed">{actor_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="gradient-bar"></div>
  <div class="content-zone">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
</div>
</body>
</html>"""
