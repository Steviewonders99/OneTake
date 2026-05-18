# Project Command Center Dashboard — Design Spec

**Date:** 2026-05-18
**Author:** Steven Junop
**Status:** Approved
**Target:** L1 Leadership Presentation — Thursday May 22, 2026
**Codebase:** centric-intake (Next.js 16, Neon PG, Tailwind, Recharts)

---

## Problem

Current insights dashboards are widget grids built in a hurry with no defined flow. They show raw data without telling a story. The SVP responded positively to a plain-English Meta weekly email because it had headline numbers, WoW trends, narrative insights, and actionable recommendations. Leadership needs a single view that shows the full recruitment marketing portfolio across all channels — paid, organic, email, physical, recruiter, job boards — with the narrative style that resonated.

## Solution

A single-page **Project Command Center** dashboard with two modes: Full Portfolio (default) and Single Project (via dropdown). OneForma branding throughout. No page navigation — the dropdown transforms the same page. Interactive Recharts-based stacked area chart with channel toggle. AI-generated narrative brief.

---

## Branding

All visual design follows the OneForma brand system from `oneformaseo/`:

| Token | Value | Usage |
|---|---|---|
| `--grad` | `linear-gradient(135deg, #DB2777 0%, #7C3AED 40%, #2563EB 100%)` | Gradient text, icons |
| `--grad-deep` | `linear-gradient(135deg, #0348B2 0%, #7C3AED 50%, #DB2777 100%)` | Hero card 1 |
| `--grad-cool` | `linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)` | Hero card 2 |
| `--grad-warm` | `linear-gradient(135deg, #DB2777 0%, #9333EA 100%)` | Hero card 3 |
| `--pink` | `#DB2777` | Negative deltas, recruiter channel |
| `--purple` | `#7C3AED` | Accent, organic indicators |
| `--blue` | `#2563EB` | Positive deltas, paid indicators |
| `--rose` | `#E11D48` | Alerts, FIX actions |
| `--amber` | `#D97706` | Hold actions, flat deltas |
| `--text` | `#111827` | Primary text |
| `--text-2` | `#4B5563` | Secondary text |
| `--text-3` | `#9CA3AF` | Tertiary text, labels |
| `--bg` | `#FFFFFF` | Page background |
| `--bg-raised` | `#F6F7FB` | Card backgrounds, secondary areas |
| Font | `Roboto` 200/300/400/500/600/700/900 | All text |
| Shadows | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Card elevation |
| Dot grid | `radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)` 24px | Subtle body background |

**No greens anywhere.** Use `--blue` for positive indicators, `--amber` for hold, `--rose`/`--pink` for negative.

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER BAR                                                       │
│ Title + subtitle | [Project dropdown ▾] [Country ▾] [7d|14d|30d|90d] │
├─────────────────────────────────────────────────────────────────┤
│ HERO METRICS (3 gradient cards)                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ Applications │ │ Blended CPA  │ │ Organic Share│             │
│ │ 312  ↑8%     │ │ €13.56  ↓4%  │ │ 67%  209/312│             │
│ └──────────────┘ └──────────────┘ └──────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│ SECONDARY STRIP (5 small cards)                                  │
│ [Projects:10] [Channels:14] [Countries:6] [Spend:€4.2K] [Unclassified:4] │
├─────────────────────────────────────────────────────────────────┤
│ INTERACTIVE STACKED AREA CHART                                   │
│ Legend: [✓Meta] [✓LinkedIn] [✓Recruiter] [▸Others (expand)]     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ ████████████████████████████████████████████ 312 total    │   │
│ │ ██████████████████████████████████ Meta: 68               │   │
│ │ ████████████████████████████ LinkedIn: 62                 │   │
│ │ █████████████████ Recruiter: 34                           │   │
│ │ ████████ Others: 148                                      │   │
│ │ W1    W2    W3    W4    W5    W6    W7(now)               │   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ MASTER PROJECT TABLE                                             │
│ Project | Channels | Spend | Clicks | Apps | CPA | WoW | Action │
│ ────────────────────────────────────────────────────────────────│
│ Centaurus | Meta Brevo Recruiter | €1,240 | 3,421 | 142 | €8.73 | ↑15% | INCREASE │
│ Humus | Meta Reddit Flyer Influencer | €1,890 | 5,102 | 89 | €21.24 | →0% | HOLD │
│ ... + Show all →                                                 │
├─────────────────────────────────────────────────────────────────┤
│ AI NARRATIVE (Weekly Intelligence Brief)                         │
│ "Portfolio spend rose 12% to €4,230 with 312 total apps..."     │
│ [INCREASE: Centaurus, Kilo] [HOLD: Humus] [FIX: Lumina]        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Page Route: `src/app/insights/(dashboard)/command-center/page.tsx`

