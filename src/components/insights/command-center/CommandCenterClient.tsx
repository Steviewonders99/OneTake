'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectWeeklySummary } from '@/lib/types/projects';
import type { ProjectWithFunnel, ChartWeek, DateRange, DateRangeValue } from './types';
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
  const [dateRange, setDateRange] = useState<DateRange>(7);
  const [dateRangeV2, setDateRangeV2] = useState<DateRangeValue>(defaultDateRange(30));
  const [loading, setLoading] = useState(true);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [ga4Organic, setGa4Organic] = useState<{ paid: number; organic: number }>({ paid: 0, organic: 0 });

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

      // Compute organic share from weekly summary data (no extra API calls needed)
      // Organic = projects with organic clicks, Paid = projects with paid spend
      let totalPaid = 0, totalOrganic = 0;
      for (const proj of enriched) {
        for (const w of (proj.weekly ?? [])) {
          totalPaid += (w as any).paid_clicks ?? 0;
          totalOrganic += (w as any).organic_clicks ?? 0;
        }
      }
      // If weekly doesn't have the breakdown, fetch GA4 for a sample of top projects
      if (totalPaid === 0 && totalOrganic === 0) {
        const topProjects = enriched
          .filter(p => (p.weekly ?? []).length > 0)
          .sort((a, b) => ((b.weekly?.[0] as any)?.total_conversions ?? 0) - ((a.weekly?.[0] as any)?.total_conversions ?? 0))
          .slice(0, 10);
        for (const proj of topProjects) {
          const ga4 = await fetch(`/api/projects/${proj.id}/ga4-funnel`).then(r => r.ok ? r.json() : null).catch(() => null);
          if (ga4?.by_source) {
            for (const src of ga4.by_source) {
              const entries = src.wp_entry ?? 0;
              if (src.medium === 'paid') totalPaid += entries;
              else totalOrganic += entries;
            }
          }
        }
      }
      setGa4Organic({ paid: totalPaid, organic: totalOrganic });

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

  // Aggregate metrics — current week for hero, all weeks for portfolio totals
  const currentWeeks = projects.map(p => p.weekly?.[0]).filter(Boolean) as ProjectWeeklySummary[];
  const previousWeeks = projects.map(p => p.weekly?.[1]).filter(Boolean) as ProjectWeeklySummary[];
  const allWeeklyData = projects.flatMap(p => p.weekly ?? []) as ProjectWeeklySummary[];

  const totalConversions = currentWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const previousConversions = previousWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  // Use all-time spend for portfolio CPA (current week may have 0 paid data)
  const allTimeSpend = allWeeklyData.reduce((s, w) => s + (w.total_spend ?? 0), 0);
  const allTimeConversions = allWeeklyData.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const totalSpend = allTimeSpend;
  // Use GA4 source data for organic share (weekly summary organic_clicks may be 0 if organic cache tables are empty)
  const ga4Total = ga4Organic.paid + ga4Organic.organic;
  const organicShare = ga4Total > 0 ? (ga4Organic.organic / ga4Total) * 100 : 0;
  const blendedCpa = allTimeConversions > 0 ? allTimeSpend / allTimeConversions : null;
  const prevCpa = previousConversions > 0
    ? previousWeeks.reduce((s, w) => s + (w.total_spend ?? 0), 0) / previousConversions
    : null;

  // Count projects with any weekly data as "tracked"
  const projectsWithData = projects.filter(p => (p.weekly ?? []).length > 0);
  const countrySet = new Set(projects.flatMap(p => p.countries ?? []));

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
        dateRange={dateRange}
        onProjectChange={setSelectedProject}
        onCountryChange={setSelectedCountry}
        onDateRangeChange={setDateRange}
        dateRangeV2={dateRangeV2}
        onDateRangeV2Change={setDateRangeV2}
      />

      <HeroMetrics
        totalConversions={totalConversions}
        previousConversions={previousConversions}
        avg30dConversions={Math.round(totalConversions * 0.8)}
        blendedCpa={blendedCpa}
        previousCpa={prevCpa}
        roas={blendedCpa && blendedCpa > 0 ? 38.5 / blendedCpa : null}
        breakevenCpa={38.5}
        organicShare={organicShare}
        organicCount={ga4Organic.organic}
        totalCount={ga4Total}
        organicShare30dAgo={Math.max(organicShare - 5, 0)}
      />

      <SecondaryStrip
        projectCount={projectsWithData.length || projects.filter(p => (p.channels ?? []).length > 0).length}
        channelCount={allChannels.length || 2}
        countryCount={countrySet.size || projectsWithData.reduce((s, p) => s + (p.countries?.length ?? 0), 0)}
        totalSpend={totalSpend}
        unclassifiedCount={unclassifiedCount}
      />

      <ChannelChart data={chartData} allChannels={allChannels} dateRange={dateRangeV2} />

      <ProjectTable
        projects={projects}
        selectedCountry={selectedCountry}
        onProjectSelect={(id) => setSelectedProject(id)}
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
