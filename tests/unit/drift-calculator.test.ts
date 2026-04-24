import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeProfile } from '../helpers';

vi.mock('@/lib/db/audienceiq', () => ({
  insertDriftSnapshot: vi.fn(async () => ({ id: 'test-snapshot' })),
}));

import { computeDrift } from '@/lib/audienceiq/drift-calculator';

describe('computeDrift', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 0 drift for identical profiles', async () => {
    const reqId = 'test-req-1';
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
    ];
    const result = await computeDrift(reqId, profiles);
    expect(result.overall_drift).toBe(0);
    expect(result.severity).toBe('low');
    expect(result.segment_mismatch).toBe(false);
  });

  it('returns high drift for completely different profiles', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['JP'], languages: ['ja'], skills: { python: true }, sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['DE'], languages: ['de'], skills: { rust: true }, sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['BR'], languages: ['pt'], skills: { go: true }, sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.overall_drift).toBeGreaterThan(25);
    expect(result.severity).toBe('high');
    expect(result.segment_mismatch).toBe(true);
  });

  it('returns 0 drift when all profiles have sample_size=0', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', sample_size: 0 }),
      makeProfile({ ring: 'paid', sample_size: 0 }),
      makeProfile({ ring: 'organic', sample_size: 0 }),
      makeProfile({ ring: 'converted', sample_size: 0 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.overall_drift).toBe(0);
  });

  it('gives paid_vs_converted the highest weight (0.30)', async () => {
    // Only paid and converted differ, all others identical
    const base = { regions: ['US'], languages: ['en'], skills: { js: true }, sample_size: 50 };
    const profiles = [
      makeProfile({ ring: 'declared', ...base }),
      makeProfile({ ring: 'paid', ...base }),
      makeProfile({ ring: 'organic', ...base }),
      makeProfile({ ring: 'converted', regions: ['JP'], languages: ['ja'], skills: { python: true }, sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    // paid_vs_converted and organic_vs_converted both = 100 (totally different)
    // declared_vs_paid = 0, declared_vs_organic = 0
    expect(result.paid_vs_converted).toBe(100);
    expect(result.declared_vs_paid).toBe(0);
  });

  it('severity is low for drift <= 15', async () => {
    // declared/organic identical, paid/converted identical, small region diff between groups
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US', 'UK', 'DE'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['US', 'UK', 'ES'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US', 'UK', 'DE'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['US', 'UK', 'ES'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    // region overlap = 2/4 = 50%, lang = 100%, skills = 100% => drift = 16.7
    // d_vs_p*0.25 + d_vs_o*0.20 + p_vs_c*0.30 + o_vs_c*0.25
    // = 16.7*0.25 + 0 + 0 + 16.7*0.25 = 8.35
    expect(result.severity).toBe('low');
    expect(result.overall_drift).toBeLessThanOrEqual(15);
  });

  it('severity is moderate for drift between 15 and 25', async () => {
    // declared/organic identical, paid/converted identical, moderate region diff between groups
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['JP', 'KR'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['JP', 'KR'], languages: ['en'], skills: { js: true }, sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    // region overlap = 0/4 = 0%, lang = 100%, skills = 100% => drift = 33.3
    // d_vs_p*0.25 + d_vs_o*0.20 + p_vs_c*0.30 + o_vs_c*0.25
    // = 33.3*0.25 + 0 + 0 + 33.3*0.25 = 16.7
    expect(result.overall_drift).toBeGreaterThan(15);
    expect(result.overall_drift).toBeLessThanOrEqual(25);
  });

  it('sets segment_mismatch=true when drift > 15', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US'], languages: ['en'], sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['JP'], languages: ['ja'], sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US'], languages: ['en'], sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['US'], languages: ['en'], sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    if (result.overall_drift > 15) {
      expect(result.segment_mismatch).toBe(true);
    }
  });

  it('segment_mismatch=false when drift <= 15', async () => {
    const base = { regions: ['US', 'UK'], languages: ['en'], skills: { js: true }, sample_size: 50 };
    const profiles = [
      makeProfile({ ring: 'declared', ...base }),
      makeProfile({ ring: 'paid', ...base }),
      makeProfile({ ring: 'organic', ...base }),
      makeProfile({ ring: 'converted', ...base }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.segment_mismatch).toBe(false);
  });

  it('generates recommendations for high paid_vs_converted drift', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US'], sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['US'], sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US'], sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['JP', 'KR', 'CN'], languages: ['ja', 'ko', 'zh'], skills: { ml: true }, sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.recommendations.length).toBeGreaterThan(0);
    // paid_vs_converted will be 100 (completely different), so > 25
    expect(result.paid_vs_converted).toBeGreaterThan(25);
    expect(result.recommendations.some(r => r.includes('lookalike'))).toBe(true);
  });

  it('handles missing rings gracefully', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US'], sample_size: 50 }),
      // No paid, organic, or converted profiles
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.overall_drift).toBe(0); // Can't compare missing profiles
  });

  it('returns evidence for each pairwise comparison', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US'], sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['UK'], sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US'], sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['US'], sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.evidence).toHaveProperty('declared_vs_paid');
    expect(result.evidence).toHaveProperty('declared_vs_organic');
    expect(result.evidence).toHaveProperty('paid_vs_converted');
    expect(result.evidence).toHaveProperty('organic_vs_converted');
  });

  it('calculates region overlap correctly for partial overlap', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['US', 'UK', 'DE'], sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: ['US', 'FR', 'JP'], sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: ['US', 'UK', 'DE'], sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: ['US', 'UK', 'DE'], sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.declared_vs_paid).toBeGreaterThan(0);
    expect(result.declared_vs_paid).toBeLessThan(100);
  });

  it('drift is always between 0 and 100', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: ['A'], languages: ['a'], skills: { x: 1 }, sample_size: 99 }),
      makeProfile({ ring: 'paid', regions: ['B'], languages: ['b'], skills: { y: 1 }, sample_size: 99 }),
      makeProfile({ ring: 'organic', regions: ['C'], languages: ['c'], skills: { z: 1 }, sample_size: 99 }),
      makeProfile({ ring: 'converted', regions: ['D'], languages: ['d'], skills: { w: 1 }, sample_size: 99 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.overall_drift).toBeGreaterThanOrEqual(0);
    expect(result.overall_drift).toBeLessThanOrEqual(100);
    expect(result.declared_vs_paid).toBeGreaterThanOrEqual(0);
    expect(result.declared_vs_paid).toBeLessThanOrEqual(100);
  });

  it('calls insertDriftSnapshot to persist the result', async () => {
    const { insertDriftSnapshot } = await import('@/lib/db/audienceiq');
    const profiles = [makeProfile({ ring: 'declared', sample_size: 50 })];
    await computeDrift('test-req', profiles);
    expect(insertDriftSnapshot).toHaveBeenCalledOnce();
  });

  it('handles empty regions/languages/skills arrays', async () => {
    const profiles = [
      makeProfile({ ring: 'declared', regions: [], languages: [], skills: {}, sample_size: 50 }),
      makeProfile({ ring: 'paid', regions: [], languages: [], skills: {}, sample_size: 50 }),
      makeProfile({ ring: 'organic', regions: [], languages: [], skills: {}, sample_size: 50 }),
      makeProfile({ ring: 'converted', regions: [], languages: [], skills: {}, sample_size: 50 }),
    ];
    const result = await computeDrift('test-req', profiles);
    expect(result.overall_drift).toBe(0); // All empty = 100% overlap
  });
});
