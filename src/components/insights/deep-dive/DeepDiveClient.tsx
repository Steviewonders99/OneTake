'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectWeeklySummary } from '@/lib/types/projects';
import type { DateRange, DateRangeValue, ProjectWithFunnel } from '../command-center/types';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';
import { ProjectSearch } from '../command-center/ProjectSearch';
import { DateRangePicker, defaultDateRange } from '../DateRangePicker';
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
  const [dateRangeV2, setDateRangeV2] = useState<DateRangeValue>(defaultDateRange(30));
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
  }, [selectedId, dateRangeV2]);

  useEffect(() => { loadData(); }, [loadData]);

  // Weekly data filtered by selected date range
  const weeks = (weeklyData?.weeks ?? [])
    .filter((w: any) => w.week_start >= dateRangeV2.start && w.week_start <= dateRangeV2.end)
    .map((w: any) => ({
      week_start: w.week_start,
      total_spend: w.total_spend ?? 0,
      total_clicks: w.total_clicks ?? 0,
      total_conversions: w.total_conversions ?? 0,
      blended_cpa: w.blended_cpa,
      paid_conversions: w.paid_conversions ?? 0,
      organic_clicks: w.organic_clicks ?? 0,
    }));

  // Detect funnel path type
  const totalWeeklySpend = weeks.reduce((s: number, w: any) => s + w.total_spend, 0);
  const hasPaidSpend = totalWeeklySpend > 0;
  const isAidaForm = (selected as any)?.funnel_type === 'aidaform';

  // Build adaptive funnel — different stages for AidaForm vs Platform projects
  const funnelStages = funnelData?.totals ? (isAidaForm ? [
    { label: 'LP Page Views', value: funnelData.totals.wp_entry ?? 0, color: '#0348B2' },
    { label: 'Apply Clicks', value: funnelData.totals.apply_click ?? 0, color: '#2563EB' },
    { label: 'Form Completed', value: funnelData.totals.nda_signed ?? 0, color: '#DB2777' },
  ] : [
    { label: 'Job Page Views', value: funnelData.totals.wp_entry ?? 0, color: '#0348B2' },
    { label: 'Apply Clicks', value: funnelData.totals.apply_click ?? 0, color: '#2563EB' },
    ...(funnelData.totals.signup > 0 ? [{ label: 'Signups', value: funnelData.totals.signup, color: '#4F46E5' }] : []),
    { label: 'NDA / MFA Completed', value: funnelData.totals.nda_signed ?? 0, color: '#7C3AED' },
  ]).filter(s => s.value > 0 || s.label.includes('Page Views')) : [];

  // Sources from funnel data — expand generic buckets (social, job_board) with UTM detail
  const rawSources = (funnelData?.by_source ?? []).map((s: any) => ({
    source: s.source ?? '(not set)',
    medium: s.medium ?? '(not set)',
    utm_content: s.utm_content ?? null,
    utm_term: s.utm_term ?? null,
    wp_entry: s.wp_entry ?? 0,
    apply_click: s.apply_click ?? 0,
    nda_signed: s.nda_signed ?? 0,
    doing_tasks: s.doing_tasks ?? 0,
    cost: hasPaidSpend && (s.medium === 'paid' || s.medium === 'paidmedia') ? weeklyData?.weeks?.reduce((sum: number, w: any) => sum + (w.total_spend ?? 0), 0) ?? 0 : 0,
  }));

  // Replace generic "social/referral" and "job_board/referral" with UTM detail rows
  const utmDetail = (funnelData?.utm_detail ?? []) as any[];
  const expandable = new Set(['social', 'job_board']);
  const sources = rawSources.flatMap((s: any) => {
    if (!expandable.has(s.source) || utmDetail.length === 0) return [s];
    // Find UTM detail rows for this source
    const details = utmDetail.filter((d: any) => d.source === s.source && d.medium === s.medium);
    if (details.length === 0) return [s];
    // Replace the generic row with specific detail rows
    return details.map((d: any) => ({
      ...s,
      source: d.utm_content || s.source,
      medium: d.utm_term ? `${s.medium} (${d.utm_term})` : s.medium,
      utm_content: d.utm_content,
      utm_term: d.utm_term,
      wp_entry: d.wp_entry ?? 0,
      nda_signed: d.nda_signed ?? 0,
    }));
  });

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
              {isAidaForm ? 'AidaForm funnel' : 'Platform funnel'} · {(selected?.countries ?? []).length} countries · {channels.length} channels · Since {selected?.wp_published_at?.split('T')[0] ?? '—'}
            </div>
          </div>
          <DateRangePicker value={dateRangeV2} onChange={setDateRangeV2} />
        </div>
        <div className="flex gap-3 items-center">
          <div style={{ flex: 1, maxWidth: 320 }}>
            <ProjectSearch projects={initialProjects} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </div>

      {/* Hero metrics strip */}
      {funnelData?.totals && (() => {
        const t = funnelData.totals;
        const wpEntry = t.wp_entry ?? 0;
        const applyClicks = t.apply_click ?? 0;
        const applications = t.nda_signed ?? 0;
        const clickRate = wpEntry > 0 ? ((applyClicks / wpEntry) * 100).toFixed(1) : '0';
        const convRate = applyClicks > 0 ? ((applications / applyClicks) * 100).toFixed(1) : '0';
        return (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="relative overflow-hidden rounded-2xl p-5 text-white"
                 style={{ background: BRAND.gradDeep, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">{isAidaForm ? 'LP Page Views' : 'Job Page Views'}</div>
              <div className="text-[32px] font-black leading-none">{wpEntry.toLocaleString()}</div>
              <div className="text-[11px] mt-1 opacity-70">Unique visitors (first-touch)</div>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 text-white"
                 style={{ background: BRAND.gradCool, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">Apply Clicks</div>
              <div className="text-[32px] font-black leading-none">{applyClicks.toLocaleString()}</div>
              <div className="text-[11px] mt-1 opacity-70">{clickRate}% click-through rate</div>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 text-white"
                 style={{ background: BRAND.gradWarm, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">
                {isAidaForm ? 'Forms Completed' : 'NDA / MFA Completed'}
              </div>
              <div className="text-[32px] font-black leading-none">{applications.toLocaleString()}</div>
              <div className="text-[11px] mt-1 opacity-70">{convRate}% conversion rate</div>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 text-white"
                 style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <div className="text-[9px] uppercase tracking-[0.14em] opacity-60 mb-1">
                {hasPaidSpend ? (isAidaForm ? 'Cost / Form' : 'Cost / NDA') : 'Page → Conversion Rate'}
              </div>
              <div className="text-[32px] font-black leading-none">
                {hasPaidSpend && applications > 0 ? formatEur(totalWeeklySpend / applications) : `${wpEntry > 0 ? ((applications / wpEntry) * 100).toFixed(1) : 0}%`}
              </div>
              {hasPaidSpend && <div className="text-[11px] mt-1 opacity-70">{formatEur(totalWeeklySpend)} total spend</div>}
            </div>
          </div>
        );
      })()}

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
        project={{ ...selected, channels, weekly: weeks, wow: weeklyData?.wow } as ProjectWithFunnel}
        funnelTotals={funnelData?.totals ?? {}}
        funnelRates={funnelData?.rates ?? {}}
        sources={sources}
        localeCount={locales.filter((l: any) => l.is_active).length}
      />
    </div>
  );
}
