"""EARN layout: Hero Badge — Pattern A (warm purple-pink wash).

Actor photo fills 70% right side. Warm purple-pink color wash overlay.
OneForma logo top-left. Large headline upper-left. Purple gradient CTA bottom-left.
Edge glow for cinematic depth.
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
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{width}px;height:{height}px;overflow:hidden}}
.creative{{
  position:relative;width:{width}px;height:{height}px;overflow:hidden;
  font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.layer-bg{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1}}
.layer-actor{{position:absolute;top:0;right:0;z-index:2;width:70%;height:100%}}
.layer-actor img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.color-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(135deg, rgba(155,81,224,0.4), rgba(224,82,151,0.35));
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:32px;z-index:8}}
.layer-text{{position:absolute;top:15%;left:5%;max-width:55%;z-index:6}}
.layer-cta{{position:absolute;bottom:8%;left:5%;z-index:7}}
.layer-context{{position:absolute;top:5%;right:5%;z-index:7}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor">{actor_html}</div>
  <div class="color-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="layer-text">{text_html}</div>
  <div class="layer-cta">{cta_html}</div>
  <div class="layer-context">{context_html}</div>
  {edge_glow_html}
</div>
</body>
</html>"""
