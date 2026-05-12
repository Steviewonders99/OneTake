# Organic Social Metrics & Search Reporting Infrastructure

**Date:** 2026-05-12
**Status:** Design
**Author:** Steven Junop + Claude

## Problem

The reporting stack is entirely paid-ad-oriented. There are zero database tables, API clients, sync routes, or dashboard widgets for organic social media performance. OneForma actively posts on Facebook, Instagram, LinkedIn, and Reddit as company pages, and has a Google Search Console property — but none of that data flows into the app. We can't answer: "How is our organic presence doing?", "Which platform drives the most engagement?", or "Does pipeline-generated content outperform manual posts?"

## Solution

Add a complete organic metrics layer that mirrors the existing paid infrastructure pattern: platform cache tables → Python worker sync clients → API routes → dashboard widgets. Architecture is **Hybrid (Option C)**: separate storage tables for organic and paid (no risk to ROAS math), unified Postgres VIEW for cross-channel dashboards.

Additionally, apply the same 3-level drill-down pattern to paid media widgets, which currently lack it.

## Decisions

- **Architecture:** Hybrid — separate organic tables + unified VIEW for cross-channel queries
- **Sync method:** Scheduled cron via Azure Python worker (not Vercel Cron), with manual admin trigger as fallback
- **Metric granularity:** Post-level tracking with account-level daily snapshots. Posts attributed back to `generated_assets` when pipeline-generated.
- **API approach:** Direct API clients for all 4 platforms (no MCP bridge). Consistent pattern across Meta, LinkedIn, Reddit, GSC.
- **Database:** Test against Neon first, production writes to Azure PG. Same Postgres dialect, env var swap.
- **Trustpilot:** Deferred — lowest priority, not in v1.

## Platforms

| Platform | API | Auth | Data Available |
|---|---|---|---|
| Meta (FB + IG) | Graph API v21.0 Page Insights | Long-lived Page Access Token | Impressions, reach, engagement, likes, comments, shares, saves, clicks, video views |
| LinkedIn | Marketing API v2 Org Analytics | OAuth2 token (r_organization_social) | Impressions, unique impressions, engagement, likes, comments, shares, clicks |
| Reddit | Reddit API (OAuth2 script) | Client ID + Secret + username/password | Upvotes, score, comments, upvote_ratio, crossposts (no impressions/reach) |
| Google Search Console | Search Console API | Service account JSON | Clicks, impressions, CTR, average position per query/page/country/device |

---

## Database Schema (6 New Tables + 1 VIEW)

### Table 1: `meta_organic_cache`

Post-level metrics from Meta Graph API. One row per post per day (metrics update over time).

```sql
CREATE TABLE IF NOT EXISTS meta_organic_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           TEXT NOT NULL,
  post_id           TEXT NOT NULL,
  post_type         TEXT,            -- 'photo','video','carousel','reel','story','link','text'
  platform          TEXT NOT NULL,   -- 'facebook' | 'instagram'
  post_url          TEXT,
  post_text         TEXT,            -- caption for asset matching
  published_at      TIMESTAMPTZ,
  -- Metrics
  impressions       INT NOT NULL DEFAULT 0,
  reach             INT NOT NULL DEFAULT 0,
  engagement        INT NOT NULL DEFAULT 0,
  likes             INT NOT NULL DEFAULT 0,
  comments          INT NOT NULL DEFAULT 0,
  shares            INT NOT NULL DEFAULT 0,
  saves             INT NOT NULL DEFAULT 0,
  clicks            INT NOT NULL DEFAULT 0,
  video_views       INT DEFAULT 0,
  engagement_rate   FLOAT,
  -- Metadata
  raw_insights      JSONB DEFAULT '{}',
  date              DATE NOT NULL,
  last_synced_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, post_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meta_organic_post ON meta_organic_cache(post_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_organic_platform ON meta_organic_cache(platform, date DESC);
```

### Table 2: `linkedin_organic_cache`

Post-level metrics from LinkedIn Marketing API. Organization page shares and articles.

