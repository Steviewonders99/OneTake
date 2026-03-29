# Stage 4 v2: LLM-Designed Creative Compositor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stage 4's static HTML templates with an LLM-designed creative compositor where Kimi K2.5 generates unique, persona-driven HTML/CSS overlays rendered via Playwright into production creatives with overlay-only exports.

**Architecture:** Kimi K2.5 receives full campaign context (brand kit, frontend-design skill, persona psychology, scene descriptions, image URLs) and generates complete HTML/CSS per creative. Playwright renders two versions per design: final composite + overlay-only transparent. Background removal via rembg creates person cutouts. All renders run in parallel via asyncio.Semaphore.

**Tech Stack:** Python 3.13 (asyncio), Kimi K2.5 via OpenRouter, Playwright (headless Chromium), rembg (U2-Net), Vercel Blob, Neon Postgres.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `worker/ai/creative_designer.py` | **CREATE** | Kimi K2.5 prompt builder + response parser. Builds the mega-prompt, calls OpenRouter, parses JSON array of HTML designs. |
| `worker/prompts/creative_overlay.py` | **CREATE** | Prompt templates: brand kit text, design audit text, overlay instructions. Pure data — no logic. |
| `worker/pipeline/stage4_compose_v2.py` | **CREATE** | New Stage 4 orchestrator. Bg removal → Kimi design → dual render → upload. Parallel via semaphore. |
| `worker/ai/compositor.py` | **MODIFY** | Add `render_overlay_only()` function. Reduce grain opacity. Keep existing functions for fallback. |
| `worker/pipeline/stage2_images.py` | **MODIFY** | Generate 3 actors per persona instead of 1. Small loop change. |
| `worker/pipeline/orchestrator.py` | **MODIFY** | Import `stage4_compose_v2.run_stage4` instead of old `stage4_compose.run_stage4`. |
| `worker/config.py` | **MODIFY** | Add `COMPOSE_CONCURRENCY` env var. |

---

### Task 1: Add COMPOSE_CONCURRENCY config

**Files:**
- Modify: `worker/config.py`

- [ ] **Step 1: Add env var to config.py**

Add after the existing MLX config section in `worker/config.py`:

```python
# ---------------------------------------------------------------------------
# Stage 4 Composition
# ---------------------------------------------------------------------------
COMPOSE_CONCURRENCY = int(os.environ.get("COMPOSE_CONCURRENCY", "5"))
```

- [ ] **Step 2: Verify import works**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from config import COMPOSE_CONCURRENCY; print(f'Concurrency: {COMPOSE_CONCURRENCY}')"`

Expected: `Concurrency: 5`

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/config.py
git commit -m "feat: add COMPOSE_CONCURRENCY config for Stage 4 parallelism"
```

---

### Task 2: Create prompt templates (creative_overlay.py)

**Files:**
- Create: `worker/prompts/creative_overlay.py`

- [ ] **Step 1: Create the prompt data file**

```python
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
```

- [ ] **Step 2: Verify import works**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.creative_overlay import BRAND_KIT, DESIGN_AUDIT, OVERLAY_INSTRUCTIONS, get_frontend_design_skill; print(f'Brand kit: {len(BRAND_KIT)} chars'); print(f'Skill: {len(get_frontend_design_skill())} chars')"`

