'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/lib/types/projects';
import type { DateRange, DateRangeValue } from '../command-center/types';
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

interface Props {
  initialProjects: Project[];
}

// Determine which panels to show based on channel type
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

export function ChannelIntelClient({ initialProjects }: Props) {
  const [selectedChannel, setSelectedChannel] = useState('google_organic');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [dateRangeV2, setDateRangeV2] = useState<DateRangeValue>(defaultDateRange(30));
  const [loading, setLoading] = useState(false);

  // Data state — populated from API calls
  const [heroData, setHeroData] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [landingPages, setLandingPages] = useState<any[]>([]);
  const [projectBreakdown, setProjectBreakdown] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [recruiterRows, setRecruiterRows] = useState<any[]>([]);

  const channelType = getChannelType(selectedChannel);
  const channelInfo = getChannelInfo(selectedChannel);

  // Placeholder data loading — in production, these would be real API calls
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // For now, use sample data from the GA4 queries we've already run
      // In production, each channel type would fetch from different endpoints:
      // - /api/channel-intel/ga4?channel=google_organic
      // - /api/channel-intel/gsc?project=centaurus
      // - /api/channel-intel/posts?platform=instagram
      // - /api/channel-intel/campaigns?platform=meta
      // - /api/channel-intel/recruiter?project=centaurus

      // Sample hero data varies by channel type
      if (channelType === 'seo') {
        setHeroData({ sessions: 1293669, users: 334552, conversions: 152680, convRate: 11.8, cost: 0, isPaid: false, landingPages: 1410 });
        setKeywords([
          { query: 'oneforma', clicks: 89421, impressions: 1200000, ctr: 7.4, position: 1.2 },
          { query: 'oneforma login', clicks: 42103, impressions: 156000, ctr: 27.0, position: 1.0 },
          { query: 'oneforma jobs', clicks: 18290, impressions: 89000, ctr: 20.5, position: 1.8 },
          { query: 'ai annotation jobs remote', clicks: 3421, impressions: 42000, ctr: 8.1, position: 4.2 },
          { query: 'data labeling jobs', clicks: 2890, impressions: 38000, ctr: 7.6, position: 6.1 },
          { query: 'oneforma review', clicks: 1842, impressions: 24000, ctr: 7.7, position: 2.4 },
          { query: 'is oneforma legit', clicks: 1201, impressions: 15000, ctr: 8.0, position: 3.1 },
        ]);
        setLandingPages([
          { pagePath: '/', displayName: 'Homepage', sessions: 264601, conversions: 101183, convRate: 38.2 },
          { pagePath: '/jobs', displayName: 'All Job Listings', sessions: 35946, conversions: 12127, convRate: 33.7 },
          { pagePath: '/center/signup', displayName: 'Account Signup', sessions: 17846, conversions: 6968, convRate: 39.1 },
          { pagePath: '/crowd/nda', displayName: 'NDA Agreement', sessions: 9725, conversions: 2943, convRate: 30.3 },
          { pagePath: '/webapp/dataCollection/login', displayName: 'Data Collection Login', sessions: 18042, conversions: 2402, convRate: 13.3 },
        ]);
        setProjectBreakdown([
          { codename: 'All (homepage)', displayName: 'Homepage + login', sessions: 264601, users: 182315, conversions: 101183, convRate: 38.2, topKeyword: 'oneforma' },
          { codename: 'Jobs listing', displayName: 'All job pages', sessions: 35946, users: 25871, conversions: 12127, convRate: 33.7, topKeyword: 'oneforma jobs' },
        ]);
      } else if (channelType === 'social_ig') {
        setHeroData({ sessions: 616, users: 398, conversions: 24, convRate: 3.9, cost: 0, isPaid: false, landingPages: 15 });
        setPosts([
          { postId: '1', postUrl: 'https://instagram.com/p/DMG4oezivwQ/', postText: '🔈 New job alert! If you\'re experienced with audio annotation and transcription...', postType: 'photo', platform: 'instagram', publishedAt: '2025-07-15', engagement: 183, likes: 56, comments: 127, shares: 0, saves: 0, ga4Sessions: 50, ga4Conversions: 0 },
          { postId: '2', postUrl: 'https://instagram.com/p/DWi-I4UCk_f/', postText: 'Stay safe online 🚨 Registration and project applications on OneForma are 100% Free...', postType: 'photo', platform: 'instagram', publishedAt: '2026-03-31', engagement: 112, likes: 35, comments: 77, shares: 0, saves: 0, ga4Sessions: 0, ga4Conversions: 0 },
          { postId: '3', postUrl: 'https://instagram.com/reel/DTvGfBAAfxa/', postText: 'You may have noticed a new layer of security in your account: Persona! In our effort...', postType: 'video', platform: 'instagram', publishedAt: '2026-01-20', engagement: 106, likes: 31, comments: 75, shares: 0, saves: 0, ga4Sessions: 0, ga4Conversions: 0 },
          { postId: '4', postUrl: 'https://instagram.com/p/DJoorAMRg_Q/', postText: 'Have you signed up for Project Lighthouse 2.0 yet? Lighthouse 2.0 is an Annotation...', postType: 'photo', platform: 'instagram', publishedAt: '2025-05-14', engagement: 143, likes: 34, comments: 109, shares: 0, saves: 0, ga4Sessions: 37, ga4Conversions: 0 },
          { postId: '5', postUrl: 'https://instagram.com/p/DWG24slCriy/', postText: 'On behalf of OneForma, we would like to wish a Happy Eid to all our Muslim friends...', postType: 'photo', platform: 'instagram', publishedAt: '2026-03-20', engagement: 81, likes: 50, comments: 31, shares: 0, saves: 0, ga4Sessions: 0, ga4Conversions: 0 },
          { postId: '6', postUrl: 'https://instagram.com/p/DUTGZhEjwh8/', postText: 'With 2026 kicking off extraordinarily and all the projects that we currently have...', postType: 'carousel', platform: 'instagram', publishedAt: '2026-02-03', engagement: 118, likes: 30, comments: 88, shares: 0, saves: 0, ga4Sessions: 0, ga4Conversions: 0 },
        ]);
      } else if (channelType === 'paid') {
        setHeroData({ sessions: 370994, users: 300000, conversions: 26593, convRate: 7.2, cost: 60000, isPaid: true, impressions: 75000000, clicks: 370994, cpa: 2.26 });
        setCampaigns([
          { campaignName: 'Hummus Traffic Campaign', spend: 21591.93, impressions: 3984108, clicks: 80034, conversions: 1, cpa: 21591.93 },
          { campaignName: 'Milky Way Traffic Campaign', spend: 14561.75, impressions: 19929215, clicks: 238770, conversions: 200, cpa: 72.81 },
          { campaignName: 'Lumina Campaign', spend: 7382.63, impressions: 1373678, clicks: 22590, conversions: 1, cpa: 7382.63 },
          { campaignName: 'Centaurus Conversions Campaign', spend: 5940.91, impressions: 1262336, clicks: 27539, conversions: 795, cpa: 7.47 },
          { campaignName: 'Jellyfish Conversions Campaign', spend: 3370.05, impressions: 361460, clicks: 5874, conversions: 14, cpa: 240.72 },
          { campaignName: 'Andromeda Campaign', spend: 2962.23, impressions: 1051726, clicks: 16478, conversions: 5, cpa: 592.45 },
          { campaignName: 'Fred Conversions Campaign', spend: 355.10, impressions: 110760, clicks: 3932, conversions: 94, cpa: 3.78 },
          { campaignName: 'Fur Frame Campaign', spend: 528.16, impressions: 26068, clicks: 1558, conversions: 1, cpa: 528.16 },
        ]);
        setCreatives([
          { creativeId: '1', campaignName: 'Centaurus', region: 'US', spend: 2100, impressions: 8200, clicks: 342, conversions: 81, cpa: 4.20 },
          { creativeId: '2', campaignName: 'Centaurus', region: 'DE', spend: 1800, impressions: 5100, clicks: 201, conversions: 33, cpa: 6.10 },
          { creativeId: '3', campaignName: 'Centaurus', region: 'PH', spend: 1200, impressions: 12000, clicks: 890, conversions: 167, cpa: 1.80 },
          { creativeId: '4', campaignName: 'Centaurus', region: 'EG', spend: 840, impressions: 4200, clicks: 310, conversions: 42, cpa: 3.20 },
        ]);
      } else if (channelType === 'ai_referral') {
        setHeroData({ sessions: 49952, users: 19607, conversions: 24089, convRate: 48.2, cost: 0, isPaid: false, landingPages: 50 });
        setLandingPages([
          { pagePath: '/', displayName: 'Homepage', sessions: 18200, conversions: 9800, convRate: 53.8 },
          { pagePath: '/center/signup', displayName: 'Account Signup', sessions: 8400, conversions: 5200, convRate: 61.9 },
          { pagePath: '/jobs', displayName: 'All Job Listings', sessions: 5100, conversions: 3400, convRate: 66.7 },
          { pagePath: '/crowd/nda', displayName: 'NDA Agreement', sessions: 2800, conversions: 1900, convRate: 67.9 },
        ]);
      } else if (channelType === 'social_organic') {
        setHeroData({ sessions: 59255, users: 22815, conversions: 5320, convRate: 9.0, cost: 0, isPaid: false, landingPages: 200 });
        setLandingPages([
          { pagePath: '/jobs/internet-judging-milky-way-maps-evaluation', displayName: 'Milky Way Job Page', sessions: 12660, conversions: 2748, convRate: 21.7 },
          { pagePath: '/center/login', displayName: 'Login Page', sessions: 7625, conversions: 244, convRate: 3.2 },
          { pagePath: '/jobs/acceptability-and-preference-translation-raters', displayName: 'Job Page: Acceptability & Preference', sessions: 1367, conversions: 916, convRate: 67.0 },
          { pagePath: '/jobs/nexa', displayName: 'Job Page: Nexa', sessions: 1352, conversions: 27, convRate: 2.0 },
        ]);
      } else if (channelType === 'recruiter') {
        setHeroData({ sessions: 2000, users: 800, conversions: 200, convRate: 10.0, cost: 0, isPaid: false });
        setRecruiterRows([
          { recruiterId: 'recruiter04', source: 'linkedin_inmail', platform: 'LinkedIn', wpVisits: 342, applyClicks: 189, signups: 47, ndaSigned: 31, cvr: 9.1 },
          { recruiterId: 'recruiter02', source: 'handshake', platform: 'Handshake', wpVisits: 891, applyClicks: 412, signups: 201, ndaSigned: 89, cvr: 10.0 },
          { recruiterId: 'recruiter07', source: 'flyer_manila', platform: 'Flyer (QR)', wpVisits: 156, applyClicks: 78, signups: 14, ndaSigned: 8, cvr: 5.1 },
          { recruiterId: 'recruiter01', source: 'college', platform: 'Email', wpVisits: 23, applyClicks: 8, signups: 0, ndaSigned: 0, cvr: 0 },
        ]);
      } else {
        setHeroData({ sessions: 1000, users: 500, conversions: 50, convRate: 5.0, cost: 0, isPaid: false });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedChannel, selectedProject, dateRange, channelType]);

  useEffect(() => { loadData(); }, [loadData]);

  const allCountries = Array.from(new Set(initialProjects.flatMap(p => p.countries ?? []))).sort();

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
        <div className="text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: BRAND.text3 }}>Dashboard 3</div>
        <h1 className="text-[28px] tracking-tight" style={{ color: BRAND.text }}>
          <span className="font-extrabold">Channel</span>
          <span className="font-extralight"> Intelligence</span>
        </h1>
        <div className="text-xs mt-1" style={{ color: BRAND.text3 }}>
          {channelInfo?.label ?? selectedChannel} · {selectedProject ? 'Filtered by project' : 'All Projects'} · Last {dateRange} days
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

      {/* Adaptive panels based on channel type */}

      {/* SEO: GSC Keywords + Landing Pages side by side */}
      {channelType === 'seo' && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <GSCKeywordsPanel keywords={keywords} />
          <LandingPagesPanel pages={landingPages} />
        </div>
      )}

      {/* Social organic (LinkedIn, Twitter, YouTube): Landing Pages full width */}
      {channelType === 'social_organic' && landingPages.length > 0 && (
        <div className="mb-4">
          <LandingPagesPanel pages={landingPages} />
        </div>
      )}

      {/* AI Referral: Landing Pages full width */}
      {channelType === 'ai_referral' && landingPages.length > 0 && (
        <div className="mb-4">
          <LandingPagesPanel pages={landingPages} />
        </div>
      )}

      {/* Instagram: Post Performance Grid */}
      {channelType === 'social_ig' && posts.length > 0 && (
        <div className="mb-4">
          <PostPerformanceGrid posts={posts} />
        </div>
      )}

      {/* Paid: Campaign Table + Creative Gallery */}
      {channelType === 'paid' && (
        <>
          {campaigns.length > 0 && <div className="mb-4"><CampaignTable campaigns={campaigns} /></div>}
          {creatives.length > 0 && <div className="mb-4"><CreativeGallery creatives={creatives} /></div>}
        </>
      )}

      {/* Recruiter: Recruiter Table */}
      {channelType === 'recruiter' && recruiterRows.length > 0 && (
        <div className="mb-4">
          <RecruiterTable rows={recruiterRows} />
        </div>
      )}

      {/* Project Breakdown (all channel types except recruiter) */}
      {channelType !== 'recruiter' && projectBreakdown.length > 0 && (
        <div className="mb-4">
          <ProjectBreakdown projects={projectBreakdown} channelLabel={channelInfo?.label ?? selectedChannel} />
        </div>
      )}
    </div>
  );
}
