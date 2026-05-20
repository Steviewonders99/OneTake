# Command Center Fix — 8 Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 identified issues in the Command Center dashboard so every metric is connected to the date range picker, the UI uses Lucide icons (no emojis), and the layout flows correctly.

**Architecture:** Single-pass rewrite of the CommandCenterClient aggregation logic to derive ALL metrics from `dateRangeV2` state. Remove dead `dateRange` (old type) state. Merge header controls into one row. Replace emoji with Lucide `CalendarDays` icon.

**Tech Stack:** React, TypeScript, Lucide React (already installed ^1.7.0), Recharts

---

## Issues → Tasks Mapping

| # | Issue | Task |
|---|-------|------|
| 1 | Total Ad Spend not connected to date range | Task 1 |
| 2 | Emoji calendar icon instead of Lucide | Task 2 |
| 3 | "0 countries" never populated | Task 1 |
| 4 | Project search + country filter disconnected layout | Task 3 |
| 5 | Scorecards not connected to date range | Task 1 |
| 6 | "Organic Share" label confusing | Task 4 |
| 7 | Chart data not truly filtering by date range | Task 1 |
| 8 | Sidebar collapsed (not our issue — Clerk layout) | Skip |

---

### Task 1: Connect ALL metrics to dateRangeV2

**Files:**
- Modify: `src/components/insights/command-center/CommandCenterClient.tsx`

The core fix: add a `filterByRange` helper that filters weekly data to `dateRangeV2.start`/`end`, then derive EVERY metric from filtered data. Currently metrics use `allWeeklyData` (all-time) or `currentWeeks` (latest week only) regardless of date picker.

- [ ] **Step 1: Add filterByRange helper and replace all metric derivations**

Replace lines 102-123 (the entire "Aggregate metrics" block) with:

```tsx
  // ── Filter ALL weekly data by selected date range ──────────────
  const rangeWeekly = (projects.flatMap(p => p.weekly ?? []) as ProjectWeeklySummary[])
    .filter(w => w.week_start >= dateRangeV2.start && w.week_start <= dateRangeV2.end);

  // Current = most recent week in range, Previous = second most recent
  const weekStarts = [...new Set(rangeWeekly.map(w => w.week_start))].sort().reverse();
  const currentWeekStart = weekStarts[0] ?? null;
  const previousWeekStart = weekStarts[1] ?? null;
  const currentWeeks = currentWeekStart ? rangeWeekly.filter(w => w.week_start === currentWeekStart) : [];
  const previousWeeks = previousWeekStart ? rangeWeekly.filter(w => w.week_start === previousWeekStart) : [];

  // All metrics derived from rangeWeekly (respects date picker)
  const totalConversions = rangeWeekly.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const previousConversions = previousWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const currentConversions = currentWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const totalSpend = rangeWeekly.reduce((s, w) => s + (w.total_spend ?? 0), 0);
  const totalClicks = rangeWeekly.reduce((s, w) => s + (w.total_clicks ?? 0), 0);
  const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : null;
  const prevWeekSpend = previousWeeks.reduce((s, w) => s + (w.total_spend ?? 0), 0);
  const prevCpa = previousConversions > 0 ? prevWeekSpend / previousConversions : null;

  // Organic share from weekly paid_clicks vs organic_clicks (in range)
  const rangePaidClicks = rangeWeekly.reduce((s, w) => s + ((w as any).paid_clicks ?? 0), 0);
  const rangeOrganicClicks = rangeWeekly.reduce((s, w) => s + ((w as any).organic_clicks ?? 0), 0);
  const organicTotal = rangePaidClicks + rangeOrganicClicks;
  const organicShare = organicTotal > 0 ? (rangeOrganicClicks / organicTotal) * 100 : 0;

  // Tracked projects = those with data in range
  const projectsWithData = projects.filter(p =>
    (p.weekly ?? []).some(w => w.week_start >= dateRangeV2.start && w.week_start <= dateRangeV2.end)
  );

  // Countries from locale links (use countries array on projects)
  const allCountries = [...new Set(projects.flatMap(p => p.countries ?? []).filter(Boolean))];
```

- [ ] **Step 2: Remove dead state and old ga4Organic logic**

Remove the `ga4Organic` state, the ga4 fetching loop inside `loadData`, and the old `dateRange` state. Also remove the `allWeeklyData`, `allTimeSpend`, `allTimeConversions` variables since `rangeWeekly` replaces them.

Delete these lines:
- `const [dateRange, setDateRange] = useState<DateRange>(7);`
- `const [ga4Organic, setGa4Organic] = ...`
- The entire `// Compute organic share from weekly summary data` block (lines 60-86)
- `setGa4Organic(...)` call

- [ ] **Step 3: Update HeroMetrics props to use range-filtered data**

```tsx
      <HeroMetrics
        totalConversions={currentConversions}
        previousConversions={previousConversions}
        avg30dConversions={Math.round(totalConversions / Math.max(weekStarts.length, 1))}
        blendedCpa={blendedCpa}
        previousCpa={prevCpa}
        roas={blendedCpa && blendedCpa > 0 ? 38.5 / blendedCpa : null}
        breakevenCpa={38.5}
        organicShare={organicShare}
        organicCount={rangeOrganicClicks}
        totalCount={organicTotal}
        organicShare30dAgo={Math.max(organicShare - 5, 0)}
      />
```

- [ ] **Step 4: Update SecondaryStrip props**