Server component. Requires `admin` or `recruiter` role. Fetches all projects server-side, passes to client component.

```typescript
// Server-side data fetching
const projects = await listProjects('active');
const channels = await listChannelDefinitions();
return <CommandCenterClient projects={projects} channels={channels} />;
```

### 2. Client Wrapper: `src/components/insights/command-center/CommandCenterClient.tsx`

Client component. Manages state:
- `selectedProject`: string | null (null = full portfolio)
- `selectedCountry`: string | null (null = all countries)
- `dateRange`: 7 | 14 | 30 | 90
- `expandedChannels`: boolean (whether "Others" is expanded in chart)

Fetches data client-side based on selections:
- Portfolio mode: `GET /api/projects` + aggregate from all project funnels
- Single project mode: `GET /api/projects/[id]/funnel?view=weekly` + `GET /api/projects/[id]/channels`

### 3. Header Bar: `src/components/insights/command-center/CommandCenterHeader.tsx`

Props: `projects`, `selectedProject`, `selectedCountry`, `dateRange`, `onProjectChange`, `onCountryChange`, `onDateRangeChange`

- Title: "**Project** Command Center" (font-weight 200 + 800)
- Subtitle: dynamic based on selection ("Week of May 12–18 · 10 active projects · All channels")
- Project dropdown: `<select>` with optgroups "Paid + Organic" / "Organic Only"
- Country dropdown: `<select>` populated from unique `projects[].countries` across all projects. v1 = visual filter on table only.
- Date pills: 4 buttons, active state = `bg-[#111827] text-white`

### 4. Hero Metrics: `src/components/insights/command-center/HeroMetrics.tsx`

Props: `weeklyData` (current + previous week summaries), `dateRange`

Three gradient cards in a `grid-cols-3` layout:

| Card | Gradient | Metric | Delta | Benchmark |
|---|---|---|---|---|
| Applications | `--grad-deep` | `total_conversions` | WoW % change | 30-day avg |
| Blended CPA | `--grad-cool` | `blended_cpa` | WoW % change | Breakeven from `roas_config` + ROAS ratio |
| Organic Share | `--grad-warm` | `organic_clicks / total_clicks * 100` | Current count "X of Y at zero spend" | vs 30 days ago |

Cards have: subtle radial gradient overlay (top-right), `border-radius: 16px`, `box-shadow: var(--shadow-lg)`.

Eyebrow text: `font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.6`
Number: `font-size: 48px; font-weight: 900; letter-spacing: -0.03em`
Delta: `font-size: 13px; font-weight: 500; opacity: 0.85`

### 5. Secondary Strip: `src/components/insights/command-center/SecondaryStrip.tsx`

Props: `projectCount`, `channelCount`, `countryCount`, `totalSpend`, `unclassifiedCount`

5 cards in `grid-cols-5`. White background, `border-radius: 12px`, `border: 1px solid var(--border)`.

Number: `font-size: 22px; font-weight: 800`
Label: `font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em`

Unclassified count uses `color: var(--amber)` when > 0.

### 6. Channel Chart: `src/components/insights/command-center/ChannelChart.tsx`

Props: `weeklyData` (array of weekly summaries with per-channel breakdowns), `expandedChannels`, `onToggleExpand`

