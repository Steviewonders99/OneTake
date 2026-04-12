# Designer Portal — Upload, Route & Figma Sync — Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved
**Depends on:** Designer Gallery (System 1) + Edit & Regenerate (System 2)
**Parent spec:** `2026-04-12-designer-portal-redesign-design.md`

## Overview

Build a seamless round-trip between Nova and Figma:
1. **Export to Figma:** Nova pushes the full creative package to a Figma file — each element as its own editable SVG layer, organized by persona → version → formats horizontal
2. **Figma Live Sync:** Nova polls the Figma file every 60s, detects changes, auto-exports changed frames, auto-routes replacements back to the correct persona/version/format
3. **Manual Upload:** Fallback for designers who don't use Figma or want to upload from other tools

The designer should NEVER think about "uploading" or "routing." They edit in Figma. Nova just knows.

## Figma File Structure

One Figma file per campaign. Nova creates and manages it.

```
Figma File: "Cutis Dermatology — Nova Creatives"
│
├── Page: "Creatives"
│   │
│   ├── Section: "Maria G. — The Clinical Professional"
│   │   │
│   │   ├── Frame Group: "V1 — Join Our Clinical Research Team"
│   │   │   ├── Frame: "Nova_Maria_V1_ig_feed_1080x1080"
│   │   │   │   ├── Layer: "Base Photo" (embedded PNG)
│   │   │   │   ├── Layer: "Background Gradient" (SVG)
│   │   │   │   ├── Layer: "Blob Accent" (SVG)
│   │   │   │   ├── Layer: "Headline" (editable text)
│   │   │   │   ├── Layer: "Subheadline" (editable text)
│   │   │   │   ├── Layer: "CTA Button" (rect + text)
│   │   │   │   ├── Layer: "Social Proof" (avatar stack)
│   │   │   │   └── Layer: "Logo" (SVG)
│   │   │   │
│   │   │   ├── Frame: "Nova_Maria_V1_ig_story_1080x1920"
│   │   │   │   └── (same layer structure, different dimensions)
│   │   │   │
│   │   │   ├── Frame: "Nova_Maria_V1_ig_carousel_1080x1350"
│   │   │   └── Frame: "Nova_Maria_V1_linkedin_feed_1200x627"
│   │   │
│   │   ├── Frame Group: "V2 — Shape the Future"
│   │   │   └── (same pattern)
│   │   │
│   │   └── Frame Group: "V3 — Your Expertise Advances Science"
│   │
│   ├── Section: "Alex T. — The Gig Worker"
│   │   └── (same pattern)
│   │
│   └── Section: "Priya K. — The Student"
│       └── (same pattern)
```

**Spatial layout on the Figma canvas:**
- Personas stacked VERTICALLY (top → bottom)
- Versions stacked VERTICALLY within each persona section
- Format variants arranged HORIZONTALLY within each version
- 200px vertical gap between personas (with section label)
- 100px vertical gap between versions
- 60px horizontal gap between format variants
- Each frame is at TRUE dimensions (1080x1080, 1080x1920, etc.)

## Part 1: Export to Figma

### What It Does
One-click "Push to Figma" creates a Figma file with ALL creatives for the campaign, organized by persona/version with every element as an editable layer.

### UX Flow
```
Designer clicks "Push to Figma" in campaign header
  → Modal: "Create Figma project for Cutis Dermatology?"
  → Input: Figma Personal Access Token (stored in localStorage, one-time)
  → "Create Project" button
  → Progress: "Creating file... Uploading Maria V1 (4 formats)..."
  → Complete: "Figma file ready — [Open in Figma]" link
  → File URL saved to campaign record for live sync
```

### Technical Implementation

**Figma REST API calls:**

1. **Create file:** `POST /v1/files` (or use a template file)
   - Actually: Figma API doesn't support file creation directly
   - **Alternative:** Create a Figma file manually (or from template), get the file_key, then use the Figma Plugin API to populate it
   - **Simpler alternative:** Use the Figma REST API to import SVGs into an EXISTING file

2. **Better approach — Figma "Import" via Plugin:**
   - Nova generates a `.fig` file programmatically using a Figma file builder library
   - Or: Nova generates individual SVGs per frame, designer imports them into Figma
   - Or: Nova creates a ZIP of named SVGs that the designer drags into Figma

**Recommended approach (most reliable):**

Since Figma's REST API doesn't support creating files with content programmatically, we use a **two-step flow:**

1. **Nova generates a structured SVG package** — a ZIP file with:
   ```
   cutis-dermatology-nova/
   ├── Maria_G/
   │   ├── V1_Join_Our_Clinical_Research_Team/
   │   │   ├── Nova_Maria_V1_ig_feed_1080x1080.svg
   │   │   ├── Nova_Maria_V1_ig_story_1080x1920.svg
   │   │   ├── Nova_Maria_V1_ig_carousel_1080x1350.svg
   │   │   └── Nova_Maria_V1_linkedin_feed_1200x627.svg
   │   ├── V2_Shape_the_Future/
   │   │   └── ...
   │   └── V3_Your_Expertise/
   │       └── ...
   ├── Alex_T/
   │   └── ...
   └── Priya_K/
       └── ...
   ```

