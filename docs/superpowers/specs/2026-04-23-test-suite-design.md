# Comprehensive Test Suite — Insights + AudienceIQ + HIE

## Overview

Full test pyramid for the 130+ files built across the Insights Dashboard, AudienceIQ (5 phases), and HIE behavioral layer. 168 tests across 3 tiers: unit (mocked DB, pure logic), integration (real Neon DB, real SQL), and e2e (full pipeline flows).

## Test Runner

Vitest 4.x (already installed). All tests in one runner. Config at `vitest.config.ts` (or inline in `package.json`).

## Test Isolation Pattern

Integration and e2e tests use the real Neon DB (`DATABASE_URL`). Isolation via prefix:

```typescript
// tests/helpers.ts
import crypto from 'crypto';

export function testId(): string {
  return `test-${crypto.randomUUID().slice(0, 8)}`;
}

export function testEmail(prefix: string): string {
  return `${prefix}-${testId()}@test.nova.local`;
}
```

- All test data uses `test-*` prefixed IDs, titles, emails
- `afterAll` in each integration/e2e file cleans up via `DELETE FROM table WHERE id::text LIKE 'test-%'` or similar
- No interference between parallel runs

## Mock Pattern (Unit Tests)

Unit tests mock `getDb()` and CRM functions:

```typescript
import { vi } from 'vitest';

// Mock the DB module
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => {
    // Return a mock tagged template function
    const mockSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      return mockSql._results.shift() ?? [];
    };
    mockSql._results = [] as unknown[][];
    mockSql._pushResult = (rows: unknown[]) => { mockSql._results.push(rows); };
    return mockSql;
  }),
}));
```

For CRM connection mocks:

```typescript
vi.mock('@/lib/crm/client', () => ({
  isCrmConnected: vi.fn(() => false),
  isCrmSyncEnabled: vi.fn(() => false),
  getCrmPool: vi.fn(() => null),
  queryCrm: vi.fn(async () => null),
}));
```

---

## Unit Tests (81 tests, mocked DB)

### `tests/unit/drift-calculator.test.ts` — 15 tests

Tests the `computeDrift` function and helpers from `src/lib/audienceiq/drift-calculator.ts`.

1. `compareRegions` returns 100% overlap for identical arrays
2. `compareRegions` returns 0% overlap for disjoint arrays
3. `compareRegions` returns correct % for partial overlap
4. `compareLanguages` handles empty arrays (100% overlap)
5. `compareSkills` handles empty objects (100% overlap)
6. `computePairwiseDrift` returns 0 when either profile has sample_size=0
7. `computePairwiseDrift` returns 0 for identical profiles
8. `computePairwiseDrift` returns ~100 for completely different profiles
9. `computeDrift` applies correct weights (paid_vs_converted=0.30 is highest)
10. `computeDrift` returns severity='low' for drift <= 15
11. `computeDrift` returns severity='moderate' for drift 15-25
12. `computeDrift` returns severity='high' for drift > 25
13. `computeDrift` sets segment_mismatch=true when drift > 15
14. `computeDrift` generates recommendations for high paid_vs_converted drift
15. `computeDrift` handles all-empty profiles gracefully (0 drift)

### `tests/unit/health-scorer.test.ts` — 12 tests

Tests `computeHealth` from `src/lib/audienceiq/health-scorer.ts`.

1. Returns score=100 with no issues when all data is healthy
2. Deducts 30 for quality_drift when avg_quality < 50 (critical)
3. Deducts 20 for quality_drift when avg_quality 50-70 (warning)
4. Deducts 25 for retention_drift when active_pct < 50
5. Deducts 25 for skill_mismatch when overlap < 30%
6. Deducts 20 for geo_mismatch when region overlap < 30%
7. Deducts 15 for high_drift when overall_drift > 25
8. Deducts 15 for paid_conversion_gap when paid_vs_converted > 30
9. Does NOT deduct for small_sample (info only)
10. Reports crm_unavailable when CRM not connected (no deduction)
11. Multiple issues stack — score can drop below 0, clamped to 0
12. Each issue has correct type, message, recommended_action, severity, deduction

### `tests/unit/profile-builder.test.ts` — 10 tests

