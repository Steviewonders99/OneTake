'use client';

import { BRAND } from '../command-center/types';

interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

interface FunnelWaterfallProps {
  stages: FunnelStage[];
}

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #0348B2, #2563EB)',
  'linear-gradient(135deg, #2563EB, #7C3AED)',
  'linear-gradient(135deg, #7C3AED, #9333EA)',
  'linear-gradient(135deg, #9333EA, #A855F7)',
  'linear-gradient(135deg, #A855F7, #DB2777)',
  'linear-gradient(135deg, #DB2777, #E11D48)',
  'linear-gradient(135deg, #6366F1, #818CF8)',
  'linear-gradient(135deg, #818CF8, #A78BFA)',
  'linear-gradient(135deg, #0348B2, #2563EB)',
];

export function FunnelWaterfall({ stages }: FunnelWaterfallProps) {
  if (stages.length === 0) return null;
  const maxVal = stages[0].value;

  // Identify major drops (>50% stage-over-stage)
  const drops: { from: string; to: string; pct: number; idx: number }[] = [];
  for (let i = 1; i < stages.length; i++) {
    if (stages[i - 1].value > 0) {
      const dropPct = (1 - stages[i].value / stages[i - 1].value) * 100;
      if (dropPct > 50) {
        drops.push({ from: stages[i - 1].label, to: stages[i].label, pct: Math.round(dropPct), idx: i });
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-6 mb-5"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="text-sm font-bold mb-4" style={{ color: BRAND.text }}>
        Acquisition Funnel — Full Journey
      </div>

      <div className="flex flex-col gap-2">
        {stages.map((stage, i) => {
          const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
          const widthPct = Math.max(pct, 3); // min 3% for visibility
          const pctOfTotal = maxVal > 0 ? ((stage.value / maxVal) * 100).toFixed(1) : '0';
          const gradient = GRADIENT_COLORS[i % GRADIENT_COLORS.length];

          return (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="w-[110px] text-right text-[11px] font-medium shrink-0"
                   style={{ color: BRAND.text2 }}>
                {stage.label}
              </div>
              <div className="flex-1 h-7 rounded-md relative" style={{ background: BRAND.bgRaised }}>
                <div
                  className="h-full rounded-md flex items-center px-2.5 transition-all duration-500"
                  style={{ width: `${widthPct}%`, background: gradient, minWidth: '50px' }}
                >
                  <span className="text-[11px] font-bold text-white whitespace-nowrap">
                    {stage.value.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-[50px] text-right text-[10px] shrink-0"
                   style={{ color: pct < 2 ? BRAND.rose : BRAND.text3, fontWeight: pct < 2 ? 600 : 400 }}>
                {pctOfTotal}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Drop-off callouts */}
      {drops.length > 0 && (
        <div className="flex gap-2.5 mt-3.5 flex-wrap">
          {drops.map(d => (
            <div key={d.idx}
                 className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                 style={{ background: d.pct > 80 ? '#FEF2F2' : '#FFF7ED', color: d.pct > 80 ? '#991B1B' : '#92400E' }}>
              ⚠ {d.from}→{d.to}: {d.pct}% drop
            </div>
          ))}
          {stages.length > 2 && stages[1].value > 0 && (
            <div className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                 style={{ background: '#EFF6FF', color: '#1E40AF' }}>
              ✓ End-to-end: {maxVal > 0 ? ((stages[stages.length - 1].value / maxVal) * 100).toFixed(1) : 0}% of entries → final stage
            </div>
          )}
        </div>
      )}
    </div>
  );
}
