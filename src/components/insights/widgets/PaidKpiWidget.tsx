"use client";

import { useEffect, useState } from 'react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { formatCompact, formatCurrency, formatPct } from '../chartTheme';
import { Sparkline } from '../Sparkline';

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

interface PaidTrends {
  paid_daily: Array<{ date: string; spend: number; impressions: number; clicks: number; conversions: number }>;
  paid_deltas: { spend: number; impressions: number; clicks: number; conversions: number };
}

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta', reddit_ads: 'Reddit', linkedin_ads: 'LinkedIn',
  google_ads: 'Google', tiktok_ads: 'TikTok',
};

export default function PaidKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidOverview | null>(null);
  const [trends, setTrends] = useState<PaidTrends | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.paidPlatform;

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/paid-overview?days=${days}`)
      .then(r => r.json()).then(setData).catch(() => {});
    fetch(`/api/insights/metrics/kpi-trends?days=${days}`)
      .then(r => r.json()).then(setTrends).catch(() => {});
  }, [config.days, filters.dateRange]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const pp = activePlatform && data.per_platform?.[activePlatform];
  const d = pp
    ? { spend: pp.spend, impressions: pp.impressions, clicks: pp.clicks, conversions: pp.conversions, cpa: pp.cpa, ctr: pp.impressions > 0 ? (pp.clicks / pp.impressions * 100) : 0 }
    : data;

  const subtitle = activePlatform
    ? PLATFORM_LABEL[activePlatform] || activePlatform : 'All Platforms';

  const deltas = trends?.paid_deltas;
  const daily = trends?.paid_daily ?? [];

  // Delta color logic: spend is inverted (less spend = green), everything else positive = green
  const deltaColor = (key: string, val: number | undefined) => {
    if (val === undefined || val === 0) return '#a3a3a3';
    const invert = key === 'spend';
    const positive = val > 0;
    return (positive !== invert) ? '#16a34a' : '#dc2626';
  };

  type PaidDeltaKey = 'spend' | 'impressions' | 'clicks' | 'conversions';
  type PaidSparkKey = 'spend' | 'impressions' | 'clicks' | 'conversions';

  interface KpiCell {
    label: string;
    value: string;
    deltaKey?: PaidDeltaKey;
    sparkKey?: PaidSparkKey;
  }

  const kpis: KpiCell[] = [
    { label: 'Total Spend', value: formatCurrency(d.spend), deltaKey: 'spend', sparkKey: 'spend' },
    { label: 'Impressions', value: formatCompact(d.impressions), deltaKey: 'impressions', sparkKey: 'impressions' },
    { label: 'Clicks', value: formatCompact(d.clicks), deltaKey: 'clicks', sparkKey: 'clicks' },
    { label: 'Conversions', value: formatCompact(d.conversions), deltaKey: 'conversions', sparkKey: 'conversions' },
    { label: 'Avg CPA', value: d.cpa > 0 ? formatCurrency(d.cpa, 2) : '—' },
    { label: 'CTR', value: formatPct(d.ctr) },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.1em] mb-3">
        {subtitle}
      </div>
      <div className="flex-1 grid grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 content-start">
        {kpis.map(kpi => {
          const delta = kpi.deltaKey && deltas ? (deltas as Record<PaidDeltaKey, number>)[kpi.deltaKey] : undefined;
          const dColor = kpi.deltaKey ? deltaColor(kpi.deltaKey, delta) : '#a3a3a3';
          const sparkData = kpi.sparkKey ? daily.map(row => row[kpi.sparkKey!]) : undefined;

          return (
            <div key={kpi.label} className="min-w-0">
              <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] mb-1">
                {kpi.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold text-[#1a1a1a] tracking-tight leading-none tabular-nums">
                  {kpi.value}
                </span>
                {delta !== undefined && delta !== 0 && (
                  <span className="text-[9px] tabular-nums" style={{ color: dColor }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                  </span>
                )}
              </div>
              {sparkData && sparkData.length > 1 && (
                <div className="mt-1">
                  <Sparkline data={sparkData} color={dColor} height={20} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
