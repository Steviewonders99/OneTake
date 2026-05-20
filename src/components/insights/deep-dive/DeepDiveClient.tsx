'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectWeeklySummary } from '@/lib/types/projects';
import type { DateRange, ProjectWithFunnel } from '../command-center/types';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';
import { ProjectSearch } from '../command-center/ProjectSearch';
import { FunnelWaterfall } from './FunnelWaterfall';
import { CountrySelector } from './CountrySelector';
import { LocaleTable } from './LocaleTable';
import { ChannelAcquisition } from './ChannelAcquisition';
import { SourceAttribution } from './SourceAttribution';
import { PaidMetrics } from './PaidMetrics';
import { WeeklyTrends } from './WeeklyTrends';
import { ProjectBrief } from './ProjectBrief';
import { CampaignTable } from '../channel-intel/CampaignTable';
import { CreativeGallery } from '../channel-intel/CreativeGallery';

interface Props {
  initialProjects: Project[];
}

export function DeepDiveClient({ initialProjects }: Props) {
  // Default to Centaurus or first project with channel data (not alphabetical first)
  const defaultProject = initialProjects.find(p => p.codename === 'centaurus')
    ?? initialProjects.find(p => p.display_name?.toLowerCase().includes('centaurus'))
    ?? initialProjects[0];
  const [selectedId, setSelectedId] = useState<string | null>(defaultProject?.id ?? null);
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [locales, setLocales] = useState<any[]>([]);

  const selected = selectedId ? initialProjects.find(p => p.id === selectedId) : null;

  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const [funnelRes, weeklyRes, channelsRes, localesRes] = await Promise.all([
        fetch(`/api/projects/${selectedId}/ga4-funnel`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/projects/${selectedId}/funnel?view=weekly`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/projects/${selectedId}/channels`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/projects/${selectedId}/locales`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setFunnelData(funnelRes);
      setWeeklyData(weeklyRes);
      setChannels(channelsRes);
      setLocales(localesRes);
    } catch (e) {
      console.error('Failed to load deep dive data', e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Detect funnel path type
  const hasPaidSpend = (weeklyData?.current?.total_spend ?? 0) > 0;

  // Build funnel stages
  const funnelStages = funnelData?.totals ? [
    { label: 'WP Entry', value: funnelData.totals.wp_entry ?? 0, color: '#0348B2' },
    { label: 'Apply Click', value: funnelData.totals.apply_click ?? 0, color: '#2563EB' },
    { label: 'Signup', value: funnelData.totals.signup ?? 0, color: '#4F46E5' },
    { label: 'MFA Setup', value: funnelData.totals.mfa_setup ?? 0, color: '#7C3AED' },
    { label: 'Profile Created', value: funnelData.totals.profile_created ?? 0, color: '#9333EA' },
    { label: 'NDA Signed', value: funnelData.totals.nda_signed ?? 0, color: '#A855F7' },
    { label: 'Certification', value: funnelData.totals.certification ?? 0, color: '#DB2777' },
    { label: 'Browsing Jobs', value: funnelData.totals.browsing_jobs ?? 0, color: '#6366F1' },
    { label: 'Doing Tasks', value: funnelData.totals.doing_tasks ?? 0, color: '#0348B2' },
  ].filter(s => s.value > 0 || s.label === 'WP Entry') : [];

  // Sources from funnel data
  const sources = (funnelData?.by_source ?? []).map((s: any) => ({
    source: s.source ?? '(not set)',
    medium: s.medium ?? '(not set)',
    wp_entry: s.wp_entry ?? 0,
    apply_click: s.apply_click ?? 0,
    nda_signed: s.nda_signed ?? 0,
    doing_tasks: s.doing_tasks ?? 0,
    cost: hasPaidSpend && (s.medium === 'paid' || s.medium === 'paidmedia') ? weeklyData?.weeks?.reduce((sum: number, w: any) => sum + (w.total_spend ?? 0), 0) ?? 0 : 0,
  }));

  // Weekly data for trends
  const weeks = (weeklyData?.weeks ?? []).map((w: any) => ({
    week_start: w.week_start,
    total_spend: w.total_spend ?? 0,
    total_clicks: w.total_clicks ?? 0,
    total_conversions: w.total_conversions ?? 0,
    blended_cpa: w.blended_cpa,
    paid_conversions: w.paid_conversions ?? 0,
    organic_clicks: w.organic_clicks ?? 0,
  }));

  // Paid metrics
  const currentWeek = weeklyData?.current;
  const totalSpend = weeks.reduce((s: number, w: any) => s + w.total_spend, 0);
  const totalConversions = funnelData?.totals?.nda_signed ?? 0;
  const activeWorkers = funnelData?.totals?.doing_tasks ?? 0;
  const totalImpressions = currentWeek?.total_impressions ?? 0;
  const totalClicks = currentWeek?.total_clicks ?? 0;

  // Campaigns (from weekly data channel breakdown — simplified)
  const campaigns = channels.map((ch: any) => ({
    campaignName: ch.external_name ?? ch.external_id ?? 'Unknown',
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    conversions: totalConversions,
    cpa: totalConversions > 0 ? totalSpend / totalConversions : null,
  }));

  // Project display name
  const projectName = selected?.display_name?.split('—')[0]?.trim() ?? selected?.codename ?? 'Select a project';
  const projectDetail = selected?.display_name?.split('—')[1]?.trim() ?? '';

  if (loading && !funnelData) {
    return (
      <div className="p-10" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#f0f0f0] rounded" />
          <div className="h-[400px] bg-[#f0f0f0] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-[24px] tracking-tight" style={{ color: BRAND.text }}>
              <span className="font-extrabold">{projectName}</span>
              {projectDetail && <span className="font-extralight"> — {projectDetail}</span>}
            </h1>
            <div className="text-[12px] mt-0.5" style={{ color: BRAND.text3 }}>
              {(selected?.countries ?? []).length} locales · {channels.length} channels · Since {selected?.wp_published_at?.split('T')[0] ?? '—'}
            </div>
          </div>
          <div className="flex gap-0.5 bg-[#F6F7FB] rounded-lg p-[3px]">
            {([7, 14, 30, 90] as DateRange[]).map(d => (
              <button key={d} onClick={() => setDateRange(d)}
                className={`px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  dateRange === d ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#4B5563]'
                }`}>{d === 90 ? 'All' : `${d}d`}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <div style={{ flex: 1, maxWidth: 320 }}>
            <ProjectSearch projects={initialProjects} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </div>

      {/* Hero metrics strip */}
      {funnelData?.totals && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="relative overflow-hidden rounded-2xl p-5 text-white"
               style={{ background: BRAND.gradDeep, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">WP Entries</div>
            <div className="text-[32px] font-black leading-none">{(funnelData.totals.wp_entry ?? 0).toLocaleString()}</div>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-5 text-white"
               style={{ background: BRAND.gradCool, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">NDA Signed</div>
            <div className="text-[32px] font-black leading-none">{(funnelData.totals.nda_signed ?? 0).toLocaleString()}</div>
            <div className="text-[11px] mt-1 opacity-70">{funnelData.rates?.wp_to_nda ?? 0}% of entries</div>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-5 text-white"
               style={{ background: BRAND.gradWarm, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">Active Workers</div>
            <div className="text-[32px] font-black leading-none">{(funnelData.totals.doing_tasks ?? 0).toLocaleString()}</div>
            <div className="text-[11px] mt-1 opacity-70">{funnelData.rates?.wp_to_tasks ?? 0}% of entries</div>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-5 text-white"
               style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">
              {hasPaidSpend ? 'Cost / Worker' : 'Entry → Worker Rate'}
            </div>
            <div className="text-[32px] font-black leading-none">
              {hasPaidSpend && activeWorkers > 0 ? formatEur(totalSpend / activeWorkers) : `${funnelData.rates?.wp_to_tasks ?? 0}%`}
            </div>
            {hasPaidSpend && <div className="text-[11px] mt-1 opacity-70">{formatEur(totalSpend)} total spend</div>}
          </div>
        </div>
      )}

      {/* Section 1: Channel Acquisition */}
      {sources.length > 0 && (
        <div className="mb-5">
          <ChannelAcquisition sources={sources} />
        </div>
      )}

      {/* Section 2: Funnel Waterfall */}
      {funnelStages.length > 0 && <FunnelWaterfall stages={funnelStages} />}

      {/* Section 3: Source Attribution */}
      {sources.length > 0 && (
        <div className="mb-5">
          <SourceAttribution sources={sources} />
        </div>
      )}

      {/* Section 4: Locale Performance */}
      {locales.length > 0 && (
        <div className="mb-5">
          <CountrySelector locales={locales} selectedLocale={selectedLocale} onSelect={setSelectedLocale} />
          <LocaleTable locales={locales} />
        </div>
      )}

      {/* Section 5: Campaign & Creative (paid only) */}
      {hasPaidSpend && campaigns.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <CampaignTable campaigns={campaigns} />
          <PaidMetrics
            spend={totalSpend}
            impressions={totalImpressions}
            clicks={totalClicks}
            ndaSigned={totalConversions}
            activeWorkers={activeWorkers}
          />
        </div>
      )}

      {/* Section 6: Weekly Trends */}
      {weeks.length > 1 && (
        <div className="mb-5">
          <WeeklyTrends weeks={weeks} />
        </div>
      )}

      {/* Section 7: AI Intelligence Brief */}
      <ProjectBrief
        project={{ ...selected, channels, weekly: weeklyData?.weeks, wow: weeklyData?.wow } as ProjectWithFunnel}
        funnelTotals={funnelData?.totals ?? {}}
        funnelRates={funnelData?.rates ?? {}}
        sources={sources}
        localeCount={locales.filter((l: any) => l.is_active).length}
      />
    </div>
  );
}
