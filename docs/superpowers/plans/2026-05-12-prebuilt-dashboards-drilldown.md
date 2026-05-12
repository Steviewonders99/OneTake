# Pre-Built Dashboards + Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 pre-built story-driven dashboards and a cross-widget drill-down system so leadership can understand marketing performance in 30 seconds.

**Architecture:** Seed 4 dashboard JSON configs into the `dashboards` table via `seedPrebuiltDashboards()`. Add a `DashboardFilterContext` React context for cross-widget filtering. Upgrade 6 widgets with click handlers and filter-awareness.

**Tech Stack:** React context, Recharts onClick, Neon SQL inserts, existing dashboard grid system

**Spec:** `docs/superpowers/specs/2026-05-12-prebuilt-dashboards-drilldown-design.md`

---

### Task 1: DashboardFilterContext

**Files:**
- Create: `src/components/insights/DashboardFilterContext.tsx`
- Modify: `src/app/insights/(dashboard)/[id]/BuilderClient.tsx`

- [ ] **Step 1: Create `src/components/insights/DashboardFilterContext.tsx`**

```tsx
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DashboardFilters {
  platform?: string;
}

interface DashboardFilterContextValue {
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  clearFilter: (key: keyof DashboardFilters) => void;
  clearAll: () => void;
  isFiltered: boolean;
}

const DashboardFilterContext = createContext<DashboardFilterContextValue>({
  filters: {},
  setFilter: () => {},
  clearFilter: () => {},
  clearAll: () => {},
  isFiltered: false,
});

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>({});

  const setFilter = useCallback((key: keyof DashboardFilters, value: string) => {
    setFilters(prev => {
      // Toggle: if same value, clear it
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilter = useCallback((key: keyof DashboardFilters) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setFilters({}), []);

  const isFiltered = Object.keys(filters).length > 0;

  return (
    <DashboardFilterContext.Provider value={{ filters, setFilter, clearFilter, clearAll, isFiltered }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  return useContext(DashboardFilterContext);
}
```

- [ ] **Step 2: Wrap DashboardGrid in the filter provider**

In `src/app/insights/(dashboard)/[id]/BuilderClient.tsx`, add the import and wrapper.

Add import at top:
```tsx
import { DashboardFilterProvider } from '@/components/insights/DashboardFilterContext';
```

In `BuilderClient` component, wrap the return with the provider — change the return from:
```tsx
    <DashboardProvider ...>
      <BuilderInner dashboardId={dashboardId} canEdit={canEdit} />
    </DashboardProvider>
```
to:
```tsx
    <DashboardProvider ...>
      <DashboardFilterProvider>
        <BuilderInner dashboardId={dashboardId} canEdit={canEdit} />
      </DashboardFilterProvider>
    </DashboardProvider>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/insights/DashboardFilterContext.tsx src/app/insights/\(dashboard\)/\[id\]/BuilderClient.tsx
git commit -m "feat: add DashboardFilterContext for cross-widget drill-down"
```

---

### Task 2: Upgrade L2 Comparison Widgets (Clickable Bars)

**Files:**
- Modify: `src/components/insights/widgets/OrganicPlatformCompareWidget.tsx`
- Modify: `src/components/insights/widgets/PaidPlatformCompareWidget.tsx`

- [ ] **Step 1: Rewrite `OrganicPlatformCompareWidget.tsx`**

Replace the entire file content:

```tsx
"use client";

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';
import { X } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PlatformRow {
  date: string;
  [key: string]: string | number | undefined;
}

const PLATFORM_COLOR: Record<string, string> = {
  facebook: CHART_COLORS.blue,
  instagram: CHART_COLORS.purple,
  linkedin: CHART_COLORS.teal,
  reddit: CHART_COLORS.orange,
};

const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'reddit'];

export default function OrganicPlatformCompareWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PlatformRow[] | null>(null);
  const { filters, setFilter, clearFilter } = useDashboardFilter();
  const activePlatformFilter = filters.platform;

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-by-platform?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">No organic data yet</div>;
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => row[`${p}_engagement`] != null)
  );

  const handleBarClick = (platform: string) => {
    setFilter('platform', platform);
  };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Engagement by Platform
        </div>
        {activePlatformFilter && (
          <button
            onClick={() => clearFilter('platform')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
          >
            {activePlatformFilter.charAt(0).toUpperCase() + activePlatformFilter.slice(1)}
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} style={{ cursor: 'pointer' }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {activePlatforms.map(p => (
              <Bar
                key={p}
                dataKey={`${p}_engagement`}
                name={p.charAt(0).toUpperCase() + p.slice(1)}
                stackId="a"
                fill={PLATFORM_COLOR[p]}
                onClick={() => handleBarClick(p)}
                style={{ cursor: 'pointer', transition: 'opacity 300ms ease-in-out' }}
                opacity={!activePlatformFilter || activePlatformFilter === p ? 1 : 0.2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `PaidPlatformCompareWidget.tsx`**

Replace the entire file content:

```tsx
"use client";

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { X } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PaidPlatformRow {
  date: string;
  [key: string]: string | number | undefined;
}

