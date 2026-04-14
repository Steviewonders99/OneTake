# Stage 4 Composition Engine — Artifact-Driven Creative Assembly

> **Prerequisite:** Phases A–D shipped (intake schema refactor, persona engine, Stage 2 scene awareness, Stage 3 pillar weighting). Merge commit `a65b58b` on main.
>
> **Replaces:** `stage4_compose_v2.py` (Kimi K2.5 full-generation approach). The current v2 generates entire HTML creatives from scratch per call. This spec replaces that with a modular artifact-driven system where GLM-5 assembles pre-built design components.

## Goal

Replace Stage 4's monolithic LLM-generates-everything approach with a **modular artifact-driven composition engine**. Instead of asking the LLM to invent visual design from scratch every time (producing inconsistent quality), the LLM selects and arranges pre-built design artifacts (blobs, dividers, badges, masks, gradients, CTAs) into layered HTML creatives.

After this spec ships:

- Creatives use a curated library of ~82 reusable design artifacts (SVGs, CSS classes, HTML snippets) stored in Vercel Blob
- GLM-5 receives a compact artifact catalog (~50 rows) instead of trying to generate SVG/CSS from imagination
- Output is **layered HTML/CSS** (primary artifact, stored in Blob) — not flattened PNGs
- PNG is preview-only, rendered via Playwright, disposable and re-renderable at any resolution
- Designers can export a **single self-contained SVG** with all layers as named `<g>` groups for Figma editing
- 3 composition archetypes (Floating Props, Gradient Hero, Photo Feature) are selected based on pillar + visual_direction
- Existing VQA two-phase gate (deterministic + Gemma 4 VLM) remains, with 7-dimension scoring at 0.85 threshold

## Why Not Keep v2?

Stage 4 v2 (Kimi K2.5 full-generation) is at 7/10 quality. The gap:

1. **Inconsistent visual identity** — every call generates different blob shapes, gradient angles, badge styles. No brand cohesion across a campaign.
2. **Wasted tokens** — LLM spends 60% of output generating SVG path data and CSS that could be pre-built.
3. **No reusability** — if a blob shape works well, there's no way to reuse it. Every creative starts from zero.
4. **Designer friction** — generated HTML has no semantic layer structure. Figma import produces a flat mess.
5. **Slow iteration** — changing a CTA button style means regenerating the entire creative.

The artifact approach fixes all five: consistent library, compact prompts, reusable components, named layers, and surgical edits.

## Scope

### Phase E — Artifact-Driven Composition Engine

1. **Design artifact store** — Neon `design_artifacts` table + Vercel Blob `/artifacts/` folder. ~82 artifacts across 11 categories.
2. **Artifact seed script** — `scripts/seed-design-artifacts.mjs` uploads SVGs/CSS to Blob, inserts catalog rows to Neon.
3. **GLM-5 compositor rewrite** — New `stage4_compose_v3.py` replaces v2. GLM-5 receives compact catalog, selects archetype, outputs layered HTML referencing artifact URLs.
4. **Composition archetypes** — 3 archetypes (Floating Props, Gradient Hero, Photo Feature) with pillar-based selection logic.
5. **Figma SVG export** — New export route produces a single self-contained SVG with base64-embedded photos and named `<g>` layer groups.
6. **Admin artifact management** — Admin portal gets "Design Artifacts" tab for CRUD (upload, preview, toggle active, edit metadata).

### Explicitly NOT in scope

- **VQA changes** — existing two-phase gate (deterministic + Gemma 4) is unchanged. Same 8 dimensions, same 0.85 threshold.
- **Stage 2/3 changes** — already shipped in Phases C+D, no modifications.
- **Video pipeline** — Stage 5 (Sedeo/Kling) is a separate spec cycle.
- **CreativeHtmlEditor enhancements** — resize handles, style panel, save/cancel are separate work. Current click-to-select + drag-to-move is sufficient for Phase E.
- **CampaignWorkspace changes** — existing component already supports HTML preview, VQA display, and editor integration.

---

## § 1 — Design Artifact Store

