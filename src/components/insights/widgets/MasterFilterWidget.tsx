"use client";

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDashboardFilter } from '../DashboardFilterContext';
import { formatCompact } from '../chartTheme';
import { groupByProject } from '@/lib/project-resolver';

interface CampaignOption {
  campaign: string;
  total: number;
}

interface ProjectGroup {
  project: string;
  campaigns: string[];
  total: number;
}

export default function MasterFilterWidget({ config }: { config: Record<string, unknown> }) {
  const [rawCampaigns, setRawCampaigns] = useState<CampaignOption[]>([]);
  const [projects, setProjects] = useState<ProjectGroup[]>([]);
  const [search, setSearch] = useState('');
  const { filters, setFilter, clearFilter } = useDashboardFilter();
  const activeCampaign = filters.campaign;
  const days = filters.dateRange ? parseInt(filters.dateRange) : ((config.days as number) || 90);

  useEffect(() => {
    fetch(`/api/insights/metrics/campaign-funnel?days=${days}`)
      .then(r => r.json())
      .then(d => {
        const raw = d.available_campaigns || [];
        setRawCampaigns(raw);
        setProjects(groupByProject(raw));
      })
      .catch(() => {});
  }, [days]);

  // Find which project the active campaign belongs to
  const activeProject = activeCampaign
    ? projects.find(p => p.campaigns.some(c => c.toLowerCase().startsWith(activeCampaign.toLowerCase())))
    : null;

  const filtered = search
    ? projects.filter(p => p.project.toLowerCase().includes(search.toLowerCase()))
    : projects;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Active filter display */}
      {activeCampaign ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[#1a1a1a] truncate">
              {activeProject?.project || activeCampaign}
            </div>
            <div className="text-[9px] text-[#a3a3a3]">
              {activeProject ? `${activeProject.campaigns.length} campaign variants` : 'Filtered'}
            </div>
          </div>
          <button
            onClick={() => clearFilter('campaign')}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors shrink-0"
          >
            Clear <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <div className="text-[12px] font-medium text-[#a3a3a3] shrink-0">
          Select a project
        </div>
      )}

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#d4d4d4]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-8 pr-3 py-2 text-[11px] text-[#1a1a1a] bg-[#f7f7f8] border border-[#f0f0f0] rounded-lg outline-none focus:border-[#d4d4d4] placeholder-[#d4d4d4] transition-colors"
        />
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
        {/* All Projects */}
        <button
          onClick={() => clearFilter('campaign')}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-colors ${
            !activeCampaign ? 'bg-[#1a1a1a] text-white' : 'text-[#525252] hover:bg-[#f5f5f5]'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${!activeCampaign ? 'bg-white' : 'bg-[#d4d4d4]'}`} />
          <span className="text-[11px] font-medium flex-1">All Projects</span>
          <span className={`text-[10px] tabular-nums ${!activeCampaign ? 'text-white/60' : 'text-[#a3a3a3]'}`}>
            {formatCompact(rawCampaigns.reduce((s, c) => s + c.total, 0))}
          </span>
        </button>

        {filtered.map(p => {
          // Use the first campaign variant as the filter key (LIKE prefix will catch all)
          const filterKey = p.campaigns[0] || p.project;
          const isActive = activeCampaign && p.campaigns.some(c =>
            c.toLowerCase().startsWith(activeCampaign.toLowerCase())
          );

          return (
            <button
              key={p.project}
              onClick={() => setFilter('campaign', filterKey)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-colors ${
                isActive ? 'bg-[#1a1a1a] text-white' : 'text-[#525252] hover:bg-[#f5f5f5]'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-[#3b82f6]'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium truncate block">{p.project}</span>
                {p.campaigns.length > 1 && (
                  <span className={`text-[9px] ${isActive ? 'text-white/50' : 'text-[#a3a3a3]'}`}>
                    {p.campaigns.length} variants
                  </span>
                )}
              </div>
              <span className={`text-[10px] tabular-nums shrink-0 ${isActive ? 'text-white/60' : 'text-[#a3a3a3]'}`}>
                {formatCompact(p.total)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
