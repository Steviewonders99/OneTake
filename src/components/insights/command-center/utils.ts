// src/components/insights/command-center/utils.ts
import type { ProjectWithFunnel } from './types';
import { BRAND } from './types';

export function formatEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(1)}K`;
  return `€${n.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDelta(pct: number | null): { text: string; color: string; arrow: string } {
  if (pct === null) return { text: '—', color: BRAND.text3, arrow: '' };
  if (pct > 1) return { text: `${Math.round(pct)}%`, color: BRAND.blue, arrow: '↑' };
  if (pct < -1) return { text: `${Math.abs(Math.round(pct))}%`, color: BRAND.rose, arrow: '↓' };
  return { text: '0%', color: BRAND.amber, arrow: '→' };
}

export function computeAction(wow: { conversions?: number | null; cpa_direction?: string | null } | null, cpa: number | null, breakeven: number | null): 'increase' | 'hold' | 'fix' | 'boost' {
  if (!wow) return 'hold';
  const convDelta = wow.conversions ?? 0;
  if (cpa !== null && breakeven !== null && cpa > breakeven) return 'fix';
  if (convDelta > 10) return 'increase';
  if (convDelta < -10) return 'fix';
  if (wow.cpa_direction === 'down' && convDelta > 0) return 'boost';
  return 'hold';
}

export const ACTION_STYLES: Record<string, { bg: string; label: string }> = {
  increase: { bg: BRAND.blue, label: 'Increase' },
  hold: { bg: BRAND.amber, label: 'Hold' },
  fix: { bg: BRAND.rose, label: 'Fix' },
  boost: { bg: BRAND.purple, label: 'Boost' },
};

export function generateNarrative(projects: ProjectWithFunnel[], totalSpend: number, totalConversions: number, organicShare: number): string {
  const sorted = [...projects].sort((a, b) => (b.weekly?.[0]?.total_conversions ?? 0) - (a.weekly?.[0]?.total_conversions ?? 0));
  const best = sorted[0];
  const worst = sorted.filter(p => p.action === 'fix')[0];

  let text = `Portfolio spend totaled ${formatEur(totalSpend)} this week with ${totalConversions} total applications across ${projects.length} projects. `;

  if (best) {
    const cpa = best.weekly?.[0]?.blended_cpa;
    const conv = best.weekly?.[0]?.total_conversions ?? 0;
    const wow = best.wow?.conversions;
    const wowText = wow && wow > 0 ? `, ${Math.round(wow)}% WoW improvement` : '';
    text += `${cap(best.codename)} leads the portfolio${cpa ? ` — ${formatEur(cpa)} CPA with ${conv} applications${wowText}` : ''}. `;
  }

  if (worst) {
    const cpa = worst.weekly?.[0]?.blended_cpa;
    const wow = worst.wow?.conversions;
    text += `${cap(worst.codename)} ${wow && wow < 0 ? `declined ${Math.abs(Math.round(wow))}%` : 'needs attention'}${cpa ? ` at ${formatEur(cpa)} CPA` : ''}. `;
  }

  if (organicShare > 50) {
    text += `The standout trend: organic channels now deliver ${Math.round(organicShare)}% of all applications at zero ad spend.`;
  }

  return text;
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
