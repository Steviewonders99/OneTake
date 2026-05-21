'use client';

import { useState } from 'react';
import { BRAND } from '../command-center/types';

interface CountryRow {
  country: string;
  page_views: number;
  apply_clicks: number;
  applications: number;
}

type SortKey = 'country' | 'page_views' | 'apply_clicks' | 'applications' | 'click_rate' | 'conv_rate';

export function CountryTable({ countries }: { countries: CountryRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('page_views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const searched = search
    ? countries.filter(c => c.country.toLowerCase().includes(search.toLowerCase()))
    : countries;

  const sorted = [...searched].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'country': return dir * a.country.localeCompare(b.country);
      case 'page_views': return dir * (a.page_views - b.page_views);
      case 'apply_clicks': return dir * (a.apply_clicks - b.apply_clicks);
      case 'applications': return dir * (a.applications - b.applications);
      case 'click_rate':
        return dir * ((a.page_views > 0 ? a.apply_clicks / a.page_views : 0) - (b.page_views > 0 ? b.apply_clicks / b.page_views : 0));
      case 'conv_rate':
        return dir * ((a.apply_clicks > 0 ? a.applications / a.apply_clicks : 0) - (b.apply_clicks > 0 ? b.applications / b.apply_clicks : 0));
      default: return 0;
    }
  });

  const visible = showAll ? sorted : sorted.slice(0, 5);
  const remaining = sorted.length - 5;

  const cols: { label: string; key: SortKey }[] = [
    { label: 'Country', key: 'country' },
    { label: 'Page Views', key: 'page_views' },
    { label: 'Apply Clicks', key: 'apply_clicks' },
    { label: 'Applications', key: 'applications' },
    { label: 'Click Rate', key: 'click_rate' },
    { label: 'Conv Rate', key: 'conv_rate' },
  ];

  return (
    <div>
      {countries.length > 5 && (
        <div className="mb-3">
          <input type="text" placeholder="Filter countries..." value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="px-3 py-1.5 border rounded-lg text-[12px] bg-white w-48"
                 style={{ color: BRAND.text, borderColor: BRAND.border }} />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-black/[0.06]">
        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BRAND.bgRaised }}>
              {cols.map(col => (
                <th key={col.label}
                    className="text-[9px] uppercase tracking-[0.1em] font-semibold px-3 py-2.5 cursor-pointer hover:text-[#4B5563]"
                    style={{ color: sortBy === col.key ? BRAND.purple : BRAND.text3 }}
                    onClick={() => toggleSort(col.key)}>
                  {col.label}
                  {sortBy === col.key && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </th>
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
      {showAll && sorted.length > 5 && (
        <div className="text-center py-2.5 border-t border-black/[0.04]">
          <button onClick={() => setShowAll(false)}
                  className="text-[12px] font-medium" style={{ color: BRAND.text3 }}>
            Collapse
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
