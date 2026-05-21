'use client';

import { useState, useRef, useEffect } from 'react';
import { BRAND } from '../command-center/types';

// Channel definitions with hierarchy
const CHANNEL_GROUPS = [
  { group: 'Meta', color: '#4F46E5', channels: [
    { slug: 'meta_organic_fb', label: 'Facebook Organic', icon: 'fb', detail: '98 posts', search: 'facebook organic fb' },
    { slug: 'meta_organic_ig', label: 'Instagram Organic', icon: 'ig', detail: '112 posts', search: 'instagram organic ig' },
    { slug: 'meta_paid', label: 'Meta Paid (FB + IG)', icon: 'M', detail: '39 campaigns', search: 'meta paid ads facebook instagram' },
  ]},
  { group: 'LinkedIn', color: '#0A66C2', channels: [
    { slug: 'linkedin_organic', label: 'LinkedIn Organic', icon: 'in', detail: '59K sessions', search: 'linkedin organic social' },
    { slug: 'linkedin_jobs', label: 'LinkedIn Jobs', icon: 'in', detail: 'job board', search: 'linkedin jobs board' },
  ]},
  { group: 'Google', color: '#2563EB', channels: [
    { slug: 'google_organic', label: 'Google Organic (SEO + GSC)', icon: 'G', detail: '1.29M sessions', search: 'google organic seo gsc search' },
    { slug: 'google_paid', label: 'Google Ads', icon: 'G', detail: 'paid search', search: 'google ads paid ppc', color: '#EA4335' },
  ]},
  { group: 'AI Referral', color: '#DB2777', channels: [
    { slug: 'chatgpt', label: 'ChatGPT', icon: 'AI', detail: '50K sess · 24K conv', search: 'chatgpt openai ai', color: '#10A37F' },
    { slug: 'gemini', label: 'Gemini', icon: 'AI', detail: '17K sessions', search: 'gemini google ai', color: '#4285F4' },
  ]},
  { group: 'Job Boards', color: '#D97706', channels: [
    { slug: 'indeed', label: 'Indeed', icon: 'IN', detail: '17K sessions', search: 'indeed job board', color: '#2164F3' },
    { slug: 'handshake', label: 'Handshake', icon: 'HS', detail: '12K · 60% CVR', search: 'handshake college university', color: '#FF7043' },
    { slug: 'glassdoor', label: 'Glassdoor', icon: 'GD', detail: '', search: 'glassdoor', color: '#0CAA41' },
  ]},
  { group: 'Other', color: '#6B7280', channels: [
    { slug: 'twitter', label: 'Twitter / X', icon: 'X', detail: '64K sessions', search: 'twitter x social', color: '#111' },
    { slug: 'youtube', label: 'YouTube', icon: 'YT', detail: '14.6K sessions', search: 'youtube video', color: '#FF0000' },
    { slug: 'reddit', label: 'Reddit', icon: 'R', detail: 'paid + organic', search: 'reddit', color: '#FF4500' },
    { slug: 'brevo_email', label: 'Brevo Email', icon: 'B', detail: '458K sessions', search: 'brevo email sendinblue', color: '#0B996E' },
  ]},
  { group: 'Independent / Physical', color: '#92400E', channels: [
    { slug: 'recruiter', label: 'Recruiter Direct', icon: 'R', detail: 'per-recruiter UTM', search: 'recruiter direct utm links', color: '#D97706' },
    { slug: 'flyer', label: 'Physical Flyers', icon: 'FL', detail: 'QR tracked', search: 'flyer physical qr print', color: '#8B5CF6' },
    { slug: 'qr_poster', label: 'QR Posters', icon: 'QR', detail: '', search: 'qr poster code', color: '#6366F1' },
    { slug: 'telegram', label: 'Telegram', icon: 'TG', detail: '', search: 'telegram messaging', color: '#229ED9' },
  ]},
];

type Channel = (typeof CHANNEL_GROUPS)[number]['channels'][number];

interface ChannelSearchProps {
  selectedSlug: string;
  onSelect: (slug: string) => void;
}

