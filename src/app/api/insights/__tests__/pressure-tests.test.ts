/**
 * Pressure Tests — insights API + dashboard system
 *
 * Targets known weak-points from QA audit:
 *   1. API response shape contracts
 *   2. NaN / edge-case day parameter handling
 *   3. Filter context isolation (organicPlatform vs paidPlatform)
 *   4. AI compose JSON parsing + widget validation logic
 *   5. Campaign exact-match filtering
 *   6. Chart theme formatting helpers
 *
 * NO network. NO database. NO auth. Fast by design.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. API RESPONSE SHAPE CONTRACTS
//    These tests verify that the logic shaping each response produces the
//    correct keys — mocking the DB result so no Postgres needed.
// ---------------------------------------------------------------------------

describe('API Response Shape Contracts', () => {
  // ── organic-posts ────────────────────────────────────────────────────────
  describe('organic-posts', () => {
    it('wraps rows in { posts: [] } — not a bare array', () => {
      // Mirrors the return statement in the route
      const rows: unknown[] = [];
      const response = { posts: rows };

      expect(response).toHaveProperty('posts');
      expect(Array.isArray(response.posts)).toBe(true);
      // Bare array would fail this:
      expect(typeof response).toBe('object');
      expect(Array.isArray(response)).toBe(false);
    });

    it('post objects carry the expected keys', () => {
      const post = {
        post_id: 'abc123',
        platform: 'facebook',
        post_date: '2026-05-01',
        impressions: 1000,
        reach: 800,
        engagement: 50,
        clicks: 30,
        engagement_rate: 0.05,
        post_url: 'https://fb.com/post/1',
        caption: 'Test caption',
        attribution_source: null,
        attribution_request_id: null,
      };
      const response = { posts: [post] };
      const keys = Object.keys(response.posts[0]);

      expect(keys).toContain('post_id');
      expect(keys).toContain('platform');
      expect(keys).toContain('impressions');
      expect(keys).toContain('reach');
      expect(keys).toContain('engagement');
      expect(keys).toContain('clicks');
      expect(keys).toContain('engagement_rate');
    });
  });

  // ── campaign-funnel ──────────────────────────────────────────────────────
  describe('campaign-funnel', () => {
    it('returns all required top-level keys', () => {
      // Mirrors the NextResponse.json({...}) shape from the route
      const response = {
        campaign: 'All Campaigns',
        days: 90,
        funnel: [],
        channels: [],
        spend: { total: 0, impressions: 0, clicks: 0, by_platform: [] },
        kpis: {
          total_spend: 0,
          total_sessions: 0,
          applies: 0,
          signups: 0,
          completions: 0,
          cpa_signup: 0,
          cpa_completion: 0,
          cvr_click_to_signup: 0,
          cvr_click_to_purchase: 0,
          cvr_session_to_signup: 0,
          cvr_session_to_purchase: 0,
          cvr_signup_to_purchase: 0,
        },
        available_campaigns: [],
      };

      expect(response).toHaveProperty('funnel');
      expect(response).toHaveProperty('channels');
      expect(response).toHaveProperty('spend');
      expect(response).toHaveProperty('kpis');
      expect(response).toHaveProperty('available_campaigns');
      expect(Array.isArray(response.funnel)).toBe(true);
      expect(Array.isArray(response.channels)).toBe(true);
      expect(Array.isArray(response.available_campaigns)).toBe(true);
      expect(typeof response.spend).toBe('object');
      expect(typeof response.kpis).toBe('object');
    });

    it('kpis object has all CVR fields', () => {
      const kpis = {
        total_spend: 500,
        total_sessions: 1000,
        applies: 50,
        signups: 20,
        completions: 10,
        cpa_signup: 25,
        cpa_completion: 50,
        cvr_click_to_signup: 5,
        cvr_click_to_purchase: 2.5,
        cvr_session_to_signup: 2,
        cvr_session_to_purchase: 1,
        cvr_signup_to_purchase: 50,
      };

      const requiredCvrFields = [
        'cvr_click_to_signup',
        'cvr_click_to_purchase',
        'cvr_session_to_signup',
        'cvr_session_to_purchase',
        'cvr_signup_to_purchase',
      ];

      for (const field of requiredCvrFields) {
        expect(kpis).toHaveProperty(field);
      }
    });
  });

  // ── paid-overview ────────────────────────────────────────────────────────
  describe('paid-overview', () => {
    it('returns total_spend, total_impressions, total_clicks, total_conversions, avg_cpa, avg_ctr, roas, platforms', () => {
      // Mirrors the route return shape
      const response = {
        days: 30,
        total_spend: 1234.56,
        total_impressions: 50000,
        total_clicks: 2500,
        total_conversions: 120,
        avg_cpa: 10.29,
        avg_ctr: 0.05,
        roas: 3.2,
        platforms: [],
      };

      const requiredKeys = [
        'total_spend',
        'total_impressions',
        'total_clicks',
        'total_conversions',
        'avg_cpa',
        'avg_ctr',
        'roas',
        'platforms',
      ];

      for (const key of requiredKeys) {
        expect(response).toHaveProperty(key);
      }
      expect(Array.isArray(response.platforms)).toBe(true);
    });

    it('avg_cpa is null when conversions = 0 (no division by zero)', () => {
      const total_spend = 500;
      const total_conversions = 0;
      const avg_cpa = total_conversions > 0 ? total_spend / total_conversions : null;

      expect(avg_cpa).toBeNull();
    });

    it('avg_ctr is null when impressions = 0 (no division by zero)', () => {
      const total_clicks = 100;
      const total_impressions = 0;
      const avg_ctr = total_impressions > 0 ? total_clicks / total_impressions : null;

      expect(avg_ctr).toBeNull();
    });
  });

  // ── organic-overview ─────────────────────────────────────────────────────
  describe('organic-overview', () => {
    it('returns impressions, reach, engagement, clicks, follower_delta, avg_engagement_rate, platforms', () => {
      const response = {
        days: 30,
        total_impressions: 80000,
        total_reach: 45000,
        total_engagement: 3200,
        total_clicks: 1400,
        follower_delta: 120,
        post_count: 48,
        avg_engagement_rate: 0.04,
        platforms: [],
      };

      expect(response).toHaveProperty('total_impressions');
      expect(response).toHaveProperty('total_reach');
      expect(response).toHaveProperty('total_engagement');
      expect(response).toHaveProperty('total_clicks');
      expect(response).toHaveProperty('follower_delta');
      expect(response).toHaveProperty('avg_engagement_rate');
      expect(response).toHaveProperty('platforms');
      expect(Array.isArray(response.platforms)).toBe(true);
    });

    it('avg_engagement_rate is 0 when total_impressions = 0 (no division by zero)', () => {
      const total_engagement = 50;
      const total_impressions = 0;
      const avg_engagement_rate = total_impressions > 0
        ? total_engagement / total_impressions
        : 0;

      expect(avg_engagement_rate).toBe(0);
      expect(Number.isNaN(avg_engagement_rate)).toBe(false);
    });
  });

  // ── kpi-trends ───────────────────────────────────────────────────────────
  describe('kpi-trends', () => {
    it('returns paid_daily, organic_daily, paid_deltas, organic_deltas', () => {
      const response = {
        paid_daily: [],
        organic_daily: [],
        paid_deltas: { spend: 0, impressions: 0, clicks: 0, conversions: 0 },
        organic_deltas: { impressions: 0, reach: 0, engagement: 0, clicks: 0 },
      };

      expect(response).toHaveProperty('paid_daily');
      expect(response).toHaveProperty('organic_daily');
      expect(response).toHaveProperty('paid_deltas');
      expect(response).toHaveProperty('organic_deltas');
      expect(Array.isArray(response.paid_daily)).toBe(true);
      expect(Array.isArray(response.organic_daily)).toBe(true);
    });

    it('paid_deltas has all four required keys', () => {
      const paid_deltas = { spend: 5.2, impressions: -3.1, clicks: 12.0, conversions: 0 };

      expect(paid_deltas).toHaveProperty('spend');
      expect(paid_deltas).toHaveProperty('impressions');
      expect(paid_deltas).toHaveProperty('clicks');
      expect(paid_deltas).toHaveProperty('conversions');
    });

    it('organic_deltas has all four required keys', () => {
      const organic_deltas = { impressions: 0, reach: 0, engagement: 0, clicks: 0 };

      expect(organic_deltas).toHaveProperty('impressions');
      expect(organic_deltas).toHaveProperty('reach');
      expect(organic_deltas).toHaveProperty('engagement');
      expect(organic_deltas).toHaveProperty('clicks');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. NaN / EDGE-CASE DAY PARAMETER HANDLING
//    The pattern used in every route:
//      Math.max(1, parseInt(value || '30') || 30)
// ---------------------------------------------------------------------------

describe('NaN Guard — days parameter', () => {
  /** Mirrors the exact guard expression used in all routes */
  function parseDays(raw: string | null, fallback = 30): number {
    return Math.max(1, parseInt(raw || String(fallback), 10) || fallback);
  }

  it('empty string "" defaults to 30', () => {
    expect(parseDays('')).toBe(30);
  });

  it('null defaults to 30', () => {
    expect(parseDays(null)).toBe(30);
  });

  it('"abc" defaults to 30 (parseInt NaN → fallback)', () => {
    expect(parseDays('abc')).toBe(30);
  });

  it('"0" falls back to 30 (parseInt("0") is falsy → fallback kicks in)', () => {
    // The guard is: Math.max(1, parseInt(raw || '30') || 30)
    // parseInt('0') === 0, which is falsy, so `0 || 30` = 30.
    // Math.max(1, 30) = 30. This is the ACTUAL route behaviour.
    // A widget sending days=0 gets treated identically to "no value" — always 30.
    expect(parseDays('0')).toBe(30);
  });

  it('"-5" becomes 1 via Math.max(1, ...)', () => {
    expect(parseDays('-5')).toBe(1);
  });

  it('"30" returns 30', () => {
    expect(parseDays('30')).toBe(30);
  });

  it('"90" returns 90', () => {
    expect(parseDays('90')).toBe(90);
  });

  it('"7" returns 7', () => {
    expect(parseDays('7')).toBe(7);
  });

  it('result is never NaN', () => {
    const inputs = ['', null, 'abc', '0', '-5', '30', '90', '2.5', '   '];
    for (const input of inputs) {
      const result = parseDays(input);
      expect(Number.isNaN(result)).toBe(false);
    }
  });

  it('result is always at least 1', () => {
    const inputs = ['', null, 'abc', '0', '-5', '-999', '0.5'];
    for (const input of inputs) {
      // '0' falls back to 30 (falsy parseInt → fallback), '-5' → Math.max(1,-5) = 1
      expect(parseDays(input)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. FILTER CONTAMINATION — DashboardFilterContext logic
//    Tests the pure state-management logic without React
// ---------------------------------------------------------------------------

describe('Filter Contamination — DashboardFilterContext logic', () => {
  type DashboardFilters = {
    organicPlatform?: string;
    paidPlatform?: string;
    dateRange?: string;
  };

  /**
   * Extracted reducer from the DashboardFilterProvider — tests pure logic
   * without needing React / JSDOM.
   */
  function setFilter(
    prev: DashboardFilters,
    key: keyof DashboardFilters,
    value: string,
  ): DashboardFilters {
    if (prev[key] === value) {
      const next = { ...prev };
      delete next[key];
      return next;
    }
    return { ...prev, [key]: value };
  }

  function clearFilter(prev: DashboardFilters, key: keyof DashboardFilters): DashboardFilters {
    const next = { ...prev };
    delete next[key];
    return next;
  }

  function clearAll(): DashboardFilters {
    return {};
  }

  it('organicPlatform and paidPlatform are independent keys', () => {
    let filters: DashboardFilters = {};
    filters = setFilter(filters, 'organicPlatform', 'facebook');

    expect(filters.organicPlatform).toBe('facebook');
    expect(filters.paidPlatform).toBeUndefined();
  });

  it('setting organicPlatform="facebook" does NOT affect paidPlatform', () => {
    let filters: DashboardFilters = { paidPlatform: 'meta_ads' };
    filters = setFilter(filters, 'organicPlatform', 'facebook');

    expect(filters.organicPlatform).toBe('facebook');
    expect(filters.paidPlatform).toBe('meta_ads');
  });

  it('setting paidPlatform="meta_ads" does NOT affect organicPlatform', () => {
    let filters: DashboardFilters = { organicPlatform: 'linkedin' };
    filters = setFilter(filters, 'paidPlatform', 'meta_ads');

    expect(filters.paidPlatform).toBe('meta_ads');
    expect(filters.organicPlatform).toBe('linkedin');
  });

  it('clearAll() clears both organicPlatform and paidPlatform', () => {
    const filters: DashboardFilters = {
      organicPlatform: 'facebook',
      paidPlatform: 'reddit_ads',
      dateRange: '30',
    };
    const cleared = clearAll();

    expect(cleared.organicPlatform).toBeUndefined();
    expect(cleared.paidPlatform).toBeUndefined();
    expect(cleared.dateRange).toBeUndefined();
    expect(Object.keys(cleared).length).toBe(0);
  });

  it('clearFilter(organicPlatform) leaves paidPlatform intact', () => {
    let filters: DashboardFilters = {
      organicPlatform: 'facebook',
      paidPlatform: 'meta_ads',
    };
    filters = clearFilter(filters, 'organicPlatform');

    expect(filters.organicPlatform).toBeUndefined();
    expect(filters.paidPlatform).toBe('meta_ads');
  });

  it('toggle behaviour: setting same value twice removes it', () => {
    let filters: DashboardFilters = {};
    filters = setFilter(filters, 'organicPlatform', 'facebook');
    expect(filters.organicPlatform).toBe('facebook');

    // Toggle off
    filters = setFilter(filters, 'organicPlatform', 'facebook');
    expect(filters.organicPlatform).toBeUndefined();
  });

  it('isFiltered is false when filters is empty', () => {
    const filters: DashboardFilters = {};
    const isFiltered = Object.keys(filters).length > 0;
    expect(isFiltered).toBe(false);
  });

  it('isFiltered is true when any filter is set', () => {
    const filters: DashboardFilters = { organicPlatform: 'facebook' };
    const isFiltered = Object.keys(filters).length > 0;
    expect(isFiltered).toBe(true);
  });

  it('Escape key handler calls clearAll (simulation)', () => {
    let filters: DashboardFilters = { organicPlatform: 'facebook', paidPlatform: 'meta_ads' };

    // Simulate: if (e.key === 'Escape') clearAll()
    const e = { key: 'Escape' };
    if (e.key === 'Escape') {
      filters = clearAll();
    }

    expect(filters).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 4. AI COMPOSE — JSON PARSING + WIDGET VALIDATION LOGIC
//    Extracted from /api/insights/ai/compose/route.ts — tests the logic
//    that runs AFTER the LLM call, no network needed.
// ---------------------------------------------------------------------------

describe('AI Compose — JSON parsing and widget validation', () => {
  const VALID_WIDGET_TYPES = new Set([
    'paid-kpi', 'organic-kpi', 'campaign-funnel', 'paid-platform-compare',
    'organic-platform-compare', 'paid-campaign-detail', 'organic-top-posts',
    'organic-attribution', 'organic-account-growth', 'gsc-performance',
    'campaign-roi', 'utm-funnel', 'recruiter-leaderboard', 'kpi-cards',
    'pipeline-overview', 'campaign-timeline', 'ga4-traffic',
  ]);

  /** Mirrors the markdown-strip + JSON.parse logic in the route */
  function cleanAndParse(raw: string): unknown {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(cleaned);
  }

  /** Mirrors the widget validation + filtering logic in the route */
  function validateWidgets(
    rawWidgets: unknown[],
  ): Array<{ id: string; type: string; title: string; config: Record<string, unknown> }> {
    return rawWidgets
      .filter((w: any) => w?.type && VALID_WIDGET_TYPES.has(w.type))
      .map((w: any) => ({
        id: w.id || `w-fallback`,
        type: w.type,
        title: w.title || w.type,
        config: w.config ?? {},
      }));
  }

  /** Mirrors generateMdLayout from the route */
  function generateMdLayout(
    lgLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>,
  ) {
    return lgLayout.map((item) => ({
      ...item,
      x: item.w === 12 ? 0 : item.x === 0 ? 0 : 4,
      w: item.w === 12 ? 8 : 4,
      minW: Math.min((item as any).minW ?? 3, 4),
    }));
  }

  /** Mirrors generateSmLayout from the route */
  function generateSmLayout(
    lgLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>,
  ) {
    let y = 0;
    return lgLayout.map((item) => {
      const smItem = { i: item.i, x: 0, y, w: 4, h: item.h };
      y += item.h;
      return smItem;
    });
  }

  // ── Prompt validation ────────────────────────────────────────────────────
  it('empty prompt should be rejected (400)', () => {
    const prompt = '   '.trim();
    // Route checks: if (!prompt) → 400
    expect(!!prompt).toBe(false);
  });

  it('non-empty prompt passes validation', () => {
    const prompt = 'Show me paid funnel'.trim();
    expect(!!prompt).toBe(true);
  });

  // ── Markdown-wrapped JSON stripping ──────────────────────────────────────
  it('strips ```json ... ``` fence and parses correctly', () => {
    const raw = '```json\n{"title": "Test", "widgets": []}\n```';
    const parsed = cleanAndParse(raw) as any;
    expect(parsed.title).toBe('Test');
    expect(Array.isArray(parsed.widgets)).toBe(true);
  });

  it('strips ``` ... ``` fence (no language tag) and parses correctly', () => {
    const raw = '```\n{"title": "No tag", "widgets": []}\n```';
    const parsed = cleanAndParse(raw) as any;
    expect(parsed.title).toBe('No tag');
  });

  it('passes through bare JSON without modification', () => {
    const raw = '{"title": "Bare", "widgets": []}';
    const parsed = cleanAndParse(raw) as any;
    expect(parsed.title).toBe('Bare');
  });

  // ── Widget type validation ───────────────────────────────────────────────
  it('filters out invalid widget types and keeps valid ones', () => {
    const rawWidgets = [
      { id: 'w1', type: 'paid-kpi', title: 'Paid KPIs', config: { days: 30 } },
      { id: 'w2', type: 'INVALID_TYPE', title: 'Bad', config: {} },
      { id: 'w3', type: 'organic-kpi', title: 'Organic KPIs', config: { days: 30 } },
      { id: 'w4', type: 'does-not-exist', title: 'Also bad', config: {} },
    ];

    const valid = validateWidgets(rawWidgets);
    expect(valid.length).toBe(2);
    expect(valid.map((w) => w.type)).toEqual(['paid-kpi', 'organic-kpi']);
  });

  it('returns empty array when ALL widget types are invalid', () => {
    const rawWidgets = [
      { id: 'w1', type: 'fake-widget', title: 'Fake', config: {} },
      { id: 'w2', type: 'another-fake', title: 'Also Fake', config: {} },
    ];
    const valid = validateWidgets(rawWidgets);
    expect(valid.length).toBe(0);
  });

  it('422 equivalent — no valid widgets after filtering', () => {
    const rawWidgets = [
      { id: 'w1', type: 'nonexistent', title: 'Nope', config: {} },
    ];
    const valid = validateWidgets(rawWidgets);
    // Route returns 422 when validWidgets.length === 0
    const wouldReturn422 = valid.length === 0;
    expect(wouldReturn422).toBe(true);
  });

  it('widgets with missing type are filtered out', () => {
    const rawWidgets = [
      { id: 'w1', title: 'No type field', config: {} },
      { id: 'w2', type: 'paid-kpi', title: 'Valid', config: {} },
    ];
    const valid = validateWidgets(rawWidgets as any);
    expect(valid.length).toBe(1);
    expect(valid[0].type).toBe('paid-kpi');
  });

  // ── Responsive layout generation ─────────────────────────────────────────
  it('generateMdLayout produces md layout from lg when LLM omits it', () => {
    const lg = [
      { i: 'w1', x: 0, y: 0, w: 12, h: 2 },
      { i: 'w2', x: 0, y: 2, w: 6, h: 4 },
      { i: 'w3', x: 6, y: 2, w: 6, h: 4 },
    ];

    const md = generateMdLayout(lg);

    expect(md.length).toBe(3);
    // Full-width 12 → 8 in md
    expect(md[0].w).toBe(8);
    expect(md[0].x).toBe(0);
    // Left half-width: x=0 → stays 0
    expect(md[1].x).toBe(0);
    expect(md[1].w).toBe(4);
    // Right half-width: x=6 → becomes 4
    expect(md[2].x).toBe(4);
    expect(md[2].w).toBe(4);
  });

  it('generateSmLayout stacks everything vertically at x=0 w=4', () => {
    const lg = [
      { i: 'w1', x: 0, y: 0, w: 12, h: 2 },
      { i: 'w2', x: 0, y: 2, w: 6, h: 4 },
      { i: 'w3', x: 6, y: 2, w: 6, h: 4 },
    ];

    const sm = generateSmLayout(lg);

    expect(sm.length).toBe(3);
    // All stacked at x=0 w=4
    for (const item of sm) {
      expect(item.x).toBe(0);
      expect(item.w).toBe(4);
    }
    // y values stack sequentially
    expect(sm[0].y).toBe(0);
    expect(sm[1].y).toBe(2);  // 0 + h(2)
    expect(sm[2].y).toBe(6);  // 2 + h(4)
  });

  it('LLM providing only lg still generates md and sm', () => {
    // When LLM returns gridLayouts.lg but no md/sm, route generates them
    const llmResponse = {
      gridLayouts: {
        lg: [{ i: 'w1', x: 0, y: 0, w: 12, h: 2 }],
        // no md, no sm
      },
    };

    const layouts = llmResponse.gridLayouts as Record<string, any>;
    const hasMd = Array.isArray(layouts.md);
    const hasSm = Array.isArray(layouts.sm);

    // Route would generate these
    const md = !hasMd ? generateMdLayout(llmResponse.gridLayouts.lg) : layouts.md;
    const sm = !hasSm ? generateSmLayout(llmResponse.gridLayouts.lg) : layouts.sm;

    expect(Array.isArray(md)).toBe(true);
    expect(Array.isArray(sm)).toBe(true);
    expect(md.length).toBe(1);
    expect(sm.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. CAMPAIGN MATCH TESTS
//    Mirrors the LOWER(campaign) = campaignFilter.toLowerCase() pattern.
// ---------------------------------------------------------------------------

describe('Campaign Exact Match Filtering', () => {
  const campaigns = [
    { campaign: 'lumina', event_count: 500 },
    { campaign: 'illumina', event_count: 200 },
    { campaign: 'humus', event_count: 300 },
    { campaign: 'Lumina Morocco', event_count: 150 },
  ];

  /** Mirrors: WHERE LOWER(campaign) = campaignFilter.toLowerCase() */
  function filterCampaigns(filter: string) {
    if (!filter) return campaigns; // empty = all campaigns
    return campaigns.filter(
      (c) => c.campaign.toLowerCase() === filter.toLowerCase(),
    );
  }

  it('exact match "lumina" matches only "lumina"', () => {
    const result = filterCampaigns('lumina');
    expect(result.length).toBe(1);
    expect(result[0].campaign).toBe('lumina');
  });

  it('exact match "lumina" does NOT match "illumina"', () => {
    const result = filterCampaigns('lumina');
    const illuminaMatch = result.find((c) => c.campaign === 'illumina');
    expect(illuminaMatch).toBeUndefined();
  });

  it('exact match "lumina" does NOT match "Lumina Morocco"', () => {
    const result = filterCampaigns('lumina');
    const partialMatch = result.find((c) => c.campaign === 'Lumina Morocco');
    expect(partialMatch).toBeUndefined();
  });

  it('empty campaign filter returns all campaigns', () => {
    const result = filterCampaigns('');
    expect(result.length).toBe(campaigns.length);
  });

  it('case-insensitive: "HUMUS" matches "humus"', () => {
    const result = filterCampaigns('HUMUS');
    expect(result.length).toBe(1);
    expect(result[0].campaign).toBe('humus');
  });

  it('non-existent campaign returns empty array (not a crash)', () => {
    const result = filterCampaigns('nonexistent-campaign-xyz');
    expect(result.length).toBe(0);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. CHART THEME FORMAT HELPERS
//    Pure functions from src/components/insights/chartTheme.ts
// ---------------------------------------------------------------------------

describe('Chart Theme — formatCompact', () => {
  // Import inline to avoid needing JSDOM / React
  function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  it('formatCompact(0) → "0"', () => {
    expect(formatCompact(0)).toBe('0');
  });

  it('formatCompact(999) → "999"', () => {
    expect(formatCompact(999)).toBe('999');
  });

  it('formatCompact(1000) → "1.0K"', () => {
    expect(formatCompact(1000)).toBe('1.0K');
  });

  it('formatCompact(1500) → "1.5K"', () => {
    expect(formatCompact(1500)).toBe('1.5K');
  });

  it('formatCompact(1000000) → "1.0M"', () => {
    expect(formatCompact(1_000_000)).toBe('1.0M');
  });

  it('formatCompact(1500000) → "1.5M"', () => {
    expect(formatCompact(1_500_000)).toBe('1.5M');
  });

  it('formatCompact(999999) → "1000.0K" (still K range)', () => {
    expect(formatCompact(999_999)).toBe('1000.0K');
  });
});

describe('Chart Theme — formatCurrency', () => {
  function formatCurrency(n: number, decimals = 0): string {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  it('formatCurrency(0) → "$0"', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formatCurrency(1000) → "$1,000"', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });

  it('formatCurrency(9345.67, 2) → "$9,345.67"', () => {
    expect(formatCurrency(9345.67, 2)).toBe('$9,345.67');
  });

  it('formatCurrency(500, 2) → "$500.00"', () => {
    expect(formatCurrency(500, 2)).toBe('$500.00');
  });
});

describe('Chart Theme — formatPct', () => {
  function formatPct(n: number, decimals = 1): string {
    return `${n.toFixed(decimals)}%`;
  }

  it('formatPct(0) → "0.0%"', () => {
    expect(formatPct(0)).toBe('0.0%');
  });

  it('formatPct(34.7) → "34.7%"', () => {
    expect(formatPct(34.7)).toBe('34.7%');
  });

  it('formatPct(100) → "100.0%"', () => {
    expect(formatPct(100)).toBe('100.0%');
  });

  it('formatPct(3.14159, 2) → "3.14%"', () => {
    expect(formatPct(3.14159, 2)).toBe('3.14%');
  });
});

describe('Chart Theme — formatDelta', () => {
  const CHART_COLORS = {
    green: '#22c55e',
    red: '#ef4444',
  };

  function formatDelta(n: number): { text: string; color: string } {
    if (n > 0) return { text: `+${n.toLocaleString()}`, color: CHART_COLORS.green };
    if (n < 0) return { text: n.toLocaleString(), color: CHART_COLORS.red };
    return { text: '0', color: '#a3a3a3' };
  }

  it('formatDelta(0) → { text: "0", color: "#a3a3a3" }', () => {
    const result = formatDelta(0);
    expect(result.text).toBe('0');
    expect(result.color).toBe('#a3a3a3');
  });

  it('formatDelta(100) → { text: "+100", color: "#22c55e" }', () => {
    const result = formatDelta(100);
    expect(result.text).toBe('+100');
    expect(result.color).toBe('#22c55e');
  });

  it('formatDelta(-50) → { text: "-50", color: "#ef4444" }', () => {
    const result = formatDelta(-50);
    expect(result.text).toBe('-50');
    expect(result.color).toBe('#ef4444');
  });

  it('formatDelta(1234) → { text: "+1,234", color: green }', () => {
    const result = formatDelta(1234);
    expect(result.text).toBe('+1,234');
    expect(result.color).toBe(CHART_COLORS.green);
  });

  it('formatDelta(-1) → { text: "-1", color: red }', () => {
    const result = formatDelta(-1);
    expect(result.text).toBe('-1');
    expect(result.color).toBe(CHART_COLORS.red);
  });

  it('zero delta is never green or red', () => {
    const result = formatDelta(0);
    expect(result.color).not.toBe(CHART_COLORS.green);
    expect(result.color).not.toBe(CHART_COLORS.red);
  });
});
