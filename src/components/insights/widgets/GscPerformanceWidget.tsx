"use client";

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { Unplug } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface ClickTrendRow {
  date: string;
  clicks: number;
}

interface GscData {
  connected: boolean;
  click_trend: ClickTrendRow[];
  top_queries: QueryRow[];
}

export default function GscPerformanceWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<GscData | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/gsc-performance?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">GSC Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          Configure Google Search Console and trigger a sync to enable
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Click trend mini chart */}
      {data.click_trend.length > 0 && (
        <div className="h-24">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            Click Trend
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.click_trend}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top queries */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
          Top Queries
        </div>
        {data.top_queries.map((q, i) => (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-[var(--border)] last:border-0">
            <span className="flex-1 text-[11px] text-[var(--foreground)] truncate">{q.query}</span>
            <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
              {q.clicks.toLocaleString()} clicks
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)] shrink-0 w-10 text-right">
              #{q.position.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
