"""SHAPE layout: Portrait Credential — actor fills background, credential bar at bottom.

Actor fills background. White credential bar at bottom (95% opacity) with brand
gradient top border. Context + CTA inside the credential bar.
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
    bar_height = int(height * 0.28)
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
.layer-actor-fill img{{display:block;width:100%;height:100%;object-fit:cover}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:3}}
.layer-text-top{{position:absolute;top:5%;left:5%;max-width:60%;z-index:4}}
.layer-text-top .layer-text{{position:static!important;transform:none!important}}
.credential-bar .layer-cta{{position:static!important;transform:none!important}}
.credential-bar{{
  position:absolute;bottom:0;left:0;width:100%;height:{bar_height}px;
  background:rgba(255,255,255,0.95);
  border-top:3px solid transparent;
  border-image:linear-gradient(135deg,rgb(6,147,227),rgb(155,81,224)) 1;
  z-index:5;
  display:flex;align-items:center;justify-content:space-between;
  padding:24px 40px;gap:20px;
}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="layer-text-top">{text_html}</div>
  <div class="credential-bar">
    {context_html}
    {cta_html}
  </div>
</div>
</body>
</html>"""
