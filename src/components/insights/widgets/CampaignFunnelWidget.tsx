"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { CHART_COLORS, formatCurrency, formatCompact, formatPct } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';
import { normalizeSource, getSourceColor } from '@/lib/source-normalization';

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversions: number;
}

interface Channel {
  source: string;
  medium: string;
  sessions: number;
  applies: number;
  signups: number;
  completions: number;
  cvr_click_to_signup: number;
  cvr_click_to_purchase: number;
  cvr_signup_to_purchase: number;
}

interface SpendPlatform {
  platform: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
}

interface FunnelData {
  campaign: string;
  funnel: FunnelStage[];
  channels: Channel[];
  spend: { total: number; impressions: number; clicks: number; by_platform: SpendPlatform[] };
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
    cvr_session_to_signup: number;
    cvr_session_to_purchase: number;
    cvr_signup_to_purchase: number;
  };
  available_campaigns: { campaign: string; total: number }[];
}

const SOURCE_COLOR: Record<string, string> = {
  'paid_media': CHART_COLORS.blue,
  'facebook': CHART_COLORS.blue,
  'google': CHART_COLORS.green,
  'brevo': CHART_COLORS.amber,
  'reddit': CHART_COLORS.orange,
  'Handshake': CHART_COLORS.purple,
  'youtube.com': CHART_COLORS.red,
};

