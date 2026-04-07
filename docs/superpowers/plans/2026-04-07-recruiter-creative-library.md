# Recruiter Creative Library + UTM Tracked Link Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on testing:** This repo has no vitest/jest framework. Pure helpers are verified via **throwaway Node scripts with `assert`** (pattern previously used for Media Strategy Tab helpers — see `docs/superpowers/plans/2026-04-07-media-strategy-tab.md`). API routes are verified via `curl` against a running `npm run dev`. Frontend is verified visually via the dashboard and the Playwright MCP browser automation already set up in the project (`.playwright-mcp/`).
>
> **Required skill invocations while executing this plan:**
> - `vercel:nextjs` — when editing any `src/app/**` file (Next.js 16 App Router)
> - `vercel:vercel-functions` — when editing any `src/app/api/**` or `src/app/r/[slug]/route.ts` (route handlers / functions runtime)
> - `vercel:react-best-practices` — when editing any `src/components/**/*.tsx`
> - `vercel:next-cache-components` — only if adding `'use cache'` directives (we don't need to for this feature)

**Goal:** Overhaul the recruiter view into a tabbed workspace (Creatives · Performance · Overview) with per-channel creative browsing, an always-visible link builder bar that auto-populates on creative click, and a self-hosted short-link infrastructure with live click counts.

**Architecture:** New `campaign_slug` column on `intake_requests` + new `tracked_links` table. 5 new API routes (POST/GET `/api/tracked-links`, PATCH `/api/intake/[id]/campaign-slug`, GET `/r/[slug]` redirect) + 2 existing route extensions (`/api/auth/me`, `/api/intake` POST). New recruiter component tree under `src/components/recruiter/` replacing the body of `RecruiterDetailView`, preserving existing content inside a new Overview tab. Readiness gate enforces at-least-one landing page URL before link minting.

**Tech Stack:** Next.js 16 App Router · React 19 · Neon Postgres (template-tagged `sql`) · Clerk auth · Tailwind 4 · Lucide icons · sonner toasts · TypeScript

**Spec:** `docs/superpowers/specs/2026-04-07-recruiter-creative-library-design.md`

---

## File structure

### New files (10)

| Path | Purpose |
|---|---|
| `src/lib/slugify.ts` | Shared slugify helper (client + server) |
| `scripts/verify-slugify.mjs` | Throwaway Node verifier script for slugify |
| `src/lib/tracked-links/build-url.ts` | Pure helper that assembles destination URL with UTM params |
| `src/lib/tracked-links/slug-generator.ts` | Pure helper: 6-char base62 slug using `[0-9A-Za-z]` alphabet + `crypto.randomInt` |
| `scripts/verify-tracked-links-helpers.mjs` | Throwaway Node verifier for build-url + slug-generator |
| `src/app/api/tracked-links/route.ts` | POST (mint) + GET (list with aggregates) |
| `src/app/api/intake/[id]/campaign-slug/route.ts` | Admin PATCH route for inline campaign_slug editing |
| `src/app/r/[slug]/route.ts` | Public redirect route — atomic UPDATE + 301 |
| `src/components/recruiter/RecruiterWorkspace.tsx` | Top-level tabbed shell |
| `src/components/recruiter/CreativeLibrary.tsx` | Creatives tab — channel sub-tabs + selected-asset state |
| `src/components/recruiter/ChannelMessagingCard.tsx` | Gradient-bordered messaging strip per channel |
| `src/components/recruiter/CreativeGrid.tsx` | Grid of creative tiles with select + copy-caption + download |
| `src/components/recruiter/LinkBuilderBar.tsx` | Sticky builder bar with readiness-gate state machine |
| `src/components/recruiter/PerformanceTab.tsx` | Stats tiles + sortable links table + 30s polling |
| `src/components/CampaignSlugField.tsx` | Inline-editable admin field for campaign_slug |

### Modified files (8)

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add `tracked_links` table + `campaign_slug` column |
| `scripts/init-db.mjs` | Mirror the schema changes into the init statements array |
| `src/lib/types.ts` | Add `TrackedLink`, `TrackedLinksResponse`, `TrackedLinksSummary`; extend `IntakeRequest` with `campaign_slug: string \| null` |
| `src/app/api/intake/route.ts` | Auto-slugify `title` into `campaign_slug` on POST |
| `src/app/api/auth/me/route.ts` | Add `firstName`, `lastName`, `initials` to response |
| `src/components/RecruiterDetailView.tsx` | Export a new named `RecruiterOverviewTab` component wrapping the existing body |
| `src/app/intake/[id]/page.tsx` | Replace `<RecruiterDetailView>` with `<RecruiterWorkspace>` in the `role === 'recruiter'` branch |
| `src/components/CampaignPreviewPanel.tsx` | Mount `<CampaignSlugField>` below the campaign title (admin-only) |

---

## Phase A — Foundation: helpers, schema, types

### Task 1: Slugify helper

**Files:**
- Create: `src/lib/slugify.ts`
- Create: `scripts/verify-slugify.mjs`

- [ ] **Step 1: Implement slugify**

Create `src/lib/slugify.ts`:

```ts
/**
 * Convert arbitrary text to a URL-safe slug.
 * - lowercases
 * - replaces any run of non-alphanumeric chars with a single hyphen
 * - trims leading/trailing hyphens
 * - truncates to maxLen (default 60)
 * - returns empty string for empty/all-non-alphanumeric input
 */
export function slugify(input: string, maxLen = 60): string {
  if (typeof input !== 'string') return '';
  const lowered = input.toLowerCase();
  // Normalize unicode (strip accents): á → a
  const normalized = lowered.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  // Replace any run of non-alphanumeric with a single hyphen
  const dashed = normalized.replace(/[^a-z0-9]+/g, '-');
  // Trim leading/trailing hyphens
  const trimmed = dashed.replace(/^-+/, '').replace(/-+$/, '');
  // Truncate, then re-trim trailing hyphen in case the cut landed on one
  return trimmed.slice(0, maxLen).replace(/-+$/, '');
}
```

- [ ] **Step 2: Write the verifier script**

Create `scripts/verify-slugify.mjs`:

```js
import assert from 'node:assert/strict';
import { slugify } from '../src/lib/slugify.ts';

const cases = [
  ['Project Cutis', 'project-cutis'],
  ['  Spaces  Everywhere  ', 'spaces-everywhere'],
  ['Already-slugified', 'already-slugified'],
  ['Emoji 🔥 Test', 'emoji-test'],
  ['Café Montréal', 'cafe-montreal'],
  ['UPPER CASE', 'upper-case'],
  ['multiple!!!!separators!!!', 'multiple-separators'],
  ['---leading-trailing---', 'leading-trailing'],
  ['', ''],
  ['!!!!!!', ''],
  ['a'.repeat(200), 'a'.repeat(60)],
  ['aa----', 'aa'],
  ['SJ-like-a-boss', 'sj-like-a-boss'],
];

for (const [input, expected] of cases) {
  const actual = slugify(input);
  assert.equal(actual, expected, `slugify(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

console.log(`✓ ${cases.length} slugify assertions passed`);
```

- [ ] **Step 3: Run the verifier**

```bash
npx tsx scripts/verify-slugify.mjs
```

Expected output: `✓ 13 slugify assertions passed`

If `tsx` is not installed globally, use `npx --yes tsx scripts/verify-slugify.mjs`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/slugify.ts scripts/verify-slugify.mjs
git commit -m "feat(tracked-links): slugify helper + verifier script"
```

---

### Task 2: Slug generator (6-char base62)

**Files:**
- Create: `src/lib/tracked-links/slug-generator.ts`
- Create: `src/lib/tracked-links/build-url.ts`
- Create: `scripts/verify-tracked-links-helpers.mjs`

- [ ] **Step 1: Implement slug generator**

Create `src/lib/tracked-links/slug-generator.ts`:

```ts
import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SLUG_LENGTH = 6;

/**
 * Generate a random 6-character base62 slug using cryptographically-secure randomness.
 * Alphabet is [0-9A-Za-z] — no `-` or `_` to keep URLs visually clean.
 * 62^6 ≈ 56.8 billion possibilities.
 */
export function generateSlug(): string {
  let out = '';
  for (let i = 0; i < SLUG_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}
```

- [ ] **Step 2: Implement build-url**

Create `src/lib/tracked-links/build-url.ts`:

```ts
export interface UtmParams {
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_term: string;
  utm_content: string;
}

/**
 * Append UTM params to a base URL, properly URL-encoded.
 * Handles base URLs that already contain a query string.
 */
export function buildDestinationUrl(baseUrl: string, utm: UtmParams): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(utm)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
```

- [ ] **Step 3: Write the verifier script**

Create `scripts/verify-tracked-links-helpers.mjs`:

```js
import assert from 'node:assert/strict';
import { generateSlug } from '../src/lib/tracked-links/slug-generator.ts';
import { buildDestinationUrl } from '../src/lib/tracked-links/build-url.ts';

// --- slug generator ---
const slugs = new Set();
for (let i = 0; i < 1000; i++) {
  const s = generateSlug();
  assert.equal(s.length, 6, `slug length: ${s}`);
  assert.match(s, /^[0-9A-Za-z]{6}$/, `slug alphabet: ${s}`);
  slugs.add(s);
}
// 1000 draws should yield ~1000 unique values
assert.ok(slugs.size > 990, `expected ~1000 unique slugs in 1000 draws, got ${slugs.size}`);

// --- build url ---
const baseUtm = {
  utm_campaign: 'project-cutis-dermatology',
  utm_source: 'linkedin',
  utm_medium: 'social',
  utm_term: 'SJ-like-a-boss',
  utm_content: 'emily-square-01',
};

// Simple base URL
const simple = buildDestinationUrl('https://oneforma.com/apply/cutis', baseUtm);
assert.equal(
  simple,
  'https://oneforma.com/apply/cutis?utm_campaign=project-cutis-dermatology&utm_source=linkedin&utm_medium=social&utm_term=SJ-like-a-boss&utm_content=emily-square-01'
);

// Base URL with existing query string
const withQuery = buildDestinationUrl('https://oneforma.com/apply?src=email', baseUtm);
assert.ok(withQuery.includes('src=email'), `pre-existing query preserved: ${withQuery}`);
assert.ok(withQuery.includes('utm_campaign=project-cutis-dermatology'), 'utm_campaign appended');
assert.ok(withQuery.includes('utm_source=linkedin'), 'utm_source appended');

// Idempotent (calling twice with same params gives same result)
const once = buildDestinationUrl('https://oneforma.com/apply/cutis', baseUtm);
const twice = buildDestinationUrl(once, baseUtm);
assert.equal(once, twice, 'buildDestinationUrl should be idempotent');

// Special characters get encoded
const special = buildDestinationUrl('https://oneforma.com/apply/cutis', {
  ...baseUtm,
  utm_term: 'SJ with space',
});
assert.ok(special.includes('SJ+with+space') || special.includes('SJ%20with%20space'), `space encoded: ${special}`);

console.log('✓ slug generator + build-url verifier passed');
```

- [ ] **Step 4: Run the verifier**

```bash
npx tsx scripts/verify-tracked-links-helpers.mjs
```

Expected output: `✓ slug generator + build-url verifier passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/tracked-links/ scripts/verify-tracked-links-helpers.mjs
git commit -m "feat(tracked-links): slug generator + destination URL builder"
```

---

### Task 3: Schema migration (campaign_slug + tracked_links)

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `scripts/init-db.mjs`

- [ ] **Step 1: Add campaign_slug column + tracked_links table to `src/lib/db/schema.ts`**

Find the `intake_requests` CREATE TABLE block (~line 60) and **do not modify it** — the column will be added separately via `ALTER TABLE` to be safe for existing prod rows. Add this block immediately after the `intake_requests` table creation, before the existing `idx_intake_status` index:

```ts
  // Add campaign_slug column to existing intake_requests (idempotent)
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS campaign_slug TEXT
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_campaign_slug
      ON intake_requests(campaign_slug)
      WHERE campaign_slug IS NOT NULL
  `;
```

Then add this new table block after `campaign_landing_pages` (~line 170):

```ts
  // tracked_links — self-hosted short link store for recruiter UTM builder
  await sql`
    CREATE TABLE IF NOT EXISTS tracked_links (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug                TEXT NOT NULL UNIQUE,
      request_id          UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      asset_id            UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
      recruiter_clerk_id  TEXT NOT NULL,
      destination_url     TEXT NOT NULL,
      base_url            TEXT NOT NULL,
      utm_campaign        TEXT NOT NULL,
      utm_source          TEXT NOT NULL,
      utm_medium          TEXT NOT NULL DEFAULT 'social',
      utm_term            TEXT NOT NULL,
      utm_content         TEXT NOT NULL,
      click_count         INT NOT NULL DEFAULT 0,
      last_clicked_at     TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tracked_links_request ON tracked_links(request_id)`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tracked_links_recruiter
      ON tracked_links(recruiter_clerk_id, request_id)
  `;
```

- [ ] **Step 2: Mirror changes into `scripts/init-db.mjs`**

Append these 5 statements to the `statements` array in `scripts/init-db.mjs` (after the final existing statement before the closing `]`):

```js
  `ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS campaign_slug TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_intake_campaign_slug ON intake_requests(campaign_slug) WHERE campaign_slug IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS tracked_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE, asset_id UUID REFERENCES generated_assets(id) ON DELETE SET NULL, recruiter_clerk_id TEXT NOT NULL, destination_url TEXT NOT NULL, base_url TEXT NOT NULL, utm_campaign TEXT NOT NULL, utm_source TEXT NOT NULL, utm_medium TEXT NOT NULL DEFAULT 'social', utm_term TEXT NOT NULL, utm_content TEXT NOT NULL, click_count INT NOT NULL DEFAULT 0, last_clicked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_tracked_links_request ON tracked_links(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tracked_links_recruiter ON tracked_links(recruiter_clerk_id, request_id)`,
```

- [ ] **Step 3: Run the migration**

```bash
node scripts/init-db.mjs
```

Expected output includes lines showing each statement succeeded. The new `tracked_links` table should be reported in the final table count.

- [ ] **Step 4: Verify via psql or a quick Node snippet**

Run:

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'); return sql\`SELECT column_name FROM information_schema.columns WHERE table_name='tracked_links' ORDER BY ordinal_position\`.then(r => { console.log(r); process.exit(0); }); });"
```

Expected: list of all 14 columns from the CREATE TABLE above, in order.

- [ ] **Step 5: Backfill campaign_slug for existing approved campaigns**

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'); return sql\`UPDATE intake_requests SET campaign_slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')) WHERE campaign_slug IS NULL RETURNING id, title, campaign_slug\`.then(r => { console.log(\`Backfilled \${r.length} rows\`); console.log(r.slice(0,3)); process.exit(0); }); });"
```

This is a one-shot backfill — the postgres regex is a rough approximation of the TypeScript slugify (no accent stripping, no length cap), which is fine because admins can refine per campaign via the inline editor later.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts scripts/init-db.mjs
git commit -m "feat(tracked-links): schema - campaign_slug column + tracked_links table"
```

---

### Task 4: TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Extend `IntakeRequest` and add tracked-link types**

Open `src/lib/types.ts`, find the `IntakeRequest` interface, and add `campaign_slug: string | null;` to it (after `form_data`):

```ts
export interface IntakeRequest {
  // ... existing fields ...
  campaign_slug: string | null;
  // ... rest ...
}
```

Then append these new types at the bottom of the file:

```ts
// ─── Tracked Links ────────────────────────────────────────────────────────────

export interface TrackedLink {
  id: string;
  slug: string;
  request_id: string;
  asset_id: string | null;
  recruiter_clerk_id: string;
  destination_url: string;
  base_url: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_term: string;
  utm_content: string;
  click_count: number;
  last_clicked_at: string | null;
  created_at: string;
}

export interface TrackedLinkWithAsset extends TrackedLink {
  short_url: string;
  asset_thumbnail: string | null;
  asset_platform: string | null;
}

export interface TrackedLinksSummary {
  total_clicks: number;
  total_links: number;
  best_channel: { name: string; clicks: number; pct: number } | null;
  top_creative: { name: string; clicks: number; asset_id: string | null } | null;
}

export interface TrackedLinksResponse {
  links: TrackedLinkWithAsset[];
  summary: TrackedLinksSummary;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors referencing `campaign_slug`, fix the consumer (any code that constructs an `IntakeRequest` literal needs to include the new field or be type-assertion updated).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(tracked-links): add TrackedLink types + extend IntakeRequest"
```

---

### Task 5: Auto-slugify on intake POST

**Files:**
- Modify: `src/app/api/intake/route.ts`

- [ ] **Step 1: Read the existing POST handler**

Open `src/app/api/intake/route.ts` and locate the `POST` handler. Find where `createIntakeRequest` is called with form data.

- [ ] **Step 2: Import slugify and compute campaign_slug**

At the top of the file, add:

```ts
import { slugify } from '@/lib/slugify';
```

Inside the POST handler, just before the `createIntakeRequest` call, compute the slug:

```ts
const campaign_slug = slugify(body.title);
```

Then pass `campaign_slug` as a field on the create payload. If `createIntakeRequest` doesn't currently accept it, you also need to update `src/lib/db/intake.ts`:

Open `src/lib/db/intake.ts`, find `createIntakeRequest`, add `campaign_slug` to its parameter type and to the `INSERT` statement:

```ts
export async function createIntakeRequest(data: {
  // ... existing fields ...
  campaign_slug?: string | null;
}): Promise<IntakeRequest> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO intake_requests (
      title, task_type, urgency, target_languages, target_regions,
      volume_needed, created_by, form_data, schema_version,
      campaign_slug
    ) VALUES (
      ${data.title}, ${data.task_type}, ${data.urgency},
      ${data.target_languages}, ${data.target_regions},
      ${data.volume_needed}, ${data.created_by}, ${data.form_data},
      ${data.schema_version ?? 1},
      ${data.campaign_slug ?? null}
    )
    RETURNING *
  `;
  return rows[0] as IntakeRequest;
}
```

(Preserve any additional fields that already exist in the function — the above is a template. Match the existing field order.)

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: 0 TypeScript errors.

- [ ] **Step 4: Manual verification — create a test intake**

Start dev server: `npm run dev`

In another terminal, POST a test intake (use your existing dev account's clerk session — easiest path: go to http://localhost:3000/intake/new, fill the form with title "Test Campaign Slug 🔥", submit). Then check the DB:

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'); return sql\`SELECT id, title, campaign_slug FROM intake_requests ORDER BY created_at DESC LIMIT 1\`.then(r => { console.log(r); process.exit(0); }); });"
```

Expected: most recent row has `campaign_slug: 'test-campaign-slug'`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/intake/route.ts src/lib/db/intake.ts
git commit -m "feat(tracked-links): auto-slugify title into campaign_slug on POST /api/intake"
```

---

### Task 6: Extend `/api/auth/me` with firstName/lastName/initials

**Files:**
- Modify: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: Read the existing route**

Check what it currently returns. It likely returns `{ userId, role, email }` from `getAuthContext()`.

- [ ] **Step 2: Extend the handler**

Replace the handler body with:

```ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/db/user-roles';
import type { UserRole } from '@/lib/types';

function computeInitials(firstName: string | null, lastName: string | null): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f[0].toUpperCase();
  if (l) return l[0].toUpperCase();
  return '??';
}

/** Split a full name into [firstName, lastName] using whitespace. Single-token → both equal. */
function splitName(full: string): [string, string] {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return ['', ''];
  if (tokens.length === 1) return [tokens[0], tokens[0]];
  return [tokens[0], tokens[tokens.length - 1]];
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email: string | undefined;
  let firstName: string | null = null;
  let lastName: string | null = null;

  try {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
    firstName = user?.firstName ?? null;
    lastName = user?.lastName ?? null;
  } catch {
    // currentUser may fail in some contexts
  }

  const userRole = await getUserRole(userId, email);
  const role = (userRole?.role as UserRole) ?? 'viewer';

  // Fallback: split user_roles.name if Clerk didn't give us first/last
  if ((!firstName || !lastName) && userRole?.name) {
    const [f, l] = splitName(userRole.name);
    firstName = firstName ?? f;
    lastName = lastName ?? l;
  }

  const initials = computeInitials(firstName, lastName);

  return Response.json({
    userId,
    role,
    email,
    firstName,
    lastName,
    initials,
  });
}
```

- [ ] **Step 3: Verify via curl**

With dev server running, in your browser already logged in, open http://localhost:3000/api/auth/me in a new tab. You should see a JSON response including `firstName`, `lastName`, and `initials` (e.g. `"SJ"` for Steven Junop).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/me/route.ts
git commit -m "feat(auth): extend /api/auth/me with firstName, lastName, initials"
```

---

## Phase B — Backend API routes

### Task 7: `POST /api/tracked-links` — mint a short link

**Files:**
- Create: `src/app/api/tracked-links/route.ts`

- [ ] **Step 1: Implement the POST handler**

Create `src/app/api/tracked-links/route.ts`:

```ts
import { getAuthContext } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import { slugify } from '@/lib/slugify';
import { buildDestinationUrl } from '@/lib/tracked-links/build-url';
import { generateSlug } from '@/lib/tracked-links/slug-generator';

const MAX_TERM_LEN = 60;
const MAX_CONTENT_LEN = 60;
const MAX_SLUG_RETRIES = 5;

function getAppOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'recruiter' && ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    request_id?: string;
    asset_id?: string | null;
    base_url?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_term?: string;
    utm_content?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.request_id || !body.base_url || !body.utm_source || !body.utm_term || !body.utm_content) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const intake = await getIntakeRequest(body.request_id);
  if (!intake) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (intake.status !== 'approved' && intake.status !== 'sent') {
    return Response.json(
      { error: 'Campaign must be approved before tracked links can be created' },
      { status: 403 }
    );
  }
  if (!intake.campaign_slug) {
    return Response.json(
      { error: 'CAMPAIGN_SLUG_NOT_SET', message: 'Campaign tracking code not set — contact admin.' },
      { status: 409 }
    );
  }

  // Readiness gate: at least one landing page URL must be set
  const sql = getDb();
  const [lp] = await sql`
    SELECT job_posting_url, landing_page_url, ada_form_url
      FROM campaign_landing_pages
     WHERE request_id = ${body.request_id}
     LIMIT 1
  ` as unknown as Array<{
    job_posting_url: string | null;
    landing_page_url: string | null;
    ada_form_url: string | null;
  }>;

  const candidateUrls = [lp?.job_posting_url, lp?.landing_page_url, lp?.ada_form_url].filter(Boolean) as string[];
  if (candidateUrls.length === 0) {
    return Response.json(
      {
        error: 'LANDING_PAGES_NOT_SET',
        message: 'Marketing or designer must add at least one landing page URL before tracked links can be built.',
      },
      { status: 409 }
    );
  }
  if (!candidateUrls.includes(body.base_url)) {
    return Response.json({ error: 'INVALID_BASE_URL' }, { status: 400 });
  }

  // Server-side re-slugify (client state is untrusted)
  const utm_term = slugify(body.utm_term, MAX_TERM_LEN);
  const utm_content = slugify(body.utm_content, MAX_CONTENT_LEN);
  if (!utm_term || !utm_content) {
    return Response.json({ error: 'utm_term and utm_content must contain at least one alphanumeric character' }, { status: 400 });
  }

  const utm_medium = (body.utm_medium || 'social').trim();

  // Build the destination URL with all UTM params pre-appended
  const destination_url = buildDestinationUrl(body.base_url, {
    utm_campaign: intake.campaign_slug,
    utm_source: body.utm_source,
    utm_medium,
    utm_term,
    utm_content,
  });

  // Mint a unique slug with retry loop for the UNIQUE constraint
  let slug = '';
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    slug = generateSlug();
    try {
      const [row] = await sql`
        INSERT INTO tracked_links (
          slug, request_id, asset_id, recruiter_clerk_id,
          destination_url, base_url,
          utm_campaign, utm_source, utm_medium, utm_term, utm_content
        ) VALUES (
          ${slug}, ${body.request_id}, ${body.asset_id ?? null}, ${ctx.userId},
          ${destination_url}, ${body.base_url},
          ${intake.campaign_slug}, ${body.utm_source}, ${utm_medium}, ${utm_term}, ${utm_content}
        )
        RETURNING *
      `;
      const appOrigin = getAppOrigin(request);
      return Response.json({
        ...row,
        short_url: `${appOrigin}/r/${slug}`,
      });
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (attempt < MAX_SLUG_RETRIES - 1 && /duplicate|unique/i.test(msg)) {
        continue;
      }
      console.error('[api/tracked-links] POST failed:', e);
      if (/duplicate|unique/i.test(msg)) {
        return Response.json({ error: 'SLUG_COLLISION', message: 'Could not mint a unique slug. Try again.' }, { status: 500 });
      }
      return Response.json({ error: 'Failed to create tracked link' }, { status: 500 });
    }
  }

  return Response.json({ error: 'SLUG_COLLISION' }, { status: 500 });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build
```

Expected: 0 errors. (Note: the GET handler is in the next task — the route file has only POST for now, which is fine.)

- [ ] **Step 3: Manual verification — happy path**

With `npm run dev` running, grab an existing approved campaign ID. To find one quickly:

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'); return sql\`SELECT id, title, campaign_slug, status FROM intake_requests WHERE status IN ('approved','sent') ORDER BY created_at DESC LIMIT 3\`.then(r => { console.log(r); process.exit(0); }); });"
```

Copy one of the returned `id` values. Ensure it has at least one landing page URL set (use the Landing Pages card in admin mode to add one like `https://oneforma.com/apply/test` if needed).

Then in your browser console on http://localhost:3000 (while logged in), run (replace `<PASTE_ID_HERE>` with the real ID you just copied):

```js
await fetch('/api/tracked-links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request_id: '<PASTE_ID_HERE>',
    asset_id: null,
    base_url: 'https://oneforma.com/apply/test',
    utm_source: 'linkedin',
    utm_medium: 'social',
    utm_term: 'SJ',
    utm_content: 'test-01',
  }),
}).then(r => r.json()).then(console.log);
```

Expected: a JSON object with `id`, `slug` (6-char base62), `short_url` ending in `/r/<slug>`, and `destination_url` containing all 5 UTM params.

- [ ] **Step 4: Manual verification — readiness gate**

Remove all 3 landing page URLs from the test campaign (set each to empty string in the LandingPagesCard). Then run the same fetch again. Expected: 409 response with `error: 'LANDING_PAGES_NOT_SET'`.

- [ ] **Step 5: Manual verification — invalid base URL**

Restore a landing page URL (e.g. `https://oneforma.com/apply/test`). Run the fetch with `base_url: 'https://evil.example.com/phishing'`. Expected: 400 with `error: 'INVALID_BASE_URL'`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tracked-links/route.ts
git commit -m "feat(tracked-links): POST /api/tracked-links with readiness gate + slug minting"
```

---

### Task 8: `GET /api/tracked-links` — list links with aggregates

**Files:**
- Modify: `src/app/api/tracked-links/route.ts` (add GET handler)

- [ ] **Step 1: Add the GET handler**

Append the following to `src/app/api/tracked-links/route.ts` (after the existing POST):

```ts
export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'recruiter' && ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const request_id = url.searchParams.get('request_id');
  if (!request_id) {
    return Response.json({ error: 'request_id query param required' }, { status: 400 });
  }

  const sql = getDb();
  // Admin sees all links for this campaign; recruiter sees only their own
  const scope = ctx.role === 'admin' ? sql`TRUE` : sql`tl.recruiter_clerk_id = ${ctx.userId}`;

  const rows = await sql`
    SELECT
      tl.*,
      ga.blob_url AS asset_thumbnail,
      ga.platform AS asset_platform
    FROM tracked_links tl
    LEFT JOIN generated_assets ga ON tl.asset_id = ga.id
    WHERE tl.request_id = ${request_id}
      AND ${scope}
    ORDER BY tl.click_count DESC, tl.created_at DESC
  ` as unknown as Array<{
    id: string;
    slug: string;
    request_id: string;
    asset_id: string | null;
    recruiter_clerk_id: string;
    destination_url: string;
    base_url: string;
    utm_campaign: string;
    utm_source: string;
    utm_medium: string;
    utm_term: string;
    utm_content: string;
    click_count: number;
    last_clicked_at: string | null;
    created_at: string;
    asset_thumbnail: string | null;
    asset_platform: string | null;
  }>;

  const appOrigin = getAppOrigin(request);
  const links = rows.map((r) => ({ ...r, short_url: `${appOrigin}/r/${r.slug}` }));

  // Compute summary aggregates
  const total_clicks = links.reduce((s, l) => s + l.click_count, 0);
  const total_links = links.length;

  // Best channel: group by utm_source, sum clicks, find max
  const channelTotals = new Map<string, number>();
  for (const l of links) {
    channelTotals.set(l.utm_source, (channelTotals.get(l.utm_source) ?? 0) + l.click_count);
  }
  let best_channel: { name: string; clicks: number; pct: number } | null = null;
  if (channelTotals.size > 0 && total_clicks > 0) {
    const [name, clicks] = [...channelTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    best_channel = { name, clicks, pct: Math.round((clicks / total_clicks) * 100) };
  }

  // Top creative: find the link with the highest click count (and non-null asset_id)
  let top_creative: { name: string; clicks: number; asset_id: string | null } | null = null;
  const topLink = links[0];
  if (topLink && topLink.click_count > 0) {
    top_creative = {
      name: topLink.utm_content,
      clicks: topLink.click_count,
      asset_id: topLink.asset_id,
    };
  }

  return Response.json({
    links,
    summary: {
      total_clicks,
      total_links,
      best_channel,
      top_creative,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Manual verification**

With dev server running and the link from Task 7 already in the DB, fetch:

```js
await fetch('/api/tracked-links?request_id=<PASTE_ID_HERE>').then(r => r.json()).then(console.log);
```

Expected: JSON with `links` array containing your minted link (with `short_url` populated) and a `summary` object with `total_links: 1, total_clicks: 0`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tracked-links/route.ts
git commit -m "feat(tracked-links): GET /api/tracked-links list with summary aggregates"
```

---

### Task 9: `GET /r/[slug]` — redirect + atomic click counter

**Files:**
- Create: `src/app/r/[slug]/route.ts`
- Create: `src/app/r/[slug]/not-found.tsx` (optional branded 404)

- [ ] **Step 1: Implement the redirect route**

Create `src/app/r/[slug]/route.ts`:

```ts
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Guard against obviously invalid slugs before hitting the DB
  if (!/^[0-9A-Za-z]{6}$/.test(slug)) {
    return notFoundResponse();
  }

  const sql = getDb();
  const rows = await sql`
    UPDATE tracked_links
       SET click_count = click_count + 1,
           last_clicked_at = NOW()
     WHERE slug = ${slug}
     RETURNING destination_url
  ` as unknown as Array<{ destination_url: string }>;

  if (rows.length === 0) {
    return notFoundResponse();
  }

  return Response.redirect(rows[0].destination_url, 301);
}

function notFoundResponse(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Link not found — Nova</title>
  <style>
    :root { --fg: #1A1A1A; --muted: #737373; --border: #E5E5E5; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
      background: #FFFFFF;
      color: var(--fg);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .grad { height: 3px; background: linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224)); position: fixed; top: 0; left: 0; right: 0; }
    .card { max-width: 440px; text-align: center; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: var(--muted); font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
    a { color: var(--fg); text-decoration: none; font-weight: 600; padding: 10px 24px; border-radius: 9999px; background: #32373C; color: #fff; display: inline-block; }
    a:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="grad"></div>
  <div class="card">
    <h1>This link is no longer active</h1>
    <p>The short link you followed isn't valid. It may have been removed or mistyped.</p>
    <a href="/">Back to Nova</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Manual verification — happy path**

With dev server running, grab the slug from the link you minted in Task 7 (query the DB if needed: `SELECT slug FROM tracked_links ORDER BY created_at DESC LIMIT 1`).

Open `http://localhost:3000/r/<SLUG>` in a new tab. Expected: browser 301-redirects to the destination URL. Then query the DB again:

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'); return sql\`SELECT slug, click_count, last_clicked_at FROM tracked_links ORDER BY created_at DESC LIMIT 1\`.then(r => { console.log(r); process.exit(0); }); });"
```

Expected: `click_count = 1`, `last_clicked_at` is now populated.

- [ ] **Step 4: Manual verification — 404**

Open `http://localhost:3000/r/XXXXXX` (a slug that doesn't exist). Expected: the branded 404 HTML page renders with the gradient header and "Back to Nova" link.

- [ ] **Step 5: Manual verification — invalid slug format**

Open `http://localhost:3000/r/not-a-valid-slug`. Expected: 404 page (regex guard rejects before DB lookup).

- [ ] **Step 6: Commit**

```bash
git add src/app/r/
git commit -m "feat(tracked-links): /r/[slug] redirect route with atomic click counter"
```

---

### Task 10: `PATCH /api/intake/[id]/campaign-slug` — admin inline edit

**Files:**
- Create: `src/app/api/intake/[id]/campaign-slug/route.ts`

- [ ] **Step 1: Implement the PATCH handler**

Create `src/app/api/intake/[id]/campaign-slug/route.ts`:

```ts
import { getAuthContext } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import { slugify } from '@/lib/slugify';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const { id } = await params;
  const intake = await getIntakeRequest(id);
  if (!intake) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { campaign_slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.campaign_slug !== 'string') {
    return Response.json({ error: 'campaign_slug must be a string' }, { status: 400 });
  }

  const normalized = slugify(body.campaign_slug);
  if (!normalized) {
    return Response.json({ error: 'campaign_slug must contain at least one alphanumeric character' }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`
    UPDATE intake_requests
       SET campaign_slug = ${normalized},
           updated_at = NOW()
     WHERE id = ${id}
     RETURNING id, campaign_slug, updated_at
  `;

  return Response.json(rows[0]);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Manual verification**

With dev server running and logged in as admin, in the browser console:

```js
await fetch('/api/intake/<REQUEST_ID>/campaign-slug', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ campaign_slug: 'My Custom Code!' }),
}).then(r => r.json()).then(console.log);
```

Expected: `{ id: '...', campaign_slug: 'my-custom-code', updated_at: '...' }` (server re-slugified the input).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/intake/[id]/campaign-slug/
git commit -m "feat(tracked-links): PATCH /api/intake/[id]/campaign-slug admin route"
```

---

## Phase C — Frontend shell + refactor

### Task 11: Extract `RecruiterOverviewTab` from `RecruiterDetailView`

**Files:**
- Modify: `src/components/RecruiterDetailView.tsx`

- [ ] **Step 1: Read the current file**

Open `src/components/RecruiterDetailView.tsx`. Identify the body below the header (the `<div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto space-y-6">` block around line 238-652).

- [ ] **Step 2: Extract the body into a new named export**

Refactor the file so the current default export delegates to a new `RecruiterOverviewTab` component. The approach:

1. Extract everything inside the `return (...)` of `RecruiterDetailView` — everything EXCEPT the outer `<div className="flex-1 overflow-y-auto bg-[#FAFAFA]">`, the gradient stripe, and the header bar — into a new exported function `RecruiterOverviewTab` that takes the same props as `RecruiterDetailView`.
2. The new `RecruiterOverviewTab` returns the body div (`<div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto space-y-6"> ... </div>`) so it's a self-contained tab panel.
3. The original `RecruiterDetailView` default export continues to work for backwards compatibility — it now renders its own header + `<RecruiterOverviewTab {...props} />`.

Add at the top of the file (before the default export) — and move ALL hooks (`useState`, `useEffect`, helper functions) into `RecruiterOverviewTab` since they own the body state:

```ts
export function RecruiterOverviewTab({
  request,
  brief,
  assets,
  pipelineRuns,
}: RecruiterDetailViewProps) {
  // Move existing hooks + helpers here
  // Return the body `<div className="px-4 md:px-6 py-6 ...">...</div>` content
}
```

Then simplify `RecruiterDetailView` to:

```ts
export default function RecruiterDetailView(props: RecruiterDetailViewProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
      <div className="gradient-accent h-[3px]" />
      {/* existing header bar */}
      <RecruiterOverviewTab {...props} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: 0 TypeScript errors. Nothing else should have changed visually.

- [ ] **Step 4: Manual verification**

Open any existing approved campaign as a recruiter user (use `?role=recruiter` query param dev override). Confirm the page still renders exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecruiterDetailView.tsx
git commit -m "refactor(recruiter): extract RecruiterOverviewTab from RecruiterDetailView"
```

---

### Task 12: `RecruiterWorkspace` tabbed shell

**Files:**
- Create: `src/components/recruiter/RecruiterWorkspace.tsx`

- [ ] **Step 1: Create the tabbed shell**

Create `src/components/recruiter/RecruiterWorkspace.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Package, BarChart3, Info } from "lucide-react";
import { getRecruiterStatus } from "@/lib/format";
import { RecruiterOverviewTab } from "@/components/RecruiterDetailView";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  PipelineRun,
} from "@/lib/types";

type TabKey = "creatives" | "performance" | "overview";

interface RecruiterWorkspaceProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

export default function RecruiterWorkspace({
  request,
  brief,
  assets,
  pipelineRuns,
}: RecruiterWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("creatives");
  const statusInfo = getRecruiterStatus(request.status);
  const isApproved = request.status === "approved" || request.status === "sent";
  const approvedAssets = assets.filter((a) => a.evaluation_passed === true);

  // If the campaign isn't approved yet, skip the tab bar entirely and just show the existing
  // overview body (pipeline progress etc) — tabs only make sense post-approval.
  if (!isApproved) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="gradient-accent h-[3px]" />
        <HeaderBar request={request} statusInfo={statusInfo} showDownloadAll={false} approvedCount={0} />
        <RecruiterOverviewTab request={request} brief={brief} assets={assets} pipelineRuns={pipelineRuns} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
      <div className="gradient-accent h-[3px]" />
      <HeaderBar
        request={request}
        statusInfo={statusInfo}
        showDownloadAll={true}
        approvedCount={approvedAssets.length}
        onDownloadAll={() => {
          for (const asset of approvedAssets) {
            if (asset.blob_url) window.open(asset.blob_url, "_blank");
          }
        }}
      />

      {/* Tab bar */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 flex items-center gap-1">
          <TabButton active={activeTab === "creatives"} onClick={() => setActiveTab("creatives")} icon={<Package size={15} />} label="Creatives" />
          <TabButton active={activeTab === "performance"} onClick={() => setActiveTab("performance")} icon={<BarChart3 size={15} />} label="Performance" />
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={<Info size={15} />} label="Overview" />
        </div>
      </div>

      {/* Active tab body */}
      {activeTab === "creatives" && (
        <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
          {/* Phase D mounts CreativeLibrary here */}
          <p className="text-sm text-[var(--muted-foreground)]">Creatives tab — placeholder until Task 16.</p>
        </div>
      )}
      {activeTab === "performance" && (
        <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
          {/* Phase E mounts PerformanceTab here */}
          <p className="text-sm text-[var(--muted-foreground)]">Performance tab — placeholder until Task 17.</p>
        </div>
      )}
      {activeTab === "overview" && (
        <RecruiterOverviewTab request={request} brief={brief} assets={assets} pipelineRuns={pipelineRuns} />
      )}
    </div>
  );
}

function HeaderBar({
  request,
  statusInfo,
  showDownloadAll,
  approvedCount,
  onDownloadAll,
}: {
  request: IntakeRequest;
  statusInfo: ReturnType<typeof getRecruiterStatus>;
  showDownloadAll: boolean;
  approvedCount: number;
  onDownloadAll?: () => void;
}) {
  return (
    <div className="bg-white border-b border-[var(--border)] px-4 pl-14 lg:pl-6 md:pr-10 py-4">
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer shrink-0" aria-label="Back to campaigns">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">{request.title}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {request.campaign_slug && <span className="font-mono text-xs mr-2">{request.campaign_slug}</span>}
              {request.task_type.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border"
            style={{ color: statusInfo.color, background: statusInfo.bgColor, borderColor: statusInfo.borderColor }}
          >
            {statusInfo.label}
          </span>
          {showDownloadAll && approvedCount > 0 && onDownloadAll && (
            <button onClick={onDownloadAll} className="btn-primary cursor-pointer">
              <Download size={15} />
              Download All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 cursor-pointer transition-colors",
        active
          ? "text-[var(--foreground)] border-[#32373C]"
          : "text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Wire into the page**

Modify `src/app/intake/[id]/page.tsx`:

Find the block around line 329:

```tsx
if (role === "recruiter") {
  return (
    <AppShell>
      <RecruiterDetailView
        request={request}
        brief={brief}
        assets={assets}
        pipelineRuns={pipelineRuns}
      />
    </AppShell>
  );
}
```

Replace `RecruiterDetailView` with `RecruiterWorkspace` and update the import at the top of the file:

```tsx
import RecruiterWorkspace from "@/components/recruiter/RecruiterWorkspace";
```

And:

```tsx
if (role === "recruiter") {
  return (
    <AppShell>
      <RecruiterWorkspace
        request={request}
        brief={brief}
        assets={assets}
        pipelineRuns={pipelineRuns}
      />
    </AppShell>
  );
}
```

Leave the `import RecruiterDetailView` line in place — it's still used internally by `RecruiterWorkspace` via the `RecruiterOverviewTab` named export.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Manual verification**

Open an approved campaign as a recruiter (use `?role=recruiter` dev override). Expected:
- Tab bar with "Creatives / Performance / Overview" renders
- Creatives and Performance tabs show placeholder text
- Overview tab shows the full existing detail view (messaging themes, approved creatives grid, personas, request details)
- A campaign with `status=generating` does NOT show tabs — it shows the overview body directly with pipeline progress

- [ ] **Step 5: Commit**

```bash
git add src/components/recruiter/RecruiterWorkspace.tsx src/app/intake/[id]/page.tsx
git commit -m "feat(recruiter): RecruiterWorkspace tabbed shell with Overview tab wired"
```

---

## Phase D — Creative Library (Creatives tab body)

### Task 13: `ChannelMessagingCard` pure presentational component

**Files:**
- Create: `src/components/recruiter/ChannelMessagingCard.tsx`

- [ ] **Step 1: Implement the card**

Create `src/components/recruiter/ChannelMessagingCard.tsx`:

```tsx
"use client";

import { extractField } from "@/lib/format";
import type { CreativeBrief } from "@/lib/types";

const TAG_STYLES = [
  { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  { bg: "#fdf4ff", border: "#e9d5ff", text: "#6b21a8" },
  { bg: "#fefce8", border: "#fde68a", text: "#854d0e" },
  { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
];

interface ChannelMessagingCardProps {
  brief: CreativeBrief | null;
  channel: string;
}

export default function ChannelMessagingCard({ brief, channel }: ChannelMessagingCardProps) {
  const briefData = brief?.brief_data as Record<string, unknown> | undefined;
  const messagingStrategy = briefData?.messaging_strategy as Record<string, unknown> | undefined;
  const primaryMessage = extractField(messagingStrategy, "primary_message") || extractField(briefData, "summary");
  const tone = extractField(messagingStrategy, "tone");

  const rawValueProps =
    (briefData?.value_props as unknown[]) ??
    (messagingStrategy?.value_propositions as unknown[]) ??
    [];
  const valuePropTags: string[] = rawValueProps
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean)
    .slice(0, 6);

  if (!primaryMessage && valuePropTags.length === 0 && !tone) {
    return null;
  }

  return (
    <div
      className="rounded-xl p-5 border border-[var(--border)] mb-6"
      style={{
        background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)",
      }}
    >
      <div className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
        Key message for {channel}
      </div>
      {primaryMessage && (
        <p className="text-base font-semibold text-[var(--foreground)] leading-snug mb-3">
          &ldquo;{primaryMessage}&rdquo;
        </p>
      )}
      {valuePropTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {valuePropTags.map((tag, i) => {
            const style = TAG_STYLES[i % TAG_STYLES.length];
            return (
              <span
                key={i}
                className="text-xs font-medium px-3 py-1 rounded-full border"
                style={{ background: style.bg, borderColor: style.border, color: style.text }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
      {tone && (
        <div className="text-xs text-[var(--muted-foreground)] mt-2">
          <span className="font-medium">Tone:</span> {tone}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/ChannelMessagingCard.tsx
git commit -m "feat(recruiter): ChannelMessagingCard per-channel messaging strip"
```

---

### Task 14: `CreativeGrid` with select + copy caption + download

**Files:**
- Create: `src/components/recruiter/CreativeGrid.tsx`

- [ ] **Step 1: Implement the grid**

Create `src/components/recruiter/CreativeGrid.tsx`:

```tsx
"use client";

import { Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { extractField } from "@/lib/format";
import type { GeneratedAsset } from "@/lib/types";

interface CreativeGridProps {
  assets: GeneratedAsset[];
  selectedAssetId: string | null;
  onSelect: (asset: GeneratedAsset) => void;
}

/** Get post-friendly caption text (organic), stripping ad-specific fields. */
function getOrganicCaption(asset: GeneratedAsset): string {
  return (
    extractField(asset.copy_data, "primary_text") ||
    extractField(asset.copy_data, "caption") ||
    extractField(asset.copy_data, "hook") ||
    extractField(asset.content, "overlay_sub") ||
    ""
  );
}

function getHeadline(asset: GeneratedAsset): string {
  return (
    extractField(asset.content, "overlay_headline") ||
    extractField(asset.copy_data, "headline") ||
    ""
  );
}

export default function CreativeGrid({ assets, selectedAssetId, onSelect }: CreativeGridProps) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
        No creatives for this channel yet.
      </div>
    );
  }

  async function handleCopyCaption(e: React.MouseEvent, caption: string) {
    e.stopPropagation();
    if (!caption) {
      toast.error("No caption available for this creative");
      return;
    }
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied to clipboard");
    } catch {
      toast.error("Could not copy caption");
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      {assets.map((asset) => {
        const selected = asset.id === selectedAssetId;
        const headline = getHeadline(asset);
        const caption = getOrganicCaption(asset);

        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={[
              "group text-left bg-white border rounded-xl overflow-hidden cursor-pointer transition-all",
              selected
                ? "border-[#9B51E0] ring-2 ring-[#9B51E0]/20 shadow-md"
                : "border-[var(--border)] hover:border-[#32373C]",
            ].join(" ")}
          >
            <div className="aspect-square bg-[var(--muted)] relative overflow-hidden">
              {asset.blob_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.blob_url}
                  alt={headline || "Creative"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[var(--muted-foreground)]">
                  No preview
                </div>
              )}
              {selected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#9B51E0] text-white flex items-center justify-center shadow-sm">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="p-3 space-y-2">
              {headline && (
                <p className="text-xs font-semibold text-[var(--foreground)] line-clamp-2">{headline}</p>
              )}
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={(e) => handleCopyCaption(e, caption)}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
                  disabled={!caption}
                  title={caption || "No caption available"}
                >
                  <Copy size={11} />
                  Copy caption
                </button>
                {asset.blob_url && (
                  <a
                    href={asset.blob_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    download
                    className="flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
                    title="Download image"
                  >
                    <Download size={11} />
                  </a>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/CreativeGrid.tsx
git commit -m "feat(recruiter): CreativeGrid with select + copy caption + download"
```

---

### Task 15: `LinkBuilderBar` with readiness gate state machine

**Files:**
- Create: `src/components/recruiter/LinkBuilderBar.tsx`

- [ ] **Step 1: Implement the builder bar**

Create `src/components/recruiter/LinkBuilderBar.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Copy, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";
import type { GeneratedAsset } from "@/lib/types";

export type LandingPageKey = "job_posting_url" | "landing_page_url" | "ada_form_url";

const LANDING_PAGE_LABEL: Record<LandingPageKey, string> = {
  job_posting_url: "Job Posting",
  landing_page_url: "Landing Page",
  ada_form_url: "ADA Form",
};

interface LandingPagesData {
  job_posting_url: string | null;
  landing_page_url: string | null;
  ada_form_url: string | null;
}

interface LinkBuilderBarProps {
  requestId: string;
  campaignSlug: string | null;
  activeChannel: string;
  selectedAsset: GeneratedAsset | null;
  recruiterInitials: string;
}

/** Derive a human-readable content slug from an asset (e.g. "emily-square-01"). */
function deriveContentSlug(asset: GeneratedAsset | null): string {
  if (!asset) return "creative";
  const actor = slugify(asset.actor_id ?? "creative").slice(0, 20) || "creative";
  const format = slugify(asset.format ?? "asset").slice(0, 12) || "asset";
  const idTail = asset.id.replace(/-/g, "").slice(0, 2);
  return `${actor}-${format}-${idTail}`;
}

export default function LinkBuilderBar({
  requestId,
  campaignSlug,
  activeChannel,
  selectedAsset,
  recruiterInitials,
}: LinkBuilderBarProps) {
  const [landingPages, setLandingPages] = useState<LandingPagesData | null>(null);
  const [selectedUrlKey, setSelectedUrlKey] = useState<LandingPageKey | null>(null);
  const [term, setTerm] = useState(recruiterInitials || "??");
  const [content, setContent] = useState("");
  const [medium, setMedium] = useState("social");
  const [submitting, setSubmitting] = useState(false);

  // Fetch landing pages on mount
  const fetchLandingPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/intake/${requestId}/landing-pages`);
      if (res.ok) {
        const data = await res.json();
        setLandingPages(data);
      }
    } catch {
      // silent
    }
  }, [requestId]);

  useEffect(() => {
    fetchLandingPages();
  }, [fetchLandingPages]);

  // Compute available URLs
  const availableUrls = useMemo(() => {
    if (!landingPages) return [];
    const entries: Array<{ key: LandingPageKey; url: string }> = [];
    if (landingPages.job_posting_url) entries.push({ key: "job_posting_url", url: landingPages.job_posting_url });
    if (landingPages.landing_page_url) entries.push({ key: "landing_page_url", url: landingPages.landing_page_url });
    if (landingPages.ada_form_url) entries.push({ key: "ada_form_url", url: landingPages.ada_form_url });
    return entries;
  }, [landingPages]);

  // Readiness gate state
  const readinessState: "disabled" | "ready" =
    availableUrls.length === 0 ? "disabled" : "ready";

  // Poll every 10s while disabled to auto-clear the banner when URLs are added
  useEffect(() => {
    if (readinessState !== "disabled") return;
    const interval = setInterval(fetchLandingPages, 10000);
    return () => clearInterval(interval);
  }, [readinessState, fetchLandingPages]);

  // Default the selectedUrlKey once URLs arrive
  useEffect(() => {
    if (availableUrls.length === 0) {
      setSelectedUrlKey(null);
      return;
    }
    if (!selectedUrlKey || !availableUrls.some((u) => u.key === selectedUrlKey)) {
      // Prefer landing_page_url, then job_posting_url, then ada_form_url
      const preference: LandingPageKey[] = ["landing_page_url", "job_posting_url", "ada_form_url"];
      const match = preference.find((p) => availableUrls.some((u) => u.key === p));
      setSelectedUrlKey(match ?? availableUrls[0].key);
    }
  }, [availableUrls, selectedUrlKey]);

  // Update term when initials prop changes
  useEffect(() => {
    setTerm(recruiterInitials || "??");
  }, [recruiterInitials]);

  // Update content when selected asset changes
  useEffect(() => {
    setContent(deriveContentSlug(selectedAsset));
  }, [selectedAsset]);

  const selectedUrl = availableUrls.find((u) => u.key === selectedUrlKey)?.url ?? null;

  const canSubmit =
    readinessState === "ready" &&
    !submitting &&
    !!campaignSlug &&
    !!selectedUrl &&
    !!selectedAsset &&
    term.trim().length > 0 &&
    content.trim().length > 0;

  async function handleCopyLink() {
    if (!canSubmit || !selectedUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tracked-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          asset_id: selectedAsset?.id ?? null,
          base_url: selectedUrl,
          utm_source: activeChannel,
          utm_medium: medium,
          utm_term: term,
          utm_content: content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || "Failed to create tracked link");
        return;
      }
      await navigator.clipboard.writeText(data.short_url);
      toast.success(`Short link copied! ${data.short_url}`);
    } catch (e) {
      toast.error("Failed to create tracked link");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (readinessState === "disabled") {
    return (
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-amber-300 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 md:px-6 py-3 z-20">
        <div className="max-w-[1100px] mx-auto flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-[var(--foreground)] flex-1">
            <span className="font-semibold">Waiting for landing page URLs.</span>{" "}
            <span className="text-[var(--muted-foreground)]">
              Marketing or the designer needs to add at least one URL before you can build tracked links.
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t-2 border-[#9B51E0] shadow-[0_-6px_16px_rgba(0,0,0,0.08)] px-4 md:px-6 py-3 z-20">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-[10px] font-bold text-[#9B51E0] uppercase tracking-wider mb-2">
          🔗 Your Tracked Link
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <FieldReadonly label="Campaign" value={campaignSlug ?? "—"} />
          <FieldReadonly label="Posting to" value={activeChannel} />
          <FieldEditable
            label="Your tag"
            value={term}
            onChange={setTerm}
            onBlur={() => setTerm(slugify(term) || recruiterInitials || "??")}
          />
          <FieldEditable
            label="Creative"
            value={content}
            onChange={setContent}
            onBlur={() => setContent(slugify(content) || deriveContentSlug(selectedAsset))}
          />
          {availableUrls.length > 1 ? (
            <div>
              <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">Destination</div>
              <select
                value={selectedUrlKey ?? ""}
                onChange={(e) => setSelectedUrlKey(e.target.value as LandingPageKey)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)] cursor-pointer"
              >
                {availableUrls.map((u) => (
                  <option key={u.key} value={u.key}>
                    {LANDING_PAGE_LABEL[u.key]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <FieldReadonly label="Destination" value={selectedUrlKey ? LANDING_PAGE_LABEL[selectedUrlKey] : "—"} />
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-xs text-[var(--muted-foreground)] font-mono truncate">
            {selectedUrl ? `${selectedUrl.slice(0, 60)}${selectedUrl.length > 60 ? "…" : ""}` : "Pick a destination"}
          </div>
          <button
            onClick={handleCopyLink}
            disabled={!canSubmit}
            className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
            {submitting ? "Copying…" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">{label}</div>
      <div className="text-xs px-2 py-1.5 rounded-md bg-[var(--muted)] text-[var(--foreground)] font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function FieldEditable({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">{label} ✎</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-white"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/LinkBuilderBar.tsx
git commit -m "feat(recruiter): LinkBuilderBar sticky builder with readiness gate"
```

---

### Task 16: `CreativeLibrary` — stitches channels + messaging + grid + builder

**Files:**
- Create: `src/components/recruiter/CreativeLibrary.tsx`
- Modify: `src/components/recruiter/RecruiterWorkspace.tsx` to mount CreativeLibrary

- [ ] **Step 1: Implement CreativeLibrary**

Create `src/components/recruiter/CreativeLibrary.tsx`:

```tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import ChannelMessagingCard from "./ChannelMessagingCard";
import CreativeGrid from "./CreativeGrid";
import LinkBuilderBar from "./LinkBuilderBar";
import type { CreativeBrief, GeneratedAsset } from "@/lib/types";

interface CreativeLibraryProps {
  requestId: string;
  campaignSlug: string | null;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
}

const CHANNEL_ORDER = ["linkedin", "facebook", "instagram", "reddit"];

function sortChannels(a: string, b: string): number {
  const ai = CHANNEL_ORDER.indexOf(a.toLowerCase());
  const bi = CHANNEL_ORDER.indexOf(b.toLowerCase());
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

export default function CreativeLibrary({
  requestId,
  campaignSlug,
  brief,
  assets,
}: CreativeLibraryProps) {
  const approvedAssets = useMemo(
    () => assets.filter((a) => a.evaluation_passed === true && a.blob_url),
    [assets]
  );

  const channels = useMemo(() => {
    const unique = new Set(approvedAssets.map((a) => a.platform).filter(Boolean) as string[]);
    return [...unique].sort(sortChannels);
  }, [approvedAssets]);

  const [activeChannel, setActiveChannel] = useState<string>(() => channels[0] ?? "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [recruiterInitials, setRecruiterInitials] = useState<string>("??");

  // Fetch recruiter initials on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.initials) setRecruiterInitials(data.initials);
      })
      .catch(() => {});
  }, []);

  // Keep active channel valid
  useEffect(() => {
    if (channels.length === 0) return;
    if (!channels.includes(activeChannel)) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  // Filter assets for the active channel
  const channelAssets = useMemo(
    () => approvedAssets.filter((a) => a.platform === activeChannel),
    [approvedAssets, activeChannel]
  );

  // Auto-select first asset when channel changes
  useEffect(() => {
    if (channelAssets.length === 0) {
      setSelectedAssetId(null);
      return;
    }
    if (!selectedAssetId || !channelAssets.some((a) => a.id === selectedAssetId)) {
      setSelectedAssetId(channelAssets[0].id);
    }
  }, [channelAssets, selectedAssetId]);

  const selectedAsset = channelAssets.find((a) => a.id === selectedAssetId) ?? null;

  if (channels.length === 0) {
    return (
      <div className="px-4 md:px-6 py-12 max-w-[1100px] mx-auto text-center text-sm text-[var(--muted-foreground)]">
        No approved creatives yet. Waiting for marketing to approve assets.
      </div>
    );
  }

  return (
    <>
      <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto pb-32">
        {/* Channel sub-tabs */}
        <div className="flex gap-2 flex-wrap mb-5">
          {channels.map((ch) => {
            const label = CHANNEL_LABEL[ch] ?? ch;
            const count = approvedAssets.filter((a) => a.platform === ch).length;
            const active = activeChannel === ch;
            return (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={[
                  "text-xs font-medium px-4 py-2 rounded-full border transition-colors cursor-pointer",
                  active
                    ? "bg-[#32373C] text-white border-[#32373C]"
                    : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-[#32373C]",
                ].join(" ")}
              >
                {label} · {count}
              </button>
            );
          })}
        </div>

        <ChannelMessagingCard brief={brief} channel={CHANNEL_LABEL[activeChannel] ?? activeChannel} />

        <CreativeGrid
          assets={channelAssets}
          selectedAssetId={selectedAssetId}
          onSelect={(a) => setSelectedAssetId(a.id)}
        />
      </div>

      <LinkBuilderBar
        requestId={requestId}
        campaignSlug={campaignSlug}
        activeChannel={activeChannel}
        selectedAsset={selectedAsset}
        recruiterInitials={recruiterInitials}
      />
    </>
  );
}
```

- [ ] **Step 2: Mount into RecruiterWorkspace**

Modify `src/components/recruiter/RecruiterWorkspace.tsx`:

1. Add the import at the top:

```tsx
import CreativeLibrary from "./CreativeLibrary";
```

2. Replace the Creatives tab placeholder block:

```tsx
{activeTab === "creatives" && (
  <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
    <p className="text-sm text-[var(--muted-foreground)]">Creatives tab — placeholder until Task 16.</p>
  </div>
)}
```

with:

```tsx
{activeTab === "creatives" && (
  <CreativeLibrary
    requestId={request.id}
    campaignSlug={request.campaign_slug}
    brief={brief}
    assets={assets}
  />
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Manual verification**

Open an approved campaign as a recruiter. Expected:
- Creatives tab now shows channel sub-tabs (LinkedIn, Facebook, Instagram, Reddit — only those with assets)
- Clicking a channel updates messaging card + creative grid
- Clicking a creative highlights it with the purple border + checkmark, and updates the builder bar's content field
- If at least one landing page URL is set on the campaign, the builder bar is active; the COPY LINK button works and copies a real short URL to clipboard
- If NO landing page URLs are set, the bar shows the warning banner instead
- Caption copy button on each creative tile copies the asset's `primary_text` to clipboard
- Download button on each tile triggers the image download

- [ ] **Step 5: Manual verification — end to end**

Mint a real tracked link via the builder. Copy it. Open it in a new tab — verify it 301s to the destination with all UTM params appended. Check the DB:

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'); return sql\`SELECT slug, utm_source, utm_term, utm_content, click_count FROM tracked_links ORDER BY created_at DESC LIMIT 3\`.then(r => { console.log(r); process.exit(0); }); });"
```

Expected: newest row has `click_count >= 1`.

- [ ] **Step 6: Commit**

```bash
git add src/components/recruiter/CreativeLibrary.tsx src/components/recruiter/RecruiterWorkspace.tsx
git commit -m "feat(recruiter): CreativeLibrary wires channel tabs + messaging + grid + builder"
```

---

## Phase E — Performance tab

### Task 17: `PerformanceTab` with stats tiles + sortable table + polling

**Files:**
- Create: `src/components/recruiter/PerformanceTab.tsx`
- Modify: `src/components/recruiter/RecruiterWorkspace.tsx`

- [ ] **Step 1: Implement PerformanceTab**

Create `src/components/recruiter/PerformanceTab.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Copy, ExternalLink, Trophy, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { TrackedLinkWithAsset, TrackedLinksSummary, TrackedLinksResponse } from "@/lib/types";

interface PerformanceTabProps {
  requestId: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PerformanceTab({ requestId }: PerformanceTabProps) {
  const [data, setData] = useState<TrackedLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracked-links?request_id=${requestId}`);
      if (res.ok) {
        const json = (await res.json()) as TrackedLinksResponse;
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredLinks = useMemo(() => {
    if (!data) return [];
    if (channelFilter === "all") return data.links;
    return data.links.filter((l) => l.utm_source === channelFilter);
  }, [data, channelFilter]);

  const channels = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.links.map((l) => l.utm_source))].sort();
  }, [data]);

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-12 max-w-[1100px] mx-auto text-center text-sm text-[var(--muted-foreground)]">
        Loading tracked links…
      </div>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <div className="px-4 md:px-6 py-16 max-w-[1100px] mx-auto text-center">
        <BarChart3 size={40} className="mx-auto text-[var(--muted-foreground)] mb-4" />
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">No tracked links yet</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
          Go to the Creatives tab, click a creative, and hit Copy Link. Your click counts will start showing up here.
        </p>
      </div>
    );
  }

  const { summary } = data;
  const topLinkId = filteredLinks[0]?.id;

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Short link copied!");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
      <StatsStrip summary={summary} />

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Your tracked links</h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filteredLinks.length} of {data.links.length}
        </span>
        <div className="flex-1" />
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] bg-white cursor-pointer"
        >
          <option value="all">All channels</option>
          {channels.map((ch) => (
            <option key={ch} value={ch}>
              {CHANNEL_LABEL[ch] ?? ch}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {filteredLinks.map((link, i) => (
          <LinkRow
            key={link.id}
            link={link}
            isTop={link.id === topLinkId && link.click_count > 0}
            showBorder={i > 0}
            onCopy={copyLink}
          />
        ))}
      </div>

      <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-4">
        Updates every 30 seconds · Click counts include all redirects since creation
      </p>
    </div>
  );
}

function StatsStrip({ summary }: { summary: TrackedLinksSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div
        className="rounded-xl p-4 border border-[var(--border)]"
        style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)" }}
      >
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Total Clicks
        </div>
        <div className="text-3xl font-extrabold text-[#0693e3]">{summary.total_clicks}</div>
      </div>
      <div className="rounded-xl p-4 border border-[var(--border)] bg-white">
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Your Links
        </div>
        <div className="text-3xl font-extrabold text-[var(--foreground)]">{summary.total_links}</div>
      </div>
      <div className="rounded-xl p-4 border border-[var(--border)] bg-white">
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Best Channel
        </div>
        {summary.best_channel ? (
          <>
            <div className="text-base font-bold text-[var(--foreground)]">
              {CHANNEL_LABEL[summary.best_channel.name] ?? summary.best_channel.name}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              {summary.best_channel.clicks} clicks · {summary.best_channel.pct}%
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--muted-foreground)]">—</div>
        )}
      </div>
      <div className="rounded-xl p-4 border border-[var(--border)] bg-white">
        <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">
          Top Creative
        </div>
        {summary.top_creative ? (
          <>
            <div className="text-base font-bold text-[var(--foreground)] truncate">
              🏆 {summary.top_creative.name}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              {summary.top_creative.clicks} clicks
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--muted-foreground)]">—</div>
        )}
      </div>
    </div>
  );
}

function LinkRow({
  link,
  isTop,
  showBorder,
  onCopy,
}: {
  link: TrackedLinkWithAsset;
  isTop: boolean;
  showBorder: boolean;
  onCopy: (url: string) => void;
}) {
  const channelLabel = CHANNEL_LABEL[link.utm_source] ?? link.utm_source;
  return (
    <div
      className={[
        "grid grid-cols-[40px_1fr_auto_auto_auto] gap-3 items-center px-4 py-3",
        showBorder && "border-t border-[var(--border)]",
        isTop && "bg-yellow-50",
      ].filter(Boolean).join(" ")}
    >
      <div className="w-10 h-10 bg-[var(--muted)] rounded-lg overflow-hidden relative shrink-0">
        {link.asset_thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.asset_thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] text-[var(--muted-foreground)]">—</div>
        )}
        {isTop && (
          <div className="absolute -top-1 -right-1 text-base" title="Top performer">
            <Trophy size={14} className="text-amber-500" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-mono font-semibold text-[var(--foreground)] truncate">
          {link.short_url.replace(/^https?:\/\//, "")}
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)] truncate">
          {channelLabel} · {link.utm_content} · {link.utm_term} · {timeAgo(link.created_at)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xl font-extrabold ${link.click_count === 0 ? "text-[var(--muted-foreground)]" : "text-green-600"}`}>
          {link.click_count}
        </div>
        <div className="text-[9px] text-[var(--muted-foreground)]">clicks</div>
      </div>
      <button
        onClick={() => onCopy(link.short_url)}
        className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
        title="Copy short URL"
      >
        <Copy size={13} />
      </button>
      <a
        href={link.short_url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
        title="Open in new tab"
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Mount into RecruiterWorkspace**

Modify `src/components/recruiter/RecruiterWorkspace.tsx` — add the import:

```tsx
import PerformanceTab from "./PerformanceTab";
```

And replace the Performance tab placeholder:

```tsx
{activeTab === "performance" && (
  <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
    <p className="text-sm text-[var(--muted-foreground)]">Performance tab — placeholder until Task 17.</p>
  </div>
)}
```

with:

```tsx
{activeTab === "performance" && <PerformanceTab requestId={request.id} />}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Manual verification**

Open an approved campaign as a recruiter with at least one tracked link already minted (from Task 16 verification). Switch to the Performance tab. Expected:
- 4 stats tiles render with correct numbers
- Sortable table shows the tracked links with click counts
- Top performer has yellow highlight + trophy icon (if any link has clicks)
- Copy button copies the short URL
- Open button navigates to the short URL in a new tab
- If you open the short URL and come back, within 30 seconds the row should update to show the incremented count

- [ ] **Step 5: Commit**

```bash
git add src/components/recruiter/PerformanceTab.tsx src/components/recruiter/RecruiterWorkspace.tsx
git commit -m "feat(recruiter): PerformanceTab with stats tiles + sortable links table + polling"
```

---

## Phase F — Admin campaign_slug inline editor

### Task 18: `CampaignSlugField` inline-editable component + mount

**Files:**
- Create: `src/components/CampaignSlugField.tsx`
- Modify: `src/components/CampaignPreviewPanel.tsx`

- [ ] **Step 1: Implement CampaignSlugField**

Create `src/components/CampaignSlugField.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface CampaignSlugFieldProps {
  requestId: string;
  initialValue: string | null;
  canEdit: boolean;
}

export default function CampaignSlugField({ requestId, initialValue, canEdit }: CampaignSlugFieldProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  async function handleBlur() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === (initialValue ?? "")) {
      setValue(initialValue ?? "");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/intake/${requestId}/campaign-slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_slug: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        setValue(initialValue ?? "");
        return;
      }
      setValue(data.campaign_slug);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
      setValue(initialValue ?? "");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return value ? (
      <div className="text-xs font-mono text-[var(--muted-foreground)]">{value}</div>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[var(--muted-foreground)] uppercase font-semibold text-[10px]">Tracking code:</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="campaign-slug"
        className="font-mono px-2 py-1 rounded-md border border-[var(--border)] bg-white focus:border-[#32373C] focus:outline-none"
      />
      {saving ? (
        <Loader2 size={12} className="animate-spin text-[var(--muted-foreground)]" />
      ) : saved ? (
        <Check size={12} className="text-green-600" />
      ) : (
        <Pencil size={11} className="text-[var(--muted-foreground)]" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in CampaignPreviewPanel**

Open `src/components/CampaignPreviewPanel.tsx`. Find where the campaign title renders (search for `request.title` or the `<h1>` / `<h2>` containing the title). Mount `<CampaignSlugField>` directly below the title, passing `canEdit={role === 'admin'}`.

Example (adapt to the actual JSX structure — the file may differ):

```tsx
import CampaignSlugField from "@/components/CampaignSlugField";
// ... existing imports ...

// Inside the JSX, after the title:
<h2>{request.title}</h2>
<CampaignSlugField
  requestId={request.id}
  initialValue={request.campaign_slug ?? null}
  canEdit={role === "admin"}
/>
```

The exact location depends on the current layout — put it in the header/meta area, not buried deep in the body.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Manual verification**

Log in as admin. Open the dashboard. Click a campaign in the CampaignList. The preview panel on the right should now show the tracking code field below the title. Edit it (type something new) and click outside — verify the green check appears and the value updates. Refresh the page and verify it persisted. Also verify that typing `UPPER Case!` normalizes to `upper-case` after blur (server-side slugify).

- [ ] **Step 5: Commit**

```bash
git add src/components/CampaignSlugField.tsx src/components/CampaignPreviewPanel.tsx
git commit -m "feat(admin): inline CampaignSlugField in preview panel with auto-save"
```

---

## Phase G — Final verification + deploy

### Task 19: End-to-end manual verification

- [ ] **Step 1: Full happy path**

1. As recruiter, open an approved campaign
2. Land on Creatives tab → channel sub-tabs render with counts → LinkedIn is active by default
3. First creative is auto-selected (purple border + checkmark)
4. Builder bar at the bottom shows all 5 fields populated, destination URL preview visible
5. Edit the term suffix to `-test-run` → blur → normalizes to `<initials>-test-run`
6. Click COPY LINK → toast fires, clipboard contains the short URL
7. Open the short URL in a new tab → 301 redirects to destination with all 5 UTM params in the query string
8. Switch to Performance tab → new link appears with click_count = 1
9. Click the short URL again from Performance tab's Open button → click_count should reach 2 within 30s (polling)
10. Switch to Overview tab → existing detail view (personas, messaging, request details) renders unchanged

- [ ] **Step 2: Readiness gate path**

1. As admin, remove all 3 landing page URLs from a test campaign (use Landing Pages card)
2. As recruiter, reload the campaign → builder bar shows the amber warning banner
3. As admin, re-add one URL in a separate tab
4. Within 10 seconds, the recruiter's builder bar should transition from warning → active
5. Mint a link → verify the mint uses the URL that was added

- [ ] **Step 3: Admin slug editing path**

1. As admin, open the dashboard, select a campaign
2. Edit the `CampaignSlugField` inline to something custom like `my-test-slug-2026`
3. Switch role to recruiter, open the same campaign
4. Mint a tracked link → verify the `utm_campaign` in the destination URL reflects the new slug

- [ ] **Step 4: Edge cases**

1. Open a campaign in `draft` or `generating` status as recruiter → verify tabs are hidden, overview body renders instead
2. Open a campaign with zero approved assets → Creatives tab shows empty state
3. Visit `http://localhost:3000/r/XXXXXX` (non-existent slug) → branded 404 HTML page
4. Visit `http://localhost:3000/r/not-valid` → 404 page (regex guard)

- [ ] **Step 5: Stash WIP and deploy**

The main branch has pre-existing uncommitted edits (`src/components/CampaignWorkspace.tsx`, `worker/ai/*.py`) per `nova-intake-deploy-workflow.md`. Before deploying, stash any unrelated WIP so the deploy is clean:

```bash
git status
git stash push -m "pre-deploy-stash-$(date +%s)" -- <any-still-uncommitted-unrelated-files>
```

- [ ] **Step 6: Deploy to nova-intake prod**

```bash
vercel --prod --scope team_aIEQ7vb1eDrP2XPzKf40iUqx
```

Capture the deployment URL from the output, then alias it:

```bash
vercel alias set <deployment-url> nova-intake.vercel.app --scope team_aIEQ7vb1eDrP2XPzKf40iUqx
```

- [ ] **Step 7: Prod smoke test**

Open `https://nova-intake.vercel.app` → log in → open an approved campaign as recruiter → mint a tracked link → click the short URL from a new tab → confirm 301 + click count increments on the Performance tab.

- [ ] **Step 8: Pop stashed WIP**

```bash
git stash pop
```

- [ ] **Step 9: Final commit (if any small fixes emerged from smoke test)**

If the smoke test surfaces any small issues, fix them and commit. If not, no additional commit is needed — the feature is live.

---

## Self-review against the spec

This section is a checklist — verify each spec section has a corresponding task before handing off.

| Spec section | Covered by |
|---|---|
| § 1 Architecture overview | Tasks 3, 7, 8, 9 (schema, API routes) + Task 12 (workspace shell) |
| § 2a `campaign_slug` column | Task 3 (schema) + Task 5 (auto-slugify) + Task 18 (admin edit) |
| § 2b `tracked_links` table | Task 3 (schema) |
| § 2c Migration location | Task 3 |
| § 3a POST /api/tracked-links | Task 7 |
| § 3b GET /api/tracked-links | Task 8 |
| § 3c GET /r/[slug] | Task 9 |
| § 3d PATCH campaign-slug | Task 10 |
| § 3e GET /api/auth/me extension | Task 6 |
| § 3f POST /api/intake extension | Task 5 |
| § 4 Frontend components (new) | Tasks 12-18 |
| § 4 Modified files | Tasks 5, 6, 11, 12, 18 |
| § 5a Data flow | Implicit in Tasks 7-17 (happy path verifiable in Task 19) |
| § 5b Error handling | Tasks 7, 9, 15 (LinkBuilderBar handles clipboard rejection + disabled state) |
| § 5c Testing strategy | Tasks 1, 2 (verifier scripts), Task 19 (manual checklist) |
| § 6 Readiness gate | Task 7 (server-side) + Task 15 (client-side + polling) |

**Known intentional v1 omissions (from spec § scope):**
- No vitest integration test suite (repo has no test framework — we use verifier scripts + manual checklist per the existing pattern)
- No Playwright E2E test (spec marks it optional for v1)
- No cross-recruiter admin dashboard for Performance (v2 parking lot)
- No per-click event log, no branded short domain, no Bitly integration, no QR, no expiration (all v2)

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-07-recruiter-creative-library.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a plan this size (19 tasks) since each task is self-contained and benefits from fresh context.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
