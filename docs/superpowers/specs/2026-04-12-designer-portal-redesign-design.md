# Designer Portal Redesign — Master Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved
**Goal:** Transform the designer portal from a functional MVP into a platinum-level creative workspace that earns trust from a designer with incredibly high standards. Zero AI slop — in UI, in UX, in the actual creative assets presented.

## The 3 Subsystems

This is decomposed into 3 independent specs, each with its own plan → implement cycle:

1. **Creative Gallery** (implement first) — V1-V5 per persona, effortless browsing
2. **Edit & Regenerate** (implement second) — Flux 2 quick edit, Seedream 4.5 regen, Figma SVG export
3. **Upload & Route** (implement third) — upload refined assets, auto-route to persona + ad set + version

---

## System 1: Creative Gallery — Platinum-Level Asset Browsing

### Problem
Current designer view dumps assets in a flat grid with 4 confusing tabs (Characters = Raw = same data). No persona grouping, no version organization, no visual hierarchy. A designer with high standards sees this and thinks "AI slop tool."

### Target State
A gallery that feels like **Figma's asset panel meets Dribbble** — organized by persona, grouped by version (V1-V5), with true aspect ratio previews, VQA scores, and one-click actions. The designer should think "someone who understands design built this."

### Architecture

```
Designer Workspace
├── Campaign Header (title, status, brief link, download all)
├── Persona Tabs (Maria G. | Alex T. | Priya K.)
│   └── Per Persona:
│       ├── Persona Context Card (mini brief — who, psychology, tone)
│       └── Version Groups (accordion, V1-V5)
│           └── Per Version:
│               ├── Trigger: V-badge, headline, format count, VQA, actions
│               └── Expanded:
│                   ├── Format Grid (Feed 1:1, Story 9:16, Carousel 4:5)
│                   │   └── Each format: true aspect ratio, platform badge, score
│                   ├── Design Notes (curated, not raw JSON)
│                   └── Quick Actions (download, edit, export Figma, regenerate)
```

### Design System — Platinum Level

**The UI itself must be platinum.** This is what "no AI slop" means in the interface:

**Typography:**
- Headings: Georgia serif (matches the creative output — designer sees consistency)
- Body: system sans-serif, proper line-height (1.6), letter-spacing (-0.01em on headings)
- Monospace for technical metadata (VQA scores, dimensions)
- NO generic "Untitled" or "Unknown" labels — every element has real data or is hidden

