"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCompact, formatCurrency, formatPct } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface SourceRow {
  source: string; medium: string; sessions: number; signups: number; completions: number;
  w1_completions: number; w2_completions: number; pace_change_pct: number;
  share_pct: number; cvr: number; type: string;
}

interface CityRow {
  country: string; sessions: number; signups: number; completions: number; cvr: number;
}

interface AttrData {
  campaign: string; days: number;
  kpis: {
    total_completions: number; meta_attributed: number; meta_share_pct: number;
    total_spend: number; cpa: number; w1_cpa: number; w2_cpa: number; cpa_trend: number;
    w1_completions: number; w2_completions: number;
  };
  sources: SourceRow[];
  cities: CityRow[];
  available_campaigns: { campaign: string; total: number }[];
}

const TYPE_COLOR: Record<string, string> = {
  Paid: '#3b82f6', Organic: '#22c55e', Email: '#eab308', Referral: '#14b8a6', Direct: '#a3a3a3', Other: '#d4d4d4',
};

export default function RecruitmentAttributionWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<AttrData | null>(null);
  const [campaign, setCampaign] = useState<string>((config.campaign as string) || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [view, setView] = useState<'sources' | 'cities'>('sources');
  const { filters } = useDashboardFilter();
  const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 30);

  const fetchData = useCallback((c: string) => {
    const qp = c ? `&campaign=${encodeURIComponent(c)}` : '';
    fetch(`/api/insights/metrics/recruitment-attribution?days=${days}${qp}`)
      .then(r => r.json()).then(setData).catch(() => {});
  }, [days]);

  useEffect(() => { fetchData(campaign); }, [campaign, fetchData]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const k = data.kpis;
  const cpaTrendColor = k.cpa_trend < 0 ? '#22c55e' : k.cpa_trend > 0 ? '#ef4444' : '#a3a3a3';

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Campaign selector + view toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors">
            <span className="truncate max-w-[140px]">{data.campaign}</span>
            <ChevronDown className="w-3 h-3 text-[#a3a3a3] shrink-0" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e5e5] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.06)] z-50 max-h-48 overflow-y-auto min-w-[180px]">
              <button onClick={() => { setCampaign(''); setShowDropdown(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer">All Campaigns</button>
              {data.available_campaigns.map(c => (
                <button key={c.campaign} onClick={() => { setCampaign(c.campaign); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer flex justify-between">
                  <span className="truncate">{c.campaign}</span>
                  <span className="text-[#a3a3a3] ml-2 tabular-nums">{c.total.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-0.5 ml-auto">
          {(['sources', 'cities'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${view === v ? 'bg-[#1a1a1a] text-white' : 'text-[#a3a3a3] hover:text-[#525252] hover:bg-[#f5f5f5]'}`}>
              {v === 'sources' ? 'By Source' : 'By City'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs — the proof row */}
      <div className="grid grid-cols-6 gap-4 shrink-0">
        <div>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">Completions</div>
          <div className="text-xl font-semibold text-[#1a1a1a] tabular-nums">{formatCompact(k.total_completions)}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">Meta Attributed</div>
          <div className="text-xl font-semibold text-[#1a1a1a] tabular-nums">{formatCompact(k.meta_attributed)}</div>
          <div className="text-[9px] text-[#a3a3a3] tabular-nums">{k.meta_share_pct}% of total</div>
        </div>
        <div>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">Total Spend</div>
          <div className="text-xl font-semibold text-[#1a1a1a] tabular-nums">{formatCurrency(k.total_spend)}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">Cost / Completion</div>
          <div className="text-xl font-semibold text-[#1a1a1a] tabular-nums">{k.cpa > 0 ? formatCurrency(k.cpa, 2) : '—'}</div>
        </div>
        <div>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">CPA W1 → W2</div>
          <div className="text-lg font-semibold tabular-nums">
            <span className="text-[#a3a3a3]">{k.w1_cpa > 0 ? formatCurrency(k.w1_cpa, 2) : '—'}</span>
            <span className="text-[#d4d4d4] mx-1">→</span>
            <span style={{ color: cpaTrendColor }}>{k.w2_cpa > 0 ? formatCurrency(k.w2_cpa, 2) : '—'}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">CPA Trend</div>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: cpaTrendColor }}>
            {k.cpa_trend !== 0 ? `${k.cpa_trend > 0 ? '+' : ''}${k.cpa_trend}%` : '—'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {view === 'sources' ? (
          <>
            <div className="flex items-center gap-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pb-1 border-b border-[#f0f0f0]">
              <div className="w-3 shrink-0" />
              <div className="flex-1">Traffic Source</div>
              <div className="w-10 text-right">Type</div>
              <div className="w-12 text-right">W1</div>
              <div className="w-12 text-right">W2</div>
              <div className="w-14 text-right">Total</div>
              <div className="w-12 text-right">Share</div>
              <div className="w-12 text-right">CVR</div>
              <div className="w-14 text-right">Pace</div>
            </div>
            {data.sources.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 border-b border-[#fafafa]">
                <div className="w-3 shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[r.type] || '#d4d4d4' }} />
                </div>
                <div className="flex-1 text-[#525252] truncate">{r.source} / {r.medium}</div>
                <div className="w-10 text-right text-[9px] text-[#a3a3a3]">{r.type}</div>
                <div className="w-12 text-right text-[#a3a3a3] tabular-nums">{r.w1_completions}</div>
                <div className="w-12 text-right text-[#1a1a1a] font-medium tabular-nums">{r.w2_completions}</div>
                <div className="w-14 text-right text-[#1a1a1a] font-semibold tabular-nums">{r.completions}</div>
                <div className="w-12 text-right text-[#a3a3a3] tabular-nums">{r.share_pct}%</div>
                <div className="w-12 text-right tabular-nums" style={{ color: r.cvr > 5 ? '#22c55e' : r.cvr > 1 ? '#1a1a1a' : '#a3a3a3' }}>
                  {r.cvr > 0 ? formatPct(r.cvr) : '—'}
                </div>
                <div className="w-14 text-right font-semibold tabular-nums" style={{ color: r.pace_change_pct > 0 ? '#22c55e' : r.pace_change_pct < 0 ? '#ef4444' : '#a3a3a3' }}>
                  {r.pace_change_pct !== 0 ? `${r.pace_change_pct > 0 ? '+' : ''}${r.pace_change_pct}%` : '—'}
                </div>
              </div>
            ))}
            {/* Total row */}
            <div className="flex items-center gap-2 text-[11px] py-2 border-t border-[#e5e5e5] font-semibold">
              <div className="w-3 shrink-0" />
              <div className="flex-1 text-[#1a1a1a]">TOTAL</div>
              <div className="w-10" />
              <div className="w-12 text-right tabular-nums">{data.sources.reduce((s, r) => s + r.w1_completions, 0)}</div>
              <div className="w-12 text-right tabular-nums">{data.sources.reduce((s, r) => s + r.w2_completions, 0)}</div>
              <div className="w-14 text-right tabular-nums">{k.total_completions}</div>
              <div className="w-12 text-right">100%</div>
              <div className="w-12" />
              <div className="w-14" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pb-1 border-b border-[#f0f0f0]">
              <div className="flex-1">Location</div>
              <div className="w-16 text-right">Sessions</div>
              <div className="w-16 text-right">Sign-ups</div>
              <div className="w-16 text-right">Completions</div>
              <div className="w-12 text-right">CVR</div>
            </div>
            {data.cities.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 border-b border-[#fafafa]">
                <div className="flex-1 text-[#525252]">{r.country || 'Unknown'}</div>
                <div className="w-16 text-right text-[#a3a3a3] tabular-nums">{formatCompact(r.sessions)}</div>
                <div className="w-16 text-right text-[#1a1a1a] tabular-nums">{formatCompact(r.signups)}</div>
                <div className="w-16 text-right text-[#1a1a1a] font-semibold tabular-nums">{formatCompact(r.completions)}</div>
                <div className="w-12 text-right tabular-nums" style={{ color: r.cvr > 5 ? '#22c55e' : r.cvr > 1 ? '#1a1a1a' : '#a3a3a3' }}>
                  {r.cvr > 0 ? formatPct(r.cvr) : '—'}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
