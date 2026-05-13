"use client";

import { useEffect, useState } from 'react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { formatCompact, formatPct, formatDelta } from '../chartTheme';

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

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', reddit: 'Reddit',
};

export default function OrganicKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<OrganicOverview | null>(null);
  const { filters } = useDashboardFilter();
  const activePlatform = filters.platform;

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-overview?days=${days}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const stats: PlatformStats = activePlatform && data.per_platform?.[activePlatform]
    ? data.per_platform[activePlatform] : data;

  const subtitle = activePlatform
    ? (PLATFORM_LABEL[activePlatform] ?? activePlatform) : 'All Platforms';

  const delta = formatDelta(stats.followers_delta);

  const kpis = [
    { label: 'Impressions', value: formatCompact(stats.impressions) },
    { label: 'Reach', value: formatCompact(stats.reach) },
    { label: 'Engagement', value: formatCompact(stats.engagement) },
    { label: 'Clicks', value: formatCompact(stats.clicks) },
    { label: 'Followers', value: delta.text, color: delta.color },
    { label: 'Eng Rate', value: formatPct(stats.engagement_rate) },
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
            <div
              className="text-xl font-semibold tracking-tight leading-none tabular-nums"
              style={{ color: kpi.color || '#1a1a1a' }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