const PLATFORM_COLOR: Record<string, string> = {
  meta_ads: CHART_COLORS.blue,
  reddit_ads: CHART_COLORS.orange,
  linkedin_ads: CHART_COLORS.teal,
  google_ads: CHART_COLORS.green,
  tiktok_ads: CHART_COLORS.purple,
};

const PLATFORMS = ['meta_ads', 'reddit_ads', 'linkedin_ads', 'google_ads', 'tiktok_ads'];

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta', reddit_ads: 'Reddit', linkedin_ads: 'LinkedIn',
  google_ads: 'Google', tiktok_ads: 'TikTok',
};

export default function PaidPlatformCompareWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidPlatformRow[] | null>(null);
  const { filters, setFilter, clearFilter } = useDashboardFilter();
  const activePlatformFilter = filters.platform;

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-by-platform?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">No paid data yet</div>;
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => row[p] != null)
  );

  const handleBarClick = (platform: string) => {
    setFilter('platform', platform);
  };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Spend by Platform
        </div>
        {activePlatformFilter && (
          <button
            onClick={() => clearFilter('platform')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
          >
            {PLATFORM_LABEL[activePlatformFilter] || activePlatformFilter}
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} style={{ cursor: 'pointer' }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} tickFormatter={(v: number) => `$${v}`} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {activePlatforms.map(p => (
              <Bar
                key={p}
                dataKey={p}
                name={PLATFORM_LABEL[p]}
                stackId="a"
                fill={PLATFORM_COLOR[p]}
                onClick={() => handleBarClick(p)}
                style={{ cursor: 'pointer', transition: 'opacity 300ms ease-in-out' }}
                opacity={!activePlatformFilter || activePlatformFilter === p ? 1 : 0.2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/widgets/OrganicPlatformCompareWidget.tsx src/components/insights/widgets/PaidPlatformCompareWidget.tsx
git commit -m "feat: add clickable bars + filter chip to comparison widgets"
```

---

### Task 3: Upgrade L3 Detail Widgets (Filter-Aware)

**Files:**
- Modify: `src/components/insights/widgets/OrganicTopPostsWidget.tsx`
- Modify: `src/components/insights/widgets/PaidCampaignDetailWidget.tsx`

- [ ] **Step 1: Rewrite `OrganicTopPostsWidget.tsx`**

Replace the entire file content:

```tsx
"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PostRow {
  id: string;
  platform: string;
  content: string;
  engagement: number;
  source: string;
  published_at: string;
}

const PLATFORM_EMOJI: Record<string, string> = {
  facebook: '📘', instagram: '📷', linkedin: '💼', reddit: '🔶',
};

export default function OrganicTopPostsWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PostRow[] | null>(null);
  const { filters, clearFilter } = useDashboardFilter();
  const platform = filters.platform || (config.platform as string) || '';

  useEffect(() => {
    const days = (config.days as number) || 30;
    const url = `/api/insights/metrics/organic-posts?days=${days}&sort=engagement&limit=20${platform ? `&platform=${platform}` : ''}`;
    setData(null); // brief skeleton flash on filter change
    fetch(url).then(r => r.json()).then(setData).catch(() => {});
  }, [config.days, platform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  return (
    <div className="h-full flex flex-col gap-1 overflow-hidden">
      {filters.platform && (
        <button
          onClick={() => clearFilter('platform')}
          className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 mb-1"
          style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
        >
          Showing: {filters.platform.charAt(0).toUpperCase() + filters.platform.slice(1)}
          <X className="w-2.5 h-2.5" />
        </button>
      )}
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-xs">
          {filters.platform ? `No posts for ${filters.platform}` : 'No posts yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {data.map(post => (
            <div
              key={post.id}
              className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors cursor-pointer"
            >
              <span className="text-sm leading-none mt-0.5 shrink-0">
                {PLATFORM_EMOJI[post.platform] ?? '📄'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--foreground)] truncate leading-snug">
                  {post.content || '(no text)'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {post.engagement.toLocaleString()} eng
                  </span>
                  <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-medium leading-none ${
                    post.source === 'pipeline' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {post.source}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `PaidCampaignDetailWidget.tsx`**

Replace the entire file content:

```tsx
"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta', reddit_ads: 'Reddit', linkedin_ads: 'LinkedIn',
  google_ads: 'Google', tiktok_ads: 'TikTok',
};

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
}

export default function PaidCampaignDetailWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<CampaignRow[] | null>(null);
  const { filters, clearFilter } = useDashboardFilter();
  const platform = filters.platform || (config.platform as string) || 'meta_ads';

  useEffect(() => {
    const days = (config.days as number) || 30;
    setData(null); // brief skeleton flash on filter change
    fetch(`/api/insights/metrics/paid-campaigns?days=${days}&platform=${platform}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, platform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  return (
    <div className="h-full flex flex-col gap-1 overflow-hidden">
      {filters.platform && (
        <button
          onClick={() => clearFilter('platform')}
          className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 mb-1"
          style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
        >
          Showing: {PLATFORM_LABEL[filters.platform] || filters.platform}
          <X className="w-2.5 h-2.5" />
        </button>
      )}
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-xs">
          {filters.platform ? `No campaigns for ${PLATFORM_LABEL[filters.platform] || filters.platform}` : 'No campaign data yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[var(--border)]">
                <th className="text-left text-[10px] font-semibold text-[var(--muted-foreground)] py-1 pr-2">Campaign</th>
                <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Spend</th>
                <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Impr</th>
                <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Clicks</th>
                <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Conv</th>
                <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 pl-1">CPA</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.campaign_id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer transition-colors">
                  <td className="py-1.5 pr-2 text-[var(--foreground)] truncate max-w-[120px]">{row.campaign_name}</td>
                  <td className="py-1.5 px-1 text-right text-[var(--foreground)]">${row.spend.toFixed(0)}</td>
                  <td className="py-1.5 px-1 text-right text-[var(--muted-foreground)]">
                    {row.impressions >= 1000 ? `${(row.impressions / 1000).toFixed(1)}k` : row.impressions}
                  </td>
                  <td className="py-1.5 px-1 text-right text-[var(--foreground)]">{row.clicks.toLocaleString()}</td>
                  <td className="py-1.5 px-1 text-right text-[var(--foreground)]">{row.conversions.toLocaleString()}</td>
                  <td className="py-1.5 pl-1 text-right text-[var(--foreground)]">
                    {row.cpa > 0 ? `$${row.cpa.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/widgets/OrganicTopPostsWidget.tsx src/components/insights/widgets/PaidCampaignDetailWidget.tsx
git commit -m "feat: add filter-awareness + gradient chip to detail widgets"
```

---

### Task 4: Upgrade L1 KPI Widgets (Filter-Aware)

**Files:**
- Modify: `src/components/insights/widgets/OrganicKpiWidget.tsx`
- Modify: `src/components/insights/widgets/PaidKpiWidget.tsx`

- [ ] **Step 1: Rewrite `OrganicKpiWidget.tsx`**

Replace the entire file content:

```tsx
"use client";

import { useEffect, useState } from 'react';
import { Eye, Users, TrendingUp, MousePointerClick } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

interface OrganicOverview {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  followers_delta: number;
  engagement_rate: number;
  per_platform?: Record<string, {
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    follower_delta: number;
    post_count: number;
  }>;
}

export default function OrganicKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<OrganicOverview | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.platform;

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-overview?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  // If filtered to a platform, show that platform's numbers
  const pp = activePlatform && data.per_platform?.[activePlatform];
  const d = pp
    ? { impressions: pp.impressions, reach: pp.reach, engagement: pp.engagement, clicks: pp.clicks, followers_delta: pp.follower_delta, engagement_rate: pp.reach > 0 ? (pp.engagement / pp.reach * 100) : 0 }
    : data;

  const subtitle = activePlatform
    ? activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)
    : 'All Platforms';

  const cards = [
    { label: 'Impressions', value: d.impressions.toLocaleString(), Icon: Eye },
    { label: 'Reach', value: d.reach.toLocaleString(), Icon: Users },
    { label: 'Engagement', value: d.engagement.toLocaleString(), Icon: TrendingUp },
    { label: 'Clicks', value: d.clicks.toLocaleString(), Icon: MousePointerClick },
    { label: 'Followers +/-', value: (d.followers_delta >= 0 ? '+' : '') + d.followers_delta.toLocaleString(), Icon: Users },
    { label: 'Eng Rate', value: `${d.engagement_rate.toFixed(2)}%`, Icon: TrendingUp },
  ];

  return (
    <div className="h-full flex flex-col gap-1">
      <div className="text-[9px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider text-center">{subtitle}</div>
      <div className="flex-1 grid grid-cols-3 gap-2 content-start">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="px-3 py-3 rounded-lg bg-[var(--muted)] cursor-pointer flex flex-col items-center gap-1 hover:bg-[#ebebeb] transition-colors">
            <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
            <div className="text-sm font-bold text-[var(--foreground)] leading-none">{value}</div>
            <div className="text-[10px] text-[var(--muted-foreground)] text-center">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `PaidKpiWidget.tsx`**

Replace the entire file content:

```tsx
"use client";

import { useEffect, useState } from 'react';
import { DollarSign, Eye, MousePointerClick, Target, TrendingUp } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PaidOverview {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
  per_platform?: Record<string, {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpa: number;
  }>;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta', reddit_ads: 'Reddit', linkedin_ads: 'LinkedIn',
  google_ads: 'Google', tiktok_ads: 'TikTok',
};

export default function PaidKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidOverview | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.platform;

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-overview?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const pp = activePlatform && data.per_platform?.[activePlatform];
  const d = pp
    ? { spend: pp.spend, impressions: pp.impressions, clicks: pp.clicks, conversions: pp.conversions, cpa: pp.cpa, ctr: pp.impressions > 0 ? (pp.clicks / pp.impressions * 100) : 0 }
    : data;

  const subtitle = activePlatform
    ? PLATFORM_LABEL[activePlatform] || activePlatform
    : 'All Platforms';

  const cards = [
    { label: 'Spend', value: `$${d.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, Icon: DollarSign },
    { label: 'Impressions', value: d.impressions.toLocaleString(), Icon: Eye },
    { label: 'Clicks', value: d.clicks.toLocaleString(), Icon: MousePointerClick },
    { label: 'Conversions', value: d.conversions.toLocaleString(), Icon: Target },
    { label: 'CPA', value: `$${d.cpa.toFixed(2)}`, Icon: DollarSign },
    { label: 'CTR', value: `${d.ctr.toFixed(2)}%`, Icon: TrendingUp },
  ];

  return (
    <div className="h-full flex flex-col gap-1">
      <div className="text-[9px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider text-center">{subtitle}</div>
      <div className="flex-1 grid grid-cols-3 gap-2 content-start">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="px-3 py-3 rounded-lg bg-[var(--muted)] cursor-pointer flex flex-col items-center gap-1 hover:bg-[#ebebeb] transition-colors">
            <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
            <div className="text-sm font-bold text-[var(--foreground)] leading-none">{value}</div>
            <div className="text-[10px] text-[var(--muted-foreground)] text-center">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/widgets/OrganicKpiWidget.tsx src/components/insights/widgets/PaidKpiWidget.tsx
git commit -m "feat: add filter-awareness to KPI widgets (show per-platform when drilled)"
```

---

### Task 5: Seed 4 Pre-Built Dashboards

**Files:**
- Create: `src/lib/db/seed-dashboards.ts`
- Modify: `src/lib/db/schema.ts` (add call to seedPrebuiltDashboards at end of runMigrations)

- [ ] **Step 1: Create `src/lib/db/seed-dashboards.ts`**

This file defines all 4 dashboard layouts and inserts them idempotently.

```typescript
import { getDb } from '@/lib/db';
import type { DashboardLayoutData, WidgetInstance, GridLayoutItem } from '@/components/insights/types';

function w(id: string, type: string, title: string, config: Record<string, unknown> = {}): WidgetInstance {
  return { id, type: type as any, title, config };
}

function g(i: string, x: number, y: number, w: number, h: number, minW = 4, minH = 2): GridLayoutItem {
  return { i, x, y, w, h, minW, minH };
}

// Responsive: md = full-width pairs become stacked, sm = everything single column
function responsiveLayouts(lgLayout: GridLayoutItem[]): { lg: GridLayoutItem[]; md: GridLayoutItem[]; sm: GridLayoutItem[] } {
  // md: 8 cols — side-by-side pairs become 4+4, full-width becomes 8
  const md = lgLayout.map(item => ({
    ...item,
    w: item.w >= 12 ? 8 : 4,
    x: item.w >= 12 ? 0 : (item.x >= 6 ? 4 : 0),
  }));
  // sm: 4 cols — everything stacked
  let smY = 0;
  const sm = lgLayout.map(item => {
    const smItem = { ...item, w: 4, x: 0, y: smY };
    smY += item.h;
    return smItem;
  });
  return { lg: lgLayout, md, sm };
}

const EXECUTIVE_OVERVIEW: DashboardLayoutData = {
  widgets: [
    w('exec-paid-kpi', 'paid-kpi', 'Paid Performance', { days: 30 }),
    w('exec-organic-kpi', 'organic-kpi', 'Organic Performance', { days: 30 }),
    w('exec-paid-compare', 'paid-platform-compare', 'Paid — By Platform', { days: 30 }),
    w('exec-organic-compare', 'organic-platform-compare', 'Organic — By Platform', { days: 30 }),
    w('exec-attribution', 'organic-attribution', 'AI vs Manual Content', { days: 30 }),
    w('exec-growth', 'organic-account-growth', 'Follower Growth', { days: 90 }),
    w('exec-top-posts', 'organic-top-posts', 'Top Performing Posts', { days: 30 }),
  ],
  gridLayouts: responsiveLayouts([
    g('exec-paid-kpi', 0, 0, 12, 2, 6, 2),
    g('exec-organic-kpi', 0, 2, 12, 2, 6, 2),
    g('exec-paid-compare', 0, 4, 6, 4),
    g('exec-organic-compare', 6, 4, 6, 4),
    g('exec-attribution', 0, 8, 6, 4),
    g('exec-growth', 6, 8, 6, 4),
    g('exec-top-posts', 0, 12, 12, 5, 6, 3),
  ]),
};

const ORGANIC_SOCIAL: DashboardLayoutData = {
  widgets: [
    w('org-kpi', 'organic-kpi', 'Organic Overview', { days: 30 }),
    w('org-compare', 'organic-platform-compare', 'Engagement by Platform', { days: 30 }),
    w('org-growth', 'organic-account-growth', 'Follower Growth', { days: 90 }),
    w('org-attribution', 'organic-attribution', 'Pipeline vs Manual', { days: 30 }),
    w('org-gsc', 'gsc-performance', 'Search Performance', { days: 28 }),
    w('org-posts', 'organic-top-posts', 'Top Posts', { days: 30 }),
  ],
  gridLayouts: responsiveLayouts([
    g('org-kpi', 0, 0, 12, 2, 6, 2),
    g('org-compare', 0, 2, 6, 4),
    g('org-growth', 6, 2, 6, 4),
    g('org-attribution', 0, 6, 6, 4),
    g('org-gsc', 6, 6, 6, 5, 4, 3),
    g('org-posts', 0, 11, 12, 5, 6, 3),
  ]),
};

const PAID_MEDIA: DashboardLayoutData = {
  widgets: [
    w('paid-kpi', 'paid-kpi', 'Paid Overview', { days: 30 }),
    w('paid-compare', 'paid-platform-compare', 'Spend by Platform', { days: 30 }),
    w('paid-roi', 'campaign-roi', 'Campaign Link ROI', { days: 30 }),
    w('paid-campaigns', 'paid-campaign-detail', 'Campaign Breakdown', { days: 30 }),
    w('paid-utm', 'utm-funnel', 'UTM Attribution', { days: 30 }),
    w('paid-leaderboard', 'recruiter-leaderboard', 'Recruiter Leaderboard', { days: 30 }),
  ],
  gridLayouts: responsiveLayouts([
    g('paid-kpi', 0, 0, 12, 2, 6, 2),
    g('paid-compare', 0, 2, 6, 4),
    g('paid-roi', 6, 2, 6, 4),
    g('paid-campaigns', 0, 6, 12, 5, 6, 3),
    g('paid-utm', 0, 11, 6, 4),
    g('paid-leaderboard', 6, 11, 6, 4),
  ]),
};

const RECRUITMENT_PIPELINE: DashboardLayoutData = {
  widgets: [
    w('pipe-kpi', 'kpi-cards', 'Pipeline KPIs', {}),
    w('pipe-status', 'pipeline-overview', 'Status Breakdown', {}),
    w('pipe-urgency', 'urgency-breakdown', 'Urgency Split', {}),
    w('pipe-timeline', 'campaign-timeline', 'Campaign Timeline', {}),
    w('pipe-creative', 'creative-performance', 'Creative Performance', {}),
    w('pipe-assets', 'asset-gallery', 'Asset Summary', {}),
    w('pipe-workers', 'worker-health', 'Worker Health', {}),
    w('pipe-regions', 'region-map', 'Regional Spread', {}),
  ],
  gridLayouts: responsiveLayouts([
    g('pipe-kpi', 0, 0, 12, 2, 6, 2),
    g('pipe-status', 0, 2, 6, 4),
    g('pipe-urgency', 6, 2, 6, 4, 3, 2),
    g('pipe-timeline', 0, 6, 12, 4, 6, 3),
    g('pipe-creative', 0, 10, 6, 4),
    g('pipe-assets', 6, 10, 6, 4),
    g('pipe-workers', 0, 14, 6, 3),
    g('pipe-regions', 6, 14, 6, 4),
  ]),
};

const DASHBOARDS = [
  { title: 'Executive Overview', description: 'Marketing performance at a glance — paid headline, organic presence, AI vs manual, top content.', layout: EXECUTIVE_OVERVIEW },
  { title: 'Organic Social', description: 'Organic social performance — platform engagement, follower growth, pipeline attribution, search visibility.', layout: ORGANIC_SOCIAL },
  { title: 'Paid Media', description: 'Paid ad spend performance — platform distribution, campaign breakdown, UTM attribution, recruiter leaderboard.', layout: PAID_MEDIA },
  { title: 'Recruitment Pipeline', description: 'Campaign operations — pipeline status, urgency, timeline, creative output, worker health.', layout: RECRUITMENT_PIPELINE },
];

export async function seedPrebuiltDashboards(): Promise<void> {
  const sql = getDb();

  for (const dash of DASHBOARDS) {
    const existing = await sql`
      SELECT id FROM dashboards WHERE created_by = 'system' AND title = ${dash.title}
    `;
    if (existing.length > 0) continue;

    await sql`
      INSERT INTO dashboards (title, description, layout_data, created_by, is_template)
      VALUES (${dash.title}, ${dash.description}, ${JSON.stringify(dash.layout)}::jsonb, 'system', FALSE)
    `;
  }
}
```

- [ ] **Step 2: Wire seed into `src/lib/db/schema.ts`**

Add import at top of schema.ts:
```typescript
import { seedPrebuiltDashboards } from './seed-dashboards';
```

Add call at end of `runMigrations()` function, after the existing `seedDefaultTemplate()` call (line 1361):
```typescript
  // Seed pre-built dashboards (Executive Overview, Organic Social, Paid Media, Pipeline)
  await seedPrebuiltDashboards();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/seed-dashboards.ts src/lib/db/schema.ts
git commit -m "feat: seed 4 pre-built story dashboards (exec, organic, paid, pipeline)"
```

---

### Task 6: Verify + Deploy

- [ ] **Step 1: TypeScript check**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit --pretty 2>&1 | head -10
```

Expected: No new errors.

- [ ] **Step 2: Test dev server loads dashboards**

```bash
cd /Users/stevenjunop/centric-intake && npm run dev &
sleep 5
curl -s http://localhost:3000/api/insights | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} dashboards'); [print(f'  - {x[\"title\"]}') for x in d]" 2>&1
kill %1
```

Expected: 4+ dashboards listed including "Executive Overview", "Organic Social", "Paid Media", "Recruitment Pipeline".

- [ ] **Step 3: Deploy to production**

```bash
cd /Users/stevenjunop/centric-intake && vercel --prod
```

- [ ] **Step 4: Set nova-intake alias**

```bash
vercel alias <deployment-url> nova-intake.vercel.app
```

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: dashboard + drill-down deployment fixes"
```
