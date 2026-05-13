"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { CHART_COLORS } from '../chartTheme';

interface PostRow {
  id: string;
  platform: string;
  content: string;
  engagement: number;
  source: string;
  published_at: string;
}

const PLATFORM_COLOR: Record<string, string> = {
  facebook: CHART_COLORS.blue,
  instagram: CHART_COLORS.purple,
  linkedin: CHART_COLORS.teal,
  reddit: CHART_COLORS.orange,
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
};

export default function OrganicTopPostsWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PostRow[] | null>(null);
  const { filters, clearFilter } = useDashboardFilter();

  const effectivePlatform = filters.platform || (config.platform as string) || '';

  useEffect(() => {
    setData(null);
    const days = (config.days as number) || 30;
    const url = `/api/insights/metrics/organic-posts?days=${days}&sort=engagement&limit=20${effectivePlatform ? `&platform=${effectivePlatform}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData([]));
  }, [config.days, effectivePlatform]);

  if (!data) return <div className="h-full animate-pulse rounded bg-[#f5f5f5]" />;

  const platformLabel = effectivePlatform ? (PLATFORM_LABEL[effectivePlatform] ?? effectivePlatform) : null;
  const isFilteredByContext = !!filters.platform;

  return (
    <div className="h-full flex flex-col gap-1.5">
      {/* Filter chip */}
      {isFilteredByContext && platformLabel && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[#a3a3a3]">Showing:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb]">
            {platformLabel}
            <button
              onClick={() => clearFilter('platform')}
              className="flex items-center cursor-pointer"
              aria-label="Clear platform filter"
            >
              <X className="w-3 h-3 text-[#a3a3a3]" />
            </button>
          </span>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#a3a3a3] text-xs">
          {platformLabel ? `No posts for ${platformLabel}` : 'No posts yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
          {data.map(post => (
            <div
              key={post.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer"
            >
              {/* Platform dot */}
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                style={{ backgroundColor: PLATFORM_COLOR[post.platform] ?? '#d4d4d4' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#1a1a1a] truncate leading-snug">
                  {post.content || '(no text)'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-[#a3a3a3]">
                    {post.engagement.toLocaleString()} eng
                  </span>
                  <span
                    className={`text-[9px] rounded px-1.5 py-0.5 font-medium leading-none ${
                      post.source === 'pipeline'
                        ? 'text-[#22c55e] bg-[#f0fdf4]'
                        : 'text-[#a3a3a3] bg-[#f5f5f5]'
                    }`}
                  >
                    {post.source}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