export function ChannelSearch({ selectedSlug, onSelect }: ChannelSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = getChannelInfo(selectedSlug);

  // Filter groups + channels by query
  const filteredGroups = CHANNEL_GROUPS.map(g => {
    if (query.length === 0) return g;
    const q = query.toLowerCase();
    const matchingChannels = g.channels.filter(ch =>
      ch.label.toLowerCase().includes(q) ||
      ch.search.toLowerCase().includes(q) ||
      g.group.toLowerCase().includes(q)
    );
    return { ...g, channels: matchingChannels };
  }).filter(g => g.channels.length > 0);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative min-w-[280px]">
      {/* Input */}
      <div
        className="flex items-center gap-2 w-full px-3.5 py-2.5 border rounded-[10px] bg-white cursor-text"
        style={{
          borderColor: BRAND.border,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
        onClick={() => setOpen(true)}
      >
        {selected && !open && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-[5px] text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: selected.color ?? selected.groupColor }}
          >
            {selected.icon}
          </span>
        )}
        <input
          type="text"
          placeholder={selected ? selected.label : 'Search channels...'}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full text-[13px] font-medium bg-transparent outline-none appearance-none"
          style={{ color: BRAND.text }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-[44px] left-0 right-0 bg-white border rounded-[10px] max-h-[380px] overflow-y-auto z-50"
          style={{ borderColor: BRAND.border, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
        >
          {filteredGroups.length === 0 && (
            <div className="px-3.5 py-3 text-[12px]" style={{ color: BRAND.text3 }}>
              No channels match &ldquo;{query}&rdquo;
            </div>
          )}

          {filteredGroups.map(group => (
            <div key={group.group}>
              {/* Group header */}
              <div
                className="px-3.5 pt-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: group.color }}
              >
                {group.group}
              </div>

              {/* Channel items */}
              {group.channels.map(ch => {
                const iconColor = (ch as Channel & { color?: string }).color ?? group.color;
                const isSelected = ch.slug === selectedSlug;

                return (
                  <button
                    key={ch.slug}
                    onClick={() => { onSelect(ch.slug); setQuery(''); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F5F3FF] transition-colors ${
                      isSelected ? 'bg-[#F5F3FF]' : ''
                    }`}
                  >
                    {/* Branded icon circle */}
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-[5px] text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: iconColor }}
                    >
                      {ch.icon}
                    </span>

                    {/* Label */}
                    <span className="text-[13px] font-semibold flex-1 text-left" style={{ color: BRAND.text }}>
                      {ch.label}
                    </span>

                    {/* Detail count */}
                    {ch.detail && (
                      <span className="text-[10px] shrink-0" style={{ color: BRAND.text3 }}>
                        {ch.detail}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to get channel info by slug
export function getChannelInfo(slug: string) {
  for (const group of CHANNEL_GROUPS) {
    for (const ch of group.channels) {
      if (ch.slug === slug) {
        return { ...ch, groupColor: group.color, color: (ch as Channel & { color?: string }).color ?? group.color };
      }
    }
  }
  return null;
}

export { CHANNEL_GROUPS };

/** Map a GA4 source/medium pair to the best-matching channel slug. */
export function sourceToChannelSlug(source: string, medium: string): string | null {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  const isPaid = ['cpc', 'paid', 'paidsocial', 'paidmedia', 'paid_media'].includes(m);

  if (s === 'google' && !isPaid) return 'google_organic';
  if (s === 'google' && isPaid) return 'google_paid';
  if (['facebook', 'fb'].some(k => s.includes(k)) && isPaid) return 'meta_paid';
  if (['facebook', 'fb'].some(k => s.includes(k)) && !isPaid) return 'meta_organic_fb';
  if (s === 'meta' && isPaid) return 'meta_paid';
  if (s === 'meta') return 'meta_organic_fb';
  if (['instagram', 'l.instagram.com'].some(k => s.includes(k))) return 'meta_organic_ig';
  if (s === 'ig' && isPaid) return 'meta_paid';
  if (s === 'ig') return 'meta_organic_ig';
  if (s.includes('linkedin') && m === 'job_board') return 'linkedin_jobs';
  if (s.includes('linkedin')) return 'linkedin_organic';
  if (s === 'social') return 'linkedin_organic';
  if (s.includes('chatgpt')) return 'chatgpt';
  if (s.includes('gemini')) return 'gemini';
  if (s.includes('indeed')) return 'indeed';
  if (s.includes('handshake')) return 'handshake';
  if (s.includes('glassdoor')) return 'glassdoor';
  if (['twitter', 't.co', 'x.com'].some(k => s.includes(k))) return 'twitter';
  if (s.includes('youtube')) return 'youtube';
  if (s.includes('reddit')) return 'reddit';
  if (s.includes('brevo') || s.includes('sendinblue') || m === 'email') return 'brevo_email';
  if (s.includes('tiktok')) return 'meta_paid'; // closest match
  return null;
}
