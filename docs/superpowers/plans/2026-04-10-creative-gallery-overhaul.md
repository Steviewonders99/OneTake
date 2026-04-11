# Creative Gallery Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat creative grid inside CampaignWorkspace's PersonaSection with a structured hierarchy: Channel Tabs > Toggle Dropdown Version Cards > Format Thumbnails at true aspect ratios.

**Architecture:** New `src/lib/channels.ts` module defines channel-to-platform-to-format mapping and version grouping logic. Four new components (`ChannelCreativeGallery`, `ChannelTabBar`, `VersionCard`, `FormatThumbnail`) replace the creative grid inside PersonaSection. All existing behavior (modal, editor, export) preserved.

**Tech Stack:** Next.js 16 (React, TypeScript), Tailwind CSS 4, Lucide icons. No backend changes.

**Spec:** `docs/superpowers/specs/2026-04-10-creative-gallery-overhaul-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|----------------|
| `src/lib/channels.ts` | Channel definitions, format mapping, version grouping logic, active channel detection |
| `src/components/creative-gallery/ChannelCreativeGallery.tsx` | Top-level component: tab bar + version card list. Entry point for PersonaSection integration. |
| `src/components/creative-gallery/ChannelTabBar.tsx` | Horizontal channel tab bar with active state |
| `src/components/creative-gallery/VersionCard.tsx` | Toggle dropdown card: collapsed header + expanded format row |
| `src/components/creative-gallery/FormatThumbnail.tsx` | Single format preview at true aspect ratio with hover scale |

### Modified Files
| File | Change |
|------|--------|
| `src/components/CampaignWorkspace.tsx` | Replace creative grid in PersonaSection (lines ~723-862) with `<ChannelCreativeGallery>` |

---

## Parallelization Guide

```
Group A (independent — run in parallel):
  Task 1: Channel definitions module (src/lib/channels.ts)
  Task 3: FormatThumbnail component

Group B (depends on Task 1):
  Task 2: ChannelTabBar component

Group C (depends on Tasks 1, 3):
  Task 4: VersionCard component

Group D (depends on Tasks 2, 4):
  Task 5: ChannelCreativeGallery component

Group E (depends on Task 5):
  Task 6: CampaignWorkspace integration
```

---

### Task 1: Channel Definitions Module

**Files:**
- Create: `src/lib/channels.ts`

- [ ] **Step 1: Create the channel definitions module**

Create `src/lib/channels.ts`:

```typescript
/**
 * Channel definitions, format mapping, and version grouping logic
 * for the creative gallery. Maps platforms → channels → formats.
 */

import type { GeneratedAsset } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────

