"""EARN layout: Card Stack -- frosted card overlay on photo.

Actor fills background. Subtle dark wash. Frosted white card overlaps
from bottom third. Text + CTA inside the card. OneForma logo top-center.
Brand edge glow for depth.
"""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    logo_html: str = "",
    edge_glow_html: str = "",
    width: int = 1080,
    height: int = 1080,
) -> str:
    card_top = int(height * 0.52)
    card_margin = 40
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{width}px;height:{height}px;overflow:hidden}}
.creative{{
  position:relative;width:{width}px;height:{height}px;overflow:hidden;
  font-family:Roboto,-apple-system,system-ui,'Segoe UI',Arial,sans-serif;
}}
.layer-bg{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1}}
.layer-actor-bg{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-bg img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.color-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(0,20,39,0.05) 0%, rgba(0,20,39,0.3) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.card-stack{{
  position:absolute;top:{card_top}px;left:{card_margin}px;
  width:{width - card_margin * 2}px;
  bottom:{card_margin}px;
  background:rgba(255,255,255,0.85);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-radius:20px;
  border:1px solid rgba(215,224,234,0.3);
  box-shadow:0 8px 32px rgba(0,0,0,0.1);
  z-index:5;
  padding:36px;
  display:flex;flex-direction:column;justify-content:center;gap:20px;
}}
.card-stack .layer-text{{position:static!important;transform:none!important}}
.card-stack .layer-text div{{color:#001427!important;text-shadow:none!important}}
.card-stack .layer-cta{{position:static!important;transform:none!important}}
.layer-context{{position:absolute;top:5%;right:5%;z-index:6}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-bg">{actor_html}</div>
  <div class="color-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="card-stack">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
  {edge_glow_html}
</div>
</body>
</html>"""
