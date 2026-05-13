"use client";

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, LINE_STYLE, ANIMATION_CONFIG } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface GrowthRow {
  date: string;
  facebook?: number;
  instagram?: number;
  linkedin?: number;
  reddit?: number;
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

export default function OrganicAccountGrowthWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<GrowthRow[] | null>(null);
  const { filters } = useDashboardFilter();

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/account-growth?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, filters.dateRange]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#a3a3a3] text-xs">
        No follower data yet
      </div>
    );
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => (row as unknown as Record<string, unknown>)[p] != null)
  );

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header + custom dot legend */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">
          Follower Growth
        </p>
        <div className="flex items-center gap-3">
          {activePlatforms.map(p => (
            <div key={p} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: PLATFORM_COLOR[p] }}
              />
              <span className="text-[10px] text-[#525252]">
                {PLATFORM_LABEL[p] ?? p}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            {activePlatforms.map(p => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                name={PLATFORM_LABEL[p] ?? p}
                stroke={PLATFORM_COLOR[p]}
                {...LINE_STYLE}
                {...ANIMATION_CONFIG.line}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
