"use client";

import { useEffect, useState } from 'react';

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
}

export default function PaidCampaignDetailWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<CampaignRow[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    const platform = (config.platform as string) || 'meta_ads';
    fetch(`/api/insights/metrics/paid-campaigns?days=${days}&platform=${platform}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, config.platform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">
        No campaign data yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b border-[var(--border)]">
            <th className="text-left text-[10px] font-semibold text-[var(--muted-foreground)] py-1 pr-2">Campaign</th>
            <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Spend</th>
            <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Impr</th>
            <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Clicks</th>
            <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 px-1">Conv</th>
            <th className="text-right text-[10px] font-semibold text-[var(--muted-foreground)] py-1 pl-1">CPA</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr
              key={row.campaign_id}
              className="border-b border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
            >
              <td className="py-1.5 pr-2 text-[var(--foreground)] truncate max-w-[120px]">
                {row.campaign_name}
              </td>
              <td className="py-1.5 px-1 text-right text-[var(--foreground)]">
                ${row.spend.toFixed(0)}
              </td>
              <td className="py-1.5 px-1 text-right text-[var(--muted-foreground)]">
                {row.impressions >= 1000
                  ? `${(row.impressions / 1000).toFixed(1)}k`
                  : row.impressions}
              </td>
              <td className="py-1.5 px-1 text-right text-[var(--foreground)]">
                {row.clicks.toLocaleString()}
              </td>
              <td className="py-1.5 px-1 text-right text-[var(--foreground)]">
                {row.conversions.toLocaleString()}
              </td>
              <td className="py-1.5 pl-1 text-right text-[var(--foreground)]">
                {row.cpa > 0 ? `$${row.cpa.toFixed(2)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
