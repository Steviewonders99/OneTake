"use client";

import { useEffect, useState } from 'react';
import { formatPct, formatCompact } from '../chartTheme';

interface AttributionSource {
  avg_engagement_rate: number;
  avg_reach: number;
  post_count: number;
}

interface OrganicAttribution {
  pipeline: AttributionSource;
  manual: AttributionSource;
}

function StatBlock({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">{label}</span>
      <span
        className="text-xl font-semibold tracking-tight leading-none"
        style={{ color: valueColor ?? '#1a1a1a' }}
      >
        {value}
      </span>
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

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  return (
    <div className="h-full flex gap-6 items-start pt-1">
      {/* Pipeline */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
          <span className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">Pipeline</span>
        </div>
        <StatBlock
          label="Eng Rate"
          value={formatPct(data.pipeline.avg_engagement_rate)}
          valueColor="#22c55e"
        />
        <StatBlock
          label="Avg Reach"
          value={formatCompact(data.pipeline.avg_reach)}
          valueColor="#22c55e"
        />
        <StatBlock
          label="Posts"
          value={data.pipeline.post_count.toLocaleString()}
          valueColor="#22c55e"
        />
      </div>

      {/* Manual */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#eab308] shrink-0" />
          <span className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">Manual</span>
        </div>
        <StatBlock
          label="Eng Rate"
          value={formatPct(data.manual.avg_engagement_rate)}
          valueColor="#eab308"
        />
        <StatBlock
          label="Avg Reach"
          value={formatCompact(data.manual.avg_reach)}
          valueColor="#eab308"
        />
        <StatBlock
          label="Posts"
          value={data.manual.post_count.toLocaleString()}
          valueColor="#eab308"
        />
      </div>
    </div>
  );
}
