'use client';

import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';

interface PaidMetricsProps {
  spend: number;
  impressions: number;
  clicks: number;
  ndaSigned: number;
  activeWorkers: number;
}

export function PaidMetrics({ spend, impressions, clicks, ndaSigned, activeWorkers }: PaidMetricsProps) {
  const cpa = ndaSigned > 0 ? spend / ndaSigned : null;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const costPerWorker = activeWorkers > 0 ? spend / activeWorkers : null;

  const metrics = [
    { label: 'Total Spend', value: formatEur(spend) },
    { label: 'CPA (per NDA)', value: cpa ? formatEur(cpa) : '—', color: BRAND.blue },
    { label: 'Impressions', value: impressions >= 1000000 ? `${(impressions / 1000000).toFixed(2)}M` : impressions.toLocaleString() },
    { label: 'Clicks', value: clicks.toLocaleString() },
    { label: 'CTR', value: ctr ? `${ctr.toFixed(2)}%` : '—' },
    { label: 'Cost / Active Worker', value: costPerWorker ? formatEur(costPerWorker) : '—', color: BRAND.purple },
  ];

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="text-[13px] font-bold mb-3" style={{ color: BRAND.text }}>Paid Campaign Performance</div>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map(m => (
          <div key={m.label}>
            <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: BRAND.text3 }}>{m.label}</div>
            <div className="text-[22px] font-extrabold tracking-tight" style={{ color: m.color ?? BRAND.text }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
