"""GROW layout: Editorial — magazine-style 3-row grid.

CSS grid: 3 rows (header for text, body for actor, footer for CTA).
Generous padding (48px). Uses Georgia/serif font family for the creative div.
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
  font-family:Georgia,'Times New Roman',serif;
}}
.layer-bg{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:2}}
.editorial-grid{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  display:grid;grid-template-rows:auto 1fr auto;
  padding:48px;gap:24px;
}}
.editorial-header{{display:flex;flex-direction:column;gap:12px}}
.editorial-header .layer-text{{position:static!important;transform:none!important}}
.editorial-footer .layer-cta{{position:static!important;transform:none!important}}
.editorial-body{{
  overflow:hidden;display:flex;align-items:center;justify-content:center;
}}
.editorial-body img{{display:block;max-width:100%;max-height:100%;object-fit:contain}}
.editorial-footer{{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="editorial-grid">
    <div class="editorial-header">{text_html}</div>
    <div class="editorial-body">{actor_html}</div>
    <div class="editorial-footer">
      {context_html}
      {cta_html}
    </div>
  </div>
</div>
</body>
</html>"""
