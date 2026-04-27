"""SHAPE layout: Clean Card — Pattern C (light, corporate card).

Actor photo fills canvas with light white wash. Centered frosted card
with 2-column grid: left side for text + CTA, right side for context.
OneForma logo top-center. Clean corporate feel.
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
    card_w = width - 96
    card_h = int(height * 0.55)
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
.layer-actor-fill{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-fill img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.light-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.7) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.clean-card{{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:{card_w}px;height:{card_h}px;
  background:rgba(255,255,255,0.9);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-radius:24px;
  box-shadow:0 8px 32px rgba(0,0,0,0.1);
  z-index:5;overflow:hidden;
  display:grid;grid-template-columns:1fr 1fr;
}}
.card-text{{
  display:flex;flex-direction:column;justify-content:center;
  padding:40px;gap:20px;
}}
.card-text .layer-text{{position:static!important;transform:none!important}}
.card-text .layer-text div{{color:#1A1A1A!important;text-shadow:none!important}}
.card-text .layer-cta{{position:static!important;transform:none!important}}
.card-context{{
  display:flex;align-items:center;justify-content:center;
  padding:24px;
  background:rgba(155,81,224,0.05);
}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="light-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="clean-card">
    <div class="card-text">
      {text_html}
      {cta_html}
    </div>
    <div class="card-context">
      {context_html}
    </div>
  </div>
  {edge_glow_html}
</div>
</body>
</html>"""