### 1.1 Neon Table: `design_artifacts`

```sql
CREATE TABLE design_artifacts (
    artifact_id     TEXT PRIMARY KEY,           -- e.g. "blob_organic_1", "badge_icon_globe"
    category        TEXT NOT NULL,              -- blob, divider, mask, badge, icon, gradient, pattern, frame, cta, text_treatment, logo
    description     TEXT NOT NULL,              -- human-readable: "Large flowing organic shape, top-right anchor"
    blob_url        TEXT NOT NULL,              -- Vercel Blob URL to the SVG/CSS/HTML file
    dimensions      TEXT,                       -- "400x380" for sized artifacts, "CSS" for gradients, "auto" for CTAs
    css_class       TEXT,                       -- optional CSS class name for inline use
    usage_snippet   TEXT NOT NULL,              -- HTML snippet showing how to embed: <img src="..." /> or style="..."
    usage_notes     TEXT,                       -- when to use, constraints, z-index guidance
    pillar_affinity TEXT[],                     -- which pillars this pairs well with: ["earn", "grow", "shape"]
    format_affinity TEXT[],                     -- which platforms: ["ig_feed", "linkedin", "tiktok"]
    is_active       BOOLEAN DEFAULT true,       -- soft-delete for artifacts
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_design_artifacts_category ON design_artifacts(category);
CREATE INDEX idx_design_artifacts_active ON design_artifacts(is_active) WHERE is_active = true;
```

### 1.2 Vercel Blob Layout

```
/artifacts/
  blobs/
    blob_organic_1.svg
    blob_organic_2.svg
    blob_organic_3.svg
    blob_soft_circle.svg
    blob_pebble.svg
    blob_flowing.svg
    blob_corner_accent.svg
    blob_duo_overlap.svg
  dividers/
    divider_curved_wave.svg
    divider_straight.svg
    divider_arc.svg
    divider_zigzag.svg
    divider_double_wave.svg
  masks/
    mask_blob_egg.svg
    mask_blob_organic.svg
    mask_circle_soft.svg
    mask_rounded_rect.svg
    mask_diamond.svg
    mask_arch.svg
  badges/
    badge_icon_shopping.svg
    badge_icon_globe.svg
    badge_icon_award.svg
    badge_icon_briefcase.svg
    badge_icon_clock.svg
    badge_icon_dollar.svg
    badge_icon_shield.svg
    badge_icon_star.svg
    badge_icon_users.svg
    badge_icon_check.svg
    badge_icon_heart.svg
    badge_icon_lightning.svg
  icons/
    icon_lucide_*.svg              -- 20+ Lucide icons pre-exported as SVG
  gradients/
    gradient_sapphire_pink.css
    gradient_light_lavender.css
    gradient_deep_purple.css
    gradient_sunrise.css
    gradient_ocean.css
    gradient_mint.css
    gradient_charcoal.css
    gradient_white_subtle.css
  patterns/
    pattern_dot_grid.svg
    pattern_subtle_lines.svg
    pattern_confetti.svg
    pattern_mesh.svg
  frames/
    frame_rounded_card.svg
    frame_thin_border.svg
    frame_shadow_card.svg
    frame_polaroid.svg
    frame_device_phone.svg
    frame_device_laptop.svg
  ctas/
    cta_pill_filled.html
    cta_pill_outline.html
    cta_pill_gradient.html
    cta_rounded_rect.html
    cta_arrow_link.html
    cta_glow_pill.html
  text_treatments/
    text_gradient_fill.css
    text_shadow_glow.css
    text_outlined.css
    text_highlight_box.css
  logos/
    logo_oneforma_full.svg
    logo_oneforma_mark.svg
    logo_centific_lockup.svg
```

### 1.3 Artifact Catalog Format (What GLM-5 Sees)

GLM-5 receives a compact text table — NOT inline SVG source:

