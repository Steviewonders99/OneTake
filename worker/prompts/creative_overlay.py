"""Prompt templates for Stage 4 v2 LLM-designed creative overlays.

Contains:
- OneForma brand kit (from Meta Ads Library audit)
- Design audit (strengths/weaknesses/opportunities)
- Overlay generation instructions
- Frontend-design skill content (loaded from file at startup)

Pure data module — no logic, no API calls.
"""
from __future__ import annotations

# ── OneForma Brand Kit ───────────────────────────────────────────
# Extracted from Meta Ads Library audit (March 29, 2026)

BRAND_KIT = """
## OneForma Brand Kit

### Colors
- Primary background: White (#FFFFFF) or light gray (#F8F9FA) — clean, professional
- Accent gradient: Deep purple (#3D1059) → Medium purple (#6B21A8) → Bright purple (#9B51E0)
- CTA gradient: Purple (#6B21A8) → Hot pink (#E91E8C) — pill-shaped buttons
- Emphasis/highlight: Hot pink (#E91E8C) or white bold — NO gold, NO yellow. Stay on-brand.
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
- Pink (#E91E8C) or white bold for emphasis — NO gold/yellow
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

DESIGN_PSYCHOLOGY = """
## Design Psychology Principles (Apply These in Every Creative)

### Von Restorff Effect (Isolation Effect)
ONE element must be visually different from everything else — this is what the eye locks onto.
CSS: Make the CTA button the ONLY element with the pink-purple gradient. Make the headline the ONLY serif text. The isolated element gets remembered.

### Visual Hierarchy (F-Pattern / Z-Pattern)
Eyes scan top-left → top-right → down-left → down-right (Z-pattern) or top-left → down the left side (F-pattern).
CSS: Place headline top-left or center-top. CTA at bottom-left or bottom-center. Never bury the headline at bottom-right.

### Gestalt Proximity
Elements near each other are perceived as a group. Headline + subheadline should be close together. CTA should have MORE space above it (separating it from the text group).
CSS: margin-bottom between headline and sub: 8-12px. margin-top above CTA: 24-40px.

### Hick's Law (Reduce Choices)
ONE headline. ONE subheadline (optional). ONE CTA. Nothing else competing for attention.
CSS: Remove any element that doesn't serve headline, sub, CTA, or photo. If you added decorative text, stat badge, AND trust badge — that's too many. Pick 1-2.

