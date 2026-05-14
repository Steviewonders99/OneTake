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

  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-[#a3a3a3] text-xs">No category data yet</div>;
  }

  // Filter out categories with zero spend AND zero sessions (noise)
  const meaningful = data.filter(cat => cat.spend > 0 || cat.sessions > 0 || cat.completions > 0);

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Category cards */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {meaningful.map(cat => (
          <div key={cat.category} className="rounded-xl p-4 transition-colors" style={{ backgroundColor: cat.color + '08', borderLeft: `3px solid ${cat.color}` }}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1a1a1a]">{cat.category}</div>
                <div className="text-[10px] text-[#a3a3a3]">{cat.campaign_count} campaigns · {cat.description}</div>
              </div>
              {cat.completions > 0 && (
                <div className="text-right">
                  <div className="text-[16px] font-semibold tabular-nums" style={{ color: cat.cvr_session_to_completion > 2 ? '#22c55e' : '#1a1a1a' }}>
                    {formatPct(cat.cvr_session_to_completion)}
                  </div>
                  <div className="text-[9px] text-[#a3a3a3] uppercase tracking-[0.06em]">CVR</div>
                </div>
              )}
            </div>

            {/* Metrics — two rows */}
            <div className="grid grid-cols-5 gap-3 mb-2">
              <Metric label="Ad Spend" value={formatCurrency(cat.spend)} />
              <Metric label="Impressions" value={formatCompact(cat.impressions)} />
              <Metric label="Clicks" value={formatCompact(cat.clicks)} />
              <Metric label="Conversions" value={formatCompact(cat.conversions)} />
              <Metric label="CPA" value={cat.cpa > 0 ? formatCurrency(cat.cpa, 2) : '—'} />
            </div>
            <div className="grid grid-cols-4 gap-3 pt-2 border-t border-[#f5f5f5]">
              <Metric label="Sessions" value={formatCompact(cat.sessions)} />
              <Metric label="Sign-ups" value={formatCompact(cat.signups)} highlight={cat.signups > 0 ? '#3b82f6' : undefined} />
              <Metric label="Completions" value={formatCompact(cat.completions)} highlight={cat.completions > 0 ? '#22c55e' : undefined} />
              <Metric label="Click→Signup" value={cat.cvr_click_to_signup > 0 ? formatPct(cat.cvr_click_to_signup) : '—'} />
            </div>

            {/* Campaign pills */}
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#f5f5f5]">
              {cat.campaigns.slice(0, 5).map(c => (
                <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#525252] truncate max-w-[140px]">
                  {c}
                </span>
              ))}
              {cat.campaigns.length > 5 && (
                <span className="text-[9px] text-[#a3a3a3]">+{cat.campaigns.length - 5} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">{label}</div>
      <div className="text-[13px] font-semibold tabular-nums leading-tight" style={{ color: highlight || '#1a1a1a' }}>{value}</div>
    </div>
  );
}
