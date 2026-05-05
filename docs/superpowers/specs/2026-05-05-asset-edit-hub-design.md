# Asset Edit Hub — Inline Campaign Editing System

**Date:** 2026-05-05
**Status:** Design approved
**Author:** Steven Junop + Claude

---

## Summary

A bulletproof inline edit system that lets recruiters select assets from the campaign workspace, describe changes in plain English, and have the system surgically edit just those assets — no full pipeline re-run. Supports bulk copy corrections, link/QR updates, new locale additions (with Excel upload), and targeted single-asset edits. All edits are immediate (no approval queue), fully audited, and batch-rollbackable.

---

## Architecture

### Core Principle

Edits are surgical, not regenerative. A comp change updates 5 copy assets in 10 seconds. A link change regenerates 4 QR codes in 2 seconds. Only new locale additions touch the worker pipeline.

### Edit Action Types

| Action Type | Trigger | Handler | Speed |
|---|---|---|---|
| `copy_update` | Text instruction, no URL, no Excel | Gemma 3 27B per asset (existing revise logic) | ~2s/asset |
| `link_update` | URL pattern detected in instruction | Direct DB update + QR regen | Instant |
| `locale_add` | Excel file attached | Worker `generate_country` jobs (organic pipeline) | Minutes |
| `targeted_edit` | Specific assets selected + explicit replacement text | Gemma revision or GLM-5 re-compose | ~2-5s/asset |

### Classification

Simple keyword + context matching (not LLM):
- URL pattern (http/https) in instruction → `link_update`
- Excel file attached → `locale_add`
- Small selection (1-3 assets) + explicit replacement text → `targeted_edit`
- Everything else → `copy_update`

---

## Data Model

### No new tables. Leverages existing infrastructure:

**`generated_assets.content.edit_history`** — append-only JSONB array. Each edit appends:
```json
{
  "type": "recruiter_edit",
  "action_type": "copy_update",
  "instruction": "Change comp to $18/hr",
  "edited_by": "clerk_user_id",
  "timestamp": "2026-05-05T...",
  "original_value": "snapshot of content/copy_data before edit",
  "batch_id": "uuid"
}
```

**`generated_assets.version`** — incremented on each edit. Currently always 1; now tracks edit count.

**`batch_id`** — UUID grouping all assets edited in the same request. Enables batch display ("5 assets updated") and batch rollback.

**`intake_requests.form_data`** — locale_links and ada_form_url already live here. Link updates modify directly.

**`intake_requests.edit_lock`** — JSONB field for concurrent edit prevention:
```json
{
  "user_id": "clerk_id",
  "batch_id": "uuid",
  "started_at": "2026-05-05T..."
}
```
Cleared on edit completion. Prevents race conditions.

---

## API Routes

### `POST /api/intake/[id]/edit`

Primary edit endpoint.

**Request:**
```typescript
{
  instruction: string,           // plain English edit description (max 2000 chars)
  asset_ids: string[],           // selected assets
  excel_file?: File,             // required for locale_add (multipart/form-data)
}
```

**Response (success):**
```typescript
{
  action_type: "copy_update" | "link_update" | "locale_add" | "targeted_edit",
  batch_id: string,
  assets_updated: number,
  assets_failed: number,
  failed_assets: { id: string, error: string }[],
  // For locale_add:
  jobs_created?: number,
  new_countries?: string[],
}
```

**Status codes:**
- 200 — all assets updated
- 207 — partial success (some assets failed)
- 400 — validation error
- 403 — not authorized
- 409 — edit lock held by another user
- 500 — all assets failed

**Permission:** Campaign creator + lead_recruiter + admin. Campaign must be in `review`, `approved`, or `sent` status.

### `POST /api/intake/[id]/edit/rollback`

Batch rollback endpoint.

**Request:**
```typescript
{
  batch_id: string
}
```

**Response:**
```typescript
{
  assets_reverted: number,
  batch_id: string,
}
```

Finds all assets with matching `batch_id` in `edit_history`, restores each to its `original_value` snapshot.

---

## Edit Flows

### `copy_update` — Bulk Text Revision

1. Recruiter selects assets + types instruction
2. API classifies as `copy_update`
3. For each selected asset, apply revision inline (import revise logic directly, not HTTP):
   - `wp_job_post` → revise all text fields (title, intro, requirements, benefits, cta)
   - `job_portal_copy` → revise body + title
   - `flyer_copy` → revise headline, subheadline, body, cta
   - `social_caption` → revise caption text
   - `copy` (paid ad copy) → existing copy revision path
