"use client";

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';

interface PostRow {
  id: string;
  platform: string;
  content: string;
  engagement: number;
  source: string;
  published_at: string;
}

const PLATFORM_ICON: Record<string, string> = {
  facebook: 'fb',
  instagram: 'ig',
  linkedin: 'li',
  reddit: 'rd',
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

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const platformLabel = effectivePlatform ? (PLATFORM_LABEL[effectivePlatform] ?? effectivePlatform) : null;
  const isFilteredByContext = !!filters.platform;

  return (
    <div className="h-full flex flex-col gap-1.5">
      {isFilteredByContext && platformLabel && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[var(--muted-foreground)]">Showing:</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))' }}
          >
            {platformLabel}
            <button
              onClick={() => clearFilter('platform')}
              className="flex items-center cursor-pointer"
              aria-label="Clear platform filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-xs">
          {platformLabel ? `No posts for ${platformLabel}` : 'No posts yet'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {data.map(post => (
            <div
              key={post.id}
              className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors cursor-pointer"
            >
              <span
                className="text-[9px] font-bold leading-none mt-0.5 shrink-0 rounded px-1 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] uppercase"
              >
                {PLATFORM_ICON[post.platform] ?? '??'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--foreground)] truncate leading-snug">
                  {post.content || '(no text)'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {post.engagement.toLocaleString()} eng
                  </span>
                  <span
                    className={`text-[9px] rounded-full px-1.5 py-0.5 font-medium leading-none ${
                      post.source === 'pipeline'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
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
