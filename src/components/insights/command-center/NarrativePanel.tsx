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

  const getName = (p: ProjectWithFunnel) => {
    if (p.display_name) {
      const name = p.display_name.split('—')[0]?.trim();
      if (name && name.length > 0) return name;
    }
    return p.codename;
  };

  // Only show projects that have channel links (not the 38 organic ones with no data)
  const tracked = projects.filter(p => (p.channels ?? []).length > 0);
  const untracked = projects.filter(p => (p.channels ?? []).length === 0);

  const grouped: Record<string, string[]> = {
    increase: tracked.filter(p => p.action === 'increase').map(getName),
    hold: tracked.filter(p => p.action === 'hold').map(getName),
    fix: tracked.filter(p => p.action === 'fix').map(getName),
    boost: tracked.filter(p => p.action === 'boost').map(getName),
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
              <span style={{ color: BRAND.text2 }}>{names.join(', ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
