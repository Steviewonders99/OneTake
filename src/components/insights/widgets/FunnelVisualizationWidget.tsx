"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCompact, formatCurrency, formatPct, CHART_COLORS } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversions: number;
}

interface FunnelData {
  campaign: string;
  funnel: FunnelStage[];
  kpis: {
    total_spend: number;
    total_sessions: number;
    applies: number;
    signups: number;
    completions: number;
    cpa_signup: number;
    cpa_completion: number;
    cvr_click_to_signup: number;
    cvr_click_to_purchase: number;
    cvr_signup_to_purchase: number;
    cvr_session_to_signup: number;
    cvr_session_to_purchase: number;
  };
  available_campaigns: { campaign: string; total: number }[];
}

// Funnel stage colors: blue → teal → green
function stageColor(i: number, total: number): string {
  const t = total <= 1 ? 0 : i / (total - 1);
  if (t < 0.33) {
    // blue → teal
    const u = t / 0.33;
    const r = Math.round(59 + (20 - 59) * u);
    const g = Math.round(130 + (184 - 130) * u);
    const b = Math.round(246 + (166 - 246) * u);
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.66) {
    // teal → green
    const u = (t - 0.33) / 0.33;
    const r = Math.round(20 + (34 - 20) * u);
    const g = Math.round(184 + (197 - 184) * u);
    const b = Math.round(166 + (94 - 166) * u);
    return `rgb(${r},${g},${b})`;
  } else {
    // green
    return CHART_COLORS.green;
  }
}

export default function FunnelVisualizationWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [campaign, setCampaign] = useState<string>((config.campaign as string) || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const { filters } = useDashboardFilter();

  const effectiveCampaign = filters.campaign || campaign;

  const fetchData = useCallback((c: string) => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 90);
    const qp = c ? `&campaign=${encodeURIComponent(c)}` : '';
    fetch(`/api/insights/metrics/campaign-funnel?days=${days}${qp}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, filters.dateRange]);

  useEffect(() => { fetchData(effectiveCampaign); }, [effectiveCampaign, fetchData]);

  if (!data) return <div className="h-full animate-pulse rounded-xl bg-[#f5f5f5]" />;

  const stages = (data.funnel || []).filter(s => s.count > 0).slice(0, 8);
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const kpis = data.kpis;

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">

      {/* ── Campaign Selector ── */}
      <div className="flex items-center justify-between shrink-0">
        {filters.campaign ? (
          <div className="text-[10px] text-[#3b82f6] font-medium">Filtered: {filters.campaign}</div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors"
            >
              <span className="truncate max-w-[180px]">{data.campaign || 'All Campaigns'}</span>
              <ChevronDown className="w-3 h-3 text-[#a3a3a3] shrink-0" />
            </button>
            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e5e5] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-50 max-h-52 overflow-y-auto min-w-[220px]">
                <button
                  onClick={() => { setCampaign(''); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer transition-colors rounded-t-xl"
                >
                  All Campaigns
                </button>
                {(data.available_campaigns || []).map(c => (
                  <button
                    key={c.campaign}
                    onClick={() => { setCampaign(c.campaign); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer transition-colors flex justify-between"
                  >
                    <span className="truncate">{c.campaign}</span>
                    <span className="text-[#a3a3a3] ml-2 tabular-nums shrink-0">{c.total.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spend pill */}
        {kpis.total_spend > 0 && (
          <div className="text-[10px] font-medium text-[#525252] bg-[#f5f5f5] px-2.5 py-1 rounded-full tabular-nums">
            {formatCurrency(kpis.total_spend)} spent
          </div>
        )}
      </div>

      {/* ── CVR Summary Row ── */}
      <div className="grid grid-cols-3 gap-3 shrink-0 p-3 bg-[#fafafa] rounded-xl border border-[#f0f0f0]">
        {[
          {
            label: 'Click → Sign-up',
            value: kpis.cvr_click_to_signup,
            isGood: kpis.cvr_click_to_signup > 10,
          },
          {
            label: 'Click → Purchase',
            value: kpis.cvr_click_to_purchase,
            isGood: kpis.cvr_click_to_purchase > 5,
          },
          {
            label: 'Sign-up → Purchase',
            value: kpis.cvr_signup_to_purchase,
            isGood: kpis.cvr_signup_to_purchase > 50,
          },
        ].map(m => (
          <div key={m.label}>
            <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] mb-0.5">
              CVR {m.label}
            </div>
            <div
              className="text-xl font-semibold tabular-nums leading-none"
              style={{ color: m.value > 0 ? (m.isGood ? CHART_COLORS.green : '#1a1a1a') : '#d4d4d4' }}
            >
              {m.value > 0 ? formatPct(m.value) : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Visual Funnel ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {stages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-[#a3a3a3]">No funnel data for this period</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0 py-2">
            {stages.map((stage, i) => {
              // Log-scale width so massive top-of-funnel doesn't crush the rest
              const logMax = Math.log10(maxCount + 1);
              const logVal = Math.log10(stage.count + 1);
              const widthPct = Math.max(18, Math.round((logVal / logMax) * 100));

              const color = stageColor(i, stages.length);

              // Drop-off between this and the next stage
              const nextStage = stages[i + 1];
              const dropoff = nextStage && stage.count > 0
                ? Math.round((1 - nextStage.count / stage.count) * 100)
                : null;

              return (
                <div key={stage.stage} className="w-full flex flex-col items-center">
                  {/* Funnel band */}
                  <div
                    className="relative flex items-center justify-between px-3 transition-all duration-500 ease-out"
                    style={{
                      width: `${widthPct}%`,
                      height: 36,
                      backgroundColor: color,
                      borderRadius: i === 0
                        ? '10px 10px 4px 4px'
                        : i === stages.length - 1
                          ? '4px 4px 10px 10px'
                          : '4px',
                      opacity: 0.85 + 0.15 * (i / Math.max(stages.length - 1, 1)),
                    }}
                  >
                    {/* Stage label */}
                    <span
                      className="text-[10px] font-semibold truncate"
                      style={{ color: 'rgba(255,255,255,0.95)', maxWidth: '55%' }}
                    >
                      {stage.label}
                    </span>

                    {/* Count */}
                    <span
                      className="text-[11px] font-bold tabular-nums shrink-0 ml-2"
                      style={{ color: 'rgba(255,255,255,1)' }}
                    >
                      {formatCompact(stage.count)}
                    </span>
                  </div>

                  {/* Drop-off connector */}
                  {dropoff !== null && (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <div
                        className="w-px self-stretch"
                        style={{ backgroundColor: '#e5e5e5', minHeight: 8 }}
                      />
                      <span className="text-[9px] font-medium text-[#a3a3a3] tabular-nums">
                        {dropoff}% drop
                      </span>
                      <div
                        className="w-px self-stretch"
                        style={{ backgroundColor: '#e5e5e5', minHeight: 8 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom CPA strip */}
            {(kpis.cpa_signup > 0 || kpis.cpa_completion > 0) && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#f0f0f0] w-full justify-center">
                {kpis.cpa_signup > 0 && (
                  <div className="text-center">
                    <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">CPA Sign-up</div>
                    <div className="text-sm font-semibold text-[#1a1a1a] tabular-nums">{formatCurrency(kpis.cpa_signup, 2)}</div>
                  </div>
                )}
                {kpis.cpa_completion > 0 && (
                  <div className="text-center">
                    <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">CPA Completion</div>
                    <div className="text-sm font-semibold text-[#1a1a1a] tabular-nums">{formatCurrency(kpis.cpa_completion, 2)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
