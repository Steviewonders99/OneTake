# Stage 4 Redesign: Material Generator + Figma Handoff

**Date:** 2026-05-20
**Status:** Approved
**Branch:** `feat/stage4-graphic-design-agent`

## Problem

Stage 4 currently tries to auto-compose final graphics using LLM-generated HTML + Playwright rendering. This produces 7/10 quality at best — AI struggles with graphic design composition (layout, typography, visual hierarchy). The result: a complex multi-engine system (design_agent, compose_v3, reference_layout, organic_compose) that burns tokens and still requires designer rework.

Meanwhile, the designer already gets an Excel sheet with headlines, subheadings, CTAs, and links to images — then rebuilds everything from scratch in Figma anyway.

## Solution

Replace the auto-composition engines with a **Material Generator** that produces all raw materials the designer needs, organized for immediate use:

1. **Generate base images in 3 standard ratios** (1:1, 4:5, 9:16) per actor
2. **Package copy elements** (headline, subheading, CTA) per persona
3. **Generate an HTML asset sheet** — a self-contained browser-viewable file replacing the Excel sheet
4. **Figma plugin pulls materials** → designer composes → **pushes finished PNGs back**

AI does what it's good at (images + copy). Humans do what they're good at (design).

## Architecture

### What Stage 4 Does (New)

```
Inputs (from Stages 1-3):
├── Brief (campaign objective, pillars, cultural research)
├── Actors (identity cards, face lock, seed images from Stage 2)
├── Copy (headlines, subheadings, CTAs per pillar from Stage 3)
└── Personas (from Stage 1)

Stage 4 Processing:
├── 1. Material Generation
│   ├── For each actor: generate 3 ratio images (1:1, 4:5, 9:16)
│   │   ├── Uses Stage 2 seed as identity anchor / reference
│   │   ├── Prompt: "Ultra realistic documentary style" + persona + action + project context
│   │   └── Full brief context informs scene selection per ratio
│   └── Package copy per persona (headline, subheading, CTA)
│
├── 2. HTML Asset Sheet Generation
│   ├── Header: campaign name + 12-word project summary
│   └── Per persona section: 3 images + headline + subheading + CTA
│
├── 3. Organic Carousels (existing — unchanged)
│   └── HTML/CSS multi-slide generation (LinkedIn + IG)
│
└── 4. Save all assets to DB + Vercel Blob

Outputs:
├── base_creative assets (3 per actor, one per ratio)
├── HTML asset sheet (1 per campaign, saved to Blob)
└── organic_carousel assets (existing behavior)
```

### Figma Handoff Flow

```
Pipeline generates materials
        ↓
Designer opens Nova Creative Studio plugin
        ↓
Plugin pulls base_creative images + copy metadata
        ↓
Creates Figma file: 1 page per persona, 3 frames per page (1:1, 4:5, 9:16)
        ↓
Designer composes final creatives in Figma
        ↓
Designer pushes finished PNGs back via plugin
        ↓
System receives PNGs → saves as composed_creative assets
```

### Image Generation Details

**3 Standard Ratios:**
| Ratio | Dimensions | Use Case |
|-------|-----------|----------|
| 1:1 | 1080x1080 | Instagram feed, LinkedIn feed, Facebook |
| 4:5 | 1080x1350 | Instagram feed (preferred), Facebook |
| 9:16 | 1080x1920 | Stories, TikTok, Reels |

**Prompt Structure:**
```
Ultra realistic documentary style. {prompt_seed}

OUTFIT FOR THIS SHOT: {scene outfit}
SIGNATURE ACCESSORY: {accessory}
BACKDROP: {scene setting}
POSE & ACTION: {scene action}

{art direction from brief}
{face lock constraints}
{realism anchors}
```

**Model:** `openai/gpt-5.4-image-2` via OpenRouter

**Generation Strategy:**
- Stage 2 seed image (square) serves as identity reference
- Stage 4 generates all 3 ratios with full brief context
- Each ratio gets scene/crop optimized for its format:
  - 1:1: balanced composition, full upper body
  - 4:5: slightly taller framing, more environment visible
  - 9:16: full body or dramatic vertical crop, max environment

