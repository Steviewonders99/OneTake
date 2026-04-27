"""SHAPE layout: Photo Frame — Pattern A (charcoal wash, brand frame).

Actor fills canvas. Subtle brand frame border (gradient) inset. Dark cinematic
wash at bottom for text contrast. OneForma logo top-left.
Purple gradient CTA. Edge glow for depth.
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
    inset = 16
    frame_w = width - inset * 2
    frame_h = height - inset * 2
    footer_height = int(height * 0.38)
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
.cinematic-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 40%, rgba(0,0,0,0.7) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.brand-frame{{
  position:absolute;top:{inset}px;left:{inset}px;
  width:{frame_w}px;height:{frame_h}px;
  border:2px solid transparent;border-radius:12px;
  background:linear-gradient(135deg,rgb(155,81,224),rgb(224,82,151)) border-box;
  -webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  z-index:5;pointer-events:none;
}}
.logo-zone{{position:absolute;top:32px;left:32px;z-index:8}}
.footer-content{{
  position:absolute;bottom:0;left:0;width:100%;z-index:6;
  padding:40px 48px;
  display:flex;flex-direction:column;gap:20px;
}}
.footer-content .layer-text{{position:static!important;transform:none!important}}
.footer-content .layer-text div{{color:#FFFFFF!important}}
.footer-content .layer-cta{{position:static!important;transform:none!important}}
.layer-context{{position:absolute;top:32px;right:32px;z-index:7}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="cinematic-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="brand-frame"></div>
  <div class="logo-zone">{logo_html}</div>
  <div class="footer-content">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
  {edge_glow_html}
</div>
</body>
</html>"""