```sql
CREATE TABLE IF NOT EXISTS linkedin_organic_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              TEXT NOT NULL,
  post_id             TEXT NOT NULL,
  post_type           TEXT,          -- 'image','video','article','text','document'
  post_url            TEXT,
  post_text           TEXT,
  published_at        TIMESTAMPTZ,
  -- Metrics
  impressions         INT NOT NULL DEFAULT 0,
  unique_impressions  INT DEFAULT 0,
  engagement          INT NOT NULL DEFAULT 0,
  likes               INT NOT NULL DEFAULT 0,
  comments            INT NOT NULL DEFAULT 0,
  shares              INT NOT NULL DEFAULT 0,
  clicks              INT NOT NULL DEFAULT 0,
  engagement_rate     FLOAT,
  -- Metadata
  raw_insights        JSONB DEFAULT '{}',
  date                DATE NOT NULL,
  last_synced_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, post_id, date)
);
CREATE INDEX IF NOT EXISTS idx_linkedin_organic_post ON linkedin_organic_cache(post_id, date DESC);
```

### Table 3: `reddit_organic_cache`

Post-level metrics from Reddit API. Limited compared to Meta/LinkedIn — no impressions/reach from public API.

```sql
CREATE TABLE IF NOT EXISTS reddit_organic_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL,
  post_id         TEXT NOT NULL,    -- Reddit thing ID (t3_xxxxx)
  subreddit       TEXT NOT NULL,
  post_type       TEXT,             -- 'link','self','image','video','crosspost'
  post_url        TEXT,
  post_title      TEXT,
  post_text       TEXT,
  published_at    TIMESTAMPTZ,
  -- Metrics
  upvotes         INT NOT NULL DEFAULT 0,
  downvotes       INT DEFAULT 0,
  score           INT NOT NULL DEFAULT 0,
  comments        INT NOT NULL DEFAULT 0,
  upvote_ratio    FLOAT,
  crossposts      INT DEFAULT 0,
  awards          INT DEFAULT 0,
  -- Metadata
  raw_data        JSONB DEFAULT '{}',
  date            DATE NOT NULL,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(username, post_id, date)
);
CREATE INDEX IF NOT EXISTS idx_reddit_organic_post ON reddit_organic_cache(post_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_organic_sub ON reddit_organic_cache(subreddit, date DESC);
```

### Table 4: `gsc_daily_cache`

Google Search Console query-level performance. Different shape from social — queries + pages, not posts.

```sql
CREATE TABLE IF NOT EXISTS gsc_daily_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_url    TEXT NOT NULL,
  query           TEXT NOT NULL,
  page            TEXT NOT NULL,
  country         TEXT DEFAULT 'GLOBAL',
  device          TEXT DEFAULT 'ALL',
  -- Metrics
  clicks          INT NOT NULL DEFAULT 0,
  impressions     INT NOT NULL DEFAULT 0,
  ctr             FLOAT,
  position        FLOAT,
  -- Metadata
  date            DATE NOT NULL,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_url, query, page, country, device, date)
);
CREATE INDEX IF NOT EXISTS idx_gsc_query ON gsc_daily_cache(query, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_page ON gsc_daily_cache(page, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_date ON gsc_daily_cache(date DESC);
```

### Table 5: `social_account_snapshots`

Daily account-level rollup per platform. Tracks follower growth, total reach, overall engagement over time.

```sql
CREATE TABLE IF NOT EXISTS social_account_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT NOT NULL,    -- 'facebook','instagram','linkedin','reddit'
  account_id          TEXT NOT NULL,
  account_name        TEXT,
  -- Snapshot Metrics
  followers           INT DEFAULT 0,
  follower_delta      INT DEFAULT 0,
  total_reach         INT DEFAULT 0,
  total_impressions   INT DEFAULT 0,
  total_engagement    INT DEFAULT 0,
  post_count          INT DEFAULT 0,
  avg_engagement_rate FLOAT,
  profile_views       INT DEFAULT 0,
  -- Metadata
  date                DATE NOT NULL,
  last_synced_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, account_id, date)
);
CREATE INDEX IF NOT EXISTS idx_social_snapshots_platform ON social_account_snapshots(platform, date DESC);
```

### Table 6: `organic_post_assets`

Attribution bridge — links social posts back to pipeline-generated assets or flags as manual.

```sql
CREATE TABLE IF NOT EXISTS organic_post_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  asset_id        UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
  request_id      UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
  source          TEXT NOT NULL DEFAULT 'manual',  -- 'pipeline' | 'manual'
  matched_by      TEXT,             -- 'url_match','text_similarity','manual_tag','utm'
  confidence      FLOAT DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, post_id)
);
CREATE INDEX IF NOT EXISTS idx_opa_asset ON organic_post_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_opa_request ON organic_post_assets(request_id);
CREATE INDEX IF NOT EXISTS idx_opa_source ON organic_post_assets(source);
```

