'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/lib/types/projects';
import type { DateRange } from '../command-center/types';
import { BRAND } from '../command-center/types';
import { ProjectSearch } from '../command-center/ProjectSearch';
import { FunnelWaterfall } from './FunnelWaterfall';
import { SourceBreakdown } from './SourceBreakdown';
import { PaidMetrics } from './PaidMetrics';
import { LocaleTable } from './LocaleTable';
import { CountrySelector } from './CountrySelector';

interface Props {
  initialProjects: Project[];
}

export function DeepDiveClient({ initialProjects }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialProjects[0]?.id ?? null);
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
        fetch(`/api/projects/${selectedId}/ga4-funnel`).then(r => r.ok ? r.json() : null),
        fetch(`/api/projects/${selectedId}/funnel?view=weekly`).then(r => r.ok ? r.json() : null),
        fetch(`/api/projects/${selectedId}/channels`).then(r => r.ok ? r.json() : []),
        fetch(`/api/projects/${selectedId}/locales`).then(r => r.ok ? r.json() : []),
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

  // Detect funnel path type from data
  const hasPaidSpend = (weeklyData?.current?.total_spend ?? 0) > 0;
  const hasSignup = (funnelData?.totals?.signup ?? 0) > 0;
  const hasNda = (funnelData?.totals?.nda_signed ?? 0) > 0;
  const hasSurvey = locales.some((l: any) => l.apply_url?.includes('aidaform'));

  const pathType: 'paid' | 'organic' | 'aidaform' | 'unknown' =
    hasPaidSpend ? 'paid' :
    hasSurvey ? 'aidaform' :
    hasSignup || hasNda ? 'organic' :
    'unknown';

  const pathLabel = {
    paid: 'Paid Campaign Funnel',
    organic: 'Organic Acquisition Funnel',
    aidaform: 'Data Collection Funnel (AidaForm)',
    unknown: 'Acquisition Funnel',
  }[pathType];

  // Build funnel stages adaptively — only show stages with data
  const allStages = funnelData?.totals ? [
    { label: 'WP Entry', value: funnelData.totals.wp_entry ?? 0, color: '#0348B2', always: true },
    { label: 'Apply Click', value: funnelData.totals.apply_click ?? 0, color: '#2563EB', always: false },
    { label: 'Signup', value: funnelData.totals.signup ?? 0, color: '#4F46E5', always: false },
    { label: 'MFA Setup', value: funnelData.totals.mfa_setup ?? 0, color: '#7C3AED', always: false },
    { label: 'Profile Created', value: funnelData.totals.profile_created ?? 0, color: '#9333EA', always: false },
    { label: 'NDA Signed', value: funnelData.totals.nda_signed ?? 0, color: '#A855F7', always: false },
    { label: 'Certification', value: funnelData.totals.certification ?? 0, color: '#DB2777', always: false },
    { label: 'Browsing Jobs', value: funnelData.totals.browsing_jobs ?? 0, color: '#6366F1', always: false },
    { label: 'Doing Tasks', value: funnelData.totals.doing_tasks ?? 0, color: '#0348B2', always: false },
  ] : [];

  const funnelStages = allStages.filter(s => s.value > 0 || s.always);

  // Paid metrics from weekly data
  const currentWeek = weeklyData?.current;
  const spend = currentWeek?.total_spend ?? 0;
  const impressions = currentWeek?.total_impressions ?? 0;
  const clicks = currentWeek?.total_clicks ?? 0;
  const ndaSigned = funnelData?.totals?.nda_signed ?? 0;
  const activeWorkers = funnelData?.totals?.doing_tasks ?? 0;

  // Source breakdown
  const sources = (funnelData?.by_source ?? []).map((s: any) => ({
    source: s.source ?? '(not set)',
    medium: s.medium ?? '(not set)',
    nda_signed: s.nda_signed ?? 0,
    doing_tasks: s.doing_tasks ?? 0,
  }));

  if (loading && !funnelData) {
    return (
      <div className="p-10" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#f0f0f0] rounded" />
          <div className="h-[400px] bg-[#f0f0f0] rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-[250px] bg-[#f0f0f0] rounded-2xl" />
            <div className="h-[250px] bg-[#f0f0f0] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-7">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color: BRAND.text3 }}>Project Deep Dive</div>
          <h1 className="text-[26px] tracking-tight" style={{ color: BRAND.text }}>
            <span className="font-extrabold">{selected?.codename ?? 'Select a project'}</span>
            {selected && (
              <span className="font-extralight"> — {selected.display_name.split('—')[1]?.trim() ?? selected.display_name}</span>
            )}
          </h1>
          {selected && (
            <div className="text-xs mt-1" style={{ color: BRAND.text3 }}>
              {(selected.countries ?? []).join(', ')} · {locales.filter((l: any) => l.is_active).length} locales · {channels.length} channels · Since {selected.wp_published_at?.split('T')[0] ?? '—'}
            </div>
          )}
        </div>
        <div className="flex gap-2.5 items-center">
          <ProjectSearch
            projects={initialProjects}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="flex gap-0.5 bg-[#F6F7FB] rounded-lg p-[3px]">
            {([7, 14, 30, 90] as DateRange[]).map(d => (
              <button key={d} onClick={() => setDateRange(d)}
                className={`px-3.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  dateRange === d ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#4B5563]'
                }`}>{d === 90 ? 'All' : `${d}d`}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero metrics strip — adapts to path type */}
      {funnelData?.totals && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'WP Entries', value: funnelData.totals.wp_entry?.toLocaleString() ?? '0' },
            { label: 'Apply Clicks', value: funnelData.totals.apply_click?.toLocaleString() ?? '0', color: BRAND.blue },
            {
              label: hasPaidSpend ? 'NDA Signed' : 'Signups',
              value: hasPaidSpend
                ? (funnelData.totals.nda_signed?.toLocaleString() ?? '0')
                : (funnelData.totals.signup?.toLocaleString() ?? '0'),
              color: BRAND.purple,
            },
            {
              label: hasPaidSpend ? 'Cost / Worker' : 'Active Workers',
              value: hasPaidSpend && activeWorkers > 0
                ? `€${(spend / activeWorkers).toFixed(2)}`
                : (funnelData.totals.doing_tasks?.toLocaleString() ?? '0'),
              color: BRAND.pink,
            },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl px-4 py-3.5 border border-black/[0.08]"
                 style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: BRAND.text3 }}>{m.label}</div>
              <div className="text-[24px] font-extrabold tracking-tight" style={{ color: m.color ?? BRAND.text }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Country Selector */}
      <CountrySelector
        locales={locales}
        selectedLocale={selectedLocale}
        onSelect={setSelectedLocale}
      />

      {/* Funnel Path Type Badge */}
      {funnelStages.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-md"
                style={{
                  background: pathType === 'paid' ? '#EFF6FF' : pathType === 'organic' ? '#F5F3FF' : '#FDF2F8',
                  color: pathType === 'paid' ? '#1E40AF' : pathType === 'organic' ? '#6D28D9' : '#BE185D',
                }}>
            {pathLabel}
          </span>
          {selectedLocale && (
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-md"
                  style={{ background: '#F0FDF4', color: '#166534' }}>
              Filtered: {selectedLocale}
            </span>
          )}
        </div>
      )}

      {/* Funnel Waterfall */}
      {funnelStages.length > 0 && <FunnelWaterfall stages={funnelStages} />}

      {/* Source Breakdown + Paid Metrics (or just Source if organic) */}
      <div className={`grid ${hasPaidSpend ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-5`}>
        <SourceBreakdown sources={sources} />
        {hasPaidSpend && (
          <PaidMetrics
            spend={spend}
            impressions={impressions}
            clicks={clicks}
            ndaSigned={ndaSigned}
            activeWorkers={activeWorkers}
          />
        )}
      </div>

      {/* Locale Table */}
      <LocaleTable locales={locales} />
    </div>
  );
}
