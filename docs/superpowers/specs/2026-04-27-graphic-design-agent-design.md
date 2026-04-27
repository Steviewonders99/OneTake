# Stage 4 Graphic Design Agent — System Design

**Date:** 2026-04-27
**Author:** Steven Junop + Claude
**Status:** Approved — ready for implementation plan
**Priority:** Critical — this is the differentiator. Get it 100% right.

---

## Problem Statement

Stage 4 (composition engine v3) has two critical failures:

1. **Bad quality** — layouts are repetitive (all 24 creatives look identical), text is unreadable (bad contrast, overlapping actors), no visual hierarchy (eye doesn't know where to look), compositions feel amateur compared to a real graphic designer, and missing task context elements (no device mockups, no "what will I be doing" visuals).

2. **Extremely slow** — 15-20 minutes per country for 24 creatives. Each creative takes 150-200s (45-90s GLM-5 HTML generation + 5-10s Playwright render + 30-60s VQA + up to 3 retry loops at 135-300s each). 405+ LLM calls per country. ~3.4M tokens consumed. ~$2.47 in OpenRouter costs.

**Root cause:** The current system asks an LLM to write complete HTML/CSS from scratch for every creative. This is fundamentally the wrong abstraction — LLMs are good creative directors (picking layouts, matching mood to message) but terrible web developers (consistent spacing, z-index layering, responsive positioning).

## Solution: Component Assembly Agent

Replace LLM-generated HTML with a **component assembly architecture**. The LLM becomes a creative director that outputs structured JSON decisions (~30 tokens). A deterministic renderer assembles pixel-perfect HTML from pre-built components. Quality is guaranteed by the components themselves, not by hoping the LLM writes valid CSS.

**Target performance:** 6 reviewed creatives in ~35 seconds (25-30x faster than current).

---

## Architecture

### Pipeline Flow

```
INPUT: actors[] + copy[] + brief + pillar + cultural_research
  │
  ▼
Step 1 — Creative Director LLM (one batch call, ~5-8s)
  │  Receives: actor photos, copy variants, pillar, cultural context
  │  Outputs: JSON config × 6 creatives (layout + props per layer)
  │
  ▼
Step 2 — Deterministic Renderer (parallel, ~1s each)
  │  Assembles HTML from components using JSON config
  │  Playwright renders to PNG (inline base64 images, no network wait)
  │
  ▼
Step 3 — Tier 1 Deterministic Checks (<100ms)
  │  Headline present? CTA present? Contrast ratio ≥ 4.5:1?
  │  Font size ≥ platform minimum? All layers rendered? Brand colors?
  │
  ▼
Step 4 — Tier 2 Batch VQA (one Gemma 4 Vision call, ~15s)
  │  All 6 PNGs in one call. Checks:
  │  - Face visibility (actor face fully visible, not cut off or covered)
  │  - Element overlap (no text on face, no CTA buried under overlay)
  │  - Spacing & balance (proper margins, no cramped clusters)
  │  - Visual hierarchy (clear reading order: headline → subhead → CTA)
  │  - Dead space (no large empty areas)
  │  - Composition balance (visual weight distributed evenly)
  │
  ▼
Step 5 — Auto-Fix (prop tweak + re-render, ~2s per fix, no LLM)
  │  VQA flags issue → deterministic prop adjustment → re-render
  │
  ▼
OUTPUT: 6 reviewed creatives (PNG + HTML) → Blob + Neon
```

### Two-Phase Generation Model

**Phase 1 — Generate for Marketing Review (~35s total)**
- One hero format: 1080×1080 (square, works on most platforms)
- 3 actors × 2 pillars = 6 creatives (if 1 pillar active: 3 actors × 4 layout variants = up to 12 creatives; batch size capped at 6, use 3 actors × 2 distinct layouts)
- Each creative uses a different layout pattern (guaranteed diversity)
- LLM batch call → parallel render → Tier 1 checks → batch VQA → auto-fix
- Marketing team reviews and approves in the UI

**Phase 2 — Adapt Approved Assets to Platform Formats (~10s total)**
- Only approved creatives proceed (no wasted compute on rejected work)
- Deterministic reflow to all platform aspect ratios:
  - 1080×1080 (Meta Feed, default)
  - 1080×1920 (Meta Story, TikTok, Snapchat — 9:16)
  - 1200×627 (LinkedIn, Reddit — 1.91:1)
- No LLM call — the renderer re-positions layers for each aspect ratio using the same JSON config with adjusted coordinates
- Quick batch VQA on adapted versions (face visibility may change with reflow)

---

## 5-Layer Composition Stack

Every creative is a stack of 5 layers, rendered bottom-to-top:

| Layer | Name | What It Controls | LLM Decides |
|-------|------|------------------|-------------|
| 1 | **Background** | Base canvas — solid color, gradient preset, scene image, or blur | Preset ID |
| 2 | **Actor Photo** | Person image — positioned, scaled, masked | Position (left/center/right), scale (0.5-1.0), mask type |
| 3 | **Decorative Overlay** | Visual flair — blobs, gradient bars, badges, brand frames, icons | Element IDs from library, intensity (subtle/medium/bold) |
| 4 | **Text Block** | Headline + subheadline — positioned, sized, with contrast backdrop | Text content, position, size preset, contrast backdrop type |
| 5 | **CTA Bar** | Call-to-action button — styled, positioned | Text, style preset, position |

Optional **Context Element** (rendered as a Layer 3 variant):
- `device_mockup` — phone/tablet showing the task UI
- `task_card` — floating card describing what the contributor does
- `icon_cluster` — skill/tool icons relevant to the task
- `stat_badge` — earnings or impact statistic callout

---

## LLM Output Schema

The Creative Director LLM outputs one JSON object per creative. This is the complete decision space — the renderer handles everything else.

```json
{
  "layout": "earn_hero_badge",

  "background": {
    "type": "gradient",
    "preset": "warm_sunset"
  },

  "actor": {
    "actor_id": "uuid-here",
    "position": "right",
    "scale": 0.85,
    "mask": "soft_fade"
  },

  "overlay": {
    "elements": ["blob_warm_1", "earnings_badge"],
    "intensity": "medium"
  },

  "text": {
    "headline": "Earn $17.50/hr from home",
    "subheadline": "Data collection tasks in Morocco",
    "position": "top-left",
    "size": "large",
    "contrast_backdrop": "dark_gradient"
  },

  "cta": {
    "text": "Apply Now",
    "style": "pill_primary",
    "position": "bottom-center"
  },

  "context_element": {
    "type": "device_mockup",
    "position": "bottom-left",
    "content": "survey_ui"
  }
}
```

**Token estimate:** ~50 tokens per creative × 6 = ~300 tokens total output. Input prompt with actor data + copy + brief ≈ ~2,000 tokens. **Total: ~2,300 tokens per batch call** (vs 3.4M tokens in current system).

### LLM Constraints (enforced in prompt)

The Creative Director prompt enforces these rules:

1. **Layout diversity** — each creative in the batch MUST use a different layout pattern. No repeats.
2. **Pillar alignment** — earn layouts for earn pillar, grow layouts for grow pillar. Never cross pillars.
3. **Actor-text separation** — if actor is `right`, text MUST be `top-left` or `bottom-left` (and vice versa). Never overlap.
4. **Copy source** — headline and subheadline MUST come from Stage 3 copy variants (passed as input). The LLM selects, it does not write new copy.
5. **Context element required** — at least 3 of 6 creatives MUST include a context element (device_mockup, task_card, icon_cluster, or stat_badge).

---

## Component Library — 12 Layout Patterns

### EARN Pillar (warm tones — reward, celebration, financial empowerment)

| Layout ID | Name | Description |
|-----------|------|-------------|
| `earn_hero_badge` | Hero + Badge | Full actor photo + floating earnings badge + warm gradient backdrop. Badge shows $/hr or total potential. Actor right, text top-left. |
| `earn_split_stat` | Split + Stat | Diagonal split composition — actor on left half, stat callout on right ($X/hr in oversized type). Clean dividing line or gradient transition. |
| `earn_full_bleed` | Full Bleed | Full bleed actor photo covers entire canvas. Semi-transparent gradient overlay bar at bottom with headline + CTA. High visual impact. |
| `earn_card_stack` | Card Stack | Testimonial-style card overlapping actor photo. Card contains quote or earnings proof. Warm accent colors. Trust-building layout. |

### GROW Pillar (cool tones — aspiration, learning, skill development)

| Layout ID | Name | Description |
|-----------|------|-------------|
| `grow_device_mockup` | Device + Actor | Actor on one side + device mockup (phone/tablet) showing the task UI on the other. Skill badges floating. Shows "what you'll actually do." |
| `grow_editorial` | Editorial | Magazine editorial layout — large serif headline, actor portrait with generous whitespace. Premium, aspirational feel. Minimal overlay. |
| `grow_diagonal_split` | Diagonal Split | Diagonal split with actor + skill badge cluster overlay. Dynamic, forward-moving energy. Badges show relevant skills/tools. |
| `grow_bold_type` | Bold Typography | Minimal photo (small or circle-masked) + oversized bold sans-serif headline. Clean CTA. Typography-forward layout. Modern, confident. |

### SHAPE Pillar (professional tones — expertise, impact, credibility)

| Layout ID | Name | Description |
|-----------|------|-------------|
| `shape_portrait_cred` | Portrait + Credential | Professional portrait focus + credential/verification bar. Subtle gradient background. Expert positioning. Authority signals. |
| `shape_multi_grid` | Multi-Image Grid | 2-3 image grid (actor + task context + result) + impact statistics overlay. Shows the full journey. Data-rich, credibility-building. |
| `shape_clean_card` | Clean Card | Clean white/light card container + actor photo + professional overlay elements. Corporate but approachable. Works well for LinkedIn. |
| `shape_photo_frame` | Photo Frame | Photo-first layout with subtle brand frame border. Minimal text overlay. Lets the image do the talking. Premium feel. |

### Layout-to-Pillar Enforcement

The Creative Director LLM receives only the 4 layouts for the active pillar. It cannot select cross-pillar layouts. This is enforced at the prompt level (only include the relevant 4 in the available options) and validated at the schema level (layout ID must start with the pillar prefix).

---

## Layer Components — Full Inventory

### Layer 1: Background (~16 components)

| Category | Components |
|----------|-----------|
| Solid Colors | `bg_white`, `bg_charcoal`, `bg_warm_cream`, `bg_cool_gray`, `bg_deep_navy`, `bg_soft_sage` |
| Gradient Presets | `gradient_warm_sunset`, `gradient_cool_ocean`, `gradient_pro_charcoal`, `gradient_earn_gold`, `gradient_grow_teal`, `gradient_shape_purple`, `gradient_brand_accent`, `gradient_soft_neutral` |
| Scene | `scene_blur` (blurred actor scene image as background), `scene_photo` (full scene image) |

### Layer 2: Actor Photo (~15 combinations)

| Property | Options |
|----------|---------|
| Position | `left`, `center`, `right` |
| Scale | `0.5` (small), `0.65` (medium), `0.8` (large), `1.0` (full) |
| Mask | `none`, `soft_fade` (gradient edge fade), `circle` (circular crop), `arch` (architectural arch frame), `diagonal` (diagonal cut) |

Position + mask combinations are constrained per layout pattern. For example, `earn_full_bleed` always uses `center` + `none` at `scale: 1.0`.

### Layer 3: Decorative Overlay (~19 components)

| Category | Components |
|----------|-----------|
| Blob Clusters | `blob_warm_1`, `blob_warm_2`, `blob_cool_1`, `blob_cool_2`, `blob_pro_1`, `blob_pro_2` |
| Gradient Bars | `bar_bottom_dark`, `bar_top_light`, `bar_diagonal_accent`, `bar_side_fade` |
| Badge Sets | `badge_earnings`, `badge_skills`, `badge_verification` |
| Brand Frames | `frame_accent_border`, `frame_corner_marks`, `frame_subtle_outline` |
| Icon Clusters | `icons_data_tools`, `icons_language_skills`, `icons_creative_tools` |

### Layer 4: Text Block (~18 combinations)

| Property | Options |
|----------|---------|
| Position | `top-left`, `top-center`, `top-right`, `center`, `bottom-left`, `bottom-center` |
| Size | `small` (14-16px), `medium` (18-22px), `large` (26-32px), `hero` (36-48px) |
| Style | `headline_only`, `headline_sub`, `stat_callout`, `editorial_serif` |
| Contrast Backdrop | `none`, `dark_gradient` (semi-transparent dark behind text), `light_blur` (frosted glass), `solid_pill` (opaque rounded rect behind text), `brand_accent` (accent color bar) |

**Readability guarantees (baked into components):**
- Minimum contrast ratio 4.5:1 (WCAG AA) enforced per background/text color combination
- Font sizes locked to platform minimums (no sub-14px text on any format)
- Line height 1.3-1.5 always applied
- Max headline length: 7 words (enforced at schema validation, not hoped for)
- Contrast backdrop auto-selected when text overlaps busy background regions

### Layer 5: CTA Bar (5 components)

| Component | Description |
|-----------|-------------|
| `pill_primary` | Charcoal pill button with white text (OneForma brand standard) |
| `pill_outline` | Outlined pill with accent border |
| `banner_full` | Full-width banner bar at bottom |
| `floating_circle` | Circular floating action button |
| `inline_text` | Text-only CTA with arrow (minimal) |

### Context Elements (optional, 8 components)

| Component | Description |
|-----------|-------------|
| `device_phone_portrait` | iPhone frame showing task UI screenshot |
| `device_phone_landscape` | Landscape phone showing task |
| `device_tablet` | iPad frame showing task interface |
| `task_card_simple` | Floating card with task title + duration + pay |
| `task_card_detailed` | Card with task description + requirements |
| `icon_cluster_data` | Data annotation tool icons (labeling, tagging, survey) |
| `icon_cluster_language` | Language/translation related icons |
| `stat_badge_earnings` | "$X earned this month" or "X tasks completed" badge |

---

## Deterministic Renderer

### Implementation

The renderer is a pure function: `JSON config → HTML string → PNG bytes`.

```
render(config: CreativeConfig, actor_image_url: str) → { html: str, png: bytes }
```

**Process:**
1. Load the layout template (one of 12 HTML/CSS skeletons)
2. Inject layer components by ID (slot-based — each layer has a designated DOM slot)
3. Set dynamic props (text content, image URLs, colors, positions)
4. All images embedded as base64 data URIs (no network requests during render)
5. Playwright renders to PNG at target dimensions

**No Playwright wait timeout.** Current system has a hardcoded 2-second `wait_for_timeout` for background image loads. With base64 inline images, this is eliminated. Render time drops from 5-10s to ~1s.

### Layout Templates

Each of the 12 layout patterns is a self-contained HTML/CSS file with named slots:

```html
<!-- earn_hero_badge.html -->
<div class="creative" style="width:{{width}}px;height:{{height}}px;">
  <div class="layer-background" slot="background">
    <!-- injected by renderer -->
  </div>
  <div class="layer-actor" slot="actor">
    <!-- injected by renderer: img tag with position/scale/mask -->
  </div>
  <div class="layer-overlay" slot="overlay">
    <!-- injected by renderer: overlay element(s) -->
  </div>
  <div class="layer-text" slot="text">
    <!-- injected by renderer: headline, subheadline, contrast backdrop -->
  </div>
  <div class="layer-cta" slot="cta">
    <!-- injected by renderer: CTA button -->
  </div>
</div>
```

Each template defines:
- Fixed CSS grid/flexbox positions for each slot (no absolute positioning guesswork)
- Responsive rules for aspect ratio adaptation (Phase 2)
- Z-index stack order (guaranteed — not LLM-decided)
- Safe zones for text (pre-calculated regions that don't overlap actor)

### Aspect Ratio Adaptation (Phase 2)

Each layout template includes CSS rules for 3 aspect ratios:

| Format | Dimensions | Adaptation Strategy |
|--------|-----------|-------------------|
| Square (1:1) | 1080×1080 | Default — primary design |
| Tall (9:16) | 1080×1920 | Vertical stack — actor top, text + CTA bottom |
| Wide (1.91:1) | 1200×627 | Horizontal spread — actor side, text opposite |

Adaptation is deterministic — same JSON config, different CSS media rules. No LLM call needed. Re-render takes ~1s per format.

---

## VQA Strategy

### Tier 1: Deterministic Checks (instant, <100ms)

Run before Playwright render (on the assembled HTML):

| Check | Pass Criteria | Fix |
|-------|--------------|-----|
| Headline present | Text block contains ≥1 word | Fail hard (config error) |
| CTA present | CTA slot is populated | Fail hard (config error) |
| Contrast ratio | ≥ 4.5:1 (WCAG AA) computed from text color vs backdrop | Auto-add contrast backdrop |
| Font size | ≥ 14px on all text | Bump to minimum |
| All layers rendered | No empty slots | Fail hard (component missing) |
| Brand colors | OneForma accent gradient present somewhere | Add brand frame overlay |
| Headline length | ≤ 7 words | Truncate + ellipsis |

### Tier 2: Batch Vision VQA (one Gemma 4 call, ~15s)

Run after Playwright render. All 6 PNGs sent in a single batch call.

**Prompt structure:**
```
For each of the 6 creative images, evaluate these spatial checks.
Return a JSON array with pass/fail + issue type for each.

Checks:
1. FACE_VISIBLE — Is the actor's face fully visible? Not cut off by frame edge, not covered by text or overlay elements.
2. NO_OVERLAP — Are all elements properly separated? Text not sitting on actor's face/body. CTA not buried under overlay. No element stacking.
3. PROPER_SPACING — Are there appropriate margins between elements? No cramped clusters where multiple elements touch or nearly touch.
4. VISUAL_HIERARCHY — Is there a clear reading order? Can you identify: (1) headline first, (2) subheadline second, (3) CTA third? Eye flow should be natural.
5. NO_DEAD_SPACE — Is the canvas used effectively? No large empty areas (>25% of canvas) that make the creative feel unfinished or unbalanced.
6. COMPOSITION_BALANCE — Is visual weight distributed across the canvas? Not all elements crammed into one quadrant while others are empty.
```

**Response schema:**
```json
[
  {
    "creative_index": 0,
    "passed": true,
    "issues": []
  },
  {
    "creative_index": 1,
    "passed": false,
    "issues": [
      {"check": "FACE_VISIBLE", "detail": "headline text overlaps actor forehead"}
    ]
  }
]
```

### Auto-Fix Table (no LLM, ~2s per fix)

When Tier 2 VQA flags an issue, the fix is a deterministic prop tweak + re-render:

| VQA Issue | Auto-Fix Strategy |
|-----------|------------------|
| `FACE_VISIBLE` — text covers face | Flip text position to opposite side (top-left → top-right if actor is left) |
| `FACE_VISIBLE` — face cut off by frame | Reduce actor scale by 0.15 and center vertically |
| `NO_OVERLAP` — elements stacking | Increase spacing preset from `compact` to `comfortable` on the layout |
| `VISUAL_HIERARCHY` — no clear reading order | Bump headline size up one level + add `dark_gradient` contrast backdrop |
| `NO_DEAD_SPACE` — large empty area | Scale actor up by 0.15 OR add an overlay element to fill the gap |
| `COMPOSITION_BALANCE` — all on one side | Swap to mirrored variant of same layout (left↔right swap) |

**Auto-fix limit:** Maximum 2 fix cycles. If a creative still fails after 2 prop-tweak rounds, swap to the next available layout pattern for that pillar and re-render from scratch (still no LLM call — uses the same JSON config with a different layout ID). This guarantees convergence.

---

## Creative Director LLM — Prompt Design

### Model Selection

Primary: `qwen/qwen3.5-397b-a17b` via OpenRouter (fast, structured output)
Fallback: `google/gemma-3-27b-it` via OpenRouter

### Input

The Creative Director receives:

1. **Available layouts** — only the 4 for the active pillar (names + one-line descriptions)
2. **Actor list** — name, photo URL, persona summary, scene description
3. **Copy variants** — 3-6 headline/subheadline pairs from Stage 3 (LLM selects, does not write)
4. **Brief summary** — pillar, task type, compensation, target country
5. **Cultural context** — key cultural research findings for the target country
6. **Available context elements** — device mockups, task cards, etc. with descriptions
7. **Composition rules** — the 5 constraints (diversity, pillar alignment, actor-text separation, copy source, context element minimum)

### Output

Array of 6 creative configs, each following the JSON schema defined above.

### Prompt Constraints (enforced)

1. Each creative MUST use a different `layout` ID — no repeats in the batch
2. `layout` ID must start with the active pillar prefix (`earn_`, `grow_`, `shape_`)
3. If actor `position` is `right`, text `position` must be `top-left`, `bottom-left`, or `center`
4. If actor `position` is `left`, text `position` must be `top-right`, `bottom-right`, or `center`
5. `headline` and `subheadline` must be verbatim from the provided copy variants list
6. At least 3 of 6 creatives must include a `context_element`
7. No two creatives may use the same `headline` text

### Schema Validation (post-LLM, pre-render)

Validate the LLM output against a strict JSON schema before rendering. Reject and re-prompt (once) if:
- Missing required fields
- Invalid layout ID (not in available set)
- Invalid enum values (position, mask, size, style not in allowed set)
- Duplicate layouts in batch
- Headline not found in provided copy variants

This catches LLM errors in ~100ms before wasting render time.

---

## File Structure

| File | Purpose |
|------|---------|
| `worker/pipeline/stage4_design_agent.py` | New pipeline orchestrator (replaces stage4_compose_v3.py) |
| `worker/ai/creative_director.py` | LLM prompt + response parsing for batch creative decisions |
| `worker/compositor/renderer.py` | Deterministic HTML assembler (JSON config → HTML) |
| `worker/compositor/render_png.py` | Playwright PNG renderer (HTML → bytes) |
| `worker/compositor/layouts/` | 12 layout template HTML files |
| `worker/compositor/components/` | Layer component HTML fragments (~80 files) |
| `worker/compositor/adapt.py` | Phase 2 aspect ratio adaptation logic |
| `worker/vqa/tier1_checks.py` | Deterministic validation checks |
| `worker/vqa/tier2_batch_vqa.py` | Batch Gemma 4 Vision evaluation |
| `worker/vqa/auto_fix.py` | Prop-tweak auto-fix logic |
| `worker/compositor/schema.py` | JSON schema definition + validation for creative configs |

### Migration Path

- `stage4_compose_v3.py` is NOT deleted — it remains as a fallback
- New `stage4_design_agent.py` is the default
- Config flag: `STAGE4_ENGINE=design_agent` (default) or `STAGE4_ENGINE=compose_v3` (legacy)
- Gradual rollover: test with 2-3 campaigns, validate quality, then remove v3

---

## Performance Budget

| Step | Target Time | Calls | Tokens |
|------|-------------|-------|--------|
| Creative Director LLM | 5-8s | 1 batch | ~2,300 |
| Render 6 creatives | 6s | 0 (deterministic) | 0 |
| Tier 1 checks | 0.1s | 0 | 0 |
| Tier 2 batch VQA | 15s | 1 batch | ~3,000 |
| Auto-fix (avg 2 fixes) | 4s | 0 | 0 |
| **Total Phase 1** | **~35s** | **2** | **~5,300** |
| Phase 2 adaptation (3 approved × 3 formats) | 10s | 0 | 0 |
| Phase 2 VQA batch | 10s | 1 | ~2,000 |
| **Total Phase 1 + Phase 2** | **~55s** | **3** | **~7,300** |

### Cost Comparison

| Metric | Current (v3) | New (Design Agent) |
|--------|-------------|-------------------|
| LLM calls per country | 405+ | 2-3 |
| Tokens per country | ~3.4M | ~7.3K |
| OpenRouter cost | ~$2.47 | ~$0.01 |
| Wall-clock time | 15-20 min | ~55s (both phases) |
| Quality consistency | Variable | Deterministic |
| Layout diversity | None (same archetype) | Guaranteed (12 patterns) |

---

## Success Criteria

1. **Speed:** Phase 1 completes in under 60 seconds for 6 creatives
2. **Quality:** Zero text-on-face issues, zero overlap issues, zero dead space >25% of canvas
3. **Diversity:** All 6 creatives in a batch use different layout patterns (verifiable)
4. **Readability:** All text passes WCAG AA contrast (4.5:1 minimum)
5. **Face visibility:** Actor face is fully visible in 100% of approved creatives
6. **Context:** At least 50% of creatives include a task context element
7. **Brand consistency:** OneForma accent gradient and brand typography in every creative
8. **VQA pass rate:** >85% of creatives pass Tier 2 VQA on first render (before auto-fix)
9. **Adaptation:** Phase 2 produces 3 aspect ratios per approved creative with no quality degradation
