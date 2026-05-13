"use client";

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, LINE_STYLE, ANIMATION_CONFIG } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

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
  const { filters } = useDashboardFilter();

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/gsc-performance?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, filters.dateRange]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1.5 text-center p-4">
        <p className="text-[11px] font-semibold text-[#1a1a1a]">GSC Not Connected</p>
        <p className="text-[10px] text-[#a3a3a3]">
          Configure Google Search Console and trigger a sync to enable
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Click trend mini chart */}
      {data.click_trend.length > 0 && (
        <div className="h-24 shrink-0">
          <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] mb-1">
            Click Trend
          </p>
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
                {...LINE_STYLE}
                {...ANIMATION_CONFIG.line}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top queries */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] mb-1.5">
          Top Queries
        </p>
        {data.top_queries.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-[#a3a3a3] text-xs">
            No query data yet
          </div>
        ) : (
          data.top_queries.map((q, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#f5f5f5] last:border-0">
              <span className="flex-1 text-[11px] text-[#1a1a1a] truncate">{q.query}</span>
              <span className="text-[10px] font-semibold text-[#1a1a1a] shrink-0 tabular-nums">
                {q.clicks.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#a3a3a3] shrink-0 w-10 text-right tabular-nums">
                #{q.position.toFixed(1)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
