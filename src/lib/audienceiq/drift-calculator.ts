/**
 * Drift Calculator — four-ring audience drift detection.
 *
 * Compares audience profiles pairwise and computes weighted overall drift.
 * Adapted from VYRA's detect_drift() with a 4th ring (converted/CRM).
 */

import type { AudienceProfileRow } from '@/lib/db/audienceiq';
import { insertDriftSnapshot } from '@/lib/db/audienceiq';

interface DriftResult {
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: 'low' | 'moderate' | 'high';
  segment_mismatch: boolean;
  evidence: Record<string, unknown>;
  recommendations: string[];
}

// Weights for overall drift (sum = 1.0)
const WEIGHTS = {
  declared_vs_paid: 0.25,
  declared_vs_organic: 0.20,
  paid_vs_converted: 0.30,
  organic_vs_converted: 0.25,
};

function compareRegions(a: string[], b: string[]): { overlap_pct: number; only_a: string[]; only_b: string[] } {
  const setA = new Set(a);
  const setB = new Set(b);
  const overlap = a.filter(r => setB.has(r));
  const union = new Set([...a, ...b]);
  return {
    overlap_pct: union.size > 0 ? Math.round((overlap.length / union.size) * 100) : 100,
    only_a: a.filter(r => !setB.has(r)),
    only_b: b.filter(r => !setA.has(r)),
  };
}

function compareLanguages(a: string[], b: string[]): { overlap_pct: number } {
  const setA = new Set(a);
  const setB = new Set(b);
  const overlap = a.filter(l => setB.has(l));
  const union = new Set([...a, ...b]);
  return { overlap_pct: union.size > 0 ? Math.round((overlap.length / union.size) * 100) : 100 };
}

function compareSkills(a: Record<string, unknown>, b: Record<string, unknown>): { overlap_pct: number } {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const setA = new Set(keysA);
  const overlap = keysB.filter(k => setA.has(k));
  const union = new Set([...keysA, ...keysB]);
  return { overlap_pct: union.size > 0 ? Math.round((overlap.length / union.size) * 100) : 100 };
}

function computePairwiseDrift(profileA: AudienceProfileRow | null, profileB: AudienceProfileRow | null): {
  drift: number;
  evidence: Record<string, unknown>;
} {
  // If either profile is unavailable or empty, return 0 drift (no data to compare)
  if (!profileA || !profileB || profileA.sample_size === 0 || profileB.sample_size === 0) {
    return { drift: 0, evidence: { reason: 'insufficient_data' } };
  }

  const regionComp = compareRegions(profileA.regions, profileB.regions);
  const langComp = compareLanguages(profileA.languages, profileB.languages);
  const skillComp = compareSkills(profileA.skills, profileB.skills);

  // Drift = 100 - average overlap
  const avgOverlap = (regionComp.overlap_pct + langComp.overlap_pct + skillComp.overlap_pct) / 3;
  const drift = Math.round((100 - avgOverlap) * 10) / 10;

  return {
    drift: Math.max(0, Math.min(100, drift)),
    evidence: {
      region_overlap_pct: regionComp.overlap_pct,
      language_overlap_pct: langComp.overlap_pct,
      skill_overlap_pct: skillComp.overlap_pct,
      regions_only_a: regionComp.only_a,
      regions_only_b: regionComp.only_b,
    },
  };
}

function generateRecommendations(result: DriftResult, profiles: Record<string, AudienceProfileRow | null>): string[] {
  const recs: string[] = [];

  if (result.paid_vs_converted > 25) {
    recs.push('High drift between paid audience and actual converters — consider building lookalike audiences from your top CRM contributors instead of interest-based targeting.');
  }
  if (result.declared_vs_paid > 20) {
    recs.push('Your ad targeting does not match your declared ICP — review audience settings in your ad platforms.');
  }
  if (result.organic_vs_converted > 20) {
    recs.push('Organic visitors differ significantly from your quality contributors — your content may be attracting the wrong audience.');
  }

  const converted = profiles['converted'];
  if (converted && converted.sample_size > 0) {
    const demo = converted.demographics as Record<string, unknown>;
    const avgQuality = demo.avg_quality_score as number | null;
    if (avgQuality != null && avgQuality < 70) {
      recs.push(`Average contributor quality score is ${avgQuality} — below the 70 threshold. Review targeting and qualification criteria.`);
    }
  }

  if (recs.length === 0) {
    recs.push('Audience drift is within acceptable range. Continue monitoring.');
  }

  return recs;
}

export async function computeDrift(requestId: string, profiles: AudienceProfileRow[]): Promise<DriftResult> {
  const profileMap: Record<string, AudienceProfileRow | null> = {
    declared: profiles.find(p => p.ring === 'declared') ?? null,
    paid: profiles.find(p => p.ring === 'paid') ?? null,
    organic: profiles.find(p => p.ring === 'organic') ?? null,
    converted: profiles.find(p => p.ring === 'converted') ?? null,
  };

  const dvp = computePairwiseDrift(profileMap.declared, profileMap.paid);
  const dvo = computePairwiseDrift(profileMap.declared, profileMap.organic);
  const pvc = computePairwiseDrift(profileMap.paid, profileMap.converted);
  const ovc = computePairwiseDrift(profileMap.organic, profileMap.converted);

  const overallDrift = Math.round(
    (dvp.drift * WEIGHTS.declared_vs_paid +
     dvo.drift * WEIGHTS.declared_vs_organic +
     pvc.drift * WEIGHTS.paid_vs_converted +
     ovc.drift * WEIGHTS.organic_vs_converted) * 10
  ) / 10;

  const severity: 'low' | 'moderate' | 'high' =
    overallDrift > 25 ? 'high' : overallDrift > 15 ? 'moderate' : 'low';

  const result: DriftResult = {
    declared_vs_paid: dvp.drift,
    declared_vs_organic: dvo.drift,
    paid_vs_converted: pvc.drift,
    organic_vs_converted: ovc.drift,
    overall_drift: overallDrift,
    severity,
    segment_mismatch: overallDrift > 15,
    evidence: {
      declared_vs_paid: dvp.evidence,
      declared_vs_organic: dvo.evidence,
      paid_vs_converted: pvc.evidence,
      organic_vs_converted: ovc.evidence,
    },
    recommendations: [],
  };

  result.recommendations = generateRecommendations(result, profileMap);

  // Persist
  await insertDriftSnapshot({
    request_id: requestId,
    ...result,
  });

  return result;
}
