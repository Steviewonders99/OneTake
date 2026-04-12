# Creative Artifacts Expansion + Task Contextualizer — Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved

## Goal

Close the gap between AI-generated creatives (current 7/10) and agency-level output (11/10) by expanding the design artifact library and introducing a **Task Contextualizer** system that generates campaign-specific UI screenshots showing what contributors will actually DO — composited into device mockups that float alongside actor photos.

The #1 differentiator in the reference Andromeda creatives is the **floating phone showing the actual task** (email inbox, shopping confirmation). Without it, every creative is "person + headline." With it, every creative answers "what will I do?" visually.

## Architecture Overview

```
Stage 1 (Brief + Task Description)
  ↓
Stage 4 Phase 0 (NEW): Task Contextualizer
  ├── Generate task preview HTML per task_type
  ├── Render to PNG screenshot (Playwright)
  └── Composite into device frame → save as artifact
  ↓
Stage 4 Phase 1: Graphic Copy (already built)
  ↓
Stage 4 Phase 2: Composition (GLM-5 layers device mockup + actor + text)
```

## Part 1: Task Contextualizer System

### What It Produces

A **device mockup PNG** per campaign showing what the task looks like — a phone/tablet displaying a realistic UI relevant to the task type. This PNG becomes a design artifact that GLM-5 can layer into compositions.

### Task Preview Templates (HTML → Screenshot)

Each task type gets an HTML template showing a realistic preview of what the contributor sees:

| Task Type | Preview Shows | UI Elements |
|---|---|---|
| **annotation** | Data labeling interface — image with bounding boxes, label sidebar, progress bar | Dark UI, green/red label buttons, thumbnail grid, "47 of 200 labeled" counter |
| **data_collection** | Data capture form — camera viewfinder or survey questions | Clean white form, photo upload zone, field labels, progress indicator |
| **judging** | Rating/comparison UI — content to rate, star rating, side-by-side compare | Split view, rating stars, "Which is better?" prompt, thumbs up/down |
| **transcription** | Audio player + transcript — waveform visualization, text editor, timestamp markers | Dark audio player, colored waveform, editable text area, play/pause buttons |
| **translation** | Source → target split — original text left, translation field right | Two-column split, language flags, character counter, "Submit Translation" button |

### Template Customization

Each template is parameterized with campaign-specific content from Stage 1:

```python
def build_task_preview_html(task_type: str, brief: dict) -> str:
    """Generate campaign-specific task preview HTML.

    Injects real campaign details into the UI mockup so it doesn't
    look generic. For email annotation, shows a real email subject line.
    For clinical data collection, shows a medical form.
    """
```

Example customizations:
- **Andromeda (email annotation):** Preview shows "Shopping Confirmation" email with order details
- **Cutis (clinical data collection):** Preview shows patient intake form with dermatology fields
- **Lumina (audio transcription):** Preview shows audio waveform with Portuguese text

### Device Frames

3 device frame PNGs (pre-made, stored in `scripts/artifacts/devices/`):

| Frame | Dimensions | Use Case |
|---|---|---|
| `device_phone_portrait.png` | 280×560px | Social/feed creatives — floating phone showing task |
| `device_tablet_landscape.png` | 480×340px | Work-context creatives — person using tablet |
| `device_laptop.png` | 520×340px | Professional creatives — person at workstation |

Each frame is a PNG with a **transparent screen area** where the task preview screenshot is composited.

### Composition Pipeline

```python
async def generate_task_contextualizer(
    task_type: str,
    brief: dict,
    device: str = "phone_portrait",
) -> str:
    """Generate a device mockup with task-specific screenshot.

    1. Build task preview HTML from template + campaign details
    2. Render to PNG screenshot via Playwright (screen-sized crop)
    3. Composite screenshot into device frame PNG
    4. Upload to Vercel Blob
    5. Return blob_url for use as composition artifact

    Returns blob_url of the device mockup PNG.
    """
```

**Screen composition logic:**
1. Render task preview HTML at the device's screen dimensions (e.g., 240×480 for phone)
2. Load device frame PNG (has transparent screen)
3. Paste screenshot into the screen area with proper offset
4. Save combined PNG
5. Upload to Blob as a per-campaign artifact

### Integration with Stage 4

The device mockup URL is passed to GLM-5 as an additional artifact with special handling:

