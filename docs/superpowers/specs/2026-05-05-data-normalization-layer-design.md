# Data Normalization Layer — Ad Platform Sync + ROAS Activation

**Date:** 2026-05-05
**Status:** Design approved
**Author:** Steven Junop + Claude

---

## Summary

Complete the data normalization pipeline that feeds `normalized_daily_metrics` with real ad platform performance data, activating ROAS calculations, campaign ROI widgets, and cross-platform performance comparison. Five paid ad platforms (Meta, Reddit, Google, TikTok, LinkedIn) sync through cache tables and normalize into a unified schema. Brevo email metrics live in a separate `brevo_campaign_metrics` table. Campaign-to-platform mapping via UTM `campaign_slug` matching.

---

## Architecture

### Core Principle

Each platform follows the same pattern: **API → cache table (raw) → normalize → `normalized_daily_metrics` (unified)**. Platform-specific field names are mapped to standard columns during normalization. The ROAS route already reads from `normalized_daily_metrics` — once data flows in, ROAS calculations go live automatically.

### Platform Matrix

| Platform | Cache Table | Client File | Normalizes Into | Wave | Credentials |
|---|---|---|---|---|---|
| Meta Ads | `meta_ads_cache` (exists) | `meta-ads.ts` (complete stub) | `normalized_daily_metrics` | 1 (May 6) | `META_ADS_ACCESS_TOKEN`, `META_ADS_AD_ACCOUNT_ID` |
| Reddit Ads | `reddit_ads_cache` (NEW) | `reddit-ads.ts` (NEW) | `normalized_daily_metrics` | 1 (May 6) | `REDDIT_ADS_ACCESS_TOKEN`, `REDDIT_ADS_AD_ACCOUNT_ID` |
| Brevo | `brevo_campaign_metrics` (NEW) | `brevo.ts` (NEW) | Separate table (NOT normalized_daily_metrics) | 1 (May 6) | `BREVO_API_KEY` (Brevo MCP available) |
| Google Ads | `google_ads_cache` (exists) | `google-ads.ts` (complete stub) | `normalized_daily_metrics` | 2 (May 11) | `GOOGLE_ADS_CLIENT_ID/SECRET/REFRESH_TOKEN/CUSTOMER_ID` |
| TikTok Ads | `tiktok_ads_cache` (exists) | `tiktok-ads.ts` (complete stub) | `normalized_daily_metrics` | 2 (May 11) | `TIKTOK_ADS_ACCESS_TOKEN`, `TIKTOK_ADS_ADVERTISER_ID` |
| LinkedIn Ads | `linkedin_ads_cache` (exists) | `linkedin-ads.ts` (complete stub) | `normalized_daily_metrics` | Stubbed | `LINKEDIN_ADS_ACCESS_TOKEN`, `LINKEDIN_ADS_AD_ACCOUNT_ID` |

---

## Schema — New Tables

### `reddit_ads_cache`

Follows the existing pattern established by `meta_ads_cache`, `google_ads_cache`, etc.

```sql
CREATE TABLE IF NOT EXISTS reddit_ads_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL,
  campaign_name   TEXT,
  ad_group_id     TEXT,
  ad_group_name   TEXT,
  date            DATE NOT NULL,
  impressions     INT DEFAULT 0,
  clicks          INT DEFAULT 0,
  spend           NUMERIC(12,2) DEFAULT 0,
  conversions     INT DEFAULT 0,
  ecpm            NUMERIC(12,4),
  cpc             NUMERIC(12,4),
  ctr             FLOAT,
  raw_data        JSONB DEFAULT '{}',
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, campaign_id, ad_group_id, date)
);
CREATE INDEX IF NOT EXISTS idx_reddit_ads_request ON reddit_ads_cache(request_id, date);
```

### `brevo_campaign_metrics`

Separate from ad normalization — email has different metrics.

