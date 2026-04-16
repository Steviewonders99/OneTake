"""Creative compositor: UGC base image + HTML/CSS overlay → composed ad.

Adapted from VYRA Creative OS compositor. Key differences:
  - OneForma brand kit (purple gradient + pink CTA) from ads audit
  - 6 recruitment hook types (NOT locked to money hook — let data decide)
  - Full layout REFLOW per aspect ratio (not crop)
  - Deterministic template selection (default) with LLM override wire-in
  - Dual render path: static PNG (Playwright) + optional MP4 (Remotion future)
  - Grain overlay matching deglosser anti-AI aesthetic

The compositor does NOT generate images — it composites text overlays,
brand elements, and CTA chips on TOP of Seedream-generated UGC images.
"""

from __future__ import annotations

import logging
import os
import re
import tempfile
from typing import Any

logger = logging.getLogger(__name__)


# ── Platform specs ───────────────────────────────────────────────
# Each platform gets native dimensions + safe margins for text.
# This drives the REFLOW — same image, different layout per platform.

PLATFORM_SPECS: dict[str, dict[str, Any]] = {
    # ── Single-image ad formats ──────────────────────────────────
    "ig_feed":        {"width": 1080, "height": 1080, "safe_margin": 60,  "label": "Instagram Feed"},
    "ig_story":       {
        "width": 1080, "height": 1920, "safe_margin": 80,  "label": "Instagram Story",
        "safe_top": 100, "safe_right": 60, "safe_bottom": 200, "safe_left": 60,
        # Top: status bar + username + close button (100px)
        # Bottom: reply bar + swipe-up CTA + story indicators (200px)
        # Right: story reaction buttons (60px)
    },
    "linkedin_feed":  {"width": 1200, "height": 627,  "safe_margin": 48,  "label": "LinkedIn Feed"},
    "facebook_feed":  {"width": 1200, "height": 628,  "safe_margin": 48,  "label": "Facebook Feed"},
    "google_display": {"width": 1200, "height": 628,  "safe_margin": 40,  "label": "Google Display"},
    "tiktok_feed":    {
        "width": 1080, "height": 1920, "safe_margin": 100, "label": "TikTok Feed",
        "safe_top": 150, "safe_right": 164, "safe_bottom": 400, "safe_left": 60,
        # Top: status bar + back/search buttons (150px)
        # Right: action buttons column — like/comment/share/save (164px)
        # Bottom: caption + music bar + navigation (400px!) — MASSIVE dead zone
        # Left: relatively safe (60px breathing room)
    },
    "telegram_card":  {"width": 1280, "height": 720,  "safe_margin": 48,  "label": "Telegram Card"},
    "twitter_post":   {"width": 1200, "height": 675,  "safe_margin": 48,  "label": "X/Twitter Post"},
    "indeed_banner":  {"width": 1200, "height": 628,  "safe_margin": 40,  "label": "Indeed Banner"},
    "whatsapp_story": {
        "width": 1080, "height": 1920, "safe_margin": 80,  "label": "WhatsApp Status",
        "safe_top": 100, "safe_right": 60, "safe_bottom": 180, "safe_left": 60,
        # Top: status bar + contact name + progress dots (100px)
        # Bottom: reply bar + caption area (180px)
    },

    # ── WeChat formats ───────────────────────────────────────────
    "wechat_moments":  {
        "width": 1080, "height": 1080, "safe_margin": 108, "label": "WeChat Moments",
        # Safe margin = 10% from each edge (device clipping varies)
        # CRITICAL: text overlay must be < 20% of image area (WeChat policy)
        "text_overlay_max_pct": 20,
    },
    "wechat_channels": {
        "width": 1080, "height": 1920, "safe_margin": 100, "label": "WeChat Channels",
        "safe_top": 120, "safe_right": 60, "safe_bottom": 300, "safe_left": 60,
        # Bottom 300px: action bar (like/comment/share) + username overlay
        # Similar to TikTok/Douyin layout
    },

    # ── Carousel formats (per-side safe zones) ───────────────────
    # safe_top/right/bottom/left = pixels eaten by platform UI overlays
    # safe_margin = fallback for code that reads the old uniform field
    "linkedin_carousel": {
        "width": 1080, "height": 1080, "safe_margin": 60, "label": "LinkedIn Carousel",
        "safe_top": 60, "safe_right": 60, "safe_bottom": 100, "safe_left": 60,
        # Bottom: page indicator dots + "See more" link area
        "max_slides": 20, "format": "carousel",
        "content_style": "text_first",  # No actor photos on slides 2+
    },
    "ig_carousel": {
        "width": 1080, "height": 1350, "safe_margin": 80, "label": "Instagram Carousel",
        "safe_top": 80, "safe_right": 60, "safe_bottom": 130, "safe_left": 60,
        # Bottom: dots indicator (40px) + caption preview (~90px)
        # 4:5 ratio = max feed real estate. 1080x1440 (3:4) also works
        "max_slides": 20, "format": "carousel",
        "content_style": "visual_story",  # Actor photos most slides
    },
    "tiktok_carousel": {
        "width": 1080, "height": 1920, "safe_margin": 100, "label": "TikTok Carousel",
        "safe_top": 150, "safe_right": 164, "safe_bottom": 400, "safe_left": 60,
        # Top: status bar + back button (150px)
        # Right: action buttons — like/comment/share/save column (164px)
        # Bottom: caption + music bar + nav (400px!) — MASSIVE dead zone
        # Left: relatively safe (60px breathing room)
        "max_slides": 35, "format": "carousel",
        "content_style": "polished_casual",  # Bold text, solid colors, minimal
    },
    "wechat_carousel": {
        "width": 1080, "height": 1080, "safe_margin": 108, "label": "WeChat Moments Carousel",
        "safe_top": 108, "safe_right": 108, "safe_bottom": 108, "safe_left": 108,
        # 10% margin all sides (device clipping)
        # Text overlay < 20% of image area (WeChat policy — enforced!)
        # 3-6 cards per carousel (WeChat limit)
        "max_slides": 6, "format": "carousel",
        "content_style": "visual_minimal",  # Minimal text, visual-first, < 20% text overlay
        "text_overlay_max_pct": 20,
    },
}

