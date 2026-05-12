"use client";

import { useEffect, useState } from 'react';

interface AttributionSource {
  avg_engagement_rate: number;
  avg_reach: number;
  post_count: number;
}

interface OrganicAttribution {
  pipeline: AttributionSource;
  manual: AttributionSource;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
      <span className="text-xs font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

export default function OrganicAttributionWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<OrganicAttribution | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-attribution?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  return (
    <div className="h-full flex gap-4 items-stretch">
      {/* Pipeline */}
      <div className="flex-1">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[11px] font-semibold text-[var(--foreground)]">Pipeline</span>
        </div>
        <StatRow label="Eng Rate" value={`${data.pipeline.avg_engagement_rate.toFixed(2)}%`} />
        <StatRow label="Avg Reach" value={data.pipeline.avg_reach.toLocaleString()} />
        <StatRow label="Posts" value={data.pipeline.post_count.toLocaleString()} />
      </div>

      {/* Divider */}
      <div className="w-px bg-[var(--border)] self-stretch" />

      {/* Manual */}
      <div className="flex-1">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[11px] font-semibold text-[var(--foreground)]">Manual</span>
        </div>
        <StatRow label="Eng Rate" value={`${data.manual.avg_engagement_rate.toFixed(2)}%`} />
        <StatRow label="Avg Reach" value={data.manual.avg_reach.toLocaleString()} />
        <StatRow label="Posts" value={data.manual.post_count.toLocaleString()} />
      </div>
    </div>
  );
}
