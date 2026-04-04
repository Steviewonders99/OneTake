# Dashboard Command Center Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the marketing manager dashboard preview panel, sidebar, and channel matrix to eliminate dead space, fix image cropping, surface intel data, and promote the detail page CTA.

**Architecture:** Pure frontend changes across 4 existing files. No new files, no API changes, no database changes. All data is already available via the existing `/api/intake/[id]/progress` endpoint. The preview panel gets a structural overhaul (sticky header, segmented progress bar, intel strip), the sidebar gets breathing room, creative thumbnails switch to `object-contain`, and the channel matrix gets a data-matching fix + visual cleanup.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS 4, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-04-04-dashboard-command-center-redesign.md`

---

### Task 1: Sidebar — Wider + Breathable Cards

**Files:**
- Modify: `src/app/page.tsx:113` (width)
- Modify: `src/components/CampaignList.tsx:37-76` (CampaignCard), `152` (filter pill gap)

- [ ] **Step 1: Widen sidebar from 340px to 380px**

In `src/app/page.tsx`, change the sidebar container width:

```tsx
// line 113: change lg:w-[340px] to lg:w-[380px]
<div className="w-full lg:w-[380px] flex-shrink-0 lg:h-full h-auto max-h-[50vh] lg:max-h-none overflow-y-auto border-b lg:border-b-0 border-[var(--border)]">
```

- [ ] **Step 2: Update CampaignCard — padding, title clamp, task type, selected state**

In `src/components/CampaignList.tsx`, replace the `CampaignCard` function (lines 37-76) with:

```tsx
function CampaignCard({ request, selected, onSelect }: CampaignCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border transition-all duration-150 cursor-pointer",
        selected
          ? "border-[#2563eb] border-l-[3px] bg-[#eff6ff] shadow-sm"
          : "border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:shadow-sm",
      ].join(" ")}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold text-[#1a1a1a] leading-snug line-clamp-2 flex-1 min-w-0">
          {request.title}
        </p>
        <StatusBadge status={request.status} />
      </div>

      {/* Task type */}
      <p className="text-[11px] text-[#737373] mb-2">
        {String(request.task_type || "").replace(/_/g, " ")}
      </p>

      {/* Languages */}
      {request.target_languages.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Globe size={11} className="text-[#737373] shrink-0" />
          {request.target_languages.slice(0, 3).map((lang) => (
            <span key={lang} className="tag-pill">
              {lang}
            </span>
          ))}
          {request.target_languages.length > 3 && (
            <span className="tag-pill">+{request.target_languages.length - 3}</span>
          )}
        </div>
      )}

      {/* Progress bar for generating status */}
      <ProgressBar status={request.status} />
    </button>
  );
}
```

Key changes:
- `p-4` → `px-4 py-4` (same but explicit for clarity)
- `truncate` → `line-clamp-2` on title
- Added task type line below title (`text-[11px] text-[#737373]`)
- Selected state: added `border-l-[3px]` left accent (Linear-style)
- `mb-2` → `mb-1.5` on title row, `mb-1` removed from languages (was `mb-1`)

- [ ] **Step 3: Increase filter pill spacing**

In `src/components/CampaignList.tsx` line 152, change `gap-1.5` to `gap-2`:

```tsx
<div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-[#e5e5e5] shrink-0">
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev` (or check if already running)
Navigate to the dashboard as admin (`?role=admin`). Verify:
- Sidebar is wider, cards show full campaign titles on 2 lines
- Task type appears below titles
- Selected card has blue left accent bar
- Filter pills have slightly more breathing room

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/CampaignList.tsx
git commit -m "ui: sidebar breathing room — 380px, 2-line titles, task type, accent bar"
```

---

### Task 2: Preview Panel — Sticky Campaign Strip Header

**Files:**
- Modify: `src/components/CampaignPreviewPanel.tsx:1-24` (imports), `131-158` (header section), `291-311` (remove Goal + CTA at bottom)

- [ ] **Step 1: Update imports**

In `src/components/CampaignPreviewPanel.tsx`, replace the import block (lines 5-18) with:

```tsx
import {
  ArrowRight,
  Globe,
  Users,
  Layers,
  Target,
  Loader2,
  AlertCircle,
  MessageSquare,
  Check,
} from "lucide-react";
```

Removed: `Eye`, `ImageIcon`, `Clock`, `CheckCircle2`, `Bell` (no longer used).
Added: `MessageSquare`, `Check` (used by intel strip and progress bar).

Also remove the PipelineNav import (lines 20-21):
```tsx
// DELETE these two lines:
// import PipelineNav from "@/components/PipelineNav";
// import type { PipelineStage } from "@/components/PipelineNav";
```

- [ ] **Step 2: Replace the header section with sticky campaign strip**

Replace lines 131-158 (the current `<div className="h-full overflow-y-auto">` opening through the header `</div>`) with:

```tsx
  const briefData = progress?.brief || {};
  const messaging = briefData.messaging_strategy || {};
  const channels = briefData.channels || {};
  const personas = briefData.personas || [];
  const goalText = String(formData.goal || formData.description || "");

  // Pipeline stage statuses for segmented bar
  const stageList = [
    { key: "brief", label: "Brief", status: hasBrief ? "passed" : isGenerating ? "running" : "pending" },
    { key: "actors", label: "Actors", status: actors.length > 0 ? "passed" : hasBrief ? (isGenerating ? "running" : "pending") : "pending" },
    { key: "images", label: "Images", status: characters.length > 0 ? "passed" : actors.length > 0 ? (isGenerating ? "running" : "pending") : "pending" },
    { key: "creatives", label: "Creatives", status: composedAssets.length > 0 ? "passed" : characters.length > 0 ? (isGenerating ? "running" : "pending") : "pending" },
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky campaign strip */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="px-6 pt-5 pb-4">
          {/* Row 1: Title */}
          <div className="flex items-start justify-between gap-4 mb-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight line-clamp-2 flex-1 min-w-0">
              {request.title}
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={request.status} />
              <Link
                href={`/intake/${request.id}`}
                className="w-8 h-8 rounded-full bg-[var(--foreground)] text-white flex items-center justify-center hover:bg-[#32373c] transition-colors cursor-pointer"
                title="View full details"
              >
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Row 2: Meta */}
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {String(request.task_type || "").replace(/_/g, " ")}
            {regions.length > 0 && (
              <span>
                {" "}&middot;{" "}
                {regions.slice(0, 3).join(", ")}
                {regions.length > 3 && ` +${regions.length - 3}`}
              </span>
            )}
          </p>

          {/* Row 3: Goal one-liner */}
          {goalText && (
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1 line-clamp-1">
              {goalText}
            </p>
          )}
        </div>

        {/* Segmented progress bar */}
        <div className="px-6 pb-4">
          <div className="flex gap-1.5">
            {stageList.map((stage) => (
              <div key={stage.key} className="flex-1 min-w-0">
                <div
                  className={[
                    "h-1.5 rounded-full transition-all duration-500",
                    stage.status === "passed" ? "bg-[#22c55e]" : "",
                    stage.status === "running" ? "bg-[#2563eb] animate-pulse" : "",
                    stage.status === "pending" ? "bg-[#e5e5e5]" : "",
                  ].join(" ")}
                />
                <div className="flex items-center gap-1 mt-1.5">
                  {stage.status === "passed" && <Check size={10} className="text-[#22c55e] flex-shrink-0" />}
                  {stage.status === "running" && <Loader2 size={10} className="text-[#2563eb] animate-spin flex-shrink-0" />}
                  <span
                    className={[
                      "text-[11px] font-medium truncate",
                      stage.status === "passed" ? "text-[var(--foreground)]" : "",
                      stage.status === "running" ? "text-[#2563eb]" : "",
                      stage.status === "pending" ? "text-[#d4d4d8]" : "",
                    ].join(" ")}
                  >
                    {stage.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Remove the old Goal section and bottom CTA**

Delete lines 291-311 (the Goal snippet and the CTA Link at the bottom):

```tsx
// DELETE everything from the Goal snippet comment through the closing </Link>:
//   {/* Goal snippet */}
//   {(formData.goal || formData.description) && ( ... )}
//   {/* CTA */}
//   <Link href={...} ... />
```

- [ ] **Step 4: Remove old pipeline stages variable**

Delete lines 119-125 (the old `stages` const using `PipelineStage[]`) since we now define `stageList` inline in the JSX section above.

- [ ] **Step 5: Verify visually**

Check the dashboard. Verify:
- Sticky header stays visible as you scroll the preview panel
- Title wraps to 2 lines if long
- Arrow button is visible next to the status badge (always above the fold)
- Goal shows as a one-liner in the header
- Progress bar shows 4 colored segments with labels
- Old Goal section and "View Full Details" button at the bottom are gone

- [ ] **Step 6: Commit**

```bash
git add src/components/CampaignPreviewPanel.tsx
git commit -m "ui: sticky campaign strip — header, progress bar, promoted CTA"
```

---

### Task 3: Preview Panel — Intel Strip + Remove Regions/Languages Grid

**Files:**
- Modify: `src/components/CampaignPreviewPanel.tsx` (content area)

This task modifies the content area below the sticky header. The code from Task 2 left the `{/* Content area */}` section starting with `<div className="p-6 space-y-5">`.

- [ ] **Step 1: Add intel strip after the stats row, replace the regions/languages grid**

Replace the entire `{/* Content area */}` section — from `<div className="p-6 space-y-5">` through the compact stats row AND the Quick info grid (lines 163-207) — with:

```tsx
      {/* Content area */}
      <div className="p-6 space-y-5">

        {/* Compact stats row */}
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Creatives", value: composedAssets.length, Icon: Layers, color: "#6B21A8" },
            { label: "Characters", value: characters.length, Icon: Users, color: "#E91E8C" },
            { label: "Actors", value: actors.length, Icon: Target, color: "#0693E3" },
            { label: "Languages", value: languages.length, Icon: Globe, color: "#22c55e" },
          ].filter(s => s.value > 0 || s.label === "Languages").map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.Icon size={13} style={{ color: s.color }} />
              <span className="text-sm font-semibold text-[var(--foreground)]">{s.value}</span>
              <span className="text-[11px] text-[var(--muted-foreground)]">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Intel strip — messaging + channels summary */}
        {hasBrief && (messaging.primary_message || channels.primary?.length > 0) && (
          <div className="bg-[#F5F5F5] rounded-xl p-4 space-y-2.5">
            {messaging.primary_message && (
              <div className="flex gap-2.5">
                <MessageSquare size={14} className="text-[#737373] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[var(--foreground)] leading-relaxed line-clamp-2">
                  {messaging.primary_message}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5 flex-wrap min-w-0">
                {(channels.primary || []).slice(0, 3).map((ch: string) => {
                  const cleaned = ch.replace(/\s*\(.*$/, "").trim();
                  return (
                    <span
                      key={ch}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#0693E3]/8 text-[#0693E3] border border-[#0693E3]/12"
                    >
                      {cleaned}
                    </span>
                  );
                })}
                {(channels.primary || []).length > 3 && (
                  <span className="text-[10px] text-[#737373]">
                    +{channels.primary.length - 3}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#737373] flex-shrink-0">
                {personas.length > 0 && (
                  <span>{personas.length} persona{personas.length !== 1 ? "s" : ""}</span>
                )}
                {languages.length > 0 && (
                  <span>{languages.length} lang{languages.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
        )}
```

Note: The old `{/* Quick info */}` 2-column grid (Regions + Languages) is now gone. Region info is in the header meta line, languages are in the stats row + intel strip count.

- [ ] **Step 2: Verify visually**

Check the dashboard preview panel. Verify:
- Stats row still shows (Creatives, Characters, Actors, Languages)
- Intel strip appears with the primary message and top 3 channel pills
- Persona count + language count shown on the right of the intel strip
- Old Regions/Languages grid is gone (no duplicate info)
- Intel strip only renders when brief data exists

- [ ] **Step 3: Commit**

```bash
git add src/components/CampaignPreviewPanel.tsx
git commit -m "ui: intel strip — messaging + channels summary in preview panel"
```

---

### Task 4: Preview Panel — Creative Grid Fix (object-contain + 4:3)

**Files:**
- Modify: `src/components/CampaignPreviewPanel.tsx` (creative thumbnails section)

- [ ] **Step 1: Replace the composed creatives grid**

Find the `{/* Live creative thumbnails */}` section and replace it with:

```tsx
        {/* Live creative thumbnails */}
        {composedAssets.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
              Latest Creatives
            </span>
            <div className="grid grid-cols-3 gap-2">
              {composedAssets.slice(0, 6).map((asset: Record<string, any>, i: number) => (
                <div
                  key={asset.id || i}
                  className="rounded-lg overflow-hidden border border-[var(--border)] bg-[#F5F5F5] relative hover:scale-[1.02] hover:shadow-md transition-all duration-150"
                  style={{ aspectRatio: "4/3" }}
                >
                  {asset.blob_url ? (
                    <img
                      src={asset.blob_url}
                      alt={asset.content?.overlay_headline || "Creative"}
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 size={16} className="text-[var(--muted-foreground)] animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {composedAssets.length > 6 && (
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 text-center">
                +{composedAssets.length - 6} more creatives
              </p>
            )}
          </div>
        )}
```

Changes:
- `aspectRatio: "1"` → `"4/3"` (wider containers, better for mixed formats)
- `bg-[var(--muted)]` → `bg-[#F5F5F5]` (explicit letterbox background)
- `object-cover` → `object-contain` (show full creative without clipping)
- Added `hover:scale-[1.02] hover:shadow-md transition-all duration-150` (subtle hover lift)

- [ ] **Step 2: Replace the character thumbnails grid**

Find the `{/* Character thumbnails */}` section and replace it with:

```tsx
        {/* Character thumbnails */}
        {characters.length > 0 && composedAssets.length === 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
              Generated Characters
            </span>
            <div className="grid grid-cols-4 gap-2">
              {characters.slice(0, 8).map((asset: Record<string, any>, i: number) => (
                <div
                  key={asset.id || i}
                  className="rounded-lg overflow-hidden border border-[var(--border)] bg-[#F5F5F5] relative hover:scale-[1.02] hover:shadow-md transition-all duration-150"
                  style={{ aspectRatio: "4/3" }}
                >
                  {asset.blob_url ? (
                    <img
                      src={asset.blob_url}
                      alt="Character"
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 size={14} className="text-[var(--muted-foreground)] animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
```

Same changes: `object-contain`, `bg-[#F5F5F5]`, `4/3` aspect ratio, hover effect.

- [ ] **Step 3: Verify visually**

Check the dashboard. Verify:
- Composed creatives show full images without clipping (text/CTAs visible)
- Letterbox background is `#F5F5F5` (subtle gray, not jarring)
- Cards are wider (4:3) instead of square
- Hover effect: slight scale-up + shadow lift
- Characters fallback uses same treatment

- [ ] **Step 4: Commit**

```bash
git add src/components/CampaignPreviewPanel.tsx
git commit -m "ui: creative grid — object-contain, 4:3 aspect, hover lift"
```

---

### Task 5: Channel Matrix — Data Matching Fix + Visual Cleanup

**Files:**
- Modify: `src/components/BriefExecutive.tsx:268-345` (ChannelMatrix function)

- [ ] **Step 1: Add resolvePersonaKey helper**

In `src/components/BriefExecutive.tsx`, add this helper function right above the `ChannelMatrix` function (before line 268):

```tsx
function resolvePersonaKey(persona: any, index: number, perPersona: Record<string, any>): string {
  const candidates = [
    persona.archetype_key,
    persona.persona_name,
    persona.name,
    persona.persona_name?.toLowerCase().replace(/\s+/g, "_"),
    persona.name?.toLowerCase().replace(/\s+/g, "_"),
    `persona_${index + 1}`,
  ].filter(Boolean);
  return candidates.find((k) => k && perPersona[k]) || candidates[0] || `persona_${index + 1}`;
}
```

- [ ] **Step 2: Replace the ChannelMatrix function**

Replace the entire `ChannelMatrix` function (lines 268-345) with:

```tsx
function ChannelMatrix({ channels, personas }: { channels: Record<string, any>; personas: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const perPersona = channels.per_persona || {};
  const rawChannels = new Set<string>();

  // Collect all unique channels (raw names)
  (channels.primary || []).forEach((c: string) => rawChannels.add(c));
  (channels.secondary || []).forEach((c: string) => rawChannels.add(c));
  Object.values(perPersona).forEach((chs: any) => {
    if (Array.isArray(chs)) chs.forEach((c: string) => rawChannels.add(c));
  });

  if (rawChannels.size === 0) return null;

  const channelList = Array.from(rawChannels);
  const primaryCleaned = new Set((channels.primary || []).map((c: string) => cleanChannelName(c)));
  const secondaryCleaned = new Set((channels.secondary || []).map((c: string) => cleanChannelName(c)));

  // Split into prioritized (primary/secondary) and unassigned
  const prioritized = channelList.filter((ch) => {
    const cleaned = cleanChannelName(ch);
    return primaryCleaned.has(cleaned) || secondaryCleaned.has(cleaned);
  });
  const unassigned = channelList.filter((ch) => {
    const cleaned = cleanChannelName(ch);
    return !primaryCleaned.has(cleaned) && !secondaryCleaned.has(cleaned);
  });

  const visibleChannels = showAll ? channelList : prioritized;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Channel</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Priority</th>
            {personas.map((p: any, i: number) => (
              <th key={i} className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {p.persona_name || p.name || `P${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleChannels.map((ch) => {
            const cleaned = cleanChannelName(ch);
            const isPrimary = primaryCleaned.has(cleaned);
            const isSecondary = secondaryCleaned.has(cleaned);

            return (
              <tr
                key={ch}
                className={[
                  "border-b border-[var(--border)] last:border-0",
                  isPrimary ? "bg-[#0693E3]/[0.03]" : "",
                ].join(" ")}
              >
                <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">{cleaned}</td>
                <td className="py-2.5 pr-4">
                  {isPrimary ? (
                    <span className="px-2 py-0.5 bg-[#0693E308] text-[#0693E3] rounded-md text-[10px] font-semibold border border-[#0693E315]">Primary</span>
                  ) : isSecondary ? (
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px] font-semibold border border-gray-200">Secondary</span>
                  ) : (
                    <span className="text-[var(--muted-foreground)] text-[10px]">&mdash;</span>
                  )}
                </td>
                {personas.map((p: any, i: number) => {
                  const key = resolvePersonaKey(p, i, perPersona);
                  const personaChannels: string[] = Array.isArray(perPersona[key]) ? perPersona[key] : [];
                  const cleanedPersonaChannels = personaChannels.map(cleanChannelName);
                  const isActive = cleanedPersonaChannels.includes(cleaned);

                  return (
                    <td key={i} className="py-2.5 px-2 text-center">
                      {isActive ? (
                        <div className="w-5 h-5 rounded-full bg-[#0693E310] flex items-center justify-center mx-auto">
                          <div className="w-2 h-2 rounded-full bg-[#0693E3]" />
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {unassigned.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-[11px] text-[#737373] hover:text-[#1a1a1a] mt-2 cursor-pointer transition-colors"
        >
          {showAll ? "Hide" : `Show ${unassigned.length} more`} unassigned channels
        </button>
      )}
    </div>
  );
}
```

Key changes:
- Uses `resolvePersonaKey()` instead of raw `p.archetype_key` for data matching
- Inactive state: `null` (empty cell) instead of gray circle
- Primary rows get `bg-[#0693E3]/[0.03]` tint
- Unassigned channels hidden by default behind "Show X more" toggle
- Added `useState` for the toggle (already imported at top of file)

- [ ] **Step 3: Verify visually**

Navigate to a campaign detail page with brief data (e.g., `/intake/[id]` → Brief tab → Channels sub-tab). Verify:
- Persona-channel dots now populate correctly (blue dots where personas target a channel)
- Inactive cells are empty (no gray circles)
- Primary channel rows have subtle blue tint
- Unassigned channels are hidden with "Show X more unassigned channels" toggle
- Toggle expands/collapses correctly

- [ ] **Step 4: Commit**

```bash
git add src/components/BriefExecutive.tsx
git commit -m "fix: channel matrix — persona key resolution, visual cleanup, collapse unassigned"
```

---

### Task 6: Final Cleanup + TypeScript Check

**Files:**
- Modify: `src/components/CampaignPreviewPanel.tsx` (remove unused imports/vars)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Fix any type errors. Common ones to watch for:
- Unused imports from the old PipelineNav (`PipelineStage` type)
- Unused variables (`allAssets`, `ImageLoader` import)
- The `stages` const was replaced by `stageList` — ensure no references remain

- [ ] **Step 2: Clean up unused imports in CampaignPreviewPanel**

Ensure these are removed if not used elsewhere in the file:
- `import PipelineNav from "@/components/PipelineNav";`
- `import type { PipelineStage } from "@/components/PipelineNav";`
- `import ImageLoader from "@/components/ui/image-loading";`
- Any Lucide icons removed in Task 2 Step 1 (`Eye`, `ImageIcon`, `Clock`, `CheckCircle2`, `Bell`)

Also check if `allAssets` (line 115) is used — if not, remove it.

- [ ] **Step 3: Verify full flow end-to-end**

Navigate through the full flow:
1. Dashboard loads → sidebar shows breathable cards with 2-line titles
2. Select a campaign → sticky header with title, status, arrow button, goal one-liner
3. Progress bar shows correct stage states (green/blue/gray)
4. Intel strip shows primary message + top channels + persona/language counts
5. Creative grid shows full creatives without clipping (object-contain, 4:3, #F5F5F5 bg)
6. Click arrow → detail page loads
7. Detail page → Brief → Channels tab → matrix shows populated persona dots

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: cleanup unused imports and variables after dashboard redesign"
```