# Backwards compat: old keys still work
PLATFORM_SPECS["facebook_stories"] = PLATFORM_SPECS["ig_story"]
PLATFORM_SPECS["instagram_feed"] = PLATFORM_SPECS["ig_feed"]
PLATFORM_SPECS["instagram_stories"] = PLATFORM_SPECS["ig_story"]


# ── Templates ────────────────────────────────────────────────────

TEMPLATES = [
    "HERO_HEADLINE",        # Full-bleed image + headline + CTA at bottom
    "BOTTOM_BAND",          # Image + gradient band bottom
    "TOP_BAND",             # Gradient band top + image below
    "SPLIT_LEFT_TEXT",      # Left text panel 52% + right image
    "SPLIT_RIGHT_TEXT",     # Left image + right text panel 52%
    "CENTERED_OVERLAY",     # Image bg + centered text overlay
    "MINIMAL_CTA",          # Image + small CTA chip only
    "QUOTE_CARD",           # Testimonial/identity quote overlay
    "STAT_CALLOUT",         # Big number + label (social proof)
]


# ── Hook types ───────────────────────────────────────────────────
# NOT locked to money hook. Generate multiple variants, let data decide.

HOOK_TYPES = [
    "earnings",         # "$8-12/hr from home"
    "identity",         # "You're the rarest dataset on Earth"
    "curiosity",        # "What if your local knowledge was worth money?"
    "social_proof",     # "Join 50,000+ contributors in 40 countries"
    "effort_min",       # "Simple tasks. Flexible hours. Real pay."
    "loss_aversion",    # "Projects filling up. Limited spots."
]


