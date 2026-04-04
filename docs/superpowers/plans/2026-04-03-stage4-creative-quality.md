# Stage 4 Creative Quality Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Stage 4 composed creatives to agency quality with a Gemma 4 VQA gate that returns actionable CSS fixes, 10 brand-researched HTML templates, layout diversity enforcement, and a feedback loop that re-prompts GLM-5 with specific fixes.

**Architecture:** Four additions to the Stage 4 pipeline: (1) Replace 3 HTML templates with 10 new ones from Pomelli/brand research, (2) Add design psychology + layering principles to the creative overlay prompt, (3) Add Gemma 4 31B VQA gate with per-dimension CSS fix instructions after Playwright render, (4) Feedback loop that passes VQA fixes back to GLM-5 for HTML correction, with layout diversity enforcement assigning different patterns to each creative in a batch.

**Tech Stack:** Python, Gemma 4 31B (NIM, free), GLM-5 (NIM, free), Playwright (headless render), existing worker pipeline

---

### Task 1: Expand HTML reference templates (3 → 10)

**Files:**
- Modify: `worker/prompts/html_reference_templates.py`

- [ ] **Step 1: Read the existing file to understand the current template structure**

Read `worker/prompts/html_reference_templates.py`. Note the format: each template is a Python string constant with `{width}`, `{height}`, `{safe_margin}`, `{image_url}`, `{headline}`, `{subheadline}`, `{cta}` placeholders. The function `get_all_references_for_prompt()` returns them as a formatted string.

- [ ] **Step 2: Replace the file with 10 new templates**

