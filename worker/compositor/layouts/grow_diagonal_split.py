"""GROW layout: Diagonal Split — actor clipped with diagonal polygon.

Actor clipped with clip-path:polygon(0 0, 65% 0, 45% 100%, 0 100%).
Content zone positioned right (55% width, centered vertically).
Overlay behind all content.
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
    content_left = int(width * 0.45)
    content_width = int(width * 0.55)
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
.diagonal-actor{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  clip-path:polygon(0 0,65% 0,45% 100%,0 100%);
  overflow:hidden;
}}
.diagonal-actor img{{display:block;width:100%;height:100%;object-fit:cover}}
.content-zone{{
  position:absolute;top:50%;left:{content_left}px;width:{content_width}px;
  transform:translateY(-50%);
  z-index:4;padding:40px;
  display:flex;flex-direction:column;gap:24px;
}}
.content-zone .layer-text{{position:static!important;transform:none!important}}
.content-zone .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="diagonal-actor">{actor_html}</div>
  <div class="content-zone">
    {text_html}
    {context_html}
    {cta_html}
  </div>
</div>
</body>
</html>"""