```sql
CREATE TABLE IF NOT EXISTS brevo_campaign_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  campaign_id     TEXT NOT NULL,
  campaign_name   TEXT,
  subject         TEXT,
  date            DATE NOT NULL,
  sends           INT DEFAULT 0,
  delivered       INT DEFAULT 0,
  opens           INT DEFAULT 0,
  unique_opens    INT DEFAULT 0,
  clicks          INT DEFAULT 0,
  unique_clicks   INT DEFAULT 0,
  bounces         INT DEFAULT 0,
  unsubscribes    INT DEFAULT 0,
  spam_reports    INT DEFAULT 0,
  open_rate       FLOAT,
  click_rate      FLOAT,
  bounce_rate     FLOAT,
  raw_data        JSONB DEFAULT '{}',
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_brevo_metrics_request ON brevo_campaign_metrics(request_id, date);
```

### Existing tables used as-is

- `meta_ads_cache` — already in schema.ts
- `google_ads_cache` — already in schema.ts
- `linkedin_ads_cache` — already in schema.ts
- `tiktok_ads_cache` — already in schema.ts
- `normalized_daily_metrics` — already in schema.ts, correct columns, UNIQUE constraint on (request_id, country, date, platform, channel)

---

## Platform Client Interface

All paid ad platform clients implement the same interface:

```typescript
interface PlatformClient {
  isConnected(): boolean;
  getStatus(): Promise<{ connected: boolean; last_sync: string | null; row_count: number }>;
  sync(requestId: string, days?: number): Promise<{ campaigns_synced: number; rows_written: number }>;
  normalize(requestId: string): Promise<number>;  // returns rows normalized
}
```

### Meta Ads Client (`src/lib/platforms/meta-ads.ts`)

**API:** Meta Marketing API v21
**Auth:** `META_ADS_ACCESS_TOKEN`
**Endpoint:** `GET /act_{ad_account_id}/insights`
**Fields:** `impressions, clicks, spend, actions, cpc, cpm, ctr`
**Breakdowns:** `date_start` for daily metrics
**Mapping to normalized:**
- `impressions` → `impressions`
- `clicks` → `clicks`
- `spend` → `spend`
- `actions[type=offsite_conversion]` → `conversions`
- `cpc` → derived
- `ctr` → derived

### Reddit Ads Client (`src/lib/platforms/reddit-ads.ts`) — NEW

**API:** Reddit Ads API v3
**Auth:** `REDDIT_ADS_ACCESS_TOKEN`
**Endpoint:** `GET /api/v3/ad_accounts/{ad_account_id}/reports`
**Fields:** `impressions, clicks, spend, conversions, ecpm, video_views`
**Mapping to normalized:**
- `impressions` → `impressions`
- `clicks` → `clicks`
- `spend` → `spend` (convert from micros if needed)
- `conversions` → `conversions`

### Brevo Client (`src/lib/platforms/brevo.ts`) — NEW

**API:** Brevo REST API v3
**Auth:** `BREVO_API_KEY`
**Endpoint:** `GET /emailCampaigns` + `GET /emailCampaigns/{id}/statistics`
**Note:** Brevo MCP server tools are available in the environment for querying campaign data.
**Writes to:** `brevo_campaign_metrics` (NOT `normalized_daily_metrics`)

### Google Ads Client (`src/lib/platforms/google-ads.ts`)

**API:** Google Ads API v17
**Auth:** OAuth2 (4 env vars)
**Fields:** `metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions`
**Note:** `cost_micros` must be divided by 1,000,000 for dollar amounts
**Mapping to normalized:**
- `metrics.cost_micros / 1_000_000` → `spend`

### TikTok Ads Client (`src/lib/platforms/tiktok-ads.ts`)

**API:** TikTok Marketing API v1.3
**Auth:** `TIKTOK_ADS_ACCESS_TOKEN`
**Endpoint:** `GET /report/integrated/get`
**Fields:** `impressions, clicks, spend, conversion, video_play_actions`

---

## Campaign-to-Platform Mapping

**Primary method: UTM matching**