# ── OneForma Brand Kit ───────────────────────────────────────────
# Extracted from Meta Ads Library audit (March 29, 2026)

ONEFORMA_BRAND = {
    "primary_color": "#3D1059",       # Deep purple
    "secondary_color": "#6B21A8",     # Medium purple
    "accent_color": "#E91E8C",        # Hot pink CTA
    "money_color": "#E91E8C",         # Pink for emphasis — NO gold/yellow
    "text_color": "#FFFFFF",
    "font_family": "-apple-system, 'Segoe UI', Roboto, sans-serif",
    "font_weight_headline": "800",
    "font_weight_body": "400",
    "cta_radius": "9999px",
    "gradient_css": "linear-gradient(135deg, #3D1059 0%, #6B21A8 50%, #9B51E0 100%)",
}


# ── Template selection ───────────────────────────────────────────

async def select_template(
    platform: str,
    copy: dict[str, Any],
    hook_type: str = "earnings",
    variant_index: int = 0,
    *,
    use_llm: bool = False,
    actor_data: dict | None = None,
    brief: dict | None = None,
) -> str:
    """Select the best template for a creative.

    Default: deterministic rules based on aspect ratio + hook type.
    Optional: LLM-based selection when use_llm=True (wired for future).

    Parameters
    ----------
    platform : str
        Key into PLATFORM_SPECS.
    copy : dict
        Copy data with headline, subheadline, cta_text.
    hook_type : str
        Which hook variant this is (earnings, identity, etc.).
    variant_index : int
        Rotates through template pool for visual variety.
    use_llm : bool
        If True, uses Qwen3.5-9B to select template (slower but smarter).
    actor_data, brief : optional context for LLM selection.
    """
    # ── LLM path (wired but off by default) ──
    if use_llm:
        return await _llm_select_template(platform, copy, hook_type, actor_data, brief)

    # ── Deterministic path (fast, no API calls) ──
    spec = PLATFORM_SPECS.get(platform, PLATFORM_SPECS["ig_feed"])
    w, h = spec["width"], spec["height"]
    is_vertical = h > w * 1.3
    is_landscape = w > h * 1.3

    vertical_pool = ["HERO_HEADLINE", "CENTERED_OVERLAY", "BOTTOM_BAND", "TOP_BAND"]
    landscape_pool = ["SPLIT_LEFT_TEXT", "SPLIT_RIGHT_TEXT", "BOTTOM_BAND", "HERO_HEADLINE"]
    square_pool = ["HERO_HEADLINE", "BOTTOM_BAND", "CENTERED_OVERLAY", "SPLIT_LEFT_TEXT"]

    # Hook-specific overrides
    if hook_type == "social_proof":
        return "STAT_CALLOUT" if not is_vertical else "CENTERED_OVERLAY"
    if hook_type == "identity":
        return "QUOTE_CARD"

    pool = vertical_pool if is_vertical else (landscape_pool if is_landscape else square_pool)
    return pool[variant_index % len(pool)]


async def _llm_select_template(
    platform: str,
    copy: dict,
    hook_type: str,
    actor_data: dict | None,
    brief: dict | None,
) -> str:
    """LLM-based template selection (Qwen3.5-9B creative director).

    Wired in for future intelligence. Returns template name string.
    """
    try:
        from ai.local_llm import generate_text

        prompt = f"""/no_think
Select the best ad template. Return JSON only: {{"template": "TEMPLATE_NAME"}}

Platform: {platform}
Hook type: {hook_type}
Headline: {copy.get("headline", "")[:80]}
Available: {', '.join(TEMPLATES)}
"""
        result = await generate_text(
            "You are a creative director. Select the optimal template.",
            prompt, temperature=0.2, thinking=False, max_tokens=100,
        )
        import json
        data = json.loads(result.strip())
        template = data.get("template", "HERO_HEADLINE")
        if template in TEMPLATES:
            return template
    except Exception as e:
        logger.warning("LLM template selection failed: %s — using deterministic", e)

    return "HERO_HEADLINE"


