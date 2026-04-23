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