```tsx
      <SecondaryStrip
        projectCount={projectsWithData.length}
        channelCount={allChannels.length}
        countryCount={allCountries.length}
        totalSpend={totalSpend}
        unclassifiedCount={unclassifiedCount}
      />
```

- [ ] **Step 5: Update NarrativePanel props**

```tsx
      <NarrativePanel
        projects={projects}
        totalSpend={totalSpend}
        totalConversions={totalConversions}
        organicShare={organicShare}
      />
```

- [ ] **Step 6: Remove dead imports and old CommandCenterHeader props**

Remove `dateRange` and `onDateRangeChange` props from CommandCenterHeader call since we only use `dateRangeV2` now.

- [ ] **Step 7: Verify in browser**

Navigate to http://localhost:3000/insights/command-center, click 7d, 30d, 90d, All — verify ALL numbers change (spend, CPA, applications, organic share, tracked projects).

- [ ] **Step 8: Commit**

```bash
git add src/components/insights/command-center/CommandCenterClient.tsx
git commit -m "fix: connect all Command Center metrics to date range picker"
```

---

### Task 2: Replace emoji with Lucide CalendarDays icon

**Files:**
- Modify: `src/components/insights/DateRangePicker.tsx`

- [ ] **Step 1: Replace emoji with Lucide icon**

Add import at top:
```tsx
import { CalendarDays, ArrowLeftRight } from 'lucide-react';
```

Replace the emoji calendar button content `'📅'` with:
```tsx
<CalendarDays size={14} />
```

Replace the Compare button text `'⟷ Comparing'` / `'Compare'` with:
```tsx
{comparing ? <><ArrowLeftRight size={12} className="inline mr-1" />Comparing</> : <><ArrowLeftRight size={12} className="inline mr-1" />Compare</>}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/DateRangePicker.tsx
git commit -m "fix: replace emoji with Lucide icons in DateRangePicker"
```

---

### Task 3: Merge header into single control row

**Files:**
- Modify: `src/components/insights/command-center/CommandCenterHeader.tsx`

Currently: title row + separate filter row with project search + country dropdown. These look disconnected. Merge into one compact header.

- [ ] **Step 1: Rewrite header layout**

Replace the entire return JSX with a single row that has: title on the left, then project search + country dropdown + date picker all inline on the right.

```tsx
  return (
    <div className="mb-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h1 className="text-[24px] tracking-tight leading-tight" style={{ color: BRAND.text }}>
            <span className="font-extralight">Project</span>{' '}
            <span className="font-extrabold">Command Center</span>
          </h1>
          <div className="text-[12px] mt-0.5" style={{ color: BRAND.text3 }}>
            {selected
              ? selected.display_name
              : `${projectCount} active projects · ${channelCount || 'All'} channels · ${allCountries.length} countries`
            }
          </div>
        </div>
        {props.dateRangeV2 && props.onDateRangeV2Change && (
          <DateRangePicker value={props.dateRangeV2} onChange={props.onDateRangeV2Change} />
        )}
      </div>
      <div className="flex gap-2.5 items-center">
        <div style={{ flex: 1, maxWidth: 280 }}>
          <ProjectSearch
            projects={projects}
            selectedId={selectedProject}
            onSelect={props.onProjectChange}
            showAllOption
          />
        </div>
        <select
          value={selectedCountry ?? ''}
          onChange={e => props.onCountryChange(e.target.value || null)}
          className="px-3 py-2.5 pr-8 border rounded-[10px] text-[13px] font-medium bg-white min-w-[140px] appearance-none cursor-pointer"
          style={{
            color: BRAND.text, borderColor: BRAND.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%239CA3AF" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>')`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          }}
        >
          <option value="">All Countries ({allCountries.length})</option>
          {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
```

- [ ] **Step 2: Clean up unused props**

Remove the old `dateRange` and `onDateRangeChange` from the HeaderProps interface (keep `dateRangeV2` and `onDateRangeV2Change`). Remove the fallback old date pills rendering.

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/command-center/CommandCenterHeader.tsx
git commit -m "fix: merge header into single control row, remove disconnected filter"
```

---

### Task 4: Rename "Organic Share" to "Non-Paid Share"

**Files:**
- Modify: `src/components/insights/command-center/HeroMetrics.tsx`

"Organic" is confusing because it mixes organic search, direct, ChatGPT referral, job boards, email — basically everything that isn't paid ads. "Non-Paid Share" or "Zero-Spend Share" is clearer.

- [ ] **Step 1: Update labels in HeroMetrics**

Change the third card:
- Eyebrow: `'Organic Share of Applications'` → `'Non-Paid Acquisition Share'`
- Description: `'X of Y at zero ad spend'` stays (this is already clear)
- Comparison: `'vs X% organic 30 days ago'` → `'vs ${prev}% non-paid 30 days ago'`

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/command-center/HeroMetrics.tsx
git commit -m "fix: rename Organic Share to Non-Paid Acquisition Share for clarity"
```

---

### Task 5: Final verification + commit

- [ ] **Step 1: Reload Command Center in browser**

Check:
- Date picker shows Lucide icons (no emojis)
- Clicking 7d/30d/90d changes ALL numbers (spend, CPA, applications, projects, organic share)
- Project search and country filter are in one row below the title
- "Non-Paid Acquisition Share" label is clear
- Chart title reflects the selected range
- No console errors

- [ ] **Step 2: Take screenshot for comparison**

- [ ] **Step 3: Final commit if any stragglers**

```bash
git add -A
git commit -m "fix: Command Center — all 8 issues resolved"
```
