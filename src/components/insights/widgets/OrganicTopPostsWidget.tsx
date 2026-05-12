"use client";

import { useEffect, useState } from 'react';

interface PostRow {
  id: string;
  platform: string;
  content: string;
  engagement: number;
  source: string;
  published_at: string;
}

const PLATFORM_EMOJI: Record<string, string> = {
  facebook: '📘',
  instagram: '📷',
  linkedin: '💼',
  reddit: '🔶',
};

export default function OrganicTopPostsWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PostRow[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    const platform = (config.platform as string) || '';
    const url = `/api/insights/metrics/organic-posts?days=${days}&sort=engagement&limit=20${platform ? `&platform=${platform}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days, config.platform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--muted-foreground)] text-xs">
        No posts yet
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-1 overflow-y-auto">
      {data.map(post => (
        <div
          key={post.id}
          className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors cursor-pointer"
        >
          <span className="text-sm leading-none mt-0.5 shrink-0">
            {PLATFORM_EMOJI[post.platform] ?? '📄'}
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
  );
}