### VIEW: `channel_performance_unified`

Unions paid + organic for cross-channel dashboard queries. Powers the top-level aggregate and paid-vs-organic comparisons.

```sql
CREATE OR REPLACE VIEW channel_performance_unified AS
-- Paid channels (existing normalized_daily_metrics)
SELECT
  date, platform, channel, 'paid'::text as metric_type,
  impressions, clicks, spend, conversions,
  NULL::int as reach, NULL::int as engagement,
  NULL::int as likes, NULL::int as shares,
  NULL::int as saves, NULL::float as engagement_rate
FROM normalized_daily_metrics

UNION ALL

-- Meta organic (aggregated from post-level)
SELECT
  date, platform, platform as channel, 'organic'::text as metric_type,
  SUM(impressions)::int, SUM(clicks)::int, 0 as spend, 0 as conversions,
  SUM(reach)::int, SUM(engagement)::int,
  SUM(likes)::int, SUM(shares)::int,
  SUM(saves)::int, AVG(engagement_rate) as engagement_rate
FROM meta_organic_cache
GROUP BY date, platform

UNION ALL

-- LinkedIn organic
SELECT
  date, 'linkedin' as platform, 'linkedin' as channel, 'organic'::text,
  SUM(impressions)::int, SUM(clicks)::int, 0, 0,
  SUM(unique_impressions)::int, SUM(engagement)::int,
  SUM(likes)::int, SUM(shares)::int,
  NULL::int, AVG(engagement_rate)
FROM linkedin_organic_cache
GROUP BY date

UNION ALL

-- Reddit organic (score maps to engagement, no impressions/reach)
SELECT
  date, 'reddit' as platform, 'reddit' as channel, 'organic'::text,
  0 as impressions, 0 as clicks, 0 as spend, 0 as conversions,
  0 as reach, SUM(score)::int as engagement,
  SUM(upvotes)::int as likes, NULL::int as shares,
  NULL::int as saves, AVG(upvote_ratio) as engagement_rate
FROM reddit_organic_cache
GROUP BY date;
```

---

## Worker Sync Architecture

### New Files

```
worker/
├── pipeline/
│   └── stage_organic_sync.py      # orchestrator
├── platforms/
│   ├── __init__.py
│   ├── meta_organic.py            # Graph API page insights + IG
│   ├── linkedin_organic.py        # Marketing API org analytics
│   ├── reddit_organic.py          # Reddit API user submissions
│   ├── gsc_client.py              # Search Console API
│   ├── account_snapshotter.py     # daily account-level rollup
│   └── asset_matcher.py           # post ↔ generated_asset linking
```

### Job Lifecycle

1. **Cron trigger** — Azure Timer Function (or GitHub Action) inserts a `compute_jobs` row with `job_type: 'organic_sync'` every 6 hours.
2. **Worker picks up** — existing poller sees pending `organic_sync` job, routes to `stage_organic_sync.py`.
3. **Parallel fetch** — `asyncio.gather()` runs all 4 platform clients concurrently. Each client: fetch API → transform → upsert to platform cache table.
4. **Post-processing** — after all platforms complete, `account_snapshotter.py` computes daily rollups into `social_account_snapshots`, then `asset_matcher.py` links new posts to `generated_assets`.
5. **Job complete** — updates `compute_jobs` status to `'completed'` with per-platform sync results in `output_data` JSONB.

### Platform Client Pattern

Each client in `worker/platforms/` follows the same structure:

```python
class MetaOrganicClient:
    def __init__(self, db, config):
        self.db = db
        self.page_id = config['META_PAGE_ID']
        self.token = config['META_PAGE_ACCESS_TOKEN']

    async def sync(self, days: int = 7) -> SyncResult:
        """Fetch → transform → upsert. Returns SyncResult."""
        posts = await self._fetch_posts(days)
        for post in posts:
            insights = await self._fetch_post_insights(post['id'])
            await self._upsert(post, insights)
        return SyncResult(platform='meta_organic', rows_synced=len(posts), ...)

    def is_connected(self) -> bool:
        return bool(self.page_id and self.token)
```

