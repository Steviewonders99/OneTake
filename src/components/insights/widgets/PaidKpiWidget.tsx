"use client";

import { useEffect, useState } from 'react';
import { DollarSign, Eye, MousePointerClick, Target, TrendingUp } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PlatformStats {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
}

interface PaidOverview extends PlatformStats {
  per_platform?: Record<string, PlatformStats>;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta',
  reddit_ads: 'Reddit',
  linkedin_ads: 'LinkedIn',
  google_ads: 'Google',
  tiktok_ads: 'TikTok',
};

export default function PaidKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidOverview | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.platform;

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-overview?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const stats: PlatformStats =
    activePlatform && data.per_platform?.[activePlatform]
      ? data.per_platform[activePlatform]
      : data;

  const subtitleLabel = activePlatform
    ? (PLATFORM_LABEL[activePlatform] ?? activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1))
    : 'All Platforms';

  const cards = [
    {
      label: 'Spend',
      value: `$${stats.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      Icon: DollarSign,
    },
    { label: 'Impressions', value: stats.impressions.toLocaleString(), Icon: Eye },
    { label: 'Clicks', value: stats.clicks.toLocaleString(), Icon: MousePointerClick },
    { label: 'Conversions', value: stats.conversions.toLocaleString(), Icon: Target },
    { label: 'CPA', value: `$${stats.cpa.toFixed(2)}`, Icon: DollarSign },
    { label: 'CTR', value: `${stats.ctr.toFixed(2)}%`, Icon: TrendingUp },
  ];

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-[9px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider text-center">
        {subtitleLabel}
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2 content-start">
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
    </div>
  );
}
