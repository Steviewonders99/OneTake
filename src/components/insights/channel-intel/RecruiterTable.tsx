'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';

interface RecruiterRow {
  recruiterId: string;
  source: string;
  platform: string;
  wpVisits: number;
  applyClicks: number;
  signups: number;
  ndaSigned: number;
  cvr: number;
}

interface RecruiterTableProps {
  rows: RecruiterRow[];
  selectedRecruiter?: string | null;
  onRecruiterChange?: (id: string | null) => void;
}

const SOURCE_PILLS: Record<string, { bg: string; text: string }> = {
  linkedin_inmail: { bg: '#EDE9FE', text: '#6D28D9' },
  handshake:       { bg: '#FEF3C7', text: '#92400E' },
  flyer:           { bg: '#D1FAE5', text: '#065F46' },
  flyer_manila:    { bg: '#D1FAE5', text: '#065F46' },
  flyer_qr:        { bg: '#D1FAE5', text: '#065F46' },
  college:         { bg: '#FEE2E2', text: '#991B1B' },
  email:           { bg: '#FEE2E2', text: '#991B1B' },
};

function getSourcePill(source: string): { bg: string; text: string } {
  const key = source.toLowerCase().replace(/[\s-]+/g, '_');
  if (SOURCE_PILLS[key]) return SOURCE_PILLS[key];
  for (const [k, v] of Object.entries(SOURCE_PILLS)) {
    if (key.startsWith(k)) return v;
  }
  return { bg: '#F3F4F6', text: '#4B5563' };
}

const COLUMNS = ['Recruiter', 'Source', 'Platform', 'WP Visits', 'Apply Clicks', 'Signups', 'NDA', 'CVR'] as const;

export function RecruiterTable({ rows, selectedRecruiter, onRecruiterChange }: RecruiterTableProps) {
  const [showAll, setShowAll] = useState(false);

  const filtered = selectedRecruiter
    ? rows.filter(r => r.recruiterId === selectedRecruiter)
    : rows;

  const sorted = [...filtered].sort((a, b) => b.signups - a.signups);
  const visible = showAll ? sorted : sorted.slice(0, 8);
  const remaining = sorted.length - 8;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[10px] font-extrabold text-white"
             style={{ background: BRAND.amber }}>
          R
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
            Recruiter Self-Service — UTM Link Performance
          </h3>
          <span className="text-[10px]" style={{ color: BRAND.text3 }}>
            GA4 recruiter_id attribution · per-link funnel
          </span>
        </div>
        {selectedRecruiter && onRecruiterChange && (
          <button
            onClick={() => onRecruiterChange(null)}
            className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-black/[0.08] hover:bg-[#F6F7FB] transition-colors"
            style={{ color: BRAND.purple }}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F6F7FB] border-b border-black/[0.08]">
            {COLUMNS.map((h, i) => (
              <th key={h}
                  className={`px-4 py-2.5 text-[9px] uppercase tracking-[0.1em] font-semibold ${
                    i <= 2 ? 'text-left' : 'text-right'
                  }`}
                  style={{ color: BRAND.text3 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const pill = getSourcePill(row.source);
            const zeroNda = row.ndaSigned === 0;

            return (
              <tr key={`${row.recruiterId}-${row.source}`}
                  className="border-b border-black/[0.03] transition-colors hover:bg-[#FAFAFF] cursor-pointer"
                  onClick={() => onRecruiterChange?.(
                    selectedRecruiter === row.recruiterId ? null : row.recruiterId
                  )}>
                {/* Recruiter */}
                <td className="px-4 py-3">
                  <span className="text-[12px] font-semibold"
                        style={{ color: zeroNda ? BRAND.rose : BRAND.text }}>
                    {row.recruiterId}
                  </span>
                </td>

                {/* Source pill */}
                <td className="px-4 py-3">
                  <span className="inline-block text-[8px] font-bold px-[7px] py-[2px] rounded-[10px] uppercase tracking-[0.04em]"
                        style={{ background: pill.bg, color: pill.text }}>
                    {row.source}
                  </span>
                </td>

                {/* Platform */}
                <td className="px-4 py-3 text-[12px]" style={{ color: BRAND.text2 }}>
                  {row.platform}
                </td>

                {/* WP Visits */}
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: BRAND.text }}>
                  {row.wpVisits.toLocaleString()}
                </td>

                {/* Apply Clicks */}
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: BRAND.text }}>
                  {row.applyClicks.toLocaleString()}
                </td>

                {/* Signups */}
                <td className="px-4 py-3 text-right text-[12px] font-bold" style={{ color: BRAND.text }}>
                  {row.signups.toLocaleString()}
                </td>

                {/* NDA */}
                <td className="px-4 py-3 text-right text-[12px] font-bold"
                    style={{ color: zeroNda ? BRAND.rose : BRAND.text }}>
                  {row.ndaSigned}
                </td>

                {/* CVR */}
                <td className="px-4 py-3 text-right text-[12px] font-semibold"
                    style={{ color: row.cvr === 0 ? BRAND.rose : row.cvr > 5 ? BRAND.purple : BRAND.text2 }}>
                  {row.cvr.toFixed(1)}%
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-6 text-[12px]" style={{ color: BRAND.text3 }}>
                No recruiter UTM data available
              </td>
            </tr>
          )}
          {!showAll && remaining > 0 && (
            <tr>
              <td colSpan={8} className="text-center py-2.5 text-[12px]" style={{ color: BRAND.text3 }}>
                + {remaining} more recruiters ·{' '}
                <button onClick={() => setShowAll(true)} className="font-medium" style={{ color: BRAND.purple }}>
                  Show all →
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