# ── HTML/CSS builders ────────────────────────────────────────────

def build_overlay_html(props: dict) -> str:
    """Build single-file HTML with UGC image background + text overlay.

    REFLOW: Text positioning, font sizes, gradient direction, and
    safe margins all adapt to the platform's native dimensions.
    This is NOT cropping — it's a complete layout rebuild.

    Props keys:
        platform, template, hero_image_url, headline, subheadline,
        cta_text, hook_type, actor_name, actor_region, proof_badge,
        metric_claim, gradient_opacity, logo_url, brand (optional override)
    """
    spec = PLATFORM_SPECS.get(props.get("platform", ""), PLATFORM_SPECS["ig_feed"])
    w, h = spec["width"], spec["height"]
    margin = spec["safe_margin"]
    brand = props.get("brand", ONEFORMA_BRAND)
    template = props.get("template", "HERO_HEADLINE")

    # Adaptive font sizes based on canvas (NOT fixed — this is the reflow)
    base = min(w, h) / 20
    hl_len = len(props.get("headline", ""))
    hl_size = int(base * 1.0) if hl_len < 30 else int(base * 0.78) if hl_len < 60 else int(base * 0.65)
    sub_size = int(base * 0.45)
    cta_size = int(base * 0.38)

    opacity = props.get("gradient_opacity", 0.65)
    shadow = "text-shadow:0 2px 12px rgba(0,0,0,0.7),0 1px 3px rgba(0,0,0,0.5);"

    # Money highlight
    headline_content = _highlight_money(props.get("headline", ""), brand.get("money_color", "#FFD700"))

    # Build HTML fragments
    headline_html = f"""<div style="font-size:{hl_size}px;font-weight:{brand['font_weight_headline']};
        line-height:1.12;letter-spacing:-0.02em;{shadow}max-width:85%;">{headline_content}</div>"""

    sub_html = ""
    if props.get("subheadline"):
        sub_html = f"""<div style="font-size:{sub_size}px;font-weight:{brand['font_weight_body']};
            margin-top:{int(base*0.2)}px;opacity:0.92;{shadow}line-height:1.35;
            max-width:75%;">{props['subheadline']}</div>"""

    cta_html = ""
    if props.get("cta_text"):
        cta_html = f"""<div style="display:inline-flex;align-items:center;gap:8px;
            margin-top:{int(base*0.35)}px;background:{brand['accent_color']};color:#fff;
            padding:{int(cta_size*0.7)}px {int(cta_size*1.6)}px;
            border-radius:{brand['cta_radius']};font-size:{cta_size}px;font-weight:700;
            letter-spacing:0.5px;text-transform:uppercase;
            box-shadow:0 4px 16px rgba(233,30,140,0.4);">
            {props['cta_text']} <span style="font-size:{int(cta_size*1.2)}px;">&#8250;</span></div>"""

    metric_html = ""
    if props.get("metric_claim"):
        metric_html = f"""<div style="font-size:{int(sub_size*0.85)}px;color:#fff;opacity:0.85;
            margin-top:{int(base*0.15)}px;{shadow}">{props['metric_claim']}</div>"""

    proof_html = ""
    if props.get("proof_badge"):
        proof_html = f"""<div style="position:absolute;top:{margin}px;right:{margin}px;
            background:rgba(0,0,0,0.5);color:#fff;padding:8px 16px;border-radius:20px;
            font-size:{int(base*0.3)}px;backdrop-filter:blur(6px);
            border:1px solid rgba(255,255,255,0.15);z-index:5;">{props['proof_badge']}</div>"""

    logo_html = ""
    if props.get("logo_url"):
        logo_html = f"""<img src="{props['logo_url']}" style="position:absolute;
            bottom:{margin}px;right:{margin}px;max-height:{int(base*0.7)}px;
            max-width:{int(base*2.5)}px;object-fit:contain;z-index:5;opacity:0.9;" />"""

    # Template-specific content
    gradient = _build_gradient(template, opacity, brand)
    content = _build_content(template, headline_html, sub_html, cta_html, metric_html,
                             margin, shadow, base, props)

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:{w}px;height:{h}px;overflow:hidden;}}
</style></head><body>
<div style="position:relative;width:{w}px;height:{h}px;
    background-image:url('{props.get('hero_image_url','')}');
    background-size:cover;background-position:center;
    font-family:{brand['font_family']};color:{brand['text_color']};">
  <div style="position:absolute;inset:0;{gradient}z-index:1;"></div>
  {content}
  {logo_html}
  {proof_html}
  <div style="position:absolute;inset:0;z-index:10;pointer-events:none;
      background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/><feColorMatrix type=%22saturate%22 values=%220%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%221%22/></svg>');
      opacity:0.015;"></div>