```
DESIGN ARTIFACTS (reference by artifact_id in your HTML):

| artifact_id          | category | description                              | size    | pillar_affinity |
|----------------------|----------|------------------------------------------|---------|-----------------|
| blob_organic_1       | blob     | Large flowing organic shape, top-right   | 400x380 | earn, grow      |
| blob_organic_2       | blob     | Medium pebble shape, bottom-left         | 300x280 | earn, grow      |
| divider_curved_wave  | divider  | White curved wave section separator      | 1080x80 | any             |
| badge_icon_globe     | badge    | Circle gradient badge + globe icon       | 64x64   | grow, shape     |
| mask_blob_egg        | mask     | Egg/pebble clip-path for actor photo     | 600x700 | shape           |
| gradient_sapphire    | gradient | Sapphire→Pink full background            | CSS     | any             |
| cta_pill_filled      | cta      | Sapphire filled pill CTA button          | auto    | any             |
...

Usage:
- Images/SVGs: <img src="{blob_url}" style="position:absolute; ..." />
- Masks: <div style="clip-path: url(#{artifact_id}); ..."><img src="actor_photo" /></div>
- Gradients: <div style="background: var(--{artifact_id}); ...">
- CTAs: paste the usage_snippet HTML directly
- All artifacts are absolutely positioned within the creative container
```

This keeps the prompt at ~50 lines instead of 2000+ lines of inline SVG path data.

### 1.4 Category Inventory

| Category | Count | Purpose |
|----------|-------|---------|
| blob | 8 | Organic accent shapes, canvas framing, visual interest |
| divider | 5 | Section separators, photo-to-text transitions |
| mask | 6 | Clip-paths for actor photos (blob, egg, circle, rect, diamond, arch) |
| badge | 12 | Icon badges for benefit callouts (circle gradient + Lucide icon) |
| icon | 20+ | Raw Lucide SVG icons for inline use |
| gradient | 8 | Full-canvas background gradients |
| pattern | 4 | Subtle texture overlays (dot grid, lines, confetti, mesh) |
| frame | 6 | Card frames, device mockups, borders for photos |
| cta | 6 | Pre-styled CTA button HTML snippets |
| text_treatment | 4 | CSS text effects (gradient fill, glow, outline, highlight) |
| logo | 3 | OneForma/Centific logo variants |
| **Total** | **~82** | |

---

## § 2 — Composition Archetypes

### 2.1 Three Archetypes

GLM-5 selects one archetype per creative based on pillar + visual_direction + platform format:

| Archetype | When to Use | Pillar | Layout Signature | Key Artifacts |
|-----------|-------------|--------|------------------|---------------|
| **Floating Props** | Gig work, data collection, accessible tasks | Earn, Grow | Actor photo centered/left, 3-4 floating badges orbiting, gradient background, soft blobs in corners | blobs (3-4), badges (3-4), gradient bg, pill CTA |
| **Gradient Hero** | High-impact paid media, awareness campaigns | Any | Full gradient canvas, actor photo in bottom half with curved divider "bowl", headline in top zone | gradient bg, divider_curved_wave, frame_shadow, pill CTA, text_gradient_fill |
| **Photo Feature** | Credentialed/professional roles, shape pillar | Shape | Large actor photo (55-60% canvas) in blob/egg mask, minimal text overlay, thin border frame | mask_blob_egg or mask_blob_organic, frame_thin_border, 1-2 subtle blobs, outline CTA |

### 2.2 Archetype Selection Logic

```python
def select_archetype(pillar: str, visual_direction: dict, platform: str) -> str:
    """Select composition archetype based on campaign context."""

    # Shape pillar → always Photo Feature (professional credentialing)
    if pillar == "shape":
        return "photo_feature"

    # Story/carousel formats → Gradient Hero (high impact, awareness)
    if platform in ("ig_story", "tiktok", "wechat_moments"):
        return "gradient_hero"

    # Earn pillar with casual visual direction → Floating Props
    if pillar == "earn":
        return "floating_props"

    # Grow pillar → Floating Props (benefit-heavy, badge-rich)
    if pillar == "grow":
        return "floating_props"

    # Default: Gradient Hero
    return "gradient_hero"
```

