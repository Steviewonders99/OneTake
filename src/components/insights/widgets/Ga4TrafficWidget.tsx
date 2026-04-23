"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Unplug } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface Ga4Data {
  connected: boolean;
  total_sessions: number;
  total_engaged: number;
  total_conversions: number;
  by_source: { source: string; sessions: number; conversions: number }[];
  by_country: { country: string; sessions: number }[];
  by_device: { device_category: string; sessions: number }[];
}

export default function Ga4TrafficWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Ga4Data | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/ga4-traffic?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">GA4 Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Configure analytics-mcp and trigger a sync to enable</p>
      </div>
    );
  }

  const engagementRate = data.total_sessions > 0 ? Math.round((data.total_engaged / data.total_sessions) * 100) : 0;

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sessions', value: data.total_sessions.toLocaleString() },
          { label: 'Engaged', value: `${engagementRate}%` },
          { label: 'Conversions', value: data.total_conversions.toLocaleString() },
        ].map(c => (
          <div key={c.label} className="px-3 py-2 rounded-lg bg-[var(--muted)] text-center">
            <div className="text-[10px] text-[var(--muted-foreground)]">{c.label}</div>
            <div className="text-sm font-bold text-[var(--foreground)]">{c.value}</div>
          </div>
        ))}
      </div>
      {data.by_source.length > 0 && (
        <div className="flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">By Source</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_source.slice(0, 6)}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="source" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="sessions" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
