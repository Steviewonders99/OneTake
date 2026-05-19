'use client';

import { useMemo } from 'react';
import type { ProjectWithFunnel } from '../command-center/types';
import { BRAND } from '../command-center/types';
import { formatEur } from '../command-center/utils';

/* ── Types ─────────────────────────────────────────────── */

interface ProjectBriefProps {
  project: ProjectWithFunnel;
  funnelTotals: Record<string, number>;
  funnelRates: Record<string, number>;
  sources: Array<{
    source: string;
    medium: string;
    nda_signed: number;
    doing_tasks: number;
    cost?: number;
  }>;
  localeCount: number;
}

/* ── Funnel stage ordering for drop-off analysis ───────── */

const FUNNEL_STAGES = [
  'wp_entry',
  'apply_click',
  'signup',
  'mfa_setup',
  'profile_created',
  'nda_signed',
  'certification',
  'browsing_jobs',
  'doing_tasks',
];

const STAGE_LABELS: Record<string, string> = {
  wp_entry: 'WP Entry',
  apply_click: 'Apply Click',
  signup: 'Signup',
  mfa_setup: 'MFA Setup',
  profile_created: 'Profile Created',
  nda_signed: 'NDA Signed',
  certification: 'Certification',
  browsing_jobs: 'Browsing Jobs',
  doing_tasks: 'Doing Tasks',
};

/* ── Badge colors ──────────────────────────────────────── */

const BADGE_COLORS = [BRAND.blue, BRAND.purple, BRAND.pink, BRAND.rose, BRAND.amber];

/* ── Component ─────────────────────────────────────────── */

