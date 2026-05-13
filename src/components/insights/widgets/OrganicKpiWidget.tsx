"use client";

import { useEffect, useState } from 'react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { formatCompact, formatPct, formatDelta } from '../chartTheme';
import { Sparkline } from '../Sparkline';

interface PlatformStats {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  followers_delta: number;
  engagement_rate: number;
}

interface OrganicOverview extends PlatformStats {
  per_platform?: Record<string, PlatformStats>;
}

interface OrganicTrends {
  organic_daily: Array<{ date: string; impressions: number; reach: number; engagement: number; clicks: number }>;
  organic_deltas: { impressions: number; reach: number; engagement: number; clicks: number };
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', reddit: 'Reddit',
};

export default function OrganicKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<OrganicOverview | null>(null);
  const [trends, setTrends] = useState<OrganicTrends | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.organicPlatform;

  useEffect(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/organic-overview?days=${days}`)
      .then(r => r.json()).then(setData).catch(() => {});
    fetch(`/api/insights/metrics/kpi-trends?days=${days}`)
      .then(r => r.json()).then(setTrends).catch(() => {});
  }, [config.days, filters.dateRange]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const stats: PlatformStats = activePlatform && data.per_platform?.[activePlatform]
    ? data.per_platform[activePlatform] : data;

  const subtitle = activePlatform
    ? (PLATFORM_LABEL[activePlatform] ?? activePlatform) : 'All Platforms';

  const followerDelta = formatDelta(stats.followers_delta);

  const deltas = trends?.organic_deltas;
  const daily = trends?.organic_daily ?? [];

  // All organic metrics: positive = green
  const deltaColor = (val: number | undefined) => {
    if (val === undefined || val === 0) return '#a3a3a3';
    return val > 0 ? '#16a34a' : '#dc2626';
  };

  type OrgDeltaKey = 'impressions' | 'reach' | 'engagement' | 'clicks';
  type OrgSparkKey = 'impressions' | 'reach' | 'engagement' | 'clicks';

  interface KpiCell {
    label: string;
    value: string;
    color?: string;
    deltaKey?: OrgDeltaKey;
    sparkKey?: OrgSparkKey;
  }

  const kpis: KpiCell[] = [
    { label: 'Impressions', value: formatCompact(stats.impressions), deltaKey: 'impressions', sparkKey: 'impressions' },
    { label: 'Reach', value: formatCompact(stats.reach), deltaKey: 'reach', sparkKey: 'reach' },
    { label: 'Engagement', value: formatCompact(stats.engagement), deltaKey: 'engagement', sparkKey: 'engagement' },
    { label: 'Clicks', value: formatCompact(stats.clicks), deltaKey: 'clicks', sparkKey: 'clicks' },
    { label: 'Followers', value: followerDelta.text, color: followerDelta.color },
    { label: 'Eng Rate', value: formatPct(stats.engagement_rate) },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.1em] mb-3">
        {subtitle}
      </div>
      <div className="flex-1 grid grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 content-start">
        {kpis.map(kpi => {
          const delta = kpi.deltaKey && deltas ? (deltas as Record<OrgDeltaKey, number>)[kpi.deltaKey] : undefined;
          const dColor = delta !== undefined ? deltaColor(delta) : '#a3a3a3';
          const sparkData = kpi.sparkKey ? daily.map(row => row[kpi.sparkKey!]) : undefined;

          return (
            <div key={kpi.label} className="min-w-0">
              <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] mb-1">
                {kpi.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-xl font-semibold tracking-tight leading-none tabular-nums"
                  style={{ color: kpi.color || '#1a1a1a' }}
                >
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