**Library:** Recharts (`AreaChart`, `Area`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer`)

**Default mode (collapsed):**
- 4 stacked areas: Meta (blue `#2563EB`), LinkedIn (purple `#7C3AED`), Recruiter (pink `#DB2777`), Others (gray `#E5E7EB`)
- "Others" legend item has expand arrow icon → click expands

**Expanded mode:**
- "Others" fans out into individual channel areas: Indeed (`#9333EA`), Brevo (`#6366F1`), Flyers (`#A855F7`), Reddit (`#818CF8`), Organic Search (`#C084FC`)
- Each channel has a checkbox in the legend to toggle visibility
- Toggle state managed in component via `Set<string>` of visible channels

**Shared behavior:**
- `<ResponsiveContainer width="100%" height={300}>`
- X-axis: week labels (W1, W2, ... "This Week" bold for current)
- Y-axis: application count
- Tooltip: shows all visible channels with values + total for that week
- Current week highlighted with subtle purple background band
- Total annotation badge on the last data point
- Smooth curves: `type="monotone"`
- Area fill: `fillOpacity={0.15}` for each channel

**Data shape:**
```typescript
type ChartWeek = {
  week: string;          // "W1 (Mar 24)"
  meta_paid: number;
  linkedin_organic: number;
  recruiter: number;
  indeed: number;
  brevo_email: number;
  flyer: number;
  reddit_paid: number;
  organic_search: number;
  total: number;
};
```

### 7. Project Table: `src/components/insights/command-center/ProjectTable.tsx`

Props: `projects` (with funnel data), `selectedCountry`, `onProjectSelect`

**Portfolio mode:**
- One row per project
- Columns: Project (name + detail + countries), Channels (colored pills), Spend, Clicks, Applications, CPA, WoW delta, Action
- Channel pills: colored by channel type using the pill classes
- CPA column: shows "organic" italic when spend = 0
- WoW delta: `delta-up` (blue), `delta-flat` (amber), `delta-down` (rose)
- Action badge: AI-generated recommendation (INCREASE blue, HOLD amber, FIX rose, BOOST purple)
- Expandable: shows top 5, "Show all →" expands to full list
- Rows are clickable → sets `selectedProject` in parent (equivalent to dropdown change)
- Country filter: when `selectedCountry` set, only show projects that include that country in `countries[]`

**Single project mode (when project selected via dropdown):**
- Table transforms to show channel-by-channel breakdown for that project
- One row per channel link from `GET /api/projects/[id]/channels`
- Same columns but project column becomes channel name + type

### 8. AI Narrative: `src/components/insights/command-center/NarrativePanel.tsx`

Props: `projects` (with funnel data), `weeklyData`

- Header: gradient icon (✦) + "Weekly Intelligence Brief" + "AI-generated" subtitle
- Body: plain English paragraph auto-generated from the data
- Uses `highlight-up` (blue), `highlight-hold` (amber), `highlight-down` (rose) spans for emphasis
- Recommendation strip at bottom: action badges with project names

**v1 (Thursday):** Template-based narrative generation in the component. Rules:
- Find project with best WoW improvement → "X is the clear winner"
- Find project with worst WoW → "Y needs attention"
- Calculate organic share → if > 50%, highlight as standout trend
- List projects by action category

**v2 (post-Thursday):** NIM API call for true AI narrative generation using the structured data.

---

## Data Flow

```
Browser                          API                              Database
───────                          ───                              ────────
CommandCenterClient
  │
  ├─ mount ──────────── GET /api/projects ────────── projects table
  │                                                    + project_aliases
  │
  ├─ mount ──────────── GET /api/projects/unclassified ── unclassified_utm_log
  │                                                        + channel_definitions
  │
  ├─ per project ────── GET /api/projects/[id]/funnel ── project_weekly_summary
  │   (parallel)         ?view=weekly                     (materialized view)
  │
  ├─ per project ────── GET /api/projects/[id]/channels ── project_channel_links
  │   (parallel)                                            + channel_definitions
  │
  └─ dropdown change ── re-fetch single project data
```

**Performance:** Initial load fetches all projects + their weekly summaries in parallel. The materialized view (`project_weekly_summary`) ensures fast aggregation. Single project deep-dive fetches one additional funnel query.

---

## Country Filter (Scoped)

**v1 (Thursday):** Country dropdown populated from `Array.from(new Set(projects.flatMap(p => p.countries)))`. Selecting a country filters the project table to only show projects targeting that country. Hero metrics and chart still show portfolio-level data.

**v2 (next week):** Wire country filter into funnel queries: `GET /api/projects/[id]/funnel?view=weekly&country=DE`. Requires the `normalized_daily_metrics.country` column. Connect to GA4 traffic widget for session/device/source breakdown per country/region.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/insights/(dashboard)/command-center/page.tsx` | Server component, auth, data fetch |
| Create | `src/components/insights/command-center/CommandCenterClient.tsx` | Client wrapper, state management |
| Create | `src/components/insights/command-center/CommandCenterHeader.tsx` | Header bar, dropdowns, date pills |
| Create | `src/components/insights/command-center/HeroMetrics.tsx` | 3 gradient metric cards |
| Create | `src/components/insights/command-center/SecondaryStrip.tsx` | 5 secondary metric cards |
| Create | `src/components/insights/command-center/ChannelChart.tsx` | Recharts stacked area with toggle |
| Create | `src/components/insights/command-center/ProjectTable.tsx` | Master project table / channel breakdown |
| Create | `src/components/insights/command-center/NarrativePanel.tsx` | AI narrative brief |
| Create | `src/components/insights/command-center/types.ts` | Component-specific types |
| Create | `src/components/insights/command-center/utils.ts` | Narrative generation, delta formatting |
| Modify | `src/lib/db/seed-dashboards.ts` | Add Command Center to prebuilt list |

**Dependency:** `recharts` package — install via `pnpm add recharts`

---

## Out of Scope (Tracked for v2)

- Country filter wired to funnel queries (v1 = visual table filter only)
- GA4 regional performance integration (needs GA4 API property access)
- NIM-powered AI narrative generation (v1 = template-based)
- Unclassified UTM inbox UI (separate dashboard or panel — not in Command Center)
- Single project deep-dive with daily granularity charts
- Export to PDF/PPTX for Thursday presentation handoff
- Prod DB (myoneforma.com) application→hire funnel closure
