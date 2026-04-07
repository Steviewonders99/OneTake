# Recruiter Creative Library + UTM Tracked Link Builder — Design Spec

**Date:** 2026-04-07
**Status:** Approved design, ready for implementation plan
**Owner:** Steven Junop

## Goal

Overhaul the recruiter detail view from a simplified read-only page into a tabbed workspace that lets recruiters quickly browse approved organic creatives per channel, copy caption text, and — most critically — generate short tracked links with auto-filled UTM parameters that they can paste into their own LinkedIn, Facebook, Instagram, and Reddit posts. Add a Performance tab that shows live click counts per link so recruiters get instant feedback on what's working.

This is the recruiter's most critical daily workflow and must be dumb-proof: two clicks from landing on the page to a short link in the clipboard, zero typing required in the happy path.

## Why

- Recruiters currently see a flat grid of approved creatives with no per-channel grouping, no caption copy, and no link tracking infrastructure
- There is no way today for recruiters to track which of their social posts are actually driving traffic, which means the team has zero attribution at the individual recruiter + creative level
- The workflow today is: download image → manually write a caption → paste into social → lose visibility into what converts. This spec replaces each of those steps with a pre-filled, one-click equivalent
- OneForma's business model depends on global contributors finding the job posts — recruiters sharing via their own networks is a meaningful channel, and giving them data on what works will drive more sharing

## Scope

### In scope

- New tabbed top-level structure for the recruiter view: **Creatives · Performance · Overview**
- Per-channel browsing experience (LinkedIn, Facebook, Instagram, Reddit — dynamically derived from asset platforms)
- Sticky link builder bar that auto-populates when a creative is clicked, supports copy-to-clipboard with a single action
- Self-hosted short-link infrastructure (6-char base62 slugs on `nova-intake.vercel.app/r/...`)
- Performance tab with live click counts, sortable table, stats tiles, 🏆 top-performer highlighting, 30-second polling
- New `campaign_slug` column on `intake_requests`, auto-slugified at submission time, admin-editable inline in `CampaignPreviewPanel`
- Readiness gate: link building is disabled until at least one of the 3 landing page URLs is set by marketing or designer

### Explicitly out of scope (v2 parking lot)

- Cross-recruiter admin dashboard for the Performance view
- Per-click event log (geo, UA, referrer, timestamp-level analytics)
- External shortener integration (Bitly, etc.)
- Branded short domain (e.g., `go.oneforma.com`)
- QR code generation
- Link expiration / revocation
- Unique visitor counting (requires IP hashing)
- Custom vanity slugs
- Bulk CSV export of tracked links
- Separate organic vs ad asset generation in the Stage 4 pipeline — for v1 we repurpose the existing paid creatives for organic use by filtering copy fields at the view layer

## User workflow (happy path)

1. Steven (recruiter) opens an approved campaign at `/intake/<id>`
2. RecruiterWorkspace mounts, active tab = Creatives, active channel = LinkedIn, first creative auto-selected
3. LinkBuilderBar at the bottom is already populated with `campaign = project-cutis-dermatology`, `source = linkedin`, `medium = social`, `term = SJ`, `content = emily-square-01`, base URL = `landing_page_url`
4. Steven wants to tag this post specifically — he edits the term to `SJ-like-a-boss` (client-side slugify on blur keeps the format clean)
5. Steven clicks **COPY LINK** — short URL `nova-intake.vercel.app/r/a3f2xk` is minted server-side and copied to clipboard. Toast confirms.
6. Steven pastes the short URL into a LinkedIn post
7. Someone clicks it on LinkedIn → `GET /r/a3f2xk` atomically increments `click_count` and 301 redirects to the full UTM-tagged destination URL
8. Steven switches to the Performance tab → sees the new link with `1 click`, auto-refreshing every 30 seconds. Over the next day his best-performing link rises to the top with a 🏆 badge.

## Architecture overview