### 2.3 Archetype Structural Constraints

Each archetype defines z-index layer ordering and spatial zones that GLM-5 must follow:

**Floating Props:**
```
z-0: gradient background (full canvas)
z-1: blob accents (corners, 3-4 organic shapes, opacity 0.3-0.6)
z-2: actor photo (centered or 40% left, 50-55% canvas height)
z-3: floating badges (3-4, orbiting actor, offset from edges)
z-4: headline + subheadline (top 30% or bottom 20%)
z-5: CTA button (bottom center, 12% from bottom edge)
z-6: avatar-stack social proof (above CTA or below headline)
z-7: logo (bottom-right corner, small)
```

**Gradient Hero:**
```
z-0: full gradient background
z-1: curved divider (creates "bowl" at 55-60% from top)
z-2: actor photo (in the bowl, bottom-anchored, cropped at waist)
z-3: headline (top zone, above divider, large serif or bold sans)
z-4: subheadline (below headline, 60% font size of headline)
z-5: CTA button (just above divider line, centered)
z-6: badge strip (2-3 badges in horizontal row, below CTA)
z-7: avatar-stack (bottom of gradient zone, above divider)
z-8: logo (top-left or bottom-right corner)
```

**Photo Feature:**
```
z-0: white or light lavender background
z-1: actor photo in blob/egg mask (55-60% canvas, offset left or right)
z-2: thin border frame (around photo mask, 2px accent color)
z-3: 1-2 subtle blobs (opposite corner from photo, low opacity)
z-4: headline (in the text zone, opposite side from photo)
z-5: subheadline (below headline, muted color)
z-6: CTA button (below text, outline style)
z-7: single badge (next to CTA for credibility)
z-8: logo (corner opposite photo)
```

---

## § 3 — GLM-5 Compositor

### 3.1 Prompt Architecture

The compositor prompt has 6 sections:

```
SECTION 1: ROLE
You are a senior visual designer composing recruitment marketing creatives.
You assemble pre-built design artifacts into layered HTML/CSS compositions.
You do NOT generate SVG paths, gradients, or icons from scratch — you reference artifacts by ID.

SECTION 2: ARTIFACT CATALOG
{compact_artifact_table}  ← from design_artifacts WHERE is_active = true

SECTION 3: COMPOSITION ARCHETYPE
Selected archetype: {archetype_name}
Layer ordering: {z_index_spec}
Spatial zones: {zone_definitions}

SECTION 4: INPUTS
Platform: {platform} ({width}x{height})
Pillar: {pillar} ({pillar_description})
Actor photo URL: {photo_url}
Actor cutout URL: {cutout_url}
Headline: {headline}
Subheadline: {subheadline}
CTA text: {cta_text}
Visual direction: {visual_direction_summary}
Language: {language}

SECTION 5: BRAND RULES (condensed)
- Colors: deep purple #3D1059→#6B21A8, hot pink CTA #E91E8C, NO gold/yellow
- Typography: system fonts only, -apple-system stack
- CTA: pill buttons (border-radius: 9999px), gradient or filled
- Photo: ONE LARGE FACE (50-55% canvas), not multiple small faces
- Whitespace: 20-30% intentional blank space
- Avatar-stack social proof: MANDATORY (3-4 circles + "+50K contributors")
- NO blob shapes occupying >15% of canvas area
- NO dot-pattern textures as primary design element

SECTION 6: OUTPUT FORMAT
Return a JSON object:
{
  "archetype": "floating_props|gradient_hero|photo_feature",
  "artifacts_used": ["artifact_id_1", "artifact_id_2", ...],
  "layer_manifest": [
    {"z": 0, "artifact_id": "gradient_sapphire", "role": "background", "css": "..."},
    {"z": 1, "artifact_id": "blob_organic_1", "role": "accent", "css": "position:absolute; top:..."},
    ...
  ],
  "html": "<div style=\"position:relative; width:{width}px; height:{height}px; overflow:hidden;\">...</div>"
}

CRITICAL: Every <img> src MUST use an artifact blob_url or actor photo URL.
Never inline SVG path data. Never generate gradient CSS from scratch — use artifact CSS classes.
```

