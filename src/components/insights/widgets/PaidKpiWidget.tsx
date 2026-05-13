"use client";

import { useEffect, useState } from 'react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { formatCompact, formatCurrency, formatPct } from '../chartTheme';

interface PaidOverview {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
  per_platform?: Record<string, {
    spend: number; impressions: number; clicks: number; conversions: number; cpa: number;
  }>;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta', reddit_ads: 'Reddit', linkedin_ads: 'LinkedIn',
  google_ads: 'Google', tiktok_ads: 'TikTok',
};

export default function PaidKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidOverview | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.platform;

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/paid-overview?days=${days}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [config.days, filters.dateRange]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const pp = activePlatform && data.per_platform?.[activePlatform];
  const d = pp
    ? { spend: pp.spend, impressions: pp.impressions, clicks: pp.clicks, conversions: pp.conversions, cpa: pp.cpa, ctr: pp.impressions > 0 ? (pp.clicks / pp.impressions * 100) : 0 }
    : data;

  const subtitle = activePlatform
    ? PLATFORM_LABEL[activePlatform] || activePlatform : 'All Platforms';

  const kpis = [
    { label: 'Total Spend', value: formatCurrency(d.spend) },
    { label: 'Impressions', value: formatCompact(d.impressions) },
    { label: 'Clicks', value: formatCompact(d.clicks) },
    { label: 'Conversions', value: formatCompact(d.conversions) },
    { label: 'Avg CPA', value: d.cpa > 0 ? formatCurrency(d.cpa, 2) : '—' },
    { label: 'CTR', value: formatPct(d.ctr) },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.1em] mb-3">
        {subtitle}
      </div>
      <div className="flex-1 grid grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 content-start">
        {kpis.map(kpi => (
          <div key={kpi.label} className="min-w-0">
            <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] mb-1">
              {kpi.label}
            </div>
            <div className="text-xl font-semibold text-[#1a1a1a] tracking-tight leading-none tabular-nums">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
