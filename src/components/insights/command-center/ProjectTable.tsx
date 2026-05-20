'use client';

import { useState } from 'react';
import type { ProjectWithFunnel, DateRangeValue } from './types';
import { BRAND, PILL_CLASSES, CHANNEL_DISPLAY } from './types';
import { formatEur, formatDelta, ACTION_STYLES } from './utils';

// Map organic sources to display-friendly channel pills
const SOURCE_PILLS: Record<string, { label: string; cls: string }> = {
  google_organic: { label: 'Google Search', cls: 'bg-[#DBEAFE] text-[#1E3A8A]' },
  chatgpt: { label: 'ChatGPT', cls: 'bg-[#F5F3FF] text-[#5B21B6]' },
  bing_organic: { label: 'Bing', cls: 'bg-[#DBEAFE] text-[#1E40AF]' },
  linkedin_social: { label: 'LinkedIn', cls: 'bg-[#EDE9FE] text-[#4C1D95]' },
  direct: { label: 'Direct', cls: 'bg-[#F3F4F6] text-[#374151]' },
  brevo_email: { label: 'Brevo Email', cls: 'bg-[#FCE7F3] text-[#9D174D]' },
  job_board: { label: 'Job Board', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  handshake: { label: 'Handshake', cls: 'bg-[#FEF3C7] text-[#92400E]' },
  youtube: { label: 'YouTube', cls: 'bg-[#FEE2E2] text-[#991B1B]' },
  referral: { label: 'Referral', cls: 'bg-[#F3F4F6] text-[#6B7280]' },
  flyer: { label: 'Flyers', cls: 'bg-[#F5F3FF] text-[#5B21B6]' },
};

function getSourcePills(channels: any[], weekly: any[]): { label: string; cls: string }[] {
  const pills: { label: string; cls: string }[] = [];
  const seen = new Set<string>();

  // From explicit channel links (paid channels)
  for (const ch of channels) {
    const slug = ch.channel_slug;
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      const display = CHANNEL_DISPLAY[slug] ?? slug;
      const cls = PILL_CLASSES[slug] ?? 'bg-gray-100 text-gray-600';
      pills.push({ label: display, cls });
    }
  }

  // From weekly data: detect organic sources via organic_clicks > 0
  const hasOrganic = weekly.some((w: any) => (w.organic_clicks ?? 0) > 0);
  if (hasOrganic && !seen.has('organic_search')) {
    pills.push(SOURCE_PILLS.google_organic);
  }

  // If no channels at all but has data, show "Organic" as fallback
  if (pills.length === 0) {
    pills.push({ label: 'Organic', cls: 'bg-[#F3F4F6] text-[#6B7280]' });
  }

  return pills.slice(0, 4); // max 4 pills
}

interface ProjectTableProps {
  projects: ProjectWithFunnel[];
  selectedCountry: string | null;
  onProjectSelect: (id: string) => void;
  dateRange?: DateRangeValue;
}

export function ProjectTable({ projects, selectedCountry, onProjectSelect, dateRange }: ProjectTableProps) {
  const [showAll, setShowAll] = useState(false);

  const filtered = selectedCountry
    ? projects.filter(p => (p.countries ?? []).includes(selectedCountry))
    : projects;

  // Aggregate each project's weekly data within the selected date range
  const rangeStart = dateRange?.start ?? '2025-01-01';
  const rangeEnd = dateRange?.end ?? '2099-12-31';

  const aggregated = filtered.map(proj => {
    const inRange = (proj.weekly ?? []).filter(
      w => w.week_start >= rangeStart && w.week_start <= rangeEnd
    );
    const spend = inRange.reduce((s, w) => s + (w.total_spend ?? 0), 0);
    const clicks = inRange.reduce((s, w) => s + (w.total_clicks ?? 0), 0);
    const conversions = inRange.reduce((s, w) => s + (w.total_conversions ?? 0), 0);

    // WoW: compare last two weeks in range
    const weekStarts = [...new Set(inRange.map(w => w.week_start))].sort().reverse();
    const currWeek = weekStarts[0] ? inRange.filter(w => w.week_start === weekStarts[0]) : [];
    const prevWeek = weekStarts[1] ? inRange.filter(w => w.week_start === weekStarts[1]) : [];
    const currConv = currWeek.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
    const prevConv = prevWeek.reduce((s, w) => s + (w.total_conversions ?? 0), 0);
    const wowPct = prevConv > 0 ? ((currConv - prevConv) / prevConv) * 100 : null;

    const cpa = conversions > 0 ? spend / conversions : null;
    const pills = getSourcePills(proj.channels ?? [], inRange);

    return { proj, spend, clicks, conversions, cpa, wowPct, pills, weekCount: inRange.length };
  });

  const sorted = [...aggregated].sort((a, b) => b.conversions - a.conversions);
  const visible = showAll ? sorted : sorted.slice(0, 5);
  const remaining = sorted.length - 5;

  // Dynamic title
  const rangeLabel = dateRange?.preset
    ? dateRange.preset === 'all' ? 'All Time' : `Last ${dateRange.preset} Days`
    : 'Selected Range';

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-6 py-4 border-b border-black/[0.04] flex justify-between items-center">
        <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>All Projects — {rangeLabel}</h3>
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
          {visible.map(({ proj, spend, clicks, conversions, cpa, wowPct, pills }) => {
            const delta = formatDelta(wowPct);
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
                    {pills.map(pill => (
                      <span key={pill.label} className={`inline-block text-[8px] font-bold px-[7px] py-[2px] rounded-[10px] uppercase tracking-[0.04em] ${pill.cls}`}>
                        {pill.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-semibold" style={{ color: spend > 0 ? BRAND.text : BRAND.text3 }}>
                  {spend > 0 ? formatEur(spend) : '—'}
                </td>
                <td className="px-4 py-3.5 text-right text-[13px]">{clicks.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right text-[13px] font-bold" style={{ color: BRAND.text }}>{conversions.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right text-[13px]" style={{ color: cpa ? BRAND.text : BRAND.text3, fontStyle: cpa ? 'normal' : 'italic', fontSize: cpa ? undefined : '11px' }}>
                  {cpa ? formatEur(cpa) : 'non-paid'}
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