### 3.2 Model Configuration

```python
COMPOSITOR_MODEL = "nvidia/glm-5-4b-vision-vit"  # Primary — spatial layout understanding
COMPOSITOR_FALLBACK = "moonshotai/kimi-k2.5"       # Fallback — broader HTML generation
COMPOSITOR_TEMPERATURE = 0.7                        # Some creative variation
COMPOSITOR_MAX_TOKENS = 4096                        # Enough for full HTML + manifest
```

### 3.3 Retry Logic with VQA Feedback

Same pattern as current v2, unchanged:

1. GLM-5 generates HTML + layer manifest
2. Playwright renders to PNG
3. VQA evaluates (deterministic phase → VLM phase)
4. If score >= 0.85 → pass, save
5. If score < 0.85 → inject VQA feedback into prompt, retry (max 2 retries)
6. If 3 attempts fail → save best-scoring attempt with `needs_review` flag

VQA feedback injection format:
```
Your previous design scored {score}/1.0. Issues found:
{vqa_feedback_items}

Fix ONLY the listed issues. Keep everything else intact.
Do NOT regenerate from scratch — edit the existing HTML.
Return the same JSON format with updated html and layer_manifest.
```

---

## § 4 — New File: `stage4_compose_v3.py`

### 4.1 Module Structure

```python
# worker/pipeline/stage4_compose_v3.py

async def run_stage4_v3(request_id: str, context: dict, neon: NeonClient) -> list[dict]:
    """Artifact-driven composition engine. Replaces stage4_compose_v2."""

    # 1. Load artifact catalog from Neon
    catalog = await neon.get_active_artifacts()

    # 2. Load Stage 2 images (actor photos) + Stage 3 copy (per pillar)
    actors = context["actors"]         # from stage 2
    copy_variants = context["copy"]    # from stage 3, keyed by pillar
    derived = context.get("derived_requirements", {})
    pillar_weighting = derived.get("pillar_weighting", {})
    visual_direction = derived.get("visual_direction", {})
    platforms = context["platforms"]    # list of platform keys

    # 3. Build composition matrix: actor × pillar × platform
    compositions = []
    pillars = list(pillar_weighting.keys())[:2]  # top 2 pillars from Stage 1

    for actor in actors:
        for pillar in pillars:
            for platform in platforms:
                archetype = select_archetype(pillar, visual_direction, platform)
                copy_data = get_copy_for_pillar_platform(copy_variants, pillar, platform)

                compositions.append({
                    "actor": actor,
                    "pillar": pillar,
                    "platform": platform,
                    "archetype": archetype,
                    "copy": copy_data,
                })

    # 4. Run compositions (concurrency-limited)
    results = await run_compositions_parallel(
        compositions, catalog, visual_direction, context, neon,
        concurrency=int(os.getenv("COMPOSE_CONCURRENCY", "5"))
    )

    return results


async def compose_single(
    comp: dict, catalog: list[dict], visual_direction: dict,
    context: dict, neon: NeonClient
) -> dict:
    """Compose a single creative: prompt GLM-5 → render → VQA → save."""

    platform_spec = PLATFORM_SPECS[comp["platform"]]

    # Build prompt
    prompt = build_compositor_prompt(
        catalog=catalog,
        archetype=comp["archetype"],
        platform=comp["platform"],
        platform_spec=platform_spec,
        pillar=comp["pillar"],
        actor=comp["actor"],
        copy=comp["copy"],
        visual_direction=visual_direction,
    )

    best_result = None
    best_score = 0.0

    for attempt in range(MAX_CREATIVE_RETRIES):
        # Call GLM-5
        response = await call_compositor_model(prompt)
        parsed = parse_compositor_response(response)

        # Render HTML → PNG via Playwright
        png_bytes = await render_html_to_png(
            parsed["html"], platform_spec["width"], platform_spec["height"]
        )

        # VQA evaluation (existing two-phase gate)
        vqa_result = await evaluate_creative(
            png_bytes, parsed["html"], comp, platform_spec
        )

        if vqa_result["score"] > best_score:
            best_score = vqa_result["score"]
            best_result = {**parsed, "vqa": vqa_result, "png": png_bytes}

        if vqa_result["score"] >= CREATIVE_VQA_THRESHOLD:
            break

        # Inject VQA feedback for retry
        prompt = inject_vqa_feedback(prompt, vqa_result)

    # Save HTML to Vercel Blob (PRIMARY artifact)
    html_url = await upload_to_blob(
        best_result["html"],
        f"creatives/{context['request_id']}/{comp['actor']['name']}_{comp['pillar']}_{comp['platform']}.html"
    )

    # Save PNG preview to Vercel Blob
    png_url = await upload_to_blob(
        best_result["png"],
        f"creatives/{context['request_id']}/{comp['actor']['name']}_{comp['pillar']}_{comp['platform']}.png"
    )

    # Save asset record to Neon
    asset = await neon.insert_generated_asset(
        request_id=context["request_id"],
        asset_type="composed_creative",
        platform=comp["platform"],
        blob_url=png_url,
        content={
            "html_url": html_url,
            "archetype": comp["archetype"],
            "artifacts_used": best_result.get("artifacts_used", []),
            "layer_manifest": best_result.get("layer_manifest", []),
            "persona": comp["actor"].get("persona_key"),
            "pillar": comp["pillar"],
        },
        copy_data=comp["copy"],
        evaluation_score=best_score,
        evaluation_data=best_result["vqa"],
        stage=4,
        version=3,
    )

    return asset
```

