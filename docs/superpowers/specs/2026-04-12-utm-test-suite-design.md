# UTM Builder, URL Shortener & Click Tracking — Test Suite Spec

**Date:** 2026-04-12
**Status:** Approved

## Goal

Deep test coverage for the 3 critical paths in the tracked links system: UTM URL building, slug generation/shortening, and click tracking. These MUST work flawlessly — recruiters depend on them for every campaign.

## Test Framework

**Vitest** — fast, native ESM, excellent Next.js compatibility. Install as devDependency with `@vitejs/plugin-react` for path alias resolution.

## Test Files (6 files, ~64 tests)

| File | Tests | Category |
|---|---|---|
| `src/lib/tracked-links/__tests__/build-url.test.ts` | ~8 | Pure unit |
| `src/lib/tracked-links/__tests__/slug-generator.test.ts` | ~5 | Pure unit |
| `src/lib/tracked-links/__tests__/source-options.test.ts` | ~8 | Pure unit |
| `src/lib/__tests__/slugify.test.ts` | ~10 | Pure unit |
| `src/app/api/tracked-links/__tests__/route.test.ts` | ~25 | Mocked integration |
| `src/app/r/[slug]/__tests__/route.test.ts` | ~8 | Mocked integration |

## What Each File Tests

### build-url: URL construction correctness
- Clean base URL gets all 5 UTM params appended
- Base URL with existing query params preserves them
- Special characters in UTM values are URL-encoded
- All 5 UTM param keys present in output
- Output is a valid URL

### slug-generator: Slug format guarantees
- Always exactly 6 characters
- Only uses base62 alphabet (0-9A-Za-z)
- No two consecutive calls produce identical slugs (probabilistic)
- Generates valid slugs under repeated calls (1000x)

### source-options: Validation guard correctness
- `isValidSource` accepts all 5 valid sources, rejects invalid
- `isValidContentForSource` validates content belongs to source
- `getContentOptionsForSource` returns correct subset per source
- `getDefaultContentForChannel` maps linkedin→linkedin_post, facebook→facebook, etc.
- Every content option has a valid source
- UTM_MEDIUM is always "referral"

### slugify: Text normalization correctness
- "Hello World" → "hello-world"
- Unicode accent removal: "Café Résumé" → "cafe-resume"
- Multiple delimiters collapsed: "a---b" → "a-b"
- Leading/trailing hyphens stripped
- Truncation at maxLen
- Empty string → ""
- Non-string input → ""
- Non-alphanumeric only → ""

### POST /api/tracked-links: Every validation gate
- 401 when unauthenticated
- 403 when role is viewer/designer
- 400 for missing required fields
- 400 INVALID_SOURCE for bad utm_source
- 400 INVALID_CONTENT for content not matching source
- 404 when campaign doesn't exist
- 403 when campaign not approved/sent
- 409 CAMPAIGN_SLUG_NOT_SET
- 409 LANDING_PAGES_NOT_SET
- 400 when base_url not in landing pages
- 400 when utm_term has no alphanumeric chars
- 200 success with correct short_url format
- Slug collision retry (mock UNIQUE violation, verify retry)
- 500 after all retries exhausted

### GET /api/tracked-links: Analytics accuracy
- Recruiter sees only own links (filtered by clerk_id)
- Admin sees all links
- utm_term filter works
- limit param works
- Summary: total_clicks sums correctly
- Summary: total_links count correct
- Summary: best_channel identifies highest
- Summary: best_channel percentage calculated correctly
- Summary: top_creative picks highest click_count
- Summary: clicks_today counts correctly
- Summary: recruiter_count counts distinct utm_term
- Summary: channel_count counts distinct utm_source
- Empty links → all summary fields zero/null

### GET /r/[slug]: Redirect + click tracking
- Valid slug → 301 redirect with correct Location header
- click_count incremented atomically
- last_clicked_at updated
- Invalid slug format (too short) → 404
- Invalid slug format (too long) → 404
- Invalid slug format (special chars) → 404
- Non-existent valid slug → 404
- Empty slug → 404

## Mock Strategy

```typescript
// Pure unit tests: NO mocks needed (build-url, slug-generator, source-options, slugify)

// API route tests mock 3 things:
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ getAuthContext: vi.fn() }));
vi.mock('@/lib/db/intake', () => ({ getIntakeRequest: vi.fn() }));
```
