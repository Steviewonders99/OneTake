"""GROW layout: Device Mockup -- split layout with device UI.

Actor photo fills left 55%. Light/clean right panel (#FFFFFF) with text +
device mockup + CTA. Subtle white fade blends photo into panel.
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
    left_w = int(width * 0.55)
    right_w = width - left_w
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
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:2}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.photo-side{{
  position:absolute;top:0;left:0;width:{left_w}px;height:{height}px;
  z-index:3;overflow:hidden;
}}
.photo-side img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.photo-wash{{
  position:absolute;top:0;left:0;width:{left_w}px;height:{height}px;z-index:4;
  background:linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.9) 100%);
}}
.content-side{{
  position:absolute;top:0;right:0;width:{right_w}px;height:{height}px;
  z-index:5;
  display:flex;flex-direction:column;justify-content:center;align-items:flex-start;
  padding:48px 40px;gap:28px;
}}
.content-side .layer-text{{position:static!important;transform:none!important}}
.content-side .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="photo-side">{actor_html}</div>
  <div class="photo-wash"></div>
  <div class="content-side">
    {text_html}
    {context_html}
    {cta_html}
  </div>
  {edge_glow_html}
</div>
</body>
</html>"""
