/**
 * Meta Ads client — env-var gated.
 *
 * Required env vars:
 *   META_ADS_ACCESS_TOKEN
 *   META_ADS_AD_ACCOUNT_ID
 */

import { getDb } from '@/lib/db';
import type { PlatformSyncResult, PlatformConnectionStatus, NormalizedAudienceData, DailyMetricRow, PlatformNormalizeResult } from './types';
import { normalizeToDaily } from './normalizer';

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

export async function normalizeMetaAds(requestId?: string): Promise<PlatformNormalizeResult> {
  const sql = getDb();

  const rows = await sql`
    SELECT mac.campaign_name, mac.impressions, mac.clicks, mac.conversions,
           mac.spend, mac.date::text, ir.id as request_id
    FROM meta_ads_cache mac
    LEFT JOIN intake_requests ir ON mac.campaign_name ILIKE '%' || ir.campaign_slug || '%'
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
