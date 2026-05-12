# Pre-Built Dashboards + Cross-Widget Drill-Down

**Date:** 2026-05-12
**Status:** Design
**Deadline:** Friday May 16
**Author:** Steven Junop + Claude

## Problem

The Insights dashboard builder has 37 widgets but zero pre-built dashboards. Users see an empty list and have to build everything from scratch. Leadership needs ready-to-go dashboards that tell a story — not a blank canvas. The one seeded template ("Recruitment Pipeline Overview") is invisible because `listDashboards()` excludes templates.

Additionally, the L1→L2→L3 drill-down described in the organic metrics spec was designed but never built. Clicking a bar in a comparison chart should filter the detail widget below it — this cross-widget interaction is essential for the dashboards to feel like a real analytics product.

## Solution

1. **4 pre-built dashboards** seeded as real dashboards (`is_template = FALSE`, `created_by = 'system'`) so they appear immediately in the list for all users
2. **DashboardFilterContext** — a shared filter bus that enables L2→L3 drill-down within any dashboard
3. **Widget upgrades** — comparison widgets get clickable bars, detail widgets read from filter context

## Decisions

- Dashboards seeded as **real dashboards** (not templates) — avoids building template picker UI
- Guard: `WHERE created_by = 'system' AND title = $1` prevents duplicates on re-seed
- Drill-down via React context (not URL params) — state is ephemeral, resets on page load
- Filter bus is key-value (`Record<string, string>`) — extensible beyond just `platform`

---

## Dashboard 1: Executive Overview

**Audience:** VP / leadership
**Story:** "Here's our marketing performance in 30 seconds"

| Row | Left (cols 0-5) | Right (cols 6-11) | Story Beat |
|---|---|---|---|
| 0-1 | `paid-kpi` (full 12) | | **The headline** — spend, impressions, clicks, conversions, CPA, CTR |
| 2-3 | `organic-kpi` (full 12) | | **The organic presence** — impressions, reach, engagement, followers |
| 4-7 | `paid-platform-compare` | `organic-platform-compare` | **Channel breakdown** — where's spend going vs where's engagement |
| 8-11 | `organic-attribution` | `organic-account-growth` | **The AI story** — pipeline vs manual + growth trends |
| 12-16 | `organic-top-posts` (full 12) | | **Proof** — top performing posts with attribution badges |

**Widget count:** 7. **Drill-down:** clicking a platform bar in row 4-7 filters the top posts in row 12-16.

## Dashboard 2: Organic Social

**Audience:** Jen + Steven
**Story:** "How is our organic presence doing, and is AI content working?"

| Row | Left (cols 0-5) | Right (cols 6-11) | Story Beat |
|---|---|---|---|
| 0-1 | `organic-kpi` (full 12) | | **Headline organic numbers** |
| 2-5 | `organic-platform-compare` | `organic-account-growth` | **Which platforms win + are we growing?** |
| 6-9 | `organic-attribution` | `gsc-performance` | **Pipeline vs manual + search visibility** |
| 10-14 | `organic-top-posts` (full 12) | | **Post detail with attribution badges** |

**Widget count:** 6. **Drill-down:** clicking a platform bar in row 2-5 filters top posts in row 10-14.

## Dashboard 3: Paid Media

**Audience:** Jen + Steven
**Story:** "Where is our ad spend going and what's the return?"

| Row | Left (cols 0-5) | Right (cols 6-11) | Story Beat |
|---|---|---|---|
| 0-1 | `paid-kpi` (full 12) | | **Headline spend numbers** |
| 2-5 | `paid-platform-compare` | `campaign-roi` | **Spend distribution + per-campaign link ROI** |
| 6-10 | `paid-campaign-detail` (full 12) | | **Campaign table — the detail layer** |
| 11-14 | `utm-funnel` | `recruiter-leaderboard` | **Attribution + who's driving clicks** |

**Widget count:** 6. **Drill-down:** clicking a platform bar in row 2-5 filters campaign detail in row 6-10.

## Dashboard 4: Recruitment Pipeline

**Audience:** Jen
**Story:** "Are campaigns getting out the door on time?"

| Row | Left (cols 0-5) | Right (cols 6-11) | Story Beat |
|---|---|---|---|
| 0-1 | `kpi-cards` (full 12) | | **Pipeline headline** — total, approved, generating, sent |
| 2-5 | `pipeline-overview` | `urgency-breakdown` | **Status distribution + urgency split** |
| 6-9 | `campaign-timeline` (full 12) | | **Timeline — what's moving, what's stuck** |
| 10-13 | `creative-performance` | `asset-gallery` | **Output quality — clicks + asset counts** |
| 14-16 | `worker-health` | `region-map` | **Ops health + regional spread** |

**Widget count:** 8. Replaces the invisible ghost template.

---

## Drill-Down System

### DashboardFilterContext

New file: `src/components/insights/DashboardFilterContext.tsx`

