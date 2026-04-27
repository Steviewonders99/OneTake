"""EARN layout: Hero Badge — standard hero with stacked layers.

Background fills canvas, actor on one side, text on opposite side,
overlay + CTA + context positioned independently.
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
.layer-actor{{position:absolute;bottom:0;right:0;z-index:3;max-width:55%;max-height:90%}}
.layer-actor img{{display:block;max-width:100%;max-height:100%;object-fit:contain}}
.layer-text{{position:absolute;top:8%;left:5%;max-width:50%;z-index:4}}
.layer-cta{{position:absolute;bottom:8%;left:5%;z-index:5}}
.layer-context{{position:absolute;top:5%;right:5%;z-index:5}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="layer-actor">{actor_html}</div>
  <div class="layer-text">{text_html}</div>
  <div class="layer-cta">{cta_html}</div>
  <div class="layer-context">{context_html}</div>
</div>
</body>
</html>"""
