'use client';

import { BRAND } from '../command-center/types';

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

const MEDIUM_COLOR: Record<string, string> = {
  cpc: BRAND.blue, paid: BRAND.blue, paidsocial: BRAND.blue,
  social: BRAND.purple, organic: BRAND.purple,
  job_board: BRAND.amber, email: BRAND.pink, referral: BRAND.rose,
  flyer: '#A855F7', '(none)': '#6B7280',
};

// Clean display name for source
function displaySource(source: string): string {
  const map: Record<string, string> = {
    'facebook': 'Facebook', 'google': 'Google', '(direct)': 'Direct',
    'social': 'Social', 'bing': 'Bing', 'paid_media': 'Paid Media',
    'chatgpt.com': 'ChatGPT', 'brevo': 'Brevo Email',
    'oneforma.com': 'OneForma', 'Flyers': 'Flyers', 'job_board': 'Job Board',
    't.co': 'Twitter/X', 'linkedin.com': 'LinkedIn', 'LinkedIn': 'LinkedIn',
    'Handshake': 'Handshake', 'youtube.com': 'YouTube',
    'gemini.google.com': 'Gemini', 'reddit.com': 'Reddit',
  };
  return map[source] ?? source;
}

function barColor(medium: string): string {
  return MEDIUM_COLOR[medium.toLowerCase().replace(/[\s-]/g, '')] ?? BRAND.purple;
}

export function ChannelAcquisition({ sources }: ChannelAcquisitionProps) {
  if (!sources || sources.length === 0) return null;

  const sorted = [...sources].sort((a, b) => b.wp_entry - a.wp_entry);
  const maxEntry = sorted[0]?.wp_entry ?? 1;
  const totalEntry = sorted.reduce((s, r) => s + r.wp_entry, 0);
  const totalApps = sorted.reduce((s, r) => s + r.nda_signed, 0);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: "'Roboto', system-ui, sans-serif" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center justify-center font-bold text-white text-[10px]"
             style={{ width: 20, height: 20, borderRadius: 5, background: BRAND.blue }}>1</div>
        <div>
          <div className="text-sm font-bold leading-tight" style={{ color: BRAND.text }}>
            How People Found This Project
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: BRAND.text3 }}>
            GA4 first-touch attribution · Unique users
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* LEFT — horizontal bars */}
        <div className="flex flex-col gap-[7px]">
          {sorted.map((row) => {
            const pct = totalEntry > 0 ? (row.wp_entry / totalEntry) * 100 : 0;
            const widthPct = maxEntry > 0 ? Math.max((row.wp_entry / maxEntry) * 100, 4) : 4;
            return (
              <div key={`${row.source}-${row.medium}`} className="flex items-center gap-2">
                <div className="w-[80px] text-right text-[11px] font-medium shrink-0 truncate"
                     style={{ color: BRAND.text2 }} title={`${row.source} / ${row.medium}`}>
                  {displaySource(row.source)}
                </div>
                <div className="flex-1 h-[26px] rounded-md relative" style={{ background: BRAND.bgRaised }}>
                  <div className="h-full rounded-md flex items-center justify-end px-2 transition-all duration-500"
                       style={{ width: `${widthPct}%`, background: barColor(row.medium), minWidth: 52 }}>
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

        {/* RIGHT — attribution table */}
        <div className="overflow-hidden rounded-xl border border-black/[0.06]">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: BRAND.bgRaised }}>
                {['Source / Medium', 'Page Views', 'Applications', 'CVR'].map((h) => (
                  <th key={h} className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2"
                      style={{ color: BRAND.text3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const cvr = row.wp_entry > 0 ? ((row.nda_signed / row.wp_entry) * 100) : 0;
                return (
                  <tr key={`${row.source}-${row.medium}-tbl`}
                      className="border-t border-black/[0.04]"
                      style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-medium" style={{ color: BRAND.text2 }}>
                        {displaySource(row.source)}
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
                    <td className="px-3 py-2">
                      {cvr > 0 ? (
                        <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                              style={{ color: cvr > 1 ? BRAND.purple : BRAND.text2, background: cvr > 1 ? '#F5F3FF' : 'transparent' }}>
                          {cvr.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: BRAND.text3 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/[0.08]" style={{ background: BRAND.bgRaised }}>
                <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: BRAND.text2 }}>
                  TOTAL
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                  {totalEntry.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.purple }}>
                  {totalApps.toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: BRAND.text2 }}>
                    {totalEntry > 0 ? ((totalApps / totalEntry) * 100).toFixed(1) : '0'}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
