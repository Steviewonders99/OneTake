"use client";

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, BAR_STYLE } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';
import { FilterChip } from '../FilterChip';

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

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', reddit: 'Reddit',
};

const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'reddit'];

export default function OrganicPlatformCompareWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PlatformRow[] | null>(null);
  const { filters, setFilter, clearFilter } = useDashboardFilter();
  const activePlatformFilter = filters.platform;

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/organic-by-platform?days=${days}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [config.days, filters.dateRange]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-[#a3a3a3] text-xs">No organic data yet</div>;
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => row[`${p}_engagement`] != null)
  );

  return (
    <div className="h-full flex flex-col gap-3">
      {activePlatformFilter && PLATFORM_LABEL[activePlatformFilter] && (
        <FilterChip label={PLATFORM_LABEL[activePlatformFilter] || activePlatformFilter} onClear={() => clearFilter('platform')} />
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} />
            <YAxis {...AXIS_STYLE} width={35} />
            <Tooltip {...TOOLTIP_STYLE} />
            {activePlatforms.map(p => (
              <Bar
                key={p}
                dataKey={`${p}_engagement`}
                name={PLATFORM_LABEL[p]}
                stackId="a"
                fill={PLATFORM_COLOR[p]}
                {...BAR_STYLE}
                onClick={() => setFilter('platform', p)}
                style={{ cursor: 'pointer', transition: 'opacity 300ms ease-in-out' }}
                opacity={!activePlatformFilter || activePlatformFilter === p ? 0.85 : 0.15}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Minimal legend */}
      <div className="flex items-center gap-4 justify-center">
        {activePlatforms.map(p => (
          <button
            key={p}
            onClick={() => setFilter('platform', p)}
            className="flex items-center gap-1.5 cursor-pointer group"
          >
            <div
              className="w-2 h-2 rounded-full transition-opacity"
              style={{
                backgroundColor: PLATFORM_COLOR[p],
                opacity: !activePlatformFilter || activePlatformFilter === p ? 1 : 0.3,
              }}
            />
            <span className="text-[10px] text-[#a3a3a3] group-hover:text-[#525252] transition-colors">
              {PLATFORM_LABEL[p]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
