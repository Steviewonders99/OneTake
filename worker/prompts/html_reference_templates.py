"""High-fidelity HTML reference templates for creative design LLMs.

These are CONCRETE EXAMPLES the LLM can study and adapt — not abstract concepts.
Each template is a complete, working HTML document that renders correctly in
headless Chromium at the specified dimensions.

The LLM should use these as starting points and adapt:
- Swap image URLs for the actual actor photos
- Change copy to the pre-approved headlines/sub/CTA
- Adjust colors to match OneForma brand palette
- Modify layout proportions to fit the content

10 templates inspired by $50K brand creatives (Jasper.ai, AmEx, Louis Vuitton,
Stripe, Owner.com) analyzed via Google Pomelli:

1. EDITORIAL_SERIF_HERO — Full-bleed photo, white gradient overlay, Georgia serif
2. SPLIT_ZONE — Photo left 55%, brand panel right 45% with SVG wave divider
3. STAT_CALLOUT — Massive stat number, photo in rounded rect, white bg
4. EDITORIAL_MAGAZINE — 30%+ whitespace, photo right, serif headline left
5. CONTAINED_CARD — Photo inside floating rounded card on gray bg
6. PHOTO_MINIMAL — Photo fills 100%, text-shadow headline, nothing else
7. TOP_TEXT_BOTTOM_PHOTO — Deep purple top zone, curved clip-path, photo below
8. DIVERSITY_GRID — Scattered asymmetric photos, gradient wave at bottom
9. UI_SHOWCASE — Person photo with floating UI card overlay
10. TESTIMONIAL — Quote marks, italic text, circle photo, clean white layout
"""
from __future__ import annotations

# ── 1. Editorial Serif Hero ─────────────────────────────────────────
# Full-bleed photo with WHITE gradient overlay (bottom 40%).
# Georgia serif headline stacked 2-3 words/line.
# NO CTA button. Small logo top-left, "Powered by Centific" bottom-right.

TEMPLATE_EDITORIAL_SERIF_HERO = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:Georgia,'Times New Roman',serif;">
  <!-- Full-bleed photo -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center 20%;" />
  </div>
  <!-- White gradient overlay — bottom 40% -->
  <div style="position:absolute; bottom:0; left:0; width:100%; height:50%; background:linear-gradient(to top, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,0.4) 80%, transparent 100%);"></div>
  <!-- OneForma logo top-left -->
  <div style="position:absolute; top:{safe_top}px; left:{safe_left}px; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; font-size:13px; font-weight:700; color:#6B21A8; letter-spacing:0.5px;">OneForma</div>
  <!-- Text zone (safe area) -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; right:{safe_right}px;">
    <div style="font-size:52px; font-weight:700; line-height:1.1; color:#1A1A1A; margin-bottom:14px;">{headline}</div>
    <div style="font-size:18px; font-weight:400; line-height:1.5; color:#737373; font-style:italic;">{subheadline}</div>
  </div>
  <!-- Powered by Centific bottom-right -->
  <div style="position:absolute; bottom:{safe_bottom}px; right:{safe_right}px; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; font-size:10px; color:#737373; letter-spacing:0.3px;">Powered by Centific</div>
</body>
</html>'''


# ── 2. Split Zone ───────────────────────────────────────────────────
# Photo left 55%, brand panel right 45% with curved SVG wave divider.
# Brand panel: light purple bg (#F8F5FF) with dot grid texture.
# Serif headline, subheadline, pink CTA pill.

TEMPLATE_SPLIT_ZONE = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;">
  <!-- Photo left 55% -->
  <div style="position:absolute; top:0; left:0; width:55%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center;" />
  </div>
  <!-- SVG wave divider -->
  <svg style="position:absolute; top:0; left:50%; width:12%; height:100%; z-index:2;" viewBox="0 0 100 800" preserveAspectRatio="none">
    <path d="M100,0 L100,800 L0,800 C30,700 60,600 40,500 C20,400 50,300 30,200 C10,100 50,0 100,0 Z" fill="#F8F5FF"/>
  </svg>
  <!-- Brand panel right 45% -->
  <div style="position:absolute; top:0; right:0; width:45%; height:100%; background:#F8F5FF; background-image:radial-gradient(circle, #6B21A8 1.5px, transparent 1.5px); background-size:24px 24px; background-position:0 0;">
    <!-- Dot grid at 8% opacity overlay -->
    <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:#F8F5FF; opacity:0.92;"></div>
    <!-- Content -->
    <div style="position:relative; z-index:3; display:flex; flex-direction:column; justify-content:center; height:100%; padding:{safe_top}px 32px {safe_bottom}px 40px;">
      <!-- Headline -->
      <div style="font-family:Georgia,'Times New Roman',serif; font-size:38px; font-weight:700; line-height:1.15; color:#1A1A1A; margin-bottom:16px;">{headline}</div>
      <!-- Subheadline -->
      <div style="font-size:16px; font-weight:400; line-height:1.6; color:#737373; margin-bottom:32px;">{subheadline}</div>
      <!-- CTA pill -->
      <div style="display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:9999px; font-size:15px; font-weight:700; color:#FFFFFF; letter-spacing:0.3px; box-shadow:0 4px 16px rgba(233,30,140,0.25); width:fit-content;">{cta}</div>
    </div>
  </div>
</body>
</html>'''


