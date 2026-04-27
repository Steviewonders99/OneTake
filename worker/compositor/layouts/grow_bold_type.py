"""GROW layout: Bold Type -- photo-first with centered frosted headline card.

Actor photo fills canvas with light treatment. Large bold headline centered
in a frosted card. OneForma logo top-center. CTA at bottom.
Clean, modern feel.
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
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{width}px;height:{height}px;overflow:hidden}}
.creative{{
  position:relative;width:{width}px;height:{height}px;overflow:hidden;
  font-family:Roboto,-apple-system,system-ui,'Segoe UI',Arial,sans-serif;
}}
.layer-bg{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1}}
.layer-actor-fill{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;
}}
.layer-actor-fill img{{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}}
.light-wash{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;
  background:linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.5) 100%);
}}
.layer-overlay{{position:absolute;top:0;left:0;width:100%;height:100%;z-index:4}}
.logo-zone{{position:absolute;top:32px;left:50%;transform:translateX(-50%);z-index:8}}
.bold-layout{{
  position:absolute;top:0;left:0;width:100%;height:100%;z-index:5;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:48px;padding-bottom:120px;gap:28px;text-align:center;
}}
.bold-headline .layer-text{{position:static!important;transform:none!important}}
.bold-layout .layer-cta{{position:static!important;transform:none!important}}
.bold-headline{{
  background:rgba(255,255,255,0.85);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-radius:20px;padding:32px 40px;
  border:1px solid rgba(215,224,234,0.3);
  box-shadow:0 8px 32px rgba(0,0,0,0.1);
  max-width:85%;
}}
.bold-context{{margin-top:8px}}
</style>
</head>
<body>
<div class="creative">
  <div class="layer-bg">{background_html}</div>
  <div class="layer-actor-fill">{actor_html}</div>
  <div class="light-wash"></div>
  <div class="layer-overlay">{overlay_html}</div>
  <div class="logo-zone">{logo_html}</div>
  <div class="bold-layout">
    <div class="bold-headline">{text_html}</div>
    <div class="bold-context">{context_html}</div>
    {cta_html}
  </div>
  {edge_glow_html}
</div>
</body>
</html>"""