### HTML Asset Sheet

Minimal, functional, self-contained HTML file:

```html
<!-- Header -->
<h1>{Campaign Name}</h1>
<p>{12-word project summary}</p>

<!-- Per Persona -->
<section>
  <h2>{Persona Name}</h2>
  <div class="images">
    <img src="{1:1 blob URL}" />
    <img src="{4:5 blob URL}" />
    <img src="{9:16 blob URL}" />
  </div>
  <div class="copy">
    <h3>Headline</h3><p>{headline text}</p>
    <h3>Subheading</h3><p>{subheading text}</p>
    <h3>CTA</h3><p>{cta text}</p>
  </div>
</section>
```

No brand colors, no styling beyond readability. This is a reference sheet, not a design.

### Asset Types

| Asset Type | Source | Stage |
|-----------|--------|-------|
| `base_creative` | NEW — 3 ratio images per actor | 4 |
| `asset_sheet` | NEW — HTML reference document | 4 |
| `organic_carousel` | EXISTING — multi-slide HTML/CSS | 4 |
| `composed_creative` | FROM FIGMA — designer's finished PNGs pushed back via plugin | post-4 |

### DB Schema

**New asset_type values:**
- `base_creative` — raw image in specific ratio, not composed
- `asset_sheet` — HTML reference document

**base_creative metadata:**
```json
{
  "actor_id": "uuid",
  "actor_name": "string",
  "persona_key": "string",
  "ratio": "1:1" | "4:5" | "9:16",
  "dimensions": "1080x1080" | "1080x1350" | "1080x1920",
  "seed_reference": "blob_url of Stage 2 seed",
  "scene_key": "string",
  "vqa_score": 0.0-1.0
}
```

## What Gets Archived

These files move to `worker/pipeline/_archived/`:
- `stage4_design_agent.py`
- `stage4_compose_v3.py`
- `stage4_reference_layout.py`
- `stage4_organic_compose.py`

**NOT archived (stays active):**
- `stage4_organic_carousel.py` — carousels are HTML/CSS-forward, working well

## What Gets Modified

### `worker/pipeline/orchestrator.py`
- Stage 4 routes to new `stage4_material_generator.py`
- Organic carousels still run after Stage 4 (existing post-stage-4 hook)

### `worker/ai/seedream.py` (already done)
- OpenRouter is primary (OpenAI direct removed)
- Model: `openai/gpt-5.4-image-2`

### `worker/prompts/recruitment_actors.py` (already done)
- "Ultra realistic documentary style" prefix on all image prompts

### `figma-plugin-nova/`
- Plugin needs to pull `base_creative` assets (not just `composed_creative`)
- Copy text (headline, subheading, CTA) needs to be displayed/accessible
- Frame creation: 3 frames per persona page (one per ratio)

## What Gets Created

### `worker/pipeline/stage4_material_generator.py`
New Stage 4 engine:
1. Load actors + seeds + copy from DB
2. Generate 3 ratio images per actor (parallel, semaphore-gated)
3. VQA validate each image
4. Upload to Blob, save as `base_creative` assets
5. Generate HTML asset sheet
6. Upload sheet to Blob, save as `asset_sheet` asset
7. Return asset counts

### `worker/pipeline/_archived/`
Directory for archived Stage 4 engines.

## Figma Plugin Updates (Future Sprint)

The existing Nova Creative Studio plugin (`figma-plugin-nova/`) needs:
1. Pull `base_creative` assets (currently only pulls `composed_creative`)
2. Display copy text per persona (headline, subheading, CTA)
3. Create 3 frames per persona page (1:1, 4:5, 9:16) instead of one
4. Push-back flow unchanged (already exports selected frames as PNG)

Plugin has never been tested — needs validation first.

## Success Criteria

1. Stage 4 generates 3 ratio images per actor with consistent identity
2. HTML asset sheet is self-contained and viewable in any browser
3. Organic carousels continue working unchanged
4. Designer can pull materials via Figma plugin (post-plugin update)
5. Pipeline runs faster (no Playwright composition, no VQA retry loops on compositions)