```
┌─ RECRUITER VIEW (approved/sent status only) ──────────────┐
│  Header: title · status · download all                    │
│                                                            │
│  ┌─ Tabs ─────────────────────────────────────────────┐  │
│  │ [Creatives] [Performance] [Overview]               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Creatives tab ────────────────────────────────────┐  │
│  │ Channel sub-tabs: LinkedIn · FB · IG · Reddit      │  │
│  │ ├─ Key message / value props card (per channel)    │  │
│  │ ├─ Creative grid w/ caption + download buttons     │  │
│  │ └─ STICKY LinkBuilderBar (click creative→auto-fill)│  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Performance tab ──────────────────────────────────┐  │
│  │ 4 stats tiles + sortable tracked-links table      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Overview tab ─────────────────────────────────────┐  │
│  │ Existing RecruiterDetailView content preserved     │  │
│  │ (campaign summary, personas, request details)      │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

          Recruiter clicks [COPY LINK]
                    ↓
     POST /api/tracked-links
     → validate gate (landing pages set)
     → validate role + campaign status
     → assemble destination_url with UTM params
     → mint 6-char base62 slug (retry on UNIQUE)
     → INSERT tracked_links row
     → return short_url
                    ↓
     Client copies to clipboard + toast

          Someone clicks the short URL
                    ↓
     GET /r/[slug]
     → UPDATE tracked_links
          SET click_count = click_count + 1,
              last_clicked_at = NOW()
        WHERE slug = $1 RETURNING destination_url
     → 301 Moved Permanently
                    ↓
     Performance tab polls /api/tracked-links every 30s
     → table + stats update live
```

## Schema changes

### `intake_requests.campaign_slug` column (new)

```sql
ALTER TABLE intake_requests
  ADD COLUMN IF NOT EXISTS campaign_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_intake_campaign_slug
  ON intake_requests(campaign_slug)
  WHERE campaign_slug IS NOT NULL;
```

- Auto-populated on `POST /api/intake` via `slugify(title)` helper
- Admin-editable inline via a new `CampaignSlugField` in `CampaignPreviewPanel` (auto-save on blur, matches `LandingPagesCard` pattern)
- Used as the locked `utm_campaign` value for every tracked link on the request

### `tracked_links` table (new)

```sql
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
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug);
CREATE INDEX IF NOT EXISTS idx_tracked_links_request ON tracked_links(request_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_recruiter
  ON tracked_links(recruiter_clerk_id, request_id);
```

**Design notes:**

- `slug` has `UNIQUE` — mint retry loop handles the (astronomically rare) collision
- `asset_id` uses `ON DELETE SET NULL` so deleting a creative doesn't nuke already-posted short links
- `destination_url` stores the final assembled URL with UTM params pre-appended → single `SELECT`, no reassembly on redirect
- `base_url` records which of the 3 landing page URLs was used so the Performance tab can show that context
- `click_count` + `last_clicked_at` updated atomically via `UPDATE … RETURNING`

### Migration location

Both `src/lib/db/schema.ts` AND `scripts/init-db.mjs` — the init script maintains its own hardcoded statement list separate from schema.ts (same pattern as `campaign_landing_pages`).

### No other schema changes

- `generated_assets` stays as-is. Organic-vs-ad filtering happens at the view layer by stripping ad-specific fields from `copy_data` (e.g., hiding `ad_headline`, `cta_button`) while keeping post-friendly fields like `primary_text` / `caption`.
- `user_roles` stays as-is. Recruiter initials come from Clerk's `firstName` + `lastName`, with `user_roles.name` split as a fallback.

## API routes

### `POST /api/tracked-links` — Mint a short link

**Auth:** recruiter or admin role. Campaign must be in `approved` or `sent` status.

**Body:**
```ts
{
  request_id: string;
  asset_id: string | null;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_term: string;
  utm_content: string;
}
```

**Server flow:**

1. `getAuthContext()` → validate role, capture `userId` as `recruiter_clerk_id`
2. Load `intake_requests` → validate status is `approved` or `sent`, extract `campaign_slug`
3. Load `campaign_landing_pages` → enforce readiness gate: at least one of `job_posting_url`, `landing_page_url`, `ada_form_url` must be non-NULL
4. Validate `body.base_url` matches one of the non-null landing page URLs (defense against spoofing arbitrary destinations)
5. Re-slugify `utm_term` and `utm_content` server-side (client state is untrusted)
6. Build `destination_url` by appending UTM params to `base_url`, fully URL-encoded
7. Mint 6-char base62 slug using the custom alphabet `[0-9A-Za-z]` (no `-` or `_` to keep the URL visually clean) — draw 6 random indices with `crypto.randomInt(0, 62)` per position — loop up to 5 retries on `UNIQUE` conflict
8. `INSERT` new row
9. Return `{ id, slug, short_url, destination_url, ...fields }` where `short_url = ${appOrigin}/r/${slug}` and `appOrigin` is derived from `process.env.NEXT_PUBLIC_APP_URL` (fallback: the request origin via `new URL(req.url).origin`)

**Error responses:**

