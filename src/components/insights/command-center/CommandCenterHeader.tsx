'use client';

import type { Project } from '@/lib/types/projects';
import type { DateRangeValue } from './types';
import { BRAND } from './types';
import { ProjectSearch } from './ProjectSearch';
import { DateRangePicker } from '../DateRangePicker';

interface HeaderProps {
  projects: Project[];
  selectedProject: string | null;
  selectedCountry: string | null;
  onProjectChange: (id: string | null) => void;
  onCountryChange: (country: string | null) => void;
  dateRangeV2: DateRangeValue;
  onDateRangeV2Change: (value: DateRangeValue) => void;
}


export function CommandCenterHeader(props: HeaderProps) {
  const { projects, selectedProject, selectedCountry } = props;
  const allCountries = [...new Set(projects.flatMap(p => p.countries ?? []).filter(Boolean))].sort();
  const selected = selectedProject ? projects.find(p => p.id === selectedProject) : null;

  const projectCount = projects.length;
  const channelCount = new Set(
    projects.flatMap(p => ((p as any).channels ?? []).map((c: any) => c.channel_slug)).filter(Boolean)
  ).size;

  return (
    <div className="mb-6">
      {/* Title row */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-[24px] tracking-tight leading-tight" style={{ color: BRAND.text }}>
            <span className="font-extralight">Project</span>{' '}
            <span className="font-extrabold">Command Center</span>
          </h1>
          <div className="text-[12px] mt-0.5" style={{ color: BRAND.text3 }}>
            {selected
              ? selected.display_name
              : `${projectCount} active projects · ${channelCount || 'All'} channels · ${allCountries.length} countries`
            }
          </div>
        </div>

        {/* Date range picker */}
        <DateRangePicker value={props.dateRangeV2} onChange={props.onDateRangeV2Change} />
      </div>

      {/* Filter row */}
      <div className="flex gap-3 items-center">
        <div style={{ flex: 1, maxWidth: 320 }}>
          <ProjectSearch
            projects={projects}
            selectedId={selectedProject}
            onSelect={props.onProjectChange}
            showAllOption
          />
        </div>
        <select
          value={selectedCountry ?? ''}
          onChange={e => props.onCountryChange(e.target.value || null)}
          className="px-3 py-2.5 pr-8 border rounded-[10px] text-[13px] font-medium bg-white min-w-[160px] appearance-none cursor-pointer"
          style={{
            color: BRAND.text, borderColor: BRAND.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%239CA3AF" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>')`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          }}
        >
          <option value="">All Countries ({allCountries.length})</option>
          {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
}
