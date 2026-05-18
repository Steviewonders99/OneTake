'use client';

import type { Project } from '@/lib/types/projects';
import type { DateRange } from './types';
import { BRAND } from './types';

interface HeaderProps {
  projects: Project[];
  selectedProject: string | null;
  selectedCountry: string | null;
  dateRange: DateRange;
  onProjectChange: (id: string | null) => void;
  onCountryChange: (country: string | null) => void;
  onDateRangeChange: (range: DateRange) => void;
}

export function CommandCenterHeader(props: HeaderProps) {
  const { projects, selectedProject, selectedCountry, dateRange } = props;
  const allCountries = Array.from(new Set(projects.flatMap(p => p.countries ?? []))).sort();
  const selected = selectedProject ? projects.find(p => p.id === selectedProject) : null;
  const subtitle = selected
    ? `${selected.display_name} · ${(selected.countries ?? []).join(', ')}`
    : `Week of May 12–18, 2026 · ${projects.length} active projects · All channels`;

  return (
    <div className="flex justify-between items-start mb-7">
      <div>
        <h1 className="text-[28px] tracking-tight" style={{ color: BRAND.text }}>
          <span className="font-extralight">Project</span>{' '}
          <span className="font-extrabold">Command Center</span>
        </h1>
        <div className="text-xs mt-1" style={{ color: BRAND.text3 }}>{subtitle}</div>
      </div>
      <div className="flex gap-2.5 items-center">
        <select
          value={selectedProject ?? ''}
          onChange={e => props.onProjectChange(e.target.value || null)}
          className="px-3.5 py-2.5 pr-9 border rounded-[10px] text-[13px] font-medium bg-white min-w-[240px] appearance-none cursor-pointer"
          style={{
            color: BRAND.text, borderColor: BRAND.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%239CA3AF" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>')`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
          }}
        >
          <option value="">All Projects (Full Portfolio)</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.codename} — {p.display_name.split('—')[1]?.trim() ?? p.display_name}</option>
          ))}
        </select>
        <select
          value={selectedCountry ?? ''}
          onChange={e => props.onCountryChange(e.target.value || null)}
          className="px-3 py-2.5 pr-8 border rounded-[10px] text-[13px] font-medium bg-white min-w-[120px] appearance-none cursor-pointer"
          style={{
            color: BRAND.text, borderColor: BRAND.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%239CA3AF" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>')`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          }}
        >
          <option value="">All Countries</option>
          {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-0.5 bg-[#F6F7FB] rounded-lg p-[3px]">
          {([7, 14, 30, 90] as DateRange[]).map(d => (
            <button key={d} onClick={() => props.onDateRangeChange(d)}
              className={`px-3.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                dateRange === d ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#4B5563]'
              }`}>{d}d</button>
          ))}
        </div>
      </div>
    </div>
  );
}