export interface FormatDef {
  key: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export interface ChannelDef {
  platforms: string[];
  formats: FormatDef[];
  color: string;
}

export interface VersionGroup {
  versionLabel: string;
  headline: string;
  archetype: string;
  pillar: string;
  actorName: string;
  avgVqaScore: number;
  formatCount: number;
  assets: GeneratedAsset[];
}

// ── Channel Definitions ────────────────────────────────────────

export const CHANNEL_DEFINITIONS: Record<string, ChannelDef> = {
  Meta: {
    platforms: [
      "ig_feed", "ig_story", "ig_carousel",
      "facebook_feed", "facebook_stories",
    ],
    formats: [
      { key: "feed", label: "Feed", ratio: "1:1", width: 1080, height: 1080 },
      { key: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "4:5", width: 1080, height: 1350 },
    ],
    color: "#E1306C",
  },
  LinkedIn: {
    platforms: ["linkedin_feed", "linkedin_carousel"],
    formats: [
      { key: "feed", label: "Feed", ratio: "1.91:1", width: 1200, height: 627 },
      { key: "carousel_square", label: "Carousel 1:1", ratio: "1:1", width: 1080, height: 1080 },
      { key: "carousel_portrait", label: "Carousel 4:5", ratio: "4:5", width: 1080, height: 1350 },
      { key: "carousel_landscape", label: "Carousel 1.91:1", ratio: "1.91:1", width: 1200, height: 627 },
    ],
    color: "#0A66C2",
  },
  TikTok: {
    platforms: ["tiktok_feed", "tiktok_carousel"],
    formats: [
      { key: "feed", label: "Feed", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "9:16", width: 1080, height: 1920 },
    ],
    color: "#000000",
  },
  Telegram: {
    platforms: ["telegram_card"],
    formats: [
      { key: "card", label: "Card", ratio: "16:9", width: 1280, height: 720 },
    ],
    color: "#229ED9",
  },
  WhatsApp: {
    platforms: ["whatsapp_story"],
    formats: [
      { key: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
    ],
    color: "#25D366",
  },
  "X / Twitter": {
    platforms: ["twitter_post"],
    formats: [
      { key: "post", label: "Post", ratio: "16:9", width: 1200, height: 675 },
    ],
    color: "#1DA1F2",
  },
  WeChat: {
    platforms: ["wechat_moments", "wechat_channels", "wechat_carousel"],
    formats: [
      { key: "moments", label: "Moments", ratio: "1:1", width: 1080, height: 1080 },
      { key: "channels", label: "Channels", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "1:1", width: 1080, height: 1080 },
    ],
    color: "#07C160",
  },
  Google: {
    platforms: ["google_display"],
    formats: [
      { key: "display", label: "Display", ratio: "1.91:1", width: 1200, height: 628 },
    ],
    color: "#4285F4",
  },
  Reddit: {
    platforms: ["reddit_post"],
    formats: [
      { key: "post", label: "Post", ratio: "16:9", width: 1200, height: 675 },
    ],
    color: "#FF4500",
  },
  Indeed: {
    platforms: ["indeed_banner"],
    formats: [
      { key: "banner", label: "Banner", ratio: "1.91:1", width: 1200, height: 628 },
    ],
    color: "#003A9B",
  },
};

export const CHANNEL_ORDER = [
  "Meta", "LinkedIn", "TikTok", "Telegram", "WhatsApp",
  "X / Twitter", "Reddit", "WeChat", "Google", "Indeed",
];

// ── Archetype Labels ───────────────────────────────────────────

export const ARCHETYPE_LABELS: Record<string, string> = {
  floating_props: "Floating Props",
  gradient_hero: "Gradient Hero",
  photo_feature: "Photo Feature",
};

// ── Functions ──────────────────────────────────────────────────

/**
 * Get channels that have at least one generated creative.
 * Returns channel names in CHANNEL_ORDER priority.
 */
export function getActiveChannels(assets: GeneratedAsset[]): string[] {
  const activePlatforms = new Set(
    assets
      .filter((a) => a.asset_type === "composed_creative" && a.blob_url)
      .map((a) => a.platform),
  );

  return CHANNEL_ORDER.filter((channelName) => {
    const def = CHANNEL_DEFINITIONS[channelName];
    return def && def.platforms.some((p) => activePlatforms.has(p));
  });
}

/**
 * Group a persona's creatives into version cards for a given channel.
 * Each version = unique (actor_name + pillar) combination.
 * Returns versions sorted by creation time, labeled V1, V2, V3...
 */
export function groupCreativesByVersion(
  assets: GeneratedAsset[],
  channelName: string,
): VersionGroup[] {
  const def = CHANNEL_DEFINITIONS[channelName];
  if (!def) return [];

  const platformSet = new Set(def.platforms);
  const channelAssets = assets.filter(
    (a) =>
      a.asset_type === "composed_creative" &&
      platformSet.has(a.platform),
  );

  if (channelAssets.length === 0) return [];

  // Group by (actor_name + pillar)
  const groups = new Map<string, GeneratedAsset[]>();
  for (const asset of channelAssets) {
    const content = (asset.content || {}) as Record<string, string>;
    const actor = content.actor_name || "unknown";
    const pillar = content.pillar || "earn";
    const key = `${actor}::${pillar}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(asset);
  }

  // Sort by earliest creation time, label V1, V2...
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => {
      const aTime = Math.min(
        ...a.map((x) => new Date(x.created_at).getTime()),
      );
      const bTime = Math.min(
        ...b.map((x) => new Date(x.created_at).getTime()),
      );
      return aTime - bTime;
    })
    .map(([, versionAssets], idx) => {
      const content = (versionAssets[0].content || {}) as Record<string, string>;
      const scores = versionAssets
        .map((a) => a.evaluation_score)
        .filter((s): s is number => s != null && s > 0);
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : 0;

      return {
        versionLabel: `V${idx + 1}`,
        headline:
          content.overlay_headline ||
          content.headline ||
          content.overlay_sub ||
          "Untitled",
        archetype: content.archetype || "",
        pillar: content.pillar || "earn",
        actorName: content.actor_name || "",
        avgVqaScore: avgScore,
        formatCount: new Set(versionAssets.map((a) => a.platform)).size,
        assets: versionAssets,
      };
    });
}

/**
 * Compute thumbnail dimensions at a fixed height baseline.
 * Returns {width, height} in pixels preserving the format's aspect ratio.
 */
export function getThumbnailDimensions(
  format: FormatDef,
  heightBaseline: number = 200,
): { width: number; height: number } {
  const ratio = format.width / format.height;
  return {
    width: Math.round(heightBaseline * ratio),
    height: heightBaseline,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/lib/channels.ts 2>&1 | head -10
```

Expected: No errors (or only pre-existing node_modules type issues).

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels.ts
git commit -m "feat(channels): add channel definitions, format mapping, and version grouping logic"
```

---

### Task 2: ChannelTabBar Component

**Files:**
- Create: `src/components/creative-gallery/ChannelTabBar.tsx`

**Depends on:** Task 1

- [ ] **Step 1: Create the ChannelTabBar component**

Create `src/components/creative-gallery/ChannelTabBar.tsx`:

```tsx
"use client";

import { CHANNEL_DEFINITIONS } from "@/lib/channels";

interface ChannelTabBarProps {
  channels: string[];
  activeChannel: string;
  onChannelChange: (channel: string) => void;
}

export default function ChannelTabBar({
  channels,
  activeChannel,
  onChannelChange,
}: ChannelTabBarProps) {
  return (
    <div className="flex gap-0.5 border-b-2 border-[#E5E5E5] mb-5">
      {channels.map((channel) => {
        const def = CHANNEL_DEFINITIONS[channel];
        const isActive = channel === activeChannel;
        return (
          <button
            key={channel}
            onClick={() => onChannelChange(channel)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium cursor-pointer transition-colors ${
              isActive
                ? "text-[#6B21A8] border-b-2 border-[#6B21A8] -mb-[2px]"
                : "text-[#999] hover:text-[#555]"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: def?.color || "#6B21A8" }}
            />
            {channel}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/components/creative-gallery/ChannelTabBar.tsx 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/creative-gallery/ChannelTabBar.tsx
git commit -m "feat(gallery): add ChannelTabBar component — horizontal channel tabs with active state"
```

---

### Task 3: FormatThumbnail Component

**Files:**
- Create: `src/components/creative-gallery/FormatThumbnail.tsx`

**Independent — no dependencies**

- [ ] **Step 1: Create the FormatThumbnail component**

Create `src/components/creative-gallery/FormatThumbnail.tsx`:

```tsx
"use client";

import type { GeneratedAsset } from "@/lib/types";

interface FormatThumbnailProps {
  asset: GeneratedAsset;
  formatLabel: string;
  width: number;
  height: number;
  dimensions: string;
  onClick: (asset: GeneratedAsset) => void;
}

export default function FormatThumbnail({
  asset,
  formatLabel,
  width,
  height,
  dimensions,
  onClick,
}: FormatThumbnailProps) {
  return (
    <div className="flex-shrink-0 text-center">
      <div
        className="rounded-xl overflow-hidden cursor-pointer transition-transform duration-150 hover:scale-[1.02]"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        }}
        onClick={() => onClick(asset)}
      >
        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={formatLabel}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, #3D1059 0%, #6B21A8 40%, #E91E8C 100%)",
            }}
          >
            <span className="text-white/50 text-xs">No preview</span>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs font-semibold text-[#1A1A1A]">
        {formatLabel}
      </div>
      <div className="text-[11px] text-[#999]">{dimensions}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/components/creative-gallery/FormatThumbnail.tsx 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/creative-gallery/FormatThumbnail.tsx
git commit -m "feat(gallery): add FormatThumbnail component — true aspect ratio preview with hover scale"
```

---

### Task 4: VersionCard Component

**Files:**
- Create: `src/components/creative-gallery/VersionCard.tsx`

**Depends on:** Tasks 1, 3

- [ ] **Step 1: Create the VersionCard component**

Create `src/components/creative-gallery/VersionCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { VersionGroup, ChannelDef } from "@/lib/channels";
import { ARCHETYPE_LABELS, getThumbnailDimensions } from "@/lib/channels";
import FormatThumbnail from "./FormatThumbnail";

interface VersionCardProps {
  version: VersionGroup;
  channelDef: ChannelDef;
  onAssetClick: (asset: GeneratedAsset) => void;
}

function getVqaColor(score: number): {
  bg: string;
  text: string;
} {
  if (score >= 0.85) return { bg: "#f0fdf4", text: "#16a34a" };
  if (score >= 0.7) return { bg: "#fefce8", text: "#d97706" };
  return { bg: "#fef2f2", text: "#dc2626" };
}

export default function VersionCard({
  version,
  channelDef,
  onAssetClick,
}: VersionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const vqaColor = getVqaColor(version.avgVqaScore);
  const archetypeLabel =
    ARCHETYPE_LABELS[version.archetype] || version.archetype || "";
  const pillarLabel =
    version.pillar.charAt(0).toUpperCase() + version.pillar.slice(1);

  // Match assets to format definitions for ordered display
  const formatAssets: Array<{
    asset: GeneratedAsset;
    format: (typeof channelDef.formats)[0];
  }> = [];

  for (const format of channelDef.formats) {
    // Find an asset matching this format's platform(s)
    const matchingAsset = version.assets.find((a) => {
      const p = a.platform;
      // Match by format key patterns
      if (format.key === "feed" && (p.includes("_feed") || p === "wechat_moments"))
        return true;
      if (format.key === "story" && (p.includes("_story") || p.includes("_stories") || p === "whatsapp_story"))
        return true;
      if (format.key === "carousel" && p.includes("_carousel"))
        return true;
      if (format.key === "card" && p.includes("_card"))
        return true;
      if (format.key === "post" && p.includes("_post"))
        return true;
      if (format.key === "display" && p.includes("_display"))
        return true;
      if (format.key === "banner" && p.includes("_banner"))
        return true;
      if (format.key === "moments" && p === "wechat_moments")
        return true;
      if (format.key === "channels" && p === "wechat_channels")
        return true;
      // LinkedIn carousel aspect ratio variants
      if (format.key.startsWith("carousel_") && p.includes("_carousel"))
        return true;
      return false;
    });
    if (matchingAsset) {
      formatAssets.push({ asset: matchingAsset, format });
    }
  }

  return (
    <div
      className="rounded-2xl bg-white overflow-hidden mb-3 transition-shadow"
      style={{
        border: expanded
          ? "1px solid #6B21A8"
          : "1px solid #E5E5E5",
        boxShadow: expanded
          ? "0 2px 12px rgba(107,33,168,0.08)"
          : "none",
      }}
    >
      {/* Collapsed header — always visible, clickable */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-extrabold text-sm"
            style={{
              background: `linear-gradient(135deg, #6B21A8, #E91E8C)`,
            }}
          >
            {version.versionLabel}
          </div>
          <div>
            <div className="text-[15px] font-semibold text-[#1A1A1A]">
              {version.headline}
            </div>
            <div className="text-xs text-[#999] mt-0.5">
              {archetypeLabel && `${archetypeLabel} · `}
              {pillarLabel} pillar · {version.formatCount} format
              {version.formatCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {version.avgVqaScore > 0 && (
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-[10px]"
              style={{
                background: vqaColor.bg,
                color: vqaColor.text,
              }}
            >
              {version.avgVqaScore.toFixed(2)} VQA
            </span>
          )}
          {expanded && (
            <>
              <button
                className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  // Export for Figma — open first asset's export URL
                  const firstAsset = version.assets[0];
                  if (firstAsset) {
                    window.open(
                      `/api/export/figma/${firstAsset.id}`,
                      "_blank",
                    );
                  }
                }}
              >
                Export for Figma
              </button>
              <button
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  // Download all — open export ZIP
                  const firstAsset = version.assets[0];
                  if (firstAsset) {
                    window.open(
                      `/api/export/${firstAsset.request_id}?type=composed`,
                      "_blank",
                    );
                  }
                }}
              >
                Download All
              </button>
            </>
          )}
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${
              expanded ? "rotate-180 text-[#6B21A8]" : "text-[#ccc]"
            }`}
          />
        </div>
      </div>

      {/* Expanded content — format thumbnails */}
      {expanded && (
        <div className="border-t border-[#f0f0f0] bg-[#fafafa] px-6 py-6">
          <div className="flex gap-6 items-end">
            {formatAssets.map(({ asset, format }) => {
              const dims = getThumbnailDimensions(format, 200);
              return (
                <FormatThumbnail
                  key={`${format.key}-${asset.id}`}
                  asset={asset}
                  formatLabel={format.label}
                  width={dims.width}
                  height={dims.height}
                  dimensions={`${format.width} × ${format.height}`}
                  onClick={onAssetClick}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/components/creative-gallery/VersionCard.tsx 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/creative-gallery/VersionCard.tsx
git commit -m "feat(gallery): add VersionCard component — toggle dropdown with VQA badge, format row, export actions"
```

---

### Task 5: ChannelCreativeGallery Component

**Files:**
- Create: `src/components/creative-gallery/ChannelCreativeGallery.tsx`

**Depends on:** Tasks 1, 2, 4

- [ ] **Step 1: Create the ChannelCreativeGallery component**

Create `src/components/creative-gallery/ChannelCreativeGallery.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import type { GeneratedAsset } from "@/lib/types";
import {
  getActiveChannels,
  groupCreativesByVersion,
  CHANNEL_DEFINITIONS,
} from "@/lib/channels";
import ChannelTabBar from "./ChannelTabBar";
import VersionCard from "./VersionCard";

interface ChannelCreativeGalleryProps {
  assets: GeneratedAsset[];
  onAssetClick: (asset: GeneratedAsset) => void;
}

export default function ChannelCreativeGallery({
  assets,
  onAssetClick,
}: ChannelCreativeGalleryProps) {
  const activeChannels = useMemo(
    () => getActiveChannels(assets),
    [assets],
  );

  const [activeChannel, setActiveChannel] = useState<string>(
    activeChannels[0] || "",
  );

  // Reset to first channel if active channel becomes unavailable
  const resolvedChannel = activeChannels.includes(activeChannel)
    ? activeChannel
    : activeChannels[0] || "";

  const versions = useMemo(
    () =>
      resolvedChannel
        ? groupCreativesByVersion(assets, resolvedChannel)
        : [],
    [assets, resolvedChannel],
  );

  const channelDef = CHANNEL_DEFINITIONS[resolvedChannel];

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
              onAssetClick={onAssetClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/components/creative-gallery/ChannelCreativeGallery.tsx 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/creative-gallery/ChannelCreativeGallery.tsx
git commit -m "feat(gallery): add ChannelCreativeGallery — tab bar + version card list orchestrator"
```

---

### Task 6: CampaignWorkspace Integration

**Files:**
- Modify: `src/components/CampaignWorkspace.tsx`

**Depends on:** Task 5

- [ ] **Step 1: Read CampaignWorkspace.tsx**

Read `src/components/CampaignWorkspace.tsx` in full. Locate:
1. The imports section (top of file)
2. The PersonaSection component — find the section that renders the creative grid (look for `channelGroups`, `activeChannel`, `activePlatform`, the channel buttons, and the creative thumbnails grid). This is approximately lines 700-867 but may have shifted.
3. Identify the exact boundaries of the code to replace.

- [ ] **Step 2: Add the import**

Add this import near the top of `src/components/CampaignWorkspace.tsx`, after the existing component imports:

```typescript
import ChannelCreativeGallery from "@/components/creative-gallery/ChannelCreativeGallery";
```

- [ ] **Step 3: Replace the creative grid in PersonaSection**

Inside the PersonaSection component, find the section that renders channel buttons and the creative grid. This includes:
- The `channelGroups` Map construction and the channel button row
- The `activeChannel` and `activePlatform` state variables
- The platform overview grid (representative creative per platform)
- The channel assets grid
- The platform assets grid + ad mockups

Replace ALL of that (the channel button row through the end of the creative display) with:

```tsx
{/* ── Creative Gallery (Channel > Version > Formats) ── */}
<ChannelCreativeGallery
  assets={group.assets}
  onAssetClick={onAssetClick}
/>
```

Also remove the now-unused state variables from PersonaSection:
- `activeChannel` state
- `activePlatform` state
- `channelGroups` computation
- `representativeByPlatform` computation

And remove any now-unused imports that were only used by the old creative grid (if any).

- [ ] **Step 4: Verify the app compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: No new errors in CampaignWorkspace.tsx. Fix any issues.

- [ ] **Step 5: Verify the dev server renders**

```bash
cd /Users/stevenjunop/centric-intake && npm run dev &
sleep 5 && curl -s http://localhost:3000 | head -5
```

Expected: HTML response (not a build error).

- [ ] **Step 6: Commit**

```bash
git add src/components/CampaignWorkspace.tsx
git commit -m "feat(gallery): integrate ChannelCreativeGallery into PersonaSection — replaces flat creative grid"
```

---

### Task 7: Verification

**Files:** None (verification only)

**Depends on:** All previous tasks

- [ ] **Step 1: Verify all new files exist**

```bash
ls -la src/lib/channels.ts src/components/creative-gallery/
```

Expected: 5 files (channels.ts + 4 components).

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 0 (or same count as before — no new errors).

- [ ] **Step 3: Verify dev server starts**

```bash
cd /Users/stevenjunop/centric-intake && npm run dev
```

Navigate to a campaign detail page in the browser. Verify:
- Channel tabs appear inside persona sections
- Clicking a tab shows version cards for that channel
- Version cards toggle open/closed on click
- Expanded cards show format thumbnails at true aspect ratios
- Clicking a thumbnail opens the CreativeEditorModal
- Multiple cards can be expanded simultaneously

- [ ] **Step 4: Commit verification success**

```bash
git add -A && git status
```

If clean, no commit needed. If any fixups were required, commit them.
