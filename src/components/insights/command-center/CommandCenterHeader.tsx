'use client';

import type { Project } from '@/lib/types/projects';
import type { DateRange } from './types';
import { BRAND } from './types';
import { ProjectSearch } from './ProjectSearch';

interface HeaderProps {
  projects: Project[];
  selectedProject: string | null;
  selectedCountry: string | null;
  dateRange: DateRange;
  onProjectChange: (id: string | null) => void;
  onCountryChange: (country: string | null) => void;
  onDateRangeChange: (range: DateRange) => void;
}

// Extract real country names from locale strings like "English (Australia)" → "Australia"
function extractCountries(locales: string[]): string[] {
  const countries = new Set<string>();
  const countryPatterns = [
    // Direct country names
    /^(Australia|Bulgaria|Canada|Chile|China|Colombia|Croatia|Egypt|Finland|France|Germany|Greece|India|Ireland|Israel|Italy|Japan|Korea|Malaysia|Mexico|Morocco|New Zealand|Norway|Poland|Portugal|Romania|Russia|Singapore|South Africa|Spain|Sweden|Thailand|Turkey|UAE|USA|United Kingdom|Vietnam|Hong Kong|Brazil|Netherlands|Czech Republic)$/i,
    // "English (Australia)" pattern
    /\(([^)]+)\)/,
    // "English - Australia" pattern
    /- ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*$/,
  ];

  for (const locale of locales) {
    // Try direct match first
    if (countryPatterns[0].test(locale)) {
      countries.add(locale);
      continue;
    }
    // Try parenthetical
    const parenMatch = locale.match(countryPatterns[1]);
    if (parenMatch) {
      const inner = parenMatch[1].trim();
      // Skip language-only matches like "Latin" or "Bokmal"
      if (inner.length > 2 && !inner.includes('(') && !/^(Latin|Bokmal|Cyrillic|Simplified|Traditional)$/i.test(inner)) {
        countries.add(inner);
      }
    }
    // Try dash pattern
    const dashMatch = locale.match(countryPatterns[2]);
    if (dashMatch && dashMatch[1].length > 2) {
      countries.add(dashMatch[1]);
    }
  }
  return Array.from(countries).sort();
}

export function CommandCenterHeader(props: HeaderProps) {
  const { projects, selectedProject, selectedCountry, dateRange } = props;
  const allLocales = Array.from(new Set(projects.flatMap(p => p.countries ?? [])));
  const allCountries = extractCountries(allLocales);
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

        {/* Date pills — always visible top right */}
        <div className="flex gap-0.5 bg-[#F6F7FB] rounded-lg p-[3px]">
          {([7, 14, 30, 90] as DateRange[]).map(d => (
            <button key={d} onClick={() => props.onDateRangeChange(d)}
              className={`px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                dateRange === d ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#4B5563]'
              }`}>{d}d</button>
          ))}
        </div>
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
