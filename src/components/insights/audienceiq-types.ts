/**
 * AudienceIQ types — CRM, funnel, drift, health.
 */

export interface CachedContributor {
  id: string;
  crm_user_id: string;
  email: string | null;
  country: string | null;
  languages: string[];
  skills: Record<string, unknown>;
  quality_score: number | null;
  activity_status: string;
  signup_date: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  last_synced_at: string;
}

export interface VisitorIdentity {
  id: string;
  visitor_id: string | null;
  ga4_client_id: string | null;
  crm_user_id: string | null;
  email: string | null;
  email_hash: string | null;
  utm_slug: string | null;
  first_seen_at: string;
  identified_at: string | null;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversion_rate: number | null;
}

export interface ContributorFunnel {
  request_id: string;
  stages: FunnelStage[];
  total_clicks: number;
  total_signups: number;
  total_active: number;
  total_quality: number;
  quality_threshold: number;
}

export interface QualityByChannel {
  utm_source: string;
  avg_quality: number;
  contributor_count: number;
  active_count: number;
  churned_count: number;
}

export interface RetentionPoint {
  day: number;
  retained_count: number;
  retained_pct: number;
}

export interface RetentionCurve {
  utm_campaign: string;
  points: RetentionPoint[];
  total_signups: number;
}

export interface SkillComparison {
  skill: string;
  declared_pct: number;
  actual_pct: number;
  delta: number;
}

export interface TargetingVsReality {
  declared: {
    regions: { name: string; pct: number }[];
    languages: { name: string; pct: number }[];
    skills: { name: string; pct: number }[];
  };
  actual: {
    regions: { name: string; pct: number }[];
    languages: { name: string; pct: number }[];
    skills: { name: string; pct: number }[];
  };
}

export interface CrmSyncStatus {
  connected: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
  cached_contributors: number;
  matched_identities: number;
}

export type DriftSeverity = 'low' | 'moderate' | 'high';

export interface DriftSnapshot {
  id: string;
  request_id: string;
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: DriftSeverity;
  segment_mismatch: boolean;
  evidence: Record<string, unknown>;
  recommendations: string[];
  computed_at: string;
}

export interface HealthIssue {
  type: string;
  message: string;
  recommended_action: string;
  severity: 'critical' | 'warning' | 'info';
  deduction: number;
}

export interface HealthScore {
  id: string;
  request_id: string;
  score: number;
  issues: HealthIssue[];
  computed_at: string;
}
