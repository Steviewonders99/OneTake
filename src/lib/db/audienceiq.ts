import { getDb } from '@/lib/db';
import type { CachedContributor, VisitorIdentity, CrmSyncStatus } from '@/components/insights/audienceiq-types';

// ── CRM Sync Cache ─────────────────────────────────────────────────────────

export async function upsertContributor(c: Omit<CachedContributor, 'id' | 'last_synced_at'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO crm_sync_cache (crm_user_id, email, country, languages, skills, quality_score, activity_status, signup_date, utm_source, utm_medium, utm_campaign)
    VALUES (${c.crm_user_id}, ${c.email}, ${c.country}, ${c.languages}, ${JSON.stringify(c.skills)}, ${c.quality_score}, ${c.activity_status}, ${c.signup_date}, ${c.utm_source}, ${c.utm_medium}, ${c.utm_campaign})
    ON CONFLICT (crm_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      country = EXCLUDED.country,
      languages = EXCLUDED.languages,
      skills = EXCLUDED.skills,
      quality_score = EXCLUDED.quality_score,
      activity_status = EXCLUDED.activity_status,
      signup_date = EXCLUDED.signup_date,
      utm_source = EXCLUDED.utm_source,
      utm_medium = EXCLUDED.utm_medium,
      utm_campaign = EXCLUDED.utm_campaign,
      last_synced_at = NOW()
  `;
}

export async function getCrmSyncStatus(): Promise<CrmSyncStatus> {
  const sql = getDb();
  const countRow = await sql`SELECT COUNT(*)::int as count FROM crm_sync_cache`;
  const lastSync = await sql`SELECT MAX(last_synced_at) as last_sync FROM crm_sync_cache`;
  const identityCount = await sql`SELECT COUNT(*)::int as count FROM visitor_identities WHERE crm_user_id IS NOT NULL`;

  const { isCrmConnected, isCrmSyncEnabled } = await import('@/lib/crm/client');

  return {
    connected: isCrmConnected(),
    sync_enabled: isCrmSyncEnabled(),
    last_sync_at: lastSync[0]?.last_sync ?? null,
    cached_contributors: countRow[0]?.count ?? 0,
    matched_identities: identityCount[0]?.count ?? 0,
  };
}

export async function getContributorsByCampaign(utmCampaign: string): Promise<CachedContributor[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM crm_sync_cache WHERE utm_campaign = ${utmCampaign} ORDER BY quality_score DESC NULLS LAST
  `;
  return rows as CachedContributor[];
}

export async function getContributorsBySource(utmSource: string): Promise<CachedContributor[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM crm_sync_cache WHERE utm_source = ${utmSource} ORDER BY quality_score DESC NULLS LAST
  `;
  return rows as CachedContributor[];
}

// ── Identity Stitching ─────────────────────────────────────────────────────

export async function upsertIdentity(identity: Partial<VisitorIdentity> & { email_hash: string }): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO visitor_identities (visitor_id, ga4_client_id, crm_user_id, email, email_hash, utm_slug)
    VALUES (${identity.visitor_id ?? null}, ${identity.ga4_client_id ?? null}, ${identity.crm_user_id ?? null}, ${identity.email ?? null}, ${identity.email_hash}, ${identity.utm_slug ?? null})
    ON CONFLICT (email_hash) DO UPDATE SET
      visitor_id = COALESCE(EXCLUDED.visitor_id, visitor_identities.visitor_id),
      ga4_client_id = COALESCE(EXCLUDED.ga4_client_id, visitor_identities.ga4_client_id),
      crm_user_id = COALESCE(EXCLUDED.crm_user_id, visitor_identities.crm_user_id),
      email = COALESCE(EXCLUDED.email, visitor_identities.email),
      utm_slug = COALESCE(EXCLUDED.utm_slug, visitor_identities.utm_slug),
      identified_at = CASE WHEN EXCLUDED.crm_user_id IS NOT NULL THEN NOW() ELSE visitor_identities.identified_at END
  `;
}

export async function resolveIdentityBySlug(slug: string): Promise<VisitorIdentity | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM visitor_identities WHERE utm_slug = ${slug} LIMIT 1`;
  return (rows[0] as VisitorIdentity) ?? null;
}

// ── Funnel Queries ─────────────────────────────────────────────────────────

export async function getContributorFunnel(requestId: string, qualityThreshold: number = 70): Promise<{
  total_clicks: number;
  total_signups: number;
  total_active: number;
  total_quality: number;
}> {
  const sql = getDb();

  const clicksRow = await sql`
    SELECT COALESCE(SUM(click_count), 0)::int as total FROM tracked_links WHERE request_id = ${requestId}
  `;

  const campaignRows = await sql`
    SELECT DISTINCT utm_campaign FROM tracked_links WHERE request_id = ${requestId}
  `;
  const campaigns = campaignRows.map((r: Record<string, unknown>) => (r as { utm_campaign: string }).utm_campaign);

  if (campaigns.length === 0) {
    return { total_clicks: clicksRow[0]?.total ?? 0, total_signups: 0, total_active: 0, total_quality: 0 };
  }

  const signupsRow = await sql`
    SELECT COUNT(*)::int as total FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns})
  `;

  const activeRow = await sql`
    SELECT COUNT(*)::int as total FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns}) AND activity_status = 'active'
  `;

  const qualityRow = await sql`
    SELECT COUNT(*)::int as total FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns}) AND activity_status = 'active' AND quality_score >= ${qualityThreshold}
  `;

  return {
    total_clicks: clicksRow[0]?.total ?? 0,
    total_signups: signupsRow[0]?.total ?? 0,
    total_active: activeRow[0]?.total ?? 0,
    total_quality: qualityRow[0]?.total ?? 0,
  };
}

export async function getQualityByChannel(): Promise<{
  utm_source: string;
  avg_quality: number;
  contributor_count: number;
  active_count: number;
  churned_count: number;
}[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      utm_source,
      ROUND(AVG(quality_score)::numeric, 1)::float as avg_quality,
      COUNT(*)::int as contributor_count,
      COUNT(*) FILTER (WHERE activity_status = 'active')::int as active_count,
      COUNT(*) FILTER (WHERE activity_status = 'churned')::int as churned_count
    FROM crm_sync_cache
    WHERE utm_source IS NOT NULL AND quality_score IS NOT NULL
    GROUP BY utm_source
    ORDER BY avg_quality DESC
  `;
  return rows as { utm_source: string; avg_quality: number; contributor_count: number; active_count: number; churned_count: number }[];
}