export default function CampaignFunnelWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [campaign, setCampaign] = useState<string>((config.campaign as string) || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const { filters } = useDashboardFilter();

  const fetchData = useCallback((c: string) => {
    const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 90);
    const qp = c ? `&campaign=${encodeURIComponent(c)}` : '';
    fetch(`/api/insights/metrics/campaign-funnel?days=${days}${qp}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, filters.dateRange]);

  useEffect(() => { fetchData(campaign); }, [campaign, fetchData]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const maxCount = Math.max(...data.funnel.map(f => f.count), 1);
  const kpis = data.kpis;

  const funnelLength = data.funnel.length || 1;
  function funnelOpacity(i: number): number {
    return 1 - (i / funnelLength) * 0.7;
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Campaign Selector */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors"
          >
            <span className="truncate max-w-[160px]">{data.campaign || 'All Campaigns'}</span>
            <ChevronDown className="w-3 h-3 text-[#a3a3a3] shrink-0" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[#e5e5e5] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.06)] z-50 max-h-48 overflow-y-auto min-w-[200px]">
              <button
                onClick={() => { setCampaign(''); setShowDropdown(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer transition-colors"
              >
                All Campaigns
              </button>
              {data.available_campaigns.map(c => (
                <button
                  key={c.campaign}
                  onClick={() => { setCampaign(c.campaign); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer transition-colors flex justify-between"
                >
                  <span className="truncate">{c.campaign}</span>
                  <span className="text-[#a3a3a3] ml-2 tabular-nums">{c.total.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Row — top line: spend + volume */}
      <div className="grid grid-cols-6 gap-4 shrink-0">
        {[
          { label: 'Ad Spend', value: formatCurrency(kpis.total_spend) },
          { label: 'Sessions', value: formatCompact(kpis.total_sessions) },
          { label: 'Project Signups', value: formatCompact(kpis.signups) },
          { label: 'Completions', value: formatCompact(kpis.completions) },
          { label: 'CPA Sign-up', value: kpis.cpa_signup > 0 ? formatCurrency(kpis.cpa_signup, 2) : '—' },
          { label: 'CPA Completion', value: kpis.cpa_completion > 0 ? formatCurrency(kpis.cpa_completion, 2) : '—' },
        ].map(c => (
          <div key={c.label}>
            <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] mb-1">{c.label}</div>
            <div className="text-lg font-semibold text-[#1a1a1a] tracking-tight leading-none tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* CVR Row — the killer metrics, highlighted */}
      <div className="grid grid-cols-3 gap-4 shrink-0 py-3 border-y border-[#f0f0f0]">
        {[
          { label: 'CVR Click → Sign-up', value: kpis.cvr_click_to_signup, color: kpis.cvr_click_to_signup > 10 ? '#22c55e' : kpis.cvr_click_to_signup > 5 ? '#1a1a1a' : '#a3a3a3' },
          { label: 'CVR Click → Purchase', value: kpis.cvr_click_to_purchase, color: kpis.cvr_click_to_purchase > 20 ? '#22c55e' : kpis.cvr_click_to_purchase > 5 ? '#1a1a1a' : '#a3a3a3' },
          { label: 'CVR Sign-up → Purchase', value: kpis.cvr_signup_to_purchase, color: kpis.cvr_signup_to_purchase > 50 ? '#22c55e' : kpis.cvr_signup_to_purchase > 20 ? '#1a1a1a' : '#a3a3a3' },
        ].map(c => (
          <div key={c.label}>
            <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] mb-1">{c.label}</div>
            <div className="text-2xl font-semibold tracking-tight leading-none tabular-nums" style={{ color: c.color }}>
              {formatPct(c.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Funnel + breakdown — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] mb-1">
          Conversion Funnel
        </p>
        {data.funnel.map((stage, i) => {
          // Use log scale to prevent huge bars from dominating
          const logMax = Math.log10(maxCount + 1);
          const logVal = Math.log10(stage.count + 1);
          const widthPct = Math.max(6, (logVal / logMax) * 100);
          const dropoff = i > 0 && data.funnel[i - 1].count > 0
            ? Math.round((1 - stage.count / data.funnel[i - 1].count) * 100)
            : null;

          // Color gradient: blue at top → teal in middle → green at bottom (conversion)
          const t = i / Math.max(data.funnel.length - 1, 1);
          const barColor = t < 0.4 ? '#3b82f6' : t < 0.7 ? '#14b8a6' : '#22c55e';

          return (
            <div key={stage.stage} className="flex items-center gap-2">
              <div className="w-24 text-right text-[10px] text-[#a3a3a3] shrink-0 truncate" title={stage.label}>
                {stage.label}
              </div>
              <div className="flex-1 relative h-6">
                <div
                  className="absolute inset-y-0.5 left-0 rounded transition-all duration-500 ease-out"
                  style={{ width: `${widthPct}%`, backgroundColor: barColor, opacity: 0.15 + (0.7 * (1 - t)) }}
                />
                <div className="absolute inset-y-0 left-2 flex items-center">
                  <span className="text-[10px] font-semibold text-[#1a1a1a] tabular-nums">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              {dropoff !== null && dropoff > 0 && (
                <div className="w-10 text-right text-[9px] text-[#a3a3a3] shrink-0 tabular-nums">
                  {dropoff}%
                </div>
              )}
            </div>
          );
        })}

        {/* Channel Breakdown — now with CVR per channel */}
        {data.channels.length > 0 && (
          <>
            <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] pt-3">
              By Channel
            </p>
            {/* Column headers */}
            <div className="flex items-center gap-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pb-0.5 border-b border-[#f5f5f5]">
              <div className="w-1.5 shrink-0" />
              <div className="flex-1">Source</div>
              <div className="w-14 text-right">Sessions</div>
              <div className="w-14 text-right">Sign-ups</div>
              <div className="w-14 text-right">Done</div>
              <div className="w-12 text-right">CVR</div>
            </div>
            <div className="space-y-0">
              {data.channels.map(ch => (
                <div key={`${ch.source}-${ch.medium}`} className="flex items-center gap-2 text-[10px] py-1.5 border-b border-[#fafafa]">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: getSourceColor(normalizeSource(ch.source)) }}
                  />
                  <div className="flex-1 truncate text-[#525252]">
                    {normalizeSource(ch.source)} / {ch.medium}
                  </div>
                  <div className="w-14 text-right text-[#a3a3a3] tabular-nums">
                    {formatCompact(ch.sessions)}
                  </div>
                  <div className="w-14 text-right text-[#1a1a1a] font-medium tabular-nums">
                    {formatCompact(ch.signups)}
                  </div>
                  <div className="w-14 text-right font-medium tabular-nums" style={{ color: ch.completions > 0 ? '#22c55e' : '#a3a3a3' }}>
                    {formatCompact(ch.completions)}
                  </div>
                  <div
                    className="w-12 text-right font-semibold tabular-nums"
                    style={{ color: ch.cvr_click_to_purchase > 20 ? '#22c55e' : ch.cvr_click_to_purchase > 5 ? '#1a1a1a' : '#a3a3a3' }}
                  >
                    {ch.cvr_click_to_purchase > 0 ? formatPct(ch.cvr_click_to_purchase) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Spend by Platform — top 8 only */}
        {data.spend.by_platform.length > 0 && (
          <>
            <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] pt-4 mb-1">
              Top Campaigns by Spend
            </p>
            <div className="flex items-center gap-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pb-1 border-b border-[#f0f0f0]">
              <div className="w-8 shrink-0">Src</div>
              <div className="flex-1">Campaign</div>
              <div className="w-16 text-right">Spend</div>
              <div className="w-16 text-right">Impr</div>
            </div>
            <div className="space-y-0">
              {data.spend.by_platform
                .sort((a: SpendPlatform, b: SpendPlatform) => b.spend - a.spend)
                .slice(0, 8)
                .map((sp, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-1.5 border-b border-[#fafafa]">
                  <div className="w-8 shrink-0 text-[9px] text-[#a3a3a3]">{sp.platform.replace('_ads', '').slice(0, 5)}</div>
                  <div className="flex-1 truncate text-[#525252] max-w-[200px]">{sp.campaign_name || '—'}</div>
                  <div className="w-16 text-right font-semibold text-[#1a1a1a] tabular-nums">{formatCurrency(sp.spend)}</div>
                  <div className="w-16 text-right text-[#a3a3a3] tabular-nums">{formatCompact(sp.impressions)}</div>
                </div>
              ))}
            </div>
            {data.spend.by_platform.length > 8 && (
              <div className="text-[9px] text-[#a3a3a3] pt-1">+{data.spend.by_platform.length - 8} more campaigns</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
