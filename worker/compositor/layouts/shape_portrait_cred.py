"""SHAPE layout: Portrait Credential -- dark cinematic wash + credential bar.

Actor fills background. Subtle dark cinematic wash using brand dark #001427.
White credential bar at bottom with gradient top border (brand #0452BF -> #CD128A).
OneForma logo top-left. Text overlaid on upper portion. Brand edge glow.
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
    bar_height = int(height * 0.25)
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
.cinematic-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(0,20,39,0.25) 0%, rgba(0,20,39,0.15) 50%, rgba(0,20,39,0.35) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:32px;z-index:8}}
.layer-text-top{{position:absolute;top:12%;left:5%;max-width:60%;z-index:6}}
.layer-text-top .layer-text{{position:static!important;transform:none!important}}
.layer-text-top .layer-text div{{color:#FFFFFF!important}}
.credential-bar{{
  position:absolute;bottom:0;left:0;width:100%;height:{bar_height}px;
  background:rgba(255,255,255,0.9);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(215,224,234,0.3);
  z-index:5;
  display:flex;align-items:center;justify-content:space-between;
  padding:24px 40px;gap:20px;
}}
.credential-bar::before{{
  content:'';position:absolute;top:0;left:0;width:100%;height:3px;
  background:linear-gradient(135deg,#0452BF,#CD128A);
}}
.credential-bar .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="cinematic-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="layer-text-top">{text_html}</div>
  <div class="credential-bar">
    {context_html}
    {cta_html}
  </div>
  {edge_glow_html}
</div>
</body>
</html>"""
