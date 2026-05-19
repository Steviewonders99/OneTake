'use client';

import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';

interface ChannelHeroMetricsProps {
  sessions: number;
  users: number;
  conversions: number;
  convRate: number;
  cost: number;
  isPaid: boolean;
  // Optional paid-specific
  impressions?: number;
  clicks?: number;
  cpa?: number;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en');
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function formatRoas(cost: number, conversions: number): string {
  if (cost === 0) return '--';
  // ROAS as a multiplier: conversions value / cost
  // Simplified as conversion-to-cost ratio for now
  const ratio = conversions / (cost / 100);
  return `${ratio.toFixed(1)}x`;
}

export function ChannelHeroMetrics(props: ChannelHeroMetricsProps) {
  const { sessions, conversions, convRate, cost, isPaid, cpa, impressions, clicks } = props;

  const paidItems = [
    { num: formatNum(sessions), label: 'Sessions' },
    { num: formatNum(conversions), label: 'Conversions' },
    { num: cpa != null ? formatEur(cpa) : formatEur(cost > 0 && conversions > 0 ? cost / conversions : 0), label: 'CPA' },
    { num: formatEur(cost), label: 'Total Spend' },
    { num: formatRoas(cost, conversions), label: 'ROAS' },
  ];

  const organicItems = [
    { num: formatNum(sessions), label: 'Sessions' },
    { num: formatNum(conversions), label: 'Conversions' },
    { num: formatPct(convRate), label: 'Conv Rate' },
    { num: clicks != null ? formatNum(clicks) : '--', label: 'Landing Pages' },
    { num: formatEur(cost), label: 'Cost' },
  ];

  const items = isPaid ? paidItems : organicItems;

  return (
    <div className="grid grid-cols-5 gap-2.5 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl px-4 py-3.5 text-center border border-black/[0.08]"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div
            className="text-[24px] font-extrabold tracking-tight"
            style={{ color: BRAND.text }}
          >
            {item.num}
          </div>
          <div
            className="text-[8px] uppercase tracking-[0.1em] mt-0.5"
            style={{ color: BRAND.text3 }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