export async function getTargetingVsReality(requestId: string): Promise<{
  declared_regions: { name: string; count: number }[];
  declared_languages: { name: string; count: number }[];
  actual_regions: { name: string; count: number }[];
  actual_languages: { name: string; count: number }[];
  actual_skills: { skill: string; count: number }[];
}> {
  const sql = getDb();

  const declaredRegions = await sql`
    SELECT unnest(target_regions) as name, COUNT(*)::int as count
    FROM intake_requests WHERE id = ${requestId}
    GROUP BY name ORDER BY count DESC
  `;

  const declaredLanguages = await sql`
    SELECT unnest(target_languages) as name, COUNT(*)::int as count
    FROM intake_requests WHERE id = ${requestId}
    GROUP BY name ORDER BY count DESC
  `;

  const campaignRows = await sql`
    SELECT DISTINCT utm_campaign FROM tracked_links WHERE request_id = ${requestId}
  `;
  const campaigns = campaignRows.map((r: Record<string, unknown>) => (r as { utm_campaign: string }).utm_campaign);

  let actualRegions: { name: string; count: number }[] = [];
  let actualLanguages: { name: string; count: number }[] = [];
  let actualSkills: { skill: string; count: number }[] = [];

  if (campaigns.length > 0) {
    actualRegions = await sql`
      SELECT country as name, COUNT(*)::int as count
      FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns}) AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC
    ` as { name: string; count: number }[];

    actualLanguages = await sql`
      SELECT unnest(languages) as name, COUNT(*)::int as count
      FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns})
      GROUP BY name ORDER BY count DESC
    ` as { name: string; count: number }[];

    actualSkills = await sql`
      SELECT key as skill, COUNT(*)::int as count
      FROM crm_sync_cache, jsonb_object_keys(skills) as key
      WHERE utm_campaign = ANY(${campaigns})
      GROUP BY key ORDER BY count DESC LIMIT 15
    ` as { skill: string; count: number }[];
  }

  return {
    declared_regions: declaredRegions as { name: string; count: number }[],
    declared_languages: declaredLanguages as { name: string; count: number }[],
    actual_regions: actualRegions,
    actual_languages: actualLanguages,
    actual_skills: actualSkills,
  };
}