2. **Designer drags the folder into Figma** → all SVGs import as frames with layers intact

3. **Designer pastes the Figma file URL into Nova** → enables live sync

Each SVG uses our hardened export format:
- Base image as embedded `<image>` with base64 data URI
- Headline as editable `<text>` element
- Subheadline as editable `<text>` element
- CTA as `<rect>` + `<text>` (editable)
- Layer groups named with `data-figma-label` for Figma's layer panel
- All elements individually selectable and movable in Figma

### Frame Naming Convention (Critical for Sync)
```
Nova_{PersonaFirstName}_{Version}_{Platform}_{Width}x{Height}
```
Examples:
- `Nova_Maria_V1_ig_feed_1080x1080`
- `Nova_Alex_V2_linkedin_feed_1200x627`
- `Nova_Priya_V1_ig_story_1080x1920`

This naming convention is how Nova routes changes back. The `Nova_` prefix identifies Nova-managed frames. The rest maps directly to persona + version + platform.

### API Route
`GET /api/export/figma-package/[requestId]`
- Returns a ZIP file containing all SVGs organized by persona/version
- Each SVG uses the hardened export format (base64 PNG + editable text layers)
- Filename follows the routing convention

## Part 2: Figma Live Sync

### What It Does
Nova polls the Figma file every 60 seconds. When the designer modifies a frame, Nova detects the change, exports the updated frame as PNG, and auto-routes it back to the correct creative slot. The gallery updates automatically.

### Prerequisites
- Designer has provided their Figma Personal Access Token (stored encrypted in DB)
- Designer has pasted the Figma file URL into Nova (stored on campaign record)
- File contains frames with `Nova_` prefix naming convention

### Sync Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│  Designer    │       │   Nova       │       │  Figma API  │
│  (Figma)     │       │   (Server)   │       │             │
└──────┬───────┘       └──────┬───────┘       └──────┬──────┘
       │                      │                       │
       │  edits frame         │                       │
       │                      │  poll GET /files/:key │
       │                      │──────────────────────>│
       │                      │  lastModified changed │
       │                      │<──────────────────────│
       │                      │                       │
       │                      │  GET /files/:key      │
       │                      │  (full tree)          │
       │                      │──────────────────────>│
       │                      │  frame tree + hashes  │
       │                      │<──────────────────────│
       │                      │                       │
       │                      │  diff against last    │
       │                      │  known state          │
       │                      │                       │
       │                      │  GET /images/:key     │
       │                      │  (changed frames only)│
       │                      │──────────────────────>│
       │                      │  PNG exports          │
       │                      │<──────────────────────│
       │                      │                       │
       │                      │  parse frame name     │
       │                      │  route to persona/    │
       │                      │  version/format       │
       │                      │                       │
       │                      │  replace asset        │
       │                      │  re-run VQA           │
       │                      │                       │
       │  sees gallery update │                       │
       │<─────────────────────│                       │
```

### Polling Logic

```python
async def sync_figma_file(request_id: str, file_key: str, token: str):
    """Poll Figma file, detect changes, auto-route replacements."""

    # 1. Check if file was modified since last sync
    file_meta = await figma_get_file_meta(file_key, token)
    if file_meta["lastModified"] == last_known_modified:
        return  # No changes

    # 2. Get full file tree
    file_data = await figma_get_file(file_key, token)

    # 3. Find all Nova-managed frames (name starts with "Nova_")
    nova_frames = extract_nova_frames(file_data)

    # 4. Diff against last known state (compare frame hashes)
    changed_frames = diff_frames(nova_frames, last_known_frames)
    if not changed_frames:
        return  # Structure changed but no Nova frames modified

    # 5. Export changed frames as PNG via Figma API
    for frame in changed_frames:
        png_url = await figma_export_frame(file_key, frame.node_id, token)
        png_bytes = await download(png_url)

        # 6. Parse frame name → routing metadata
        routing = parse_frame_name(frame.name)
        # routing = {persona: "Maria", version: "V1", platform: "ig_feed", dims: "1080x1080"}

        # 7. Find matching asset in Nova
        asset = await find_asset_by_routing(request_id, routing)
        if not asset:
            logger.warning("No matching asset for frame: %s", frame.name)
            continue

        # 8. Replace asset
        blob_url = await upload_to_blob(png_bytes, f"figma_sync_{frame.name}.png")
        await replace_asset(asset.id, blob_url, edit_source="figma_sync")

        # 9. Re-run VQA
        vqa_result = await evaluate_creative(...)
        logger.info("Figma sync: %s → %s (VQA: %.2f)", frame.name, blob_url, vqa_result["score"])

    # 10. Update last known state
    save_sync_state(request_id, file_meta["lastModified"], nova_frames)
