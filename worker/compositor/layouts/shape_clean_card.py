"""SHAPE layout: Clean Card — centered card with 2-column grid inside.

Centered card (width-80px, height-80px) with white background, 20px radius,
shadow. Card has 2-column grid: actor left, content (text + context + CTA) right.
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
    card_w = width - 80
    card_h = height - 80
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
.clean-card{{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:{card_w}px;height:{card_h}px;
  background:#FFFFFF;border-radius:20px;
  box-shadow:0 8px 32px rgba(0,0,0,0.12);
  z-index:3;overflow:hidden;
  display:grid;grid-template-columns:1fr 1fr;
}}
.card-actor{{overflow:hidden}}
.card-actor img{{display:block;width:100%;height:100%;object-fit:cover}}
.card-content{{
  display:flex;flex-direction:column;justify-content:center;
  padding:36px;gap:20px;
}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="clean-card">
    <div class="card-actor">{actor_html}</div>
    <div class="card-content">
      {text_html}
      {context_html}
      {cta_html}
    </div>
  </div>
</div>
</body>
</html>"""
