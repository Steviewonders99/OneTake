"use client";

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { X } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PlatformRow {
  date: string;
  facebook_engagement?: number;
  instagram_engagement?: number;
  linkedin_engagement?: number;
  reddit_engagement?: number;
}

const PLATFORM_COLOR: Record<string, string> = {
  facebook: CHART_COLORS.blue,
  instagram: CHART_COLORS.purple,
  linkedin: CHART_COLORS.teal,
  reddit: CHART_COLORS.orange,
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
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

  function handleBarClick(platform: string) {
    setFilter('platform', platform);
  }

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">
        No organic data yet
      </div>
    );
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => (row as unknown as Record<string, unknown>)[`${p}_engagement`] != null)
  );

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Engagement by Platform
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