export function ProjectBrief({
  project,
  funnelTotals,
  funnelRates,
  sources,
  localeCount,
}: ProjectBriefProps) {
  const insights = useMemo(() => {
    const lines: string[] = [];
    const actions: { label: string; color: string }[] = [];

    // --- 1. Headline ---
    const totalSpend = funnelTotals.total_spend ?? 0;
    const activeWorkers = funnelTotals.doing_tasks ?? 0;
    const costPerWorker = activeWorkers > 0 ? totalSpend / activeWorkers : null;
    const codename = project.codename.charAt(0).toUpperCase() + project.codename.slice(1);

    if (totalSpend > 0) {
      lines.push(
        `${codename} spent ${formatEur(totalSpend)} and produced ${activeWorkers} active worker${activeWorkers !== 1 ? 's' : ''}${
          costPerWorker !== null ? ` at ${formatEur(costPerWorker)} per worker` : ''
        }.`
      );
    } else {
      lines.push(
        `${codename} has generated ${activeWorkers} active worker${activeWorkers !== 1 ? 's' : ''} through organic channels.`
      );
    }

    // --- 2. Funnel efficiency ---
    const wpEntry = funnelTotals.wp_entry ?? 0;
    const ndaSigned = funnelTotals.nda_signed ?? 0;
    const convRate = wpEntry > 0 ? (ndaSigned / wpEntry) * 100 : 0;
    const portfolioAvg = 2.5; // baseline from historical data

    if (wpEntry > 0) {
      const comparison = convRate > portfolioAvg ? 'above' : convRate < portfolioAvg * 0.5 ? 'well below' : 'below';
      lines.push(
        `Converts ${convRate.toFixed(1)}% of WP visitors to NDA signers \u2014 ${comparison} portfolio average.`
      );
    }

    // --- 3. Best region / locale ---
    // Derive locale-level insights from sources if they contain locale-like info
    const paidSources = sources.filter(s => (s.cost ?? 0) > 0 || s.medium === 'cpc' || s.medium === 'paid');
    const organicSources = sources.filter(s => (s.cost ?? 0) === 0 && s.medium !== 'cpc' && s.medium !== 'paid');

    if (localeCount > 1) {
      // Use sources as proxy for locale data
      const bestSource = [...sources]
        .filter(s => s.nda_signed > 0)
        .sort((a, b) => {
          const aRate = a.doing_tasks / (a.nda_signed || 1);
          const bRate = b.doing_tasks / (b.nda_signed || 1);
          return bRate - aRate;
        })[0];

      if (bestSource) {
        const rate = ((bestSource.doing_tasks / (bestSource.nda_signed || 1)) * 100).toFixed(0);
        lines.push(
          `Best performing source: ${bestSource.source}/${bestSource.medium} \u2014 ${rate}% activation rate from NDA to active.`
        );
        actions.push({ label: `INCREASE ${bestSource.source.toUpperCase()}`, color: BRAND.blue });
      }

      // Worst: 0% activation sources
      const zeroSources = sources.filter(s => s.nda_signed > 0 && s.doing_tasks === 0);
      if (zeroSources.length > 0) {
        const names = zeroSources.slice(0, 2).map(s => `${s.source}/${s.medium}`).join(', ');
        lines.push(
          `Zero activation from: ${names}. ${zeroSources.length > 2 ? `(+${zeroSources.length - 2} more)` : ''}`
        );
        actions.push({ label: `PAUSE ${zeroSources[0].source.toUpperCase()}`, color: BRAND.rose });
      }
    }

    // --- 4. Biggest drop-off ---
    const stageValues = FUNNEL_STAGES
      .map(key => ({ key, value: funnelTotals[key] ?? 0 }))
      .filter(s => s.value > 0 || s.key === 'wp_entry');

    let biggestDrop = { from: '', to: '', pct: 0 };
    for (let i = 1; i < stageValues.length; i++) {
      if (stageValues[i - 1].value > 0) {
        const dropPct = (1 - stageValues[i].value / stageValues[i - 1].value) * 100;
        if (dropPct > biggestDrop.pct) {
          biggestDrop = {
            from: STAGE_LABELS[stageValues[i - 1].key] ?? stageValues[i - 1].key,
            to: STAGE_LABELS[stageValues[i].key] ?? stageValues[i].key,
            pct: Math.round(dropPct),
          };
        }
      }
    }

    if (biggestDrop.pct > 30) {
      lines.push(
        `Biggest drop-off: ${biggestDrop.from} \u2192 ${biggestDrop.to} loses ${biggestDrop.pct}% of candidates.`
      );
      actions.push({ label: 'OPTIMIZE LP', color: BRAND.amber });
    }

    // --- 5. Channel comparison ---
    const paidConv = paidSources.reduce((s, r) => s + r.nda_signed, 0);
    const organicConv = organicSources.reduce((s, r) => s + r.nda_signed, 0);
    const totalConv = paidConv + organicConv;

    if (paidConv > 0 && organicConv > 0 && totalConv > 0) {
      const paidShare = ((paidConv / totalConv) * 100).toFixed(0);
      const organicShare = ((organicConv / totalConv) * 100).toFixed(0);
      lines.push(
        `Paid channels deliver ${paidShare}% of NDA signers vs ${organicShare}% organic.`
      );
      if (Number(organicShare) < 30) {
        actions.push({ label: 'POST MORE ON LINKEDIN', color: BRAND.purple });
      }
    } else if (organicConv > 0 && paidConv === 0) {
      lines.push('Running entirely on organic channels \u2014 zero paid spend.');
      actions.push({ label: 'POST MORE ON LINKEDIN', color: BRAND.purple });
    }

    // Ensure we always have at least one action
    if (actions.length === 0) {
      actions.push({ label: 'OPTIMIZE LP', color: BRAND.amber });
    }

    return { lines, actions };
  }, [project, funnelTotals, funnelRates, sources, localeCount]);

  const displayName = project.codename.charAt(0).toUpperCase() + project.codename.slice(1);

  return (
    <div
      className="rounded-2xl border border-black/[0.08] p-6 mb-5"
      style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.03), rgba(37,99,235,0.03))',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-[16px] leading-none"
          style={{
            background: BRAND.grad,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          &#x2726;
        </span>
        <h3 className="text-sm font-bold" style={{ color: BRAND.text }}>
          Project Intelligence Brief &mdash; {displayName}
        </h3>
      </div>

      {/* Narrative lines */}
      <div className="space-y-2.5 mb-5">
        {insights.lines.map((line, i) => (
          <p
            key={i}
            className="text-[13px] leading-[1.65]"
            style={{ color: i === 0 ? BRAND.text : BRAND.text2 }}
          >
            {i === 0 ? <span className="font-semibold">{line}</span> : line}
          </p>
        ))}
      </div>

      {/* Action badges */}
      <div className="flex flex-wrap gap-2">
        {insights.actions.map((action, i) => (
          <span
            key={i}
            className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-[10px] text-white uppercase tracking-wide"
            style={{ background: action.color }}
          >
            {action.label}
          </span>
        ))}
      </div>
    </div>
  );
}