Platform campaigns are linked to intake_requests via `utm_campaign = campaign_slug`. When ad platforms report performance data, the campaign name or UTM parameters in the conversion data map back to the intake_request's `campaign_slug`.

**Matching logic in normalize():**
1. Read cache table rows
2. For each campaign: check if campaign_name contains a known `campaign_slug`
3. If match → set `request_id` and upsert into `normalized_daily_metrics`
4. If no match → store in cache with `request_id = NULL` (orphaned metrics, can be manually linked later)

**Fallback: manual mapping**
Admin can manually link platform campaign IDs to intake_requests via a future UI (not in this scope).

---

## Sync Orchestrator

### `POST /api/platforms/sync`

**Request:**
```typescript
{
  request_id?: string,   // sync specific campaign (null = all active)
  platforms?: string[],  // which platforms (null = all connected)
  days?: number,         // lookback window (default: 7)
}
```

**Response:**
```typescript
{
  platforms_synced: string[],
  results: {
    [platform: string]: {
      campaigns_synced: number,
      rows_written: number,
      rows_normalized: number,
      error?: string,
    }
  },
  total_normalized: number,
}
```

**Flow:**
1. Check which platforms are connected (`isConnected()` — env vars present)
2. Filter to requested platforms (if specified)
3. For each connected paid platform:
   a. Call `sync(requestId, days)` → raw API data → cache table
   b. Call `normalize(requestId)` → cache → `normalized_daily_metrics`
4. For Brevo:
   a. Call `sync(requestId, days)` → raw API data → `brevo_campaign_metrics`
   b. No normalization step (separate table)
5. Return summary

**Permission:** Admin only. Cron-friendly (idempotent, upserts).

**Sync modes:**
- **Manual:** Admin clicks "Sync Now" in dashboard
- **Per-campaign:** "Refresh metrics" button in campaign workspace
- **Scheduled (future):** Azure Function `onetake-fn-west01` calls this on cron (not built now — API is ready for it)

---

## What This Activates

Once `normalized_daily_metrics` has real data:

1. **ROAS route goes live** — `/api/roas/[requestId]` already reads from this table and calculates actual_cpa, effective_cpa, roas, roi_pct, health status
2. **Campaign ROI widget** — already exists in widget registry, reads ROAS data
3. **Cross-platform comparison** — normalized schema enables side-by-side platform performance
4. **RevBrain budget recommendations** — can read actual spend vs target CPA from roas_config and recommend adjustments

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Brevo in separate table | Email metrics (opens, bounces, unsubscribes) don't map to ad metrics (impressions, spend) |
| Reddit follows same pattern as other ad platforms | Consistent architecture, same cache→normalize→unified flow |
| UTM matching for campaign linking | Tracked links already use campaign_slug as utm_campaign — zero manual work |
| Wave 1/2 split by credential availability | Ship Meta + Reddit + Brevo on Day 31, Google + TikTok on Day 36 |
| LinkedIn stays stubbed | No credentials mentioned — ready when needed |
| No scheduled sync yet | Azure Function not provisioned — API is cron-friendly for when it's ready |

---

## Files Impacted

| Area | Files |
|---|---|
| Schema | `src/lib/db/schema.ts` (add reddit_ads_cache, brevo_campaign_metrics) |
| Meta client | `src/lib/platforms/meta-ads.ts` (complete the stub) |
| Reddit client | `src/lib/platforms/reddit-ads.ts` (create) |
| Brevo client | `src/lib/platforms/brevo.ts` (create) |
| Google client | `src/lib/platforms/google-ads.ts` (complete the stub — Wave 2) |
| TikTok client | `src/lib/platforms/tiktok-ads.ts` (complete the stub — Wave 2) |
| Platform types | `src/lib/platforms/types.ts` (add Reddit, Brevo types) |
| Normalizer | `src/lib/platforms/normalizer.ts` (add Reddit, update merge logic) |
| Sync orchestrator | `src/app/api/platforms/sync/route.ts` (create) |
| Env vars | `.env.example` (add Reddit + Brevo vars) |