# ── 3. Stat Callout ─────────────────────────────────────────────────
# White bg, massive stat number center-top in 80px Georgia serif purple.
# 4px pink accent line above stat. Photo in rounded rect with purple shadow.
# CTA pill at bottom.

TEMPLATE_STAT_CALLOUT = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; background:#FFFFFF;">
  <!-- Pink accent line above stat -->
  <div style="position:absolute; top:{safe_top}px; left:50%; transform:translateX(-50%); width:60px; height:4px; background:#E91E8C; border-radius:2px;"></div>
  <!-- Massive stat number -->
  <div style="position:absolute; top:calc({safe_top}px + 24px); left:0; right:0; text-align:center; font-family:Georgia,'Times New Roman',serif; font-size:80px; font-weight:700; color:#6B21A8; line-height:1;">{headline}</div>
  <!-- Supporting headline -->
  <div style="position:absolute; top:calc({safe_top}px + 120px); left:{safe_left}px; right:{safe_right}px; text-align:center; font-size:28px; font-weight:600; color:#1A1A1A; line-height:1.3;">{subheadline}</div>
  <!-- Person photo in rounded rect with purple shadow -->
  <div style="position:absolute; top:calc({safe_top}px + 190px); left:50%; transform:translateX(-50%); width:65%; max-width:440px; aspect-ratio:4/3; border-radius:20px; overflow:hidden; box-shadow:12px 12px 40px rgba(107,33,168,0.18);">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <!-- CTA pill at bottom -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:50%; transform:translateX(-50%); display:inline-block; padding:14px 36px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:9999px; font-size:15px; font-weight:700; color:#FFFFFF; letter-spacing:0.3px; box-shadow:0 4px 16px rgba(233,30,140,0.25);">{cta}</div>
</body>
</html>'''


# ── 4. Editorial Magazine ───────────────────────────────────────────
# White bg, 30%+ whitespace. Photo right 50% with natural crop.
# Georgia serif headline left-aligned 44px stacked vertically.
# 2px purple accent line above headline. Italic subheadline.
# Small logo bottom-left. NO blob shapes — whitespace IS the design.

TEMPLATE_EDITORIAL_MAGAZINE = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; background:#FFFFFF;">
  <!-- Photo right 50% -->
  <div style="position:absolute; top:{safe_top}px; right:{safe_right}px; width:48%; height:calc(100% - {safe_top}px - {safe_bottom}px); border-radius:4px; overflow:hidden;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center;" />
  </div>
  <!-- Text zone left -->
  <div style="position:absolute; top:50%; left:{safe_left}px; transform:translateY(-50%); width:42%; max-width:380px;">
    <!-- Purple accent line -->
    <div style="width:40px; height:2px; background:#6B21A8; margin-bottom:20px;"></div>
    <!-- Headline -->
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:44px; font-weight:700; line-height:1.1; color:#1A1A1A; margin-bottom:18px;">{headline}</div>
    <!-- Subheadline italic -->
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; font-weight:400; font-style:italic; line-height:1.6; color:#737373;">{subheadline}</div>
  </div>
  <!-- Small logo bottom-left -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; font-size:12px; font-weight:700; color:#6B21A8; letter-spacing:0.5px;">OneForma</div>
</body>
</html>'''


# ── 5. Contained Card ───────────────────────────────────────────────
# Light gray bg (#F8F9FA). Photo inside rounded card with shadow.
# Headline above card. 1-2 organic blob shapes behind (8% opacity).
# CTA pill overlapping card bottom edge.

TEMPLATE_CONTAINED_CARD = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; background:#F8F9FA;">
  <!-- Organic blob shapes behind card -->
  <svg style="position:absolute; top:10%; right:5%; width:40%; height:40%; opacity:0.08;" viewBox="0 0 200 200">
    <defs><linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6B21A8"/><stop offset="100%" stop-color="#E91E8C"/></linearGradient></defs>
    <ellipse cx="100" cy="100" rx="95" ry="85" fill="url(#bg1)" transform="rotate(-15 100 100)"/>
  </svg>
  <svg style="position:absolute; bottom:5%; left:2%; width:30%; height:30%; opacity:0.06;" viewBox="0 0 200 200">
    <defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E91E8C"/><stop offset="100%" stop-color="#6B21A8"/></linearGradient></defs>
    <circle cx="100" cy="100" r="90" fill="url(#bg2)"/>
  </svg>
  <!-- Headline above card -->
  <div style="position:absolute; top:{safe_top}px; left:{safe_left}px; right:{safe_right}px; text-align:center; font-size:40px; font-weight:800; color:#1A1A1A; line-height:1.15; z-index:2;">{headline}</div>
  <!-- Photo card -->
  <div style="position:absolute; top:calc({safe_top}px + 70px); left:20px; right:20px; bottom:calc({safe_bottom}px + 40px); background:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 8px 32px rgba(107,33,168,0.12); z-index:1;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <!-- CTA pill overlapping card bottom edge -->
  <div style="position:absolute; bottom:calc({safe_bottom}px + 20px); left:50%; transform:translateX(-50%); display:inline-block; padding:14px 36px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:9999px; font-size:15px; font-weight:700; color:#FFFFFF; letter-spacing:0.3px; box-shadow:0 4px 20px rgba(107,33,168,0.3); z-index:3;">{cta}</div>
