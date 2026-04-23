# AudienceIQ Phase 5: Ad Platform Audiences + Normalization Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 4 ad platform API clients (Google Ads, Meta, LinkedIn, TikTok), each with a dedicated cache table, independent sync cron routes, and a normalization layer that merges platform-specific data into Ring 2 (paid audience) for the drift calculator.

**Architecture:** Per-platform cache tables store raw API data in native schema. Each platform has an env-var gated client, a sync cron route, and a normalizer function. A unified normalization layer merges all available platform data into `audience_profiles` (Ring 2: paid). The existing drift calculator automatically picks up Ring 2 data on next computation. Platforms that aren't configured are gracefully skipped.

**Tech Stack:** Next.js 16 App Router, Neon Postgres, platform REST APIs, Tailwind CSS 4

---

## File Structure

### New files:
```
src/
├── lib/
│   └── platforms/
│       ├── types.ts                    # Shared platform types
│       ├── google-ads.ts               # Google Ads client + sync
│       ├── meta-ads.ts                 # Meta Marketing API client + sync
│       ├── linkedin-ads.ts             # LinkedIn Campaign Manager client + sync
│       ├── tiktok-ads.ts               # TikTok Marketing API client + sync
��       └── normalizer.ts              # Merges all platforms → Ring 2 profile
├── components/
│   └── insights/
│       └── widgets/
│           └── PlatformAudiencesWidget.tsx  # Multi-platform audience overview
└── app/
    └── api/
        └── audienceiq/
            └── platforms/
                ├── sync/route.ts       # POST sync all platforms
                ├── status/route.ts     # GET per-platform connection status
                ├── google/
                │   └── sync/route.ts   # POST sync Google Ads
                ├── meta/
                │   └── sync/route.ts   # POST sync Meta Ads
                ├─��� linkedin/
                │   └── sync/route.ts   # POST sync LinkedIn Ads
                └── tiktok/
                    └── sync/route.ts   # POST sync TikTok Ads
```

### Files to modify:
```
src/lib/db/schema.ts                    # Add 4 platform cache tables
src/lib/audienceiq/profile-builder.ts   # Upgrade paid ring with normalizer
src/components/insights/types.ts        # Add 1 new WidgetType
src/components/insights/widgetRegistry.ts # Register 1 new widget
```

---

## Task 1: DB Migration — 4 Platform Cache Tables

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add 4 platform cache tables**

Add after the HIE tables in schema.ts:

```typescript
  // 30. google_ads_cache — raw Google Ads campaign/audience data
  await sql`
    CREATE TABLE IF NOT EXISTS google_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id       TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      ad_group_id       TEXT,
      ad_group_name     TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend_micros      BIGINT NOT NULL DEFAULT 0,
      demographics      JSONB NOT NULL DEFAULT '{}',
      audience_segments JSONB NOT NULL DEFAULT '[]',
      geo_targets       JSONB NOT NULL DEFAULT '[]',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_google_ads_cache_campaign ON google_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_google_ads_cache_date ON google_ads_cache(date DESC)`;

  // 31. meta_ads_cache — raw Meta (Facebook/Instagram) ad data
  await sql`
    CREATE TABLE IF NOT EXISTS meta_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_account_id     TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      adset_id          TEXT,
      adset_name        TEXT,
      ad_id             TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend             FLOAT NOT NULL DEFAULT 0,
      audience_insights JSONB NOT NULL DEFAULT '{}',
      targeting         JSONB NOT NULL DEFAULT '{}',
      demographics      JSONB NOT NULL DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_campaign ON meta_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_date ON meta_ads_cache(date DESC)`;

  // 32. linkedin_ads_cache — raw LinkedIn Campaign Manager data
  await sql`
    CREATE TABLE IF NOT EXISTS linkedin_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_account_id     TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      creative_id       TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend             FLOAT NOT NULL DEFAULT 0,
      targeting         JSONB NOT NULL DEFAULT '{}',
      demographics      JSONB NOT NULL DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_ads_cache_campaign ON linkedin_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_ads_cache_date ON linkedin_ads_cache(date DESC)`;

  // 33. tiktok_ads_cache — raw TikTok Marketing API data
  await sql`
    CREATE TABLE IF NOT EXISTS tiktok_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      advertiser_id     TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      adgroup_id        TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend             FLOAT NOT NULL DEFAULT 0,
      audience          JSONB NOT NULL DEFAULT '{}',
      demographics      JSONB NOT NULL DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tiktok_ads_cache_campaign ON tiktok_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tiktok_ads_cache_date ON tiktok_ads_cache(date DESC)`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(platforms): add 4 ad platform cache tables — Google, Meta, LinkedIn, TikTok"
```

