import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NormalizedAudienceData } from '@/lib/platforms/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/platforms/google-ads', () => ({ getNormalizedGoogleAds: vi.fn(async () => null) }));
vi.mock('@/lib/platforms/meta-ads', () => ({ getNormalizedMetaAds: vi.fn(async () => null) }));
vi.mock('@/lib/platforms/linkedin-ads', () => ({ getNormalizedLinkedInAds: vi.fn(async () => null) }));
vi.mock('@/lib/platforms/tiktok-ads', () => ({ getNormalizedTikTokAds: vi.fn(async () => null) }));

import { getMergedPaidAudience } from '@/lib/platforms/normalizer';
import { getNormalizedGoogleAds } from '@/lib/platforms/google-ads';
import { getNormalizedMetaAds } from '@/lib/platforms/meta-ads';
import { getNormalizedLinkedInAds } from '@/lib/platforms/linkedin-ads';
import { getNormalizedTikTokAds } from '@/lib/platforms/tiktok-ads';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlatformData(overrides: Partial<NormalizedAudienceData> & { platform: string }): NormalizedAudienceData {
  return {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    regions: {},
    demographics: {},
    interests: [],
    audience_segments: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('normalizer — getMergedPaidAudience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all platform mocks to "disconnected" (null) before each test
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(null as any);
    vi.mocked(getNormalizedMetaAds).mockResolvedValue(null as any);
    vi.mocked(getNormalizedLinkedInAds).mockResolvedValue(null as any);
    vi.mocked(getNormalizedTikTokAds).mockResolvedValue(null as any);
  });

  it('no platforms connected (all return null) -> platforms_available = []', async () => {
    const result = await getMergedPaidAudience(30);
    expect(result.platforms_available).toEqual([]);
    expect(result.total_impressions).toBe(0);
    expect(result.per_platform).toEqual([]);
  });

  it('merges impressions/clicks/conversions/spend from 2 platforms', async () => {
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(
      makePlatformData({ platform: 'google_ads', impressions: 1000, clicks: 50, conversions: 5, spend: 200 }),
    );
    vi.mocked(getNormalizedMetaAds).mockResolvedValue(
      makePlatformData({ platform: 'meta_ads', impressions: 3000, clicks: 150, conversions: 15, spend: 600 }),
    );

    const result = await getMergedPaidAudience(30);
    expect(result.total_impressions).toBe(4000);
    expect(result.total_clicks).toBe(200);
    expect(result.total_conversions).toBe(20);
    expect(result.total_spend).toBe(800);
  });

  it('merges region counts correctly (additive)', async () => {
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(
      makePlatformData({ platform: 'google_ads', regions: { US: 500, IN: 200 } }),
    );
    vi.mocked(getNormalizedMetaAds).mockResolvedValue(
      makePlatformData({ platform: 'meta_ads', regions: { US: 300, BR: 100 } }),
    );

    const result = await getMergedPaidAudience(30);
    expect(result.regions).toEqual({ US: 800, IN: 200, BR: 100 });
  });

  it('merges demographics age_ranges', async () => {
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(
      makePlatformData({ platform: 'google_ads', demographics: { age_ranges: { '18-24': 100, '25-34': 200 } } }),
    );
    vi.mocked(getNormalizedLinkedInAds).mockResolvedValue(
      makePlatformData({ platform: 'linkedin_ads', demographics: { age_ranges: { '25-34': 150, '35-44': 80 } } }),
    );

    const result = await getMergedPaidAudience(30);
    expect(result.demographics.age_ranges).toEqual({ '18-24': 100, '25-34': 350, '35-44': 80 });
  });

  it('deduplicates interests with Set', async () => {
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(
      makePlatformData({ platform: 'google_ads', interests: ['AI', 'data annotation', 'freelancing'] }),
    );
    vi.mocked(getNormalizedMetaAds).mockResolvedValue(
      makePlatformData({ platform: 'meta_ads', interests: ['freelancing', 'remote work', 'AI'] }),
    );

    const result = await getMergedPaidAudience(30);
    expect(result.interests).toEqual(['AI', 'data annotation', 'freelancing', 'remote work']);
  });

  it("single platform only (Google) -> platforms_available = ['google_ads']", async () => {
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(
      makePlatformData({ platform: 'google_ads', impressions: 500 }),
    );

    const result = await getMergedPaidAudience(30);
    expect(result.platforms_available).toEqual(['google_ads']);
  });

  it('all 4 platforms -> platforms_available has 4 entries', async () => {
    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(makePlatformData({ platform: 'google_ads' }));
    vi.mocked(getNormalizedMetaAds).mockResolvedValue(makePlatformData({ platform: 'meta_ads' }));
    vi.mocked(getNormalizedLinkedInAds).mockResolvedValue(makePlatformData({ platform: 'linkedin_ads' }));
    vi.mocked(getNormalizedTikTokAds).mockResolvedValue(makePlatformData({ platform: 'tiktok_ads' }));

    const result = await getMergedPaidAudience(30);
    expect(result.platforms_available).toHaveLength(4);
    expect(result.platforms_available).toContain('google_ads');
    expect(result.platforms_available).toContain('meta_ads');
    expect(result.platforms_available).toContain('linkedin_ads');
    expect(result.platforms_available).toContain('tiktok_ads');
  });

  it('per_platform array has individual NormalizedAudienceData items', async () => {
    const google = makePlatformData({ platform: 'google_ads', impressions: 100 });
    const meta = makePlatformData({ platform: 'meta_ads', impressions: 200 });

    vi.mocked(getNormalizedGoogleAds).mockResolvedValue(google);
    vi.mocked(getNormalizedMetaAds).mockResolvedValue(meta);

    const result = await getMergedPaidAudience(30);
    expect(result.per_platform).toHaveLength(2);
    expect(result.per_platform[0]).toEqual(google);
    expect(result.per_platform[1]).toEqual(meta);
  });
});
