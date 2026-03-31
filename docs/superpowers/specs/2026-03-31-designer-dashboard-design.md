# Designer Dashboard — Two-Panel Layout Spec

## Goal

Replace the simple card grid designer dashboard with a two-panel layout (campaign list + detail preview) that gives authenticated designers persistent access to everything currently behind magic links — campaign context, assets, downloads, uploads, and notes.

## Architecture

Rewrite `/designer/page.tsx` to use a two-panel layout mirroring the admin Marketing Command Center. Left panel: campaign list sidebar. Right panel: new `DesignerPreviewPanel` component showing the full campaign workspace. No new API routes — all data fetched from existing endpoints.

## Tech Stack

- Existing Next.js components, Tailwind CSS, Lucide icons
- Existing API endpoints: `/api/intake`, `/api/generate/[id]/brief`, `/api/generate/[id]/images`, `/api/generate/[id]/actors`
- Existing designer components: `CampaignContextCard`, `DownloadKit`, `UploadZone`, `DesignerAssetCard`, `PlatformPreviewWithCopy`
- No new database tables or API routes

---

## Component 1: Designer Dashboard Page

**File:** `src/app/designer/page.tsx` (rewrite)

Current: renders `DesignerCampaignList` as a full-page card grid.

New: two-panel layout:
- Left: `DesignerCampaignList` adapted as sidebar (340px, scrollable)
- Right: `DesignerPreviewPanel` (flex-1, scrollable)
- Auto-selects first campaign on load
- Mobile: stack vertically (`flex-col lg:flex-row`), campaign list at `max-h-[50vh]`

```
┌──────────────┬─────────────────────────────────────┐
│  Campaign    │  Campaign Context Card               │
│  List        │  Download Kit                         │
│  (340px)     │  Asset Grid (Characters / Composed)   │
│              │  Platform Previews                     │
│  [Search]    │  Upload Zone                          │
│  [Filters]   │  Notes                                │
│  [Cards...]  │                                       │
└──────────────┴─────────────────────────────────────┘
```

## Component 2: DesignerPreviewPanel

**File:** `src/components/designer/DesignerPreviewPanel.tsx` (new)

Fetches all data for a selected campaign and renders the workspace sections. This is the authenticated equivalent of `/designer/[id]/page.tsx` (magic link view) but:
- Uses Clerk auth, not magic link tokens
- Embedded in the dashboard as a panel, not a standalone page
- Same sections: context card, download kit, asset browser, upload zone

### Props
```typescript
interface DesignerPreviewPanelProps {
  requestId: string;
}
```

### Data Fetching
On mount (and when `requestId` changes):
1. `GET /api/intake/{id}` → request details
2. `GET /api/generate/{id}/brief` → creative brief
3. `GET /api/generate/{id}/images` → generated assets
4. `GET /api/generate/{id}/actors` → actor profiles

### Sections (top to bottom)

1. **Header** — campaign title, task type, status badge, date
2. **Campaign Context Card** — reuse existing `CampaignContextCard` component
3. **Download Kit** — reuse existing `DownloadKit` component (pass `token=""` since auth is Clerk-based, or adapt to work without token)
4. **Asset Grid** — tabs for Characters / Composed / All, using `DesignerAssetCard` for each asset
5. **Platform Previews** — reuse `PlatformPreviewWithCopy` for composed creatives
6. **Upload Zone** — reuse existing `UploadZone` component (needs adaptation for Clerk auth instead of magic link token)

### Layout Constraints
- `max-w-[1100px]` content within the panel (or full panel width, whichever fits)
- `overflow-y-auto` scrollable
- `px-6 md:px-8 py-6` padding
- Generous `space-y-6` between sections

## Component 3: DesignerCampaignList Sidebar Variant

**File:** `src/components/designer/DesignerCampaignList.tsx` (modify)

Add a `variant` prop: `"full"` (current card grid) or `"sidebar"` (compact list for two-panel layout).

When `variant="sidebar"`:
- No outer padding (parent handles it)
- Cards are compact list items (not grid cards)
- Click selects campaign (calls `onSelect` prop) instead of navigating
- Selected campaign has highlight border/background
- Search bar stays
- Status filter tabs stay (compact)

### New Props
```typescript
interface DesignerCampaignListProps {
  variant?: "full" | "sidebar";
  selectedId?: string;
  onSelect?: (id: string) => void;
}
```

## Adaptation: DownloadKit + UploadZone without Magic Link

Both `DownloadKit` and `UploadZone` currently require a `token` prop for magic link auth. For authenticated designers:
- `DownloadKit`: the export endpoint `/api/export/{id}` should also accept Clerk auth (it likely already does via middleware). Pass `token=""` or make token optional.
- `UploadZone`: the upload endpoint `/api/designer/{id}/upload` requires a token. Add fallback: if no token provided, use Clerk auth headers (the endpoint should check for either magic link OR Clerk session).

If the API routes already check Clerk auth as fallback, no backend changes needed. If not, update the upload and notes routes to accept either auth method.

---

## Files Summary

| File | Change |
|------|--------|
| `src/app/designer/page.tsx` | Rewrite — two-panel layout |
| `src/components/designer/DesignerPreviewPanel.tsx` | **Create** — campaign workspace panel |
| `src/components/designer/DesignerCampaignList.tsx` | Add sidebar variant mode |

## Files NOT Changed

- No new API routes
- No database changes
- Magic link flow (`/designer/[id]`) stays as-is for external designers
- Seedream editor (`/designer/editor`) stays as-is
- Designer sign-in page stays as-is
