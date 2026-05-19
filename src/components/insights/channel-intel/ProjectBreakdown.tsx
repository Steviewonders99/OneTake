'use client';

import { BRAND, PILL_CLASSES } from '../command-center/types';

interface ProjectRow {
  codename: string;
  displayName: string;
  sessions: number;
  users: number;
  conversions: number;
  convRate: number;
  topKeyword?: string;
}

interface ProjectBreakdownProps {
  projects: ProjectRow[];
  channelLabel: string;
}

export function ProjectBreakdown({ projects, channelLabel }: ProjectBreakdownProps) {
  const sorted = [...projects].sort((a, b) => b.conversions - a.conversions);

  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[10px] font-extrabold text-white"
          style={{ background: BRAND.gradCool }}
        >
          A
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
            Project Breakdown — <span style={{ color: BRAND.purple }}>{channelLabel}</span> by project
          </h3>
          <span className="text-[10px]" style={{ color: BRAND.text3 }}>
            Which projects get traffic from this channel?
          </span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F6F7FB] border-b border-black/[0.08]">
            {['Project', 'Sessions', 'Users', 'Conversions', 'CVR', 'Top Keyword'].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2.5 text-[9px] uppercase tracking-[0.1em] font-semibold ${
                  i === 0 || i === 5 ? 'text-left' : 'text-right'
                }`}
                style={{ color: BRAND.text3 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((proj) => (
            <tr
              key={proj.codename}
              className="border-b border-black/[0.03] transition-colors hover:bg-[#FAFAFF]"
            >
              <td className="px-4 py-2.5">
                <div
                  className="text-[12px] font-semibold"
                  style={{ color: BRAND.text }}
                >
                  {proj.codename}
                </div>
                <div
                  className="text-[10px]"
                  style={{ color: BRAND.text3 }}
                >
                  {proj.displayName}
                </div>
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px]"
                style={{ color: BRAND.text }}
              >
                {proj.sessions.toLocaleString()}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px]"
                style={{ color: BRAND.text }}
              >
                {proj.users.toLocaleString()}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px] font-bold"
                style={{ color: BRAND.text }}
              >
                {proj.conversions.toLocaleString()}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[12px]"
                style={{ color: proj.convRate > 10 ? BRAND.purple : BRAND.text2 }}
              >
                {proj.convRate.toFixed(1)}%
              </td>
              <td
                className="px-4 py-2.5 text-left text-[11px]"
                style={{ color: BRAND.text3 }}
              >
                {proj.topKeyword ?? '—'}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="text-center py-6 text-[12px]"
                style={{ color: BRAND.text3 }}
              >
                No project data for this channel
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
