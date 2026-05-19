'use client';

import { BRAND } from '../command-center/types';

interface KeywordRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCKeywordsPanelProps {
  keywords: KeywordRow[];
}

export function GSCKeywordsPanel({ keywords }: GSCKeywordsPanelProps) {
  if (keywords.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-5 py-3.5 border-b border-black/[0.04] flex justify-between items-center">
        <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: BRAND.text }}>
          <span className="w-5 h-5 rounded-[5px] inline-flex items-center justify-center text-[9px] font-extrabold text-white"
                style={{ background: BRAND.blue }}>G</span>
          Top Keywords
        </h3>
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: BRAND.text3 }}>
          Google Search Console
        </span>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#F6F7FB] border-b border-black/[0.08]">
            <th className="text-left px-3.5 py-2 text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: BRAND.text3 }}>Query</th>
            <th className="text-right px-3 py-2 text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: BRAND.text3 }}>Clicks</th>
            <th className="text-right px-3 py-2 text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: BRAND.text3 }}>Impressions</th>
            <th className="text-right px-3 py-2 text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: BRAND.text3 }}>CTR</th>
            <th className="text-right px-3.5 py-2 text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: BRAND.text3 }}>Position</th>
          </tr>
        </thead>
        <tbody>
          {keywords.slice(0, 10).map((kw, i) => (
            <tr key={kw.query} className="border-b border-black/[0.03] hover:bg-[#FAFAFF] transition-colors">
              <td className="px-3.5 py-2.5" style={{ fontWeight: i < 3 ? 600 : 400, color: i < 3 ? BRAND.text : BRAND.text2 }}>
                {kw.query}
              </td>
              <td className="text-right px-3 py-2.5" style={{ fontWeight: i < 3 ? 700 : 400 }}>
                {kw.clicks.toLocaleString()}
              </td>
              <td className="text-right px-3 py-2.5" style={{ color: BRAND.text3 }}>
                {kw.impressions >= 1000 ? `${(kw.impressions / 1000).toFixed(0)}K` : kw.impressions.toLocaleString()}
              </td>
              <td className="text-right px-3 py-2.5" style={{ color: kw.ctr > 10 ? BRAND.blue : BRAND.text2, fontWeight: kw.ctr > 10 ? 600 : 400 }}>
                {kw.ctr.toFixed(1)}%
              </td>
              <td className="text-right px-3.5 py-2.5">
                {kw.position.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
