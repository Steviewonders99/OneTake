import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeProfile } from '../helpers';

vi.mock('@/lib/db/audienceiq', () => ({
  insertHealthScore: vi.fn(async () => ({ id: 'test-health' })),
}));

vi.mock('@/lib/crm/client', () => ({
  isCrmConnected: vi.fn(() => true),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { computeHealth } from '@/lib/audienceiq/health-scorer';
import { isCrmConnected } from '@/lib/crm/client';
import { insertHealthScore } from '@/lib/db/audienceiq';

describe('computeHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCrmConnected).mockReturnValue(true);
  });

  // 1. Perfect health — score=100, no issues
  it('returns score=100 with empty issues when all data is healthy', async () => {
    const profiles = [
      makeProfile({
        ring: 'declared',
        skills: { typing: 1, translation: 1, annotation: 1 },
        regions: ['US', 'UK', 'DE'],
        sample_size: 50,
      }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 75 },
        skills: { typing: 1, translation: 1, review: 1 },
        regions: ['US', 'UK', 'FR'],
        sample_size: 50,
      }),
    ];

    const result = await computeHealth('req-1', profiles);

    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(insertHealthScore).toHaveBeenCalledWith({
      request_id: 'req-1',
      score: 100,
      issues: [],
    });
  });

  // 2. Quality drift — critical (avg_quality_score < 50)
  it('deducts 30 with critical severity when avg_quality_score < 50', async () => {
    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 35, active_pct: 80 },
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-2', profiles);

    const issue = result.issues.find(i => i.type === 'quality_drift');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(30);
    expect(issue!.severity).toBe('critical');
    expect(result.score).toBe(70);
  });

  // 3. Quality drift — warning (avg_quality_score between 50-70)
  it('deducts 20 with warning severity when avg_quality_score between 50 and 70', async () => {
    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 60, active_pct: 80 },
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-3', profiles);

    const issue = result.issues.find(i => i.type === 'quality_drift');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(20);
    expect(issue!.severity).toBe('warning');
    expect(result.score).toBe(80);
  });

  // 4. Retention drift — active_pct < 50 with sample_size >= 10
  it('deducts 25 for retention drift when active_pct < 50 and sample_size >= 10', async () => {
    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 40 },
        sample_size: 15,
      }),
    ];

    const result = await computeHealth('req-4', profiles);

    const issue = result.issues.find(i => i.type === 'retention_drift');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(25);
    expect(result.score).toBe(75);
  });

  // 5. Skill mismatch — overlap < 30%
  it('deducts 25 for skill mismatch when overlap < 30%', async () => {
    const profiles = [
      makeProfile({
        ring: 'declared',
        skills: { typing: 1, review: 1, annotation: 1, labeling: 1 },
        sample_size: 20,
      }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 80 },
        skills: { driving: 1, cooking: 1, welding: 1, plumbing: 1 },
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-5', profiles);

    const issue = result.issues.find(i => i.type === 'skill_mismatch');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(25);
    expect(result.score).toBe(75);
  });

  // 6. Geo mismatch — overlap < 30%
  it('deducts 20 for geo mismatch when region overlap < 30%', async () => {
    const profiles = [
      makeProfile({
        ring: 'declared',
        regions: ['US', 'UK', 'DE', 'FR'],
        sample_size: 20,
      }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 80 },
        regions: ['IN', 'PH', 'KE', 'NG'],
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-6', profiles);

    const issue = result.issues.find(i => i.type === 'geo_mismatch');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(20);
    expect(result.score).toBe(80);
  });

  // 7. High drift — overall_drift > 25
  it('deducts 15 for high drift when overall_drift > 25', async () => {
    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 80 },
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-7', profiles, {
      overall_drift: 30,
      paid_vs_converted: 10,
    });

    const issue = result.issues.find(i => i.type === 'high_drift');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(15);
    expect(issue!.severity).toBe('critical');
    expect(result.score).toBe(85);
  });

  // 8. Paid conversion gap — paid_vs_converted > 30
  it('deducts 15 for paid conversion gap when paid_vs_converted > 30', async () => {
    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 80 },
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-8', profiles, {
      overall_drift: 10,
      paid_vs_converted: 40,
    });

    const issue = result.issues.find(i => i.type === 'paid_conversion_gap');
    expect(issue).toBeDefined();
    expect(issue!.deduction).toBe(15);
    expect(issue!.severity).toBe('warning');
    expect(result.score).toBe(85);
  });

  // 9. Small sample — converted sample_size < 10 but > 0
  it('adds info issue with 0 deduction when sample_size < 10', async () => {
    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 85, active_pct: 80 },
        sample_size: 5,
      }),
    ];

    const result = await computeHealth('req-9', profiles);

    const issue = result.issues.find(i => i.type === 'small_sample');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
    expect(issue!.deduction).toBe(0);
    expect(result.score).toBe(100);
  });

  // 10. CRM unavailable — info issue, CRM detectors skipped
  it('adds crm_unavailable info issue when CRM not connected', async () => {
    vi.mocked(isCrmConnected).mockReturnValue(false);

    const profiles = [
      makeProfile({ ring: 'declared' }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 20, active_pct: 10 },
        skills: { driving: 1 },
        regions: ['ZZ'],
        sample_size: 50,
      }),
    ];

    const result = await computeHealth('req-10', profiles);

    const crmIssue = result.issues.find(i => i.type === 'crm_unavailable');
    expect(crmIssue).toBeDefined();
    expect(crmIssue!.severity).toBe('info');
    expect(crmIssue!.deduction).toBe(0);

    // CRM-based detectors should be skipped
    expect(result.issues.find(i => i.type === 'quality_drift')).toBeUndefined();
    expect(result.issues.find(i => i.type === 'retention_drift')).toBeUndefined();
    expect(result.issues.find(i => i.type === 'skill_mismatch')).toBeUndefined();
    expect(result.issues.find(i => i.type === 'geo_mismatch')).toBeUndefined();
    expect(result.score).toBe(100);
  });

  // 11. Multiple issues stack
  it('stacks multiple deductions: quality(30) + retention(25) + geo(20) = score 25', async () => {
    const profiles = [
      makeProfile({
        ring: 'declared',
        regions: ['US', 'UK', 'DE', 'FR'],
        sample_size: 20,
      }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 40, active_pct: 30 },
        regions: ['IN', 'PH', 'KE', 'NG'],
        sample_size: 20,
      }),
    ];

    const result = await computeHealth('req-11', profiles);

    expect(result.issues.find(i => i.type === 'quality_drift')).toBeDefined();
    expect(result.issues.find(i => i.type === 'retention_drift')).toBeDefined();
    expect(result.issues.find(i => i.type === 'geo_mismatch')).toBeDefined();
    expect(result.score).toBe(25);
  });

  // 12. Score clamped to minimum 0
  it('clamps score to 0 when deductions exceed 100', async () => {
    const profiles = [
      makeProfile({
        ring: 'declared',
        skills: { typing: 1 },
        regions: ['US', 'UK', 'DE', 'FR'],
        sample_size: 30,
      }),
      makeProfile({
        ring: 'converted',
        demographics: { avg_quality_score: 20, active_pct: 10 },
        skills: { driving: 1, cooking: 1, welding: 1, plumbing: 1 },
        regions: ['IN', 'PH', 'KE', 'NG'],
        sample_size: 30,
      }),
    ];

    // quality_drift: 30 + retention_drift: 25 + skill_mismatch: 25 + geo_mismatch: 20 + high_drift: 15 + paid_conversion_gap: 15 = 130
    const result = await computeHealth('req-12', profiles, {
      overall_drift: 50,
      paid_vs_converted: 50,
    });

    expect(result.score).toBe(0);
    expect(result.issues.length).toBeGreaterThanOrEqual(6);
  });
});
