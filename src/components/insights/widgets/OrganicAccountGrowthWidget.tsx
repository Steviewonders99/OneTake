"use client";

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

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

const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'reddit'];

export default function OrganicAccountGrowthWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<GrowthRow[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/account-growth?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">
        No follower data yet
      </div>
    );
  }

  const activePlatforms = PLATFORMS.filter(p =>
    data.some(row => (row as unknown as Record<string, unknown>)[p] != null)
  );

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        Follower Growth
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {activePlatforms.map(p => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                name={p.charAt(0).toUpperCase() + p.slice(1)}
                stroke={PLATFORM_COLOR[p]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