</body>
</html>'''


# ── 6. Photo Minimal ────────────────────────────────────────────────
# Photo fills 100%. NO overlay at all. White Georgia serif headline
# with text-shadow positioned where photo is naturally dark.
# Nothing else — no logo, no CTA, no shapes.

TEMPLATE_PHOTO_MINIMAL = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:Georgia,'Times New Roman',serif;">
  <!-- Photo fills 100% -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <!-- Headline with text-shadow -->
  <div style="position:absolute; bottom:calc({safe_bottom}px + 40px); left:{safe_left}px; right:{safe_right}px; font-size:48px; font-weight:700; line-height:1.1; color:#FFFFFF; text-shadow:0 2px 12px rgba(0,0,0,0.6), 0 4px 24px rgba(0,0,0,0.3);">{headline}</div>
  <!-- Subheadline -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; right:{safe_right}px; font-size:16px; font-weight:400; line-height:1.5; color:rgba(255,255,255,0.85); text-shadow:0 1px 8px rgba(0,0,0,0.5);">{subheadline}</div>
</body>
</html>'''


# ── 7. Top Text Bottom Photo ────────────────────────────────────────
# Top 35% deep purple (#1A0A2E), huge white Georgia serif headline.
# Curved clip-path transition (ellipse wave). Bottom 65% photo fills.
# Subtle gradient at very bottom for subheadline readability.

TEMPLATE_TOP_TEXT_BOTTOM_PHOTO = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;">
  <!-- Bottom photo (fills full canvas, visible below clip) -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center 30%;" />
  </div>
  <!-- Deep purple top zone with curved bottom -->
  <svg style="position:absolute; top:0; left:0; width:100%; height:42%;" viewBox="0 0 1000 420" preserveAspectRatio="none">
    <path d="M0,0 L1000,0 L1000,340 Q750,420 500,370 Q250,320 0,380 Z" fill="#1A0A2E"/>
  </svg>
  <!-- Headline in purple zone -->
  <div style="position:absolute; top:{safe_top}px; left:{safe_left}px; right:{safe_right}px; z-index:2;">
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:56px; font-weight:700; line-height:1.08; color:#FFFFFF;">{headline}</div>
  </div>
  <!-- Subtle gradient at very bottom for subheadline -->
  <div style="position:absolute; bottom:0; left:0; width:100%; height:25%; background:linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);"></div>
  <!-- Subheadline at bottom -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; right:{safe_right}px; font-size:16px; font-weight:400; line-height:1.5; color:rgba(255,255,255,0.9); z-index:2;">{subheadline}</div>
</body>
</html>'''


# ── 8. Diversity Grid ───────────────────────────────────────────────
# White bg. 4-5 small rounded photos scattered asymmetrically.
# Purple-to-pink gradient wave SVG at bottom 35%.
# White headline in the wave, subheadline below on white.

TEMPLATE_DIVERSITY_GRID = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; background:#FFFFFF;">
  <!-- Scattered photos — asymmetric grid -->
  <div style="position:absolute; top:8%; left:5%; width:160px; height:160px; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:rotate(-3deg);">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <div style="position:absolute; top:5%; right:8%; width:140px; height:180px; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:rotate(2deg);">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:left center;" />
  </div>
  <div style="position:absolute; top:22%; left:38%; width:120px; height:120px; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:rotate(1deg);">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:right center;" />
  </div>
  <div style="position:absolute; top:30%; right:22%; width:150px; height:130px; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:rotate(-2deg);">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center top;" />
  </div>
  <div style="position:absolute; top:15%; left:22%; width:130px; height:150px; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:rotate(3deg); z-index:1;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center bottom;" />
  </div>
  <!-- Gradient wave at bottom 35% -->
  <svg style="position:absolute; bottom:0; left:0; width:100%; height:40%;" viewBox="0 0 1000 400" preserveAspectRatio="none">
    <defs><linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6B21A8"/><stop offset="100%" stop-color="#E91E8C"/></linearGradient></defs>
    <path d="M0,80 Q250,0 500,60 Q750,120 1000,40 L1000,400 L0,400 Z" fill="url(#waveGrad)"/>
  </svg>
  <!-- White headline in the wave -->
  <div style="position:absolute; bottom:calc({safe_bottom}px + 60px); left:{safe_left}px; right:{safe_right}px; text-align:center; z-index:2;">
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:36px; font-weight:700; line-height:1.15; color:#FFFFFF; text-shadow:0 2px 8px rgba(0,0,0,0.15);">{headline}</div>
  </div>
  <!-- Subheadline below -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; right:{safe_right}px; text-align:center; z-index:2;">
    <div style="font-size:15px; font-weight:400; line-height:1.5; color:rgba(255,255,255,0.9);">{subheadline}</div>
  </div>
</body>
</html>'''