### 4.2 Pipeline Integration

In `worker/pipeline/run_pipeline.py`, Stage 4 dispatch changes from:
```python
# Current
from worker.pipeline.stage4_compose_v2 import run_stage4_v2
results = await run_stage4_v2(request_id, context, neon)
```
To:
```python
# New
from worker.pipeline.stage4_compose_v3 import run_stage4_v3
results = await run_stage4_v3(request_id, context, neon)
```

The v2 file (`stage4_compose_v2.py`) is kept but not imported — available for rollback.

### 4.3 Neon Client Additions

```python
# worker/neon_client.py — new methods

async def get_active_artifacts(self) -> list[dict]:
    """Fetch all active design artifacts for compositor prompt."""
    rows = await self.fetch("""
        SELECT artifact_id, category, description, blob_url,
               dimensions, css_class, usage_snippet, usage_notes,
               pillar_affinity, format_affinity
        FROM design_artifacts
        WHERE is_active = true
        ORDER BY category, artifact_id
    """)
    return [dict(r) for r in rows]

async def upsert_artifact(self, artifact: dict) -> dict:
    """Insert or update a design artifact."""
    return await self.fetch_one("""
        INSERT INTO design_artifacts (artifact_id, category, description, blob_url,
            dimensions, css_class, usage_snippet, usage_notes,
            pillar_affinity, format_affinity, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (artifact_id) DO UPDATE SET
            category=EXCLUDED.category, description=EXCLUDED.description,
            blob_url=EXCLUDED.blob_url, dimensions=EXCLUDED.dimensions,
            css_class=EXCLUDED.css_class, usage_snippet=EXCLUDED.usage_snippet,
            usage_notes=EXCLUDED.usage_notes, pillar_affinity=EXCLUDED.pillar_affinity,
            format_affinity=EXCLUDED.format_affinity, is_active=EXCLUDED.is_active,
            updated_at=NOW()
        RETURNING *
    """, artifact["artifact_id"], artifact["category"], ...)

async def delete_artifact(self, artifact_id: str) -> None:
    """Soft-delete a design artifact."""
    await self.execute(
        "UPDATE design_artifacts SET is_active = false, updated_at = NOW() WHERE artifact_id = $1",
        artifact_id
    )
```

---

## § 5 — Figma SVG Export

### 5.1 Export Route

**File:** `src/app/api/export/figma/[assetId]/route.ts`