</div></body></html>"""


def _build_gradient(template: str, opacity: float, brand: dict) -> str:
    pc = brand["primary_color"]

    if template in ("HERO_HEADLINE", "BOTTOM_BAND"):
        return f"background:linear-gradient(to top,rgba(0,0,0,{opacity}) 0%,rgba(0,0,0,{opacity*0.4}) 45%,transparent 80%);"
    if template == "TOP_BAND":
        return f"background:linear-gradient(to bottom,rgba(0,0,0,{opacity}) 0%,rgba(0,0,0,{opacity*0.4}) 45%,transparent 80%);"
    if template == "SPLIT_LEFT_TEXT":
        return f"background:linear-gradient(to right,{pc}E8 0%,{pc}CC 40%,transparent 65%);"
    if template == "SPLIT_RIGHT_TEXT":
        return f"background:linear-gradient(to left,{pc}E8 0%,{pc}CC 40%,transparent 65%);"
    if template in ("CENTERED_OVERLAY", "QUOTE_CARD"):
        return f"background:radial-gradient(ellipse at center,rgba(0,0,0,{opacity*0.8}) 0%,rgba(0,0,0,{opacity*0.3}) 60%,transparent 100%);"
    if template == "STAT_CALLOUT":
        return f"background:linear-gradient(160deg,{pc}E0 0%,{brand['secondary_color']}D0 50%,transparent 75%);"
    return f"background:rgba(0,0,0,{opacity*0.3});"


def _build_content(template, headline, sub, cta, metric, margin, shadow, base, props):
    if template in ("HERO_HEADLINE", "BOTTOM_BAND"):
        return f"""<div style="position:absolute;bottom:{margin}px;left:{margin}px;right:{margin}px;z-index:2;">
          {headline}{sub}{metric}{cta}</div>"""

    if template == "TOP_BAND":
        return f"""<div style="position:absolute;top:{margin}px;left:{margin}px;right:{margin}px;z-index:2;">
          {headline}{sub}{metric}{cta}</div>"""

    if template == "SPLIT_LEFT_TEXT":
        return f"""<div style="position:absolute;top:0;left:0;bottom:0;width:52%;
            display:flex;flex-direction:column;justify-content:center;padding:{margin}px;z-index:2;">
          {headline}{sub}{metric}{cta}</div>"""

    if template == "SPLIT_RIGHT_TEXT":
        return f"""<div style="position:absolute;top:0;right:0;bottom:0;width:52%;
            display:flex;flex-direction:column;justify-content:center;padding:{margin}px;z-index:2;">
          {headline}{sub}{metric}{cta}</div>"""

    if template == "CENTERED_OVERLAY":
        return f"""<div style="position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;text-align:center;padding:{margin}px;z-index:2;">
          {headline}{sub}{metric}{cta}</div>"""

    if template == "QUOTE_CARD":
        name = props.get("actor_name", "OneForma Contributor")
        region = props.get("actor_region", "Global")
        return f"""<div style="position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;text-align:center;padding:{int(margin*1.5)}px;z-index:2;">
          <div style="font-size:{int(base*1.2)}px;opacity:0.4;margin-bottom:10px;">&ldquo;</div>
          {headline}
          <div style="font-size:{int(base*0.35)}px;margin-top:16px;opacity:0.7;font-style:italic;{shadow}">
            &mdash; {name}, {region}</div>
          {cta}</div>"""

    if template == "STAT_CALLOUT":
        return f"""<div style="position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;text-align:center;padding:{margin}px;z-index:2;">
          <div style="font-size:{int(base*1.8)}px;font-weight:900;{shadow}letter-spacing:-0.03em;">
            {props.get('headline','')}</div>
          <div style="font-size:{int(base*0.5)}px;margin-top:12px;opacity:0.9;{shadow}">
            {props.get('subheadline','')}</div>
          {cta}</div>"""

    # MINIMAL_CTA fallback
    return f"""<div style="position:absolute;bottom:{margin}px;left:{margin}px;z-index:2;">{cta}</div>"""


def _highlight_money(text: str, color: str) -> str:
    """Wrap dollar amounts in gold spans."""
    return re.sub(
        r'(\$[\d,]+(?:\.\d{2})?(?:/hr)?)',
        f'<span style="color:{color};font-weight:900;">\\1</span>',
        text,
    )


# ── Render via Playwright ────────────────────────────────────────

async def render_to_png(html: str, width: int, height: int) -> bytes:
    """Render HTML to PNG using Playwright headless Chromium."""
    from playwright.async_api import async_playwright

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w") as f:
        f.write(html)
        html_path = f.name

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.goto(f"file://{html_path}")
            await page.wait_for_load_state("networkidle")
            # Wait for background image to load
            await page.wait_for_timeout(2000)
            png_bytes = await page.screenshot(type="png")
            await browser.close()
        logger.info("Rendered %dx%d creative (%d bytes)", width, height, len(png_bytes))
        return png_bytes
    finally:
        os.unlink(html_path)


async def render_overlay_only(html: str, width: int, height: int) -> bytes:
    """Render the overlay without background images — transparent PNG.

    Strips all <img> tags and background-image CSS from the HTML,
    then renders on a transparent background. This gives the designer
    the overlay layer separately for remixing.
    """
    import re

    from playwright.async_api import async_playwright

    # Remove all img tags (person photos)
    overlay_html = re.sub(r'<img[^>]*>', '', html)
    # Remove background-image URLs (keep the gradient overlays)
    overlay_html = re.sub(
        r"background-image:\s*url\('[^']*'\);?",
        "background-image:none;",
        overlay_html,
    )
    # Set body background to transparent
    overlay_html = overlay_html.replace(
        f"width:{width}px;height:{height}px;overflow:hidden;",
        f"width:{width}px;height:{height}px;overflow:hidden;background:transparent;",
    )

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w") as f:
        f.write(overlay_html)
        html_path = f.name

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.goto(f"file://{html_path}")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            png_bytes = await page.screenshot(type="png", omit_background=True)
            await browser.close()
        logger.info("Rendered %dx%d overlay-only (%d bytes)", width, height, len(png_bytes))
        return png_bytes
    finally:
        os.unlink(html_path)


async def compose_creative(props: dict) -> bytes:
    """Full pipeline: build HTML from template, render to PNG.

    This is the static render path. Remotion can be added as an
    alternative renderer without changing the compositor logic —
    just swap render_to_png for a Remotion render call.
    """
    html = build_overlay_html(props)
    spec = PLATFORM_SPECS.get(props.get("platform", ""), PLATFORM_SPECS["ig_feed"])
    return await render_to_png(html, spec["width"], spec["height"])
