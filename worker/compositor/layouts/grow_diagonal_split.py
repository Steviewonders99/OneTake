"""GROW layout: Diagonal Split — Pattern A (cool purple-blue wash).

Actor fills canvas. Cool purple-blue wash overlay. Diagonal clip-path
creates dynamic visual split. Text + CTA on the right side.
OneForma logo top-center. Edge glow for depth.
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
    content_left = int(width * 0.42)
    content_width = int(width * 0.58)
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
.color-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(135deg, rgba(155,81,224,0.5), rgba(6,147,227,0.4));
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.diagonal-mask{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  clip-path:polygon(0 0,65% 0,45% 100%,0 100%);
  overflow:hidden;
}}
.diagonal-mask img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.content-zone{{
  position:absolute;top:50%;left:{content_left}px;width:{content_width}px;
  transform:translateY(-50%);
  z-index:6;padding:40px;color:#FFFFFF;
  display:flex;flex-direction:column;gap:24px;
}}
.content-zone .layer-text{{position:static!important;transform:none!important}}
.content-zone .layer-text div{{color:#FFFFFF!important}}
.content-zone .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="color-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="content-zone">
    {text_html}
    {context_html}
    {cta_html}
  </div>
  {edge_glow_html}
</div>
</body>
</html>"""
