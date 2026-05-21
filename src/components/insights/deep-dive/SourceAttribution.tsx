'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';

/* ─── types ─────────────────────────────────────────────────────────── */

interface SourceRow {
  source: string;
  medium: string;
  utm_content?: string | null;
  utm_term?: string | null;
  wp_entry: number;
  apply_click: number;
  nda_signed: number;
  doing_tasks: number;
  cost: number;
}

interface SourceAttributionProps {
  sources: SourceRow[];
}

/* ─── channel icon + colour from source string ──────────────────────── */

const SOURCE_META: Record<string, { color: string; letter: string }> = {
  facebook:  { color: BRAND.blue,   letter: 'f' },
  meta:      { color: BRAND.blue,   letter: 'M' },
  instagram: { color: BRAND.rose,   letter: 'I' },
  linkedin:  { color: '#0A66C2',    letter: 'in' },
  indeed:    { color: BRAND.amber,  letter: 'Id' },
  glassdoor: { color: BRAND.amber,  letter: 'G' },
  monster:   { color: BRAND.amber,  letter: 'Mo' },
  email:     { color: BRAND.pink,   letter: '@' },
  brevo:     { color: BRAND.pink,   letter: 'B' },
  reddit:    { color: '#FF4500',    letter: 'R' },
  tiktok:    { color: BRAND.purple, letter: 'Tk' },
  google:    { color: BRAND.blue,   letter: 'G' },
  twitter:   { color: '#1DA1F2',    letter: 'X' },
  x:         { color: '#1DA1F2',    letter: 'X' },
};

function channelMeta(source: string, medium: string): { color: string; letter: string } {
  const src = source.toLowerCase();
  const med = medium.toLowerCase();

  for (const key of Object.keys(SOURCE_META)) {
    if (src.includes(key)) return SOURCE_META[key];
  }

  // medium-based fallback
  if (med === 'job_board' || med === 'jobboard') return { color: BRAND.amber, letter: 'J' };
  if (med === 'email')    return { color: BRAND.pink, letter: '@' };
  if (med === 'social' || med === 'organic') return { color: BRAND.purple, letter: 'S' };
  if (med === 'cpc' || med === 'paid' || med === 'paidsocial') return { color: BRAND.blue, letter: '$' };
  if (med === 'referral') return { color: BRAND.rose, letter: 'R' };

  return { color: BRAND.text3, letter: src.charAt(0).toUpperCase() };
}

/* ─── component ─────────────────────────────────────────────────────── */

type SortKey = 'source' | 'views' | 'apply' | 'apps' | 'rate' | 'cost' | 'cpa';