4. Each asset: snapshot `original_value`, apply edit, append `edit_history`, increment `version`
5. Notification: "5 copy assets updated — [view changes]"

### `link_update` — URL + QR Regeneration

1. Recruiter pastes new URL or updates locale links
2. API classifies as `link_update`
3. Update `intake_requests.form_data` (ada_form_url or locale_links)
4. Find all `flyer` assets for affected locales
5. For each flyer:
   - Regenerate QR code via `qr_generator.generate_qr_code()` with new tracked URL (includes UTM params)
   - Replace QR `<img src="data:image/png;base64,...">` in `content.html`
   - Update `content.qr_url` and `content.qr_destination`
6. Update WP post CTAs if the link is the apply URL
7. Update `tracked_links` table destinations
8. Edit history + version increment on all affected assets
9. Notification: "Links updated for 3 locales, QR codes regenerated on 4 flyers"

### `locale_add` — New Countries (Worker Pipeline)

1. Recruiter attaches Excel file with locale data
2. API classifies as `locale_add`
3. Parse Excel → extract new countries + locale_links + ada_form_urls
4. Validate: required columns present, no duplicate countries
5. Merge new locale data into `intake_requests.form_data.locale_links`
6. Add new countries to `intake_requests.target_regions`
7. Create `generate_country` compute_jobs for each new country (organic pipeline — stages 1-4)
8. Notification: "3 new countries queued — Brazil, Mexico, Colombia"
9. On worker completion: standard "Generation complete" notification

**Excel required columns:**
| Column | Required | Description |
|---|---|---|
| country | Yes | ISO country code (BR, MX, CO) |
| url | Yes | Aidaform URL or job posting link for that locale |
| label | No | Display name (defaults to country code) |

### `targeted_edit` — Specific Asset Changes

1. Recruiter selects specific assets + describes exact change
2. API classifies as `targeted_edit`
3. Routes based on asset_type:
   - Text assets (wp_job_post, job_portal_copy, flyer_copy, social_caption, copy) → Gemma revision with explicit replacement instruction
   - Compositions (flyer, social_graphic) → update copy fields in content, then re-compose via GLM-5 if layout change needed
4. Edit history + version increment
5. Notification: "1 asset updated"

---

## Bulletproofing

### Pre-flight Validation

| Check | Failure Response |
|---|---|
| Auth: user is creator, lead_recruiter, or admin | 403 |
| Campaign status is review/approved/sent | 400 — "Campaign must be approved before editing" |
| At least one asset selected OR instruction is clearly scoped | 400 — "Select assets or specify which to update" |
| Excel attached if instruction mentions new countries/locales | 400 — "Excel file required when adding new locales" |
| Excel contains required columns (country, url) | 400 — "Excel missing required columns" |
| No duplicate countries (new locales not already in target_regions) | 400 — "Brazil already exists in this campaign" |
| Selected assets belong to this campaign's request_id | 400 — "Asset does not belong to this campaign" |
| No active edit lock on this campaign | 409 — "Campaign is being edited by [name]" |

### Atomic Batch Execution

1. Generate `batch_id` (UUID) before starting
2. Acquire edit lock on `intake_requests`
3. For each asset, wrap in try/catch:
   - Success: increment version, append edit_history with `original_value` + `batch_id`
   - Failure: log error, skip asset, add to `failed_assets[]`
4. Release edit lock
5. Return summary:
   - All succeed → 200
   - Some fail → 207 (Multi-Status) with per-asset results
   - All fail → 500

### Rollback Capability

- **Copy edits:** `edit_history.original_value` stores full content snapshot. Rollback = restore snapshot.
- **Link edits:** `edit_history.original_value` stores previous URL. Rollback = restore URL + regenerate QR.
- **Batch rollback:** `POST /api/intake/[id]/edit/rollback` with `batch_id` — reverts all assets with that batch_id.
- **Locale add:** rollback removes the generated assets + removes countries from target_regions. (Destructive — confirmation required.)

### Rate Limiting & Safety Guards

| Guard | Value | Why |
|---|---|---|
| Max assets per batch | 50 | Prevents runaway edits |
| Max edits per campaign per hour | 10 batches | Prevents accidental spam |
| Instruction max length | 2000 chars | Sanity + prompt injection guard |
| Excel max rows | 100 countries | Sanity check |
| Concurrent edit lock | One active edit per campaign | Prevents race conditions |

