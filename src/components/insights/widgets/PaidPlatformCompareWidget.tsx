"use client";

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, BAR_STYLE, formatCurrency, ANIMATION_CONFIG } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';
import { FilterChip } from '../FilterChip';

interface PaidPlatformRow {
  date: string;
  meta_ads?: number;
  reddit_ads?: number;
  linkedin_ads?: number;
  google_ads?: number;
  tiktok_ads?: number;
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
  meta_ads: 'Meta',
  reddit_ads: 'Reddit',
  linkedin_ads: 'LinkedIn',
  google_ads: 'Google',
  tiktok_ads: 'TikTok',
};

export default function PaidPlatformCompareWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidPlatformRow[] | null>(null);
  const { filters, setFilter, clearFilter } = useDashboardFilter();
  const activePlatformFilter = filters.platform;

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/paid-by-platform?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, filters.dateRange]);

  function handleBarClick(platform: string) {
    setFilter('platform', platform);
  }

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#a3a3a3] text-xs">
        No paid data yet
      </div>
    );
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => (row as unknown as Record<string, unknown>)[p] != null)
  );

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">
          Spend by Platform
        </p>
        {activePlatformFilter && PLATFORM_LABEL[activePlatformFilter] && (
          <FilterChip label={PLATFORM_LABEL[activePlatformFilter] || activePlatformFilter} onClear={() => clearFilter('platform')} />
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} tickFormatter={(v: number) => formatCurrency(v)} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v) => formatCurrency(Number(v))}
            />
            {activePlatforms.map(p => (
              <Bar
                key={p}
                dataKey={p}
                name={PLATFORM_LABEL[p]}
                stackId="a"
                fill={PLATFORM_COLOR[p]}
                onClick={() => handleBarClick(p)}
                style={{ cursor: 'pointer', transition: 'opacity 300ms ease-in-out' }}
                opacity={!activePlatformFilter || activePlatformFilter === p ? 1 : 0.15}
                {...BAR_STYLE}
                {...ANIMATION_CONFIG.bar}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom dot legend */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {activePlatforms.map(p => (
          <button
            key={p}
            onClick={() => handleBarClick(p)}
            className="flex items-center gap-1 cursor-pointer"
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: PLATFORM_COLOR[p] }}
            />
            <span
              className="text-[10px]"
              style={{ color: !activePlatformFilter || activePlatformFilter === p ? '#525252' : '#d4d4d4' }}
            >
              {PLATFORM_LABEL[p]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