```

### Figma API Endpoints Used

| Endpoint | Purpose | Rate Limit |
|---|---|---|
| `GET /v1/files/:key?depth=1` | Check lastModified + get page structure | 30/min |
| `GET /v1/files/:key` | Full file tree with all nodes | 30/min |
| `GET /v1/images/:key?ids=X,Y,Z&format=png&scale=2` | Export specific frames as PNG | 30/min |

**Rate budget per sync cycle:** 2-3 calls (meta check + full tree if changed + batch export). At 60s intervals = ~3 calls/min, well within the 30/min limit.

### Sync State Storage

New DB table or JSONB field on `intake_requests`:

```sql
ALTER TABLE intake_requests ADD COLUMN figma_sync JSONB DEFAULT NULL;
```

```json
{
  "file_key": "abc123XYZ",
  "file_url": "https://www.figma.com/file/abc123XYZ/Cutis-Dermatology",
  "last_modified": "2026-04-12T15:30:00Z",
  "last_synced": "2026-04-12T15:31:00Z",
  "token_encrypted": "...",
  "frame_hashes": {
    "Nova_Maria_V1_ig_feed_1080x1080": "sha256:abc...",
    "Nova_Maria_V1_ig_story_1080x1920": "sha256:def...",
  },
  "sync_enabled": true
}
```

### Sync Status in Gallery UI

When Figma sync is enabled, the gallery header shows:

```
[Figma icon] Synced with Figma · Last sync: 2m ago · [Open in Figma →]
```

If a frame was recently synced, its format card shows a small green Figma badge:

```
[Figma icon] Updated from Figma · 3m ago
```

### Enable Sync Flow

```
Designer clicks "Connect Figma" in campaign header
  → Modal:
    ├── Step 1: Enter Figma Personal Access Token
    │   └── Link to "How to get your token" (Figma settings → Personal Access Tokens)
    ├── Step 2: Paste Figma file URL
    │   └── "Paste the URL of the Figma file containing your Nova creatives"
    └── Step 3: "Enable Sync" button
  → Nova validates: GET /v1/files/:key with token → confirms access
  → Saves token (encrypted) + file_key to campaign record
  → Starts polling
```

## Part 3: Manual Upload & Route (Fallback)

For designers who don't use Figma, or for one-off uploads from other tools.

### Replace In-Place
From the format grid in the gallery, each format card has a "Replace" action:
```
Click "Replace" on format card
  → File picker opens
  → Select PNG/JPG
  → Confirmation: "Replace V1 Feed 1:1 for Maria G.?"
  → Before/After slider preview
  → "Confirm Replace" button
  → Original archived to history
  → New file uploaded, VQA re-runs
  → Gallery updates
```

### Bulk Upload with Auto-Routing
```
Click "Upload" button in campaign header
  → Drag-and-drop zone opens
  → Drop multiple files
  → Nova parses filenames against naming convention:
    Nova_{Persona}_{Version}_{Platform}_{Dims}.png
  → Shows routing table:
    [Filename] → [Matched Slot] → [Status: ✓ matched / ? manual]
  → Unmatched files get manual routing dropdown (persona, version, platform)
  → "Replace All" button
  → Batch replacement with progress bar
```

### Manual Routing Dialog (for unmatched files)
```
File: "clinical_study_hero.png"
  → Could not auto-route. Please select:
  ├── Persona: [Maria G. ▾]
  ├── Version: [V1 ▾]
  ├── Format: [Feed 1:1 ▾]
  └── [Route & Replace]
```

## New Files

### Frontend Components
| Component | Purpose |
|---|---|
| `src/components/designer/FigmaExport.tsx` | "Push to Figma" package generation + download |
| `src/components/designer/FigmaSync.tsx` | Connect Figma modal + sync status display |
| `src/components/designer/ManualUpload.tsx` | Drag-drop upload with filename auto-routing |
| `src/components/designer/RouteDialog.tsx` | Manual routing dialog for unmatched files |
| `src/components/designer/ReplaceConfirm.tsx` | Before/after confirmation with slider |

### API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/export/figma-package/[requestId]` | GET | Generate ZIP of all SVGs organized by persona/version |
| `/api/figma/connect` | POST | Validate + save Figma token + file URL |
| `/api/figma/sync/[requestId]` | POST | Trigger manual sync (also called by cron) |
| `/api/figma/status/[requestId]` | GET | Get sync status + last modified |
| `/api/designer/[id]/replace` | POST | Replace a specific asset (exists, extend) |
| `/api/designer/[id]/bulk-replace` | POST | Batch replacement with routing |

### Backend Pipeline
| File | Purpose |
|---|---|
| `worker/pipeline/figma_sync.py` | Figma polling + diff + auto-route logic |
| `src/lib/figma-client.ts` | Figma REST API client (files, images, meta) |

### Database Changes
| Change | Purpose |
|---|---|
| `intake_requests.figma_sync` (JSONB) | Figma file key, token, sync state, frame hashes |
| `asset_history` (new table) | Archive of replaced assets with metadata |

## Implementation Priority

| Phase | What | Effort | Impact |
|---|---|---|---|
| **Phase A** | SVG package export (ZIP download) | Low | Designer gets organized Figma-ready files immediately |
| **Phase B** | Manual upload + auto-routing | Medium | Covers non-Figma workflows |
| **Phase C** | Figma connect + live sync | High | The magic — zero-touch round-trip |

Phase A alone transforms the export workflow. Phase C is the long-term differentiator.
