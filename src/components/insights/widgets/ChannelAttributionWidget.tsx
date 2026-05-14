"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCompact, formatPct, CHART_COLORS } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

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

interface ChannelData {
  campaign: string;
  channels: Channel[];
  available_campaigns: { campaign: string; total: number }[];
}

const SOURCE_COLOR: Record<string, string> = {
  paid_media: CHART_COLORS.blue,
  facebook: CHART_COLORS.blue,
  google: CHART_COLORS.green,
  brevo: CHART_COLORS.amber,
  reddit: CHART_COLORS.orange,
  Handshake: CHART_COLORS.purple,
  'youtube.com': CHART_COLORS.red,
  linkedin: CHART_COLORS.teal,
  tiktok: CHART_COLORS.purple,
  email: CHART_COLORS.amber,
  organic: CHART_COLORS.charcoal,
};

function shortenSource(source: string): string {
  const map: Record<string, string> = {
    'paid_media': 'Paid Media',
    'facebook': 'Facebook',
    'brevo': 'Brevo',
    'google': 'Google',
    'Handshake': 'Handshake',
    'youtube.com': 'YouTube',
    'l.facebook.com': 'FB Referral',
    'linkedin': 'LinkedIn',
    'LinkedIn': 'LinkedIn',
    'tiktok': 'TikTok',
    '(direct)': 'Direct',
    'ig': 'Instagram',
    'Indeed': 'Indeed',
    'reddit': 'Reddit',
  };
  for (const [k, v] of Object.entries(map)) {
    if (source.toLowerCase() === k.toLowerCase()) return v;
    if (source.toLowerCase().includes(k.toLowerCase())) return v;
  }
  // Truncate anything over 12 chars
  return source.length > 12 ? source.slice(0, 11) + '…' : source;
}

function sourceColor(source: string): string {
  const key = source.toLowerCase();
  for (const [k, v] of Object.entries(SOURCE_COLOR)) {
    if (key.includes(k.toLowerCase())) return v;
  }
  return '#d4d4d4';
}

export default function ChannelAttributionWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<ChannelData | null>(null);
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

  if (!data) return <div className="h-full animate-pulse rounded-xl bg-[#f5f5f5]" />;

  const channels = (data.channels || []).slice(0, 10);

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      {/* ── Header: Campaign Selector ── */}
      <div className="flex items-center justify-between shrink-0">
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

        <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">
          {channels.length} source{channels.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-[#a3a3a3]">No channel data for this period</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="text-left pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] w-4 pr-1" />
                <th className="text-left pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">Source</th>
                <th className="text-right pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pr-1">Sessions</th>
                <th className="text-right pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pr-1">Sign-ups</th>
                <th className="text-right pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] pr-1">Done</th>
                <th className="text-right pb-2 text-[8px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em]">CVR</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(ch => {
                const cvr = ch.cvr_click_to_purchase;
                const cvrColor = cvr > 20 ? CHART_COLORS.green : cvr > 5 ? '#1a1a1a' : '#a3a3a3';
                return (
                  <tr
                    key={`${ch.source}-${ch.medium}`}
                    className="border-b border-[#fafafa] hover:bg-[#fafafa] transition-colors group"
                  >
                    <td className="py-2 pr-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: sourceColor(ch.source) }}
                      />
                    </td>
                    <td className="py-2 pr-2 max-w-[100px]">
                      <div className="text-[11px] text-[#1a1a1a] font-medium truncate">
                        {shortenSource(ch.source)}
                      </div>
                      <div className="text-[9px] text-[#a3a3a3] truncate">{ch.medium}</div>
                    </td>
                    <td className="py-2 pr-1 text-right text-[11px] text-[#a3a3a3] tabular-nums">
                      {formatCompact(ch.sessions)}
                    </td>
                    <td className="py-2 pr-1 text-right text-[11px] text-[#1a1a1a] font-medium tabular-nums">
                      {formatCompact(ch.signups)}
                    </td>
                    <td className="py-2 pr-1 text-right text-[11px] font-medium tabular-nums"
                      style={{ color: ch.completions > 0 ? CHART_COLORS.green : '#a3a3a3' }}
                    >
                      {formatCompact(ch.completions)}
                    </td>
                    <td className="py-2 text-right text-[11px] font-semibold tabular-nums"
                      style={{ color: cvrColor }}
                    >
                      {cvr > 0 ? formatPct(cvr) : '—'}
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
