# Data Normalization Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the ad platform sync pipeline so `normalized_daily_metrics` receives real performance data, activating ROAS calculations, campaign ROI, and cross-platform comparison.

**Architecture:** Each platform follows cache table → sync function → normalize into `normalized_daily_metrics`. Brevo email stays in a separate `brevo_campaign_metrics` table. A sync orchestrator route coordinates all platforms. Campaign linking via UTM `campaign_slug` matching.

**Tech Stack:** Next.js (TypeScript), Meta Marketing API v21, Reddit Ads API v3, Brevo REST API v3, Neon Postgres.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/db/schema.ts` | Add reddit_ads_cache + brevo_campaign_metrics | Modify |
| `src/lib/platforms/types.ts` | Add sync + normalize interfaces | Modify |
| `src/lib/platforms/meta-ads.ts` | Complete Meta sync + normalize | Modify |
| `src/lib/platforms/reddit-ads.ts` | Reddit Ads client | Create |
| `src/lib/platforms/brevo.ts` | Brevo email client | Create |
| `src/lib/platforms/normalizer.ts` | Add Reddit, add normalizeToDaily() | Modify |
| `src/app/api/platforms/sync/route.ts` | Sync orchestrator | Create |
| `.env.example` | Add Reddit + Brevo env vars | Modify |

---

### Task 1: Schema — Reddit + Brevo Cache Tables

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add reddit_ads_cache table**

In `src/lib/db/schema.ts`, after the `tiktok_ads_cache` block (after line 793), add:

```typescript
  // 34. reddit_ads_cache — raw Reddit Ads campaign data
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_ads_cache (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_account_id   TEXT NOT NULL,
      campaign_id     TEXT NOT NULL,
      campaign_name   TEXT,
      ad_group_id     TEXT,
      ad_group_name   TEXT,
      impressions     INT NOT NULL DEFAULT 0,
      clicks          INT NOT NULL DEFAULT 0,
      conversions     INT NOT NULL DEFAULT 0,
      spend           FLOAT NOT NULL DEFAULT 0,
      ecpm            FLOAT,
      cpc             FLOAT,
      ctr             FLOAT,
      demographics    JSONB NOT NULL DEFAULT '{}',
      raw_data        JSONB NOT NULL DEFAULT '{}',
      date            DATE NOT NULL,
      last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_ads_cache_campaign ON reddit_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_ads_cache_date ON reddit_ads_cache(date DESC)`;
```

- [ ] **Step 2: Add brevo_campaign_metrics table**

```typescript
  // 35. brevo_campaign_metrics — email campaign performance (separate from ad normalization)
  await sql`
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
      raw_data        JSONB NOT NULL DEFAULT '{}',
      synced_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(request_id, campaign_id, date)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_brevo_metrics_request ON brevo_campaign_metrics(request_id, date)`;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add reddit_ads_cache and brevo_campaign_metrics tables"
```

---

### Task 2: Platform Types — Add Normalize Interface

**Files:**
- Modify: `src/lib/platforms/types.ts`

- [ ] **Step 1: Add normalize and daily metrics types**

Append to `src/lib/platforms/types.ts` after the existing `NormalizedAudienceData` interface:

```typescript
export interface DailyMetricRow {
  request_id: string | null;
  country: string;
  date: string;           // YYYY-MM-DD
  platform: string;       // meta_ads, reddit_ads, google_ads, etc.
  channel: string;        // facebook_feed, reddit_promoted, etc.
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  signups: number;
  profile_completes: number;
}

export interface PlatformNormalizeResult {
  platform: string;
  rows_normalized: number;
  campaigns_matched: number;
  campaigns_unmatched: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/platforms/types.ts
git commit -m "feat: add DailyMetricRow and PlatformNormalizeResult types"
```

---

### Task 3: Normalize Helper — Cache → normalized_daily_metrics

**Files:**
- Modify: `src/lib/platforms/normalizer.ts`

- [ ] **Step 1: Add normalizeToDaily function**

Add this function at the bottom of `src/lib/platforms/normalizer.ts`, after the existing `getMergedPaidAudience` function:

```typescript
import { getDb } from '@/lib/db';
import type { DailyMetricRow, PlatformNormalizeResult } from './types';

/**
 * Write normalized daily metrics from a platform cache table into normalized_daily_metrics.
 * Uses UTM campaign_slug matching to link platform campaigns to intake_requests.
 */
export async function normalizeToDaily(
  rows: DailyMetricRow[],
  platform: string,
): Promise<PlatformNormalizeResult> {
  const sql = getDb();
  let matched = 0;
  let unmatched = 0;
  let normalized = 0;

  for (const row of rows) {
    let requestId = row.request_id;

    // UTM campaign_slug matching: try to find intake_request by campaign name
    if (!requestId && row.channel) {
      const slugMatch = await sql`
        SELECT id FROM intake_requests
        WHERE campaign_slug = ${row.channel}
           OR campaign_slug = ${row.channel.toLowerCase().replace(/\s+/g, '-')}
        LIMIT 1
      `;
      if (slugMatch.length > 0) {
        requestId = slugMatch[0].id as string;
        matched++;
      } else {
        unmatched++;
      }
    }

    // Derive CPA, CTR, ROAS
    const cpa = row.conversions > 0 ? row.spend / row.conversions : null;
    const ctr = row.impressions > 0 ? row.clicks / row.impressions : null;

    // Upsert into normalized_daily_metrics
    await sql`
      INSERT INTO normalized_daily_metrics (
        request_id, country, date, platform, channel,
        impressions, clicks, spend, conversions, conversion_value,
        signups, profile_completes, cpa, ctr
      ) VALUES (
        ${requestId}, ${row.country || 'GLOBAL'}, ${row.date}, ${platform}, ${row.channel || platform},
        ${row.impressions}, ${row.clicks}, ${row.spend}, ${row.conversions}, ${row.conversion_value},
        ${row.signups}, ${row.profile_completes}, ${cpa}, ${ctr}
      )
      ON CONFLICT (request_id, country, date, platform, channel)
      DO UPDATE SET
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        spend = EXCLUDED.spend,
        conversions = EXCLUDED.conversions,
        conversion_value = EXCLUDED.conversion_value,
        signups = EXCLUDED.signups,
        profile_completes = EXCLUDED.profile_completes,
        cpa = EXCLUDED.cpa,
        ctr = EXCLUDED.ctr,
        created_at = NOW()
    `;
    normalized++;
  }

  return {
    platform,
    rows_normalized: normalized,
    campaigns_matched: matched,
    campaigns_unmatched: unmatched,
  };
}
```

- [ ] **Step 2: Add Reddit to getMergedPaidAudience imports**

At the top of `normalizer.ts`, add the Reddit import (after line 4):

```typescript
import { getNormalizedRedditAds } from './reddit-ads';
```

And add it to the `Promise.all` in `getMergedPaidAudience` (after the TikTok entry):

```typescript
    getNormalizedRedditAds(days),
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/platforms/normalizer.ts
git commit -m "feat: add normalizeToDaily helper for cache → normalized_daily_metrics"
```

---

### Task 4: Meta Ads — Complete the Sync + Normalize

**Files:**
- Modify: `src/lib/platforms/meta-ads.ts`

- [ ] **Step 1: Replace the stub syncMetaAds with real API call**

Replace the entire `syncMetaAds` function (lines 33-47) with:

```typescript
export async function syncMetaAds(requestId?: string, days: number = 7): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isMetaAdsConnected()) {
    return { platform: 'meta_ads', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'Meta Ads not configured.' };
  }

  const sql = getDb();
  const token = process.env.META_ADS_ACCESS_TOKEN!;
  const accountId = process.env.META_ADS_AD_ACCOUNT_ID!;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];
  const untilStr = new Date().toISOString().split('T')[0];

  try {
    // Fetch campaign insights from Meta Marketing API
    const url = `https://graph.facebook.com/v21.0/act_${accountId}/insights?` +
      `fields=campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions,cpc,cpm,ctr` +
      `&time_range={"since":"${sinceStr}","until":"${untilStr}"}` +
      `&time_increment=1` +
      `&level=adset` +
      `&limit=500` +
      `&access_token=${token}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      return { platform: 'meta_ads', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: `Meta API error: ${err.slice(0, 200)}` };
    }

    const data = await res.json();
    const rows = data.data || [];
    let synced = 0;

    for (const row of rows) {
      const conversions = (row.actions || [])
        .filter((a: { action_type: string }) => a.action_type === 'offsite_conversion' || a.action_type === 'lead')
        .reduce((sum: number, a: { value: string }) => sum + parseInt(a.value || '0'), 0);

      await sql`
        INSERT INTO meta_ads_cache (
          ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
          impressions, clicks, conversions, spend, date
        ) VALUES (
          ${accountId}, ${row.campaign_id}, ${row.campaign_name},
          ${row.adset_id || null}, ${row.adset_name || null},
          ${parseInt(row.impressions || '0')}, ${parseInt(row.clicks || '0')},
          ${conversions}, ${parseFloat(row.spend || '0')},
          ${row.date_start}
        )
        ON CONFLICT (ad_account_id, campaign_id, adset_id, date)
        DO UPDATE SET
          impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
          conversions = EXCLUDED.conversions, spend = EXCLUDED.spend,
          campaign_name = EXCLUDED.campaign_name, adset_name = EXCLUDED.adset_name,
          last_synced_at = NOW()
      `;
      synced++;
    }

    return { platform: 'meta_ads', success: true, rows_synced: synced, errors: 0, duration_ms: Date.now() - start, message: `Synced ${synced} rows from Meta Ads` };
  } catch (e) {
    return { platform: 'meta_ads', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: String(e) };
  }
}
```

- [ ] **Step 2: Add normalizeMetaAds function**

Add after `getNormalizedMetaAds`:

```typescript
import { normalizeToDaily } from './normalizer';
import type { DailyMetricRow, PlatformNormalizeResult } from './types';

export async function normalizeMetaAds(requestId?: string): Promise<PlatformNormalizeResult> {
  const sql = getDb();
  const filter = requestId
    ? sql`WHERE mac.campaign_name ILIKE '%' || ir.campaign_slug || '%'
           AND ir.id = ${requestId}`
    : sql`WHERE mac.campaign_name ILIKE '%' || ir.campaign_slug || '%'`;

  const rows = await sql`
    SELECT mac.campaign_name, mac.impressions, mac.clicks, mac.conversions,
           mac.spend, mac.date::text, ir.id as request_id
    FROM meta_ads_cache mac
    LEFT JOIN intake_requests ir ON mac.campaign_name ILIKE '%' || ir.campaign_slug || '%'
    ${filter}
  ` as any[];

  const dailyRows: DailyMetricRow[] = rows.map((r: any) => ({
    request_id: r.request_id || null,
    country: 'GLOBAL',
    date: r.date,
    platform: 'meta_ads',
    channel: 'facebook_feed',
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend,
    conversions: r.conversions,
    conversion_value: 0,
    signups: 0,
    profile_completes: 0,
  }));

  return normalizeToDaily(dailyRows, 'meta_ads');
}
```

- [ ] **Step 3: Add UNIQUE constraint for upsert**

The `meta_ads_cache` CREATE TABLE doesn't have a UNIQUE constraint for upserts. Add to schema.ts after the meta_ads_cache block:

```typescript
  await sql`
    DO $$ BEGIN
      ALTER TABLE meta_ads_cache ADD CONSTRAINT meta_ads_cache_uq
        UNIQUE(ad_account_id, campaign_id, adset_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/platforms/meta-ads.ts src/lib/db/schema.ts
git commit -m "feat: complete Meta Ads sync + normalize into normalized_daily_metrics"
```

---

### Task 5: Reddit Ads Client

**Files:**
- Create: `src/lib/platforms/reddit-ads.ts`

- [ ] **Step 1: Create the Reddit Ads client**

```typescript
/**
 * Reddit Ads client — env-var gated.
 *
 * Required env vars:
 *   REDDIT_ADS_ACCESS_TOKEN
 *   REDDIT_ADS_AD_ACCOUNT_ID
 */

import { getDb } from '@/lib/db';
import { normalizeToDaily } from './normalizer';
import type { PlatformSyncResult, PlatformConnectionStatus, NormalizedAudienceData, DailyMetricRow, PlatformNormalizeResult } from './types';

export function isRedditAdsConnected(): boolean {
  return !!(process.env.REDDIT_ADS_ACCESS_TOKEN && process.env.REDDIT_ADS_AD_ACCOUNT_ID);
}

export async function getRedditAdsStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isRedditAdsConnected();
  if (!connected) return { platform: 'reddit_ads', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM reddit_ads_cache`;
  const lastSync = await sql`SELECT MAX(last_synced_at) as last_sync FROM reddit_ads_cache`;

  return {
    platform: 'reddit_ads',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncRedditAds(requestId?: string, days: number = 7): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isRedditAdsConnected()) {
    return { platform: 'reddit_ads', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'Reddit Ads not configured.' };
  }

  const sql = getDb();
  const token = process.env.REDDIT_ADS_ACCESS_TOKEN!;
  const accountId = process.env.REDDIT_ADS_AD_ACCOUNT_ID!;

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  try {
    const res = await fetch(
      `https://ads-api.reddit.com/api/v3/ad_accounts/${accountId}/reports?` +
      `start_date=${startDate}&end_date=${endDate}&time_granularity=DAY&group_by=campaign_id,ad_group_id`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { platform: 'reddit_ads', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: `Reddit API error: ${err.slice(0, 200)}` };
    }

    const data = await res.json();
    const rows = data.data || [];
    let synced = 0;

    for (const row of rows) {
      await sql`
        INSERT INTO reddit_ads_cache (
          ad_account_id, campaign_id, campaign_name, ad_group_id, ad_group_name,
          impressions, clicks, conversions, spend, ecpm, cpc, ctr, date
        ) VALUES (
          ${accountId}, ${row.campaign_id}, ${row.campaign_name || ''},
          ${row.ad_group_id || null}, ${row.ad_group_name || null},
          ${row.impressions || 0}, ${row.clicks || 0}, ${row.conversions || 0},
          ${parseFloat(row.spend || '0') / 100},
          ${row.ecpm ? parseFloat(row.ecpm) / 100 : null},
          ${row.cpc ? parseFloat(row.cpc) / 100 : null},
          ${row.ctr ? parseFloat(row.ctr) : null},
          ${row.date}
        )
        ON CONFLICT (ad_account_id, campaign_id, ad_group_id, date)
        DO UPDATE SET
          impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
          conversions = EXCLUDED.conversions, spend = EXCLUDED.spend,
          campaign_name = EXCLUDED.campaign_name, ad_group_name = EXCLUDED.ad_group_name,
          ecpm = EXCLUDED.ecpm, cpc = EXCLUDED.cpc, ctr = EXCLUDED.ctr,
          last_synced_at = NOW()
      `;
      synced++;
    }

    return { platform: 'reddit_ads', success: true, rows_synced: synced, errors: 0, duration_ms: Date.now() - start, message: `Synced ${synced} rows from Reddit Ads` };
  } catch (e) {
    return { platform: 'reddit_ads', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: String(e) };
  }
}

