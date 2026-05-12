export interface OrganicPostMetrics {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'reddit';
  post_id: string;
  post_type: string;
  post_text: string | null;
  post_url: string | null;
  published_at: string;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagement_rate: number | null;
  source: 'pipeline' | 'manual';
  asset_id: string | null;
  request_id: string | null;
  matched_by: string | null;
  confidence: number;
}

export interface OrganicOverview {
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  total_clicks: number;
  follower_delta: number;
  post_count: number;
  avg_engagement_rate: number;
  per_platform: Record<string, {
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    follower_delta: number;
    post_count: number;
  }>;
}

export interface AccountSnapshot {
  platform: string;
  account_id: string;
  account_name: string | null;
  followers: number;
  follower_delta: number;
  total_reach: number;
  total_impressions: number;
  total_engagement: number;
  post_count: number;
  avg_engagement_rate: number;
  profile_views: number;
  date: string;
}

export interface GscRow {
  query: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export interface OrganicSyncResult {
  platform: string;
  success: boolean;
  posts_synced: number;
  account_snapshot: boolean;
  assets_matched: number;
  errors: number;
  duration_ms: number;
  message: string;
}

export interface OrganicConnectionStatus {
  platform: string;
  connected: boolean;
  has_data: boolean;
  last_sync_at: string | null;
  post_count: number;
}

export interface PaidOverview {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_cpa: number;
  avg_ctr: number;
  roas: number;
  per_platform: Record<string, {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpa: number;
  }>;
}