**Color:**
- Dark workspace background `#0F0F10` (like Figma's canvas) — creatives pop against dark
- Card surfaces `#1A1A1E` with `#2A2A2E` borders
- Text: `#E8E8EA` primary, `#8A8A8E` secondary
- Accent: OneForma purple `#6D28D9` sparingly (selected states, active tabs)
- VQA scores: green `#22c55e` (≥0.85), amber `#f59e0b` (≥0.70), red `#ef4444` (<0.70)
- NO bright backgrounds, NO white cards, NO light theme — dark canvas makes the creatives the hero

**Spacing:**
- Generous padding everywhere (24-32px)
- Card gap: 16px
- Section gap: 32px
- The workspace should feel spacious, not cramped

**Interactions:**
- Hover on asset: subtle scale(1.02) + elevated shadow
- Click on asset: opens fullscreen lightbox with dark overlay
- Keyboard: arrow keys navigate assets, Escape closes lightbox
- Everything has cursor-pointer where clickable
- Smooth transitions (150ms ease)

### Persona Tabs
- Pill tabs at the top of the workspace
- Each shows: persona name + asset count
- Active: `#6D28D9` fill, white text
- Inactive: transparent with `#8A8A8E` text, `#2A2A2E` border
- Switching tabs is instant (no loading — all data pre-loaded)

### Version Groups (V1-V5 Accordions)
- **Collapsed (default):** V-badge + headline + format count pill + avg VQA score + download button
- **Expanded:** Format grid showing all aspect ratio variants
- **Trigger styling:** `#1A1A1E` background, hover `#222226`, 14px 20px padding
- V-badge: `#2A2A2E` background, white text, 10px border-radius
- Only ONE version expanded at a time (accordion behavior) — focus, not overwhelm

### Format Grid (Inside Version)
- Horizontal row of true aspect ratio thumbnails
- Each format card:
  - True aspect ratio preview (not square-cropped)
  - Platform badge (top-left): "Feed 1:1", "Story 9:16", "Carousel 4:5"
  - VQA score badge (top-right): green/amber/red
  - Hover: overlay with 3 action icons (download, edit, export Figma)
  - Dimensions text below: "1080 × 1080"
- Height baseline: 180px (all formats same height, width varies by aspect ratio)

### Design Notes (Curated)
- NOT raw JSON dumps. Curated fields:
  - **Archetype:** "Floating Props" / "Gradient Hero" / "Photo Feature"
  - **Pillar:** "Earn" / "Grow" / "Shape"
  - **Scene:** human-readable scene description
  - **Composition:** brief layout description
- Each field: label (10px uppercase muted) + value (13px white)
- Collapsible — hidden by default, toggle with "Design Notes" link

### Quick Actions Per Version
| Action | Icon | What it does |
|---|---|---|
| Download All | Download | Downloads all format variants as named ZIP |
| Edit (Flux 2) | Wand | Opens inline quick-edit panel (System 2) |
| Regenerate | RefreshCw | Regenerate base image with Seedream (System 2) |
| Export Figma | Figma | Downloads Figma-compatible SVG |

### Fullscreen Lightbox
- Click any asset → dark overlay (95% opacity) + centered image at true resolution
- Left/right arrows to navigate formats within the version
- Top bar: filename, dimensions, VQA score, platform
- Bottom bar: download, edit, export actions
- Escape or click outside to close
- Keyboard: ← → to navigate, Esc to close

### Empty States
- No assets: "Pipeline is generating creatives for this campaign. Check back in 30 minutes."
- No approved: "No creatives have passed VQA yet. The pipeline is iterating."
- Every empty state has a specific message — never generic "No data."

---

## System 2: Edit & Regenerate — In-Platform Creative Control

### Problem
Currently the designer must: download → open Figma → edit → export → re-upload. This kills momentum. Quick edits (swap background, adjust text position, change CTA color) should happen IN the platform.

### Target State
Two edit modes integrated into the gallery:
1. **Quick Edit (Flux 2)** — AI-powered inpainting/edit on the rendered PNG. Draw a mask, describe the change, AI applies it. For small fixes: "remove the scar on forehead", "make background lighter", "change shirt color to blue."
2. **Regenerate Base (Seedream 4.5)** — regenerate the underlying actor photo with modified prompt. For bigger changes: "different scene", "different outfit", "more professional setting."
3. **Full Figma Export** — download SVG with editable layers (already built). For deep redesigns where the designer wants full control.

### Quick Edit Flow (Flux 2)
```
Designer clicks "Edit" on a creative
  → Inline editor opens (replaces gallery temporarily)
  → Left: creative at full resolution with brush tool overlay
  → Right: edit panel
    ├── Brush size slider
    ├── "What to change" text input
    ├── "Apply Edit" button
    └── Before/After toggle
  → Flux 2 processes the edit (5-10 seconds)
  → Designer sees result, can accept or try again
  → Accept → replaces the original, triggers re-VQA
```

**Technical:** POST to `/api/assets/[id]/edit` with `{ mask_image: base64, prompt: string }`. Server calls Flux 2 via existing `worker/ai/gemini_edit.py` (already has Flux integration). Returns new blob_url.

### Regenerate Base Flow (Seedream 4.5)
```
Designer clicks "Regenerate" on a version
  → Modal: "What should change about the photo?"
  → Options: Scene, Outfit, Expression, Background (checkboxes)
  → Text field for specific direction
  → "Regenerate" button → Seedream generates new base image
  → New image replaces the old one in the version
  → Stage 4 re-composes all formats with new base → re-VQA
```

**Technical:** POST to `/api/assets/[id]/regenerate` with `{ changes: string[], direction: string }`. Server creates a compute_job for Stage 2 re-run on that specific actor + scene.

### Edit History
- Every edit creates a new version (never overwrites)
- "History" dropdown on each asset showing: Original → Edit 1 → Edit 2
- Can revert to any previous version

### API Routes Needed
| Route | Method | Purpose |
|---|---|---|
| `/api/assets/[id]/edit` | POST | Flux 2 quick edit |
| `/api/assets/[id]/regenerate` | POST | Seedream 4.5 base regen |
| `/api/assets/[id]/history` | GET | Version history |
| `/api/assets/[id]/revert` | POST | Revert to previous version |

---

## System 3: Upload & Route — Seamless Asset Replacement

### Problem
When the designer refines assets in Figma and re-uploads, there's no way to automatically route them back to the correct persona + ad set + version + format. Currently uploads go into a flat "Uploads" tab with no organization.

### Target State
A smart upload system that:
1. **Auto-detects** which persona/version/format the upload replaces (by filename convention or visual matching)
2. **Routes** the replacement to the correct slot in the gallery
3. **Shows** before/after comparison inline
4. **Updates** all downstream views (agency portal, recruiter library)

### Upload Methods
1. **Replace in-place** — from the format grid, click "Replace" on a specific format card. Opens file picker. Upload replaces that exact asset. Zero ambiguity.
2. **Bulk upload** — drag-and-drop multiple files. System matches by filename convention: `{ActorName}_{Pillar}_{Platform}_{Version}.png` (e.g., `Maria_Shape_ig_feed_V1.png`). Shows matching preview before confirming.
3. **Figma plugin upload** (future) — Figma plugin that exports frames directly to Nova with metadata.

### Filename Convention
```
{ActorFirstName}_{Pillar}_{Platform}_{Version}.{ext}
Examples:
  Maria_Shape_ig_feed_V1.png
  Alex_Earn_linkedin_feed_V2.png
  Priya_Grow_ig_story_V1.png
```

If filename doesn't match convention, show a manual routing dialog:
- Persona dropdown
- Version dropdown
- Format/platform dropdown
- "Route & Replace" button

### Replace Flow
```
Designer uploads Maria_Shape_ig_feed_V1.png
  → System parses filename → matches to persona "Maria", pillar "Shape", platform "ig_feed", version "V1"
  → Shows: "This will replace [current image] with [your upload] for Maria G. — Shape — Instagram Feed — V1"
  → Before/After preview (VersionCompare slider)
  → "Confirm Replace" button
  → Original moved to history, new file becomes active
  → VQA re-runs on new file
  → Agency portal + recruiter library auto-update
```

### Bulk Upload Flow
```
Designer drags 6 files into upload zone
  → System parses each filename
  → Shows table: [Filename] → [Matched Slot] → [Status: ✓ matched / ? manual]
  → Unmatched files get manual routing dropdown
  → "Replace All" button
  → Batch replacement with progress bar
```

### API Routes Needed
| Route | Method | Purpose |
|---|---|---|
| `/api/designer/[id]/replace` | POST | Replace a specific asset with upload |
| `/api/designer/[id]/bulk-replace` | POST | Batch replace with filename matching |
| `/api/designer/[id]/match-filename` | POST | Parse filename, return matched slot |

### Post-Replace Triggers
When an asset is replaced:
1. Original archived to `asset_history` (new table)
2. New file uploaded to Blob, asset record updated
3. VQA re-runs on new file
4. If VQA passes, downstream views auto-update
5. Notification sent to marketing team ("Designer replaced V1 Feed for Maria")

---

## Implementation Order

| Phase | System | Effort | Value |
|---|---|---|---|
| **Phase 1** | Creative Gallery | 8-10 tasks | Designer sees organized, beautiful output immediately |
| **Phase 2** | Edit & Regenerate | 6-8 tasks | Designer can fix issues without leaving the platform |
| **Phase 3** | Upload & Route | 5-6 tasks | Full round-trip: AI → designer → approved asset |

Phase 1 alone transforms the designer's experience. Phases 2 and 3 make it a complete creative workspace.

---

## Files Summary

### System 1: Gallery (New Components)
| Component | Purpose |
|---|---|
| `src/components/designer/DesignerGallery.tsx` | Main gallery — persona tabs + version accordions |
| `src/components/designer/PersonaTab.tsx` | Per-persona content with version groups |
| `src/components/designer/VersionGroup.tsx` | Collapsible V-group with format grid |
| `src/components/designer/FormatCard.tsx` | Individual format preview with actions |
| `src/components/designer/AssetLightbox.tsx` | Fullscreen preview with navigation |
| `src/components/designer/DesignNotes.tsx` | Curated design metadata display |

### System 2: Edit (New Components + Routes)
| Component | Purpose |
|---|---|
| `src/components/designer/QuickEditor.tsx` | Inline Flux 2 edit panel with brush tool |
| `src/components/designer/RegenerateModal.tsx` | Seedream 4.5 regeneration options |
| `src/app/api/assets/[id]/edit/route.ts` | Flux 2 edit API |
| `src/app/api/assets/[id]/regenerate/route.ts` | Seedream regen API |
| `src/app/api/assets/[id]/history/route.ts` | Version history API |

### System 3: Upload (New Components + Routes)
| Component | Purpose |
|---|---|
| `src/components/designer/SmartUpload.tsx` | Filename-matched upload with routing |
| `src/components/designer/BulkReplace.tsx` | Batch upload with matching table |
| `src/components/designer/ReplaceConfirm.tsx` | Before/after confirmation dialog |
| `src/app/api/designer/[id]/replace/route.ts` | Single asset replacement |
| `src/app/api/designer/[id]/bulk-replace/route.ts` | Batch replacement |

### Modified Files
| File | Changes |
|---|---|
| `src/app/designer/[id]/page.tsx` | Replace current workspace with DesignerGallery |
| `src/lib/types.ts` | Add AssetHistory type |
