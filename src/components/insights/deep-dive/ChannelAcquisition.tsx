'use client';

import { BRAND } from '../command-center/types';

/* ─── types ─────────────────────────────────────────────────────────── */

interface SourceRow {
  source: string;
  medium: string;
  wp_entry: number;
  apply_click: number;
  nda_signed: number;
  doing_tasks: number;
}

interface ChannelAcquisitionProps {
  sources: SourceRow[];
}

/* ─── colour mapping ────────────────────────────────────────────────── */

const MEDIUM_COLOR: Record<string, string> = {
  cpc:        BRAND.blue,
  paid:       BRAND.blue,
  paidsocial: BRAND.blue,
  social:     BRAND.purple,
  organic:    BRAND.purple,
  job_board:  BRAND.amber,
  email:      BRAND.pink,
  referral:   BRAND.rose,
};

function barColor(medium: string): string {
  const key = medium.toLowerCase().replace(/[\s-]/g, '');
  return MEDIUM_COLOR[key] ?? BRAND.purple;
}

/* ─── component ─────────────────────────────────────────────────────── */

export function ChannelAcquisition({ sources }: ChannelAcquisitionProps) {
  if (!sources || sources.length === 0) return null;

  const sorted = [...sources].sort((a, b) => b.wp_entry - a.wp_entry);
  const maxEntry = sorted[0]?.wp_entry ?? 1;
  const totalEntry = sorted.reduce((s, r) => s + r.wp_entry, 0);
  const totalNda = sorted.reduce((s, r) => s + r.nda_signed, 0);
  const totalWorkers = sorted.reduce((s, r) => s + r.doing_tasks, 0);

  return (
    <div
      className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        fontFamily: "'Roboto', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-5">
        <div
          className="flex items-center justify-center font-bold text-white text-[10px]"
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: BRAND.blue,
          }}
        >
          1
        </div>
        <div>
          <div className="text-sm font-bold leading-tight" style={{ color: BRAND.text }}>
            How People Found This Project
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>
            GA4 first-touch attribution
          </div>
        </div>
      </div>

      {/* ── body: bars + table ─────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* LEFT — horizontal bars */}
        <div className="flex flex-col gap-[7px]">
          {sorted.map((row) => {
            const pct = totalEntry > 0 ? (row.wp_entry / totalEntry) * 100 : 0;
            const widthPct = maxEntry > 0 ? Math.max((row.wp_entry / maxEntry) * 100, 4) : 4;
            const color = barColor(row.medium);

            return (
              <div key={`${row.source}-${row.medium}`} className="flex items-center gap-2">
                {/* label */}
                <div
                  className="w-[80px] text-right text-[11px] font-medium shrink-0 truncate"
                  style={{ color: BRAND.text2 }}
                  title={`${row.source} / ${row.medium}`}
                >
                  {row.source}
                </div>

                {/* bar */}
                <div className="flex-1 h-[26px] rounded-md relative" style={{ background: BRAND.bgRaised }}>
                  <div
                    className="h-full rounded-md flex items-center justify-end px-2 transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      background: color,
                      minWidth: 52,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                      {row.wp_entry.toLocaleString()}{' '}
                      <span className="font-normal opacity-80">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT — UTM attribution table */}
        <div className="overflow-hidden rounded-xl border border-black/[0.06]">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: BRAND.bgRaised }}>
                {['Source / Medium', 'WP Entry', 'NDA', 'Workers'].map((h) => (
                  <th
                    key={h}
                    className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2"
                    style={{ color: BRAND.text3 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={`${row.source}-${row.medium}-tbl`}
                  className="border-t border-black/[0.04]"
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}
                >
                  <td className="px-3 py-2">
                    <span className="text-[11px] font-medium" style={{ color: BRAND.text2 }}>
                      {row.source}
                    </span>
                    <span className="text-[10px] ml-1" style={{ color: BRAND.text3 }}>
                      / {row.medium}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                    {row.wp_entry.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-bold tabular-nums" style={{ color: BRAND.text }}>
                    {row.nda_signed.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                    {row.doing_tasks.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* totals row */}
            <tfoot>
              <tr className="border-t-2 border-black/[0.08]" style={{ background: BRAND.bgRaised }}>
                <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: BRAND.text2 }}>
                  Total
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                  {totalEntry.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.purple }}>
                  {totalNda.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.blue }}>
                  {totalWorkers.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── recruiter note ─────────────────────────────────────────── */}
      <div
        className="mt-4 px-3.5 py-2.5 rounded-lg text-[10px] leading-relaxed"
        style={{ background: '#FDF2F8', color: '#9D174D' }}
      >
        <span className="font-bold">Recruiter note:</span>{' '}
        Recruiter-referred traffic is tagged <code className="text-[9px] px-1 py-0.5 rounded bg-white/60 font-mono">utm_medium=recruiter</code>.
        If no recruiter rows appear above, the project relies entirely on paid + organic acquisition.
      </div>
    </div>
  );
}
