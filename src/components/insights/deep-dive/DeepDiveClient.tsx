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
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [dateRangeV2, setDateRangeV2] = useState<DateRangeValue>(defaultDateRange(30));
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [locales, setLocales] = useState<any[]>([]);
  const [countryPerf, setCountryPerf] = useState<any[]>([]);

  const selected = selectedId ? initialProjects.find(p => p.id === selectedId) : null;

  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const [funnelRes, weeklyRes, channelsRes, localesRes, countryRes] = await Promise.all([
        fetch(`/api/projects/${selectedId}/ga4-funnel?start=${dateRangeV2.start}&end=${dateRangeV2.end}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/projects/${selectedId}/funnel?view=weekly`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/projects/${selectedId}/channels`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/projects/${selectedId}/locales`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/projects/${selectedId}/countries`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setFunnelData(funnelRes);
      setWeeklyData(weeklyRes);
      setChannels(channelsRes);
      setLocales(localesRes);
      setCountryPerf(countryRes);
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

  // Range-filtered metrics from weekly summary
  const rangeConv = weeks.reduce((s: number, w: any) => s + (w.total_conversions ?? 0), 0);
  const rangeClicksTotal = weeks.reduce((s: number, w: any) => s + (w.total_clicks ?? 0), 0);
  const rangeSpend = weeks.reduce((s: number, w: any) => s + (w.total_spend ?? 0), 0);
  const rangeImpressions = weeks.reduce((s: number, w: any) => s + ((w as any).total_impressions ?? 0), 0);
  const ft = funnelData?.totals ?? {};
  const funnelViews = rangeClicksTotal > 0 ? rangeClicksTotal : (ft.wp_entry ?? 0);
  const funnelApply = ft.apply_click ?? 0;
  const funnelConv = rangeConv > 0 ? rangeConv : (ft.nda_signed ?? 0);
  const funnelSignup = ft.signup ?? 0;

  const funnelStages = (funnelViews > 0 || funnelConv > 0) ? (isAidaForm ? [
    { label: 'LP Page Views', value: funnelViews, color: '#0348B2' },
    { label: 'Apply Clicks', value: funnelApply, color: '#2563EB' },
    { label: 'Form Completed', value: funnelConv, color: '#DB2777' },
  ] : [
    { label: 'Job Page Views', value: funnelViews, color: '#0348B2' },
    { label: 'Apply Clicks', value: funnelApply, color: '#2563EB' },
    ...(funnelSignup > 0 ? [{ label: 'Signups', value: funnelSignup, color: '#4F46E5' }] : []),
    { label: 'NDA / MFA Completed', value: funnelConv, color: '#7C3AED' },
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
    cost: rangeSpend > 0 && (s.medium === 'paid' || s.medium === 'paidmedia') ? rangeSpend : 0,
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

  // Campaigns (from channel links — uses range-filtered metrics)
  const campaigns = channels.map((ch: any) => ({
    campaignName: ch.external_name ?? ch.external_id ?? 'Unknown',
    spend: rangeSpend,
    impressions: rangeImpressions,
    clicks: rangeClicksTotal,
    conversions: rangeConv,
    cpa: rangeConv > 0 ? rangeSpend / rangeConv : null,
  }));

  // Project display name
  const projectName = selected?.display_name?.split('—')[0]?.trim() ?? selected?.codename ?? 'Select a project';
  const projectDetail = selected?.display_name?.split('—')[1]?.trim() ?? '';

  // Empty state or not yet mounted
  if (!selectedId) {
    if (!mounted) {
      return <div className="p-8 max-w-[1600px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif", minHeight: '70vh' }} />;
    }
    return (
      <div className="p-8 max-w-[1600px] mx-auto flex flex-col items-center justify-center"
           style={{ fontFamily: "'Roboto', system-ui, sans-serif", minHeight: '70vh' }}>
        <div className="text-center mb-10">
          <h1 className="text-[48px] tracking-tight mb-3 leading-tight" style={{ color: BRAND.text }}>
            <span className="font-extralight">Project</span>{' '}
            <span className="font-extrabold">Deep Dive</span>
          </h1>
          <div className="text-[16px]" style={{ color: BRAND.text3 }}>
            Select a project to explore its full acquisition funnel
          </div>
        </div>
        <div className="w-full max-w-[520px] mb-10">
          <ProjectSearch projects={initialProjects} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="flex gap-8 mb-8">
          {['Funnel Analysis', 'Source Attribution', 'Locale Performance', 'Weekly Trends'].map(label => (
            <div key={label} className="flex items-center gap-2 text-[12px] font-medium" style={{ color: BRAND.text3 }}>
              <div className="w-2 h-2 rounded-full" style={{ background: BRAND.purple, opacity: 0.3 }} />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <DateRangePicker value={dateRangeV2} onChange={setDateRangeV2} showCompare={false} />
        </div>
      </div>
    );
  }

  if (loading && !funnelData) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div className="mb-6 flex justify-between items-center">
          <div style={{ maxWidth: 320 }}>
            <ProjectSearch projects={initialProjects} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <DateRangePicker value={dateRangeV2} onChange={setDateRangeV2} />
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#f0f0f0] rounded" />
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[#f0f0f0] rounded-2xl" />)}
          </div>
          <div className="h-[300px] bg-[#f0f0f0] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
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

      {/* Hero metrics strip — uses range-filtered weekly data for spend/conversions */}
      {(funnelData?.totals || weeks.length > 0) && (() => {
        // Range-filtered metrics from weekly summary
        const rangeClicks = weeks.reduce((s: number, w: any) => s + (w.total_clicks ?? 0), 0);
        const rangeConversions = weeks.reduce((s: number, w: any) => s + (w.total_conversions ?? 0), 0);
        const rangeSpend = weeks.reduce((s: number, w: any) => s + (w.total_spend ?? 0), 0);

        // Use range data if available, fall back to all-time GA4 funnel
        const t = funnelData?.totals ?? {};
        const wpEntry = rangeClicks > 0 ? rangeClicks : (t.wp_entry ?? 0);
        const applyClicks = t.apply_click ?? 0;
        const applications = rangeConversions > 0 ? rangeConversions : (t.nda_signed ?? 0);
        const clickRate = wpEntry > 0 ? ((applyClicks / wpEntry) * 100).toFixed(1) : '0';
        const convRate = wpEntry > 0 ? ((applications / wpEntry) * 100).toFixed(1) : '0';
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
                {rangeSpend > 0 ? (isAidaForm ? 'Cost / Form' : 'Cost / NDA') : 'Page → Conversion Rate'}
              </div>
              <div className="text-[32px] font-black leading-none">
                {rangeSpend > 0 && applications > 0 ? formatEur(rangeSpend / applications) : `${wpEntry > 0 ? ((applications / wpEntry) * 100).toFixed(1) : 0}%`}
              </div>
              {rangeSpend > 0 && <div className="text-[11px] mt-1 opacity-70">{formatEur(rangeSpend)} total spend</div>}
            </div>
          </div>
        );
      })()}

      {/* Section 1: Channel Acquisition — all-time first-touch attribution */}
      {sources.length > 0 && (
        <div className="mb-5">
          <ChannelAcquisition sources={sources} dateLabel={dateRangeV2.preset ? (dateRangeV2.preset === 'all' ? 'All Time' : `Last ${dateRangeV2.preset} Days`) : 'Custom Range'} />
        </div>
      )}

      {/* Section 2: Funnel Waterfall — uses range-filtered data */}
      {funnelStages.length > 0 && <FunnelWaterfall stages={funnelStages} />}

      {/* Section 3: Source Attribution — all-time first-touch */}
      {sources.length > 0 && (
        <div className="mb-5">
          <SourceAttribution sources={sources} />
        </div>
      )}

      {/* Section 4: Country Performance */}
      {countryPerf.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
             style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex items-center justify-center font-bold text-white text-[10px]"
                 style={{ width: 20, height: 20, borderRadius: 5, background: BRAND.amber }}>4</div>
            <div>
              <div className="text-sm font-bold" style={{ color: BRAND.text }}>
                Country Performance — {countryPerf.length} countries
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>
                GA4 first-touch attribution by country
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-black/[0.06]">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: BRAND.bgRaised }}>
                  {['Country', 'Page Views', 'Apply Clicks', 'Applications', 'Click Rate', 'Conv Rate'].map(h => (
                    <th key={h} className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2.5"
                        style={{ color: BRAND.text3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {countryPerf.map((row: any, i: number) => {
                  const clickRate = row.page_views > 0 ? (row.apply_clicks / row.page_views * 100) : 0;
                  const convRate = row.apply_clicks > 0 ? (row.applications / row.apply_clicks * 100) : 0;
                  return (
                    <tr key={row.country} className="border-t border-black/[0.04]"
                        style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                      <td className="px-3 py-2.5 text-[12px] font-medium" style={{ color: BRAND.text }}>
                        {row.country}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                        {row.page_views.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                        {row.apply_clicks.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: BRAND.text }}>
                        {row.applications.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                              style={{ color: clickRate > 20 ? BRAND.purple : BRAND.text2,
                                       background: clickRate > 20 ? '#F5F3FF' : 'transparent' }}>
                          {clickRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {convRate > 0 ? (
                          <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                                style={{ color: convRate > 5 ? BRAND.blue : BRAND.text2,
                                         background: convRate > 5 ? '#EFF6FF' : 'transparent' }}>
                            {convRate.toFixed(1)}%
                          </span>
                        ) : <span className="text-[10px]" style={{ color: BRAND.text3 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: Campaign & Creative (paid only) — range-filtered spend */}
      {rangeSpend > 0 && campaigns.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <CampaignTable campaigns={campaigns} />
          <PaidMetrics
            spend={rangeSpend}
            impressions={rangeImpressions}
            clicks={rangeClicksTotal}
            ndaSigned={rangeConv}
            activeWorkers={0}
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