```python
# In _compose_one(), after Phase 1:
device_mockup_url = await generate_task_contextualizer(
    task_type=brief.get("task_type", request.get("task_type", "")),
    brief=brief,
    device="phone_portrait",  # or tablet/laptop based on scene
)

# Inject as special artifact in compositor prompt
if device_mockup_url:
    composition_actor["device_mockup_url"] = device_mockup_url
```

GLM-5 prompt addition:
```
TASK CONTEXTUALIZER (floating device mockup — OPTIONAL but high-impact):
  Device mockup URL: {device_mockup_url}
  This is a phone/tablet showing what the contributor's task actually looks like.
  Layer it alongside or overlapping the actor photo for maximum context.
  Position: floating to the left or right of the actor, slightly rotated (2-5°),
  with a subtle shadow. Size: 30-40% of canvas width.
  This element transforms the creative from generic → task-specific.
```

## Part 2: Expanded Artifact Library

### New Badges (8 items, 80-100px, gradient-backed circles)

Each badge is a circle with a subtle gradient background + a white Lucide-style icon:

| artifact_id | Icon | Task Affinity | Pillar |
|---|---|---|---|
| `badge_microphone` | Mic icon | transcription | earn, grow |
| `badge_document` | FileText icon | annotation | earn, grow |
| `badge_language` | Languages icon | translation | grow, shape |
| `badge_clipboard` | ClipboardCheck icon | judging | grow, shape |
| `badge_camera` | Camera icon | data_collection (image) | earn |
| `badge_stethoscope` | Stethoscope icon | data_collection (medical) | shape |
| `badge_headphones` | Headphones icon | transcription, audio | earn |
| `badge_chart` | BarChart icon | judging, analytics | grow |
| `badge_dollar` | DollarSign icon | all (earnings) | earn |
| `badge_shield` | Shield icon | all (trust/security) | shape |

**Design spec:** 96×96px SVG. Gradient circle background (using brand purple-to-pink at 15% opacity). White icon stroke centered. Drop shadow filter.

### New Patterns (3 items — fills the empty patterns/ folder)

| artifact_id | Pattern | Use |
|---|---|---|
| `pattern_dot_grid` | 4×4px dots at 20px spacing, 8% opacity | Subtle texture in corners — adds richness without overwhelm |
| `pattern_diagonal_lines` | 45° parallel lines, 2px wide, 12px spacing, 5% opacity | Professional/editorial feel for shape pillar |
| `pattern_concentric_circles` | Concentric circle rings from corner, fading opacity | Modern/tech feel for grow pillar |

**Design spec:** 200×200px SVG tiles, tileable via `background-repeat`. Very low opacity — these are texture, not decoration.

### New UI Cards (4 HTML snippets)

Floating white cards that add context + depth:

| artifact_id | Card Type | Content |
|---|---|---|
| `card_notification` | Push notification style | App icon + "New task available" + preview text + time stamp |
| `card_earnings` | Earnings summary | "$247.50 earned this week" + progress bar + "View Details" link |
| `card_task_preview` | Mini task card | Task title + difficulty badge + estimated time + "Start" button |
| `card_testimonial` | Contributor quote | Avatar circle + quote text + name + "Verified Contributor" badge |

**Design spec:** ~200×120px HTML snippets. White bg, 12px border-radius, subtle shadow. Rendered as `<div>` elements that GLM-5 positions with `position: absolute`.

### New Gradient Applications (3 CSS variants)

Not new colors — new WAYS to apply the existing brand gradient:

| artifact_id | Application | Effect |
|---|---|---|
| `gradient_bowl_curve` | SVG clip-path creating a curved "bowl" at 55% from top | Person sits in the bowl, headline above — high-impact paid media layout |
| `gradient_diagonal_sweep` | 45° gradient from bottom-left to top-right, fading to white | Editorial/modern feel, person on the white side |
| `gradient_radial_burst` | Radial gradient from center, fading to white at edges | Spotlight effect on the person, draws eye to center |

### Updated Artifact Count

| Category | Before | After | Delta |
|---|---|---|---|
| Blobs | 3 | 3 | — |
| Dividers | 2 | 2 | — |
| Masks | 2 | 2 | — |
| Badges | 3 | 13 | +10 |
| Gradients | 2 | 5 | +3 |
| CTAs | 2 | 2 | — |
| Patterns | 0 | 3 | +3 |
| UI Cards | 0 | 4 | +4 |
| Device Frames | 0 | 3 | +3 |
| **Total** | **14** | **37** | **+23** |

