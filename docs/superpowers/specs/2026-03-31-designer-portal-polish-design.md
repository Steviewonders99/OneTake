# Designer Portal — Polish + Feature Completion Spec

## Goal

Complete the designer portal's unfinished features (Submit Finals flow, dead code cleanup) and polish all designer pages for full responsiveness across mobile, tablet, and desktop viewports.

## Architecture

No new architecture — wire up existing placeholder buttons, add one new API route for finals submission, delete one unused route, and apply responsive CSS fixes across 11 files. All changes are frontend-focused except the new submit-finals endpoint.

## Tech Stack

- Existing Next.js components, Tailwind CSS, Lucide icons
- Existing API patterns (Neon queries, magic link validation, Teams webhook)
- No new database tables (uses existing `intake_requests.status` + `notifications`)

---

## Part 1: Feature Completion

### 1A: Submit Finals Flow

**New route:** `src/app/api/designer/[id]/submit-finals/route.ts`

**POST** `/api/designer/{id}/submit-finals`
- Request body: `{ token: string }`
- Validates magic link token (same pattern as other designer routes)
- Checks that at least 1 `designer_uploads` record exists for this request (can't submit empty)
- Updates `intake_requests.status` to `'sent'`
- Creates notification record: `{ user_id: request.created_by, type: 'finals_submitted', message: 'Designer submitted finals for {title}' }`
- Sends Teams webhook notification: "Designer submitted finals for {title}" with link to detail page
- Returns `{ success: true }`

**UploadZone.tsx changes:**
- Wire `onSubmitFinals` to call the new endpoint
- Pass `token` and `requestId` as props (already available in parent)
- Disable button if no uploads exist: gray out, tooltip "Upload at least one file first"
- After successful submission: show green banner "Finals submitted successfully", disable further uploads and the submit button
- Loading state while submitting

### 1B: Dead Code Cleanup

**Delete:** `src/app/api/designer/edit/route.ts`
- This route is unused — `SeedreamEditor` calls `/api/revise` instead
- Removing prevents confusion

---

## Part 2: UI Polish — Responsive Fixes

### 2A: Designer Campaign Workspace (`/designer/[id]`)

**File:** `src/app/designer/[id]/page.tsx` (381 lines)

Fixes:
- Header: `pl-14 lg:pl-6` for hamburger clearance on mobile
- Header layout: `flex-col sm:flex-row` for title + action buttons
- Campaign context card: responsive grid (`grid-cols-1 sm:grid-cols-2`)
- Asset browser section: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (currently may be fixed columns)
- Download kit section: ensure `flex-wrap` on button row
- Upload zone: full-width on mobile, proper `px-4` padding
- Overall body: `px-4 md:px-8 lg:px-10` padding pattern
- Status badges: `flex-wrap` with `gap-2`

### 2B: Seedream Editor (`/designer/editor`)

**File:** `src/components/designer/SeedreamEditor.tsx` (475 lines)

Current layout: three fixed panels (320px sidebar + flex-1 canvas + 340px chat)

Responsive fix:
- Desktop (lg+): keep three-panel horizontal layout
- Tablet/Mobile (<lg): stack vertically — asset picker on top (collapsible), canvas in middle (full-width), chat below
- Left sidebar: `hidden lg:block lg:w-[320px]` on desktop, toggle button to show/hide on mobile as an overlay or top section
- Center canvas: `w-full` always
- Right chat: `w-full lg:w-[340px]` — below canvas on mobile, right panel on desktop
- The `flex` container: `flex-col lg:flex-row`

### 2C: Designer Campaign List (`/designer`)

**File:** `src/components/designer/DesignerCampaignList.tsx` (185 lines)

Fixes:
- Container: `pl-14 lg:pl-6 px-4 md:px-8` for hamburger clearance
- Card grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
- Search bar: full-width on mobile
- Header: `flex-col sm:flex-row` if title + actions share a row

### 2D: Asset Browser Sidebar

**File:** `src/components/designer/AssetBrowser.tsx` (226 lines)

Fixes:
- Thumbnail grid: `grid-cols-2` (currently may assume wider container)
- Search input: full-width
- Filter tabs: `flex-wrap` if they overflow
- Proper `overflow-y-auto` with scrollbar-hide

### 2E: Designer Asset Card

**File:** `src/components/designer/DesignerAssetCard.tsx` (243 lines)

Fixes:
- Image aspect ratio maintained on all sizes
- Design notes section: text truncation on mobile, expandable
- Action buttons: `flex-wrap` if needed
- Padding: `p-3 md:p-4`

### 2F: Edit Chat Panel

**File:** `src/components/designer/EditChat.tsx` (202 lines)

Fixes:
- Full-width when stacked on mobile
- Quick action buttons: `grid-cols-3` on mobile (currently 6 in a row may overflow)
- Message bubbles: max-width responsive
- Input area: proper bottom spacing on mobile (avoid keyboard overlap)

### 2G: Download Kit

**File:** `src/components/designer/DownloadKit.tsx` (100 lines)

Fixes:
- Button grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (currently 6 in a row overflows on mobile)
- Button text: truncate or shrink on mobile

### 2H: Campaign Context Card

**File:** `src/components/designer/CampaignContextCard.tsx` (150 lines)

Fixes:
- Info grid: `grid-cols-1 sm:grid-cols-2` (personas, tone, style, do-not, cultural notes)
- Pill tags: `flex-wrap`
- Collapsible on mobile (optional — only if the card is too tall)

---

## Files Summary

| File | Change Type |
|------|------------|
| `src/app/api/designer/[id]/submit-finals/route.ts` | **Create** — Submit finals endpoint |
| `src/app/api/designer/edit/route.ts` | **Delete** — Dead code |
| `src/components/designer/UploadZone.tsx` | Wire Submit Finals + responsive |
| `src/app/designer/[id]/page.tsx` | Responsive polish |
| `src/components/designer/SeedreamEditor.tsx` | Responsive three-panel → stacked |
| `src/components/designer/AssetBrowser.tsx` | Responsive grid |
| `src/components/designer/DesignerCampaignList.tsx` | Responsive grid + hamburger |
| `src/components/designer/DesignerAssetCard.tsx` | Mobile padding |
| `src/components/designer/EditChat.tsx` | Full-width on mobile |
| `src/components/designer/DownloadKit.tsx` | Flex-wrap buttons |
| `src/components/designer/CampaignContextCard.tsx` | Responsive grid |

## What's NOT Changing

- Magic link authentication flow (works fine)
- Seedream API integration (works fine)
- Asset replacement workflow (works fine)
- Per-asset notes system (works fine)
- Version compare slider (works fine)
- Platform preview mockups (works fine)
- No new database tables or migrations
