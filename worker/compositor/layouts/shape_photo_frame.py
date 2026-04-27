"""SHAPE layout: Photo Frame — actor fills canvas with brand frame border.

Actor fills canvas. Brand frame border (2px gradient, 12px radius) inset 16px.
Footer zone at bottom with gradient (0 -> 0.7 black) for text + CTA.
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
    inset = 16
    frame_w = width - inset * 2
    frame_h = height - inset * 2
    footer_height = int(height * 0.35)
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
.brand-frame{{
  position:absolute;top:{inset}px;left:{inset}px;
  width:{frame_w}px;height:{frame_h}px;
  border:2px solid transparent;border-radius:12px;
  background:linear-gradient(135deg,rgb(6,147,227),rgb(155,81,224)) border-box;
  -webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  z-index:4;pointer-events:none;
}}
.footer-gradient{{
  position:absolute;bottom:0;left:0;width:100%;height:{footer_height}px;
  background:linear-gradient(to top,rgba(0,0,0,0.7),transparent);
  z-index:5;
}}
.footer-content{{
  position:absolute;bottom:0;left:0;width:100%;z-index:6;
  padding:32px 40px;
  display:flex;flex-direction:column;gap:16px;
}}
.layer-context{{position:absolute;top:5%;right:5%;z-index:6}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="brand-frame"></div>
  <div class="footer-gradient"></div>
  <div class="footer-content">
    {text_html}
    {cta_html}
  </div>
  <div class="layer-context">{context_html}</div>
</div>
</body>
</html>"""
