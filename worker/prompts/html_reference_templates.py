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
    """Build a prompt block showing all 10 reference templates.

    This gets injected into the designer's system prompt so the LLM
    has concrete HTML examples to study and adapt.
    """
    blocks = []
    for name, data in REFERENCE_TEMPLATES.items():
        blocks.append(
            f"\n### REFERENCE TEMPLATE: {name.upper()}\n"
            f"Best for: {', '.join(data['best_for'])}\n"
            f"Description: {data['description']}\n"
            f"```html\n{data['html'][:1200]}...\n```\n"
            f"KEY TECHNIQUES: Georgia serif for headlines → system sans for body → "
            f"#6B21A8 purple + #E91E8C pink accents → white/light backgrounds → "
            f"pill CTA with gradient → generous whitespace → subtle shadows\n"
        )
    return "\n".join(blocks)