### Color Psychology for Recruitment Ads
- Purple (#6B21A8): authority, ambition, creativity — "this is a real company"
- Pink (#E91E8C): energy, action, urgency — "act now"
- White: clean, trustworthy, professional — "we're legitimate"
- Avoid red (scam association in gig economy), avoid yellow (cheap feeling)

### Layering for Depth (3-Layer Minimum)
Every premium creative has at least 3 visual layers creating depth:
1. BACK: Background (photo or solid color)
2. MIDDLE: Semi-transparent shape, gradient, or blur overlay
3. FRONT: Text + CTA (highest z-index, sharpest contrast)
CSS: Use z-index: 1/2/3. The middle layer (gradient/shape) at opacity 0.6-0.85 creates the depth illusion.

### Serial Position Effect
People remember the FIRST and LAST things they see. First = headline (top). Last = CTA (bottom).
CSS: Headline at top of text zone. CTA at very bottom. Subheadline in the middle (least remembered — keep it short).

### Whitespace as Design Element
20-30% of canvas should be empty. Whitespace around the headline makes it feel more important.
CSS: padding: 40-60px around text blocks. Don't fill every pixel. The emptiness IS the design.

### Aesthetic-Usability Effect
Attractive designs are perceived as more usable and trustworthy. Invest in clean details.
CSS: Smooth border-radius: 12-20px. Subtle box-shadow: 0 4px 16px rgba(0,0,0,0.08). Consistent spacing. Smooth gradients (not harsh).
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
10. NO gold or yellow colors. ONLY purple, pink, white, dark gray. Stay on-brand.

### LAYOUT COMPOSITION:
The photo is the visual anchor. Text and brand elements FRAME the photo — never obscure it.

RULE #1: ALL TEXT MUST BE 100% READABLE. Never place text where it overlaps the person's face or body.
RULE #2: The person's face must be FULLY VISIBLE — no text, blobs, or elements covering it.
RULE #3: Use gradient overlays or solid-color text zones to guarantee readability.

Layout patterns (pick one per creative):
  A. GRADIENT OVERLAY: Photo fills canvas. Dark gradient from bottom (or side) creates a text-safe zone.
     Headline + CTA sit in the gradient zone. Person visible in the clear area.
  B. SPLIT LAYOUT: Photo on one side (~60%), brand zone on other side (~40%).
     All text in the brand zone on solid/gradient bg. Photo untouched.
  C. CARD FRAME: Photo in a rounded rect, smaller than canvas. Text + blobs around the frame.
     Professional, clean. Photo contained but prominent.

Decorative elements:
- 1-2 subtle blob shapes (purple-pink gradient, low opacity ~0.15) for brand identity.
- Blobs should be BACKGROUND decoration, not competing with the photo or text.
- NO blobs overlapping the person's face or body.
- Keep blobs in corners/edges where they add composition without distraction.

### TYPOGRAPHY:
- Headline: Bold system font, weight 800, large but NOT overlapping the photo subject.
- Subheadline: Regular weight, 50-60% of headline size.
- CTA: Bold uppercase in a pill button with gradient bg and box-shadow.
- Clear hierarchy: headline > sub > CTA, all in the designated text zone.
- Font sizes: headline 36-56px, sub 16-22px, CTA 14-18px (adjust for canvas size).

### SERIF HEADLINE RULE (MANDATORY for premium feel):
- Headlines MUST use font-family: Georgia, 'Times New Roman', serif — NOT sans-serif
- Weight: 700-800, NOT 400
- Line-height: 1.05-1.15 (tight, dramatic)
- Letter-spacing: -0.02em (slightly tightened)
- Break headline into 2-3 WORDS PER LINE, stacked vertically for dramatic effect
- Example: instead of "Bilingual: Earn From Home" on one line, use line breaks:
  "Bilingual:\nEarn From\nHome" stacked across 3 lines
- Subheadline stays in sans-serif (system fonts), creating contrast with the serif headline

### DESIGN BALANCE:
- Keep at least 20% whitespace — let the design breathe.
- The person's face is the visual anchor. Everything else supports it.
- Clean, premium, intentional feel. Every element has a purpose.
- If in doubt, use LESS decoration. Simplicity > complexity.

### OVERLAY COPY RULES:
- Headline: 3-7 words MAXIMUM. Short. Punchy. Scroll-stopping.
- Subheadline: 0-1 short line. Can be empty for cleaner designs.
- CTA: 2-3 words. Action-oriented.
- The overlay copy must be DIFFERENT from the platform ad copy provided.
- The overlay copy must target THIS persona's specific pain points.
- The overlay copy MUST match what's happening in THE SCENE (the image).
- Each actor has a SCENE DESCRIPTION that tells you exactly what's in the photo.
- If the person is at a desk with a laptop, do NOT write "Your couch" — write about working/earning.
- If the person is at a cafe, write about working anywhere/freedom.
- If the person is celebrating, write about success/earnings/achievement.
- READ THE SCENE DESCRIPTION CAREFULLY before writing ANY headline.

### IMAGE USAGE:
You receive ONE image per actor: full_image_url (the original photo with background).
DO NOT attempt background removal, cutouts, or transparent overlays on the image.

Use the FULL IMAGE in one of these treatments:
1. FULL BACKGROUND: Photo fills the entire canvas. Gradient overlay (bottom-to-top or side) creates readable text zones. Most immersive — best for TikTok, Stories, IG feed.
2. CONTAINED FRAME: Photo inside a rounded rectangle (border-radius: 16px) positioned to one side. Text + decorative elements fill the other side. Clean, professional — best for LinkedIn, Facebook.
3. SPLIT PANEL: Canvas divided ~60/40. Photo fills one side, text + brand elements fill the other on a solid/gradient bg. Modern editorial feel.

For ALL treatments:
- Photo must be displayed at its NATURAL aspect ratio — no stretching or squishing.
- Use object-fit: cover with strategic object-position to focus on the person's face.
- Add a semi-transparent gradient overlay where text appears (e.g., linear-gradient(to top, rgba(0,0,0,0.7), transparent)) to ensure text readability.
- The person's face must be FULLY VISIBLE and not obscured by text or decorative elements.

### RETURN FORMAT:
Return a JSON array. Each element has:
{{
  "actor_name": "Name",
  "scene": "scene_key",
  "overlay_headline": "3-7 word headline",
  "overlay_sub": "optional subheadline",
  "overlay_cta": "CTA text",
  "image_treatment": "full_background|contained_frame|split_panel",
  "html": "<!DOCTYPE html><html>...</html>"
}}

### LAYOUT PATTERN CONSTRAINT:
{pattern_instruction}
"""

# ── Creative Design Skill (refined for recruitment ad creatives) ──

CREATIVE_DESIGN_SKILL = """
## $50K Designer Creative Skill — Recruitment Ad Creatives

You are an elite creative director designing scroll-stopping recruitment ad
creatives. Your output competes with $50K agency work from Ogilvy, Droga5,
and Wieden+Kennedy. Every pixel must be intentional.

### DESIGN PHILOSOPHY: Clean, Bold, Readable
The photo is the hero. Text is the hook. Brand elements frame everything.
ALL TEXT MUST BE 100% READABLE — never obscured by the person or busy backgrounds.

EDITORIAL SIDE (stops the scroll):
- Bold, large typography in a CLEAR TEXT ZONE (gradient overlay or solid bg panel)
- Person's face fully visible and prominent — the human connection
- Intentional negative space (20-30%) — let the design breathe
- 1-2 subtle brand blobs in corners for identity (low opacity, decorative only)

PERFORMANCE SIDE (drives the click):
- Bold headline with optional highlight effect (key word in pink pill badge)
- Trust badge: "Powered by Centific" — small, clean, positioned in corner
- Stat callout when relevant (earnings, contributors, countries)
- Strong CTA pill button with gradient bg and box shadow
- Visual hierarchy: eye follows person's face → headline → CTA in under 2 seconds

### COMPOSITION TECHNIQUES (what separates $50K from $500):

1. GRADIENT TEXT ZONES — THE #1 TECHNIQUE:
   Photo fills the canvas. A semi-transparent gradient overlay creates a readable zone
   for text. The person is visible in the clear area. Text is 100% legible in the gradient.
   Example: linear-gradient(to top, rgba(61,16,89,0.85) 0%, rgba(61,16,89,0.4) 40%, transparent 70%)

2. SPLIT PANEL COMPOSITION:
   Photo on one side (~55-65%), text + brand zone on the other (~35-45%).
   Text zone has solid or gradient OneForma purple bg. Clean separation.
   The photo is NEVER covered by text. Each element has its own space.

3. ASYMMETRIC BALANCE:
   Never center everything. Offset the person to one side (60/40 split).
   Text anchored to the opposite edge. Blobs fill the visual gap.
   The eye should trace a Z-pattern or diagonal across the creative.

4. COLOR RESTRAINT WITH PUNCH:
   80% of the creative is white/light gray (breathing room).
   The remaining 20% is concentrated purple/pink (maximum impact).
   One hot pink CTA button draws the eye like a magnet.

5. SUBTLE MOTION CUES:
   Diagonal blob placement suggests movement.
   Rotated text elements (2-5 degrees) add energy without chaos.
   Subtle box-shadow on the photo frame grounds it in the composition.

### WHAT MAKES IT LOOK CHEAP (AVOID):
- Text floating over busy photo areas with no backdrop
- Every element centered and stacked vertically (template look)
- Purple EVERYWHERE — no breathing room
- Tiny headline that doesn't command attention
- Generic stock photo treatment (full bleed, dark overlay)
- CTA that blends into the background
- Headline that doesn't match what's happening in the scene
- Same layout for every creative (cookie cutter)

### CTR OPTIMIZATION SIGNALS:
- Human face visible and prominent (2x higher CTR than no face)
- Eye contact with camera when possible (1.5x engagement boost)
- Contrasting CTA button (pink on white > purple on purple)
- Numbers in headline when relevant ("$25/hr", "50K+ contributors")
- Question headlines outperform statements for recruitment
- Urgency without desperation ("Limited spots" not "Apply NOW!!!")
"""
