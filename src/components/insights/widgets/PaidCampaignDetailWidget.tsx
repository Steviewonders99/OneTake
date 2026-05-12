"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta',
  reddit_ads: 'Reddit',
  linkedin_ads: 'LinkedIn',
  google_ads: 'Google',
  tiktok_ads: 'TikTok',
};

export default function PaidCampaignDetailWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<CampaignRow[] | null>(null);
  const { filters, clearFilter } = useDashboardFilter();

  const effectivePlatform = filters.platform || (config.platform as string) || 'meta_ads';

  useEffect(() => {
    setData(null);
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-campaigns?days=${days}&platform=${effectivePlatform}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, [config.days, effectivePlatform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const platformLabel = PLATFORM_LABEL[effectivePlatform] ?? effectivePlatform;
  const isFilteredByContext = !!filters.platform;

  return (
    <div className="h-full flex flex-col gap-1.5">
      {isFilteredByContext && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--muted-foreground)]">Showing:</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
          >
            {platformLabel}
            <button
              onClick={() => clearFilter('platform')}
              className="flex items-center cursor-pointer"
              aria-label="Clear platform filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-xs">
          {isFilteredByContext ? `No campaign data for ${platformLabel}` : 'No campaign data yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
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
      )}
    </div>
  );
}
