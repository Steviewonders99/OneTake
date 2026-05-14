"use client";

import { useEffect, useState } from 'react';
import { formatCompact, formatCurrency, formatPct } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface CategoryRow {
  category: string;
  color: string;
  description: string;
  campaign_count: number;
  campaigns: string[];
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  sessions: number;
  signups: number;
  completions: number;
  cvr_session_to_completion: number;
  cvr_click_to_signup: number;
}

export default function CategoryBreakdownWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<CategoryRow[] | null>(null);
  const { filters } = useDashboardFilter();
  const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);

  useEffect(() => {
    fetch(`/api/insights/metrics/category-breakdown?days=${days}`)
      .then(r => r.json())
      .then(d => setData(d.categories))
      .catch(() => {});
  }, [days]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-[#a3a3a3] text-xs">No category data yet</div>;

  const meaningful = data.filter(cat => cat.spend > 0 || cat.sessions > 0 || cat.completions > 0);
  const maxSpend = Math.max(...meaningful.map(c => c.spend), 1);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header row */}
      <div className="flex items-center text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pb-2 border-b border-[#f0f0f0] gap-2 px-1">
        <div className="w-[140px] shrink-0">Category</div>
        <div className="flex-1" />
        <div className="w-14 text-right">Spend</div>
        <div className="w-12 text-right">Conv</div>
        <div className="w-12 text-right">CPA</div>
        <div className="w-14 text-right">Sessions</div>
        <div className="w-12 text-right">Signups</div>
        <div className="w-10 text-right">CVR</div>
      </div>

      {/* Category rows */}
      <div className="flex-1 overflow-y-auto">
        {meaningful.map(cat => {
          const spendBar = (cat.spend / maxSpend) * 100;

          return (
            <div key={cat.category} className="group">
              {/* Main row — compact, data-dense */}
              <div className="flex items-center gap-2 py-3 px-1 border-b border-[#fafafa] hover:bg-[#fafafa] transition-colors">
                {/* Category identity */}
                <div className="w-[140px] shrink-0 flex items-center gap-2">
                  <div className="w-[3px] h-8 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[#1a1a1a] leading-tight">{cat.category}</div>
                    <div className="text-[9px] text-[#a3a3a3] leading-tight">{cat.campaign_count} campaigns</div>
                  </div>
                </div>

                {/* Spend bar — inline visual */}
                <div className="flex-1 relative h-5 mx-2">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${Math.max(2, spendBar)}%`,
                      backgroundColor: cat.color,
                      opacity: 0.12,
                    }}
                  />
                </div>

                {/* Numbers — tight columns */}
                <div className="w-14 text-right text-[12px] font-semibold text-[#1a1a1a] tabular-nums">{formatCurrency(cat.spend)}</div>
                <div className="w-12 text-right text-[12px] font-semibold tabular-nums" style={{ color: cat.conversions > 0 ? '#1a1a1a' : '#d4d4d4' }}>{formatCompact(cat.conversions)}</div>
                <div className="w-12 text-right text-[11px] tabular-nums text-[#525252]">{cat.cpa > 0 ? formatCurrency(cat.cpa, 0) : '—'}</div>
                <div className="w-14 text-right text-[11px] tabular-nums text-[#a3a3a3]">{formatCompact(cat.sessions)}</div>
                <div className="w-12 text-right text-[11px] font-medium tabular-nums" style={{ color: cat.signups > 0 ? '#3b82f6' : '#d4d4d4' }}>{formatCompact(cat.signups)}</div>
                <div className="w-10 text-right text-[11px] font-semibold tabular-nums" style={{ color: cat.cvr_session_to_completion > 2 ? '#22c55e' : cat.cvr_session_to_completion > 0 ? '#1a1a1a' : '#d4d4d4' }}>
                  {cat.cvr_session_to_completion > 0 ? formatPct(cat.cvr_session_to_completion) : '—'}
                </div>
              </div>

              {/* Expandable campaign list on hover */}
              {cat.campaigns.length > 0 && (
                <div className="hidden group-hover:flex flex-wrap gap-1 px-4 py-1.5 bg-[#fafafa]">
                  {cat.campaigns.slice(0, 6).map(c => (
                    <span key={c} className="text-[8px] px-1.5 py-0.5 rounded bg-white text-[#525252] border border-[#f0f0f0] truncate max-w-[120px]">{c}</span>
                  ))}
                  {cat.campaigns.length > 6 && <span className="text-[8px] text-[#a3a3a3] self-center">+{cat.campaigns.length - 6}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
