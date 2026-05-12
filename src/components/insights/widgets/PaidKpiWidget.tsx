"use client";

import { useEffect, useState } from 'react';
import { DollarSign, Eye, MousePointerClick, Target, TrendingUp } from 'lucide-react';

interface PaidOverview {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
}

export default function PaidKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidOverview | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-overview?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const cards = [
    { label: 'Spend', value: `$${data.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, Icon: DollarSign },
    { label: 'Impressions', value: data.impressions.toLocaleString(), Icon: Eye },
    { label: 'Clicks', value: data.clicks.toLocaleString(), Icon: MousePointerClick },
    { label: 'Conversions', value: data.conversions.toLocaleString(), Icon: Target },
    { label: 'CPA', value: `$${data.cpa.toFixed(2)}`, Icon: DollarSign },
    { label: 'CTR', value: `${data.ctr.toFixed(2)}%`, Icon: TrendingUp },
  ];

  return (
    <div className="h-full grid grid-cols-3 gap-2 content-start">
      {cards.map(({ label, value, Icon }) => (
        <div
          key={label}
          className="px-3 py-3 rounded-lg bg-[var(--muted)] cursor-pointer flex flex-col items-center gap-1 hover:bg-[#ebebeb] transition-colors"
        >
          <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
          <div className="text-sm font-bold text-[var(--foreground)] leading-none">{value}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] text-center">{label}</div>
        </div>
      ))}
    </div>
  );
}
