"""GROW layout: Editorial — Pattern C (light/clean, large headline).

Actor photo fills canvas with very light treatment. White text area at top
with large serif-inspired headline. OneForma logo top-center. CTA at bottom.
Clean, magazine-editorial feel.
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
.layer-actor-fill{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-fill img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.light-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 35%, transparent 55%, rgba(0,0,0,0.3) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.editorial-header{{
  position:absolute;top:80px;left:0;width:100%;z-index:6;
  padding:0 56px;text-align:center;
}}
.editorial-header .layer-text{{position:static!important;transform:none!important}}
.editorial-footer{{
  position:absolute;bottom:0;left:0;width:100%;z-index:6;
  padding:40px 56px;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
}}
.editorial-footer .layer-cta{{position:static!important;transform:none!important}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="light-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="editorial-header">{text_html}</div>
  <div class="editorial-footer">
    {context_html}
    {cta_html}
  </div>
  {edge_glow_html}
</div>
</body>
</html>"""
