// src/lib/types/projects.ts — Project Registry types

export interface Project {
  id: string;
  codename: string;
  display_name: string;
  wp_job_id: number | null;
  wp_slug: string | null;
  wp_published_at: string | null;
  intake_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  countries: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectAlias {
  id: string;
  project_id: string;
  alias: string;
  source: 'manual' | 'fuzzy_match' | 'utm_scan' | 'wp_scan';
  confidence: number;
  created_at: string;
}

export type ChannelCategory =
  | 'paid_social' | 'paid_search' | 'organic_social' | 'organic_search'
  | 'email' | 'job_board' | 'physical' | 'recruiter'
  | 'influencer' | 'referral' | 'direct' | 'other';

export interface ChannelDefinition {
  id: string;
  slug: string;
  display_name: string;
  category: ChannelCategory;
  icon: string | null;
  is_paid: boolean;
  created_at: string;
}

export interface UtmChannelRule {
  id: string;
  channel_id: string;
  utm_source_pattern: string | null;
  utm_medium_pattern: string | null;
  utm_campaign_pattern: string | null;
  priority: number;
  extract_label_regex: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectChannelLink {
  id: string;
  project_id: string;
  channel_id: string;
  external_id: string;
  external_name: string | null;
  extracted_label: string | null;
  match_method: 'manual' | 'fuzzy' | 'exact' | 'regex';
  confidence: number;
  confirmed_at: string | null;
  created_at: string;
  // Joined fields (from channel_definitions)
  channel_slug?: string;
  channel_name?: string;
  channel_category?: ChannelCategory;
}

export interface UnclassifiedUtm {
  id: string;
  project_id: string | null;
  raw_source: string | null;
  raw_medium: string | null;
  raw_campaign: string | null;
  normalized_name: string;
  hit_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved: boolean;
  resolved_to: string | null;
  resolved_at: string | null;
  // From the view
  source_display?: string;
  medium_display?: string;
  project?: string;
  suggested_channel?: string;
}

export interface ProjectFunnelRow {
  project_id: string;
  codename: string;
  date: string;
  platform: string;
  channel: string;
  metric_type: 'paid' | 'organic' | 'email';
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  signups: number;
  profile_completes: number;
  reach: number | null;
  engagement: number | null;
  cpa: number | null;
  ctr: number | null;
  roas: number | null;
}

export interface ProjectWeeklySummary {
  project_id: string;
  codename: string;
  week_start: string;
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_conversions: number;
  total_reach: number;
  total_engagement: number;
  paid_spend: number;
  paid_clicks: number;
  paid_conversions: number;
  organic_clicks: number;
  email_clicks: number;
  conversion_rate: number;
  blended_cpa: number | null;
  active_channels: number;
}

export interface AliasSuggestion {
  project_id: string;
  codename: string;
  discovered: string;
  source_table: string;
  similarity: number;
}

export interface ChannelLinkSuggestion {
  project_id: string;
  codename: string;
  channel_type: string;
  external_id: string;
  external_name: string;
  similarity: number;
}
