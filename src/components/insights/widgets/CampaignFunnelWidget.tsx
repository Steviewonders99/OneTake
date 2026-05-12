"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, DollarSign, Users, Target, TrendingUp } from 'lucide-react';
import { CHART_COLORS } from '../chartTheme';

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

const GRADIENT = 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))';

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

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const maxCount = Math.max(...data.funnel.map(f => f.count), 1);
  const kpis = data.kpis;

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Campaign Selector */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: GRADIENT }}
          >
            {data.campaign}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-[200px]">
              <button
                onClick={() => { setCampaign(''); setShowDropdown(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] cursor-pointer transition-colors"
              >
                All Campaigns
              </button>
              {data.available_campaigns.map(c => (
                <button
                  key={c.campaign}
                  onClick={() => { setCampaign(c.campaign); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] cursor-pointer transition-colors flex justify-between"
                >
                  <span className="truncate">{c.campaign}</span>
                  <span className="text-[var(--muted-foreground)] ml-2">{c.total.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {[
          { label: 'Ad Spend', value: `$${kpis.total_spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, Icon: DollarSign },
          { label: 'Sign-ups', value: kpis.signups.toLocaleString(), Icon: Users },
          { label: 'Completions', value: kpis.completions.toLocaleString(), Icon: Target },
          { label: 'CPA (Sign-up)', value: kpis.cpa_signup > 0 ? `$${kpis.cpa_signup.toFixed(2)}` : '—', Icon: TrendingUp },
        ].map(c => (
          <div key={c.label} className="px-2 py-2 rounded-lg bg-[var(--muted)] text-center">
            <c.Icon className="w-3 h-3 mx-auto mb-0.5 text-[var(--muted-foreground)]" />
            <div className="text-xs font-bold text-[var(--foreground)] leading-none">{c.value}</div>
            <div className="text-[9px] text-[var(--muted-foreground)]">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Funnel Visualization */}
      <div className="flex-1 overflow-y-auto space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Conversion Funnel
        </div>
        {data.funnel.map((stage, i) => {
          const widthPct = Math.max(8, (stage.count / maxCount) * 100);
          const dropoff = i > 0 && data.funnel[i - 1].count > 0
            ? ((1 - stage.count / data.funnel[i - 1].count) * 100).toFixed(0)
            : null;

          return (
            <div key={stage.stage} className="flex items-center gap-2">
              <div className="w-24 text-right text-[10px] text-[var(--muted-foreground)] shrink-0 truncate" title={stage.label}>
                {stage.label}
              </div>
              <div className="flex-1 relative h-6">
                <div
                  className="absolute inset-y-0 left-0 rounded-r-md transition-all duration-500 ease-out flex items-center"
                  style={{
                    width: `${widthPct}%`,
                    background: i < 4 ? CHART_COLORS.blue : i < 8 ? CHART_COLORS.teal : CHART_COLORS.green,
                    opacity: 0.15 + (0.85 * (1 - i / data.funnel.length)),
                  }}
                />
                <div className="absolute inset-y-0 left-2 flex items-center">
                  <span className="text-[10px] font-semibold text-[var(--foreground)]">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              {dropoff && (
                <div className="w-10 text-right text-[9px] text-red-400 shrink-0">
                  -{dropoff}%
                </div>
              )}
            </div>
          );
        })}

        {/* Channel Breakdown */}
        {data.channels.length > 0 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mt-3">
              By Channel
            </div>
            <div className="space-y-0.5">
              {data.channels.map(ch => (
                <div key={`${ch.source}-${ch.medium}`} className="flex items-center gap-2 text-[10px] py-1 px-1 rounded hover:bg-[var(--muted)] transition-colors">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: SOURCE_COLOR[ch.source] || CHART_COLORS.charcoal }}
                  />
                  <div className="flex-1 truncate text-[var(--foreground)]">
                    {ch.source} / {ch.medium}
                  </div>
                  <div className="text-[var(--muted-foreground)] whitespace-nowrap">
                    {ch.sessions.toLocaleString()} sess
                  </div>
                  <div className="text-[var(--foreground)] font-semibold whitespace-nowrap">
                    {ch.signups.toLocaleString()} sign-ups
                  </div>
                  <div className="text-green-600 font-semibold whitespace-nowrap">
                    {ch.completions.toLocaleString()} done
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Spend by Platform */}
        {data.spend.by_platform.length > 0 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mt-3">
              Ad Spend by Platform
            </div>
            <div className="space-y-0.5">
              {data.spend.by_platform.map((sp, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-1 px-1">
                  <div className="w-14 shrink-0 text-[var(--muted-foreground)]">{sp.platform.replace('_ads', '')}</div>
                  <div className="flex-1 truncate text-[var(--foreground)]">{sp.campaign_name}</div>
                  <div className="font-semibold text-[var(--foreground)]">${sp.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-[var(--muted-foreground)]">{sp.impressions.toLocaleString()} impr</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
