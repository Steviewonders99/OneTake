# Marketing View Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake-save creative editor modal with a full-viewport side panel that actually persists edits to Neon, and make all ad messaging text fields editable with autosave.

**Architecture:** New PATCH `/api/assets/[id]` endpoint for JSONB partial updates. `useAutosave` hook wraps debounced PATCH calls. `CreativeSidePanel` replaces `CreativeEditorModal` as a 60/40 slide-over. Ad Messaging section in PersonaSection gets EditableField components wired to autosave.

**Tech Stack:** Next.js 16 (React, TypeScript), Neon Postgres (JSONB merge via `||`), Tailwind CSS 4, Tiptap (EditableField), Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-11-marketing-view-overhaul-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|----------------|
| `src/hooks/useAutosave.ts` | Debounced autosave hook — PATCH to `/api/assets/[id]` |
| `src/components/AutosaveStatus.tsx` | Inline save status indicator (green/amber/red dot) |
| `src/components/creative-gallery/CreativeSidePanel.tsx` | Full-viewport slide-over creative editor |
| `src/lib/db/update-asset.ts` | DB function for JSONB partial update |

### Modified Files
| File | Change |
|------|--------|
| `src/app/api/assets/[id]/route.ts` | Add PATCH handler alongside existing DELETE |
| `src/components/creative-gallery/ChannelCreativeGallery.tsx` | Add selectedVersion state, render CreativeSidePanel |
| `src/components/CampaignWorkspace.tsx` | Remove CreativeEditorModal, make Ad Messaging editable |

---

## Parallelization Guide

```
Group A (independent):
  Task 1: DB update function + PATCH API endpoint
  Task 2: useAutosave hook
  Task 3: AutosaveStatus component

Group B (depends on Group A):
  Task 4: CreativeSidePanel component

Group C (depends on Group B):
  Task 5: ChannelCreativeGallery + CampaignWorkspace integration

Group D (depends on Tasks 2, 3):
  Task 6: Editable Ad Messaging
```

---

### Task 1: PATCH API Endpoint + DB Function

**Files:**
- Create: `src/lib/db/update-asset.ts`
- Modify: `src/app/api/assets/[id]/route.ts`

- [ ] **Step 1: Create the DB update function**

Create `src/lib/db/update-asset.ts`:

```typescript
import { getDb } from "../db";

/**
 * Partially update an asset's content and/or copy_data JSONB fields.
 * Uses Postgres || operator for shallow merge (preserves existing keys).
 */
export async function updateAssetFields(
  id: string,
  updates: {
    content?: Record<string, unknown>;
    copy_data?: Record<string, unknown>;
  },
): Promise<{ id: string; content: Record<string, unknown>; copy_data: Record<string, unknown> } | null> {
  const sql = getDb();

  const contentJson = updates.content ? JSON.stringify(updates.content) : null;
  const copyDataJson = updates.copy_data ? JSON.stringify(updates.copy_data) : null;

  const rows = await sql`
    UPDATE generated_assets
    SET
      content = CASE
        WHEN ${contentJson}::jsonb IS NOT NULL
        THEN COALESCE(content, '{}'::jsonb) || ${contentJson}::jsonb
        ELSE content
      END,
      copy_data = CASE
        WHEN ${copyDataJson}::jsonb IS NOT NULL
        THEN COALESCE(copy_data, '{}'::jsonb) || ${copyDataJson}::jsonb
        ELSE copy_data
      END
    WHERE id = ${id}
    RETURNING id, content, copy_data
  `;

  if (rows.length === 0) return null;
  return rows[0] as { id: string; content: Record<string, unknown>; copy_data: Record<string, unknown> };
}
```

- [ ] **Step 2: Add PATCH handler to the existing asset route**

Read `src/app/api/assets/[id]/route.ts` and add a PATCH export alongside the existing DELETE. The file currently imports `getAuthContext` from `@/lib/permissions` and `deleteAsset` from `@/lib/db/assets`.

Add this import at the top:
```typescript
import { updateAssetFields } from '@/lib/db/update-asset';
```

