# Dashboard Command Center Redesign

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Marketing Manager dashboard (admin role) preview panel, sidebar, and detail page channel matrix

## Problem

The marketing manager dashboard has 5 UX issues:
1. Sidebar feels cramped — 340px with truncated titles and tight padding
2. Preview panel has a "vacant middle" — pipeline nav is minimal dots, dead space between stats and creative grid
3. Image cropping — `object-cover` on square containers clips composed creatives with text/CTAs on edges
4. "View Full Details" buried at very bottom of panel, below the fold
5. Channel matrix on detail page — persona-channel circles all show inactive (data key mismatch) + visual noise from gray dots

## Design Direction

**Quick triage mode** — the preview panel is a "glance before deep-dive." Scan status, see top creatives, get a taste of messaging/channels, jump to detail page fast.

## Section 1: Sidebar Redesign

**File:** `src/components/CampaignList.tsx`
**File:** `src/app/page.tsx` (width change)

Changes:
- Width: 340px → 380px in `page.tsx` (`lg:w-[340px]` → `lg:w-[380px]`)
- Campaign card padding: `p-4` → `p-4 py-5`
- Title: `truncate` → `line-clamp-2` to show full campaign names
- Add task type below title: `text-[11px] text-[var(--muted-foreground)]` showing `request.task_type` formatted
- Filter pills: `gap-1.5` → `gap-2`
- Selected state: Add `border-l-2 border-l-[#2563eb]` left accent bar (Linear/Notion style)

No changes to: search, filter logic, progress bar animation, scroll behavior, stats footer.

## Section 2: Preview Panel Header — "Campaign Strip"

**File:** `src/components/CampaignPreviewPanel.tsx`

Replace the current header + separate Goal section with a sticky campaign strip:

- `sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b`
- Row 1: Campaign title (`text-lg font-semibold`)
- Row 2: Task type + region (muted, left) | Status badge + arrow-circle link button (right)
- Row 3: Goal text as `line-clamp-1 text-[13px] text-[var(--muted-foreground)]`
- Arrow button: `rounded-full w-8 h-8` icon button linking to `/intake/[id]`, hover tooltip "View full details"

**Removed:**
- Separate Goal section at the bottom
- Full "View Full Details" button at the bottom
- Both consolidated into the sticky header

## Section 3: Pipeline Progress Bar

**File:** `src/components/CampaignPreviewPanel.tsx` (inline, replaces PipelineNav usage)

Replace circular dot indicators with a horizontal segmented progress bar:

- 4 equal-width segments in a row, `h-1.5 rounded-full`
- Fill states:
  - Passed: `bg-[#22c55e]` (green)
  - Running: `bg-[#2563eb]` (blue) with `animate-pulse`
  - Pending: `bg-[#e5e5e5]` (gray)
- Labels below each segment: stage name + tiny icon, `text-[11px]`
- Total height: ~40px (down from ~60px)
- Sits directly below the sticky campaign strip

## Section 4: Intel Strip

**File:** `src/components/CampaignPreviewPanel.tsx`

New compact intel card below the progress bar:

- Container: `bg-[#F5F5F5] rounded-xl p-4`
- Row 1: `MessageSquare` icon (muted) + primary message from brief data, `line-clamp-2 text-[13px]`
- Row 2: Top 3 primary channels as small colored pills + persona count + language count (muted text, right-aligned)
- Conditional: Only renders when brief data exists
- Data source: `progress.brief.messaging_strategy.primary_message` and `progress.brief.channels.primary`

**Removed:**
- 2-column Regions/Languages grid section (redundant — region in header subtitle, languages on sidebar card + intel strip count)

## Section 5: Creative Grid Fix

**File:** `src/components/CampaignPreviewPanel.tsx`

- Image rendering: `object-cover` → `object-contain`
- Container aspect ratio: `1/1` (square) → `4/3` (wider, better for mixed formats)
- Container background: add `bg-[#F5F5F5]` for letterboxing
- Hover state: `hover:scale-[1.02] transition-transform duration-150` + subtle shadow on hover
- Same 3-column grid, same 6 thumbnail limit

Character thumbnails fallback:
- Same `object-contain` + `#F5F5F5` treatment (consistent with composed grid)

No changes to: lazy loading, loader spinner, "+X more" count, section label.

## Section 6: Channel Matrix Fix (Detail Page)

**File:** `src/components/BriefExecutive.tsx` (ChannelMatrix function)

### Data matching fix:
The `perPersona[key]` lookup fails because brief data stores keys differently than `archetype_key`. Fix: try multiple key formats:
1. `p.archetype_key` (current)
2. `p.persona_name` or `p.name`
3. Slugified name: lowercase, spaces → underscores
4. `persona_${i+1}` fallback

```typescript
function resolvePersonaKey(persona: any, index: number, perPersona: Record<string, any>): string {
  const candidates = [
    persona.archetype_key,
    persona.persona_name,
    persona.name,
    persona.persona_name?.toLowerCase().replace(/\s+/g, '_'),
    persona.name?.toLowerCase().replace(/\s+/g, '_'),
    `persona_${index + 1}`,
  ].filter(Boolean);
  return candidates.find(k => k && perPersona[k]) || candidates[0] || `persona_${index + 1}`;
}
```

### Visual design changes:
- Active state: Keep blue filled dot (no change)
- Inactive state: Replace gray circle with empty cell (just a `—` dash in muted or blank)
- Primary channel rows: `bg-[#0693E3]/[0.03]` subtle row tint
- Unassigned channels (no priority, no persona): Collapsed behind "Show X more channels" toggle, hidden by default

## Files Modified

1. `src/app/page.tsx` — sidebar width change (340 → 380)
2. `src/components/CampaignList.tsx` — card padding, title clamp, task type line, selected state, filter pill spacing
3. `src/components/CampaignPreviewPanel.tsx` — sticky header, progress bar, intel strip, creative grid fix, remove Goal section + bottom CTA
4. `src/components/BriefExecutive.tsx` — ChannelMatrix data matching + visual redesign

## Out of Scope

- Designer portal changes (separate effort)
- Mobile responsive breakpoints (existing behavior is fine)
- New API endpoints (all data already available via progress endpoint)
- PipelineNav component file (we replace its usage inline, but don't delete the component — it's used elsewhere)
