'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';

interface CountryRow {
  country: string;
  page_views: number;
  apply_clicks: number;
  applications: number;
}

export function CountryTable({ countries }: { countries: CountryRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? countries : countries.slice(0, 5);
  const remaining = countries.length - 5;

  return (
    <div className="overflow-hidden rounded-xl border border-black/[0.06]">
      <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: BRAND.bgRaised }}>
            {['Country', 'Page Views', 'Apply Clicks', 'Applications', 'Click Rate', 'Conv Rate'].map(h => (
              <th key={h} className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2.5"
                  style={{ color: BRAND.text3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => {
            const clickRate = row.page_views > 0 ? (row.apply_clicks / row.page_views * 100) : 0;
            const convRate = row.apply_clicks > 0 ? (row.applications / row.apply_clicks * 100) : 0;
            return (
              <tr key={row.country} className="border-t border-black/[0.04]"
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                <td className="px-3 py-2.5 text-[12px] font-medium" style={{ color: BRAND.text }}>
                  {row.country}
                </td>
                <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                  {row.page_views.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: BRAND.text }}>
                  {row.apply_clicks.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: BRAND.text }}>
                  {row.applications.toLocaleString()}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                        style={{ color: clickRate > 20 ? BRAND.purple : BRAND.text2,
                                 background: clickRate > 20 ? '#F5F3FF' : 'transparent' }}>
                    {clickRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {convRate > 0 ? (
                    <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                          style={{ color: convRate > 5 ? BRAND.blue : BRAND.text2,
                                   background: convRate > 5 ? '#EFF6FF' : 'transparent' }}>
                      {convRate.toFixed(1)}%
                    </span>
                  ) : <span className="text-[10px]" style={{ color: BRAND.text3 }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!showAll && remaining > 0 && (
        <div className="text-center py-2.5 border-t border-black/[0.04]">
          <button onClick={() => setShowAll(true)}
                  className="text-[12px] font-medium" style={{ color: BRAND.purple }}>
            + {remaining} more countries · Show all
          </button>
        </div>
      )}
      {showAll && countries.length > 5 && (
        <div className="text-center py-2.5 border-t border-black/[0.04]">
          <button onClick={() => setShowAll(false)}
                  className="text-[12px] font-medium" style={{ color: BRAND.text3 }}>
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}