### Asset Matcher — 3-Tier Strategy

Matching strategies, tried in order of confidence:

1. **UTM Match (confidence: 1.0)** — Post URL contains a `tracked_links` slug (e.g., `go.oneforma.com/r/abc`). Direct lookup to `request_id` via the tracked_links table.
2. **URL Match (confidence: 0.9)** — Post contains a landing page URL matching a campaign's `landing_page_url` in `intake_requests`.
3. **Text Similarity (confidence: 0.5-0.8)** — Post caption compared against `generated_assets` copy variants using fuzzy string matching (e.g., `rapidfuzz`). Threshold: 0.7 ratio minimum.

Unmatched posts get `source: 'manual'`, `asset_id: NULL`. Still tracked for manual-vs-pipeline comparisons.

### Environment Variables

```env
# Meta Organic (Graph API — Page token, not ad account token)
META_PAGE_ACCESS_TOKEN=        # long-lived page token
META_PAGE_ID=                  # OneForma FB page ID
META_IG_BUSINESS_ID=           # OneForma IG business account ID

# LinkedIn Organic
LINKEDIN_ORG_ACCESS_TOKEN=     # OAuth2 token with r_organization_social scope
LINKEDIN_ORG_ID=               # OneForma organization URN number

# Reddit Organic
REDDIT_CLIENT_ID=              # Reddit app client ID
REDDIT_CLIENT_SECRET=          # Reddit app client secret
REDDIT_USERNAME=               # u/OneForma or brand account
REDDIT_PASSWORD=               # for script-type OAuth

# Google Search Console
GSC_SERVICE_ACCOUNT_JSON=      # path to service account key JSON
GSC_PROPERTY_URL=              # sc-domain:oneforma.com

# Sync config
ORGANIC_SYNC_DAYS=7            # how many days back to sync each run
```

---

## API Routes

### Organic Metric Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/insights/metrics/organic-overview` | all roles | Cross-platform KPI aggregates: total impressions, reach, engagement, follower delta. Reads from `channel_performance_unified` VIEW + `social_account_snapshots`. |
| `GET` | `/api/insights/metrics/organic-by-platform` | all roles | Per-platform daily breakdown. Query: `?days=30&platforms=facebook,linkedin`. Powers platform comparison chart. |
| `GET` | `/api/insights/metrics/organic-posts` | all roles | Post-level feed with attribution. Joins platform caches with `organic_post_assets`. Query: `?platform=linkedin&days=30&sort=engagement&source=pipeline`. |
| `GET` | `/api/insights/metrics/organic-attribution` | all roles | Pipeline vs manual comparison: avg engagement rate, avg reach, post count per source type. |
| `GET` | `/api/insights/metrics/account-growth` | all roles | Follower count + delta over time per platform from `social_account_snapshots`. Query: `?days=90&platform=all`. |
| `GET` | `/api/insights/metrics/gsc-performance` | all roles | Top queries, top pages, clicks/impressions/CTR/position trends from `gsc_daily_cache`. Replaces stubbed GSC client. Query: `?days=28&limit=50&sort=clicks`. |

### Paid Metric Routes (New — Matching Organic Drill-Down)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/insights/metrics/paid-overview` | all roles | Cross-platform paid KPI aggregates: total spend, impressions, clicks, conversions, CPA, ROAS. Reads from `normalized_daily_metrics`. |
| `GET` | `/api/insights/metrics/paid-by-platform` | all roles | Per-platform daily paid breakdown. Query: `?days=30&platforms=meta_ads,reddit_ads`. |
| `GET` | `/api/insights/metrics/paid-campaigns` | all roles | Campaign/adset level detail for a specific platform. Query: `?platform=meta_ads&days=30&sort=spend`. |

### Sync & Status Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/platforms/organic/sync` | admin | Manual sync trigger — inserts `organic_sync` job into `compute_jobs`. Body: `{ "platforms": ["meta","linkedin","reddit","gsc"], "days": 7 }`. Returns job ID. |
| `GET` | `/api/platforms/organic/status` | all roles | Connection status per organic platform: connected, has_data, last_sync_at, row_count. |

---

## Dashboard Widgets

### New Widget Category: "Organic Social"

Added to `WIDGET_CATEGORIES` array and `WidgetCategory` type as `'organic'`.