export function SourceAttribution({ sources }: SourceAttributionProps) {
  const [sortBy, setSortBy] = useState<SortKey>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  if (!sources || sources.length === 0) return null;

  const sorted = [...sources].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'source': return dir * a.source.localeCompare(b.source);
      case 'views': return dir * (a.wp_entry - b.wp_entry);
      case 'apply': return dir * (a.apply_click - b.apply_click);
      case 'apps': return dir * (a.nda_signed - b.nda_signed);
      case 'rate': return dir * ((a.wp_entry > 0 ? a.nda_signed / a.wp_entry : 0) - (b.wp_entry > 0 ? b.nda_signed / b.wp_entry : 0));
      case 'cost': return dir * (a.cost - b.cost);
      case 'cpa': return dir * ((a.nda_signed > 0 ? a.cost / a.nda_signed : 999999) - (b.nda_signed > 0 ? b.cost / b.nda_signed : 999999));
      default: return 0;
    }
  });

  // Totals
  const totals = sorted.reduce(
    (acc, r) => ({
      wp_entry: acc.wp_entry + r.wp_entry,
      apply_click: acc.apply_click + r.apply_click,
      nda_signed: acc.nda_signed + r.nda_signed,
      doing_tasks: acc.doing_tasks + r.doing_tasks,
      cost: acc.cost + r.cost,
    }),
    { wp_entry: 0, apply_click: 0, nda_signed: 0, doing_tasks: 0, cost: 0 },
  );

  // Best organic vs best paid for insight callout
  const organic = sorted.filter((r) => r.cost === 0 && r.doing_tasks > 0);
  const paid = sorted.filter((r) => r.cost > 0 && r.doing_tasks > 0);
  const bestOrganic = organic.sort((a, b) => b.doing_tasks - a.doing_tasks)[0] ?? null;
  const bestPaid = paid.sort((a, b) => {
    const aCPW = a.doing_tasks > 0 ? a.cost / a.doing_tasks : Infinity;
    const bCPW = b.doing_tasks > 0 ? b.cost / b.doing_tasks : Infinity;
    return aCPW - bCPW;
  })[0] ?? null;

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
            background: BRAND.purple,
          }}
        >
          3
        </div>
        <div>
          <div className="text-sm font-bold leading-tight" style={{ color: BRAND.text }}>
            Channel-Level Funnel Comparison
          </div>
        </div>
      </div>

      {/* ── table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-black/[0.06]">
        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BRAND.bgRaised }}>
              {([
                { label: 'Channel', key: 'source' as SortKey },
                { label: 'Detail', key: null },
                { label: 'Page Views', key: 'views' as SortKey },
                { label: 'Apply Clicks', key: 'apply' as SortKey },
                { label: 'Applications', key: 'apps' as SortKey },
                { label: 'Entry→App', key: 'rate' as SortKey },
                { label: 'Cost', key: 'cost' as SortKey },
                { label: 'CPA', key: 'cpa' as SortKey },
              ]).map(col => (
                <th key={col.label}
                    className={`text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2.5 ${col.key ? 'cursor-pointer hover:text-[#4B5563]' : ''}`}
                    style={{ color: sortBy === col.key ? BRAND.purple : BRAND.text3 }}
                    onClick={() => col.key && toggleSort(col.key)}>
                  {col.label}
                  {sortBy === col.key && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const meta = channelMeta(row.source, row.medium);
              const ndaRate = row.wp_entry > 0 ? (row.nda_signed / row.wp_entry) * 100 : 0;
              const costPerWorker = row.doing_tasks > 0 ? row.cost / row.doing_tasks : null;
              const isOrganic = row.cost === 0;

              return (
                <tr
                  key={`${row.source}-${row.medium}`}
                  className="border-t border-black/[0.04]"
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}
                >
                  {/* Channel with icon */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center font-bold text-white shrink-0"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          background: meta.color,
                          fontSize: meta.letter.length > 1 ? 7 : 9,
                          lineHeight: 1,
                        }}
                      >
                        {meta.letter}
                      </div>
                      <div>
                        <span className="text-[11px] font-medium" style={{ color: BRAND.text }}>
                          {row.source}
                        </span>
                        <span className="text-[10px] ml-1" style={{ color: BRAND.text3 }}>
                          / {row.medium}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* UTM Detail (content = job board name, term = recruiter ID) */}
                  <td className="px-3 py-2.5">
                    {(row.utm_content || row.utm_term) ? (
                      <div className="flex flex-col gap-0.5">
                        {row.utm_content && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EDE9FE] inline-block w-fit"
                                style={{ color: BRAND.purple }}>
                            {row.utm_content}
                          </span>
                        )}
                        {row.utm_term && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FEF3C7] inline-block w-fit"
                                style={{ color: '#92400E' }}>
                            {row.utm_term}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: BRAND.text3 }}>—</span>
                    )}
                  </td>

                  {/* Entry */}
                  <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                    {row.wp_entry.toLocaleString()}
                  </td>

                  {/* Apply */}
                  <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                    {row.apply_click.toLocaleString()}
                  </td>

                  {/* Applications */}
                  <td className="px-3 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: BRAND.text }}>
                    {row.nda_signed.toLocaleString()}
                  </td>

                  {/* Entry→App rate */}
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                      style={{
                        color: ndaRate > 5 ? BRAND.purple : BRAND.text2,
                        background: ndaRate > 5 ? '#F5F3FF' : 'transparent',
                      }}
                    >
                      {ndaRate.toFixed(1)}%
                    </span>
                  </td>

                  {/* Cost */}
                  <td className="px-3 py-2.5">
                    {isOrganic ? (
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: BRAND.blue, background: '#EFF6FF' }}
                      >
                        {'\u20AC'}0
                      </span>
                    ) : (
                      <span className="text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                        {formatEur(row.cost)}
                      </span>
                    )}
                  </td>

                  {/* CPA */}
                  <td className="px-3 py-2.5">
                    {isOrganic ? (
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: BRAND.blue, background: '#EFF6FF' }}
                      >
                        {'\u20AC'}0
                      </span>
                    ) : row.nda_signed > 0 ? (
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: BRAND.blue }}>
                        {formatEur(row.cost / row.nda_signed)}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: BRAND.text3 }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* totals */}
          <tfoot>
            <tr className="border-t-2 border-black/[0.08]" style={{ background: BRAND.bgRaised }}>
              <td className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: BRAND.text2 }}>
                All Channels
              </td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                {totals.wp_entry.toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                {totals.apply_click.toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.purple }}>
                {totals.nda_signed.toLocaleString()}
              </td>
              <td className="px-3 py-2.5">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: BRAND.text2 }}>
                  {totals.wp_entry > 0 ? ((totals.nda_signed / totals.wp_entry) * 100).toFixed(1) : '0'}%
                </span>
              </td>
              <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.text }}>
                {formatEur(totals.cost)}
              </td>
              <td className="px-3 py-2.5 text-[12px] font-extrabold tabular-nums" style={{ color: BRAND.blue }}>
                {totals.nda_signed > 0 ? formatEur(totals.cost / totals.nda_signed) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── insight callout ────────────────────────────────────────── */}
      {(bestOrganic || bestPaid) && (
        <div
          className="mt-4 px-4 py-3 rounded-lg text-[11px] leading-relaxed"
          style={{
            background: '#EFF6FF',
            borderLeft: `3px solid ${BRAND.blue}`,
            color: BRAND.text2,
          }}
        >
          <span className="font-bold" style={{ color: BRAND.text }}>
            Insight:
          </span>{' '}
          {bestOrganic && (
            <>
              <span className="font-semibold" style={{ color: BRAND.purple }}>
                {bestOrganic.source}/{bestOrganic.medium}
              </span>{' '}
              delivered {bestOrganic.doing_tasks} active worker{bestOrganic.doing_tasks !== 1 ? 's' : ''} at{' '}
              <span className="font-bold" style={{ color: BRAND.blue }}>{'\u20AC'}0 cost</span>
              {bestPaid ? '. ' : '.'}
            </>
          )}
          {bestPaid && bestPaid.doing_tasks > 0 && (
            <>
              Best paid channel{' '}
              <span className="font-semibold" style={{ color: BRAND.blue }}>
                {bestPaid.source}/{bestPaid.medium}
              </span>{' '}
              costs{' '}
              <span className="font-bold" style={{ color: BRAND.blue }}>
                {formatEur(bestPaid.cost / bestPaid.doing_tasks)}
              </span>{' '}
              per worker.
              {bestOrganic && bestOrganic.doing_tasks > 0 && bestPaid.doing_tasks > 0 && (
                <span>
                  {' '}Organic outperforms paid by{' '}
                  <span className="font-bold" style={{ color: BRAND.purple }}>
                    {formatEur(bestPaid.cost / bestPaid.doing_tasks)}/worker
                  </span>{' '}
                  in cost efficiency.
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