- `401` unauthenticated
- `403` wrong role or campaign not in `approved`/`sent`
- `409 LANDING_PAGES_NOT_SET` — none of the 3 base URLs are set
- `400 INVALID_BASE_URL` — `body.base_url` doesn't match any of the campaign's non-null URLs
- `400` — `utm_term` or `utm_content` too long post-slugify (>60 chars)
- `500 SLUG_COLLISION` — 5 retries exhausted (essentially impossible)

### `GET /api/tracked-links?request_id=…` — List links for this campaign

**Auth:** recruiter (own links only, `WHERE recruiter_clerk_id = auth.userId`) or admin (all links for the campaign).

**Response:**
```ts
{
  links: Array<TrackedLink & {
    short_url: string;
    asset_thumbnail: string | null;
    asset_platform: string | null;
  }>;
  summary: {
    total_clicks: number;
    total_links: number;
    best_channel: { name: string; clicks: number; pct: number } | null;
    top_creative: { name: string; clicks: number; asset_id: string | null } | null;
  };
}
```

Sorted by `click_count DESC, created_at DESC`. **LEFT JOIN** on `generated_assets` so tracked_links with a NULLed `asset_id` (from a deleted creative) still appear in the list with `asset_thumbnail = null` and `asset_platform = null`.

### `GET /r/[slug]/route.ts` — The redirect (NOT under `/api`)

Public route, no auth. Single atomic `UPDATE … RETURNING`:

```ts
const [row] = await sql`
  UPDATE tracked_links
     SET click_count = click_count + 1,
         last_clicked_at = NOW()
   WHERE slug = ${slug}
   RETURNING destination_url
`;
if (!row) return notFoundHtmlResponse();
return Response.redirect(row.destination_url, 301);
```

404 returns a branded HTML page (gradient header + "This link is no longer active" + link home), not a bare JSON response, since this is user-facing.

### `PATCH /api/intake/[id]/campaign-slug` — Admin edits the campaign slug

**Auth:** admin only. Body: `{ campaign_slug: string }`. Server runs `slugify()` on the input before storing (guard against pasted raw spaces/special chars). Returns updated row.

Separate route because the existing `canEditRequest` helper is too restrictive — same pattern as the `/api/intake/[id]/landing-pages` route.

### `GET /api/auth/me` (existing, extended)

Add `firstName`, `lastName`, `initials` fields to the response, derived server-side from Clerk's `currentUser()` with `user_roles.name` split as fallback. `initials` = `firstName[0] + lastName[0]`, uppercase, no separator.

**Fallback rule when Clerk `firstName`/`lastName` are missing:** split `user_roles.name` on whitespace → `firstName = tokens[0]`, `lastName = tokens[tokens.length - 1]`. If only one token exists, `lastName = firstName` and initials become a single-character uppercase letter (e.g., "S"). Recruiter can always override the term suffix manually if they want different initials.

No new dedicated route — this is a one-file extension to the existing handler.

### `POST /api/intake` (existing, extended)

On new request creation, compute `slugify(title)` and store in the new `campaign_slug` column. One-line addition.

## Frontend components

### New files

| File | Lines | Purpose |
|---|---|---|
| `src/components/recruiter/RecruiterWorkspace.tsx` | ~180 | Top-level tabbed shell, replaces `RecruiterDetailView` as the body of the recruiter detail page |
| `src/components/recruiter/CreativeLibrary.tsx` | ~160 | Creatives tab — owns channel-tab state and selected-creative state |
| `src/components/recruiter/ChannelMessagingCard.tsx` | ~60 | Channel-specific messaging strip (core message + value prop tags + tone) |
| `src/components/recruiter/CreativeGrid.tsx` | ~130 | Grid of creative tiles with copy-caption + download + select-to-fill-builder |
| `src/components/recruiter/LinkBuilderBar.tsx` | ~220 | Sticky bottom builder bar, live short-URL preview, readiness-gate state machine. Desktop-first; on narrow viewports (<640px) the bar compresses by stacking fields vertically and shrinking the preview strip — no modal, no viewport trap |
| `src/components/recruiter/PerformanceTab.tsx` | ~200 | Performance tab — 4 stats tiles + sortable links table, 30s polling |
| `src/app/r/[slug]/route.ts` | ~30 | Redirect route, edge-runtime compatible |
| `src/lib/slugify.ts` | ~15 | Shared slugify helper (client + server) |
| `src/app/api/tracked-links/route.ts` | ~150 | POST + GET handlers |
| `src/app/api/intake/[id]/campaign-slug/route.ts` | ~60 | Admin PATCH handler |