Tests profile builder functions from `src/lib/audienceiq/profile-builder.ts`.

1. `buildDeclaredProfile` extracts target_regions from intake_requests
2. `buildDeclaredProfile` extracts target_languages from intake_requests
3. `buildDeclaredProfile` extracts qualifications as skills
4. `buildDeclaredProfile` returns confidence='high' and source='intake_form'
5. `buildDeclaredProfile` returns empty profile for missing request
6. `buildConvertedProfile` returns empty with source='crm_unavailable' when CRM disconnected
7. `buildConvertedProfile` aggregates countries from crm_sync_cache
8. `buildConvertedProfile` computes avg_quality_score and active_pct
9. `buildConvertedProfile` sets confidence based on sample_size thresholds
10. `buildAndStoreAllProfiles` calls all 4 builders and upserts

### `tests/unit/normalizer.test.ts` — 8 tests

Tests `getMergedPaidAudience` from `src/lib/platforms/normalizer.ts`.

1. Returns empty platforms_available when no platforms connected
2. Merges impressions/clicks/conversions/spend across platforms
3. Merges region counts correctly
4. Merges demographics age_ranges across platforms
5. Deduplicates interests
6. Handles single platform (only Google connected)
7. Handles all 4 platforms connected
8. Returns per_platform array with individual platform data

### `tests/unit/hie-ingest.test.ts` — 10 tests

Tests `registerSession` and `ingestBatch` from `src/lib/hie/ingest.ts`.

1. `registerSession` rejects missing session_id
2. `registerSession` rejects missing visitor_id
3. `registerSession` derives device_type='mobile' for viewport < 768
4. `registerSession` derives device_type='tablet' for viewport 768-1023
5. `registerSession` derives device_type='desktop' for viewport >= 1024
6. `ingestBatch` routes scroll_depth to hie_scroll_events
7. `ingestBatch` routes click_interaction to hie_interaction_events
8. `ingestBatch` routes cta_click to hie_interaction_events
9. `ingestBatch` rejects unknown event_type
10. `ingestBatch` rejects events with missing session_id

### `tests/unit/hie-diagnostics.test.ts` — 12 tests

Tests `runDiagnostics` from `src/lib/hie/diagnostics.ts`.

1. Returns empty observations when no data exists
2. Detects scroll_cliff when >30% drop between milestones
3. Does NOT detect scroll_cliff for <30% drop
4. Sets confidence='high' when sample >= 100 sessions
5. Sets confidence='medium' for 30-99 sessions
6. Sets confidence='low' for <30 sessions
7. Detects cta_weakness when hovers > 10 but clicks = 0
8. Detects form_friction at 100% abandonment
9. Detects form_friction at >70% abandonment
10. Does NOT detect form_friction for <70% abandonment
11. Detects platform_mismatch when mobile engagement < 40% of desktop
12. Returns recommended_action for each observation

### `tests/unit/identity-stitching.test.ts` — 8 tests

Tests functions from `src/lib/crm/identity.ts`.

1. `hashEmail` (internal) produces consistent SHA-256 hex for same email
2. `hashEmail` normalizes to lowercase + trimmed
3. `stitchSignup` creates identity with email_hash
4. `stitchSignup` passes utm_slug when provided
5. `autoMatchContributors` matches CRM records to tracked_links via utm_campaign
6. `autoMatchContributors` skips already-matched contributors
7. `autoMatchContributors` returns count of newly matched
8. `autoMatchContributors` handles 0 unmatched gracefully

### `tests/unit/widget-registry.test.ts` — 6 tests

Tests the widget registry at `src/components/insights/widgetRegistry.ts`.

1. Registry has exactly 30 widget entries
2. Every WidgetType in types.ts has a matching registry entry
3. Every registry entry has a valid category from WIDGET_CATEGORIES
4. Every registry entry has a non-empty label and description
5. Every registry entry has defaultSize with w and h > 0
6. Every registry entry has minSize <= defaultSize

---

## Integration Tests (80 tests, real Neon DB)

### `tests/integration/dashboard-crud.test.ts` — 12 tests

Tests the full dashboard CRUD lifecycle via API routes.

