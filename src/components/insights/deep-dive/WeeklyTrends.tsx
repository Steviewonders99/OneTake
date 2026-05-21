'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, BAR_STYLE } from '@/components/insights/chartTheme';

/* ── Types ─────────────────────────────────────────────── */

interface WeeklyTrendsProps {
  weeks: Array<{
    week_start: string;
    total_spend: number;
    total_clicks: number;
    total_conversions: number;
    blended_cpa: number | null;
    paid_conversions: number;
    organic_clicks: number;
  }>;
}

type TabKey = 'spend_cpa' | 'conversions' | 'channel_mix';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'spend_cpa', label: 'Spend + CPA' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'channel_mix', label: 'Channel Mix' },
];

/* ── Custom tooltip ────────────────────────────────────── */

function CustomTooltip({ active, payload, label, tab }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div style={TOOLTIP_STYLE.contentStyle}>
      <div style={TOOLTIP_STYLE.labelStyle}>{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={TOOLTIP_STYLE.itemStyle}>
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ background: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-semibold" style={{ color: BRAND.text }}>
            {entry.name === 'CPA' || entry.name === 'Spend'
              ? formatEur(entry.value ?? 0)
              : (entry.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Component ─────────────────────────────────────────── */

export function WeeklyTrends({ weeks }: WeeklyTrendsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('spend_cpa');

  const chartData = useMemo(() => {
    // Sort oldest → newest (ASC) for left-to-right timeline
    const sorted = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start));
    const today = new Date();
    return sorted.map((w, i) => {
      const d = new Date(w.week_start + 'T00:00:00');
      const weekEnd = new Date(d.getTime() + 6 * 86400000);
      const isCurrentWeek = weekEnd >= today && d <= today;
      const label = isCurrentWeek ? 'This Week'
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        week: label,
        spend: Math.round(w.total_spend),
        cpa: w.blended_cpa ? Math.round(w.blended_cpa * 100) / 100 : null,
        conversions: w.total_conversions,
        paid: w.paid_conversions,
        organic: w.organic_clicks,
      };
    });
  }, [weeks]);

  if (weeks.length === 0) return null;

  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
            Performance Over Time
          </h3>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 bg-[#F6F7FB] rounded-lg p-[3px]">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-[#111827] text-white'
                  : 'text-[#9CA3AF] hover:text-[#4B5563]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <ResponsiveContainer width="100%" height={300}>
        {activeTab === 'spend_cpa' ? (
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="week" {...AXIS_STYLE} />
            <YAxis
              yAxisId="spend"
              {...AXIS_STYLE}
              width={55}
              tickFormatter={(v: number) => formatEur(v)}
            />
            <YAxis
              yAxisId="cpa"
              orientation="right"
              {...AXIS_STYLE}
              width={55}
              tickFormatter={(v: number) => formatEur(v)}
            />
            <Tooltip content={<CustomTooltip tab="spend_cpa" />} />
            <Bar
              yAxisId="spend"
              dataKey="spend"
              name="Spend"
              fill={BRAND.blue}
              fillOpacity={0.3}
              radius={BAR_STYLE.radius}
              maxBarSize={BAR_STYLE.maxBarSize}
              isAnimationActive
              animationDuration={600}
            />
            <Line
              yAxisId="cpa"
              type="monotone"
              dataKey="cpa"
              name="CPA"
              stroke={BRAND.purple}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2, fill: BRAND.purple }}
              isAnimationActive
              animationDuration={600}
              connectNulls
            />
          </ComposedChart>
        ) : activeTab === 'conversions' ? (
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="week" {...AXIS_STYLE} />
            <YAxis {...AXIS_STYLE} width={40} />
            <Tooltip content={<CustomTooltip tab="conversions" />} />
            <Bar
              dataKey="conversions"
              name="Conversions"
              fill={BRAND.purple}
              radius={BAR_STYLE.radius}
              maxBarSize={BAR_STYLE.maxBarSize}
              isAnimationActive
              animationDuration={600}
            />
          </BarChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="week" {...AXIS_STYLE} />
            <YAxis {...AXIS_STYLE} width={40} />
            <Tooltip content={<CustomTooltip tab="channel_mix" />} />
            <Bar
              dataKey="paid"
              name="Paid Conversions"
              stackId="mix"
              fill={BRAND.blue}
              radius={[0, 0, 0, 0]}
              maxBarSize={BAR_STYLE.maxBarSize}
              isAnimationActive
              animationDuration={600}
            />
            <Bar
              dataKey="organic"
              name="Organic Clicks"
              stackId="mix"
              fill={BRAND.purple}
              radius={BAR_STYLE.radius}
              maxBarSize={BAR_STYLE.maxBarSize}
              isAnimationActive
              animationDuration={600}
            />
          </BarChart>
        )}
      </ResponsiveContainer>

      {/* Legend — manual for clarity */}
      <div className="flex justify-center gap-5 mt-3">
        {activeTab === 'spend_cpa' && (
          <>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: BRAND.text2 }}>
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: BRAND.blue, opacity: 0.3 }} />
              Spend
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: BRAND.text2 }}>
              <span className="w-3 h-[2px] rounded-sm inline-block" style={{ background: BRAND.purple }} />
              CPA
            </div>
          </>
        )}
        {activeTab === 'conversions' && (
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: BRAND.text2 }}>
            <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: BRAND.purple }} />
            Total Conversions
          </div>
        )}
        {activeTab === 'channel_mix' && (
          <>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: BRAND.text2 }}>
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: BRAND.blue }} />
              Paid Conversions
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: BRAND.text2 }}>
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: BRAND.purple }} />
              Organic Clicks
            </div>
          </>
        )}
      </div>
    </div>
  );
}
