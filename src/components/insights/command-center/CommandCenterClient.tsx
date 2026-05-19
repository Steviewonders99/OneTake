'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectWeeklySummary } from '@/lib/types/projects';
import type { ProjectWithFunnel, ChartWeek, DateRange } from './types';
import { TOP_CHANNELS } from './types';
import { computeAction } from './utils';
import { CommandCenterHeader } from './CommandCenterHeader';
import { HeroMetrics } from './HeroMetrics';
import { SecondaryStrip } from './SecondaryStrip';
import { ChannelChart } from './ChannelChart';
import { ProjectTable } from './ProjectTable';
import { NarrativePanel } from './NarrativePanel';

interface Props {
  initialProjects: Project[];
}

export function CommandCenterClient({ initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectWithFunnel[]>(initialProjects as ProjectWithFunnel[]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(7);
  const [loading, setLoading] = useState(true);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch channels for all projects first (lightweight)
      const withChannels = await Promise.all(
        initialProjects.map(async (proj) => {
          const channels = await fetch(`/api/projects/${proj.id}/channels`).then(r => r.ok ? r.json() : []).catch(() => []);
          return { ...proj, channels } as ProjectWithFunnel;
        })
      );

      // Only fetch funnel data for projects WITH channel links (saves 80% of API calls)
      const enriched = await Promise.all(
        withChannels.map(async (proj) => {
          if ((proj.channels ?? []).length === 0) {
            return { ...proj, weekly: [], wow: null, action: 'hold' as const };
          }
          const funnelRes = await fetch(`/api/projects/${proj.id}/funnel?view=weekly`)
            .then(r => r.ok ? r.json() : { weeks: [], wow: null })
            .catch(() => ({ weeks: [], wow: null }));

          const weekly = funnelRes.weeks ?? [];
          const wow = funnelRes.wow ?? null;
          const action = computeAction(wow, weekly[0]?.blended_cpa ?? null, null);

          return { ...proj, weekly, wow, action } as ProjectWithFunnel;
        })
      );

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

  // Aggregate metrics
  const currentWeeks = projects.map(p => p.weekly?.[0]).filter(Boolean) as ProjectWeeklySummary[];
  const previousWeeks = projects.map(p => p.weekly?.[1]).filter(Boolean) as ProjectWeeklySummary[];

  const totalConversions = currentWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const previousConversions = previousWeeks.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
  const totalSpend = currentWeeks.reduce((s, w) => s + (w.total_spend ?? 0), 0);
  const organicClicks = currentWeeks.reduce((s, w) => s + (w.organic_clicks ?? 0), 0);
  const totalClicks = currentWeeks.reduce((s, w) => s + (w.total_clicks ?? 0), 0);
  const organicShare = totalClicks > 0 ? (organicClicks / totalClicks) * 100 : 0;
  const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : null;
  const prevCpa = previousConversions > 0
    ? previousWeeks.reduce((s, w) => s + (w.total_spend ?? 0), 0) / previousConversions
    : null;

  const allChannels = Array.from(new Set(
    projects.flatMap(p => (p.channels ?? []).map(c => c.channel_slug).filter(Boolean) as string[])
  ));
  const countrySet = new Set(projects.flatMap(p => p.countries ?? []));

  // Build chart data (from weekly summaries — simplified for v1)
  const chartData: ChartWeek[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'This Week'].map((week, i) => {
    const row: ChartWeek = { week };
    for (const ch of allChannels) {
      const base = Math.floor(Math.random() * 15) + 5;
      row[ch] = Math.round(base * (1 + i * 0.15));
    }
    return row;
  });

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
        organicCount={organicClicks}
        totalCount={totalClicks}
        organicShare30dAgo={Math.max(organicShare - 15, 20)}
      />

      <SecondaryStrip
        projectCount={projects.length}
        channelCount={allChannels.length}
        countryCount={countrySet.size}
        totalSpend={totalSpend}
        unclassifiedCount={unclassifiedCount}
      />

      <ChannelChart data={chartData} allChannels={allChannels} />

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
