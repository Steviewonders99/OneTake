'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Project } from '@/lib/types/projects';
import type { DateRangeValue } from '../command-center/types';
import { BRAND } from '../command-center/types';
import { ProjectSearch } from '../command-center/ProjectSearch';
import { DateRangePicker, defaultDateRange } from '../DateRangePicker';
import { ChannelSearch, getChannelInfo } from './ChannelSearch';
import { ChannelHeroMetrics } from './ChannelHeroMetrics';
import { GSCKeywordsPanel } from './GSCKeywordsPanel';
import { LandingPagesPanel } from './LandingPagesPanel';
import { ProjectBreakdown } from './ProjectBreakdown';
import { PostPerformanceGrid } from './PostPerformanceGrid';
import { CreativeGallery } from './CreativeGallery';
import { CampaignTable } from './CampaignTable';
import { RecruiterTable } from './RecruiterTable';
import { getChannelMeta } from '../channelIcons';

interface Props {
  initialProjects: Project[];
}

/* ─── Per-slug GA4 source matching ─────────────────────────────────── */

// Paid mediums to exclude from organic matchers
const PAID_MEDIUMS = ['cpc', 'paid', 'paidsocial', 'paidmedia', 'paid_media', 'paid_meida'];

const SLUG_SOURCE_MATCH: Record<string, (s: string, m: string) => boolean> = {
  google_organic:  (s, m) => s.toLowerCase() === 'google' && ['organic', '(none)'].includes(m.toLowerCase()),
  // FB organic: source contains facebook/fb, OR source=meta with social/referral/(not set) medium
  meta_organic_fb: (s, m) => {
    const sl = s.toLowerCase(), ml = m.toLowerCase();
    if (['facebook', 'fb'].some(k => sl.includes(k)) && !PAID_MEDIUMS.includes(ml)) return true;
    if (sl === 'meta' && !PAID_MEDIUMS.includes(ml)) return true;
    return false;
  },
  // IG organic: source contains instagram/l.instagram.com, OR source=ig with non-paid medium
  meta_organic_ig: (s, m) => {
    const sl = s.toLowerCase(), ml = m.toLowerCase();
    if (['instagram', 'l.instagram.com'].some(k => sl.includes(k))) return true;
    if (sl === 'ig' && !PAID_MEDIUMS.includes(ml)) return true;
    return false;
  },
  linkedin_organic:(s, m) => {
    const sl = s.toLowerCase(), ml = m.toLowerCase();
    return (sl.includes('linkedin') || sl === 'social') && !['job_board', 'jobboard'].includes(ml) && !PAID_MEDIUMS.includes(ml);
  },
  linkedin_jobs:   (s, m) => {
    const sl = s.toLowerCase(), ml = m.toLowerCase();
    return (sl.includes('linkedin') || ml === 'job_board' || ml === 'jobboard') && ['job_board', 'jobboard', 'referral'].includes(ml);
  },
  chatgpt:         (s, m) => s.toLowerCase().includes('chatgpt'),
  gemini:          (s, m) => s.toLowerCase().includes('gemini'),
  indeed:          (s, m) => s.toLowerCase().includes('indeed'),
  handshake:       (s, m) => s.toLowerCase().includes('handshake'),
  glassdoor:       (s, m) => s.toLowerCase().includes('glassdoor'),
  twitter:         (s, m) => ['twitter', 't.co', 'x.com'].some(k => s.toLowerCase().includes(k)),
  youtube:         (s, m) => s.toLowerCase().includes('youtube'),
  reddit:          (s, m) => s.toLowerCase().includes('reddit') && !PAID_MEDIUMS.includes(m.toLowerCase()),
  brevo_email:     (s, m) => s.toLowerCase().includes('brevo') || s.toLowerCase().includes('sendinblue') || m.toLowerCase() === 'email',
  recruiter:       (s, m) => s.toLowerCase() === 'social' && m.toLowerCase() === 'referral',
  flyer:           (s, m) => s.toLowerCase().includes('flyer') || m.toLowerCase().includes('flyer'),
  qr_poster:       (s, m) => s.toLowerCase().includes('qr'),
  telegram:        (s, m) => s.toLowerCase().includes('telegram'),
};

/* ─── Channel type → panel layout ──────────────────────────────────── */