Expected: Brand kit ~1500 chars, Skill ~4000 chars.

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/prompts/creative_overlay.py
git commit -m "feat: add creative overlay prompt templates with brand kit + design audit"
```

---

### Task 3: Create the creative designer (Kimi K2.5 caller)

**Files:**
- Create: `worker/ai/creative_designer.py`

- [ ] **Step 1: Create the Kimi K2.5 creative designer**

```python
"""Creative designer: Kimi K2.5 generates HTML/CSS ad overlays.

Builds the mega-prompt from campaign context and calls Kimi K2.5
via OpenRouter. Parses the JSON array of HTML creative designs.

Each call produces 2-3 unique creatives for one persona × platform
combination, using different actors, scenes, and persona-driven hooks.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import OPENROUTER_API_KEY
from prompts.creative_overlay import (
    BRAND_KIT,
    DESIGN_AUDIT,
    OVERLAY_INSTRUCTIONS,
    get_frontend_design_skill,
)

logger = logging.getLogger(__name__)


async def design_creatives(
    persona: dict[str, Any],
    actors: list[dict[str, Any]],
    platform: str,
    platform_spec: dict[str, Any],
    brief: dict[str, Any],
    platform_copy: dict[str, Any],
    cultural_research: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Call Kimi K2.5 to design 2-3 creatives for a persona × platform combo.

    Parameters
    ----------
    persona : dict
        Persona archetype with psychology profile, pain points, trigger words.
    actors : list[dict]
        The 3 actors for this persona, each with image URLs and scene data.
    platform : str
        Target platform key (e.g., "ig_feed").
    platform_spec : dict
        Width, height, safe_margin for this platform.
    brief : dict
        Campaign brief with objectives, compensation, messaging strategy.
    platform_copy : dict
        Stage 3 ad copy for this platform (for reference — overlay must not duplicate).
    cultural_research : dict, optional
        Cultural research data for the target region.

    Returns
    -------
    list[dict]
        Each dict has: actor_name, scene, overlay_headline, overlay_sub,
        overlay_cta, image_treatment, html.
    """
    if not OPENROUTER_API_KEY:
        logger.warning("No OPENROUTER_API_KEY — returning empty designs")
        return []

    w = platform_spec["width"]
    h = platform_spec["height"]
    margin = platform_spec["safe_margin"]

    # Build actor context block
    actor_blocks = []
    for actor in actors[:3]:
        name = actor.get("name", "Contributor")
        images = actor.get("images", {})
        scenes = []
        for scene_key, scene_data in images.items():
            scenes.append(
                f"  Scene '{scene_key}': "
                f"full_image_url={scene_data.get('full_url', '')}, "
                f"cutout_url={scene_data.get('cutout_url', '')}, "
                f"cutout_shadow_url={scene_data.get('shadow_url', '')}"
            )
        actor_blocks.append(
            f"Actor: {name} (region: {actor.get('region', 'global')})\n"
            + "\n".join(scenes)
        )
    actors_text = "\n\n".join(actor_blocks)

    # Build persona context
    persona_text = (
        f"Archetype: {persona.get('archetype_key', 'unknown')}\n"
        f"Age range: {persona.get('age_range', 'unknown')}\n"
        f"Lifestyle: {persona.get('lifestyle', 'unknown')}\n"
        f"Pain points: {json.dumps(persona.get('pain_points', []), default=str)}\n"
        f"Motivations: {json.dumps(persona.get('motivations', []), default=str)}\n"
        f"Trigger words: {json.dumps(persona.get('trigger_words', []), default=str)}\n"
        f"Psychology: {json.dumps(persona.get('psychology_profile', {}), default=str)[:500]}"
    )

    # Build brief context
    brief_text = (
        f"Campaign: {brief.get('campaign_objective', 'Recruit contributors')}\n"
        f"Task type: {brief.get('task_type', 'data annotation')}\n"
        f"Compensation: {json.dumps(brief.get('compensation', {}), default=str)}\n"
        f"Messaging: {json.dumps(brief.get('messaging_strategy', {}), default=str)[:400]}"
    )

    # Platform copy reference
    copy_ref = json.dumps(platform_copy, default=str)[:600] if platform_copy else "None available"

    # Build overlay instructions with dimensions injected
    instructions = OVERLAY_INSTRUCTIONS.format(
        width=w, height=h, safe_margin=margin,
    )

    # Assemble the mega-prompt
    system_prompt = (
        f"{get_frontend_design_skill()}\n\n"
        f"{BRAND_KIT}\n\n"
        f"{DESIGN_AUDIT}\n\n"
        f"{instructions}"
    )

    user_prompt = (
        f"Design 2-3 unique ad creatives for OneForma recruitment.\n\n"
        f"CAMPAIGN BRIEF:\n{brief_text}\n\n"
        f"TARGET PERSONA:\n{persona_text}\n\n"
        f"ACTORS (use different actors and scenes for each creative):\n{actors_text}\n\n"
        f"PLATFORM: {platform} ({w}x{h}px, {margin}px safe area)\n\n"
        f"PLATFORM AD COPY (for reference — do NOT duplicate on creative):\n{copy_ref}\n\n"
        f"Return a JSON array of 2-3 creative objects. Each must have: "
        f"actor_name, scene, overlay_headline, overlay_sub, overlay_cta, "
        f"image_treatment, html."
    )

    logger.info(
        "Designing creatives: persona=%s, platform=%s, prompt=%d chars",
        persona.get("archetype_key", "?"), platform,
        len(system_prompt) + len(user_prompt),
    )

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "moonshotai/kimi-k2.5",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": 16384,
                    "temperature": 0.8,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"].get("content", "")

        # Parse JSON array from response
        designs = _parse_designs(content)
        logger.info(
            "Kimi returned %d creative designs for %s/%s",
            len(designs), persona.get("archetype_key", "?"), platform,
        )
        return designs

    except Exception as e:
        logger.error("Kimi creative design failed: %s", e)
        return []