When a designer clicks "Export for Figma" on a creative:

1. Fetch the HTML from `content.html_url` (Vercel Blob)
2. Resolve all artifact `<img>` tags → fetch SVGs from Blob → base64-encode inline
3. Resolve actor photo `<img>` → fetch PNG from Blob → base64-encode inline
4. Convert each z-layer into a named `<g>` group with `id` and `inkscape:label`
5. Wrap in a single `<svg>` document with correct viewBox dimensions
6. Return as `Content-Disposition: attachment; filename="creative-{assetId}.svg"`

### 5.2 Layer Group Naming

```xml
<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <g id="background" inkscape:label="Background">
    <!-- gradient rect -->
  </g>
  <g id="accent-blobs" inkscape:label="Accent Blobs">
    <!-- blob SVGs -->
  </g>
  <g id="divider" inkscape:label="Divider">
    <!-- wave SVG -->
  </g>
  <g id="actor-photo" inkscape:label="Actor Photo">
    <!-- base64-encoded photo in mask -->
  </g>
  <g id="headline" inkscape:label="Headline">
    <!-- text elements -->
  </g>
  <g id="subheadline" inkscape:label="Subheadline">
    <!-- text elements -->
  </g>
  <g id="cta" inkscape:label="CTA Button">
    <!-- button elements -->
  </g>
  <g id="social-proof" inkscape:label="Social Proof">
    <!-- avatar stack -->
  </g>
  <g id="badges" inkscape:label="Badges">
    <!-- badge SVGs -->
  </g>
  <g id="logo" inkscape:label="Logo">
    <!-- OneForma logo -->
  </g>
</svg>
```

Designer opens in Figma → sees complete creative → each layer individually selectable and editable. No ZIP, no broken URL dependencies — everything self-contained in one file.

### 5.3 File Size Expectations

- Actor photo (base64 PNG): ~800KB–1.2MB
- Artifact SVGs (base64): ~50KB total
- SVG structure/CSS: ~20KB
- **Total: ~1–1.5MB** — well within Figma import limits

---

## § 6 — Artifact Seed Script

### 6.1 Script: `scripts/seed-design-artifacts.mjs`

```javascript
// Reads SVG/CSS/HTML files from scripts/artifacts/ directory
// Uploads each to Vercel Blob at /artifacts/{category}/{filename}
// Inserts catalog row into Neon design_artifacts table
// Idempotent: ON CONFLICT DO UPDATE

const ARTIFACTS = [
  {
    artifact_id: "blob_organic_1",
    category: "blob",
    description: "Large flowing organic shape, anchored top-right",
    file: "blobs/blob_organic_1.svg",
    dimensions: "400x380",
    css_class: "artifact-blob-organic-1",
    usage_snippet: '<img src="{url}" style="position:absolute;top:0;right:0;width:400px;opacity:0.4;" />',
    usage_notes: "Use in corners. Opacity 0.3-0.6. Never centered.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin", "facebook"],
  },
  // ... 81 more entries
];
```

### 6.2 Source Files

Artifact SVGs live in `scripts/artifacts/` (gitignored large binaries stored in Blob, not repo). The seed script is the source of truth for the catalog.

Initial artifacts are:
- **Hand-designed** — extracted and cleaned from the Andromeda + Cutis reference creatives
- **Lucide icons** — pre-exported from the lucide-react icon set as standalone SVGs
- **Brand elements** — OneForma logos, brand gradients, CTA button styles from oneforma.com

---

## § 7 — Admin Portal: Design Artifacts Tab

### 7.1 Route

**File:** `src/app/admin/artifacts/page.tsx`

### 7.2 Features

- **Grid view** of all artifacts, grouped by category
- **Preview** — inline SVG rendering for each artifact
- **Upload** — drag-and-drop SVG/CSS/HTML upload → Vercel Blob → Neon insert
- **Edit metadata** — description, pillar_affinity, format_affinity, usage_notes
- **Toggle active** — soft-delete/restore artifacts
- **Usage stats** — count of how many creatives reference each artifact (join on `content->'artifacts_used'`)