| Widget Type | Label | Description |
|---|---|---|
| `organic-kpi` | Organic KPI Cards | Total impressions, reach, engagement, follower delta across all platforms. 7-day sparklines. Entry point for organic drill-down. |
| `organic-platform-compare` | Platform Comparison | Stacked bar or line chart comparing engagement/impressions across FB, IG, LinkedIn, Reddit. Click a platform to filter the posts feed widget. |
| `organic-attribution` | Pipeline vs Manual | Side-by-side: pipeline-generated posts vs manual. Avg engagement rate, avg reach, total posts per source. |
| `organic-account-growth` | Account Growth | Follower count over time per platform with delta annotations. Line chart, one series per platform. |
| `organic-top-posts` | Top Posts Feed | Sortable table of individual posts. Columns: platform icon, preview text, type, impressions, reach, engagement, engagement rate, source badge (pipeline/manual). Click row to expand. |
| `gsc-performance` | GSC Performance | Replaces stubbed `gsc-queries` widget. Top queries + top pages tables + trend charts. Filterable by country and device. |

### New Paid Widgets (Matching Organic Drill-Down)

| Widget Type | Label | Description |
|---|---|---|
| `paid-kpi` | Paid KPI Cards | Total spend, impressions, clicks, conversions, CPA, ROAS across all paid platforms. 7-day sparklines. Entry point for paid drill-down. |
| `paid-platform-compare` | Paid Platform Comparison | Per-platform daily chart for paid channels. Same visual treatment as `organic-platform-compare`. Click to drill into campaigns. |
| `paid-campaign-detail` | Campaign Detail | Campaign/adset table for a specific platform. Columns: campaign name, impressions, clicks, spend, conversions, CPA, CTR. Drill target from platform comparison. |

### Drill-Down UX (Symmetric for Paid and Organic)

```
Level 1 (KPIs)     ─── organic-kpi ──────────── paid-kpi
                          │                         │
                          ▼                         ▼
Level 2 (Platform)  ─── organic-platform-compare ─ paid-platform-compare
                          │                         │
                          ▼                         ▼
Level 3 (Detail)    ─── organic-top-posts ──────── paid-campaign-detail
```

Drill-down is widget-to-widget navigation within the dashboard builder. Clicking a platform in the L2 comparison chart filters the L3 detail widget to that platform. No separate pages — everything stays in the drag-and-drop grid.

Cross-channel view: Both KPI widgets side-by-side give you paid vs organic at a glance. The `channel_performance_unified` VIEW powers any widget that needs to aggregate across both.

---

## TypeScript Types

New file: `src/lib/platforms/organic-types.ts`

```typescript
export interface OrganicPostMetrics {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'reddit';
  post_id: string;
  post_type: string;
  post_text: string | null;
  post_url: string | null;
  published_at: string;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagement_rate: number | null;
  // Attribution
  source: 'pipeline' | 'manual';
  asset_id: string | null;
  request_id: string | null;
  matched_by: string | null;
  confidence: number;
}

export interface OrganicOverview {
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  total_clicks: number;
  follower_delta: number;
  post_count: number;
  avg_engagement_rate: number;
  per_platform: Record<string, {
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    follower_delta: number;
    post_count: number;
  }>;
}

export interface AccountSnapshot {
  platform: string;
  account_id: string;
  account_name: string | null;
  followers: number;
  follower_delta: number;
  total_reach: number;
  total_impressions: number;
  total_engagement: number;
  post_count: number;
  avg_engagement_rate: number;
  profile_views: number;
  date: string;
}

export interface GscRow {
  query: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export interface OrganicSyncResult {
  platform: string;
  success: boolean;
  posts_synced: number;
  account_snapshot: boolean;
  assets_matched: number;
  errors: number;
  duration_ms: number;
  message: string;
}

export interface OrganicConnectionStatus {
  platform: string;
  connected: boolean;
  has_data: boolean;
  last_sync_at: string | null;
  post_count: number;
}

// Paid drill-down types (extending existing)
export interface PaidOverview {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_cpa: number;
  avg_ctr: number;
  roas: number;
  per_platform: Record<string, {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpa: number;
  }>;
}
```

---

## Widget Type + Category Updates

In `src/components/insights/types.ts`, add to the `WidgetType` union:

