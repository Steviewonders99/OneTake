'use client';

import { BRAND, CHANNEL_COLORS } from '../command-center/types';

interface SourceRow {
  source: string;
  medium: string;
  nda_signed: number;
  doing_tasks: number;
}

interface SourceBreakdownProps {
  sources: SourceRow[];
}

export function SourceBreakdown({ sources }: SourceBreakdownProps) {
  const totalNda = sources.reduce((s, r) => s + (r.nda_signed || 0), 0);

  const colors = ['#2563EB', '#7C3AED', '#DB2777', '#6366F1', '#9333EA', '#A855F7'];

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="text-[13px] font-bold mb-3" style={{ color: BRAND.text }}>NDA Signed by Source</div>
      <div className="flex flex-col gap-2">
        {sources.filter(s => s.nda_signed > 0).map((s, i) => {
          const pct = totalNda > 0 ? ((s.nda_signed / totalNda) * 100).toFixed(1) : '0';
          const color = colors[i % colors.length];
          return (
            <div key={`${s.source}-${s.medium}`}
                 className="flex justify-between items-center py-2 border-b border-black/[0.04] last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                <span className="text-[12px]" style={{ color: BRAND.text2 }}>
                  {s.source} / {s.medium}
                </span>
              </div>
              <div>
                <span className="text-sm font-bold" style={{ color: BRAND.text }}>{s.nda_signed.toLocaleString()}</span>
                <span className="text-[10px] ml-1.5" style={{ color: BRAND.text3 }}>{pct}%</span>
                {s.doing_tasks > 0 && (
                  <span className="text-[9px] ml-2 px-1.5 py-0.5 rounded" style={{ background: '#EDE9FE', color: '#6D28D9' }}>
                    {s.doing_tasks} working
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