### 7.3 Access Control

Admin-only (existing role check). Read-only for marketing role.

---

## § 8 — Migration Path

### 8.1 v2 → v3 Transition

1. Deploy `design_artifacts` table migration
2. Run seed script to populate artifacts
3. Switch `run_pipeline.py` import from v2 → v3
4. Keep `stage4_compose_v2.py` file intact (rollback path)
5. Existing v2 creatives in `generated_assets` remain untouched — v3 writes `version: 3` to distinguish

### 8.2 Rollback

If v3 produces worse results:
- Change import back to v2 in `run_pipeline.py`
- v2 doesn't need artifacts — it generates everything from scratch
- No data migration needed, both versions write to `generated_assets`

### 8.3 A/B Comparison

During rollout, run both v2 and v3 on the same intake request (different `version` in asset metadata). Compare VQA scores side-by-side in CampaignWorkspace before committing to v3.

---

## § 9 — Files Changed / Created

### New Files
| File | Purpose |
|------|---------|
| `worker/pipeline/stage4_compose_v3.py` | Artifact-driven composition engine |
| `worker/prompts/compositor_prompt.py` | GLM-5 prompt builder for artifact-based composition |
| `scripts/seed-design-artifacts.mjs` | Uploads artifacts to Blob + inserts catalog to Neon |
| `scripts/artifacts/` | Directory of SVG/CSS/HTML source files for artifacts |
| `src/app/api/export/figma/[assetId]/route.ts` | Figma SVG export endpoint |
| `src/app/admin/artifacts/page.tsx` | Admin artifact management UI |
| `migrations/009_design_artifacts.sql` | Neon table migration |

### Modified Files
| File | Change |
|------|--------|
| `worker/pipeline/run_pipeline.py` | Import v3 instead of v2 |
| `worker/neon_client.py` | Add `get_active_artifacts()`, `upsert_artifact()`, `delete_artifact()` |
| `worker/ai/creative_designer.py` | New `build_compositor_prompt()` using artifact catalog |
| `src/app/admin/layout.tsx` or nav | Add "Artifacts" tab to admin sidebar |

### Unchanged Files
| File | Why unchanged |
|------|---------------|
| `worker/ai/creative_vqa.py` | VQA gate stays the same — evaluates PNG output regardless of how HTML was built |
| `worker/ai/compositor.py` | Platform specs (`PLATFORM_SPECS`) still used by v3; render pipeline unchanged |
| `worker/pipeline/stage4_compose_v2.py` | Kept for rollback, not imported |
| `src/components/CampaignWorkspace.tsx` | Already supports HTML preview + VQA display |
| `src/components/CreativeHtmlEditor.tsx` | Already supports click-to-select + drag-to-move |

---

## § 10 — Success Criteria

1. **Artifact catalog populated** — `SELECT count(*) FROM design_artifacts WHERE is_active = true` returns 70+
2. **GLM-5 references artifacts** — every creative's `content.artifacts_used` array has 4+ artifact IDs
3. **VQA scores >= 0.85** — v3 creatives pass the same quality gate as v2 (no regression)
4. **Brand consistency** — running the same intake request 3 times produces creatives that share the same blob shapes, badge styles, and gradient palette (unlike v2 which varies wildly)
5. **Figma export works** — exported SVG opens in Figma with individually selectable layers
6. **PNG is disposable** — deleting a PNG preview and re-rendering from stored HTML produces an identical image
7. **Rollback works** — switching import back to v2 produces functional creatives with no errors

---

## § 11 — Future Work (Not This Spec)

- **Artifact generation** — LLM-designed artifacts (not LLM-assembled creatives) for expanding the library
- **A/B test per archetype** — track which archetype drives higher CTR per pillar/platform
- **Animated artifacts** — CSS animation classes for subtle motion in HTML creatives (before video export)
- **CreativeHtmlEditor v2** — resize handles, style panel, layer panel mirroring the `layer_manifest` structure
- **Artifact versioning** — version history per artifact with diff preview
