'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Project } from '@/lib/types/projects';
import { BRAND } from './types';

interface ProjectSearchProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showAllOption?: boolean;
}

export function ProjectSearch({ projects, selectedId, onSelect, showAllOption = false }: ProjectSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = selectedId ? projects.find(p => p.id === selectedId) : null;

  const filtered = query.length > 0
    ? projects.filter(p =>
        p.codename.toLowerCase().includes(query.toLowerCase()) ||
        p.display_name.toLowerCase().includes(query.toLowerCase())
      )
    : projects;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative min-w-[280px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: BRAND.text3 }} />
      <input
        type="text"
        placeholder={selected ? (selected.display_name?.split('—')[0]?.trim() || selected.codename) : 'Search projects...'}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full pl-8 pr-3.5 py-2.5 border rounded-[10px] text-[13px] font-medium bg-white appearance-none"
        style={{
          color: BRAND.text, borderColor: BRAND.border,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      />
      {open && (
        <div className="absolute top-[44px] left-0 right-0 bg-white border rounded-[10px] max-h-[320px] overflow-y-auto z-50"
             style={{ borderColor: BRAND.border, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}>
          {showAllOption && (
            <button
              onClick={() => { onSelect(null); setQuery(''); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2.5 text-[13px] hover:bg-[#F5F3FF] transition-colors ${
                !selectedId ? 'bg-[#F5F3FF] font-semibold' : ''
              }`}
              style={{ color: BRAND.text }}
            >
              📊 All Projects (Full Portfolio)
            </button>
          )}
          {filtered.length === 0 && (
            <div className="px-3.5 py-3 text-[12px]" style={{ color: BRAND.text3 }}>No projects match "{query}"</div>
          )}
          {filtered.slice(0, 20).map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setQuery(''); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2.5 hover:bg-[#F5F3FF] transition-colors ${
                p.id === selectedId ? 'bg-[#F5F3FF]' : ''
              }`}
            >
              <span className="text-[13px] font-semibold" style={{ color: BRAND.text }}>
                {p.display_name?.split('—')[0]?.trim() || p.codename}
              </span>
              <span className="text-[10px] ml-2" style={{ color: BRAND.text3 }}>
                {p.display_name?.split('—')[1]?.trim() ?? ''}{(p.countries ?? []).length > 0 && ` · ${(p.countries ?? []).length} locales`}
              </span>
            </button>
          ))}
          {filtered.length > 20 && (
            <div className="px-3.5 py-2 text-[11px] text-center" style={{ color: BRAND.text3 }}>
              +{filtered.length - 20} more — keep typing to narrow
            </div>
          )}
        </div>
      )}
    </div>
  );
}