### Modified files

- `src/app/intake/[id]/page.tsx` — replace the `if (role === "recruiter")` branch (~line 329) to render `<RecruiterWorkspace>` instead of `<RecruiterDetailView>`
- `src/components/RecruiterDetailView.tsx` — refactor its body into a named export `RecruiterOverviewTab` that `RecruiterWorkspace` mounts inside the Overview tab. Nothing is deleted; the existing presentation code is preserved, just re-parented.
- `src/app/api/auth/me/route.ts` — add `firstName`, `lastName`, `initials` to the response
- `src/app/api/intake/route.ts` — auto-slugify `title` into `campaign_slug` on `POST`
- `src/components/CampaignPreviewPanel.tsx` — add an inline-editable `CampaignSlugField` (admin-only) below the campaign title
- `src/lib/db/schema.ts` — add `tracked_links` table + `campaign_slug` column
- `scripts/init-db.mjs` — mirror the above into the init script's statement list
- `src/lib/types.ts` — add `TrackedLink`, `TrackedLinksSummary`, `TrackedLinksResponse`; extend `IntakeRequest` with `campaign_slug: string | null`

### Component boundary rules

- No shared state container. State is owned at the level it's used:
  - `RecruiterWorkspace` owns top-level tab state
  - `CreativeLibrary` owns channel sub-tab state + selected-asset state
  - `LinkBuilderBar` owns form field state + submission state
  - `PerformanceTab` owns its own fetch loop
- Data flows down via props; callbacks flow up. No React context, no Zustand, no global store.
- `LinkBuilderBar` receives `campaignLandingPages`, `campaignSlug`, `selectedAsset`, `activeChannel` from its parent and recomputes field values on prop change.

## Data flow — detailed walkthrough

1. **Page load** — recruiter hits `/intake/<requestId>`
   - `GET /api/intake/[id]` returns `intake_requests` (now including `campaign_slug`) + brief + assets + pipeline_runs + campaign_strategies
   - `RecruiterWorkspace` detects role, mounts tab bar
   - Also triggers `GET /api/intake/[id]/landing-pages` to pull the 3 base URLs
   - Also triggers `GET /api/auth/me` once to get recruiter initials

2. **Creatives tab mount** (default)
   - `CreativeLibrary` filters assets: `evaluation_passed = true`, dynamically derives channel list from `asset.platform` values
   - Auto-selects first channel with assets → auto-selects first asset in that channel
   - For each asset in the grid, strips ad-specific fields from `copy_data` (hide `cta_button`, `ad_headline`; keep `primary_text`, `caption`, `hook`)

3. **LinkBuilderBar initialization**
   - Receives `selectedAsset`, `activeChannel`, `landingPages`, `campaignSlug`, `recruiterInitials` via props
   - State machine evaluates readiness:
     - All 3 URLs NULL → "Disabled — no URLs" state, banner visible, 10s polling started
     - Exactly one URL → "Ready — single URL" state, no picker shown
     - 2+ URLs → "Ready — multi URL" state, segmented picker shown with `landing_page_url` as default
   - Pre-populates fields:
     - `campaign` = campaignSlug (locked)
     - `source` = activeChannel (locked to tab)
     - `medium` = `social` (editable dropdown)
     - `term` = recruiterInitials (editable)
     - `content` = derived asset identifier (editable) — format is `slugify(actor_name)-${format}-${index}`, e.g. `emily-square-01`. `actor_name` comes from the joined `actor_profiles` row; `format` comes from `generated_assets.format` (e.g. `square`, `story`, `landscape`); `index` is a zero-padded 2-digit position of the asset among siblings of the same actor+format in display order.
   - Short URL preview shows a placeholder (`nova-intake.vercel.app/r/______`) until COPY is clicked

4. **User interaction — click a different creative**
   - `CreativeGrid` fires `onSelect(asset)` → `CreativeLibrary` updates state → `LinkBuilderBar` receives new `selectedAsset` prop → `content` field updates automatically
   - Previous selection loses its border + checkmark overlay; new selection gains them

5. **User interaction — edit term suffix**
   - Recruiter types `-like-a-boss` after `SJ` → state updates on keystroke → on blur, client runs `slugify()` to normalize to `SJ-like-a-boss`
   - Server re-slugifies on submit (defense in depth)

