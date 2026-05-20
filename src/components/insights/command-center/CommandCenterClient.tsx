'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectWeeklySummary } from '@/lib/types/projects';
import type { ProjectWithFunnel, ChartWeek, DateRangeValue } from './types';
import { TOP_CHANNELS } from './types';
import { computeAction } from './utils';
import { CommandCenterHeader } from './CommandCenterHeader';
import { HeroMetrics } from './HeroMetrics';
import { SecondaryStrip } from './SecondaryStrip';
import { ChannelChart } from './ChannelChart';
import { ProjectTable } from './ProjectTable';
import { NarrativePanel } from './NarrativePanel';
import { DateRangePicker, defaultDateRange } from '../DateRangePicker';

interface Props {
  initialProjects: Project[];
}

export function CommandCenterClient({ initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectWithFunnel[]>(initialProjects as ProjectWithFunnel[]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [dateRangeV2, setDateRangeV2] = useState<DateRangeValue>(defaultDateRange(30));
  const [loading, setLoading] = useState(true);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load in batches of 10 to avoid rate limiting the proxy
      const BATCH_SIZE = 10;
      const enriched: ProjectWithFunnel[] = [];

      for (let i = 0; i < initialProjects.length; i += BATCH_SIZE) {
        const batch = initialProjects.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (proj) => {
            const [channels, funnelRes] = await Promise.all([
              fetch(`/api/projects/${proj.id}/channels`).then(r => r.ok ? r.json() : []).catch(() => []),
              fetch(`/api/projects/${proj.id}/funnel?view=weekly`)
                .then(r => r.ok ? r.json() : { weeks: [], wow: null })
                .catch(() => ({ weeks: [], wow: null })),
            ]);

            const weekly = funnelRes.weeks ?? [];
            const wow = funnelRes.wow ?? null;
            const action = computeAction(wow, weekly[0]?.blended_cpa ?? null, null);

            return { ...proj, channels, weekly, wow, action } as ProjectWithFunnel;
          })
        );
        enriched.push(...results);
      }

      setProjects(enriched);

      const unRes = await fetch('/api/projects/unclassified').catch(() => null);
      if (unRes?.ok) {
        const unData = await unRes.json();
        setUnclassifiedCount(unData.items?.length ?? 0);
      }
    } catch (e) {
      console.error('Failed to load command center data', e);
    } finally {
      setLoading(false);
    }
  }, [initialProjects]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter ALL weekly data by selected date range ──────────────
  const rangeWeekly = (projects.flatMap(p => p.weekly ?? []) as ProjectWeeklySummary[])
    .filter(w => w.week_start >= dateRangeV2.start && w.week_start <= dateRangeV2.end);

  // Current = most recent week in range, Previous = second most recent
  const weekStarts = [...new Set(rangeWeekly.map(w => w.week_start))].sort().reverse();
  const currentWeekStart = weekStarts[0] ?? null;
  const previousWeekStart = weekStarts[1] ?? null;
  const currentWeeks = currentWeekStart ? rangeWeekly.filter(w => w.week_start === currentWeekStart) : [];
  const previousWeeks = previousWeekStart ? rangeWeekly.filter(w => w.week_start === previousWeekStart) : [];

  // All metrics derived from rangeWeekly (respects date picker)
  const totalConversions = rangeWeekly.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const previousConversions = previousWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const currentConversions = currentWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const totalSpend = rangeWeekly.reduce((s, w) => s + (w.total_spend ?? 0), 0);
  const totalClicks = rangeWeekly.reduce((s, w) => s + (w.total_clicks ?? 0), 0);
  const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : null;
  const prevWeekSpend = previousWeeks.reduce((s, w) => s + (w.total_spend ?? 0), 0);
  const prevCpa = previousConversions > 0 ? prevWeekSpend / previousConversions : null;

  // Organic share from weekly paid_clicks vs organic_clicks (in range)
  const rangePaidClicks = rangeWeekly.reduce((s, w) => s + ((w as any).paid_clicks ?? 0), 0);
  const rangeOrganicClicks = rangeWeekly.reduce((s, w) => s + ((w as any).organic_clicks ?? 0), 0);
  const organicTotal = rangePaidClicks + rangeOrganicClicks;
  const organicShare = organicTotal > 0 ? (rangeOrganicClicks / organicTotal) * 100 : 0;

  // Tracked projects = those with data in range
  const projectsWithData = projects.filter(p =>
    (p.weekly ?? []).some(w => w.week_start >= dateRangeV2.start && w.week_start <= dateRangeV2.end)
  );

  // Countries from projects
  const allCountries = [...new Set(projects.flatMap(p => p.countries ?? []).filter(Boolean))];

  // Build chart data from real weekly summaries — attribute conversions to project's actual channels
  const allWeeks = projects
    .flatMap(p => (p.weekly ?? []).map(w => ({ ...w, projectChannels: p.channels ?? [] })))
    .reduce((acc, w) => {
      const key = w.week_start;
      if (!acc[key]) acc[key] = {} as Record<string, number>;
      const conv = w.total_conversions ?? 0;
      const slugs = w.projectChannels.map(c => c.channel_slug).filter((s): s is string => !!s);
      if (slugs.length === 0) {
        // No channels linked — attribute to "organic"
        acc[key]['organic'] = (acc[key]['organic'] ?? 0) + conv;
      } else {
        // Split conversions evenly across linked channels
        const perChannel = conv / slugs.length;
        for (const slug of slugs) {
          acc[key][slug] = (acc[key][slug] ?? 0) + perChannel;
        }
      }
      return acc;
    }, {} as Record<string, Record<string, number>>);

  // Collect all channel slugs from both project links and chart data
  const allChannelSlugs = new Set(
    projects.flatMap(p => (p.channels ?? []).map(c => c.channel_slug).filter(Boolean) as string[])
  );
  for (const channels of Object.values(allWeeks)) {
    for (const slug of Object.keys(channels)) allChannelSlugs.add(slug);
  }
  const allChannels = Array.from(allChannelSlugs);

  // Filter weeks by selected date range, then format labels
  const filteredWeeks = Object.entries(allWeeks)
    .filter(([weekStart]) => weekStart >= dateRangeV2.start && weekStart <= dateRangeV2.end)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const sortedWeeks = filteredWeeks.length > 0 ? filteredWeeks : Object.entries(allWeeks).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const chartData: ChartWeek[] = sortedWeeks.length > 0
    ? sortedWeeks.map(([weekStart, channels], i) => {
        const d = new Date(weekStart + 'T00:00:00');
        const today = new Date();
        const weekEnd = new Date(d.getTime() + 6 * 86400000);
        const label = (weekEnd >= today && d <= today)
          ? 'This Week'
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { week: label, ...channels } as ChartWeek;
      })
    : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'This Week'].map(week => ({
        week, meta_paid: 0, linkedin_organic: 0, recruiter: 0,
      } as ChartWeek));

  if (loading) {
    return (
      <div className="p-10" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[#f0f0f0] rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-36 bg-[#f0f0f0] rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-5 gap-2.5">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-[#f0f0f0] rounded-xl" />)}
          </div>
          <div className="h-[300px] bg-[#f0f0f0] rounded-2xl" />
          <div className="h-[200px] bg-[#f0f0f0] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto" style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}>
      <CommandCenterHeader
        projects={projects}
        selectedProject={selectedProject}
        selectedCountry={selectedCountry}
        onProjectChange={setSelectedProject}
        onCountryChange={setSelectedCountry}
        dateRangeV2={dateRangeV2}
        onDateRangeV2Change={setDateRangeV2}
      />

      <HeroMetrics
        totalConversions={currentConversions}
        previousConversions={previousConversions}
        avg30dConversions={Math.round(totalConversions / Math.max(weekStarts.length, 1))}
        blendedCpa={blendedCpa}
        previousCpa={prevCpa}
        roas={blendedCpa && blendedCpa > 0 ? 38.5 / blendedCpa : null}
        breakevenCpa={38.5}
        organicShare={organicShare}
        organicCount={rangeOrganicClicks}
        totalCount={organicTotal}
        organicShare30dAgo={0}
      />

      <SecondaryStrip
        projectCount={projectsWithData.length}
        channelCount={allChannels.length || 2}
        countryCount={allCountries.length}
        totalSpend={totalSpend}
        unclassifiedCount={unclassifiedCount}
      />

      <ChannelChart data={chartData} allChannels={allChannels} dateRange={dateRangeV2} />

      <ProjectTable
        projects={projects}
        selectedCountry={selectedCountry}
        onProjectSelect={(id) => setSelectedProject(id)}
        dateRange={dateRangeV2}
      />

      <NarrativePanel
        projects={projects}
        totalSpend={totalSpend}
        totalConversions={totalConversions}
        organicShare={organicShare}
      />
    </div>
  );
}
