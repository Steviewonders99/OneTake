'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';

interface Post {
  postId: string;
  postUrl: string;
  postText: string;
  postType: string;
  platform: string;
  publishedAt: string;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  // GA4 cross-reference
  ga4Sessions?: number;
  ga4Conversions?: number;
  // Auto-classified
  contentType?: 'job_alert' | 'kyc_helpdesk' | 'holiday' | 'story' | 'other';
}

interface PostPerformanceGridProps {
  posts: Post[];
}

const CONTENT_TYPE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  job_alert: { label: 'Job Alert', bg: '#EDE9FE', color: '#6D28D9' },
  kyc_helpdesk: { label: 'KYC / Helpdesk', bg: '#FEE2E2', color: '#991B1B' },
  holiday: { label: 'Holiday', bg: '#FEF3C7', color: '#92400E' },
  story: { label: 'Story', bg: '#DBEAFE', color: '#1E40AF' },
  other: { label: 'Other', bg: '#F3F4F6', color: '#6B7280' },
};

function classifyPost(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('kyc') || lower.includes('safe online') || lower.includes('verification') ||
      lower.includes('flagged') || lower.includes('suspicious') || lower.includes('payment delay') ||
      lower.includes('persona') || lower.includes('security')) return 'kyc_helpdesk';
  if (lower.includes('eid') || lower.includes('new year') || lower.includes('lunar') ||
      lower.includes('ramadan') || lower.includes('christmas') || lower.includes('happy')) return 'holiday';
  if (lower.includes('job alert') || lower.includes('new job') || lower.includes('project') ||
      lower.includes('paid') || lower.includes('sign up') || lower.includes('hiring') ||
      lower.includes('opportunity') || lower.includes('apply')) return 'job_alert';
  if (lower.includes('experience') || lower.includes('thank you') || lower.includes('testimonial')) return 'story';
  return 'other';
}

function getVerdict(post: Post): { label: string; bg: string; color: string } {
  const sessions = post.ga4Sessions ?? 0;
  const type = post.contentType ?? classifyPost(post.postText);
  if (type === 'kyc_helpdesk' || type === 'holiday') return { label: 'KILL', bg: '#FEF2F2', color: '#991B1B' };
  if (sessions > 20) return { label: 'KEEP', bg: '#EFF6FF', color: '#1E40AF' };
  if (sessions > 5) return { label: 'FIX', bg: '#FFF7ED', color: '#92400E' };
  return { label: 'KILL', bg: '#FEF2F2', color: '#991B1B' };
}

export function PostPerformanceGrid({ posts }: PostPerformanceGridProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'engagement' | 'ga4Sessions'>('engagement');

  const classified = posts.map(p => ({
    ...p,
    contentType: p.contentType ?? classifyPost(p.postText) as Post['contentType'],
  }));

  const filtered = filter ? classified.filter(p => p.contentType === filter) : classified;
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'ga4Sessions') return (b.ga4Sessions ?? 0) - (a.ga4Sessions ?? 0);
    return b.engagement - a.engagement;
  });

  const typeCounts = classified.reduce((acc, p) => {
    const t = p.contentType ?? 'other';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: BRAND.text }}>
          <span className="w-5 h-5 rounded-[5px] inline-flex items-center justify-center text-[8px] font-extrabold text-white"
                style={{ background: BRAND.pink }}>ig</span>
          Post Performance
        </h3>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: BRAND.text3 }}>
          Sort:
          <button onClick={() => setSortBy('engagement')}
                  className={`font-semibold ${sortBy === 'engagement' ? 'text-[#111]' : ''}`}>Engagement</button>
          |
          <button onClick={() => setSortBy('ga4Sessions')}
                  className={`font-semibold ${sortBy === 'ga4Sessions' ? 'text-[#111]' : ''}`}>Site Traffic</button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button onClick={() => setFilter(null)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                  !filter ? 'bg-[#111827] text-white' : 'border border-[#E5E7EB] text-[#4B5563]'
                }`}>
          All ({posts.length})
        </button>
        {Object.entries(typeCounts).map(([type, count]) => {
          const cfg = CONTENT_TYPE_CONFIG[type] ?? CONTENT_TYPE_CONFIG.other;
          return (
            <button key={type} onClick={() => setFilter(filter === type ? null : type)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                      filter === type ? 'text-white' : ''
                    }`}
                    style={{
                      background: filter === type ? cfg.color : 'transparent',
                      color: filter === type ? 'white' : cfg.color,
                      border: `1px solid ${filter === type ? cfg.color : '#E5E7EB'}`,
                    }}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Post cards grid */}
      <div className="grid grid-cols-3 gap-3">
        {sorted.slice(0, 9).map(post => {
          const type = post.contentType ?? 'other';
          const cfg = CONTENT_TYPE_CONFIG[type] ?? CONTENT_TYPE_CONFIG.other;
          const verdict = getVerdict(post);
          const sessions = post.ga4Sessions ?? 0;

          return (
            <div key={post.postId} className="border border-black/[0.08] rounded-[10px] overflow-hidden"
                 style={{ opacity: verdict.label === 'KILL' ? 0.7 : 1 }}>
              <div className="px-3 py-2 flex justify-between items-center" style={{ background: BRAND.bgRaised }}>
                <span className="text-[10px] font-semibold" style={{ color: BRAND.text }}>
                  {post.publishedAt?.split('T')[0] ?? '—'}
                </span>
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-[10px]"
                      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label.toUpperCase()}</span>
              </div>
              <div className="px-3 py-2.5 text-[11px] leading-[1.5] h-[52px] overflow-hidden"
                   style={{ color: BRAND.text2 }}>
                {post.postText.slice(0, 100)}{post.postText.length > 100 ? '...' : ''}
              </div>
              <div className="px-3 pb-2 grid grid-cols-3 gap-1.5 text-center">
                <div>
                  <div className="text-[14px] font-extrabold" style={{ color: BRAND.text }}>{post.engagement}</div>
                  <div className="text-[8px] uppercase tracking-[0.08em]" style={{ color: BRAND.text3 }}>Eng</div>
                </div>
                <div>
                  <div className="text-[14px] font-extrabold" style={{ color: BRAND.blue }}>{post.likes}</div>
                  <div className="text-[8px] uppercase tracking-[0.08em]" style={{ color: BRAND.text3 }}>Likes</div>
                </div>
                <div>
                  <div className="text-[14px] font-extrabold" style={{ color: BRAND.purple }}>{post.comments}</div>
                  <div className="text-[8px] uppercase tracking-[0.08em]" style={{ color: BRAND.text3 }}>Comments</div>
                </div>
              </div>
              <div className="px-3 py-2 text-center text-[9px] font-semibold"
                   style={{ background: verdict.bg, color: verdict.color }}>
                GA4: {sessions > 0 ? `${sessions} sessions` : '0 sessions'} · {verdict.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Content insight */}
      {posts.length > 5 && (
        <div className="mt-3.5 px-3 py-2.5 rounded-lg text-[11px] leading-[1.6]"
             style={{ background: '#FFF7ED', borderLeft: `3px solid ${BRAND.amber}`, color: '#92400E' }}>
          <strong>Content Insight:</strong> Of {posts.length} posts, {typeCounts.job_alert ?? 0} are job alerts driving {' '}
          {Math.round(((typeCounts.job_alert ?? 0) / posts.length) * 100)}% of site traffic.
          {(typeCounts.kyc_helpdesk ?? 0) > 0 && ` ${typeCounts.kyc_helpdesk} KYC/helpdesk posts generate high comment counts but zero site sessions.`}
        </div>
      )}
    </div>
  );
}