```typescript
// Organic Social
| 'organic-kpi'
| 'organic-platform-compare'
| 'organic-attribution'
| 'organic-account-growth'
| 'organic-top-posts'
| 'gsc-performance'
// Paid (drill-down parity)
| 'paid-kpi'
| 'paid-platform-compare'
| 'paid-campaign-detail'
```

Add to `WidgetCategory`:

```typescript
| 'organic'
| 'paid'
```

---

## Migration Plan

Single migration file: `migrations/2026-05-12-organic-social-metrics.sql`

Contains all 6 `CREATE TABLE` statements, indexes, unique constraints, and the `CREATE OR REPLACE VIEW` for `channel_performance_unified`. Idempotent (`IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object ...`).

Run against Neon first for testing, then Azure PG for production.

---

## File Inventory

### New Files

| File | Purpose |
|---|---|
| `worker/platforms/__init__.py` | Package init |
| `worker/platforms/meta_organic.py` | Meta Graph API organic client |
| `worker/platforms/linkedin_organic.py` | LinkedIn Marketing API organic client |
| `worker/platforms/reddit_organic.py` | Reddit API organic client |
| `worker/platforms/gsc_client.py` | Google Search Console API client |
| `worker/platforms/account_snapshotter.py` | Daily account-level rollup |
| `worker/platforms/asset_matcher.py` | Post ↔ generated_asset attribution |
| `worker/pipeline/stage_organic_sync.py` | Sync orchestrator (asyncio.gather all clients) |
| `src/lib/platforms/organic-types.ts` | TypeScript interfaces for organic metrics |
| `src/app/api/insights/metrics/organic-overview/route.ts` | Organic KPI aggregate endpoint |
| `src/app/api/insights/metrics/organic-by-platform/route.ts` | Per-platform daily breakdown |
| `src/app/api/insights/metrics/organic-posts/route.ts` | Post-level feed with attribution |
| `src/app/api/insights/metrics/organic-attribution/route.ts` | Pipeline vs manual comparison |
| `src/app/api/insights/metrics/account-growth/route.ts` | Follower growth trends |
| `src/app/api/insights/metrics/gsc-performance/route.ts` | GSC queries + pages + trends |
| `src/app/api/insights/metrics/paid-overview/route.ts` | Paid KPI aggregate endpoint |
| `src/app/api/insights/metrics/paid-by-platform/route.ts` | Per-platform paid breakdown |
| `src/app/api/insights/metrics/paid-campaigns/route.ts` | Campaign/adset detail |
| `src/app/api/platforms/organic/sync/route.ts` | Manual organic sync trigger |
| `src/app/api/platforms/organic/status/route.ts` | Organic platform connection status |
| `src/components/insights/widgets/OrganicKpiWidget.tsx` | Organic KPI cards widget |
| `src/components/insights/widgets/OrganicPlatformCompareWidget.tsx` | Platform comparison chart |
| `src/components/insights/widgets/OrganicAttributionWidget.tsx` | Pipeline vs manual widget |
| `src/components/insights/widgets/OrganicAccountGrowthWidget.tsx` | Follower growth widget |
| `src/components/insights/widgets/OrganicTopPostsWidget.tsx` | Post feed with attribution |
| `src/components/insights/widgets/GscPerformanceWidget.tsx` | GSC performance widget |
| `src/components/insights/widgets/PaidKpiWidget.tsx` | Paid KPI cards widget |
| `src/components/insights/widgets/PaidPlatformCompareWidget.tsx` | Paid platform comparison |
| `src/components/insights/widgets/PaidCampaignDetailWidget.tsx` | Campaign/adset detail |
| `migrations/2026-05-12-organic-social-metrics.sql` | Database migration |

### Modified Files

| File | Change |
|---|---|
| `src/components/insights/types.ts` | Add 9 new `WidgetType` values + 2 new `WidgetCategory` values |
| `src/components/insights/widgetRegistry.ts` | Register 9 new widgets in `WIDGET_REGISTRY` + add 2 categories to `WIDGET_CATEGORIES` |
| `src/lib/db/schema.ts` | Add 6 table creation statements + VIEW |
| `src/lib/audienceiq/gsc-client.ts` | Replace stub with real reads from `gsc_daily_cache` |
| `worker/.env.example` | Add 12 new env vars |
| `worker/pipeline/orchestrator.py` | Add `organic_sync` job type routing |

**Total: ~30 new files, ~6 modified files.**
