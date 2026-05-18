'use client';

import type { ProjectWithFunnel } from './types';
import { BRAND } from './types';
import { generateNarrative, ACTION_STYLES } from './utils';

interface NarrativePanelProps {
  projects: ProjectWithFunnel[];
  totalSpend: number;
  totalConversions: number;
  organicShare: number;
}

export function NarrativePanel({ projects, totalSpend, totalConversions, organicShare }: NarrativePanelProps) {
  const narrative = generateNarrative(projects, totalSpend, totalConversions, organicShare);

  const grouped: Record<string, string[]> = {
    increase: projects.filter(p => p.action === 'increase').map(p => p.codename),
    hold: projects.filter(p => p.action === 'hold').map(p => p.codename),
    fix: projects.filter(p => p.action === 'fix').map(p => p.codename),
    boost: projects.filter(p => p.action === 'boost').map(p => p.codename),
  };

  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-6"
         style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-6 h-6 rounded-[7px] flex items-center justify-center text-xs text-white"
             style={{ background: BRAND.grad }}>✦</div>
        <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>Weekly Intelligence Brief</h3>
        <span className="text-[10px] ml-auto" style={{ color: BRAND.text3 }}>AI-generated from unified funnel data</span>
      </div>
      <div className="text-sm leading-[1.8]" style={{ color: BRAND.text2 }}>{narrative}</div>
      <div className="mt-3.5 pt-3.5 border-t border-black/[0.06] flex gap-5 flex-wrap">
        {Object.entries(grouped).filter(([, names]) => names.length > 0).map(([action, names]) => {
          const style = ACTION_STYLES[action];
          return (
            <div key={action} className="flex items-center gap-1.5 text-xs">
              <span className="inline-block text-[9px] font-extrabold px-2 py-[2px] rounded-[10px] text-white uppercase"
                    style={{ background: style.bg }}>{style.label}</span>
              <span style={{ color: BRAND.text2 }}>{names.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
