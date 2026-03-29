"""Prompt templates for Stage 4 v2 LLM-designed creative overlays.

Contains:
- OneForma brand kit (from Meta Ads Library audit)
- Design audit (strengths/weaknesses/opportunities)
- Overlay generation instructions
- Frontend-design skill content (loaded from file at startup)

Pure data module — no logic, no API calls.
"""
from __future__ import annotations

import os

# ── OneForma Brand Kit ───────────────────────────────────────────
# Extracted from Meta Ads Library audit (March 29, 2026)

BRAND_KIT = """
## OneForma Brand Kit

### Colors
- Primary background: White (#FFFFFF) or light gray (#F8F9FA) — clean, professional
- Accent gradient: Deep purple (#3D1059) → Medium purple (#6B21A8) → Bright purple (#9B51E0)
- CTA gradient: Purple (#6B21A8) → Hot pink (#E91E8C) — pill-shaped buttons
- Money highlight: Gold (#FFD700) for dollar amounts
- Text on light bg: Dark (#1A1A1A)
- Text on dark/gradient: White (#FFFFFF)
- Badge backgrounds: Light pink (#FCE4EC), light purple (#F3E5F5), light gray (#F0F0F0)

### Shapes & Decorative Elements
- Organic blob shapes: large, flowing, rounded SVG paths filled with purple-to-pink gradients. Place in corners and edges.
- Dot grid pattern: subtle decorative grid of small dots (3-4px, 10-15% opacity) as background texture.
- Rounded photo frames: photos contained in border-radius: 16px containers, NOT full-bleed.
- Highlight badges: key words wrapped in colored pill backgrounds (e.g., "AI Study" in pink pill).
- Circle accents: semi-transparent purple/pink circles of varying sizes as decorative elements.

### Typography
- Font family: -apple-system, 'Segoe UI', Roboto, sans-serif (system fonts, no Google Fonts)
- Headlines: font-weight 800, large size, dark on light bg or white on dark
- Subheadlines: font-weight 400, 50-60% of headline size
- CTA text: font-weight 700, uppercase, white on gradient pill, letter-spacing 0.5px

### CTA Buttons
- Shape: pill (border-radius: 9999px)
- Background: linear-gradient(135deg, #6B21A8, #E91E8C) or solid #E91E8C
- Text: white, uppercase, with right arrow (→)
- Box shadow: 0 4px 16px rgba(233, 30, 140, 0.3)

### Logo
- "OneForma" text + icon mark
- Placement: top center (primary) or bottom right (secondary)

### Photo Treatment Options (pick one per creative):
1. CUTOUT POPOUT: Person with background removed, popping out of a card frame or blob shape. Most dynamic.
2. CONTAINED FRAME: Photo inside a rounded rectangle (16px radius) with subtle shadow. Clean and professional.
3. FULL BACKGROUND: Photo as full background with gradient overlay for text readability. Most immersive.
"""

DESIGN_AUDIT = """
## Design Audit: What to Keep, Fix, and Add

### KEEP (from OneForma's identity)
- Purple gradient as primary palette anchor
- Pink/magenta CTAs (recognizable brand element)
- Gold highlights on dollar amounts
- Pill-shaped CTA buttons with arrow
- Real people (UGC style, not stock photos)

### FIX (weaknesses in current ads)
- NO template fatigue: every creative must look unique, not a cookie-cutter layout
- Add breathing room: 20-30% whitespace, don't fill every pixel with purple
- Create clear typographic hierarchy: headline > subheadline > CTA (3 distinct levels)
- Add text readability: semi-transparent overlays or contained text zones behind text on photos

### ADD (new elements we bring)
- Organic blob shapes in corners/edges (purple-pink gradient fill)
- Dot grid patterns as subtle texture
- Trust badges: "Powered by Centific" with blur backdrop
- Stat callouts when using social proof hook
- Highlight badges on key words (pink pill behind text)
- Variety in composition: not always centered text — use asymmetric layouts, split panels, offset positioning
"""

OVERLAY_INSTRUCTIONS = """
## Creative Overlay Generation Instructions

You are designing a recruitment ad creative for OneForma as a single self-contained HTML file.

### CRITICAL RULES:
1. Output ONLY valid HTML. No markdown, no explanation, no commentary.
2. Canvas size must be EXACTLY {width}x{height} pixels.
3. All text must be within {safe_margin}px of edges (safe area).
4. Background can be white (#FFFFFF), light gray (#F8F9FA), or transparent — NOT always dark.
5. Use the provided image URLs via <img> tags with absolute positioning.
6. All styles must be INLINE (no external CSS, no <style> blocks with class selectors).
7. Use only system fonts: -apple-system, 'Segoe UI', Roboto, sans-serif.
8. Decorative SVG elements (blobs, dots) must be inline SVG, not external files.
9. The HTML must render correctly in a headless Chromium browser.

### OVERLAY COPY RULES:
- Headline: 3-7 words MAXIMUM. Short. Punchy. Scroll-stopping.
- Subheadline: 0-1 short line. Can be empty for cleaner designs.
- CTA: 2-3 words. Action-oriented.
- The overlay copy must be DIFFERENT from the platform ad copy provided.
- The overlay copy must target THIS persona's specific pain points.
- The overlay copy must match what's happening in THE SCENE (the image).

### IMAGE USAGE:
You receive 3 image options per actor:
- full_image_url: Original photo with background (use as background or in contained frame)
- cutout_url: Person with transparent background (use for popout/floating effects)
- cutout_shadow_url: Person cutout with drop shadow (use for premium floating look)

Choose the best option for your design. You can use:
- Cutout on white/gradient bg with blob shapes (matches OneForma's "Join Your Child" style)
- Full image as background with text overlay (immersive UGC style)
- Full image in a contained rounded frame with decorative elements around it
- Cutout popping out of a card frame boundary

### RETURN FORMAT:
Return a JSON array. Each element has:
{{
  "actor_name": "Name",
  "scene": "at_home_working|at_home_relaxed|cafe_working|celebrating_earnings",
  "overlay_headline": "3-7 word headline",
  "overlay_sub": "optional subheadline",
  "overlay_cta": "CTA text",
  "image_treatment": "cutout_popout|contained_frame|full_background",
  "html": "<!DOCTYPE html><html>...</html>"
}}
"""

# ── Frontend Design Skill (loaded once at import) ────────────────

_FRONTEND_DESIGN_SKILL = ""

def get_frontend_design_skill() -> str:
    """Load the frontend-design skill markdown for Kimi prompt injection."""
    global _FRONTEND_DESIGN_SKILL
    if _FRONTEND_DESIGN_SKILL:
        return _FRONTEND_DESIGN_SKILL

    skill_path = os.path.join(
        os.path.expanduser("~"),
        ".claude/plugins/cache/claude-plugins-official/frontend-design",
    )
    # Find the SKILL.md file (path includes a hash directory)
    for root, dirs, files in os.walk(skill_path):
        for f in files:
            if f == "SKILL.md":
                with open(os.path.join(root, f), "r") as fh:
                    _FRONTEND_DESIGN_SKILL = fh.read()
                return _FRONTEND_DESIGN_SKILL

    # Fallback: minimal design instructions
    _FRONTEND_DESIGN_SKILL = (
        "Design with clear visual hierarchy, generous whitespace, "
        "consistent spacing, and scroll-stopping typography. "
        "Avoid generic layouts — make each creative feel unique and intentional."
    )
    return _FRONTEND_DESIGN_SKILL