1. POST /api/insights creates a dashboard and returns 201
2. GET /api/insights returns list including created dashboard
3. GET /api/insights/[id] returns the dashboard by ID
4. PATCH /api/insights/[id] updates title and layout_data
5. POST /api/insights/[id]/duplicate creates a copy with '(copy)' suffix
6. DELETE /api/insights/[id] removes dashboard, returns 200
7. GET /api/insights/[id] returns 404 after delete
8. POST /api/insights/[id]/share toggles is_shared and returns share_token
9. POST /api/insights/[id]/share again disables sharing
10. PATCH /api/insights/[id]/share sets password hash
11. GET /api/insights/public/[token] returns dashboard data
12. GET /api/insights/public/[token] returns 401 when password protected

### `tests/integration/insights-metrics.test.ts` — 10 tests

Tests metrics API endpoints with seeded test data.

1. GET /api/insights/metrics/pipeline returns status counts
2. GET /api/insights/metrics/pipeline?recruiterId= filters by created_by
3. GET /api/insights/metrics/assets returns by_type and pass_rate
4. GET /api/insights/metrics/clicks returns summary + by_source
5. GET /api/insights/metrics/workers returns by_status + avg_duration
6. GET /api/insights/metrics/activity returns by_region + by_language
7. GET /api/insights/metrics/utm-funnel returns 5 breakdowns
8. GET /api/insights/metrics/utm-funnel?recruiterId=self resolves to user ID
9. GET /api/insights/metrics/recruiter-leaderboard returns ranked list
10. GET /api/insights/metrics/creative-performance returns asset-to-click data

### `tests/integration/audienceiq-apis.test.ts` — 14 tests

Tests AudienceIQ CRM, funnel, quality, identity APIs.

1. GET /api/audienceiq/crm/status returns connected=false when no CRM_DATABASE_URL
2. GET /api/audienceiq/crm/status returns cached_contributors count
3. POST /api/audienceiq/crm/sync returns sync result
4. GET /api/audienceiq/crm/contributors?campaign= returns filtered list
5. GET /api/audienceiq/crm/contributors?source= returns filtered list
6. GET /api/audienceiq/crm/contributors returns 400 with no params
7. GET /api/audienceiq/funnel/[id] returns 4 stages with conversion rates
8. GET /api/audienceiq/funnel/[id] returns connected=false when CRM off
9. GET /api/audienceiq/quality returns channels with avg_quality
10. GET /api/audienceiq/quality returns connected=false when CRM off
11. POST /api/audienceiq/identity/resolve creates visitor_identity
12. POST /api/audienceiq/identity/resolve returns 400 without email
13. POST /api/audienceiq/identity/resolve merges existing identity
14. GET /api/audienceiq/crm/contributors returns quality_score-sorted results

### `tests/integration/drift-health-apis.test.ts` — 8 tests

Tests drift computation and retrieval APIs.

1. GET /api/audienceiq/drift/[id] returns computed=false initially
2. POST /api/audienceiq/drift/compute builds profiles + drift + health
3. POST /api/audienceiq/drift/compute returns 400 without request_id
4. GET /api/audienceiq/drift/[id] returns computed=true with drift data after compute
5. GET /api/audienceiq/health/[id] returns score and issues after compute
6. GET /api/audienceiq/profiles/[id] returns 4 ring profiles after compute
7. POST /api/audienceiq/drift/compute returns severity based on drift threshold
8. Drift snapshot stores evidence and recommendations

### `tests/integration/hie-apis.test.ts` — 10 tests

Tests HIE ingest and query APIs.

1. POST /api/hie/session registers session (201)
2. POST /api/hie/session rejects missing fields (400)
3. POST /api/hie/batch ingests click events
4. POST /api/hie/batch ingests scroll events
5. POST /api/hie/batch rejects > 100 events
6. POST /api/hie/batch returns accepted + rejected counts
7. GET /api/hie/heatmap returns click density for page
8. GET /api/hie/heatmap returns 400 without page_url
9. GET /api/hie/scrollmap returns depth bands
10. GET /api/hie/diagnostics returns observations array

### `tests/integration/platform-apis.test.ts` — 8 tests

