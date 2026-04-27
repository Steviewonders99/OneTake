"""SHAPE layout: Multi Grid — CSS grid 2-row layout.

Top row = 2-column grid (actor left, context right).
Bottom row = text + overlay + CTA with padding.
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
    top_height = int(height * 0.55)
    bottom_height = height - top_height
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
.multi-grid{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
  display:grid;grid-template-rows:{top_height}px {bottom_height}px;
}}
.grid-top{{
  display:grid;grid-template-columns:1fr 1fr;gap:0;overflow:hidden;
}}
.grid-top-left{{overflow:hidden}}
.grid-top-left img{{display:block;width:100%;height:100%;object-fit:cover}}
.grid-top-right{{
  display:flex;align-items:center;justify-content:center;padding:24px;
}}
.grid-bottom{{
  position:relative;padding:32px 40px;
  display:flex;flex-direction:column;justify-content:center;gap:20px;
}}
.grid-bottom-overlay{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;
}}
.grid-bottom-content{{position:relative;z-index:2}}
.grid-bottom-content .layer-text{{position:static!important;transform:none!important}}
.grid-bottom-content .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="multi-grid">
    <div class="grid-top">
      <div class="grid-top-left">{actor_html}</div>
      <div class="grid-top-right">{context_html}</div>
    </div>
    <div class="grid-bottom">
      <div class="grid-bottom-overlay">{overlay_html}</div>
      <div class="grid-bottom-content">
        {text_html}
        {cta_html}
      </div>
    </div>
  </div>
</div>
</body>
</html>"""
