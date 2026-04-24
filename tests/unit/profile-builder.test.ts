import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockResults: unknown[][] = [];
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => {
    const sql = (() => mockResults.shift() ?? []) as any;
    return sql;
  }),
}));

vi.mock('@/lib/crm/client', () => ({
  isCrmConnected: vi.fn(() => false),
}));

vi.mock('@/lib/db/audienceiq', () => ({
  upsertProfile: vi.fn(async () => {}),
}));

vi.mock('@/lib/platforms/normalizer', () => ({
  getMergedPaidAudience: vi.fn(async () => ({
    platforms_available: [],
    total_impressions: 0,
    total_clicks: 0,
    total_conversions: 0,
    total_spend: 0,
    regions: {},
    demographics: { age_ranges: {}, genders: {} },
    interests: [],
    per_platform: [],
  })),
}));

vi.mock('@/lib/audienceiq/ga4-client', () => ({
  isGa4Connected: vi.fn(async () => false),
  getGa4Demographics: vi.fn(async () => ({
    countries: [],
    devices: [],
  })),
}));

import {
  buildDeclaredProfile,
  buildConvertedProfile,
  buildPaidProfile,
  buildOrganicProfile,
  buildAndStoreAllProfiles,
} from '@/lib/audienceiq/profile-builder';
import { isCrmConnected } from '@/lib/crm/client';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('profile-builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResults.length = 0;
  });

  // ── buildDeclaredProfile ───────────────────────────────────────────────

  it('extracts target_regions from DB result', async () => {
    mockResults.push([
      {
        target_regions: ['US', 'IN', 'BR'],
        target_languages: ['English'],
        qualifications_required: null,
        qualifications_preferred: null,
        location_scope: null,
        engagement_model: null,
        form_data: {},
      },
    ]);

    const profile = await buildDeclaredProfile('req-1');
    expect(profile.regions).toEqual(['US', 'IN', 'BR']);
  });

  it('extracts target_languages', async () => {
    mockResults.push([
      {
        target_regions: [],
        target_languages: ['English', 'Hindi', 'Portuguese'],
        qualifications_required: null,
        qualifications_preferred: null,
        location_scope: null,
        engagement_model: null,
        form_data: {},
      },
    ]);

    const profile = await buildDeclaredProfile('req-2');
    expect(profile.languages).toEqual(['English', 'Hindi', 'Portuguese']);
  });

  it('extracts qualifications_required as skills', async () => {
    mockResults.push([
      {
        target_regions: [],
        target_languages: [],
        qualifications_required: ['Native speaker', 'Smartphone owner'],
        qualifications_preferred: ['College degree'],
        location_scope: 'remote',
        engagement_model: 'project',
        form_data: {},
      },
    ]);

    const profile = await buildDeclaredProfile('req-3');
    expect(profile.skills).toEqual({
      required: ['Native speaker', 'Smartphone owner'],
      preferred: ['College degree'],
    });
  });

  it("returns confidence='high', source='intake_form'", async () => {
    mockResults.push([
      {
        target_regions: ['US'],
        target_languages: ['English'],
        qualifications_required: null,
        qualifications_preferred: null,
        location_scope: null,
        engagement_model: null,
        form_data: {},
      },
    ]);

    const profile = await buildDeclaredProfile('req-4');
    expect(profile.confidence).toBe('high');
    expect(profile.source).toBe('intake_form');
  });

  it('returns empty profile for missing request (no DB rows)', async () => {
    mockResults.push([]);

    const profile = await buildDeclaredProfile('req-missing');
    expect(profile.regions).toEqual([]);
    expect(profile.languages).toEqual([]);
    expect(profile.skills).toEqual({});
    expect(profile.sample_size).toBe(0);
    expect(profile.confidence).toBe('low');
    expect(profile.source).toBe('intake_form');
  });

  // ── buildConvertedProfile ──────────────────────────────────────────────

  it("returns source='crm_unavailable' when CRM disconnected", async () => {
    vi.mocked(isCrmConnected).mockReturnValue(false);

    const profile = await buildConvertedProfile('req-5');
    expect(profile.source).toBe('crm_unavailable');
    expect(profile.sample_size).toBe(0);
  });

  it('returns empty when no campaigns linked', async () => {
    vi.mocked(isCrmConnected).mockReturnValue(true);
    // First query: tracked_links returns no campaigns
    mockResults.push([]);

    const profile = await buildConvertedProfile('req-6');
    expect(profile.source).toBe('crm');
    expect(profile.regions).toEqual([]);
    expect(profile.sample_size).toBe(0);
  });

  // ── buildPaidProfile ──────────────────────────────────────────────────

  it("returns source='platforms_unavailable' when no platforms connected", async () => {
    // Default mock already returns platforms_available: []
    const profile = await buildPaidProfile('req-7');
    expect(profile.source).toBe('platforms_unavailable');
    expect(profile.sample_size).toBe(0);
  });

  // ── buildOrganicProfile ────────────────────────────────────────────────

  it("returns source='ga4_unavailable' when GA4 not connected", async () => {
    // Default mock already returns isGa4Connected: false
    const profile = await buildOrganicProfile('req-8');
    expect(profile.source).toBe('ga4_unavailable');
    expect(profile.sample_size).toBe(0);
  });

  // ── buildAndStoreAllProfiles ───────────────────────────────────────────

  it('returns array of 4 profiles', async () => {
    vi.mocked(isCrmConnected).mockReturnValue(false);
    // buildDeclaredProfile needs one DB call
    mockResults.push([]);

    const profiles = await buildAndStoreAllProfiles('req-9');
    expect(profiles).toHaveLength(4);

    const rings = profiles.map(p => p.ring);
    expect(rings).toContain('declared');
    expect(rings).toContain('paid');
    expect(rings).toContain('organic');
    expect(rings).toContain('converted');
  });
});