function getChannelType(slug: string): 'seo' | 'social_organic' | 'social_ig' | 'ai_referral' | 'paid' | 'recruiter' | 'job_board' | 'other' {
  if (slug === 'google_organic') return 'seo';
  if (slug === 'meta_organic_ig') return 'social_ig';
  if (slug === 'meta_organic_fb' || slug === 'linkedin_organic' || slug === 'twitter' || slug === 'youtube') return 'social_organic';
  if (slug === 'chatgpt' || slug === 'gemini') return 'ai_referral';
  if (slug === 'meta_paid' || slug === 'google_paid' || slug === 'reddit') return 'paid';
  if (slug === 'recruiter') return 'recruiter';
  if (slug === 'indeed' || slug === 'handshake' || slug === 'glassdoor' || slug === 'linkedin_jobs') return 'job_board';
  return 'other';
}

/* ─── Main component ───────────────────────────────────────────────── */

export function ChannelIntelClient({ initialProjects }: Props) {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(searchParams.get('channel') || 'google_organic');
  const [selectedProject, setSelectedProject] = useState<string | null>(searchParams.get('project'));
  const [selectedCountry, setSelectedCountry] = useState<string | null>(searchParams.get('country'));
  const [dateRangeV2, setDateRangeV2] = useState<DateRangeValue>(() => {
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (start && end) return { start, end };
    return defaultDateRange(30);
  });
  const [loading, setLoading] = useState(false);

  // Data state
  const [heroData, setHeroData] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [landingPages, setLandingPages] = useState<any[]>([]);
  const [projectBreakdown, setProjectBreakdown] = useState<any[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [recruiterRows, setRecruiterRows] = useState<any[]>([]);

  const channelType = getChannelType(selectedChannel);
  const channelInfo = getChannelInfo(selectedChannel);

  useEffect(() => { setMounted(true); }, []);

  // ── Data loading — triggers on any filter change ──────────────────
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        // 1. Resolve project list (single project or all)
        let projectList: any[] = [];
        if (selectedProject) {
          const p = await fetch(`/api/projects/${selectedProject}`)
            .then(r => r.ok ? r.json() : null).catch(() => null);
          if (p) projectList = [p];
        } else {
          projectList = await fetch('/api/projects')
            .then(r => r.ok ? r.json() : []).catch(() => []);
        }

        // 2. Country filter: narrow projects to those with traffic in this country
        if (selectedCountry && !selectedProject) {
          const countryData = await fetch('/api/countries')
            .then(r => r.ok ? r.json() : []).catch(() => []);
          const entry = countryData.find((c: any) => c.country === selectedCountry);
          if (entry?.project_ids) {
            const allowed = new Set(entry.project_ids);
            projectList = projectList.filter((p: any) => allowed.has(p.id));
          }
        }

        if (cancelled) return;

        const isPaidChannel = channelType === 'paid';
        const batchSize = 10;

        if (isPaidChannel) {
          // ── PAID path: fetch NDM data per project ──────────────────
          const allCamps: any[] = [];
          const projBreak: any[] = [];
          let totalImp = 0, totalClicks = 0, totalSpend = 0, totalConv = 0;

          for (let i = 0; i < projectList.length; i += batchSize) {
            if (cancelled) return;
            const batch = projectList.slice(i, i + batchSize);
            const results = await Promise.all(
              batch.map((p: any) =>
                fetch(`/api/projects/${p.id}/paid?start=${dateRangeV2.start}&end=${dateRangeV2.end}`)
                  .then(r => r.ok ? r.json() : null).catch(() => null)
              )
            );
            for (let j = 0; j < results.length; j++) {
              const res = results[j];
              const proj = batch[j];
              if (!res?.campaigns?.length) continue;

              let pSpend = 0, pConv = 0, pClicks = 0, pImp = 0;
              for (const c of res.campaigns) {
                allCamps.push({
                  campaignName: `${proj.codename} — ${c.campaign}`,
                  spend: c.spend || 0,
                  impressions: c.impressions || 0,
                  clicks: c.clicks || 0,
                  conversions: c.conversions || 0,
                  cpa: c.cpa || null,
                });
                pImp += c.impressions || 0;
                pClicks += c.clicks || 0;
                pSpend += c.spend || 0;
                pConv += c.conversions || 0;
              }
              totalImp += pImp;
              totalClicks += pClicks;
              totalSpend += pSpend;
              totalConv += pConv;

              projBreak.push({
                codename: proj.codename,
                displayName: proj.display_name?.split('—')[0]?.trim() || proj.codename,
                sessions: pClicks, users: pClicks,
                conversions: pConv,
                convRate: pClicks > 0 ? (pConv / pClicks * 100) : 0,
              });
            }
          }

          if (cancelled) return;

          const ctr = totalImp > 0 ? (totalClicks / totalImp * 100) : 0;
          const cpa = totalConv > 0 ? totalSpend / totalConv : 0;

          setHeroData({
            sessions: totalClicks, users: totalClicks, conversions: totalConv,
            convRate: ctr, cost: totalSpend, isPaid: true,
            impressions: totalImp, clicks: totalClicks, cpa,
          });
          setCampaigns(allCamps.sort((a, b) => b.spend - a.spend));
          setProjectBreakdown(projBreak.sort((a, b) => b.conversions - a.conversions));
          setSourceBreakdown([]);

          // ── Meta Paid: fetch adset-level detail from Meta Ads API ───
          if (selectedChannel === 'meta_paid' && !cancelled) {
            const adsRes = await fetch('/api/meta/ads?level=adset&limit=30')
              .then(r => r.ok ? r.json() : []).catch(() => []);
            // Enrich campaigns with adset-level data if available
            if (Array.isArray(adsRes) && adsRes.length > 0) {
              const adsetCamps = adsRes.map((r: any) => ({
                campaignName: r.adset_name
                  ? `${r.campaign_name} → ${r.adset_name}`
                  : r.campaign_name,
                spend: r.spend || 0,
                impressions: r.impressions || 0,
                clicks: r.clicks || 0,
                conversions: r.conversions || 0,
                cpa: r.cpa || null,
              }));
              setCampaigns(adsetCamps.sort((a: any, b: any) => b.spend - a.spend));
            }
          }

        } else {
          // ── ORGANIC path: GA4 funnel with per-slug source matching ─
          const matchFn = SLUG_SOURCE_MATCH[selectedChannel];
          let totalViews = 0, totalApps = 0, totalApplyClicks = 0;
          const projBreak: any[] = [];
          const srcAgg: Record<string, {
            source: string; medium: string;
            wp_entry: number; apply_click: number; nda_signed: number;
          }> = {};

          for (let i = 0; i < projectList.length; i += batchSize) {
            if (cancelled) return;
            const batch = projectList.slice(i, i + batchSize);
            const results = await Promise.all(
              batch.map((p: any) =>
                fetch(`/api/projects/${p.id}/ga4-funnel?start=${dateRangeV2.start}&end=${dateRangeV2.end}`)
                  .then(r => r.ok ? r.json() : null).catch(() => null)
              )
            );
            for (let j = 0; j < results.length; j++) {
              const funnel = results[j];
              const proj = batch[j];
              if (!funnel?.by_source) continue;

              let pViews = 0, pApps = 0;
              for (const src of funnel.by_source) {
                const sName = src.source || '';
                const mName = src.medium || '';
                if (!matchFn || !matchFn(sName, mName)) continue;

                const views = src.wp_entry || 0;
                const apps = src.nda_signed || 0;
                const clicks = src.apply_click || 0;
                pViews += views;
                pApps += apps;
                totalApplyClicks += clicks;

                // Aggregate by source/medium for the source table
                const key = `${sName}|||${mName}`;
                if (!srcAgg[key]) {
                  srcAgg[key] = { source: sName, medium: mName, wp_entry: 0, apply_click: 0, nda_signed: 0 };
                }
                srcAgg[key].wp_entry += views;
                srcAgg[key].apply_click += clicks;
                srcAgg[key].nda_signed += apps;
              }

              if (pViews > 0 || pApps > 0) {
                totalViews += pViews;
                totalApps += pApps;
                projBreak.push({
                  codename: proj.codename,
                  displayName: proj.display_name?.split('—')[0]?.trim() || proj.codename,
                  sessions: pViews, users: pViews,
                  conversions: pApps,
                  convRate: pViews > 0 ? (pApps / pViews * 100) : 0,
                });
              }
            }
          }

          if (cancelled) return;

          const convRate = totalViews > 0 ? (totalApps / totalViews * 100) : 0;
          setHeroData({
            sessions: totalViews, users: totalViews, conversions: totalApps,
            convRate, cost: 0, isPaid: false, landingPages: projBreak.length,
          });
          setProjectBreakdown(projBreak.sort((a, b) => b.sessions - a.sessions));
          setSourceBreakdown(Object.values(srcAgg).sort((a, b) => b.wp_entry - a.wp_entry));
          setCampaigns([]);

          // ── SEO channel: fetch GSC keywords + GA4 landing pages ─────
          if (selectedChannel === 'google_organic' && !cancelled) {
            const [kwRes, pgRes] = await Promise.all([
              fetch(`/api/gsc/keywords?start=${dateRangeV2.start}&end=${dateRangeV2.end}&limit=50`)
                .then(r => r.ok ? r.json() : []).catch(() => []),
              fetch(`/api/ga4/landing-pages?source=google&limit=30`)
                .then(r => r.ok ? r.json() : []).catch(() => []),
            ]);
            setKeywords(kwRes.map((r: any) => ({
              query: r.query,
              clicks: r.clicks || 0,
              impressions: r.impressions || 0,
              ctr: r.ctr || 0,
              position: r.position || 0,
            })));
            setLandingPages(pgRes.map((r: any) => {
              const pagePath = r.page_path || '';
              const displayName = pagePath
                .replace(/^\/jobs\//, '')
                .replace(/^\/join\//, '')
                .replace(/\/$/, '')
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase()) || pagePath;
              return {
                pagePath,
                displayName: displayName || pagePath,
                sessions: r.sessions || 0,
                conversions: r.conversions || 0,
                convRate: r.sessions > 0 ? (r.conversions / r.sessions * 100) : 0,
              };
            }));
          } else {
            setKeywords([]);
            setLandingPages([]);
          }

          // ── Platform posts: fetch from Meta Organic API ─────────────
          if ((selectedChannel === 'meta_organic_ig' || selectedChannel === 'meta_organic_fb') && !cancelled) {
            const platform = selectedChannel === 'meta_organic_ig' ? 'instagram' : 'facebook';
            const postRes = await fetch(`/api/meta/organic-posts?platform=${platform}&limit=30&sort=engagement`)
              .then(r => r.ok ? r.json() : { posts: [], summary: {} }).catch(() => ({ posts: [], summary: {} }));
            const mappedPosts = (postRes.posts || []).map((p: any) => ({
              postId: p.post_id || '',
              postUrl: p.post_url || '',
              postText: p.post_text || '',
              postType: p.post_type || '',
              platform: p.platform || platform,
              publishedAt: p.published_at || '',
              engagement: p.engagement || 0,
              likes: p.likes || 0,
              comments: p.comments || 0,
              shares: p.shares || 0,
              saves: p.saves || 0,
            }));
            setPosts(mappedPosts);

            // Enrich hero with platform summary if available
            const summary = postRes.summary || {};
            if (summary.total_posts) {
              setHeroData((prev: any) => prev ? {
                ...prev,
                sessions: prev.sessions || summary.total_reach || 0,
                landingPages: summary.total_posts,
              } : prev);
            }
          } else {
            setPosts([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [mounted, selectedChannel, selectedProject, selectedCountry, dateRangeV2.start, dateRangeV2.end, channelType]);

  // Countries from GA4 project_country_performance
  const allCountries = Array.from(new Set(initialProjects.flatMap(p => p.countries ?? []))).sort();

  if (!mounted) return null;

  // Loading skeleton
  if (loading && !heroData) {
    return (
      <div className="p-10" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#f0f0f0] rounded" />
          <div className="grid grid-cols-5 gap-2.5">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[#f0f0f0] rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-[300px] bg-[#f0f0f0] rounded-2xl" />
            <div className="h-[300px] bg-[#f0f0f0] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-[28px] tracking-tight" style={{ color: BRAND.text }}>
          <span className="font-extrabold">Channel</span>
          <span className="font-extralight"> Intelligence</span>
        </h1>
        <div className="text-xs mt-1" style={{ color: BRAND.text3 }}>
          {channelInfo?.label ?? selectedChannel}
          {' · '}{selectedProject ? 'Filtered by project' : 'All Projects'}
          {selectedCountry ? ` · ${selectedCountry}` : ''}
        </div>
      </div>

      {/* Three-layer selector */}
      <div className="flex gap-2.5 items-end mb-5">
        <div style={{ flex: 1.2 }}>
          <div className="text-[9px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color: BRAND.text3 }}>Channel</div>
          <ChannelSearch selectedSlug={selectedChannel} onSelect={setSelectedChannel} />
        </div>
        <div style={{ flex: 0.8 }}>
          <div className="text-[9px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color: BRAND.text3 }}>Project</div>
          <ProjectSearch projects={initialProjects} selectedId={selectedProject} onSelect={setSelectedProject} showAllOption />
        </div>
        <div style={{ flex: 0.5 }}>
          <div className="text-[9px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color: BRAND.text3 }}>Country</div>
          <select value={selectedCountry ?? ''}
                  onChange={e => setSelectedCountry(e.target.value || null)}
                  className="w-full px-3 py-2.5 pr-8 border rounded-[10px] text-[13px] font-medium bg-white appearance-none cursor-pointer"
                  style={{ color: BRAND.text, borderColor: BRAND.border, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%239CA3AF" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>')`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            <option value="">All Countries</option>
            {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <DateRangePicker value={dateRangeV2} onChange={setDateRangeV2} />
      </div>

      {/* Loading indicator (overlay while data refreshes) */}
      {loading && heroData && (
        <div className="mb-4 text-[11px] font-medium px-3 py-1.5 rounded-lg inline-block"
             style={{ background: '#F5F3FF', color: BRAND.purple }}>
          Updating...
        </div>
      )}

      {/* Hero Metrics */}
      {heroData && (
        <ChannelHeroMetrics
          sessions={heroData.sessions}
          users={heroData.users}
          conversions={heroData.conversions}
          convRate={heroData.convRate}
          cost={heroData.cost}
          isPaid={heroData.isPaid}
          impressions={heroData.impressions}
          clicks={heroData.clicks}
          cpa={heroData.cpa}
          landingPages={heroData.landingPages}
        />
      )}

      {/* ── Adaptive panels based on channel type ─────────────────── */}

      {/* SEO: GSC Keywords + Landing Pages side by side */}
      {channelType === 'seo' && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <GSCKeywordsPanel keywords={keywords} />
          <LandingPagesPanel pages={landingPages} />
        </div>
      )}

      {/* Paid: Campaign Table */}
      {channelType === 'paid' && (
        <div className="mb-4">
          <CampaignTable campaigns={campaigns} />
        </div>
      )}

      {/* Organic channels: Source-level breakdown */}
      {channelType !== 'paid' && sourceBreakdown.length > 0 && (
        <div className="mb-4">
          <ChannelSourceTable
            sources={sourceBreakdown}
            channelLabel={channelInfo?.label ?? selectedChannel}
          />
        </div>
      )}

      {/* Social organic: Landing Pages */}
      {channelType === 'social_organic' && landingPages.length > 0 && (
        <div className="mb-4">
          <LandingPagesPanel pages={landingPages} />
        </div>
      )}

      {/* AI Referral: Landing Pages */}
      {channelType === 'ai_referral' && landingPages.length > 0 && (
        <div className="mb-4">
          <LandingPagesPanel pages={landingPages} />
        </div>
      )}

      {/* Meta Organic: Post Performance Grid (IG + FB) */}
      {(channelType === 'social_ig' || channelType === 'social_organic') && posts.length > 0 && (
        <div className="mb-4">
          <PostPerformanceGrid posts={posts} />
        </div>
      )}

      {/* Paid: Creative Gallery */}
      {channelType === 'paid' && creatives.length > 0 && (
        <div className="mb-4">
          <CreativeGallery creatives={creatives} />
        </div>
      )}

      {/* Recruiter: Recruiter Table */}
      {channelType === 'recruiter' && recruiterRows.length > 0 && (
        <div className="mb-4">
          <RecruiterTable rows={recruiterRows} />
        </div>
      )}

      {/* Project Breakdown — all channel types */}
      {projectBreakdown.length > 0 && (
        <div className="mb-4">
          <ProjectBreakdown
            projects={projectBreakdown}
            channelLabel={channelInfo?.label ?? selectedChannel}
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && !heroData && (
        <div className="text-center py-16">
          <div className="text-[15px] font-semibold mb-1" style={{ color: BRAND.text2 }}>
            No data available
          </div>
          <div className="text-[12px]" style={{ color: BRAND.text3 }}>
            Select a different channel or adjust filters
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Inline: Source-level breakdown table for organic channels ────── */

interface SourceRow {
  source: string;
  medium: string;
  wp_entry: number;
  apply_click: number;
  nda_signed: number;
}

function ChannelSourceTable({ sources, channelLabel }: { sources: SourceRow[]; channelLabel: string }) {
  const [sortBy, setSortBy] = useState<'source' | 'views' | 'apply' | 'apps' | 'rate'>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const sorted = [...sources].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'source': return dir * a.source.localeCompare(b.source);
      case 'views':  return dir * (a.wp_entry - b.wp_entry);
      case 'apply':  return dir * (a.apply_click - b.apply_click);
      case 'apps':   return dir * (a.nda_signed - b.nda_signed);
      case 'rate': {
        const rA = a.wp_entry > 0 ? a.nda_signed / a.wp_entry : 0;
        const rB = b.wp_entry > 0 ? b.nda_signed / b.wp_entry : 0;
        return dir * (rA - rB);
      }
      default: return 0;
    }
  });

  const totals = sources.reduce(
    (acc, r) => ({
      wp_entry: acc.wp_entry + r.wp_entry,
      apply_click: acc.apply_click + r.apply_click,
      nda_signed: acc.nda_signed + r.nda_signed,
    }),
    { wp_entry: 0, apply_click: 0, nda_signed: 0 },
  );

  const COLS: { label: string; key: typeof sortBy | null }[] = [
    { label: 'Source / Medium', key: 'source' },
    { label: 'Page Views', key: 'views' },
    { label: 'Apply Clicks', key: 'apply' },
    { label: 'Applications', key: 'apps' },
    { label: 'Entry → App', key: 'rate' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: "'Roboto', system-ui, sans-serif" }}>

      <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[10px] font-extrabold text-white"
             style={{ background: BRAND.purple }}>S</div>
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
            Source Breakdown — <span style={{ color: BRAND.purple }}>{channelLabel}</span>
          </h3>
          <span className="text-[10px]" style={{ color: BRAND.text3 }}>
            GA4 first-touch attribution by source / medium
          </span>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BRAND.bgRaised }}>
              {COLS.map(col => (
                <th key={col.label}
                    className={`text-[9px] uppercase tracking-[0.1em] font-semibold px-4 py-2.5 ${col.key ? 'cursor-pointer hover:text-[#4B5563]' : ''}`}
                    style={{ color: sortBy === col.key ? BRAND.purple : BRAND.text3 }}
                    onClick={() => col.key && toggleSort(col.key)}>
                  {col.label}
                  {sortBy === col.key && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const meta = getChannelMeta(row.source);
              const rate = row.wp_entry > 0 ? (row.nda_signed / row.wp_entry * 100) : 0;
              return (
                <tr key={`${row.source}-${row.medium}`}
                    className="border-t border-black/[0.04]"
                    style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span style={{ color: meta.color }} className="shrink-0">{meta.icon}</span>
                      <div>
                        <span className="text-[11px] font-medium" style={{ color: BRAND.text }}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] ml-1" style={{ color: BRAND.text3 }}>
                          / {row.medium}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                    {row.wp_entry.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                    {row.apply_click.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: BRAND.text }}>
                    {row.nda_signed.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                          style={{
                            color: rate > 5 ? BRAND.purple : BRAND.text2,
                            background: rate > 5 ? '#F5F3FF' : 'transparent',
                          }}>
                      {rate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals */}
          <tfoot>
            <tr className="border-t-2 border-black/[0.08]" style={{ background: BRAND.bgRaised }}>
              <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: BRAND.text2 }}>
                All Sources
              </td>
              <td className="px-4 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                {totals.wp_entry.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                {totals.apply_click.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.purple }}>
                {totals.nda_signed.toLocaleString()}
              </td>
              <td className="px-4 py-2.5">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: BRAND.text2 }}>
                  {totals.wp_entry > 0 ? ((totals.nda_signed / totals.wp_entry) * 100).toFixed(1) : '0'}%
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
