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
