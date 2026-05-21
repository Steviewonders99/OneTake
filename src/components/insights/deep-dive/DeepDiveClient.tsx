'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Project, ProjectWeeklySummary } from '@/lib/types/projects';
import type { DateRange, DateRangeValue, ProjectWithFunnel } from '../command-center/types';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';
import { ProjectSearch } from '../command-center/ProjectSearch';
import { DateRangePicker, defaultDateRange } from '../DateRangePicker';
import { FunnelWaterfall } from './FunnelWaterfall';
import { CountryTable } from './CountryTable';
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
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('project'));
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
  const [paidData, setPaidData] = useState<any>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const selected = selectedId ? initialProjects.find(p => p.id === selectedId) : null;

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    const start = dateRangeV2.start;
    const end = dateRangeV2.end;

    Promise.all([
      fetch(`/api/projects/${selectedId}/ga4-funnel?start=${start}&end=${end}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/projects/${selectedId}/funnel?view=weekly`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/projects/${selectedId}/channels`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/projects/${selectedId}/locales`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/projects/${selectedId}/countries`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/projects/${selectedId}/paid?start=${start}&end=${end}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([funnelRes, weeklyRes, channelsRes, localesRes, countryRes, paidRes]) => {
      if (cancelled) return;
      setFunnelData(funnelRes);
      setWeeklyData(weeklyRes);
      setChannels(channelsRes);
      setLocales(localesRes);
      setCountryPerf(countryRes);
      setPaidData(paidRes);
    }).catch(e => {
      console.error('Failed to load deep dive data', e);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, fetchKey]);

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
  // Distribute the parent's applications proportionally by view share
  const utmDetail = (funnelData?.utm_detail ?? []) as any[];
  const expandable = new Set(['social', 'job_board']);
  const sources = rawSources.flatMap((s: any) => {
    if (!expandable.has(s.source) || utmDetail.length === 0) return [s];
    const details = utmDetail.filter((d: any) => d.source === s.source && d.medium === s.medium);
    if (details.length === 0) return [s];
    // Use real direct attribution data from UTM detail rows
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

  // (campaigns removed — replaced with Paid Summary section)

  // Project display name
  const projectName = selected?.display_name?.split('—')[0]?.trim() ?? selected?.codename ?? 'Select a project';
  const projectDetail = selected?.display_name?.split('—')[1]?.trim() ?? '';

  // Empty state or not yet mounted
  if (!selectedId) {
    if (!mounted) {
      return <div className="p-8 w-full" style={{ fontFamily: "'Roboto', system-ui, sans-serif", minHeight: '70vh' }} />;
    }
    return (
      <div className="p-8 w-full flex flex-col items-center justify-center"
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
          <DateRangePicker value={dateRangeV2} onChange={(v: DateRangeValue) => { setDateRangeV2(v); setFetchKey(k => k + 1); }} showCompare={false} />
        </div>
      </div>
    );
  }

  if (loading && !funnelData) {
    return (
      <div className="p-8 w-full" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div className="mb-6 flex justify-between items-center">
          <div style={{ maxWidth: 320 }}>
            <ProjectSearch projects={initialProjects} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <DateRangePicker value={dateRangeV2} onChange={(v: DateRangeValue) => { setDateRangeV2(v); setFetchKey(k => k + 1); }} />
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
    <div className="p-8 w-full" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-[#f7f7f8] pb-4 pt-1 -mx-8 px-8"
           style={{ backdropFilter: 'blur(8px)', background: 'rgba(247,247,248,0.92)' }}>
        <div className="flex justify-between items-center mb-3">
          <div className="min-w-0">
            <h1 className="text-[24px] tracking-tight truncate" style={{ color: BRAND.text }}>
              <span className="font-extrabold">{projectName}</span>
              {projectDetail && <span className="font-extralight"> — {projectDetail}</span>}
            </h1>
            <div className="text-[12px] mt-0.5" style={{ color: BRAND.text3 }}>
              {isAidaForm ? 'AidaForm funnel' : 'Platform funnel'} · {(selected?.countries ?? []).length} countries · {channels.length} channels · Since {selected?.wp_published_at?.split('T')[0] ?? '—'}
            </div>
          </div>
          <DateRangePicker value={dateRangeV2} onChange={(v: DateRangeValue) => { setDateRangeV2(v); setFetchKey(k => k + 1); }} />
        </div>
        <div style={{ maxWidth: 320 }}>
          <ProjectSearch projects={initialProjects} selectedId={selectedId} onSelect={setSelectedId} />
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

      {/* Section 4: Country Performance — show top 5, expand for more */}
      {countryPerf.length > 0 && (() => {
        const [showAllCountries, setShowAllCountries] = [
          countryPerf.length <= 5, () => {}
        ];
        return (
          <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
               style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="mb-5">
              <div className="text-sm font-bold" style={{ color: BRAND.text }}>
                Country Performance — {countryPerf.length} countries
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>
                GA4 first-touch attribution by country
              </div>
            </div>
            <CountryTable countries={countryPerf} />
          </div>
        );
      })()}

      {/* Section 5: Paid Performance (from Meta/Reddit/Google Ads APIs) */}
      {paidData?.totals && paidData.totals.spend > 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
             style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="mb-5">
            <div className="text-sm font-bold" style={{ color: BRAND.text }}>Paid Campaign Performance</div>
            <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>Meta Ads API · Date-filtered</div>
          </div>
          {/* Summary metrics strip */}
          <div className="grid grid-cols-6 gap-3 mb-5">
            {[
              { label: 'Impressions', value: paidData.totals.impressions.toLocaleString() },
              { label: 'Clicks', value: paidData.totals.clicks.toLocaleString() },
              { label: 'Spend', value: formatEur(paidData.totals.spend) },
              { label: 'CPM', value: formatEur(paidData.totals.cpm) },
              { label: 'CPC', value: formatEur(paidData.totals.cpc) },
              { label: 'CTR', value: `${paidData.totals.ctr}%` },
            ].map(m => (
              <div key={m.label} className="bg-[#F6F7FB] rounded-xl px-3 py-3 text-center">
                <div className="text-[18px] font-extrabold" style={{ color: BRAND.text }}>{m.value}</div>
                <div className="text-[8px] uppercase tracking-[0.1em] mt-0.5" style={{ color: BRAND.text3 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {/* Per-campaign table with collapse */}
          {paidData.campaigns?.length > 0 && (() => {
            const camps = paidData.campaigns as any[];
            const showAll = camps.length <= 3;
            const [expanded, setExpanded] = [true, () => {}]; // Always show all for now — campaigns are few
            const visible = camps;
            const t = paidData.totals;
            const platformLabel = (name: string) =>
              name.toLowerCase().includes('reddit') ? 'Reddit' : 'Meta';
            return (
              <div className="overflow-hidden rounded-xl border border-black/[0.06]">
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: BRAND.bgRaised }}>
                      {['Campaign', 'Platform', 'Impressions', 'Clicks', 'Spend', 'CTR', 'CPC', 'CPA'].map(h => (
                        <th key={h} className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2.5"
                            style={{ color: BRAND.text3 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c: any, i: number) => (
                      <tr key={c.campaign} className="border-t border-black/[0.04]"
                          style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                        <td className="px-3 py-2.5 text-[11px] font-medium" style={{ color: BRAND.text }}>
                          {c.campaign}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            platformLabel(c.campaign) === 'Reddit' ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#DBEAFE] text-[#1E40AF]'
                          }`}>{platformLabel(c.campaign)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] tabular-nums">{c.impressions?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-[12px] tabular-nums">{c.clicks?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-[12px] font-semibold tabular-nums">{formatEur(c.spend)}</td>
                        <td className="px-3 py-2.5 text-[11px] tabular-nums">{c.ctr}%</td>
                        <td className="px-3 py-2.5 text-[11px] tabular-nums">{formatEur(c.cpc)}</td>
                        <td className="px-3 py-2.5 text-[11px] font-bold tabular-nums"
                            style={{ color: c.cpa > 0 && c.cpa < 38.5 ? BRAND.blue : c.cpa > 0 ? BRAND.rose : BRAND.text3 }}>
                          {c.cpa > 0 ? formatEur(c.cpa) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {camps.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-black/[0.08]" style={{ background: BRAND.bgRaised }}>
                        <td className="px-3 py-2.5 text-[10px] font-bold uppercase" style={{ color: BRAND.text2 }}>
                          All Campaigns ({camps.length})
                        </td>
                        <td />
                        <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums">{t.impressions?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums">{t.clicks?.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums">{formatEur(t.spend)}</td>
                        <td className="px-3 py-2.5 text-[11px] font-bold tabular-nums">{t.ctr}%</td>
                        <td className="px-3 py-2.5 text-[11px] font-bold tabular-nums">{formatEur(t.cpc)}</td>
                        <td className="px-3 py-2.5 text-[11px] font-extrabold tabular-nums" style={{ color: BRAND.blue }}>
                          {t.cpa > 0 ? formatEur(t.cpa) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            );
          })()}
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