Rewrite `worker/prompts/html_reference_templates.py` with all 10 templates from the spec. Each template must:
- Be a complete HTML document (renders in headless Chromium)
- Use OneForma brand colors (white bg, purple #6B21A8, pink #E91E8C, charcoal #1A1A1A)
- Use placeholder variables: `{width}`, `{height}`, `{image_url}`, `{headline}`, `{subheadline}`, `{cta}`, `{safe_top}`, `{safe_bottom}`, `{safe_left}`, `{safe_right}`
- Include inline styles only (no external CSS)
- Use system fonts for body + CTA, Georgia serif for headlines

The 10 templates:
1. `TEMPLATE_EDITORIAL_SERIF_HERO` — full-bleed photo, white gradient overlay (bottom 40%), serif headline stacked 2-3 words/line, no CTA button
2. `TEMPLATE_SPLIT_ZONE` — photo left 55%, brand panel right 45% with curved SVG wave divider, dot grid bg, serif headline in brand zone
3. `TEMPLATE_STAT_CALLOUT` — white bg, massive purple stat number (72-96px serif), photo in rounded frame offset, accent line above stat
4. `TEMPLATE_EDITORIAL_MAGAZINE` — white bg, 30%+ whitespace, photo right 50%, serif headline left-aligned stacked, thin purple accent line
5. `TEMPLATE_CONTAINED_CARD` — light gray bg, photo in rounded card with shadow, blobs behind card, CTA overlapping card edge
6. `TEMPLATE_PHOTO_MINIMAL` — photo fills 100%, zero overlay, white text with text-shadow only, serif headline
7. `TEMPLATE_TOP_TEXT_BOTTOM_PHOTO` — dark header zone (top 35%), huge serif headline in white, curved clip-path transition, photo fills bottom 65%
8. `TEMPLATE_DIVERSITY_GRID` — white bg, 4-6 small rounded photos scattered asymmetrically, purple-pink gradient wave at bottom with headline
9. `TEMPLATE_UI_SHOWCASE` — person with device, floating UI card overlay, headline alongside
10. `TEMPLATE_TESTIMONIAL` — white bg, large purple quote marks, serif italic quote text, circle person photo, name/title below

Also update `get_all_references_for_prompt()` to return all 10, and add `get_template_by_pattern(pattern_name)` that returns a specific template.

- [ ] **Step 3: Verify Python syntax**

Run: `/opt/homebrew/bin/python3.13 -c "import py_compile; py_compile.compile('prompts/html_reference_templates.py', doraise=True)"` from the worker directory.

- [ ] **Step 4: Commit**

```bash
git add worker/prompts/html_reference_templates.py
git commit -m "feat: 10 HTML reference templates from Pomelli/brand research"
```

---

### Task 2: Update creative overlay prompt with design psychology + serif rules

**Files:**
- Modify: `worker/prompts/creative_overlay.py`

- [ ] **Step 1: Read the existing file**

Read `worker/prompts/creative_overlay.py`. Note: `BRAND_KIT`, `DESIGN_AUDIT`, `OVERLAY_INSTRUCTIONS`, and `CREATIVE_DESIGN_SKILL` constants.

- [ ] **Step 2: Add design psychology principles section**

Add a new constant `DESIGN_PSYCHOLOGY` after `DESIGN_AUDIT`:

```python
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
"""
```

- [ ] **Step 3: Update OVERLAY_INSTRUCTIONS to reference serif headlines and pattern constraints**

In `OVERLAY_INSTRUCTIONS`, find the `### TYPOGRAPHY:` section and update:

Add after the existing typography rules:
```
### SERIF HEADLINE RULE (MANDATORY for premium feel):
- Headlines MUST use Georgia, 'Times New Roman', serif — NOT sans-serif
- Weight: 700-800, NOT 400
- Line-height: 1.05-1.15 (tight, dramatic)
- Letter-spacing: -0.02em (slightly tightened)
- Break headline into 2-3 WORDS PER LINE, stacked vertically for dramatic effect
- Example: instead of "Bilingual: Earn From Home" on one line →
  "Bilingual:\nEarn From\nHome" stacked across 3 lines

### LAYOUT PATTERN CONSTRAINT:
{pattern_instruction}
```

- [ ] **Step 4: Add the pattern_instruction injection point**

In the `OVERLAY_INSTRUCTIONS` string, add `{pattern_instruction}` placeholder where the layout pattern constraint will be injected. The Stage 4 pipeline will fill this with "You MUST use the {pattern_name} layout. Reference template: {template_html}".

- [ ] **Step 5: Verify syntax and commit**

```bash
python3.13 -c "import py_compile; py_compile.compile('prompts/creative_overlay.py', doraise=True)"
git add worker/prompts/creative_overlay.py
git commit -m "feat: design psychology principles + serif headline rules in creative prompt"
```

---

### Task 3: Add Gemma 4 Creative VQA function

**Files:**
- Modify: `worker/ai/creative_vqa.py`

- [ ] **Step 1: Read the existing creative_vqa.py**

Read the file. Note: it has `check_deterministic()` for Phase 1 and `evaluate_creative_vlm()` for Phase 2. We're adding `evaluate_composed_creative_gemma4()` as a new Phase 3 that runs on the final rendered PNG.

- [ ] **Step 2: Add the Gemma 4 evaluation function**

Add to `worker/ai/creative_vqa.py`:

```python
# Gemma 4 VQA config
GEMMA4_VQA_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_VQA_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))
COMPOSED_VQA_THRESHOLD = 0.70


async def evaluate_composed_creative(
    image_path: str,
    platform: str,
    headline: str = "",
) -> dict[str, Any]:
    """Evaluate a composed creative using Gemma 4 31B Vision on NIM.

    Returns detailed per-dimension scores with actionable CSS fix instructions
    that can be passed directly back to GLM-5 for HTML correction.

    Returns
    -------
    dict with:
        - dimensions: dict of {dimension_name: {score, fix}}
        - overall_score: float
        - passed: bool
        - top_3_fixes: list[str]
    """
```

The function should:
1. Read image from `image_path`, resize to 512x512 JPEG, base64 encode
2. Call NIM `google/gemma-4-31b-it` with the 7-dimension prompt (the exact prompt from our successful test — text_readability, visual_hierarchy, typography_quality, photo_integration, layout_composition, brand_elements, scroll_stop_power)
3. Each dimension returns `{score, fix}` where fix is a specific CSS instruction
4. Parse JSON response, fall back to prose scoring if JSON fails
5. Return the full evaluation dict

Use `httpx.AsyncClient` with 90s timeout. Import `base64`, `json`, `os`, `logging`.

- [ ] **Step 3: Verify syntax and commit**

```bash
python3.13 -c "import py_compile; py_compile.compile('ai/creative_vqa.py', doraise=True)"
git add worker/ai/creative_vqa.py
git commit -m "feat: Gemma 4 creative VQA with actionable CSS fix instructions"
```

---

### Task 4: Add VQA gate + feedback loop + layout diversity to Stage 4

**Files:**
- Modify: `worker/pipeline/stage4_compose_v2.py`

- [ ] **Step 1: Read the relevant sections of stage4_compose_v2.py**

Read the file focusing on:
- Where tasks are built for each persona×platform (around line 146-210)
- Where `_design_and_render_batch()` is defined
- Where the rendered PNG is saved to blob

- [ ] **Step 2: Add layout diversity enforcement**

In the task-building section (where `tasks.append(...)` is called for each persona×platform):

Add a pattern assignment system:
```python
PATTERN_POOL = [
    "editorial_serif_hero", "split_zone", "stat_callout",
    "editorial_magazine", "contained_card", "photo_minimal",
    "top_text_bottom_photo", "diversity_grid", "ui_showcase", "testimonial",
]

# Assign different patterns to each creative in a batch
# Each persona×platform gets 3 creatives with 3 different patterns
pattern_cycle = itertools.cycle(PATTERN_POOL)
```

When building tasks, assign `required_pattern=next(pattern_cycle)` to each creative. Pass this through to `_design_and_render_batch()`.

- [ ] **Step 3: Inject pattern constraint into GLM-5 prompt**

In `_design_and_render_batch()` (or wherever the GLM-5 prompt is assembled), inject:
```python
from prompts.html_reference_templates import get_template_by_pattern

pattern_template = get_template_by_pattern(required_pattern)
pattern_instruction = f"""You MUST use the '{required_pattern}' layout pattern.
Here is the reference HTML template for this pattern:
{pattern_template}
Adapt this template with the provided image URL, headline, subheadline, and CTA.
Do NOT use a different layout pattern."""
```

Fill `{pattern_instruction}` in `OVERLAY_INSTRUCTIONS` with this string.

- [ ] **Step 4: Add VQA gate after Playwright render**

After each creative is rendered to PNG by Playwright, before uploading to blob:

```python
from ai.creative_vqa import evaluate_composed_creative, COMPOSED_VQA_THRESHOLD

# VQA gate
vqa_result = await evaluate_composed_creative(
    image_path=rendered_png_path,
    platform=platform,
    headline=headline,
)
vqa_score = vqa_result.get("overall_score", 0)

if vqa_score >= COMPOSED_VQA_THRESHOLD:
    logger.info("Creative VQA PASSED (score=%.2f)", vqa_score)
    # proceed to upload
else:
    logger.info("Creative VQA FAILED (score=%.2f) — retrying with fixes", vqa_score)
    # Extract fixes and retry
    fixes = vqa_result.get("top_3_fixes", [])
    # ... feedback loop (Step 5)
```

- [ ] **Step 5: Add feedback loop — re-prompt GLM-5 with VQA fixes**

When VQA fails:
```python
# Build fix prompt for GLM-5
fix_instructions = "\n".join(f"- {fix}" for fix in vqa_result.get("top_3_fixes", []))
dimension_fixes = ""
for dim_name, dim_data in vqa_result.get("dimensions", {}).items():
    if isinstance(dim_data, dict) and dim_data.get("fix"):
        dimension_fixes += f"\n{dim_name}: {dim_data['fix']}"

retry_prompt = f"""The previous creative scored {vqa_score:.2f}/1.0 and FAILED quality review.

FIX THESE SPECIFIC ISSUES:
{fix_instructions}

DETAILED CSS FIXES PER DIMENSION:
{dimension_fixes}

Apply these fixes to improve the HTML. Keep the same layout pattern ({required_pattern}).
Output the corrected HTML only."""

# Re-call GLM-5 with the fix prompt + previous HTML
corrected_html = await design_creatives_retry(
    previous_html=html,
    fix_prompt=retry_prompt,
    platform=platform,
    platform_spec=spec,
)

# Re-render and re-evaluate
# ... render corrected_html with Playwright
# ... evaluate again
# If still fails, save with low score (don't block pipeline)
```

Max retries: 2. If still fails after 2 retries, save anyway with the low score and a `needs_review=True` flag.

- [ ] **Step 6: Verify syntax and commit**

```bash
python3.13 -c "import py_compile; py_compile.compile('pipeline/stage4_compose_v2.py', doraise=True)"
git add worker/pipeline/stage4_compose_v2.py
git commit -m "feat: VQA gate + feedback loop + layout diversity in Stage 4

Gemma 4 evaluates composed creatives, passes CSS fixes to GLM-5 for retry.
10 layout patterns enforced across batches."
```

---

### Task 5: Add config + test end-to-end

**Files:**
- Modify: `worker/config.py`

- [ ] **Step 1: Add Gemma 4 VQA config to worker config.py**

```python
# Gemma 4 VQA (Creative evaluation)
NVIDIA_NIM_VQA_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))
NVIDIA_NIM_VQA_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
```

- [ ] **Step 2: Run Stage 4 on the Brazil campaign**

```bash
# Reset Stage 4 composed creatives and re-run
export $(grep DATABASE_URL .env.local | tr -d '"') && node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const reqId = 'fd318779-45f2-45bb-b0ff-5420c5c10260';
await sql\`DELETE FROM generated_assets WHERE request_id = \${reqId} AND asset_type IN ('composed_creative', 'carousel_panel')\`;
await sql\`INSERT INTO compute_jobs (request_id, job_type, status, stage_target) VALUES (\${reqId}, 'regenerate_stage', 'pending', 4)\`;
await sql\`UPDATE intake_requests SET status = 'generating' WHERE id = \${reqId}\`;
"
PYTHONUNBUFFERED=1 /opt/homebrew/bin/python3.13 main.py
```

- [ ] **Step 3: Verify output quality**

Check that:
- Composed creatives use different layout patterns (not all gradient overlay)
- Gemma 4 VQA scores are logged with per-dimension CSS fixes
- Failed creatives get re-prompted and improved
- Headlines use serif fonts
- Brand elements (purple accent, pink CTA pill) are present

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat: Stage 4 creative quality engine — complete

10 templates, Gemma 4 VQA, actionable CSS feedback loop, layout diversity,
design psychology principles, serif typography rules."
```