Add this PATCH handler after the DELETE export:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'admin' && ctx.role !== 'designer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const { content, copy_data } = body as {
      content?: Record<string, unknown>;
      copy_data?: Record<string, unknown>;
    };

    if (!content && !copy_data) {
      return Response.json({ error: 'No update fields provided' }, { status: 400 });
    }

    const result = await updateAssetFields(id, { content, copy_data });

    if (!result) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[api/assets/[id]] PATCH failed:', error);
    return Response.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/update-asset.ts src/app/api/assets/\[id\]/route.ts
git commit -m "feat(api): add PATCH /api/assets/[id] for content + copy_data JSONB partial updates"
```

---

### Task 2: useAutosave Hook

**Files:**
- Create: `src/hooks/useAutosave.ts`

- [ ] **Step 1: Create the useAutosave hook**

Create `src/hooks/useAutosave.ts`:

```typescript
"use client";

import { useRef, useState, useCallback } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave hook for asset field updates.
 *
 * Usage:
 *   const { save, status } = useAutosave(assetId, "content", "overlay_headline");
 *   <EditableField onSave={save} />
 *   <AutosaveStatus status={status} />
 */
export function useAutosave(
  assetId: string,
  field: "content" | "copy_data",
  key: string,
  debounceMs: number = 800,
): {
  save: (value: string) => void;
  status: AutosaveStatus;
} {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (value: string) => {
      // Clear any pending debounce
      if (timerRef.current) clearTimeout(timerRef.current);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);

      timerRef.current = setTimeout(async () => {
        setStatus("saving");

        try {
          const res = await fetch(`/api/assets/${assetId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: { [key]: value } }),
          });

          if (!res.ok) {
            setStatus("error");
            return;
          }

          setStatus("saved");
          // Revert to idle after 2 seconds
          revertTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
        } catch {
          setStatus("error");
        }
      }, debounceMs);
    },
    [assetId, field, key, debounceMs],
  );

  return { save, status };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/hooks/useAutosave.ts 2>&1 | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAutosave.ts
git commit -m "feat(hooks): add useAutosave — debounced PATCH for asset field updates"
```

---

### Task 3: AutosaveStatus Component

**Files:**
- Create: `src/components/AutosaveStatus.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AutosaveStatus.tsx`:

```tsx
"use client";

import type { AutosaveStatus as Status } from "@/hooks/useAutosave";

const STATUS_CONFIG: Record<Status, { dot: string; text: string; label: string }> = {
  idle: { dot: "bg-transparent", text: "text-transparent", label: "" },
  saving: { dot: "bg-[#d97706]", text: "text-[#d97706]", label: "Saving..." },
  saved: { dot: "bg-[#16a34a]", text: "text-[#16a34a]", label: "All changes saved" },
  error: { dot: "bg-[#dc2626]", text: "text-[#dc2626]", label: "Save failed — click to retry" },
};

interface AutosaveStatusProps {
  status: Status;
  onRetry?: () => void;
}

export default function AutosaveStatus({ status, onRetry }: AutosaveStatusProps) {
  if (status === "idle") return null;

  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`flex items-center gap-1.5 ${status === "error" ? "cursor-pointer" : ""}`}
      onClick={status === "error" ? onRetry : undefined}
    >
      <div className={`w-[7px] h-[7px] rounded-full ${config.dot}`} />
      <span className={`text-[11px] font-medium ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AutosaveStatus.tsx
git commit -m "feat(ui): add AutosaveStatus indicator — green/amber/red dot with labels"
```

---

### Task 4: CreativeSidePanel Component

**Files:**
- Create: `src/components/creative-gallery/CreativeSidePanel.tsx`

**Depends on:** Tasks 1, 2, 3

- [ ] **Step 1: Create the CreativeSidePanel component**

Create `src/components/creative-gallery/CreativeSidePanel.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, Type, Download, Pencil, Trash2, Sparkles } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { VersionGroup, ChannelDef } from "@/lib/channels";
import { ARCHETYPE_LABELS, getThumbnailDimensions } from "@/lib/channels";
import { getPlatformMeta } from "@/lib/platforms";
import EditableField from "@/components/EditableField";
import AutosaveStatus from "@/components/AutosaveStatus";
import { useAutosave } from "@/hooks/useAutosave";

interface CreativeSidePanelProps {
  version: VersionGroup;
  channelDef: ChannelDef;
  initialAsset: GeneratedAsset;
  onClose: () => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  onEditHtml?: (asset: GeneratedAsset) => void;
}

function FormatSwitcherThumb({
  asset,
  format,
  isActive,
  onClick,
}: {
  asset: GeneratedAsset;
  format: { label: string; width: number; height: number };
  isActive: boolean;
  onClick: () => void;
}) {
  const dims = getThumbnailDimensions(
    { key: "", label: format.label, ratio: "", width: format.width, height: format.height },
    44,
  );
  return (
    <div className="text-center cursor-pointer" onClick={onClick}>
      <div
        className="rounded-lg overflow-hidden transition-all"
        style={{
          width: `${dims.width}px`,
          height: `${dims.height}px`,
          border: isActive ? "2px solid #6B21A8" : "1px solid rgba(255,255,255,0.2)",
          boxShadow: isActive ? "0 0 12px rgba(107,33,168,0.3)" : "none",
          opacity: isActive ? 1 : 0.5,
        }}
      >
        {asset.blob_url ? (
          <img src={asset.blob_url} alt={format.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #3D1059, #6B21A8)" }} />
        )}
      </div>
      <div className={`text-[9px] mt-1 ${isActive ? "text-[#6B21A8] font-semibold" : "text-white/50"}`}>
        {format.label}
      </div>
    </div>
  );
}

function SidePanelEditFields({ asset }: { asset: GeneratedAsset }) {
  const content = (asset.content || {}) as Record<string, string>;
  const copyData = (asset.copy_data || content.copy_data || {}) as Record<string, string>;

  const headlineSave = useAutosave(asset.id, "content", "overlay_headline");
  const subSave = useAutosave(asset.id, "content", "overlay_sub");
  const ctaSave = useAutosave(asset.id, "content", "overlay_cta");
  const primaryTextSave = useAutosave(asset.id, "copy_data", "primary_text");
  const adHeadlineSave = useAutosave(asset.id, "copy_data", "headline");
  const descSave = useAutosave(asset.id, "copy_data", "description");

  // Aggregate status: show worst status across all fields
  const allStatuses = [
    headlineSave.status, subSave.status, ctaSave.status,
    primaryTextSave.status, adHeadlineSave.status, descSave.status,
  ];
  const aggregateStatus = allStatuses.includes("error")
    ? "error" as const
    : allStatuses.includes("saving")
    ? "saving" as const
    : allStatuses.includes("saved")
    ? "saved" as const
    : "idle" as const;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      {/* Overlay Text Section */}
      <div className="text-[10px] font-bold text-[#6B21A8] uppercase tracking-[1px]">
        Overlay Text
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Headline
        </label>
        <EditableField
          value={content.overlay_headline || copyData.headline || ""}
          editable
          onSave={headlineSave.save}
          textClassName="text-[14px] font-semibold text-[#1A1A1A]"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Subheadline
        </label>
        <EditableField
          value={content.overlay_sub || copyData.description || ""}
          editable
          onSave={subSave.save}
          textClassName="text-[13px] text-[#737373] leading-relaxed"
          multiline
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          CTA Button
        </label>
        <EditableField
          value={content.overlay_cta || copyData.cta || "Apply Now"}
          editable
          onSave={ctaSave.save}
          textClassName="text-[13px] font-medium text-[#6B21A8]"
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-[#f0f0f0] my-1" />

      {/* Platform Ad Copy Section */}
      <div className="text-[10px] font-bold text-[#6B21A8] uppercase tracking-[1px]">
        Platform Ad Copy
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Primary Text
        </label>
        <EditableField
          value={copyData.primary_text || copyData.introductory_text || copyData.message_text || ""}
          editable
          onSave={primaryTextSave.save}
          textClassName="text-[13px] text-[#1A1A1A] leading-relaxed"
          multiline
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Ad Headline
        </label>
        <EditableField
          value={copyData.headline || copyData.card_headline || ""}
          editable
          onSave={adHeadlineSave.save}
          textClassName="text-[13px] text-[#1A1A1A]"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Description
        </label>
        <EditableField
          value={copyData.description || copyData.card_description || ""}
          editable
          onSave={descSave.save}
          textClassName="text-[13px] text-[#737373]"
        />
      </div>

      {/* Autosave indicator */}
      <div className="pt-1">
        <AutosaveStatus status={aggregateStatus} />
      </div>
    </div>
  );
}

export default function CreativeSidePanel({
  version,
  channelDef,
  initialAsset,
  onClose,
  onRefine,
  onDelete,
  onEditHtml,
}: CreativeSidePanelProps) {
  const [activeAsset, setActiveAsset] = useState<GeneratedAsset>(initialAsset);
  const [isClosing, setIsClosing] = useState(false);

  const content = (activeAsset.content || {}) as Record<string, string>;
  const meta = getPlatformMeta(activeAsset.platform);
  const score = activeAsset.evaluation_score || 0;
  const archetypeLabel = ARCHETYPE_LABELS[version.archetype] || version.archetype;

  // Match assets to formats for the switcher
  const formatAssets: Array<{ asset: GeneratedAsset; format: typeof channelDef.formats[0] }> = [];
  for (const format of channelDef.formats) {
    const match = version.assets.find((a) => {
      const p = a.platform;
      if (format.key === "feed" && (p.includes("_feed") || p === "wechat_moments")) return true;
      if (format.key === "story" && (p.includes("_story") || p.includes("_stories") || p === "whatsapp_story")) return true;
      if (format.key === "carousel" && p.includes("_carousel")) return true;
      if (format.key === "card" && p.includes("_card")) return true;
      if (format.key === "post" && p.includes("_post")) return true;
      if (format.key === "display" && p.includes("_display")) return true;
      if (format.key === "banner" && p.includes("_banner")) return true;
      if (format.key === "moments" && p === "wechat_moments") return true;
      if (format.key === "channels" && p === "wechat_channels") return true;
      if (format.key.startsWith("carousel_") && p.includes("_carousel")) return true;
      return false;
    });
    if (match) formatAssets.push({ asset: match, format });
  }

  // Close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        style={{ background: "rgba(0,0,0,0.3)" }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative ml-auto w-full h-full flex transition-transform duration-200 ease-out ${
          isClosing ? "translate-x-full" : "translate-x-0"
        }`}
      >
        {/* LEFT: Dark Preview */}
        <div className="flex-[6] bg-[#0a0a0a] flex flex-col relative">
          {/* Top bar */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs cursor-pointer hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <div className="h-5 w-px bg-white/15" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6B21A8] to-[#E91E8C] flex items-center justify-center text-white font-extrabold text-[9px]">
                  {version.versionLabel}
                </div>
                <span className="text-white/60 text-xs">
                  {version.actorName} &middot; {archetypeLabel} &middot; {version.pillar.charAt(0).toUpperCase() + version.pillar.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {score > 0 && (
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${
                  score >= 0.85 ? "bg-green-500/15 text-green-400" : score >= 0.7 ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"
                }`}>
                  {score.toFixed(2)} VQA
                </span>
              )}
              <button
                onClick={handleClose}
                className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex items-center justify-center p-6">
            {activeAsset.blob_url ? (
              <img
                src={activeAsset.blob_url}
                alt=""
                className="max-w-full max-h-full rounded-2xl object-contain"
                style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }}
              />
            ) : (
              <div
                className="w-[280px] h-[280px] rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #3D1059, #6B21A8, #E91E8C)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
                }}
              >
                <span className="text-white/50 text-sm">No preview</span>
              </div>
            )}
          </div>

          {/* Format switcher */}
          {formatAssets.length > 1 && (
            <div className="px-5 pb-5 flex items-center justify-center gap-3">
              {formatAssets.map(({ asset, format }) => (
                <FormatSwitcherThumb
                  key={format.key}
                  asset={asset}
                  format={format}
                  isActive={asset.id === activeAsset.id}
                  onClick={() => setActiveAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Edit Panel */}
        <div className="flex-[4] bg-white border-l border-[#E5E5E5] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#f0f0f0]">
            <div className="text-sm font-bold text-[#1A1A1A]">Edit Creative</div>
            <div className="text-[11px] text-[#999] mt-0.5">
              {meta.label} &middot; {activeAsset.format}
            </div>
          </div>

          {/* Edit fields — key on asset ID so hooks reinitialize on format switch */}
          <SidePanelEditFields key={activeAsset.id} asset={activeAsset} />

          {/* Action bar */}
          <div className="px-6 py-3.5 border-t border-[#f0f0f0] flex gap-2 flex-wrap">
            {onEditHtml && (content.creative_html || content.html) && (
              <button
                onClick={() => { onEditHtml(activeAsset); handleClose(); }}
                className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Type size={13} /> Edit HTML
              </button>
            )}
            <button
              onClick={() => {
                window.open(`/api/export/figma/${activeAsset.id}`, "_blank");
              }}
              className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer"
            >
              Export Figma
            </button>
            {activeAsset.blob_url && (
              <button
                onClick={() => window.open(activeAsset.blob_url!, "_blank")}
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Download size={13} /> Download
              </button>
            )}
            {onRefine && (
              <button
                onClick={() => { onRefine(activeAsset); handleClose(); }}
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={13} /> Regenerate
              </button>
            )}
            <div className="flex-1" />
            {onDelete && (
              <button
                onClick={() => { onDelete(activeAsset); handleClose(); }}
                className="text-[11px] px-4 py-1.5 rounded-full border border-red-200 text-red-600 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/creative-gallery/CreativeSidePanel.tsx
git commit -m "feat(gallery): add CreativeSidePanel — full-viewport slide-over with autosave edit fields"
```

---

### Task 5: Wire Side Panel into Gallery + Remove Modal

**Files:**
- Modify: `src/components/creative-gallery/ChannelCreativeGallery.tsx`
- Modify: `src/components/CampaignWorkspace.tsx`

**Depends on:** Task 4

- [ ] **Step 1: Update ChannelCreativeGallery to manage side panel state**

Read `src/components/creative-gallery/ChannelCreativeGallery.tsx`. Replace its contents with:

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import type { GeneratedAsset } from "@/lib/types";
import {
  getActiveChannels,
  groupCreativesByVersion,
  CHANNEL_DEFINITIONS,
  type VersionGroup,
} from "@/lib/channels";
import ChannelTabBar from "./ChannelTabBar";
import VersionCard from "./VersionCard";
import CreativeSidePanel from "./CreativeSidePanel";

interface ChannelCreativeGalleryProps {
  assets: GeneratedAsset[];
  onAssetClick?: (asset: GeneratedAsset) => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  onEditHtml?: (asset: GeneratedAsset) => void;
}

export default function ChannelCreativeGallery({
  assets,
  onRefine,
  onDelete,
  onEditHtml,
}: ChannelCreativeGalleryProps) {
  const activeChannels = useMemo(() => getActiveChannels(assets), [assets]);

  const [activeChannel, setActiveChannel] = useState<string>(
    activeChannels[0] || "",
  );
  const [selectedVersion, setSelectedVersion] = useState<{
    version: VersionGroup;
    initialAsset: GeneratedAsset;
  } | null>(null);

  const resolvedChannel = activeChannels.includes(activeChannel)
    ? activeChannel
    : activeChannels[0] || "";

  const versions = useMemo(
    () => resolvedChannel ? groupCreativesByVersion(assets, resolvedChannel) : [],
    [assets, resolvedChannel],
  );

  const channelDef = CHANNEL_DEFINITIONS[resolvedChannel];

  // When a thumbnail is clicked, find its version and open side panel
  const handleAssetClick = useCallback(
    (asset: GeneratedAsset) => {
      const version = versions.find((v) =>
        v.assets.some((a) => a.id === asset.id),
      );
      if (version) {
        setSelectedVersion({ version, initialAsset: asset });
      }
    },
    [versions],
  );

  if (activeChannels.length === 0) {
    return (
      <div className="text-center py-12 text-[#999] text-sm">
        No composed creatives yet. Run the pipeline to generate creatives.
      </div>
    );
  }

  return (
    <div>
      <ChannelTabBar
        channels={activeChannels}
        activeChannel={resolvedChannel}
        onChannelChange={(ch) => setActiveChannel(ch)}
      />

      {versions.length === 0 ? (
        <div className="text-center py-8 text-[#999] text-sm">
          No creatives for {resolvedChannel} yet.
        </div>
      ) : (
        <div>
          {versions.map((version) => (
            <VersionCard
              key={version.versionLabel}
              version={version}
              channelDef={channelDef}
              onAssetClick={handleAssetClick}
            />
          ))}
        </div>
      )}

      {/* Side Panel */}
      {selectedVersion && (
        <CreativeSidePanel
          version={selectedVersion.version}
          channelDef={channelDef}
          initialAsset={selectedVersion.initialAsset}
          onClose={() => setSelectedVersion(null)}
          onRefine={onRefine}
          onDelete={(asset) => {
            onDelete?.(asset);
            setSelectedVersion(null);
          }}
          onEditHtml={onEditHtml}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update CampaignWorkspace — pass callbacks and remove modal**

Read `src/components/CampaignWorkspace.tsx`. Make these changes:

1. **Find where `ChannelCreativeGallery` is rendered** inside PersonaSection. It currently looks like:
   ```tsx
   <ChannelCreativeGallery
     assets={group.assets}
     onAssetClick={onAssetClick}
   />
   ```
   Replace with:
   ```tsx
   <ChannelCreativeGallery
     assets={group.assets}
     onRefine={onRefine}
     onDelete={onDelete}
     onEditHtml={(asset) => {
       setHtmlEditorAsset(asset);
     }}
   />
   ```
   Note: `setHtmlEditorAsset` is available in the parent CampaignWorkspace component. If `PersonaSection` doesn't have access, you'll need to pass it down as a prop. Read the code to determine the right approach — the parent `CampaignWorkspace` has `htmlEditorAsset` state at line ~790. Pass an `onEditHtml` callback through PersonaSection's props.

2. **Remove the CreativeEditorModal** component definition (lines ~234-385) and its rendering (lines ~1123-1131).

3. **Remove `selectedAsset` state** (line ~789) — no longer needed since side panel manages its own state.

4. **Remove `onAssetClick={setSelectedAsset}` prop** from PersonaSection invocations — no longer needed.

5. **Add `onEditHtml` to PersonaSection's props interface** so the gallery can open the HTML editor.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

Fix any errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/creative-gallery/ChannelCreativeGallery.tsx src/components/CampaignWorkspace.tsx
git commit -m "feat(gallery): wire CreativeSidePanel, remove CreativeEditorModal, pass callbacks through gallery"
```

---

### Task 6: Editable Ad Messaging Cards

**Files:**
- Modify: `src/components/CampaignWorkspace.tsx`

**Depends on:** Tasks 2, 3

- [ ] **Step 1: Read the current Ad Messaging section**

Read `src/components/CampaignWorkspace.tsx` and find the Ad Messaging section inside PersonaSection. It's the IIFE block `{(() => { ... })()}` that filters `copyAssets` and renders platform cards with read-only text.

- [ ] **Step 2: Add imports**

At the top of CampaignWorkspace.tsx, add:

```typescript
import { useAutosave } from "@/hooks/useAutosave";
import AutosaveStatus from "@/components/AutosaveStatus";
```

- [ ] **Step 3: Create an editable copy card component**

Inside CampaignWorkspace.tsx (before PersonaSection), add a small helper component:

```tsx
function EditableCopyCard({ asset }: { asset: GeneratedAsset }) {
  const content = (asset.content || {}) as Record<string, any>;
  const cd = content.copy_data || {};
  const angle = content.copy_angle || "";

  // Resolve platform-specific field names
  const headlineKey = cd.tweet_text ? "tweet_text" : cd.card_headline ? "card_headline" : "headline";
  const bodyKey = cd.introductory_text ? "introductory_text" : cd.message_text ? "message_text" : "primary_text";
  const descKey = cd.card_description ? "card_description" : "description";
  const ctaKey = cd.cta_button ? "cta_button" : cd.button_text ? "button_text" : "cta";

  const headlineSave = useAutosave(asset.id, "copy_data", headlineKey);
  const bodySave = useAutosave(asset.id, "copy_data", bodyKey);
  const descSave = useAutosave(asset.id, "copy_data", descKey);
  const ctaSave = useAutosave(asset.id, "copy_data", ctaKey);

  const headline = cd[headlineKey] || "";
  const body = cd[bodyKey] || "";
  const description = cd[descKey] || "";
  const cta = cd[ctaKey] || "";

  if (!headline && !body) return null;

  const allStatuses = [headlineSave.status, bodySave.status, descSave.status, ctaSave.status];
  const aggregateStatus = allStatuses.includes("error")
    ? "error" as const
    : allStatuses.includes("saving")
    ? "saving" as const
    : allStatuses.includes("saved")
    ? "saved" as const
    : "idle" as const;

  return (
    <div className="px-3 py-2.5 space-y-2">
      {angle && (
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700 capitalize inline-block">
          {angle.replace(/^(primary_|secondary_)/, "").replace(/_/g, " ")}
        </span>
      )}
      {headline && (
        <EditableField
          value={headline}
          editable
          onSave={headlineSave.save}
          textClassName="text-[13px] font-bold text-[var(--foreground)] leading-snug"
        />
      )}
      {body && (
        <EditableField
          value={body}
          editable
          onSave={bodySave.save}
          textClassName="text-[12px] text-[var(--muted-foreground)] leading-relaxed"
          multiline
        />
      )}
      {description && (
        <EditableField
          value={description}
          editable
          onSave={descSave.save}
          textClassName="text-[12px] text-[var(--muted-foreground)]"
        />
      )}
      {cta && (
        <EditableField
          value={cta}
          editable
          onSave={ctaSave.save}
          textClassName="text-[11px] font-semibold text-[#6B21A8]"
        />
      )}
      <AutosaveStatus status={aggregateStatus} />
    </div>
  );
}
```

- [ ] **Step 4: Replace the read-only copy rendering with EditableCopyCard**

In the Ad Messaging section's inner loop (where each copy asset is rendered), replace the read-only `<div>` block with:

```tsx
<EditableCopyCard key={asset.id} asset={asset} />
```

The current code looks something like:
```tsx
{assets.map((asset: any) => {
  const content = ...;
  const cd = ...;
  // ... field extraction ...
  return (
    <div key={asset.id} className="px-3 py-2.5 space-y-1">
      {/* read-only headline, primaryText, cta */}
    </div>
  );
})}
```

Replace the entire `assets.map(...)` callback body with:
```tsx
{assets.map((asset: any) => (
  <EditableCopyCard key={asset.id} asset={asset} />
))}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add src/components/CampaignWorkspace.tsx
git commit -m "feat(messaging): make all ad messaging fields editable with autosave to Neon"
```

---

### Task 7: Verification

**Files:** None (verification only)

**Depends on:** All previous tasks

- [ ] **Step 1: Verify all new files exist**

```bash
ls -la src/hooks/useAutosave.ts src/components/AutosaveStatus.tsx src/components/creative-gallery/CreativeSidePanel.tsx src/lib/db/update-asset.ts
```

Expected: 4 files.

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 0 new errors.

- [ ] **Step 3: Test PATCH API endpoint**

```bash
# Find an asset ID to test with
curl -s http://localhost:3000/api/generate/$(curl -s 'http://localhost:3000/api/intake' | head -1 | grep -o '[a-f0-9-]\{36\}')/images | head -5
```

Then test the PATCH:
```bash
curl -X PATCH http://localhost:3000/api/assets/{ASSET_ID} \
  -H "Content-Type: application/json" \
  -d '{"content":{"overlay_headline":"Test Edit"}}'
```

Expected: 200 with updated content.

- [ ] **Step 4: Visual verification in browser**

Navigate to a campaign detail page. Verify:
1. Click a format thumbnail in a version card → side panel slides in from right
2. Panel shows dark preview (left) + edit fields (right)
3. Edit a headline → amber "Saving..." → green "All changes saved"
4. Reload page → headline persists
5. Format switcher at bottom → click Story → preview updates
6. Escape key or Back button closes panel
7. In Ad Messaging section → click any headline → inline edit appears
8. Edit and save → persists on reload
9. CreativeEditorModal is gone — no centered modal appears

- [ ] **Step 5: Commit any fixups**

If any issues found during verification, fix and commit.