# ── 9. UI Showcase ──────────────────────────────────────────────────
# Person photo filling canvas. Floating UI card (white bg, rounded, shadow)
# near device in photo. Card shows mock OneForma interface.
# Headline alongside card. CTA pill below.

TEMPLATE_UI_SHOWCASE = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;">
  <!-- Person photo filling canvas -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <!-- Subtle dark overlay for contrast -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.15);"></div>
  <!-- Floating UI card -->
  <div style="position:absolute; top:{safe_top}px; right:{safe_right}px; width:200px; background:#FFFFFF; border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,0.2); padding:20px; z-index:2;">
    <!-- Mock OneForma interface -->
    <div style="font-size:10px; font-weight:700; color:#6B21A8; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">OneForma</div>
    <div style="width:100%; height:3px; background:linear-gradient(90deg,#6B21A8,#E91E8C); border-radius:2px; margin-bottom:14px;"></div>
    <div style="font-size:12px; font-weight:600; color:#1A1A1A; margin-bottom:8px;">Task Available</div>
    <div style="font-size:11px; color:#737373; line-height:1.4; margin-bottom:10px;">Data annotation project<br/>Remote · Flexible hours</div>
    <div style="display:flex; gap:6px; margin-bottom:10px;">
      <div style="padding:4px 10px; background:#F8F5FF; border-radius:6px; font-size:10px; color:#6B21A8; font-weight:600;">AI</div>
      <div style="padding:4px 10px; background:#FFF5FA; border-radius:6px; font-size:10px; color:#E91E8C; font-weight:600;">Remote</div>
    </div>
    <div style="width:100%; padding:8px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:8px; text-align:center; font-size:11px; font-weight:700; color:#FFFFFF;">Apply Now</div>
  </div>
  <!-- Headline -->
  <div style="position:absolute; bottom:calc({safe_bottom}px + 60px); left:{safe_left}px; right:calc({safe_right}px + 220px); z-index:2;">
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:36px; font-weight:700; line-height:1.12; color:#FFFFFF; text-shadow:0 2px 12px rgba(0,0,0,0.4);">{headline}</div>
    <div style="font-size:15px; font-weight:400; line-height:1.5; color:rgba(255,255,255,0.9); margin-top:10px; text-shadow:0 1px 6px rgba(0,0,0,0.3);">{subheadline}</div>
  </div>
  <!-- CTA pill at bottom -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:9999px; font-size:15px; font-weight:700; color:#FFFFFF; letter-spacing:0.3px; box-shadow:0 4px 16px rgba(233,30,140,0.3); z-index:2;">{cta}</div>
</body>
</html>'''


# ── 10. Testimonial ─────────────────────────────────────────────────
# White bg. Large decorative quote marks (120px, 15% opacity) top-left.
# Quote text in Georgia italic centered. Person photo in circle below.
# Name + title. CTA pill at bottom. Thin purple divider.

TEMPLATE_TESTIMONIAL = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; background:#FFFFFF;">
  <!-- Decorative quote marks -->
  <div style="position:absolute; top:calc({safe_top}px + 10px); left:calc({safe_left}px + 10px); font-family:Georgia,'Times New Roman',serif; font-size:120px; line-height:1; color:#6B21A8; opacity:0.15;">&ldquo;</div>
  <!-- Quote text -->
  <div style="position:absolute; top:calc({safe_top}px + 80px); left:{safe_left}px; right:{safe_right}px; text-align:center; padding:0 20px;">
    <div style="font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:400; font-style:italic; line-height:1.5; color:#1A1A1A;">{headline}</div>
  </div>
  <!-- Thin purple divider -->
  <div style="position:absolute; top:55%; left:50%; transform:translateX(-50%); width:60px; height:2px; background:linear-gradient(90deg,#6B21A8,#E91E8C); border-radius:1px;"></div>
  <!-- Person photo in circle -->
  <div style="position:absolute; top:calc(55% + 20px); left:50%; transform:translateX(-50%); width:100px; height:100px; border-radius:50%; overflow:hidden; box-shadow:0 4px 20px rgba(107,33,168,0.15);">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <!-- Name + title -->
  <div style="position:absolute; top:calc(55% + 130px); left:0; right:0; text-align:center;">
    <div style="font-size:14px; font-weight:700; color:#1A1A1A;">{subheadline}</div>
    <div style="font-size:12px; font-weight:400; color:#737373; margin-top:4px;">OneForma Contributor</div>
  </div>
  <!-- CTA pill at bottom -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:50%; transform:translateX(-50%); display:inline-block; padding:14px 36px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:9999px; font-size:15px; font-weight:700; color:#FFFFFF; letter-spacing:0.3px; box-shadow:0 4px 16px rgba(233,30,140,0.25);">{cta}</div>
</body>
</html>'''