### Concurrent Edit Lock

On edit start: set `intake_requests.edit_lock = {user_id, batch_id, started_at}`.
On completion: clear to `null`.
Stale lock auto-expires after 5 minutes (prevents orphaned locks from crashes).
If locked, return 409 with lock holder info.

---

## Notifications

Every edit produces a notification:

```json
{
  "type": "campaign_edit",
  "channel": "teams",
  "payload": {
    "campaign_title": "Audio Annotation - Morocco",
    "edited_by": "recruiter@centific.com",
    "action_type": "copy_update",
    "summary": "Changed compensation from $15/hr to $18/hr",
    "assets_updated": 5,
    "assets_failed": 0,
    "batch_id": "uuid",
    "deep_link": "https://onetake.oneforma.com/intake/[id]"
  }
}
```

For `locale_add`, two notifications:
1. Immediate: "3 new countries queued — processing"
2. On worker completion: "3 new countries ready for review"

---

## Frontend

### Edit Mode in Campaign Workspace

**Entry:** "Edit Campaign" button in workspace header (visible to creator + lead_recruiter + admin when status is review/approved/sent).

**Edit mode UI:**
- Checkboxes appear on all assets across all tabs (Organic Materials, Paid Creatives)
- "Select All" per tab + "Select All Copy" / "Select All Flyers" quick filters
- Bottom sticky bar shows: selected count + instruction textarea + "Apply Edit" button + optional Excel upload
- Cancel exits edit mode without changes

**Post-edit:**
- Success toast: "5 assets updated" with "Undo" button (triggers rollback)
- Assets show subtle "edited" indicator (small pencil icon + version number)
- Edit history accessible per asset via dropdown

### Edit History View

Per asset, expandable timeline:
- Current (green dot) — shows current content
- Edit N (gray) — shows instruction, who, when, batch link
- Original (gray) — the pre-edit state
- Each entry has "Revert to this version" button

Per campaign, batch timeline:
- Shows all edit batches with summary, who, when
- "Rollback batch" button per entry

---

## Permission Model

```typescript
function canEditCampaign(authCtx: AuthContext, requestCreatedBy: string, requestStatus: string): boolean {
  if (!['review', 'approved', 'sent'].includes(requestStatus)) return false;
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'lead_recruiter') return true;
  if (authCtx.role === 'recruiter') return requestCreatedBy === authCtx.userId;
  return false;
}
```

---

## Key Decisions

| Decision | Rationale |
|---|---|
| No approval queue for edits | These are corrections to already-approved campaigns — trusted users making factual changes |
| Classification is keyword-based, not LLM | Fast, deterministic, no API cost for routing |
| Batch edits with batch_id | Enables "undo entire edit" in one click |
| Edit lock per campaign | Prevents two recruiters editing the same campaign simultaneously |
| Excel mandatory for new locales | Locale data (links, URLs) must be structured, not free-text |
| Rollback via original_value snapshots | Full reversibility without a separate versions table |
| Existing /api/revise logic reused inline | Proven Gemma copy revision + no new LLM integration needed |
| Version column incremented | Quick "edited N times" without reading JSONB history |

---

## Files Impacted (Estimated)

| Area | Files |
|---|---|
| Edit API route | `src/app/api/intake/[id]/edit/route.ts` (create) |
| Rollback API route | `src/app/api/intake/[id]/edit/rollback/route.ts` (create) |
| Edit classifier | `src/lib/edit-classifier.ts` (create) |
| Edit executor | `src/lib/edit-executor.ts` (create — orchestrates per-type edits) |
| Permissions | `src/lib/permissions.ts` (add canEditCampaign) |
| Schema | `src/lib/db/schema.ts` (add edit_lock column) |
| QR regeneration | Calls existing `worker/utils/qr_generator.py` via API or inline |
| Excel parser | `src/lib/excel-parser.ts` (create — parse locale Excel) |
| Frontend edit mode | `src/components/campaign/EditMode.tsx` (create) |
| Frontend edit bar | `src/components/campaign/EditBar.tsx` (create — sticky bottom bar) |
| Frontend edit history | Extend existing `EditHistory.tsx` for batch view |
| Notifications | Extend existing Teams webhook with campaign_edit type |
| Workspace page | `src/app/intake/[id]/page.tsx` (add edit mode toggle) |
