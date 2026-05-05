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