6. **User interaction — click COPY LINK**
   - Button enters loading state (disabled, spinner)
   - `POST /api/tracked-links` fires
   - On success: `navigator.clipboard.writeText(short_url)` → toast "Short link copied!". No cross-component refresh magic is needed — `PerformanceTab` always re-fetches on mount (i.e. whenever the user switches to that tab), so newly-minted links show up naturally on the next visit, and the 30s auto-poll keeps them fresh afterwards.
   - On clipboard API failure: fallback toast shows the short URL in a selectable text field with manual copy instructions
   - On 409 (readiness gate): should never happen in practice because UI is already disabled, but if it does, toast the server message and stay put

7. **Public user clicks the short URL** (not the recruiter)
   - `GET /r/a3f2xk`
   - Single atomic `UPDATE … RETURNING` → 301 to destination
   - Total latency: ~20-40ms on Vercel + Neon pooler

8. **Performance tab mount**
   - `GET /api/tracked-links?request_id=<id>` → renders stats tiles + links table
   - Sets 30-second interval for auto-refresh
   - On interval, same endpoint re-fetches. Client uses `setState` to update → React re-renders rows with new click counts. No flicker (stable row keys).

## Readiness gate

Link building becomes available only when at least one of the 3 landing page URLs is set on `campaign_landing_pages`. The authoring surfaces for these URLs are the existing `LandingPagesCard` component, already mounted in both `CampaignPreviewPanel` (admin/marketing) and `DesignerPreviewPanel` (designer) — no new authoring UI is needed.

### Gate decision: **at-least-one (lenient)**

Recruiters are unblocked as soon as a single URL is populated. Rationale:

- Ships fast. No artificial wait for marketing to "complete" all 3 when one is already live
- Natural progressive enhancement (job post URL often lands first, then landing page, then ADA form)
- Matches the existing `LandingPagesCard` design where the green "✓ complete" badge is aspirational, not a gate
- YAGNI on stricter rules

Strict mode (all 3 required) remains a trivial flip from `hasAnyUrl` to `hasAllUrls` if the team later decides enforcement matters more than velocity.

### UI state machine

| State | Trigger | UI |
|---|---|---|
| Disabled — no URLs | All 3 URLs NULL or `campaign_landing_pages` row doesn't exist | Builder bar grayed out, COPY button disabled, banner visible, 10s polling active |
| Ready — single URL | Exactly one URL set | Builder bar active, no base URL picker shown, single URL used automatically |
| Ready — multi URL | 2 or 3 URLs set | Builder bar active, segmented picker shown with only non-null options, default = `landing_page_url` > `job_posting_url` > `ada_form_url` |

### Banner copy

- Recruiter role: "⚠️ Waiting for landing page URLs. Marketing or the designer needs to add at least one URL before you can build tracked links."
- Admin / designer role viewing the recruiter view: same message + "Add URLs now →" link that scrolls to the `LandingPagesCard`

### Live gate clearing

When in "Disabled — no URLs" state, `LinkBuilderBar` polls `GET /api/intake/[id]/landing-pages` every 10 seconds. When URLs are detected, polling stops and the state transitions to Ready without requiring a page refresh. Matches the `LandingPagesCard` polling pattern but at a slower cadence (one-shot transition, no need for aggressive refresh).

## Error handling + edge cases

| Case | Behavior |
|---|---|
| Campaign has no `campaign_slug` | Shouldn't happen after migration; if it does, `POST /api/tracked-links` returns `409 CAMPAIGN_SLUG_NOT_SET`, client toasts, does not copy |
| Recruiter pastes invalid chars in term (emoji, spaces, 200 chars) | Client `slugify()` on blur normalizes; server re-slugifies on submit; 400 if >60 chars post-slugify |
| Slug collision (1 in 56B) | Insert retries up to 5× on `UNIQUE` conflict; 500 after exhaustion |
| All 3 landing page URLs NULL | Readiness gate: builder disabled, banner visible, server returns 409 if bypassed |
| Redirect slug not found | 404 branded HTML page with OneForma gradient header + link home |
| `request.status` is `generating` or `draft` | Tabs hidden, existing pipeline progress UI renders inside the Creatives tab slot |
| No creatives for a channel | Channel sub-tab not rendered at all (only tabs with ≥1 `evaluation_passed` asset appear) |
| Zero channels have creatives | Empty state in Creatives tab: "Waiting for approved creatives…" |
| Double-click on COPY LINK | Button disabled during in-flight request, prevents duplicate mint |
| `clipboard.writeText` rejects (HTTP origin, permissions) | Fallback toast with selectable text field and manual copy instructions |
| Admin deletes a `generated_asset` with tracked_links | FK is `ON DELETE SET NULL`; tracked_links row survives with `asset_id = NULL`; Performance row shows "(creative deleted)" placeholder and preserves click count |
| Multiple recruiters minting links in parallel | No coordination needed; each `INSERT` is independent; slug collisions handled by the unique constraint retry loop |

