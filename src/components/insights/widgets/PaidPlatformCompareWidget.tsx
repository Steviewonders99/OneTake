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
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-by-platform?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  function handleBarClick(platform: string) {
    setFilter('platform', platform);
  }

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">
        No paid data yet
      </div>
    );
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => (row as unknown as Record<string, unknown>)[p] != null)
  );

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Spend by Platform
        </div>
        {activePlatformFilter && PLATFORM_LABEL[activePlatformFilter] && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
          >
            {PLATFORM_LABEL[activePlatformFilter]}
            <button
              onClick={() => clearFilter('platform')}
              className="flex items-center cursor-pointer"
              aria-label="Clear platform filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
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
                style={{
                  cursor: 'pointer',
                  transition: 'opacity 300ms ease-in-out',
                }}
                opacity={!activePlatformFilter || activePlatformFilter === p ? 1 : 0.2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
