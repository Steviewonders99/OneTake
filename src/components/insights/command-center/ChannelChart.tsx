'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHANNEL_COLORS, CHANNEL_DISPLAY, BRAND } from './types';
import type { ChartWeek, DateRangeValue } from './types';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '@/components/insights/chartTheme';

interface ChannelChartProps {
  data: ChartWeek[];
  allChannels: string[];
  dateRange?: DateRangeValue;
}

export function ChannelChart({ data, allChannels, dateRange }: ChannelChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Compute top 3 channels by total applications across the data
  const rankedChannels = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const week of data) {
      for (const ch of allChannels) {
        totals[ch] = (totals[ch] ?? 0) + ((week[ch] as number) ?? 0);
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([ch]) => ch);
  }, [data, allChannels]);

  const top3 = rankedChannels.slice(0, 3);
  const rest = rankedChannels.slice(3);

  const chartData = useMemo(() => {
    if (expanded) return data;
    return data.map(week => {
      const row: Record<string, number | string> = { week: week.week };
      for (const ch of top3) {
        row[ch] = (week[ch] as number) ?? 0;
      }
      row.others = rest.reduce((sum, ch) => sum + ((week[ch] as number) ?? 0), 0);
      return row as ChartWeek;
    });
  }, [data, expanded, top3, rest]);

  const visibleChannels = expanded
    ? rankedChannels.filter(c => !hidden.has(c))
    : [...top3, 'others'].filter(c => !hidden.has(c));

  const toggleChannel = (channel: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };

  const getColor = (ch: string) => ch === 'others' ? '#E5E7EB' : (CHANNEL_COLORS[ch] ?? '#A1A1AA');
  const getLabel = (ch: string) => ch === 'others' ? 'Others' : (CHANNEL_DISPLAY[ch] ?? ch);

  const rangeLabel = dateRange?.preset
    ? dateRange.preset === 'all' ? 'All Time' : `Last ${dateRange.preset} Days`
    : `${data.length} Weeks`;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
          Applications by Channel — {rangeLabel}
          {dateRange?.compare && (
            <span className="font-normal text-[11px] ml-2" style={{ color: BRAND.purple }}>
              vs previous period
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2 flex-wrap justify-end" style={{ maxWidth: 400 }}>
          {(expanded ? rankedChannels : top3).map(ch => (
            <button key={ch} onClick={() => toggleChannel(ch)}
              className={`flex items-center gap-1.5 text-[10px] transition-opacity whitespace-nowrap ${hidden.has(ch) ? 'opacity-30' : 'opacity-100'}`}
              style={{ color: BRAND.text2 }}>
              <span className="w-2 h-[3px] rounded-sm inline-block shrink-0" style={{ background: getColor(ch) }} />
              {getLabel(ch)}
            </button>
          ))}
          {rest.length > 0 && (
            <button onClick={() => { setExpanded(!expanded); setHidden(new Set()); }}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all whitespace-nowrap"
              style={{ color: expanded ? BRAND.purple : BRAND.text3, background: expanded ? '#F5F3FF' : 'transparent' }}>
              {expanded ? 'Collapse' : `+${rest.length} more`}
            </button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="week" {...AXIS_STYLE}
            tick={(tickProps: any) => {
              const { x, y, payload } = tickProps;
              const isLast = payload.index === chartData.length - 1;
              return (
                <text x={x} y={y + 12} textAnchor="middle"
                  fill={isLast ? BRAND.text : '#D1D5DB'}
                  fontSize={isLast ? 10 : 9}
                  fontWeight={isLast ? 700 : 400}
                  fontFamily="Roboto, system-ui, sans-serif">
                  {payload.value}
                </text>
              );
            }}
          />
          <YAxis {...AXIS_STYLE} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE.contentStyle} itemStyle={TOOLTIP_STYLE.itemStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle} cursor={TOOLTIP_STYLE.cursor} />
          {visibleChannels.map(ch => (
            <Area key={ch} type="monotone" dataKey={ch} name={getLabel(ch)} stackId="1"
              stroke={getColor(ch)} fill={getColor(ch)}
              fillOpacity={ch === 'others' ? 0.2 : 0.15}
              strokeWidth={ch === 'others' ? 1 : 2}
              isAnimationActive={true} animationDuration={600} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
