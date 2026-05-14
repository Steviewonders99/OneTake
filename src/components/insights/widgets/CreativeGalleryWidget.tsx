"use client";

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCompact, formatCurrency, formatPct } from '../chartTheme';
import { useDashboardFilter } from '../DashboardFilterContext';

interface Creative {
  ad_id: string;
  ad_name: string;
  creative_id: string;
  creative_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_name: string;
  status: string;
  image_url: string;
  thumbnail_url: string;
  video_id: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  funnel_sessions: number;
  funnel_signups: number;
  funnel_completions: number;
  funnel_cvr: number;
}

interface GalleryData {
  creatives: Creative[];
  total: number;
  available_campaigns: { campaign_name: string; total_conversions: number }[];
}

type SortKey = 'conversions' | 'ctr' | 'clicks' | 'spend';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'conversions', label: 'Conversions' },
  { key: 'ctr', label: 'CTR' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'spend', label: 'Spend' },
];

function ImagePlaceholder() {
  return (
    <div className="w-full aspect-square bg-[#f5f5f5] flex items-center justify-center">
      <div className="w-8 h-8 rounded bg-[#e5e5e5]" />
    </div>
  );
}

function CreativeCard({ c }: { c: Creative }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = c.image_url || c.thumbnail_url;

  return (
    <div className="border border-[#f0f0f0] rounded-xl overflow-hidden bg-white transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] group">
      {/* Image — 1:1 square, object-cover to fill without distortion */}
      <div className="w-full aspect-square overflow-hidden bg-[#f5f5f5] rounded-t-xl">
        {imgSrc && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={c.ad_name || c.creative_name || 'Ad creative'}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImagePlaceholder />
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Ad name + campaign */}
        <div>
          <p
            className="text-[11px] font-semibold text-[#1a1a1a] leading-tight truncate"
            title={c.ad_name}
          >
            {c.ad_name || c.creative_name || '(Untitled)'}
          </p>
          <p className="text-[10px] text-[#a3a3a3] truncate mt-0.5" title={c.campaign_name}>
            {c.campaign_name || '—'}
          </p>
        </div>

        {/* Ad metrics row */}
        <div className="grid grid-cols-5 gap-1 pt-1 border-t border-[#f5f5f5]">
          <MetricCell label="Impr" value={formatCompact(c.impressions)} />
          <MetricCell label="Clicks" value={formatCompact(c.clicks)} />
          <MetricCell label="CTR" value={formatPct(c.ctr)} />
          <MetricCell
            label="Conv"
            value={formatCompact(c.conversions)}
            highlight={c.conversions > 0 ? '#22c55e' : undefined}
          />
          <MetricCell
            label="CPA"
            value={c.cpa > 0 ? formatCurrency(c.cpa, 2) : '—'}
          />
        </div>

        {/* Funnel metrics row — full funnel quality */}
        {(c.funnel_sessions > 0 || c.funnel_signups > 0) && (
          <div className="grid grid-cols-4 gap-1 pt-1 border-t border-[#f5f5f5]">
            <MetricCell label="Sessions" value={formatCompact(c.funnel_sessions)} />
            <MetricCell label="Sign-ups" value={formatCompact(c.funnel_signups)} highlight={c.funnel_signups > 0 ? '#3b82f6' : undefined} />
            <MetricCell label="Complete" value={formatCompact(c.funnel_completions)} highlight={c.funnel_completions > 0 ? '#22c55e' : undefined} />
            <MetricCell label="CVR" value={c.funnel_cvr > 0 ? formatPct(c.funnel_cvr) : '—'} highlight={c.funnel_cvr > 20 ? '#22c55e' : c.funnel_cvr > 5 ? '#1a1a1a' : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.06em] truncate">
        {label}
      </div>
      <div
        className="text-[11px] font-semibold tabular-nums truncate"
        style={{ color: highlight || '#1a1a1a' }}
      >
        {value}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-[#f0f0f0] rounded-xl overflow-hidden">
      <div className="w-full h-40 bg-[#f5f5f5] animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[#f0f0f0] rounded animate-pulse w-3/4" />
        <div className="h-2.5 bg-[#f5f5f5] rounded animate-pulse w-1/2" />
        <div className="grid grid-cols-5 gap-1 pt-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 bg-[#f5f5f5] rounded animate-pulse" />
              <div className="h-3 bg-[#f0f0f0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CreativeGalleryWidget({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const [data, setData] = useState<GalleryData | null>(null);
  const [campaign, setCampaign] = useState<string>((config.campaign as string) || '');
  const [sort, setSort] = useState<SortKey>('conversions');
  const [showDropdown, setShowDropdown] = useState(false);
  const { filters } = useDashboardFilter();

  const fetchData = useCallback(
    (c: string, s: SortKey) => {
      const days = filters.dateRange
        ? parseInt(filters.dateRange)
        : ((config.days as number) || 30);
      const params = new URLSearchParams({
        days: String(days),
        sort: s,
        limit: '20',
      });
      if (c) params.set('campaign', c);
      fetch(`/api/insights/metrics/creative-gallery?${params}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    },
    [config.days, filters.dateRange],
  );

  useEffect(() => {
    fetchData(campaign, sort);
  }, [campaign, sort, fetchData]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Campaign selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors"
          >
            <span className="truncate max-w-[160px]">
              {campaign || 'All Campaigns'}
            </span>
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
              {(data?.available_campaigns ?? []).map((c) => (
                <button
                  key={c.campaign_name}
                  onClick={() => { setCampaign(c.campaign_name); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[#525252] hover:bg-[#f5f5f5] cursor-pointer transition-colors flex justify-between"
                >
                  <span className="truncate">{c.campaign_name}</span>
                  <span className="text-[#a3a3a3] ml-2 tabular-nums">
                    {c.total_conversions.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort toggle pills */}
        <div className="flex items-center gap-1 ml-auto">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${
                sort === opt.key
                  ? 'bg-[#32373c] text-white'
                  : 'bg-[#f5f5f5] text-[#525252] hover:bg-[#ebebeb]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!data ? (
          // Loading skeleton
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : data.creatives.length === 0 ? (
          // Empty state
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-[#a3a3a3]">No creatives found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
            {data.creatives.map((c) => (
              <CreativeCard key={c.ad_id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
