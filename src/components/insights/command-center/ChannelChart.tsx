'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CHANNEL_COLORS, CHANNEL_DISPLAY, TOP_CHANNELS, BRAND } from './types';
import type { ChartWeek } from './types';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '@/components/insights/chartTheme';

interface ChannelChartProps {
  data: ChartWeek[];
  allChannels: string[];
}

export function ChannelChart({ data, allChannels }: ChannelChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const otherChannels = useMemo(
    () => allChannels.filter(c => !TOP_CHANNELS.includes(c)),
    [allChannels]
  );

  const chartData = useMemo(() => {
    if (expanded) return data;
    return data.map(week => {
      const row: Record<string, number | string> = { week: week.week };
      for (const ch of TOP_CHANNELS) {
        row[ch] = (week[ch] as number) ?? 0;
      }
      row.others = otherChannels.reduce((sum, ch) => sum + ((week[ch] as number) ?? 0), 0);
      return row as ChartWeek;
    });
  }, [data, expanded, otherChannels]);

  const visibleChannels = expanded
    ? [...TOP_CHANNELS, ...otherChannels].filter(c => !hidden.has(c))
    : [...TOP_CHANNELS, 'others'].filter(c => !hidden.has(c));

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

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
          Applications by Channel — Last 8 Weeks
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {(expanded ? [...TOP_CHANNELS, ...otherChannels] : [...TOP_CHANNELS]).map(ch => (
            <button key={ch} onClick={() => toggleChannel(ch)}
              className={`flex items-center gap-1.5 text-[11px] transition-opacity ${hidden.has(ch) ? 'opacity-30' : 'opacity-100'}`}
              style={{ color: BRAND.text2 }}>
              <span className="w-2.5 h-[3px] rounded-sm inline-block" style={{ background: getColor(ch) }} />
              {getLabel(ch)}
            </button>
          ))}
          <button onClick={() => { setExpanded(!expanded); setHidden(new Set()); }}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all"
            style={{ color: expanded ? BRAND.purple : BRAND.text3, background: expanded ? '#F5F3FF' : 'transparent' }}>
            {expanded ? '◂ Collapse' : '▸ Others'}
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
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
