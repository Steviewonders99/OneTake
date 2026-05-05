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
