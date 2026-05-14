"use client";

import { useEffect, useState } from 'react';
import { formatCompact } from './chartTheme';

export function KpiStrip() {
  const [pipeline, setPipeline] = useState<{ total: number; by_status: { status: string; count: number }[] } | null>(null);
  const [clicks, setClicks] = useState<{ summary: { total_clicks: number } } | null>(null);

  useEffect(() => {
    fetch('/api/insights/metrics/pipeline').then(r => r.json()).then(setPipeline).catch(() => {});
    fetch('/api/insights/metrics/clicks').then(r => r.json()).then(setClicks).catch(() => {});
  }, []);

  if (!pipeline) return (
    <div className="flex gap-6 px-6 py-4 border-b border-[#f0f0f0] bg-white">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-12 w-24 rounded bg-[#f5f5f5]" />)}
    </div>
  );

  const byStatus = Object.fromEntries(pipeline.by_status.map(s => [s.status, s.count]));
  const cards = [
    { label: 'Campaigns', value: pipeline.total },
    { label: 'Generating', value: byStatus['generating'] ?? 0 },
    { label: 'Approved', value: byStatus['approved'] ?? 0 },
    { label: 'Sent', value: byStatus['sent'] ?? 0 },
    { label: 'Total Clicks', value: clicks?.summary?.total_clicks ?? 0 },
  ];

  return (
    <div className="flex items-center gap-8 px-6 py-4 border-b border-[#f0f0f0] bg-white">
      {cards.map(c => (
        <div key={c.label}>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">{c.label}</div>
          <div className="text-xl font-semibold text-[#1a1a1a] tracking-tight tabular-nums">{formatCompact(c.value)}</div>
        </div>
      ))}
    </div>
  );
}
