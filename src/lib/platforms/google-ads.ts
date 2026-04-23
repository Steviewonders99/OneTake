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
