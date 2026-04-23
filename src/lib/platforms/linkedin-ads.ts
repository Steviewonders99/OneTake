/**
 * LinkedIn Ads client — env-var gated.
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
