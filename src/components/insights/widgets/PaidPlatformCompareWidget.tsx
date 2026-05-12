"use client";

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

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

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-by-platform?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

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
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        Spend by Platform
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
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
