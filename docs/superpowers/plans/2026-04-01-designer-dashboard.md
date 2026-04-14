# Designer Dashboard Two-Panel Layout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the designer's card grid dashboard with a two-panel layout (campaign list sidebar + full workspace preview) giving authenticated designers persistent access to campaign context, assets, downloads, uploads, and notes — without needing magic links.

**Architecture:** Three-part implementation: (1) Update upload/notes API routes to accept Clerk auth as fallback alongside magic link tokens, (2) Create `DesignerPreviewPanel` component that fetches and displays all campaign data, (3) Rewrite the designer page to use a two-panel layout with the campaign list as a sidebar. Reuses all existing designer components (`CampaignContextCard`, `DownloadKit`, `DesignerAssetCard`, `UploadZone`, `PlatformPreviewWithCopy`).

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Lucide icons, Clerk auth, existing API endpoints

---

### Task 1: Update upload and notes API routes to accept Clerk auth

**Files:**
- Modify: `src/app/api/designer/[id]/upload/route.ts`
- Modify: `src/app/api/designer/[id]/notes/route.ts`

The upload and notes routes currently require a magic link token. For authenticated designers using the dashboard, we need these routes to also accept Clerk session auth as a fallback.

- [ ] **Step 1: Update upload route to accept either auth method**

In `src/app/api/designer/[id]/upload/route.ts`, replace the auth check block (lines 23-50) with dual-auth logic:

```typescript
    const formData = await request.formData();
    const token = formData.get('token') as string | null;
    const file = formData.get('file') as File | null;
    const originalAssetId = formData.get('original_asset_id') as string | null;

    // Auth: accept either magic link token OR Clerk session
    let authorized = false;

    if (token) {
      const magicLink = await validateMagicLink(token);
      if (magicLink && magicLink.request_id === id) {
        authorized = true;
      }
    }

    if (!authorized) {
      try {
        const { auth } = await import('@clerk/nextjs/server');
        const { userId } = await auth();
        if (userId) authorized = true;
      } catch {
        // Clerk auth not available
      }
    }

    if (!authorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
```

- [ ] **Step 2: Update notes POST route to accept either auth method**

In `src/app/api/designer/[id]/notes/route.ts`, replace the POST auth check (lines 19-44) with:

```typescript
    const { asset_id, note_text, token } = body;

    // Auth: accept either magic link token OR Clerk session
    let authorized = false;

    if (token) {
      const magicLink = await validateMagicLink(token);
      if (magicLink && magicLink.request_id === id) {
        authorized = true;
      }
    }

    if (!authorized) {
      try {
        const { auth } = await import('@clerk/nextjs/server');
        const { userId } = await auth();
        if (userId) authorized = true;
      } catch {}
    }

    if (!authorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
```

- [ ] **Step 3: Update notes GET route to accept either auth method**

In the GET handler of the same file, replace the auth check (lines 89-113) with:

```typescript
    const token = url.searchParams.get('token');

    // Auth: accept either magic link token OR Clerk session
    let authorized = false;

    if (token) {
      const magicLink = await validateMagicLink(token);
      if (magicLink && magicLink.request_id === id) {
        authorized = true;
      }
    }

    if (!authorized) {
      try {
        const { auth } = await import('@clerk/nextjs/server');
        const { userId } = await auth();
        if (userId) authorized = true;
      } catch {}
    }

    if (!authorized) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/designer/\[id\]/upload/route.ts src/app/api/designer/\[id\]/notes/route.ts
git commit -m "feat: designer upload/notes routes accept Clerk auth as fallback

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create DesignerPreviewPanel component

**Files:**
- Create: `src/components/designer/DesignerPreviewPanel.tsx`

- [ ] **Step 1: Create the DesignerPreviewPanel component**

This component fetches all data for a campaign and renders the full designer workspace. It reuses existing designer components but uses Clerk auth (no magic link token).

Write the file `src/components/designer/DesignerPreviewPanel.tsx`. The component should:

1. Accept `requestId: string` prop
2. Fetch on mount: `/api/intake/{id}`, `/api/generate/{id}/brief`, `/api/generate/{id}/images`
3. Render sections: Header (title, status, date), CampaignContextCard, DownloadKit (token=""), asset grid with tabs (Characters/Composed/All), UploadZone (token="" for Clerk auth fallback), and platform previews
4. Show loading skeleton while fetching, error state if fetch fails
5. Use `overflow-y-auto` for scrolling within the panel
6. `space-y-6` between sections, `px-6 md:px-8 py-6` padding

Key imports: `CampaignContextCard`, `DownloadKit`, `DesignerAssetCard`, `UploadZone`, `PlatformPreviewWithCopy`, `StatusBadge` from existing files. Types: `IntakeRequest`, `GeneratedAsset`, `CreativeBrief` from `@/lib/types`.

Asset tabs state: `"all" | "characters" | "composed"` — filter by `asset_type === "base_image"` for characters, `asset_type === "composed_creative"` for composed.

The UploadZone `onSubmitFinals` callback should show a toast ("Finals submitted from dashboard") and refetch data. Pass `token=""` since the API now accepts Clerk auth.

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/designer/DesignerPreviewPanel.tsx
git commit -m "feat: create DesignerPreviewPanel — full campaign workspace for dashboard

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add sidebar variant to DesignerCampaignList

**Files:**
- Modify: `src/components/designer/DesignerCampaignList.tsx`

- [ ] **Step 1: Add variant, selectedId, onSelect props**

Update the component to accept optional props and render differently in sidebar mode:

```typescript
interface DesignerCampaignListProps {
  variant?: "full" | "sidebar";
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function DesignerCampaignList({
  variant = "full",
  selectedId,
  onSelect,
}: DesignerCampaignListProps) {
```

Then update the `useRouter` to only be used in full mode (sidebar mode uses `onSelect` instead of navigation).

- [ ] **Step 2: Render sidebar variant**

When `variant === "sidebar"`:
- Remove outer padding (parent handles it) — use `flex flex-col h-full`
- Wrap content in a scrollable container
- Header: compact (just title + count, no subtitle)
- Search bar: full-width, smaller padding
- Cards: compact list items instead of grid — single column, `p-3` padding, `border-l-2` for selected highlight
- Click calls `onSelect(campaign.id)` instead of `router.push`
- Selected card: `border-l-2 border-[var(--foreground)] bg-[var(--muted)]`

When `variant === "full"`: render exactly as current (no changes to existing behavior).

- [ ] **Step 3: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/designer/DesignerCampaignList.tsx
git commit -m "feat: add sidebar variant to DesignerCampaignList

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite designer page with two-panel layout

**Files:**
- Modify: `src/app/designer/page.tsx`

- [ ] **Step 1: Rewrite designer page**

The page needs to be a client component now (for `selectedId` state). Replace the entire file:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DesignerCampaignList from "@/components/designer/DesignerCampaignList";
import DesignerPreviewPanel from "@/components/designer/DesignerPreviewPanel";

export default function DesignerPortal() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.role) setRole(data.role);
        if (data?.role && !["designer", "admin"].includes(data.role)) {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [router]);

  // Auto-select first campaign
  useEffect(() => {
    if (!selectedId) {
      fetch("/api/intake")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          const active = data.filter((c: any) => c.status !== "draft");
          if (active.length > 0) setSelectedId(active[0].id);
        })
        .catch(() => {});
    }
  }, [selectedId]);

  return (
    <AppShell>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
        {/* Left: Campaign list sidebar */}
        <div className="w-full lg:w-[340px] flex-shrink-0 lg:h-full h-auto max-h-[50vh] lg:max-h-none overflow-y-auto border-b lg:border-b-0 border-[var(--border)]">
          <DesignerCampaignList
            variant="sidebar"
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        {/* Right: Campaign preview */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white min-h-0">
          {selectedId ? (
            <DesignerPreviewPanel requestId={selectedId} />
          ) : (
            <div className="flex items-center justify-center h-full text-[#737373] text-sm">
              Select a campaign to preview
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/app/designer/page.tsx
git commit -m "feat: rewrite designer dashboard with two-panel layout

Two-panel campaign list + workspace preview, mirroring admin command center.
Auto-selects first campaign. Responsive stacking on mobile.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Deploy and verify

- [ ] **Step 1: Build and deploy**

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

- [ ] **Step 2: Verify designer dashboard**

Navigate to `/designer` as a designer user. Confirm:
- Two-panel layout: campaign list on left, workspace on right
- Auto-selects first campaign
- Campaign context card, download kit, asset grid, upload zone all render
- Clicking different campaigns switches the right panel
- Mobile: panels stack vertically
