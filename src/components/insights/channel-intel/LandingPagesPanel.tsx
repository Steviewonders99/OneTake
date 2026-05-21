'use client';

import { BRAND } from '../command-center/types';

interface LandingPage {
  pagePath: string;
  displayName: string;
  sessions: number;
  conversions: number;
  convRate: number;
}

interface LandingPagesPanelProps {
  pages: LandingPage[];
}

export function LandingPagesPanel({ pages }: LandingPagesPanelProps) {
  const sorted = [...pages]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[10px] font-extrabold text-white"
          style={{ background: BRAND.purple }}
        >
          P
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
            Top Landing Pages
          </h3>
          <span className="text-[10px]" style={{ color: BRAND.text3 }}>
            Google Search Console
          </span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F6F7FB] border-b border-black/[0.08]">
            {['Page', 'Sessions', 'Conversions', 'CVR'].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2.5 text-[9px] uppercase tracking-[0.1em] font-semibold ${
                  i === 0 ? 'text-left' : 'text-right'
                }`}
                style={{ color: BRAND.text3 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((page) => (
            <tr
              key={page.pagePath}
              className="border-b border-black/[0.03] transition-colors hover:bg-[#FAFAFF]"
            >
              <td className="px-4 py-2.5">
                <div
                  className="text-[12px] font-semibold"
                  style={{ color: BRAND.text }}
                >
                  {page.displayName}
                </div>
                <div
                  className="text-[10px]"
                  style={{ color: BRAND.text3 }}
                >
                  {page.pagePath}
                </div>
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px]"
                style={{ color: BRAND.text }}
              >
                {page.sessions.toLocaleString()}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px] font-bold"
                style={{ color: BRAND.purple }}
              >
                {page.conversions.toLocaleString()}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px]"
                style={{ color: BRAND.text2 }}
              >
                {page.convRate.toFixed(1)}%
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="text-center py-6 text-[12px]"
                style={{ color: BRAND.text3 }}
              >
                No landing page data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