export async function normalizeRedditAds(requestId?: string): Promise<PlatformNormalizeResult> {
  const sql = getDb();

  const rows = await sql`
    SELECT rac.campaign_name, rac.impressions, rac.clicks, rac.conversions,
           rac.spend, rac.date::text, ir.id as request_id
    FROM reddit_ads_cache rac
    LEFT JOIN intake_requests ir ON rac.campaign_name ILIKE '%' || ir.campaign_slug || '%'
  ` as any[];

  const dailyRows: DailyMetricRow[] = rows.map((r: any) => ({
    request_id: r.request_id || null,
    country: 'GLOBAL',
    date: r.date,
    platform: 'reddit_ads',
    channel: 'reddit_promoted',
    impressions: r.impressions,
    clicks: r.clicks,
    spend: r.spend,
    conversions: r.conversions,
    conversion_value: 0,
    signups: 0,
    profile_completes: 0,
  }));

  return normalizeToDaily(dailyRows, 'reddit_ads');
}

export async function getNormalizedRedditAds(days: number = 30): Promise<NormalizedAudienceData | null> {
  const sql = getDb();
  if (!isRedditAdsConnected()) return null;

  const rows = await sql`
    SELECT
      SUM(impressions)::int as impressions,
      SUM(clicks)::int as clicks,
      SUM(conversions)::int as conversions,
      SUM(spend)::float as spend
    FROM reddit_ads_cache
    WHERE date >= CURRENT_DATE - ${days}::int
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  return {
    platform: 'reddit_ads',
    impressions: (row.impressions as number) ?? 0,
    clicks: (row.clicks as number) ?? 0,
    conversions: (row.conversions as number) ?? 0,
    spend: (row.spend as number) ?? 0,
    regions: {},
    demographics: {},
    interests: [],
    audience_segments: [],
  };
}
```

- [ ] **Step 2: Add UNIQUE constraint to reddit_ads_cache**

In schema.ts, after the reddit_ads_cache CREATE TABLE block, add:

```typescript
  await sql`
    DO $$ BEGIN
      ALTER TABLE reddit_ads_cache ADD CONSTRAINT reddit_ads_cache_uq
        UNIQUE(ad_account_id, campaign_id, ad_group_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/platforms/reddit-ads.ts src/lib/db/schema.ts
git commit -m "feat: add Reddit Ads client with sync + normalize"
```

---

### Task 6: Brevo Email Client

**Files:**
- Create: `src/lib/platforms/brevo.ts`

- [ ] **Step 1: Create the Brevo client**

```typescript
/**
 * Brevo (formerly Sendinblue) email campaign client.
 * Writes to brevo_campaign_metrics (separate from ad normalization).
 *
 * Required env vars:
 *   BREVO_API_KEY
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus } from './types';

export function isBrevoConnected(): boolean {
  return !!process.env.BREVO_API_KEY;
}

export async function getBrevoStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isBrevoConnected();
  if (!connected) return { platform: 'brevo', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM brevo_campaign_metrics`;
  const lastSync = await sql`SELECT MAX(synced_at) as last_sync FROM brevo_campaign_metrics`;

  return {
    platform: 'brevo',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncBrevo(requestId?: string, days: number = 30): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isBrevoConnected()) {
    return { platform: 'brevo', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'Brevo not configured.' };
  }

  const sql = getDb();
  const apiKey = process.env.BREVO_API_KEY!;

  try {
    // Fetch email campaigns from Brevo API
    const res = await fetch('https://api.brevo.com/v3/emailCampaigns?limit=50&sort=desc&status=sent', {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.text();
      return { platform: 'brevo', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: `Brevo API error: ${err.slice(0, 200)}` };
    }

    const data = await res.json();
    const campaigns = data.campaigns || [];
    let synced = 0;

    for (const campaign of campaigns) {
      const stats = campaign.statistics?.globalStats || {};
      const sentDate = campaign.sentDate ? campaign.sentDate.split('T')[0] : new Date().toISOString().split('T')[0];

      // UTM matching: find linked intake_request
      let linkedRequestId = requestId || null;
      if (!linkedRequestId && campaign.tag) {
        const slugMatch = await sql`
          SELECT id FROM intake_requests WHERE campaign_slug = ${campaign.tag} LIMIT 1
        `;
        if (slugMatch.length > 0) linkedRequestId = slugMatch[0].id as string;
      }

      const delivered = stats.delivered || 0;
      const opens = stats.uniqueOpens || 0;
      const clicks = stats.uniqueClicks || 0;
      const bounces = (stats.hardBounces || 0) + (stats.softBounces || 0);

      await sql`
        INSERT INTO brevo_campaign_metrics (
          request_id, campaign_id, campaign_name, subject, date,
          sends, delivered, opens, unique_opens, clicks, unique_clicks,
          bounces, unsubscribes, spam_reports,
          open_rate, click_rate, bounce_rate, raw_data
        ) VALUES (
          ${linkedRequestId}, ${String(campaign.id)}, ${campaign.name || ''}, ${campaign.subject || ''},
          ${sentDate},
          ${stats.sent || 0}, ${delivered}, ${stats.viewed || 0}, ${opens},
          ${stats.clicked || 0}, ${clicks},
          ${bounces}, ${stats.unsubscribed || 0}, ${stats.spamReports || 0},
          ${delivered > 0 ? opens / delivered : 0},
          ${delivered > 0 ? clicks / delivered : 0},
          ${(stats.sent || 0) > 0 ? bounces / stats.sent : 0},
          ${JSON.stringify(campaign)}::jsonb
        )
        ON CONFLICT (request_id, campaign_id, date)
        DO UPDATE SET
          sends = EXCLUDED.sends, delivered = EXCLUDED.delivered,
          opens = EXCLUDED.opens, unique_opens = EXCLUDED.unique_opens,
          clicks = EXCLUDED.clicks, unique_clicks = EXCLUDED.unique_clicks,
          bounces = EXCLUDED.bounces, unsubscribes = EXCLUDED.unsubscribes,
          open_rate = EXCLUDED.open_rate, click_rate = EXCLUDED.click_rate,
          bounce_rate = EXCLUDED.bounce_rate,
          raw_data = EXCLUDED.raw_data, synced_at = NOW()
      `;
      synced++;
    }

    return { platform: 'brevo', success: true, rows_synced: synced, errors: 0, duration_ms: Date.now() - start, message: `Synced ${synced} email campaigns from Brevo` };
  } catch (e) {
    return { platform: 'brevo', success: false, rows_synced: 0, errors: 1, duration_ms: Date.now() - start, message: String(e) };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/platforms/brevo.ts
git commit -m "feat: add Brevo email campaign client with sync to brevo_campaign_metrics"
```

---

### Task 7: Sync Orchestrator Route

**Files:**
- Create: `src/app/api/platforms/sync/route.ts`

- [ ] **Step 1: Create the sync orchestrator**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/permissions';

import { isMetaAdsConnected, syncMetaAds, normalizeMetaAds } from '@/lib/platforms/meta-ads';
import { isRedditAdsConnected, syncRedditAds, normalizeRedditAds } from '@/lib/platforms/reddit-ads';
import { isBrevoConnected, syncBrevo } from '@/lib/platforms/brevo';
import type { PlatformSyncResult, PlatformNormalizeResult } from '@/lib/platforms/types';

interface SyncResultEntry {
  sync: PlatformSyncResult;
  normalize?: PlatformNormalizeResult;
}

export async function POST(request: NextRequest) {
  const authCtx = await getAuthContext();
  if (!authCtx || authCtx.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = body.request_id as string | undefined;
  const platforms = body.platforms as string[] | undefined;
  const days = (body.days as number) || 7;

  const results: Record<string, SyncResultEntry> = {};
  let totalNormalized = 0;

  // Meta Ads
  if (isMetaAdsConnected() && (!platforms || platforms.includes('meta_ads'))) {
    const sync = await syncMetaAds(requestId, days);
    let normalize: PlatformNormalizeResult | undefined;
    if (sync.success && sync.rows_synced > 0) {
      normalize = await normalizeMetaAds(requestId);
      totalNormalized += normalize.rows_normalized;
    }
    results.meta_ads = { sync, normalize };
  }

  // Reddit Ads
  if (isRedditAdsConnected() && (!platforms || platforms.includes('reddit_ads'))) {
    const sync = await syncRedditAds(requestId, days);
    let normalize: PlatformNormalizeResult | undefined;
    if (sync.success && sync.rows_synced > 0) {
      normalize = await normalizeRedditAds(requestId);
      totalNormalized += normalize.rows_normalized;
    }
    results.reddit_ads = { sync, normalize };
  }

  // Brevo (email — separate table, no normalization into daily metrics)
  if (isBrevoConnected() && (!platforms || platforms.includes('brevo'))) {
    const sync = await syncBrevo(requestId, days);
    results.brevo = { sync };
  }

  const platformsSynced = Object.keys(results).filter(k => results[k].sync.success);

  return NextResponse.json({
    platforms_synced: platformsSynced,
    results,
    total_normalized: totalNormalized,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/platforms/sync/route.ts
git commit -m "feat: add platform sync orchestrator route"
```

---

### Task 8: Update .env.example with New Vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Reddit + Brevo env vars**

Append to `.env.example`:

```
# Reddit Ads (Wave 1 — May 6)
REDDIT_ADS_ACCESS_TOKEN=
REDDIT_ADS_AD_ACCOUNT_ID=

# Brevo email marketing (Wave 1 — May 6)
BREVO_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "feat: add Reddit Ads + Brevo env vars to .env.example"
```

---

### Task 9: Run Migrations + Verify

- [ ] **Step 1: Run migrations on Neon**

```bash
NEON_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^DATABASE_URL=//' | tr -d '"')
psql "$NEON_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('reddit_ads_cache', 'brevo_campaign_metrics') ORDER BY tablename;"
```

Expected: both tables exist.

- [ ] **Step 2: Run migrations on Azure PG**

```bash
export PGPASSWORD="test"
psql "host=onetake-pg-west01.postgres.database.azure.com port=5432 dbname=onetake_db user=sqladm sslmode=require" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('reddit_ads_cache', 'brevo_campaign_metrics') ORDER BY tablename;"
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: same count as before (5 pre-existing).

- [ ] **Step 4: Test sync orchestrator responds**

```bash
curl -s -X POST http://localhost:3003/api/platforms/sync -H "Content-Type: application/json" -d '{"days": 7}'
```

Expected: 403 (no auth) or sync results (if auth cookie present).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: migration and integration test fixes for normalization layer"
```