## Testing strategy

### Unit tests

- `src/lib/slugify.test.ts` — unicode, emoji, whitespace, 200-char truncation, leading/trailing dashes, already-slugified input, idempotence
- `src/lib/tracked-links/build-url.test.ts` — URL encoding of UTM params, handling base URLs with and without existing query strings, idempotence

### Integration tests (hit real Neon test DB)

- `POST /api/tracked-links` happy path — verifies row inserted, short_url returned correctly
- `POST` unauthenticated → 401
- `POST` with campaign in `draft` status → 403
- `POST` with all 3 landing URLs NULL → 409 `LANDING_PAGES_NOT_SET`
- `POST` with `base_url` not matching any landing page → 400 `INVALID_BASE_URL`
- `GET /r/[slug]` increments `click_count` atomically (spawn 10 concurrent requests, assert final count = 10)
- `GET /r/[slug]` on missing slug → 404 HTML response
- `GET /api/tracked-links?request_id=…` as recruiter → only returns own links
- `GET /api/tracked-links?request_id=…` as admin → returns all links for the campaign
- `PATCH /api/intake/[id]/campaign-slug` as non-admin → 403
- `PATCH /api/intake/[id]/campaign-slug` happy path → verifies row updated + future tracked links use the new slug

### E2E test (Playwright, optional for v1)

Full recruiter flow: open approved campaign → click creative → click COPY LINK → assert clipboard contains a short URL → open the short URL in a new tab → assert 301 → switch to Performance tab → assert the link appears with `click_count = 1`.

### Manual verification checklist

- [ ] Load existing approved campaign (Project Cutis) as recruiter → tab structure renders, creative grid populated with only organic-safe copy fields
- [ ] Switch channel tabs → messaging card + creative grid + builder source field all update
- [ ] Click different creatives → builder `content` field updates automatically
- [ ] Edit term suffix → on-blur slugify normalizes display
- [ ] Click COPY LINK → clipboard contains the short URL, toast shows
- [ ] Paste short URL into a new tab → 301 redirects to full UTM-tagged destination
- [ ] Return to Performance tab → new link visible with `click_count = 1`
- [ ] Wait 30 seconds, click the short URL again → Performance tab auto-refresh reflects `click_count = 2`
- [ ] As admin, edit `campaign_slug` inline → next minted link uses the updated slug
- [ ] Remove all 3 landing page URLs from a test campaign → builder disables, banner appears, 10s polling active
- [ ] Add a URL via `LandingPagesCard` while recruiter view is open → banner auto-clears without page refresh

## Migration / rollout

1. Ship schema changes to both `src/lib/db/schema.ts` and `scripts/init-db.mjs`; run `npm run db:init` against prod Neon (prod + local share the same DB per `nova-intake-deploy-workflow.md`)
2. Backfill `campaign_slug` for existing approved campaigns with a one-shot script: `UPDATE intake_requests SET campaign_slug = slugify(title) WHERE campaign_slug IS NULL`
3. Deploy the new TSX components + API routes; existing recruiter view keeps working until `RecruiterWorkspace` replaces it in `src/app/intake/[id]/page.tsx`
4. Test on an existing approved campaign with real tracked link + redirect cycle
5. Alias deploy to `nova-intake.vercel.app` per the deploy workflow
6. Demo the Performance tab with real click data from Steven's own posts

## Success criteria

- Recruiter can go from landing on an approved campaign to a copied short link in ≤ 2 clicks
- Performance tab shows live click counts within 30 seconds of a real click
- Builder disables cleanly when landing page URLs are missing and re-enables live when marketing adds one
- Zero manual typing required in the happy path (all fields pre-populated)
- Admin can refine `campaign_slug` inline without blocking recruiters
- All v1 scope ships in one PR with a merged git worktree, 0 TypeScript errors, all integration tests passing

## Open questions (post-v1)

- Should the admin role also be able to view the Performance tab scoped to a specific recruiter (cross-recruiter admin dashboard)?
- Does the team want per-click event logging for proper funnel analysis, or is raw count sufficient?
- Does OneForma want to stand up a branded short domain (`go.oneforma.com`) for credibility when sharing in public networks?

These are v2 discussions; none block v1.
