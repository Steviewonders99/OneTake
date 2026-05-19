'use client';

import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';

interface CampaignRow {
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
}

interface CampaignTableProps {
  campaigns: CampaignRow[];
}

function getVerdict(cpa: number | null, conversions: number): { label: string; bg: string } {
  if (conversions === 0) return { label: 'PAUSE', bg: '#6B7280' };
  if (cpa !== null && cpa < 10) return { label: 'SCALE', bg: BRAND.blue };
  if (cpa !== null && cpa < 50) return { label: 'HOLD', bg: BRAND.amber };
  return { label: 'KILL', bg: BRAND.rose };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const COLUMNS = ['Campaign', 'Spend', 'Impressions', 'Clicks', 'Conversions', 'CPA', 'Verdict'] as const;

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const sorted = [...campaigns].sort((a, b) => b.spend - a.spend);

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[10px] font-extrabold text-white"
             style={{ background: BRAND.blue }}>
          C
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
            Campaign Performance
          </h3>
          <span className="text-[10px]" style={{ color: BRAND.text3 }}>
            Meta Marketing API
          </span>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F6F7FB] border-b border-black/[0.08]">
            {COLUMNS.map((h, i) => (
              <th key={h}
                  className={`px-4 py-2.5 text-[9px] uppercase tracking-[0.1em] font-semibold ${
                    i === 0 ? 'text-left' : i === 6 ? 'text-center' : 'text-right'
                  }`}
                  style={{ color: BRAND.text3 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const verdict = getVerdict(c.cpa, c.conversions);
            const cpaColor = c.cpa === null
              ? BRAND.text3
              : c.cpa < 10
                ? BRAND.blue
                : c.cpa >= 50
                  ? BRAND.rose
                  : BRAND.text;

            return (
              <tr key={c.campaignName}
                  className="border-b border-black/[0.03] transition-colors hover:bg-[#FAFAFF]">
                {/* Campaign */}
                <td className="px-4 py-3">
                  <div className="text-[12px] font-semibold" style={{ color: BRAND.text }}>
                    {c.campaignName}
                  </div>
                </td>

                {/* Spend */}
                <td className="px-4 py-3 text-right text-[12px] font-semibold"
                    style={{ color: c.spend > 0 ? BRAND.text : BRAND.text3 }}>
                  {c.spend > 0 ? formatEur(c.spend) : '--'}
                </td>

                {/* Impressions */}
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: BRAND.text2 }}>
                  {formatCompact(c.impressions)}
                </td>

                {/* Clicks */}
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: BRAND.text }}>
                  {c.clicks.toLocaleString()}
                </td>

                {/* Conversions */}
                <td className="px-4 py-3 text-right text-[13px] font-bold" style={{ color: BRAND.text }}>
                  {c.conversions}
                </td>

                {/* CPA */}
                <td className="px-4 py-3 text-right text-[12px] font-semibold"
                    style={{ color: cpaColor, fontStyle: c.cpa === null ? 'italic' : 'normal' }}>
                  {c.cpa !== null ? formatEur(c.cpa) : '--'}
                </td>

                {/* Verdict badge */}
                <td className="px-4 py-3 text-center">
                  <span className="inline-block text-[8px] font-extrabold px-2.5 py-[3px] rounded-[10px] text-white uppercase tracking-[0.04em]"
                        style={{ background: verdict.bg }}>
                    {verdict.label}
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-6 text-[12px]" style={{ color: BRAND.text3 }}>
                No campaign data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