---

## Task 2: Platform Types + 4 Client Modules

**Files:**
- Create: `src/lib/platforms/types.ts`
- Create: `src/lib/platforms/google-ads.ts`
- Create: `src/lib/platforms/meta-ads.ts`
- Create: `src/lib/platforms/linkedin-ads.ts`
- Create: `src/lib/platforms/tiktok-ads.ts`

- [ ] **Step 1: Shared platform types**

```typescript
/**
 * Shared types for ad platform integrations.
 */

export interface PlatformSyncResult {
  platform: string;
  success: boolean;
  rows_synced: number;
  errors: number;
  duration_ms: number;
  message: string;
}

export interface PlatformConnectionStatus {
  platform: string;
  connected: boolean;
  has_data: boolean;
  last_sync_at: string | null;
  row_count: number;
}

export interface NormalizedAudienceData {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  regions: Record<string, number>;
  demographics: {
    age_ranges?: Record<string, number>;
    genders?: Record<string, number>;
  };
  interests: string[];
  audience_segments: string[];
}
```

- [ ] **Step 2: Google Ads client**

```typescript
/**
 * Google Ads client — env-var gated.
 *
 * Required env vars:
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_REFRESH_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus, NormalizedAudienceData } from './types';

export function isGoogleAdsConnected(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

export async function getGoogleAdsStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isGoogleAdsConnected();
  if (!connected) return { platform: 'google_ads', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM google_ads_cache`;
  const lastSync = await sql`SELECT MAX(last_synced_at) as last_sync FROM google_ads_cache`;

  return {
    platform: 'google_ads',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncGoogleAds(days: number = 30): Promise<PlatformSyncResult> {
  const start = Date.now();

  if (!isGoogleAdsConnected()) {
    return { platform: 'google_ads', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'Google Ads not configured. Set GOOGLE_ADS_* env vars.' };
  }

  // TODO: Implement actual Google Ads API call using google-ads-api or REST
  // For now, return a placeholder indicating the sync endpoint is wired but needs API implementation
  return {
    platform: 'google_ads',
    success: false,
    rows_synced: 0,
    errors: 0,
    duration_ms: Date.now() - start,
    message: 'Google Ads sync endpoint wired. Implement API call with google-ads-api library when credentials are available.',
  };
}

export async function getNormalizedGoogleAds(days: number = 30): Promise<NormalizedAudienceData | null> {
  const sql = getDb();
  if (!isGoogleAdsConnected()) return null;

  const rows = await sql`
    SELECT
      SUM(impressions)::int as impressions,
      SUM(clicks)::int as clicks,
      SUM(conversions)::int as conversions,
      SUM(spend_micros)::bigint as spend_micros,
      jsonb_agg(DISTINCT demographics) as all_demographics,
      jsonb_agg(DISTINCT geo_targets) as all_geos
    FROM google_ads_cache
    WHERE date >= CURRENT_DATE - ${days}::int
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  return {
    platform: 'google_ads',
    impressions: (row.impressions as number) ?? 0,
    clicks: (row.clicks as number) ?? 0,
    conversions: (row.conversions as number) ?? 0,
    spend: ((row.spend_micros as number) ?? 0) / 1_000_000,
    regions: {},
    demographics: {},
    interests: [],
    audience_segments: [],
  };
}
```

- [ ] **Step 3: Meta Ads client**

```typescript
/**
 * Meta Ads client — env-var gated.
 *
 * Required env vars:
 *   META_ADS_ACCESS_TOKEN
 *   META_ADS_AD_ACCOUNT_ID
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus, NormalizedAudienceData } from './types';

export function isMetaAdsConnected(): boolean {
  return !!(process.env.META_ADS_ACCESS_TOKEN && process.env.META_ADS_AD_ACCOUNT_ID);
}

export async function getMetaAdsStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isMetaAdsConnected();
  if (!connected) return { platform: 'meta_ads', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM meta_ads_cache`;
  const lastSync = await sql`SELECT MAX(last_synced_at) as last_sync FROM meta_ads_cache`;

  return {
    platform: 'meta_ads',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncMetaAds(days: number = 30): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isMetaAdsConnected()) {
    return { platform: 'meta_ads', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'Meta Ads not configured. Set META_ADS_* env vars.' };
  }

  return {
    platform: 'meta_ads',
    success: false,
    rows_synced: 0,
    errors: 0,
    duration_ms: Date.now() - start,
    message: 'Meta Ads sync endpoint wired. Implement Facebook Marketing API call when credentials are available.',
  };
}

export async function getNormalizedMetaAds(days: number = 30): Promise<NormalizedAudienceData | null> {
  const sql = getDb();
  if (!isMetaAdsConnected()) return null;

  const rows = await sql`
    SELECT
      SUM(impressions)::int as impressions,
      SUM(clicks)::int as clicks,
      SUM(conversions)::int as conversions,
      SUM(spend)::float as spend
    FROM meta_ads_cache
    WHERE date >= CURRENT_DATE - ${days}::int
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  return {
    platform: 'meta_ads',
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

- [ ] **Step 4: LinkedIn Ads client**

```typescript
/**
 * LinkedIn Ads client ��� env-var gated.
 *
 * Required env vars:
 *   LINKEDIN_ADS_ACCESS_TOKEN
 *   LINKEDIN_ADS_AD_ACCOUNT_ID
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus, NormalizedAudienceData } from './types';

export function isLinkedInAdsConnected(): boolean {
  return !!(process.env.LINKEDIN_ADS_ACCESS_TOKEN && process.env.LINKEDIN_ADS_AD_ACCOUNT_ID);
}

export async function getLinkedInAdsStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isLinkedInAdsConnected();
  if (!connected) return { platform: 'linkedin_ads', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM linkedin_ads_cache`;
  const lastSync = await sql`SELECT MAX(last_synced_at) as last_sync FROM linkedin_ads_cache`;

  return {
    platform: 'linkedin_ads',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncLinkedInAds(days: number = 30): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isLinkedInAdsConnected()) {
    return { platform: 'linkedin_ads', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'LinkedIn Ads not configured. Set LINKEDIN_ADS_* env vars.' };
  }

  return {
    platform: 'linkedin_ads',
    success: false,
    rows_synced: 0,
    errors: 0,
    duration_ms: Date.now() - start,
    message: 'LinkedIn Ads sync endpoint wired. Implement Campaign Manager API call when credentials are available.',
  };
}

export async function getNormalizedLinkedInAds(days: number = 30): Promise<NormalizedAudienceData | null> {
  const sql = getDb();
  if (!isLinkedInAdsConnected()) return null;

  const rows = await sql`
    SELECT SUM(impressions)::int as impressions, SUM(clicks)::int as clicks, SUM(conversions)::int as conversions, SUM(spend)::float as spend
    FROM linkedin_ads_cache WHERE date >= CURRENT_DATE - ${days}::int
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  return {
    platform: 'linkedin_ads',
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

- [ ] **Step 5: TikTok Ads client**

```typescript
/**
 * TikTok Ads client — env-var gated.
 *
 * Required env vars:
 *   TIKTOK_ADS_ACCESS_TOKEN
 *   TIKTOK_ADS_ADVERTISER_ID
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus, NormalizedAudienceData } from './types';

export function isTikTokAdsConnected(): boolean {
  return !!(process.env.TIKTOK_ADS_ACCESS_TOKEN && process.env.TIKTOK_ADS_ADVERTISER_ID);
}

export async function getTikTokAdsStatus(): Promise<PlatformConnectionStatus> {
  const sql = getDb();
  const connected = isTikTokAdsConnected();
  if (!connected) return { platform: 'tiktok_ads', connected: false, has_data: false, last_sync_at: null, row_count: 0 };

  const countRow = await sql`SELECT COUNT(*)::int as count FROM tiktok_ads_cache`;
  const lastSync = await sql`SELECT MAX(last_synced_at) as last_sync FROM tiktok_ads_cache`;

  return {
    platform: 'tiktok_ads',
    connected: true,
    has_data: (countRow[0] as { count: number }).count > 0,
    last_sync_at: (lastSync[0] as { last_sync: string | null })?.last_sync ?? null,
    row_count: (countRow[0] as { count: number }).count,
  };
}

export async function syncTikTokAds(days: number = 30): Promise<PlatformSyncResult> {
  const start = Date.now();
  if (!isTikTokAdsConnected()) {
    return { platform: 'tiktok_ads', success: false, rows_synced: 0, errors: 0, duration_ms: 0, message: 'TikTok Ads not configured. Set TIKTOK_ADS_* env vars.' };
  }

  return {
    platform: 'tiktok_ads',
    success: false,
    rows_synced: 0,
    errors: 0,
    duration_ms: Date.now() - start,
    message: 'TikTok Ads sync endpoint wired. Implement Marketing API call when credentials are available.',
  };
}

export async function getNormalizedTikTokAds(days: number = 30): Promise<NormalizedAudienceData | null> {
  const sql = getDb();
  if (!isTikTokAdsConnected()) return null;

  const rows = await sql`
    SELECT SUM(impressions)::int as impressions, SUM(clicks)::int as clicks, SUM(conversions)::int as conversions, SUM(spend)::float as spend
    FROM tiktok_ads_cache WHERE date >= CURRENT_DATE - ${days}::int
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  return {
    platform: 'tiktok_ads',
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

- [ ] **Step 6: Commit**

```bash
git add src/lib/platforms/
git commit -m "feat(platforms): add 4 env-var gated ad platform clients — Google, Meta, LinkedIn, TikTok"
```

---

## Task 3: Normalization Layer + Profile Builder Upgrade

**Files:**
- Create: `src/lib/platforms/normalizer.ts`
- Modify: `src/lib/audienceiq/profile-builder.ts`

- [ ] **Step 1: Create normalizer**

Merges all available platform data into one Ring 2 profile.

```typescript
/**
 * Platform Normalizer — merges all available ad platform data into Ring 2 (paid audience).
 */

import { getNormalizedGoogleAds } from './google-ads';
import { getNormalizedMetaAds } from './meta-ads';
import { getNormalizedLinkedInAds } from './linkedin-ads';
import { getNormalizedTikTokAds } from './tiktok-ads';
import type { NormalizedAudienceData } from './types';

export interface MergedPaidAudience {
  platforms_available: string[];
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_spend: number;
  regions: Record<string, number>;
  demographics: {
    age_ranges: Record<string, number>;
    genders: Record<string, number>;
  };
  interests: string[];
  per_platform: NormalizedAudienceData[];
}

export async function getMergedPaidAudience(days: number = 30): Promise<MergedPaidAudience> {
  const results = await Promise.all([
    getNormalizedGoogleAds(days),
    getNormalizedMetaAds(days),
    getNormalizedLinkedInAds(days),
    getNormalizedTikTokAds(days),
  ]);

  const available = results.filter((r): r is NormalizedAudienceData => r !== null);

  const merged: MergedPaidAudience = {
    platforms_available: available.map(r => r.platform),
    total_impressions: 0,
    total_clicks: 0,
    total_conversions: 0,
    total_spend: 0,
    regions: {},
    demographics: { age_ranges: {}, genders: {} },
    interests: [],
    per_platform: available,
  };

  for (const data of available) {
    merged.total_impressions += data.impressions;
    merged.total_clicks += data.clicks;
    merged.total_conversions += data.conversions;
    merged.total_spend += data.spend;

    for (const [region, count] of Object.entries(data.regions)) {
      merged.regions[region] = (merged.regions[region] ?? 0) + count;
    }

    if (data.demographics.age_ranges) {
      for (const [range, count] of Object.entries(data.demographics.age_ranges)) {
        merged.demographics.age_ranges[range] = (merged.demographics.age_ranges[range] ?? 0) + count;
      }
    }
    if (data.demographics.genders) {
      for (const [gender, count] of Object.entries(data.demographics.genders)) {
        merged.demographics.genders[gender] = (merged.demographics.genders[gender] ?? 0) + count;
      }
    }

    merged.interests.push(...data.interests);
  }

  merged.interests = [...new Set(merged.interests)];

  return merged;
}
```

- [ ] **Step 2: Upgrade paid profile builder**

In `src/lib/audienceiq/profile-builder.ts`, replace the `buildPaidProfile` stub:

```typescript
export async function buildPaidProfile(requestId: string): Promise<ProfileData> {
  const { getMergedPaidAudience } = await import('../platforms/normalizer');
  const merged = await getMergedPaidAudience(30);

  if (merged.platforms_available.length === 0) {
    return {
      request_id: requestId,
      ring: 'paid',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'platforms_unavailable',
    };
  }

  const regions = Object.entries(merged.regions).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const sampleSize = merged.total_impressions;
  const confidence = sampleSize >= 10000 ? 'high' : sampleSize >= 1000 ? 'medium' : 'low';

  return {
    request_id: requestId,
    ring: 'paid',
    demographics: {
      platforms: merged.platforms_available,
      total_spend: merged.total_spend,
      total_impressions: merged.total_impressions,
      total_clicks: merged.total_clicks,
      total_conversions: merged.total_conversions,
      age_ranges: merged.demographics.age_ranges,
      genders: merged.demographics.genders,
      geo_distribution: merged.regions,
    },
    skills: {},
    languages: [],
    regions,
    sample_size: sampleSize,
    confidence,
    source: merged.platforms_available.join('+'),
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/platforms/normalizer.ts src/lib/audienceiq/profile-builder.ts
git commit -m "feat(platforms): add normalization layer + upgrade paid profile builder"
```

---

## Task 4: Platform API Routes (7 routes)

**Files:**
- Create: `src/app/api/audienceiq/platforms/sync/route.ts`
- Create: `src/app/api/audienceiq/platforms/status/route.ts`
- Create: `src/app/api/audienceiq/platforms/google/sync/route.ts`
- Create: `src/app/api/audienceiq/platforms/meta/sync/route.ts`
- Create: `src/app/api/audienceiq/platforms/linkedin/sync/route.ts`
- Create: `src/app/api/audienceiq/platforms/tiktok/sync/route.ts`

- [ ] **Step 1: Sync all platforms route**

```typescript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncGoogleAds } from '@/lib/platforms/google-ads';
import { syncMetaAds } from '@/lib/platforms/meta-ads';
import { syncLinkedInAds } from '@/lib/platforms/linkedin-ads';
import { syncTikTokAds } from '@/lib/platforms/tiktok-ads';

export async function POST() {
  await requireRole(['admin']);
  const results = await Promise.all([
    syncGoogleAds(),
    syncMetaAds(),
    syncLinkedInAds(),
    syncTikTokAds(),
  ]);
  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Status route**

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getGoogleAdsStatus } from '@/lib/platforms/google-ads';
import { getMetaAdsStatus } from '@/lib/platforms/meta-ads';
import { getLinkedInAdsStatus } from '@/lib/platforms/linkedin-ads';
import { getTikTokAdsStatus } from '@/lib/platforms/tiktok-ads';

export async function GET() {
  await requireAuth();
  const statuses = await Promise.all([
    getGoogleAdsStatus(),
    getMetaAdsStatus(),
    getLinkedInAdsStatus(),
    getTikTokAdsStatus(),
  ]);
  const connected = statuses.filter(s => s.connected).length;
  return NextResponse.json({ platforms: statuses, connected_count: connected, total: 4 });
}
```

- [ ] **Step 3: Per-platform sync routes (4 files)**

Each follows this pattern:

`src/app/api/audienceiq/platforms/google/sync/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncGoogleAds } from '@/lib/platforms/google-ads';

export async function POST() {
  await requireRole(['admin']);
  const result = await syncGoogleAds();
  return NextResponse.json(result);
}
```

Same pattern for meta (import syncMetaAds), linkedin (syncLinkedInAds), tiktok (syncTikTokAds).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/audienceiq/platforms/
git commit -m "feat(platforms): add 7 platform API routes — sync all, status, per-platform sync"
```

---

## Task 5: PlatformAudiencesWidget + Registry

**Files:**
- Modify: `src/components/insights/types.ts`
- Modify: `src/components/insights/widgetRegistry.ts`
- Create: `src/components/insights/widgets/PlatformAudiencesWidget.tsx`

- [ ] **Step 1: Add type + registry**

In `types.ts`, add after `'hie-form-friction'`:
```typescript
  | 'platform-audiences'
```

In `widgetRegistry.ts`, update to "30 widgets". Add `Megaphone` to imports. Add before `text-note`:

```typescript
  'platform-audiences': {
    component: lazy(() => import('./widgets/PlatformAudiencesWidget')),
    category: 'audienceiq', label: 'Platform Audiences', icon: Megaphone,
    description: 'Multi-platform ad audience overview — Google, Meta, LinkedIn, TikTok',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
```

- [ ] **Step 2: Create PlatformAudiencesWidget**

```typescript
"use client";

import { useEffect, useState } from 'react';
import { Unplug, CheckCircle, XCircle } from 'lucide-react';

interface PlatformStatus {
  platform: string;
  connected: boolean;
  has_data: boolean;
  last_sync_at: string | null;
  row_count: number;
}

interface StatusData {
  platforms: PlatformStatus[];
  connected_count: number;
  total: number;
}

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta (Facebook/IG)',
  linkedin_ads: 'LinkedIn Ads',
  tiktok_ads: 'TikTok Ads',
};

const PLATFORM_COLORS: Record<string, string> = {
  google_ads: '#4285F4',
  meta_ads: '#1877F2',
  linkedin_ads: '#0A66C2',
  tiktok_ads: '#000000',
};

export default function PlatformAudiencesWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch('/api/audienceiq/platforms/status').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.connected_count === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Platforms Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Set platform API credentials in env vars to enable ad audience data</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.platforms.map(p => (
          <div key={p.platform} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: PLATFORM_COLORS[p.platform] ?? '#737373' }} />
              <span className="text-xs font-semibold text-[var(--foreground)]">{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              {p.connected ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              )}
              <span className="text-[10px] text-[var(--muted-foreground)]">{p.connected ? 'Connected' : 'Not configured'}</span>
            </div>
            {p.has_data && (
              <div className="space-y-1">
                <div className="text-[10px] text-[var(--muted-foreground)]">{p.row_count} cached rows</div>
                {p.last_sync_at && (
                  <div className="text-[10px] text-[var(--muted-foreground)]">Last sync: {new Date(p.last_sync_at).toLocaleDateString()}</div>
                )}
              </div>
            )}
            {p.connected && !p.has_data && (
              <div className="text-[10px] text-amber-600">Connected — trigger sync to pull data</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/types.ts src/components/insights/widgetRegistry.ts src/components/insights/widgets/PlatformAudiencesWidget.tsx
git commit -m "feat(platforms): add PlatformAudiencesWidget — multi-platform status overview"
```

---

## Task 6: TypeScript Verification

- [ ] **Step 1: Type check**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 2: Verify 30 total widgets**

- [ ] **Step 3: Commit fixes**
```bash
git add -A
git commit -m "fix(platforms): resolve Phase 5 TypeScript issues"
```
