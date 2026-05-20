// src/components/insights/command-center/HeroMetrics.tsx
'use client';

import { BRAND } from './types';
import { formatEur } from './utils';

interface HeroMetricsProps {
  totalConversions: number;
  previousConversions: number;
  avg30dConversions: number;
  blendedCpa: number | null;
  previousCpa: number | null;
  roas: number | null;
  breakevenCpa: number | null;
  organicShare: number;
  organicCount: number;
  totalCount: number;
  organicShare30dAgo: number;
}

export function HeroMetrics(props: HeroMetricsProps) {
  const convDelta = props.previousConversions > 0
    ? ((props.totalConversions - props.previousConversions) / props.previousConversions * 100)
    : null;
  const cpaDelta = props.previousCpa && props.previousCpa > 0 && props.blendedCpa
    ? ((props.blendedCpa - props.previousCpa) / props.previousCpa * 100)
    : null;

  const cards = [
    {
      gradient: BRAND.gradDeep,
      eyebrow: 'Total Applications This Week',
      number: props.totalConversions.toLocaleString(),
      delta: convDelta !== null
        ? `${convDelta > 0 ? '↑' : '↓'} ${Math.abs(Math.round(convDelta))}% vs last week (${props.previousConversions})`
        : 'First week of data',
      benchmark: `30-day avg: ${props.avg30dConversions}`,
    },
    {
      gradient: BRAND.gradCool,
      eyebrow: 'Blended CPA (All Channels)',
      number: props.blendedCpa !== null ? formatEur(props.blendedCpa) : '—',
      delta: cpaDelta !== null
        ? `${cpaDelta < 0 ? '↓' : '↑'} ${Math.abs(Math.round(cpaDelta))}%${cpaDelta < 0 ? ' — improving' : ''}`
        : '—',
      benchmark: props.breakevenCpa
        ? `Breakeven: ${formatEur(props.breakevenCpa)}${props.roas ? ` · ROAS: ${props.roas.toFixed(1)}x` : ''}`
        : '',
    },
    {
      gradient: BRAND.gradWarm,
      eyebrow: 'Non-Paid Acquisition Share',
      number: `${Math.round(props.organicShare)}%`,
      delta: `${props.organicCount.toLocaleString()} of ${props.totalCount.toLocaleString()} at zero ad spend`,
      benchmark: `vs ${Math.round(props.organicShare30dAgo)}% non-paid 30 days ago`,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl p-7 text-white"
          style={{ background: card.gradient, boxShadow: '0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)' }}
        >
          <div className="absolute -top-1/2 -right-[30%] w-[60%] h-[200%] pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)' }} />
          <div className="relative z-10">
            <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-2.5 font-medium">{card.eyebrow}</div>
            <div className="text-[48px] font-black leading-none tracking-tight">{card.number}</div>
            <div className="text-[13px] mt-2 font-medium opacity-85">{card.delta}</div>
            {card.benchmark && <div className="text-[11px] mt-1 opacity-50">{card.benchmark}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
