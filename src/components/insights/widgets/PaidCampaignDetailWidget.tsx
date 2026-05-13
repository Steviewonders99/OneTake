"use client";

import { useEffect, useState } from 'react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { formatCurrency, formatCompact } from '../chartTheme';
import { FilterChip } from '../FilterChip';

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

  const effectivePlatform = filters.paidPlatform || (config.platform as string) || 'meta_ads';

  useEffect(() => {
    setData(null);
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);
    fetch(`/api/insights/metrics/paid-campaigns?days=${days}&platform=${effectivePlatform}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, [config.days, filters.dateRange, effectivePlatform]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const platformLabel = PLATFORM_LABEL[effectivePlatform] ?? effectivePlatform;
  const isFilteredByContext = !!filters.paidPlatform;

  return (
    <div className="h-full flex flex-col gap-1.5">
      {/* Filter chip */}
      {isFilteredByContext && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[#a3a3a3]">Showing:</span>
          <FilterChip label={PLATFORM_LABEL[effectivePlatform] || effectivePlatform} onClear={() => clearFilter('paidPlatform')} />
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#a3a3a3] text-xs">
          {isFilteredByContext ? `No campaign data for ${platformLabel}` : 'No campaign data yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="text-left text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] py-1.5 pr-2 border-b border-[#f5f5f5]">Campaign</th>
                <th className="text-right text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] py-1.5 px-1 border-b border-[#f5f5f5]">Spend</th>
                <th className="text-right text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] py-1.5 px-1 border-b border-[#f5f5f5]">Impr</th>
                <th className="text-right text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] py-1.5 px-1 border-b border-[#f5f5f5]">Clicks</th>
                <th className="text-right text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] py-1.5 px-1 border-b border-[#f5f5f5]">Conv</th>
                <th className="text-right text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] py-1.5 pl-1 border-b border-[#f5f5f5]">CPA</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.campaign_id} className="border-b border-[#f5f5f5] last:border-0">
                  <td className="py-1.5 pr-2 text-[#1a1a1a] truncate max-w-[120px]">
                    {row.campaign_name}
                  </td>
                  <td className="py-1.5 px-1 text-right text-[#1a1a1a]">
                    {formatCurrency(row.spend)}
                  </td>
                  <td className="py-1.5 px-1 text-right text-[#a3a3a3]">
                    {formatCompact(row.impressions)}
                  </td>
                  <td className="py-1.5 px-1 text-right text-[#1a1a1a]">
                    {formatCompact(row.clicks)}
                  </td>
                  <td className="py-1.5 px-1 text-right text-[#1a1a1a]">
                    {row.conversions.toLocaleString()}
                  </td>
                  <td className="py-1.5 pl-1 text-right text-[#1a1a1a]">
                    {row.cpa > 0 ? formatCurrency(row.cpa, 2) : '—'}
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
