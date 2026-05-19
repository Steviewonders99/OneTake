'use client';

import { useState } from 'react';
import type { ProjectWithFunnel } from './types';
import { BRAND, PILL_CLASSES, CHANNEL_DISPLAY } from './types';
import { formatEur, formatDelta, ACTION_STYLES } from './utils';

interface ProjectTableProps {
  projects: ProjectWithFunnel[];
  selectedCountry: string | null;
  onProjectSelect: (id: string) => void;
}

export function ProjectTable({ projects, selectedCountry, onProjectSelect }: ProjectTableProps) {
  const [showAll, setShowAll] = useState(false);

  const filtered = selectedCountry
    ? projects.filter(p => (p.countries ?? []).includes(selectedCountry))
    : projects;

  const sorted = [...filtered].sort((a, b) =>
    (b.weekly?.[0]?.total_conversions ?? 0) - (a.weekly?.[0]?.total_conversions ?? 0)
  );

  const visible = showAll ? sorted : sorted.slice(0, 5);
  const remaining = sorted.length - 5;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-6 py-4 border-b border-black/[0.04] flex justify-between items-center">
        <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>All Projects — This Week</h3>
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: BRAND.text3 }}>
          Paid + organic + email + physical + recruiter · All channels unified
        </span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F6F7FB] border-b border-black/[0.08]">
            {['Project', 'Channels', 'Spend', 'Clicks', 'Applications', 'CPA', 'WoW', 'Action'].map((h, i) => (
              <th key={h} className={`px-4 py-2.5 text-[9px] uppercase tracking-[0.1em] font-semibold ${
                i >= 2 && i <= 6 ? 'text-right' : i === 7 ? 'text-center' : 'text-left'
              }`} style={{ color: BRAND.text3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(proj => {
            const w = proj.weekly?.[0];
            const spend = w?.total_spend ?? 0;
            const conversions = w?.total_conversions ?? 0;
            const clicks = w?.total_clicks ?? 0;
            const cpa = w?.blended_cpa;
            const wowConv = proj.wow?.conversions ?? null;
            const delta = formatDelta(wowConv);
            const action = ACTION_STYLES[proj.action ?? 'hold'];

            return (
              <tr key={proj.id}
                  className="border-b border-black/[0.03] cursor-pointer transition-colors hover:bg-[#FAFAFF]"
                  onClick={() => onProjectSelect(proj.id)}>
                <td className="px-4 py-3.5 max-w-[280px]">
                  <div className="font-semibold text-[13px]" style={{ color: BRAND.text }}>
                    {proj.display_name.split('—')[0]?.trim() ?? proj.codename}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: BRAND.text3 }}>
                    {proj.display_name.split('—')[1]?.trim() ?? ''}
                    {(proj.countries ?? []).length > 0 && ` · ${(proj.countries ?? []).length} locales`}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-1 flex-wrap">
                    {Array.from(new Set((proj.channels ?? []).map(ch => ch.channel_slug))).filter(Boolean).map(slug => {
                      const pillClass = PILL_CLASSES[slug!] ?? 'bg-gray-100 text-gray-600';
                      return (
                        <span key={slug} className={`inline-block text-[8px] font-bold px-[7px] py-[2px] rounded-[10px] uppercase tracking-[0.04em] ${pillClass}`}>
                          {CHANNEL_DISPLAY[slug!] ?? slug}
                        </span>
                      );
                    })}
                    {(proj.channels ?? []).length === 0 && (
                      <span className="inline-block text-[8px] font-medium px-[7px] py-[2px] rounded-[10px] bg-[#F3F4F6] text-[#6B7280] italic">
                        organic
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-semibold" style={{ color: spend > 0 ? BRAND.text : BRAND.text3 }}>
                  {spend > 0 ? formatEur(spend) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px]">{clicks.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right text-[13px] font-bold" style={{ color: BRAND.text }}>{conversions}</td>
                <td className="px-4 py-3.5 text-right text-[13px]" style={{ color: cpa ? BRAND.text : BRAND.text3, fontStyle: cpa ? 'normal' : 'italic', fontSize: cpa ? undefined : '11px' }}>
                  {cpa ? formatEur(cpa) : 'organic'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-semibold" style={{ color: delta.color }}>
                  {delta.arrow} {delta.text}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="inline-block text-[8px] font-extrabold px-2.5 py-[3px] rounded-[10px] text-white uppercase tracking-[0.04em]"
                        style={{ background: action.bg }}>{action.label}</span>
                </td>
              </tr>
            );
          })}
          {!showAll && remaining > 0 && (
            <tr>
              <td colSpan={8} className="text-center py-2.5 text-[12px]" style={{ color: BRAND.text3 }}>
                + {remaining} more projects ·{' '}
                <button onClick={() => setShowAll(true)} className="font-medium" style={{ color: BRAND.purple }}>Show all →</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