## Part 3: Task Preview HTML Templates

### Template Structure

Each template is a self-contained HTML file at `scripts/artifacts/task-previews/`:

```
scripts/artifacts/task-previews/
├── annotation_preview.html
├── data_collection_preview.html
├── judging_preview.html
├── transcription_preview.html
└── translation_preview.html
```

### Parameterization

Templates use `{placeholder}` variables filled from the brief:

| Placeholder | Source | Example |
|---|---|---|
| `{task_title}` | `brief.title` | "Shopping Email Review" |
| `{task_description}` | `form_data.task_description` | "Review and classify shopping confirmation emails" |
| `{sample_content}` | Generated from brief context | "Hey Ben! Here's your order confirmation email!" |
| `{progress_count}` | Static or randomized | "47 of 200" |
| `{earnings_amount}` | `form_data.compensation_rate` | "$12.50" |
| `{language}` | `copy.language` | "Portuguese" |

### Example: Annotation Preview Template

```html
<div style="width:240px;height:480px;background:#1a1a2e;border-radius:8px;overflow:hidden;font-family:system-ui;">
  <!-- Status bar -->
  <div style="height:24px;background:#12122a;display:flex;align-items:center;justify-content:space-between;padding:0 12px;">
    <span style="color:#888;font-size:9px;">9:41</span>
    <span style="color:#888;font-size:9px;">●●● ▌</span>
  </div>
  <!-- App header -->
  <div style="padding:12px;background:#1e1e3a;display:flex;align-items:center;gap:8px;">
    <img src="oneforma-icon.png" width="20" height="20" style="border-radius:4px;" />
    <span style="color:white;font-size:11px;font-weight:600;">OneForma</span>
    <span style="color:#6B21A8;font-size:9px;margin-left:auto;">47/200</span>
  </div>
  <!-- Content area -->
  <div style="padding:12px;background:#f8f8fc;">
    <div style="background:white;border-radius:8px;padding:10px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="font-size:10px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">{task_title}</div>
      <div style="font-size:9px;color:#888;line-height:1.4;">{sample_content}</div>
    </div>
    <!-- Action buttons -->
    <div style="display:flex;gap:6px;margin-top:8px;">
      <div style="flex:1;background:#22c55e;color:white;text-align:center;padding:8px;border-radius:6px;font-size:10px;font-weight:600;">Approve</div>
      <div style="flex:1;background:#ef4444;color:white;text-align:center;padding:8px;border-radius:6px;font-size:10px;font-weight:600;">Reject</div>
    </div>
  </div>
  <!-- Bottom nav -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:#1a1a2e;display:flex;align-items:center;justify-content:space-around;padding:0 20px;">
    <span style="color:#6B21A8;font-size:9px;">Tasks</span>
    <span style="color:#888;font-size:9px;">Earnings</span>
    <span style="color:#888;font-size:9px;">Profile</span>
  </div>
</div>
```

## Part 4: Pipeline Integration

### New File: `worker/pipeline/stage4_contextualizer.py`

```python
async def generate_task_contextualizer(
    task_type: str,
    brief: dict,
    form_data: dict,
    device: str = "phone_portrait",
) -> str | None:
    """Generate a device mockup with campaign-specific task screenshot.

    Returns blob_url of the composed device mockup, or None on failure.
    """
```

**Steps:**
1. Load task preview template for `task_type`
2. Fill placeholders from `brief` + `form_data`
3. Render HTML to PNG via Playwright at device screen dimensions
4. Load device frame PNG from Blob
5. Composite screenshot into frame (Pillow/PIL)
6. Upload combined PNG to Blob
7. Return blob_url

### Cache Strategy

Device mockups are **per-campaign, not per-creative**. Generate once in `run_stage4()` before the composition matrix dispatch, then pass the URL to all `_compose_one()` calls. This means 1 contextualizer render per campaign, not per creative.

```python
# In run_stage4(), after loading brief:
device_mockup_url = await generate_task_contextualizer(
    task_type=brief.get("task_type", context.get("task_type", "")),
    brief=brief,
    form_data=context.get("form_data", {}),
)
# Pass to all _compose_one() calls
```

### Compositor Prompt Addition

New section in `_section_inputs()` when device mockup is available:

```
TASK CONTEXTUALIZER (floating device showing what contributors DO):
  Device mockup: {device_mockup_url}
  This is a phone mockup showing the actual task interface. It transforms
  the creative from generic → task-specific. Layer it:
  - Floating to the left or right of the actor
  - Slightly rotated (2-5° tilt for natural feel)
  - 30-40% of canvas width
  - Subtle drop shadow (0 8px 24px rgba(0,0,0,0.15))
  - Can overlap the actor slightly for depth
  This element is OPTIONAL — if the layout is too cramped, skip it.
  But when used, it dramatically increases perceived quality.
```

## Part 5: Seeding Script Update

Update `scripts/seed-design-artifacts.mjs` to upload the 23 new artifacts:

1. **10 new badges** → `scripts/artifacts/badges/`
2. **3 patterns** → `scripts/artifacts/patterns/`
3. **4 UI cards** → `scripts/artifacts/cards/` (HTML files)
4. **3 gradient applications** → `scripts/artifacts/gradients/`
5. **3 device frames** → `scripts/artifacts/devices/`

Each artifact gets:
- Uploaded to Vercel Blob under `/design-artifacts/{category}/`
- Inserted/upserted into `design_artifacts` Neon table
- Tagged with `pillar_affinity` and `format_affinity`
- `usage_snippet` showing GLM-5 how to use it

## Part 6: VQA Enhancement

Add a new VQA check for task contextualizer presence:

```python
# In Phase 2 VLM prompt, add scoring dimension:
# 8. TASK CONTEXT (0-1): Does the creative show what the contributor
#    will actually DO? Is there a device mockup, UI card, or visual
#    element that answers "what's the task?" Device mockup = automatic 0.9+.
#    No task context element = cap at 0.7.
```

This incentivizes GLM-5 to USE the device mockup when available — creatives without task context get penalized.

## Files Summary

### New Files
| File | Purpose |
|---|---|
| `worker/pipeline/stage4_contextualizer.py` | Task preview generation + device frame composition |
| `scripts/artifacts/task-previews/annotation_preview.html` | Annotation UI mockup template |
| `scripts/artifacts/task-previews/data_collection_preview.html` | Data collection UI mockup template |
| `scripts/artifacts/task-previews/judging_preview.html` | Judging/rating UI mockup template |
| `scripts/artifacts/task-previews/transcription_preview.html` | Transcription UI mockup template |
| `scripts/artifacts/task-previews/translation_preview.html` | Translation UI mockup template |
| `scripts/artifacts/devices/device_phone_portrait.png` | iPhone frame with transparent screen |
| `scripts/artifacts/devices/device_tablet_landscape.png` | iPad frame with transparent screen |
| `scripts/artifacts/devices/device_laptop.png` | Laptop frame with transparent screen |
| `scripts/artifacts/badges/badge_microphone.svg` | + 9 more badge SVGs |
| `scripts/artifacts/patterns/pattern_dot_grid.svg` | + 2 more pattern SVGs |
| `scripts/artifacts/cards/card_notification.html` | + 3 more UI card HTML snippets |
| `scripts/artifacts/gradients/gradient_bowl_curve.css` | + 2 more gradient CSS files |

### Modified Files
| File | Changes |
|---|---|
| `worker/pipeline/stage4_compose_v3.py` | Call contextualizer before composition matrix, pass device_mockup_url |
| `worker/prompts/compositor_prompt.py` | Add task contextualizer section to inputs |
| `scripts/seed-design-artifacts.mjs` | Add 23 new artifact entries to ARTIFACTS array |
| `worker/ai/creative_vqa.py` | Add task context scoring dimension to VLM prompt |

## Why This Gets Us to 11/10

| Before (7/10) | After (11/10) |
|---|---|
| Person + headline + CTA | Person + floating phone showing the actual task + headline + CTA |
| 3 generic badge icons | 13 task-specific gradient-backed badges |
| No texture/pattern | Subtle dot-grid and geometric patterns for visual richness |
| Same gradient application every time | 5 gradient styles (standard, bowl, sweep, burst, lavender) |
| No UI context elements | Floating notification cards, earnings summaries, task previews |
| Static generic creative | Campaign-specific creative that answers "what will I do?" visually |

The task contextualizer alone closes 60% of the gap. It transforms every creative from "generic recruitment ad" to "this is exactly what your day will look like" — which is what the Andromeda reference creatives achieve with their phone mockups.