// ── Audience Profiles ──────────────────────────────────────────────────────

export interface AudienceProfileRow {
  id: string;
  request_id: string;
  ring: string;
  demographics: Record<string, unknown>;
  skills: Record<string, unknown>;
  languages: string[];
  regions: string[];
  sample_size: number;
  confidence: string;
  source: string;
  captured_at: string;
}

export async function upsertProfile(profile: Omit<AudienceProfileRow, 'id' | 'captured_at'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO audience_profiles (request_id, ring, demographics, skills, languages, regions, sample_size, confidence, source)
    VALUES (${profile.request_id}, ${profile.ring}, ${JSON.stringify(profile.demographics)}, ${JSON.stringify(profile.skills)}, ${profile.languages}, ${profile.regions}, ${profile.sample_size}, ${profile.confidence}, ${profile.source})
    ON CONFLICT (request_id, ring) DO UPDATE SET
      demographics = EXCLUDED.demographics,
      skills = EXCLUDED.skills,
      languages = EXCLUDED.languages,
      regions = EXCLUDED.regions,
      sample_size = EXCLUDED.sample_size,
      confidence = EXCLUDED.confidence,
      source = EXCLUDED.source,
      captured_at = NOW()
  `;
}

export async function getProfiles(requestId: string): Promise<AudienceProfileRow[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM audience_profiles WHERE request_id = ${requestId} ORDER BY ring`;
  return rows as AudienceProfileRow[];
}

// ── Drift Snapshots ────────────────────────────────────────────────────────

export async function insertDriftSnapshot(snapshot: {
  request_id: string;
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: string;
  segment_mismatch: boolean;
  evidence: Record<string, unknown>;
  recommendations: string[];
}): Promise<{ id: string }> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO audience_drift_snapshots (request_id, declared_vs_paid, declared_vs_organic, paid_vs_converted, organic_vs_converted, overall_drift, severity, segment_mismatch, evidence, recommendations)
    VALUES (${snapshot.request_id}, ${snapshot.declared_vs_paid}, ${snapshot.declared_vs_organic}, ${snapshot.paid_vs_converted}, ${snapshot.organic_vs_converted}, ${snapshot.overall_drift}, ${snapshot.severity}, ${snapshot.segment_mismatch}, ${JSON.stringify(snapshot.evidence)}, ${snapshot.recommendations})
    RETURNING id
  `;
  return { id: (rows[0] as { id: string }).id };
}

export async function getLatestDrift(requestId: string): Promise<Record<string, unknown> | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM audience_drift_snapshots WHERE request_id = ${requestId} ORDER BY computed_at DESC LIMIT 1
  `;
  return (rows[0] as Record<string, unknown>) ?? null;
}

// ── Health Scores ──────────────────────────────────────────────────────────

export async function insertHealthScore(score: {
  request_id: string;
  score: number;
  issues: { type: string; message: string; recommended_action: string; severity: string; deduction: number }[];
}): Promise<{ id: string }> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO audience_health_scores (request_id, score, issues)
    VALUES (${score.request_id}, ${score.score}, ${JSON.stringify(score.issues)})
    RETURNING id
  `;
  return { id: (rows[0] as { id: string }).id };
}

export async function getLatestHealth(requestId: string): Promise<Record<string, unknown> | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM audience_health_scores WHERE request_id = ${requestId} ORDER BY computed_at DESC LIMIT 1
  `;
  return (rows[0] as Record<string, unknown>) ?? null;
}
