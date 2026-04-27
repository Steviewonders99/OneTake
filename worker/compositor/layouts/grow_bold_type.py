"""GROW layout: Bold Type — flexbox column, centered, oversized headline.

Small actor circle (180px, border-radius:50%), then oversized headline
(56px, weight 800, tight letter-spacing), then CTA below. Padding 60px.
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
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:2}}
.bold-layout{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:60px;gap:32px;text-align:center;
}}
.bold-headline .layer-text{{position:static!important;transform:none!important}}
.bold-layout .layer-cta{{position:static!important;transform:none!important}}
.actor-circle{{
  width:180px;height:180px;border-radius:50%;overflow:hidden;flex-shrink:0;
}}
.actor-circle img{{display:block;width:100%;height:100%;object-fit:cover}}
.bold-headline{{
  font-size:56px;font-weight:800;line-height:1.05;
  letter-spacing:-0.02em;
}}
.bold-context{{margin-top:8px}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="bold-layout">
    <div class="actor-circle">{actor_html}</div>
    <div class="bold-headline">{text_html}</div>
    <div class="bold-context">{context_html}</div>
    {cta_html}
  </div>
</div>
</body>
</html>"""