# ═══════════════════════════════════════════════════════════════════════
# PROVEN BEFORE→AFTER REDESIGN TEMPLATES (F→A scores, 22→87 to 59→91)
# These 6 templates are extracted from real creative audits. Each uses
# specific CSS techniques that were PROVEN to increase scores.
# ═══════════════════════════════════════════════════════════════════════

# ── 11. Conversion Split (photo 55% left, text 45% right) ───────────
TEMPLATE_CONVERSION_SPLIT = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="display:flex;width:100%;height:100%;">
<div style="width:55%;position:relative;overflow:hidden;"><img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;"/></div>
<div style="width:45%;background:#FFF;display:flex;flex-direction:column;justify-content:center;padding:8%;">
<div style="font-size:13px;font-weight:800;color:#5B21B6;margin-bottom:4%;">OneForma</div>
<div style="font-family:Georgia,serif;font-size:28px;font-weight:700;line-height:1.1;letter-spacing:-0.03em;color:#111827;margin-bottom:3%;">{headline}</div>
<div style="font-size:13px;line-height:1.5;color:#6B7280;margin-bottom:5%;">{subheadline}</div>
<div style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#16A34A;background:#F0FDF4;padding:4px 10px;border-radius:20px;margin-bottom:4%;width:fit-content;"><span style="width:12px;height:12px;background:#32BCAD;border-radius:3px;transform:rotate(45deg);display:inline-block;"></span>Paid via Pix every Friday</div>
<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#6B7280;margin-bottom:5%;padding:6px 0;border-top:1px solid #E5E7EB;">
<div style="display:flex;"><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#5B21B6;">M</div><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;margin-left:-6px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#5B21B6;">L</div><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;margin-left:-6px;background:#7C3AED;display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700;color:white;">+50K</div></div>
<span>50,000+ contributors worldwide</span></div>
<div style="display:inline-flex;align-items:center;gap:6px;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:700;color:white;background:#7C3AED;width:fit-content;box-shadow:0 4px 14px rgba(124,58,237,0.4);">{cta} →</div>
</div></div></body></html>'''

# ── 12. Dark Purple Split (score: 22→87) ─────────────────────────────
TEMPLATE_DARK_PURPLE_SPLIT = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="display:flex;width:100%;height:100%;background:#5B21B6;">
<div style="width:50%;position:relative;overflow:hidden;"><img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:50% 30%;"/></div>
<div style="width:50%;background:#5B21B6;display:flex;flex-direction:column;justify-content:center;padding:8%;">
<div style="font-size:13px;font-weight:800;color:#C4B5FD;margin-bottom:4%;">OneForma</div>
<div style="font-family:Georgia,serif;font-size:26px;font-weight:700;line-height:1.1;color:#FFF;margin-bottom:3%;">{headline}</div>
<div style="font-size:13px;line-height:1.5;color:#C4B5FD;margin-bottom:5%;">{subheadline}</div>
<div style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#86EFAC;background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:20px;margin-bottom:4%;width:fit-content;"><span style="width:12px;height:12px;background:#32BCAD;border-radius:3px;transform:rotate(45deg);display:inline-block;"></span>Paid weekly via Pix</div>
<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#C4B5FD;margin-bottom:5%;padding:6px 0;border-top:1px solid rgba(255,255,255,0.15);">
<div style="display:flex;"><div style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);background:#7C3AED;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:white;">J</div><div style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);margin-left:-6px;background:#9333EA;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:white;">P</div></div>
<span>50,000+ already earning</span></div>
<div style="display:inline-flex;align-items:center;gap:6px;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:700;color:white;background:#16A34A;width:fit-content;box-shadow:0 4px 14px rgba(22,163,74,0.4);">{cta} →</div>
</div></div></body></html>'''

