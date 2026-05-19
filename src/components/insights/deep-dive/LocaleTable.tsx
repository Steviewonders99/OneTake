'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';

interface LocaleLink {
  language: string;
  apply_url: string;
  platform_request_id: string | null;
  is_active: boolean;
}

interface LocaleTableProps {
  locales: LocaleLink[];
}

export function LocaleTable({ locales }: LocaleTableProps) {
  const [showAll, setShowAll] = useState(false);
  const active = locales.filter(l => l.is_active);
  const visible = showAll ? active : active.slice(0, 5);
  const remaining = active.length - 5;

  if (active.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-5 py-3.5 border-b border-black/[0.04] flex justify-between items-center">
        <div className="text-[13px] font-bold" style={{ color: BRAND.text }}>
          Locale Performance — {active.length} active languages
        </div>
        <div className="text-[10px]" style={{ color: BRAND.text3 }}>Platform requestIDs mapped · GA4 attribution ready</div>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#F6F7FB]">
            <th className="text-left px-4 py-2 text-[9px] uppercase tracking-[0.08em] font-semibold" style={{ color: BRAND.text3 }}>Language</th>
            <th className="text-right px-4 py-2 text-[9px] uppercase tracking-[0.08em] font-semibold" style={{ color: BRAND.text3 }}>Request ID</th>
            <th className="text-center px-4 py-2 text-[9px] uppercase tracking-[0.08em] font-semibold" style={{ color: BRAND.text3 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(l => (
            <tr key={l.language} className="border-b border-black/[0.03]">
              <td className="px-4 py-2.5 font-medium" style={{ color: BRAND.text }}>{l.language}</td>
              <td className="px-4 py-2.5 text-right font-mono text-[10px]" style={{ color: BRAND.purple }}>
                {l.platform_request_id ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-[10px]"
                      style={{ background: '#EDE9FE', color: '#6D28D9' }}>
                  ACTIVE
                </span>
              </td>
            </tr>
          ))}
          {!showAll && remaining > 0 && (
            <tr>
              <td colSpan={3} className="text-center py-2 text-[11px]" style={{ color: BRAND.text3 }}>
                + {remaining} more locales ·{' '}
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
