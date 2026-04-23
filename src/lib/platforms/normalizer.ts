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
