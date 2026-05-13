"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { CHART_COLORS, formatCurrency, formatCompact } from '../chartTheme';

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
  signups: number;
  completions: number;
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
    signups: number;
    completions: number;
    cpa_signup: number;
    cpa_completion: number;
    conversion_rate: number;
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

  const fetchData = useCallback((c: string) => {
    const days = (config.days as number) || 90;
    const qp = c ? `&campaign=${encodeURIComponent(c)}` : '';
    fetch(`/api/insights/metrics/campaign-funnel?days=${days}${qp}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  useEffect(() => { fetchData(campaign); }, [campaign, fetchData]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const maxCount = Math.max(...data.funnel.map(f => f.count), 1);
  const kpis = data.kpis;

  // Funnel bar fill: single muted color, progressively darker as funnel narrows
  const funnelLength = data.funnel.length || 1;
  function funnelFill(i: number): string {
    // From lightest (#e5e5e5) at top to darkest (#525252) at bottom
    const t = i / Math.max(funnelLength - 1, 1);
    // Interpolate between #e5e5e5 (229,229,229) and #525252 (82,82,82)
    const r = Math.round(229 - t * (229 - 82));
    const g = Math.round(229 - t * (229 - 82));
    const b = Math.round(229 - t * (229 - 82));
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
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
                  <span className="text-[#a3a3a3] ml-2">{c.total.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Row — tiny label + big value, no icons */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Ad Spend', value: formatCurrency(kpis.total_spend) },
          { label: 'Sign-ups', value: formatCompact(kpis.signups) },
          { label: 'Completions', value: formatCompact(kpis.completions) },
          { label: 'CPA Sign-up', value: kpis.cpa_signup > 0 ? formatCurrency(kpis.cpa_signup, 2) : '—' },
        ].map(c => (
          <div key={c.label} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">{c.label}</span>
            <span className="text-xl font-semibold text-[#1a1a1a] tracking-tight leading-none">{c.value}</span>
          </div>
        ))}
      </div>

      {/* Funnel + breakdown — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {/* Conversion Funnel */}
        <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">
          Conversion Funnel
        </p>
        {data.funnel.map((stage, i) => {
          const widthPct = Math.max(8, (stage.count / maxCount) * 100);
          const dropoff = i > 0 && data.funnel[i - 1].count > 0
            ? ((1 - stage.count / data.funnel[i - 1].count) * 100).toFixed(0)
            : null;

          return (
            <div key={stage.stage} className="flex items-center gap-2">
              <div className="w-24 text-right text-[10px] text-[#a3a3a3] shrink-0 truncate" title={stage.label}>
                {stage.label}
              </div>
              <div className="flex-1 relative h-5">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm transition-all duration-500 ease-out"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: funnelFill(i),
                  }}
                />
                <div className="absolute inset-y-0 left-2 flex items-center">
                  <span className="text-[10px] font-semibold text-[#525252]">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              {dropoff !== null && (
                <div className="w-10 text-right text-[9px] text-[#ef4444] shrink-0">
                  -{dropoff}%
                </div>
              )}
            </div>
          );
        })}

        {/* Channel Breakdown */}
        {data.channels.length > 0 && (
          <>
            <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] pt-3">
              By Channel
            </p>
            <div className="space-y-0.5">
              {data.channels.map(ch => (
                <div key={`${ch.source}-${ch.medium}`} className="flex items-center gap-2 text-[10px] py-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: SOURCE_COLOR[ch.source] || '#d4d4d4' }}
                  />
                  <div className="flex-1 truncate text-[#525252]">
                    {ch.source} / {ch.medium}
                  </div>
                  <div className="text-[#a3a3a3] whitespace-nowrap">
                    {formatCompact(ch.sessions)} sess
                  </div>
                  <div className="text-[#1a1a1a] font-semibold whitespace-nowrap">
                    {formatCompact(ch.signups)} sign-ups
                  </div>
                  <div className="text-[#22c55e] font-semibold whitespace-nowrap">
                    {formatCompact(ch.completions)} done
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Spend by Platform */}
        {data.spend.by_platform.length > 0 && (
          <>
            <p className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em] pt-3">
              Ad Spend by Platform
            </p>
            <div className="space-y-0.5">
              {data.spend.by_platform.map((sp, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-1">
                  <div className="w-14 shrink-0 text-[#a3a3a3]">{sp.platform.replace('_ads', '')}</div>
                  <div className="flex-1 truncate text-[#525252]">{sp.campaign_name}</div>
                  <div className="font-semibold text-[#1a1a1a]">{formatCurrency(sp.spend)}</div>
                  <div className="text-[#a3a3a3]">{formatCompact(sp.impressions)} impr</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