```typescript
interface DashboardFilters {
  platform?: string;     // e.g. 'meta_ads', 'facebook', 'linkedin'
  dateRange?: number;    // days lookback override
}

interface DashboardFilterContextValue {
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  clearFilter: (key: keyof DashboardFilters) => void;
  clearAll: () => void;
  isFiltered: boolean;
}
```

Provider wraps `DashboardGrid` inside `BuilderClient.tsx`. State is ephemeral — resets on page load. No persistence.

### L2 Widget Upgrades (Comparison Charts)

Both `OrganicPlatformCompareWidget` and `PaidPlatformCompareWidget` get:

- `onClick` handler on each Recharts `<Bar>` — calls `setFilter('platform', platformName)`
- **Visual feedback on click:**
  - Selected bar: full opacity + 2px accent border glow
  - Unselected bars: fade to 20% opacity
  - Transition: 300ms ease-in-out
  - Cursor: pointer on all bars
  - Hover: scale(1.02) on bars
- Click same bar again → `clearFilter('platform')` (toggle behavior)
- Active filter indicator: small pill badge below chart title showing "Filtered: LinkedIn x"

### L3 Widget Upgrades (Detail Views)

`OrganicTopPostsWidget`, `PaidCampaignDetailWidget` get:

- Read `platform` from `useFilter('platform')`, falling back to `config.platform`
- When filter changes: brief skeleton flash (200ms), then refetch with new platform param
- **Filter chip** at top of widget: `gradient-accent` background, white text, "x" dismiss
  - e.g. "Showing: LinkedIn ×" 
  - Click × calls `clearFilter('platform')`
  - Chip uses `rounded-full px-3 py-1 text-[10px] font-semibold`
- When no filter active: widget shows all platforms (current behavior)

### L1 Widget Upgrades (KPI Cards)

`OrganicKpiWidget`, `PaidKpiWidget` get:

- When a platform filter is active: KPI cards show that platform's numbers only (from `per_platform` in the API response)
- Subtitle text changes from "All Platforms" to "LinkedIn" (or whatever is filtered)
- No click handlers on KPI cards themselves — they're read-only indicators

---

## Visual Polish Standards

All drill-down interactions must meet these quality bars:

- **Cursor:** `cursor-pointer` on all clickable chart elements
- **Hover:** subtle scale transform `scale(1.02)` with 150ms transition
- **Click feedback:** 300ms opacity transition, selected bar at full opacity, others at 0.2
- **Filter chip:** `background: linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))`, white text, rounded-full, "x" button
- **Skeleton flash:** 200ms opacity-0 → opacity-100 transition when data refetches (not a full skeleton replacement)
- **Empty state:** "No data for [Platform]" when filtered platform has zero rows
- **Transitions:** all CSS transitions use `ease-in-out`, never `linear`

---

## Implementation

### New Files

| File | Purpose |
|---|---|
| `src/components/insights/DashboardFilterContext.tsx` | Filter bus context + provider + hooks |
| `src/lib/db/seed-dashboards.ts` | 4 dashboard seed definitions + `seedPrebuiltDashboards()` function |

### Modified Files

| File | Change |
|---|---|
| `src/components/insights/widgets/OrganicPlatformCompareWidget.tsx` | Add bar onClick + visual feedback |
| `src/components/insights/widgets/PaidPlatformCompareWidget.tsx` | Add bar onClick + visual feedback |
| `src/components/insights/widgets/OrganicTopPostsWidget.tsx` | Read from filter context + filter chip |
| `src/components/insights/widgets/PaidCampaignDetailWidget.tsx` | Read from filter context + filter chip |
| `src/components/insights/widgets/OrganicKpiWidget.tsx` | Show per-platform when filtered |
| `src/components/insights/widgets/PaidKpiWidget.tsx` | Show per-platform when filtered |
| `src/app/insights/(dashboard)/[id]/BuilderClient.tsx` | Wrap grid in DashboardFilterProvider |
| `src/lib/db/dashboards.ts` | Add `seedPrebuiltDashboards()` call, update `seedDefaultTemplate()` |
| `src/lib/db/schema.ts` | Call `seedPrebuiltDashboards()` in `runMigrations()` |

### Grid Layout Specification

Each dashboard's `layout_data` is a complete `DashboardLayoutData` JSON with `lg`, `md`, and `sm` breakpoints.

**Grid constants:** 12 columns (lg), 8 columns (md), 4 columns (sm). Row height 80px. Margin 16px.

**Responsive rules:**
- `lg`: as designed in tables above
- `md`: full-width stack (all widgets w=8), same vertical order
- `sm`: full-width stack (all widgets w=4), same vertical order

---

## Total Scope

- **1 new context** (DashboardFilterContext)
- **1 new seed file** (4 dashboard definitions)
- **6 widget upgrades** (2 comparison + 2 detail + 2 KPI)
- **2 infrastructure changes** (BuilderClient wrapper + schema seed call)
- **~10 files touched total**