Tests ad platform sync and status APIs.

1. GET /api/audienceiq/platforms/status returns 4 platforms
2. GET /api/audienceiq/platforms/status shows connected=false for all without env vars
3. POST /api/audienceiq/platforms/sync returns results for all 4
4. POST /api/audienceiq/platforms/google/sync returns wired stub message
5. POST /api/audienceiq/platforms/meta/sync returns wired stub message
6. POST /api/audienceiq/platforms/linkedin/sync returns wired stub message
7. POST /api/audienceiq/platforms/tiktok/sync returns wired stub message
8. Platform status row_count matches cache table count

### `tests/integration/auth-gates.test.ts` — 10 tests

Tests authentication and authorization enforcement.

1. All /api/insights/* routes return 401 without auth
2. POST /api/audienceiq/crm/sync requires admin role
3. POST /api/audienceiq/drift/compute requires admin role
4. POST /api/hie/session does NOT require auth (public)
5. POST /api/hie/batch does NOT require auth (public)
6. GET /api/hie/heatmap requires auth
7. POST /api/audienceiq/platforms/sync requires admin role
8. GET /api/insights/public/[token] does NOT require auth
9. POST /api/hie/facts/refresh requires admin role
10. GET /api/audienceiq/crm/status requires auth but any role

### `tests/integration/crm-degradation.test.ts` — 8 tests

Tests graceful degradation when CRM_DATABASE_URL is not set.

1. GET /api/audienceiq/crm/status returns connected=false
2. GET /api/audienceiq/funnel/[id] returns connected=false with empty stages
3. GET /api/audienceiq/quality returns connected=false with empty channels
4. POST /api/audienceiq/drift/compute still works (skips Ring 4)
5. Drift snapshot has paid_vs_converted=0 when CRM unavailable
6. Health score reports crm_unavailable issue (no deduction)
7. POST /api/audienceiq/crm/sync returns success=false with helpful message
8. GET /api/audienceiq/crm/contributors returns empty when CRM off

---

## E2E Flow Tests (17 tests, real API + DB)

### `tests/e2e/campaign-to-drift.test.ts` — 6 tests

Full pipeline: campaign → links → clicks → CRM sync → drift.

1. Create intake_request with target_regions + target_languages
2. Create tracked_links for the request with UTM params
3. Simulate clicks by incrementing click_count
4. Insert CRM contributors matching the UTM campaign
5. Trigger drift computation — verify 4 profiles built
6. Verify drift score reflects the declared-vs-converted gap

### `tests/e2e/dashboard-lifecycle.test.ts` — 5 tests

Dashboard create → configure → share → public view → cleanup.

1. Create dashboard via POST
2. Update with layout_data containing 3 widgets
3. Enable sharing — get share_token
4. Access via public endpoint — verify layout returned
5. Delete dashboard — verify cleanup

### `tests/e2e/identity-flow.test.ts` — 4 tests

Anonymous → known identity resolution.

1. Create tracked_link for a campaign
2. Insert CRM contributor with matching UTM campaign
3. Call autoMatchContributors — verify identity created
4. Verify visitor_identities row has crm_user_id + email_hash

### `tests/e2e/hie-flow.test.ts` — 4 tests

Session → events → query → diagnostics.

1. Register HIE session
2. Ingest batch of click + scroll events for a page
3. Query heatmap — verify cells returned
4. Query scrollmap — verify depth bands returned

---

## Test Helpers

### `tests/helpers.ts` — Shared utilities

- `testId()` — unique test prefix
- `testEmail(prefix)` — test email
- `seedIntakeRequest(overrides)` — insert test intake_request, return ID
- `seedTrackedLink(requestId, overrides)` — insert test tracked_link
- `seedCrmContributor(overrides)` — insert test crm_sync_cache row
- `seedHieSession(overrides)` — insert test hie_session
- `seedHieEvents(sessionId, events)` — insert test events
- `cleanupTestData()` — delete all test-* prefixed rows from every table
- `callApi(method, path, body?)` — fetch wrapper for API calls (adds auth header mock)

---

## Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### `tests/setup.ts`

Global setup: loads `.env.local`, validates `DATABASE_URL` is set for integration tests.