# ── 13. Full-Bleed Testimonial (score: 31���90) ────────────────────────
TEMPLATE_FULLBLEED_TESTIMONIAL = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="position:absolute;inset:0;"><img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:50% 40%;filter:brightness(0.95);"/></div>
<div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.3) 30%,rgba(0,0,0,0.75) 70%,rgba(0,0,0,0.9) 100%);"></div>
<div style="position:absolute;bottom:0;left:0;right:0;padding:8%;">
<div style="font-size:48px;color:#D946EF;font-family:Georgia,serif;line-height:1;margin-bottom:2%;opacity:0.8;">"</div>
<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;line-height:1.35;color:white;margin-bottom:4%;">{headline}</div>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:5%;">
<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.3);flex-shrink:0;"><img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:50% 40%;"/></div>
<div><div style="font-size:14px;font-weight:700;color:white;">{subheadline}</div><div style="font-size:11px;color:#A78BFA;">OneForma Contributor</div></div>
<div style="margin-left:auto;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;font-size:10px;color:#C4B5FD;font-weight:600;">✓ Verified</div></div>
<div style="width:100%;text-align:center;padding:14px 24px;border-radius:50px;font-size:15px;font-weight:700;color:white;background:#7C3AED;box-shadow:0 4px 14px rgba(124,58,237,0.4);">{cta} →</div>
</div></body></html>'''

# ── 14. Wavy Mask Split (score: 41→89) ───────────────────────────────
TEMPLATE_WAVY_MASK_SPLIT = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="display:flex;width:100%;height:100%;">
<div style="width:55%;position:relative;overflow:hidden;-webkit-mask-image:url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 600 1080' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L520,0 Q560,180 540,270 Q510,400 550,540 Q580,650 530,760 Q500,870 540,1000 L560,1080 L0,1080 Z' fill='black'/%3E%3C/svg%3E&quot;);mask-image:url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 600 1080' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L520,0 Q560,180 540,270 Q510,400 550,540 Q580,650 530,760 Q500,870 540,1000 L560,1080 L0,1080 Z' fill='black'/%3E%3C/svg%3E&quot;);-webkit-mask-size:cover;mask-size:cover;">
<img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:25% 55%;filter:brightness(1.08) saturate(1.1);"/></div>
<div style="width:45%;background:#FFF;display:flex;flex-direction:column;justify-content:center;padding-left:4%;padding-right:8%;padding-top:8%;padding-bottom:8%;">
<div style="font-size:13px;font-weight:800;color:#5B21B6;margin-bottom:4%;">OneForma</div>
<div style="font-family:Georgia,serif;font-size:24px;font-weight:700;line-height:1.1;color:#111827;margin-bottom:3%;">{headline}</div>
<div style="font-size:13px;line-height:1.5;color:#6B7280;margin-bottom:5%;">{subheadline}</div>
<div style="color:#F59E0B;font-size:16px;letter-spacing:2px;margin-bottom:2%;">★★★★½</div>
<div style="font-size:10px;font-weight:600;color:#6B7280;margin-bottom:5%;padding:6px 0;border-top:1px solid #E5E7EB;">★ Rated 4.5/5 by 50,000+ contributors</div>
<div style="display:inline-flex;align-items:center;gap:6px;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:700;color:white;background:#7C3AED;width:fit-content;box-shadow:0 4px 14px rgba(124,58,237,0.4);">{cta} →</div>
</div></div></body></html>'''