def _parse_designs(text: str) -> list[dict[str, Any]]:
    """Parse JSON array of creative designs from Kimi output.

    Handles markdown code fences and embedded JSON.
    """
    cleaned = text.strip()

    # Strip markdown fences
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    # Try direct parse
    try:
        result = json.loads(cleaned)
        if isinstance(result, list):
            return [d for d in result if isinstance(d, dict) and "html" in d]
        if isinstance(result, dict) and "html" in result:
            return [result]
    except json.JSONDecodeError:
        pass

    # Search for JSON array in text
    bracket_depth = 0
    arr_start = -1
    for i, char in enumerate(cleaned):
        if char == '[':
            if bracket_depth == 0:
                arr_start = i
            bracket_depth += 1
        elif char == ']':
            bracket_depth -= 1
            if bracket_depth == 0 and arr_start >= 0:
                candidate = cleaned[arr_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        return [d for d in parsed if isinstance(d, dict) and "html" in d]
                except json.JSONDecodeError:
                    pass
                arr_start = -1

    # Search for individual JSON objects with html key
    brace_depth = 0
    obj_start = -1
    results = []
    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                obj_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and obj_start >= 0:
                candidate = cleaned[obj_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and "html" in parsed:
                        results.append(parsed)
                except json.JSONDecodeError:
                    pass
                obj_start = -1
    if results:
        return results

    logger.warning("Failed to parse any creative designs from Kimi output (%d chars)", len(text))
    return []
```

- [ ] **Step 2: Verify import works**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from ai.creative_designer import design_creatives, _parse_designs; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Test the JSON parser**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "
from ai.creative_designer import _parse_designs
# Test markdown-wrapped JSON array
result = _parse_designs('\`\`\`json\n[{\"html\": \"<html></html>\", \"actor_name\": \"Omar\"}]\n\`\`\`')
print(f'Parsed {len(result)} designs: {result[0][\"actor_name\"]}')
# Test bare JSON
result2 = _parse_designs('[{\"html\": \"<div>test</div>\", \"actor_name\": \"Amira\"}]')
print(f'Bare JSON: {len(result2)} designs')
"`

Expected: `Parsed 1 designs: Omar` and `Bare JSON: 1 designs`

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/ai/creative_designer.py
git commit -m "feat: add Kimi K2.5 creative designer with mega-prompt builder"
```

---

### Task 4: Add overlay-only render to compositor

**Files:**
- Modify: `worker/ai/compositor.py`

- [ ] **Step 1: Add render_overlay_only function and reduce grain**

Add this function after the existing `render_to_png` function in `worker/ai/compositor.py`. Also reduce the grain CSS opacity from `0.04` to `0.015`.

Find the grain CSS line in `build_overlay_html`:
```python
            opacity:0.04;
```
Replace with:
```python
            opacity:0.015;
```

Then add after the `render_to_png` function:

```python
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
```

- [ ] **Step 2: Verify import works**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from ai.compositor import render_overlay_only; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/ai/compositor.py
git commit -m "feat: add overlay-only render + reduce grain opacity"
```

---

### Task 5: Create Stage 4 v2 orchestrator

**Files:**
- Create: `worker/pipeline/stage4_compose_v2.py`

- [ ] **Step 1: Create the new Stage 4 orchestrator**

```python
"""Stage 4 v2: LLM-Designed Creative Compositor.

Kimi K2.5 designs unique, persona-driven HTML/CSS overlays per creative.
Each actor scene gets overlay variations matched to persona psychology.
Dual render: final creative + overlay-only transparent export.
All renders run in parallel via asyncio.Semaphore.

Pipeline:
  1. Background removal (rembg) for all actor images
  2. Group actors by persona
  3. For each persona × platform: Kimi K2.5 designs 2-3 creatives
  4. Dual Playwright render (final + overlay-only)
  5. Upload to Vercel Blob + save to Neon
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from ai.bg_remover import create_cutout_with_shadow, remove_background
from ai.compositor import PLATFORM_SPECS, render_overlay_only, render_to_png
from ai.creative_designer import design_creatives
from blob_uploader import upload_to_blob
from config import COMPOSE_CONCURRENCY
from neon_client import get_actors, get_assets, save_asset

logger = logging.getLogger(__name__)

DEFAULT_PLATFORMS = [
    "ig_feed",
    "ig_story",
    "linkedin_feed",
    "facebook_feed",
    "telegram_card",
]


async def run_stage4(context: dict) -> dict:
    """Compose final creatives using LLM-designed overlays."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    personas: list = context.get("personas", [])
    design: dict = context.get("design_direction", {})
    cultural_research: dict = context.get("cultural_research", {})

    # Load from Neon
    actors = await get_actors(request_id)
    image_assets = await get_assets(request_id, asset_type="base_image")
    copy_assets = await get_assets(request_id, asset_type="copy")

    if not actors:
        logger.warning("No actors found — skipping Stage 4")
        return {"asset_count": 0}

    # ── Step 1: Background removal for all actor images ──
    logger.info("Step 1: Background removal for %d actor images", len(image_assets))
    image_data = await _prepare_images(image_assets, request_id)

    # ── Step 2: Group actors by persona ──
    actor_by_persona = _group_actors_by_persona(actors, image_data)

    # ── Step 3: Build platform copy lookup ──
    channel_copy = _build_copy_lookup(copy_assets)

    # ── Step 4: Determine platforms ──
    format_matrix = design.get("format_matrix", {})
    platforms = list(format_matrix.keys()) if format_matrix else DEFAULT_PLATFORMS

    # ── Step 5: Design + render all creatives ──
    semaphore = asyncio.Semaphore(COMPOSE_CONCURRENCY)
    all_tasks = []
    asset_count = 0

    for persona in personas:
        archetype = persona.get("archetype_key", "unknown")
        persona_actors = actor_by_persona.get(archetype, [])
        if not persona_actors:
            # Fallback: distribute all actors evenly
            persona_actors = actors[:3]

        for platform in platforms:
            spec = PLATFORM_SPECS.get(platform)
            if not spec:
                continue

            copy_data = _find_copy(channel_copy, platform)

            # Kimi designs 2-3 creatives for this persona × platform
            all_tasks.append(
                _design_and_render_batch(
                    semaphore=semaphore,
                    persona=persona,
                    actors_for_persona=persona_actors,
                    platform=platform,
                    spec=spec,
                    brief=brief,
                    platform_copy=copy_data,
                    cultural_research=cultural_research,
                    request_id=request_id,
                )
            )

    # Run all batches in parallel (semaphore limits concurrency)
    results = await asyncio.gather(*all_tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, int):
            asset_count += r
        elif isinstance(r, Exception):
            logger.error("Batch failed: %s", r)

    logger.info("Stage 4 complete: %d composed creatives", asset_count)
    return {"asset_count": asset_count}


async def _design_and_render_batch(
    semaphore: asyncio.Semaphore,
    persona: dict,
    actors_for_persona: list[dict],
    platform: str,
    spec: dict,
    brief: dict,
    platform_copy: dict,
    cultural_research: dict,
    request_id: str,
) -> int:
    """Design 2-3 creatives for one persona × platform, then render all."""
    async with semaphore:
        archetype = persona.get("archetype_key", "?")
        logger.info(
            "Designing: %s / %s (%dx%d)",
            archetype, platform, spec["width"], spec["height"],
        )

        designs = await design_creatives(
            persona=persona,
            actors=actors_for_persona,
            platform=platform,
            platform_spec=spec,
            brief=brief,
            platform_copy=platform_copy,
            cultural_research=cultural_research,
        )

        if not designs:
            logger.warning("No designs returned for %s/%s", archetype, platform)
            return 0

        count = 0
        for design_spec in designs:
            try:
                html = design_spec.get("html", "")
                if not html or len(html) < 50:
                    continue

                w, h = spec["width"], spec["height"]

                # Dual render: final + overlay-only
                final_png = await render_to_png(html, w, h)
                overlay_png = await render_overlay_only(html, w, h)

                # Upload both
                uid = uuid.uuid4().hex[:8]
                final_name = f"creative_{platform}_{uid}.png"
                overlay_name = f"overlay_{platform}_{uid}.png"

                final_url = await upload_to_blob(
                    final_png, final_name,
                    folder=f"requests/{request_id}/composed",
                )
                overlay_url = await upload_to_blob(
                    overlay_png, overlay_name,
                    folder=f"requests/{request_id}/overlays",
                )

                # Save to Neon
                await save_asset(request_id, {
                    "asset_type": "composed_creative",
                    "platform": platform,
                    "format": f"{w}x{h}",
                    "language": platform_copy.get("language", ""),
                    "blob_url": final_url,
                    "metadata": {
                        "actor_name": design_spec.get("actor_name", ""),
                        "scene": design_spec.get("scene", ""),
                        "overlay_headline": design_spec.get("overlay_headline", ""),
                        "overlay_sub": design_spec.get("overlay_sub", ""),
                        "overlay_cta": design_spec.get("overlay_cta", ""),
                        "image_treatment": design_spec.get("image_treatment", ""),
                        "overlay_url": overlay_url,
                        "persona": persona.get("archetype_key", ""),
                        "platform_headline": platform_copy.get("headline", ""),
                        "platform_description": platform_copy.get(
                            "description", platform_copy.get("primary_text", "")
                        ),
                    },
                    "stage": 4,
                })
                count += 1
                logger.info(
                    "  Composed: %s/%s — %s (%s)",
                    archetype, platform,
                    design_spec.get("overlay_headline", "?"),
                    design_spec.get("image_treatment", "?"),
                )

            except Exception as e:
                logger.error(
                    "  Render failed: %s/%s — %s",
                    archetype, platform, e,
                )
                continue

        return count


async def _prepare_images(
    image_assets: list[dict],
    request_id: str,
) -> dict[str, dict]:
    """Run background removal on all actor images, upload cutouts.

    Returns dict: asset_id -> {full_url, cutout_url, shadow_url, actor_id, scene}
    """
    results: dict[str, dict] = {}

    for asset in image_assets:
        asset_id = str(asset.get("id", ""))
        actor_id = str(asset.get("actor_id", ""))
        full_url = asset.get("blob_url", "")
        content = asset.get("content")
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                content = {}

        scene = "seed"
        if isinstance(content, dict):
            outfit = content.get("outfit_key", "")
            if outfit:
                scene = outfit

        if not full_url:
            continue

        # Download the image for bg removal
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(full_url)
                resp.raise_for_status()
                image_bytes = resp.content

            # Background removal
            cutout_bytes = await remove_background(image_bytes)
            shadow_bytes = await create_cutout_with_shadow(image_bytes)

            # Upload cutouts
            uid = uuid.uuid4().hex[:6]
            cutout_url = await upload_to_blob(
                cutout_bytes, f"cutout_{uid}.png",
                folder=f"requests/{request_id}/cutouts",
            )
            shadow_url = await upload_to_blob(
                shadow_bytes, f"shadow_{uid}.png",
                folder=f"requests/{request_id}/cutouts",
            )

            results[asset_id] = {
                "full_url": full_url,
                "cutout_url": cutout_url,
                "shadow_url": shadow_url,
                "actor_id": actor_id,
                "scene": scene,
            }
            logger.info("Bg removed: %s (%s)", actor_id[:8], scene)

        except Exception as e:
            logger.error("Bg removal failed for %s: %s", asset_id[:8], e)
            results[asset_id] = {
                "full_url": full_url,
                "cutout_url": full_url,  # Fallback: use full image
                "shadow_url": full_url,
                "actor_id": actor_id,
                "scene": scene,
            }

    return results


def _group_actors_by_persona(
    actors: list[dict],
    image_data: dict[str, dict],
) -> dict[str, list[dict]]:
    """Group actors by persona archetype, attach image URLs."""
    grouped: dict[str, list[dict]] = {}

    # Build actor_id -> images lookup
    images_by_actor: dict[str, dict[str, dict]] = {}
    for img_data in image_data.values():
        aid = img_data["actor_id"]
        scene = img_data["scene"]
        if aid not in images_by_actor:
            images_by_actor[aid] = {}
        images_by_actor[aid][scene] = img_data

    for actor in actors:
        actor_id = str(actor.get("id", ""))
        # Try to determine persona from actor data
        face_lock = actor.get("face_lock")
        if isinstance(face_lock, str):
            try:
                face_lock = json.loads(face_lock)
            except (json.JSONDecodeError, TypeError):
                face_lock = {}

        persona_key = "unknown"
        if isinstance(face_lock, dict):
            persona_key = face_lock.get("persona_key", "unknown")

        # Attach images
        actor_with_images = {
            **actor,
            "images": images_by_actor.get(actor_id, {}),
            "persona_key": persona_key,
        }

        if persona_key not in grouped:
            grouped[persona_key] = []
        grouped[persona_key].append(actor_with_images)

    return grouped


def _build_copy_lookup(copy_assets: list[dict]) -> dict[str, dict]:
    """Build platform -> copy data lookup from Stage 3 assets."""
    result: dict[str, dict] = {}
    for asset in copy_assets:
        platform = asset.get("platform", "")
        raw = asset.get("content") or asset.get("copy_data") or {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                raw = {}
        if isinstance(raw, dict) and raw:
            result[platform] = raw.get("copy_data", raw)
    return result


def _find_copy(channel_copy: dict, platform: str) -> dict:
    """Find copy data for a platform with fuzzy fallback."""
    if platform in channel_copy:
        return channel_copy[platform]

    fallback_map = {
        "ig_feed": ["facebook_feed", "linkedin_feed"],
        "ig_story": ["tiktok_feed", "facebook_feed"],
        "telegram_card": ["linkedin_feed", "facebook_feed"],
    }
    for fallback in fallback_map.get(platform, []):
        if fallback in channel_copy:
            return channel_copy[fallback]

    if channel_copy:
        return next(iter(channel_copy.values()))
    return {}
```

- [ ] **Step 2: Verify import works**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from pipeline.stage4_compose_v2 import run_stage4; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/pipeline/stage4_compose_v2.py
git commit -m "feat: add Stage 4 v2 orchestrator with LLM creative design + parallel render"
```

---

### Task 6: Wire Stage 4 v2 into orchestrator

**Files:**
- Modify: `worker/pipeline/orchestrator.py`

- [ ] **Step 1: Update the import**

In `worker/pipeline/orchestrator.py`, change line 15:

```python
from pipeline.stage4_compose import run_stage4
```

to:

```python
from pipeline.stage4_compose_v2 import run_stage4
```

- [ ] **Step 2: Verify orchestrator still imports cleanly**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from pipeline.orchestrator import run_pipeline; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/pipeline/orchestrator.py
git commit -m "feat: wire Stage 4 v2 into pipeline orchestrator"
```

---

### Task 7: Update Stage 2 for 3 actors per persona

**Files:**
- Modify: `worker/pipeline/stage2_images.py`

- [ ] **Step 1: Find the actor generation loop**

In `worker/pipeline/stage2_images.py`, find the section where persona-driven actor jobs are built (around lines 55-75). Currently it creates 1 actor per persona:

```python
for persona in personas:
    actor_jobs.append({
        "region": region,
        "language": language,
        "persona": persona,
    })
```

Change it to create 3 actors per persona:

```python
ACTORS_PER_PERSONA = 3

for persona in personas:
    for actor_idx in range(ACTORS_PER_PERSONA):
        actor_jobs.append({
            "region": region,
            "language": language,
            "persona": persona,
            "actor_index": actor_idx,  # Used for name/appearance variety
        })
```

- [ ] **Step 2: Update the actor prompt to request variety**

In the same file, find where the actor prompt is built (around line 98). After the existing `actor_prompt = build_persona_actor_prompt(persona, region, language)` line, add variety instruction:

```python
if persona:
    actor_prompt = build_persona_actor_prompt(persona, region, language)
    actor_idx = job.get("actor_index", 0)
    if actor_idx > 0:
        actor_prompt += (
            f"\n\nIMPORTANT: This is actor #{actor_idx + 1} for the same persona. "
            f"Generate a DIFFERENT person — different gender, age within range, "
            f"appearance, and name. Must be visually distinct from other actors."
        )
```

- [ ] **Step 3: Verify the file still parses**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from pipeline.stage2_images import run_stage2; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/pipeline/stage2_images.py
git commit -m "feat: generate 3 actors per persona for creative diversity"
```

---

## Self-Review

**Spec coverage check:**
- Background removal (§5.1) → Task 5 (`_prepare_images`)
- LLM creative design (§4) → Task 3 (`creative_designer.py`)
- Dual render (§5.2) → Task 4 (`render_overlay_only`) + Task 5 (dual render in `_design_and_render_batch`)
- Concurrency (§5.3) → Task 1 (config) + Task 5 (semaphore)
- Prompt context 7/8 (§3) → Task 2 (brand kit, audit, instructions, frontend skill)
- 3 actors per persona (§2) → Task 7
- Overlay vs platform copy distinction (§8) → Task 2 (instructions) + Task 5 (metadata saves both)
- Error handling (§9) → Task 5 (try/except per creative, fallback on bg removal)
- Wire into orchestrator → Task 6

**Placeholder scan:** No TBDs, TODOs, or "fill in later" found. All code blocks are complete.

**Type consistency:** `design_creatives` returns `list[dict]`, consumed by `_design_and_render_batch`. `_parse_designs` returns `list[dict]` with `html` key required. `render_to_png` and `render_overlay_only` both take `(html, width, height) -> bytes`. All consistent.
