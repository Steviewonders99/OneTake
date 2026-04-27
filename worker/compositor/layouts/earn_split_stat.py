"""EARN layout: Split Stat -- photo-first with frosted card bottom.

Actor photo fills entire canvas. Subtle dark wash for contrast.
Frosted white card centered at bottom with text + CTA inside.
OneForma logo top-center. Brand edge glow for depth.
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
    card_margin = 48
    card_w = width - card_margin * 2
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
.layer-actor-fill{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-fill img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.color-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(0,20,39,0.1) 0%, rgba(0,20,39,0.35) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.frosted-card{{
  position:absolute;bottom:{card_margin}px;left:{card_margin}px;
  width:{card_w}px;
  background:rgba(255,255,255,0.85);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-radius:20px;
  border:1px solid rgba(215,224,234,0.3);
  box-shadow:0 8px 32px rgba(0,0,0,0.1);
  z-index:5;
  padding:36px;
  display:flex;flex-direction:column;gap:20px;
}}
.frosted-card .layer-text{{position:static!important;transform:none!important}}
.frosted-card .layer-text div{{color:#001427!important;text-shadow:none!important}}
.frosted-card .layer-cta{{position:static!important;transform:none!important}}
.layer-context{{position:absolute;top:50%;right:5%;transform:translateY(-50%);z-index:6}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="color-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="frosted-card">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
  {edge_glow_html}
</div>
</body>
</html>"""