# ── 15. Hero Polish (score: 59→91) ───────────────────────────────────
TEMPLATE_HERO_POLISH = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="display:flex;width:100%;height:100%;">
<div style="width:52%;position:relative;overflow:hidden;"><img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:25% 30%;"/></div>
<div style="width:48%;background:#FAFAFA;display:flex;flex-direction:column;justify-content:center;padding:8%;">
<div style="font-size:13px;font-weight:800;color:#5B21B6;margin-bottom:4%;">OneForma</div>
<div style="font-family:Georgia,serif;font-size:36px;font-weight:700;line-height:1.1;letter-spacing:-0.03em;color:#111827;margin-bottom:3%;">{headline}</div>
<div style="font-size:13px;line-height:1.5;color:#6B7280;margin-bottom:5%;">{subheadline}</div>
<div style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#16A34A;background:#F0FDF4;padding:4px 10px;border-radius:20px;margin-bottom:4%;width:fit-content;"><span style="width:14px;height:14px;background:#32BCAD;border-radius:3px;transform:rotate(45deg);display:inline-block;"></span>Weekly Pix payments confirmed</div>
<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#6B7280;margin-bottom:5%;padding:6px 0;border-top:1px solid #E5E7EB;">
<div style="display:flex;"><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#5B21B6;">R</div><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;margin-left:-6px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#5B21B6;">F</div><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;margin-left:-6px;background:#7C3AED;display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700;color:white;">+50K</div></div>
<span>50,000+ contributors earning</span></div>
<div style="display:inline-flex;align-items:center;gap:6px;padding:14px 28px;border-radius:50px;font-size:15px;font-weight:700;color:white;background:#7C3AED;width:fit-content;box-shadow:0 6px 20px rgba(124,58,237,0.45);">{cta} →</div>
</div></div></body></html>'''

# ── 16. Conversion Split Reverse (text left, photo right) ────────────
TEMPLATE_CONVERSION_SPLIT_REVERSE = '''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="display:flex;width:100%;height:100%;">
<div style="width:45%;background:#FFF;display:flex;flex-direction:column;justify-content:center;padding:8%;z-index:2;">
<div style="font-size:13px;font-weight:800;color:#5B21B6;margin-bottom:4%;">OneForma</div>
<div style="width:32px;height:3px;background:#5B21B6;margin-bottom:5%;border-radius:2px;"></div>
<div style="font-family:Georgia,serif;font-size:32px;font-weight:700;line-height:1.1;letter-spacing:-0.03em;color:#111827;margin-bottom:3%;">{headline}</div>
<div style="font-size:13px;line-height:1.5;color:#6B7280;margin-bottom:5%;">{subheadline}</div>
<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#6B7280;margin-bottom:5%;padding:6px 0;border-top:1px solid #E5E7EB;">
<div style="display:flex;"><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#5B21B6;">A</div><div style="width:22px;height:22px;border-radius:50%;border:2px solid white;margin-left:-6px;background:#7C3AED;display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700;color:white;">+50K</div></div>
<span>50,000+ contributors in 80+ countries</span></div>
<div style="display:inline-flex;align-items:center;gap:6px;padding:12px 24px;border-radius:50px;font-size:14px;font-weight:700;color:white;background:#7C3AED;width:fit-content;box-shadow:0 4px 14px rgba(124,58,237,0.4);">{cta} →</div>
</div>
<div style="width:55%;position:relative;overflow:hidden;"><img src="{image_url}" style="width:100%;height:100%;object-fit:cover;object-position:85% 15%;"/></div>
</div></body></html>'''


# ── Pattern names ───────────────────────────────────────────────────

PATTERN_NAMES = [
    "editorial_serif_hero",
    "split_zone",
    "stat_callout",
    "editorial_magazine",
    "contained_card",
    "photo_minimal",
    "top_text_bottom_photo",
    "diversity_grid",
    "ui_showcase",
    "testimonial",
    # Proven before→after redesign patterns (F→A scores)
    "conversion_split",
    "conversion_split_reverse",
    "dark_purple_split",
    "fullbleed_testimonial",
    "wavy_mask_split",
    "hero_polish",
]


# ── Template map ────────────────────────────────────────────────────

REFERENCE_TEMPLATES = {
    "editorial_serif_hero": {
        "html": TEMPLATE_EDITORIAL_SERIF_HERO,
        "description": "Full-bleed photo with white gradient overlay, Georgia serif headline stacked 2-3 words/line. Elegant, editorial. No CTA.",
        "best_for": ["ig_story", "facebook_stories", "whatsapp_story", "tiktok_feed"],
    },
    "split_zone": {
        "html": TEMPLATE_SPLIT_ZONE,
        "description": "Photo left 55%, light purple brand panel right 45% with curved SVG wave divider and dot grid texture.",
        "best_for": ["facebook_feed", "linkedin_feed", "telegram_card", "google_display"],
    },
    "stat_callout": {
        "html": TEMPLATE_STAT_CALLOUT,
        "description": "White bg with massive stat number in purple Georgia serif, photo in rounded rect with purple shadow offset.",
        "best_for": ["linkedin_feed", "twitter_post", "facebook_feed", "indeed_banner"],
    },
    "editorial_magazine": {
        "html": TEMPLATE_EDITORIAL_MAGAZINE,
        "description": "White bg, 30%+ whitespace, photo right with serif headline left. Clean editorial magazine layout.",
        "best_for": ["linkedin_feed", "facebook_feed", "google_display", "indeed_banner"],
    },
    "contained_card": {
        "html": TEMPLATE_CONTAINED_CARD,
        "description": "Light gray bg with photo inside floating rounded card, organic blob shapes behind, CTA overlapping card bottom.",
        "best_for": ["ig_feed", "facebook_feed", "wechat_moments", "twitter_post"],
    },
    "photo_minimal": {
        "html": TEMPLATE_PHOTO_MINIMAL,
        "description": "Photo fills 100%, white headline with text-shadow, nothing else. Pure photographic impact.",
        "best_for": ["ig_story", "tiktok_feed", "whatsapp_story", "ig_feed"],
    },
    "top_text_bottom_photo": {
        "html": TEMPLATE_TOP_TEXT_BOTTOM_PHOTO,
        "description": "Deep purple top zone with white serif headline, curved clip-path transition, photo fills bottom.",
        "best_for": ["ig_feed", "facebook_feed", "wechat_channels", "twitter_post"],
    },
    "diversity_grid": {
        "html": TEMPLATE_DIVERSITY_GRID,
        "description": "White bg with 4-5 scattered asymmetric rounded photos, purple-to-pink gradient wave at bottom with headline.",
        "best_for": ["facebook_feed", "linkedin_feed", "ig_feed", "google_display"],
    },
    "ui_showcase": {
        "html": TEMPLATE_UI_SHOWCASE,
        "description": "Person photo filling canvas with floating white UI card showing mock OneForma interface. Tech-forward.",
        "best_for": ["ig_feed", "facebook_feed", "linkedin_feed", "twitter_post"],
    },
    "testimonial": {
        "html": TEMPLATE_TESTIMONIAL,
        "description": "White bg, decorative purple quote marks, italic Georgia quote, circle photo, name/title. Trust-building.",
        "best_for": ["facebook_feed", "linkedin_feed", "instagram_feed", "google_display"],
    },
    # ── Proven redesign templates (F→A scores) ──
    "conversion_split": {
        "html": TEMPLATE_CONVERSION_SPLIT,
        "description": "PROVEN (30→86). Photo 55% left, text 45% right. Avatar-stack proof, Pix badge, barrier removal subheadline. Default format.",
        "best_for": ["ig_feed", "facebook_feed", "linkedin_feed", "twitter_post"],
    },
    "conversion_split_reverse": {
        "html": TEMPLATE_CONVERSION_SPLIT_REVERSE,
        "description": "PROVEN (49→91). Text 45% left, photo 55% right. Purple accent bar above headline for editorial feel.",
        "best_for": ["ig_feed", "facebook_feed", "linkedin_feed", "twitter_post"],
    },
    "dark_purple_split": {
        "html": TEMPLATE_DARK_PURPLE_SPLIT,
        "description": "PROVEN (22→87). Deep purple text panel. Green CTA for max contrast. 'When everyone is bright, go dark.'",
        "best_for": ["ig_feed", "tiktok_feed", "ig_story", "facebook_feed"],
    },
    "fullbleed_testimonial": {
        "html": TEMPLATE_FULLBLEED_TESTIMONIAL,
        "description": "PROVEN (31→90). Photo fills canvas. 4-stop gradient overlay. Quote + attribution + verified badge at bottom. Looks like organic content.",
        "best_for": ["ig_feed", "ig_story", "tiktok_feed", "facebook_feed"],
    },
    "wavy_mask_split": {
        "html": TEMPLATE_WAVY_MASK_SPLIT,
        "description": "PROVEN (41→89). Organic wavy edge mask on photo boundary. Star rating proof. Brand signature shape.",
        "best_for": ["ig_feed", "facebook_feed", "linkedin_feed", "wechat_moments"],
    },
    "hero_polish": {
        "html": TEMPLATE_HERO_POLISH,
        "description": "PROVEN (59→91). 52/48 split, off-white panel, oversized CTA. Use when original is already decent — minimal surgical fixes.",
        "best_for": ["ig_feed", "facebook_feed", "linkedin_feed", "twitter_post"],
    },
}


def get_reference_html(platform: str) -> str:
    """Get the best reference HTML template for a platform.

    Returns the template string with placeholders, or empty string if none found.
    """
    for _pattern_name, data in REFERENCE_TEMPLATES.items():
        if platform in data["best_for"]:
            return data["html"]
    # Default to editorial serif hero
    return TEMPLATE_EDITORIAL_SERIF_HERO


def get_template_by_pattern(pattern_name: str) -> str:
    """Return the HTML template string for a given pattern name.

    Args:
        pattern_name: One of the PATTERN_NAMES (e.g. 'editorial_serif_hero').

    Returns:
        The HTML template string with placeholders, or empty string if not found.
    """
    data = REFERENCE_TEMPLATES.get(pattern_name)
    if data:
        return data["html"]
    return ""


def get_all_references_for_prompt() -> str:
    """Build a prompt block showing reference templates — proven redesigns FIRST.

    The 6 proven redesign templates (F→A scores) are shown first and in full.
    The original 10 templates are shown truncated as secondary references.
    """
    # Proven templates get priority and full HTML
    proven = ["conversion_split", "dark_purple_split", "fullbleed_testimonial",
              "wavy_mask_split", "hero_polish", "conversion_split_reverse"]
    blocks = []

    blocks.append("\n## PROVEN TEMPLATES (these scored 86-91/100 in creative audit — USE THESE):\n")
    for name in proven:
        data = REFERENCE_TEMPLATES.get(name)
        if not data:
            continue
        blocks.append(
            f"\n### ★ PROVEN: {name.upper()}\n"
            f"Score: {data['description'].split('.')[0]}\n"
            f"Best for: {', '.join(data['best_for'])}\n"
            f"```html\n{data['html']}\n```\n"
        )

    blocks.append("\n## ADDITIONAL TEMPLATES (secondary references):\n")
    for name, data in REFERENCE_TEMPLATES.items():
        if name in proven:
            continue
        blocks.append(
            f"\n### {name.upper()}: {data['description'][:100]}\n"
            f"Best for: {', '.join(data['best_for'])}\n"
            f"```html\n{data['html'][:800]}...\n```\n"
        )
    return "\n".join(blocks)
