"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { formatCompact, formatCurrency, CHART_COLORS } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface SpendPlatform {
  platform: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
}

interface SpendData {
  spend: {
    total: number;
    impressions: number;
    clicks: number;
    by_platform: SpendPlatform[];
  };
}

type SortKey = 'spend' | 'impressions' | 'clicks';

const PLATFORM_COLOR: Record<string, string> = {
  meta: CHART_COLORS.blue,
  facebook: CHART_COLORS.blue,
  google: CHART_COLORS.green,
  reddit: CHART_COLORS.orange,
  linkedin: CHART_COLORS.teal,
  tiktok: CHART_COLORS.purple,
  twitter: CHART_COLORS.charcoal,
  snap: CHART_COLORS.amber,
};

function platformColor(platform: string): string {
  const key = platform.toLowerCase().replace('_ads', '').replace('_', '');
  for (const [k, v] of Object.entries(PLATFORM_COLOR)) {
    if (key.includes(k)) return v;
  }
  return '#d4d4d4';
}

function platformLabel(platform: string): string {
  return platform
    .replace('_ads', '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 7);
}

export default function TopCampaignSpendWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<SpendData | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const { filters } = useDashboardFilter();

  const fetchData = useCallback(() => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 90);
    fetch(`/api/insights/metrics/campaign-funnel?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, filters.dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!data) return <div className="h-full animate-pulse rounded-xl bg-[#f5f5f5]" />;

  const rows = [...(data.spend?.by_platform || [])]
    .sort((a, b) => {
      const diff = b[sortKey] - a[sortKey];
      return sortDir === 'desc' ? diff : -diff;
    })
    .slice(0, 10);

  const totalSpend = data.spend?.total || 0;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-2.5 h-2.5 text-[#d4d4d4]" />;
    return sortDir === 'desc'
      ? <ChevronDown className="w-2.5 h-2.5 text-[#525252]" />
      : <ChevronUp className="w-2.5 h-2.5 text-[#525252]" />;
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">
          Top {rows.length} by spend
        </div>
        {totalSpend > 0 && (
          <div className="text-[10px] font-semibold text-[#1a1a1a] tabular-nums">
            {formatCurrency(totalSpend)} total
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-[#a3a3a3]">No spend data for this period</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="text-left pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] w-10 pr-2">Src</th>
                <th className="text-left pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">Campaign</th>
                <th
                  className="text-right pb-2 text-[8px] font-medium uppercase tracking-[0.06em] pr-2 cursor-pointer select-none"
                  style={{ color: sortKey === 'spend' ? '#1a1a1a' : '#a3a3a3' }}
                  onClick={() => handleSort('spend')}
                >
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    Spend <SortIcon col="spend" />
                  </span>
                </th>
                <th
                  className="text-right pb-2 text-[8px] font-medium uppercase tracking-[0.06em] pr-2 cursor-pointer select-none"
                  style={{ color: sortKey === 'impressions' ? '#1a1a1a' : '#a3a3a3' }}
                  onClick={() => handleSort('impressions')}
                >
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    Impr <SortIcon col="impressions" />
                  </span>
                </th>
                <th
                  className="text-right pb-2 text-[8px] font-medium uppercase tracking-[0.06em] cursor-pointer select-none"
                  style={{ color: sortKey === 'clicks' ? '#1a1a1a' : '#a3a3a3' }}
                  onClick={() => handleSort('clicks')}
                >
                  <span className="inline-flex items-center gap-0.5 justify-end">
                    Clicks <SortIcon col="clicks" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sp, i) => {
                const pctOfTotal = totalSpend > 0 ? (sp.spend / totalSpend) * 100 : 0;
                return (
                  <tr
                    key={i}
                    className="border-b border-[#fafafa] hover:bg-[#fafafa] transition-colors group"
                  >
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: platformColor(sp.platform) }}
                        />
                        <span className="text-[9px] text-[#a3a3a3] truncate">
                          {platformLabel(sp.platform)}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#1a1a1a] truncate max-w-[180px]">
                          {sp.campaign_name || '—'}
                        </span>
                      </div>
                      {/* Mini spend bar */}
                      <div className="mt-0.5 h-0.5 rounded-full bg-[#f0f0f0] overflow-hidden max-w-[180px]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(2, pctOfTotal)}%`,
                            backgroundColor: platformColor(sp.platform),
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-right text-[11px] font-semibold text-[#1a1a1a] tabular-nums">
                      {formatCurrency(sp.spend)}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-[11px] text-[#a3a3a3] tabular-nums">
                      {formatCompact(sp.impressions)}
                    </td>
                    <td className="py-1.5 text-right text-[11px] text-[#525252] tabular-nums">
                      {formatCompact(sp.clicks)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
