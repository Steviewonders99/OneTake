"""EARN layout: Full Bleed -- photo-first, dark cinematic wash, text bottom.

Actor photo fills 100% canvas. Dark cinematic gradient wash using brand
dark #001427 (20% top -> 65% bottom). OneForma logo top-center.
Text and CTA in bottom content zone. Brand edge glow for depth.
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
.layer-actor-bleed{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-bleed img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.cinematic-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(0,20,39,0.2) 0%, rgba(0,20,39,0.3) 40%, rgba(0,20,39,0.65) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.content-zone{{
  position:absolute;bottom:0;left:0;width:100%;z-index:6;
  padding:48px;display:flex;flex-direction:column;gap:20px;
  color:#FFFFFF;
}}
.content-zone .layer-text{{position:static!important;transform:none!important}}
.content-zone .layer-text div{{color:#FFFFFF!important}}
.content-zone .layer-cta{{position:static!important;transform:none!important}}
.layer-context{{position:absolute;top:32px;right:32px;z-index:7}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-bleed">{actor_html}</div>
  <div class="cinematic-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="content-zone">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
  {edge_glow_html}
</div>
</body>
</html>"""
