/**
 * Platform Normalizer — merges all available ad platform data into Ring 2 (paid audience).
 */

import { getDb } from '@/lib/db';
import type { DailyMetricRow, PlatformNormalizeResult } from './types';
import { getNormalizedGoogleAds } from './google-ads';
import { getNormalizedMetaAds } from './meta-ads';
import { getNormalizedLinkedInAds } from './linkedin-ads';
import { getNormalizedTikTokAds } from './tiktok-ads';
import { getNormalizedRedditAds } from './reddit-ads';
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
    getNormalizedRedditAds(days),
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

    // Derive CPA, CTR
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
