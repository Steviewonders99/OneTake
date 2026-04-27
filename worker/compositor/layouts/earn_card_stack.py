"""EARN layout: Card Stack — actor in background, white card overlaps from bottom.

White card (95% opacity, 16px radius, shadow) overlaps from bottom third.
Text + CTA inside the card. Context positioned independently.
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
    card_top = int(height * 0.55)
    card_margin = 32
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
.layer-actor-bg{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-bg img{{display:block;width:100%;height:100%;object-fit:cover}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:3}}
.card-stack{{
  position:absolute;top:{card_top}px;left:{card_margin}px;
  width:{width - card_margin * 2}px;
  bottom:{card_margin}px;
  background:rgba(255,255,255,0.95);
  border-radius:16px;
  box-shadow:0 4px 24px rgba(0,0,0,0.15);
  z-index:4;
  padding:32px;
  display:flex;flex-direction:column;justify-content:center;gap:20px;
}}
.card-stack .layer-text{{position:static!important;transform:none!important}}
.card-stack .layer-cta{{position:static!important;transform:none!important}}
.layer-context{{position:absolute;top:5%;right:5%;z-index:5}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-bg">{actor_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="card-stack">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
</div>
</body>
</html>"""
