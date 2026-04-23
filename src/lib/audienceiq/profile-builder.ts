/**
 * Profile Builder — extracts audience profiles from each data ring.
 *
 * Ring 1 (declared): intake_requests form data
 * Ring 2 (paid): placeholder — requires ad platform APIs (Phase 5)
 * Ring 3 (organic): placeholder — requires GA4 integration (Phase 3)
 * Ring 4 (converted): crm_sync_cache contributor data
 */

import { getDb } from '@/lib/db';
import { upsertProfile, type AudienceProfileRow } from '@/lib/db/audienceiq';
import { isCrmConnected } from '@/lib/crm/client';

type ProfileData = Omit<AudienceProfileRow, 'id' | 'captured_at'>;

export async function buildDeclaredProfile(requestId: string): Promise<ProfileData> {
  const sql = getDb();
  const rows = await sql`
    SELECT target_regions, target_languages, qualifications_required, qualifications_preferred,
           location_scope, engagement_model, form_data
    FROM intake_requests WHERE id = ${requestId}
  `;

  const req = rows[0] as Record<string, unknown> | undefined;
  if (!req) {
    return {
      request_id: requestId,
      ring: 'declared',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'intake_form',
    };
  }

  const skills: Record<string, unknown> = {};
  if (req.qualifications_required) skills.required = req.qualifications_required;
  if (req.qualifications_preferred) skills.preferred = req.qualifications_preferred;

  const demographics: Record<string, unknown> = {};
  if (req.location_scope) demographics.location_scope = req.location_scope;
  if (req.engagement_model) demographics.engagement_model = req.engagement_model;

  return {
    request_id: requestId,
    ring: 'declared',
    demographics,
    skills,
    languages: (req.target_languages as string[]) ?? [],
    regions: (req.target_regions as string[]) ?? [],
    sample_size: 1,
    confidence: 'high',
    source: 'intake_form',
  };
}

export async function buildConvertedProfile(requestId: string): Promise<ProfileData> {
  if (!isCrmConnected()) {
    return {
      request_id: requestId,
      ring: 'converted',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'crm_unavailable',
    };
  }

  const sql = getDb();

  // Find campaigns linked to this request
  const campaignRows = await sql`
    SELECT DISTINCT utm_campaign FROM tracked_links WHERE request_id = ${requestId}
  `;
  const campaigns = campaignRows.map((r: Record<string, unknown>) => (r as { utm_campaign: string }).utm_campaign);

  if (campaigns.length === 0) {
    return {
      request_id: requestId,
      ring: 'converted',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'crm',
    };
  }

  // Aggregate CRM data for these campaigns
  const contributors = await sql`
    SELECT country, languages, skills, quality_score, activity_status
    FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns})
  `;

  const regionCounts: Record<string, number> = {};
  const langCounts: Record<string, number> = {};
  const skillCounts: Record<string, number> = {};
  let totalQuality = 0;
  let qualityCount = 0;
  let activeCount = 0;

  for (const row of contributors) {
    const c = row as { country: string | null; languages: string[]; skills: Record<string, unknown>; quality_score: number | null; activity_status: string };
    if (c.country) regionCounts[c.country] = (regionCounts[c.country] ?? 0) + 1;
    for (const lang of c.languages ?? []) langCounts[lang] = (langCounts[lang] ?? 0) + 1;
    if (c.skills && typeof c.skills === 'object') {
      for (const skill of Object.keys(c.skills)) skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
    }
    if (c.quality_score != null) { totalQuality += c.quality_score; qualityCount++; }
    if (c.activity_status === 'active') activeCount++;
  }

  const sampleSize = contributors.length;
  const confidence = sampleSize >= 50 ? 'high' : sampleSize >= 10 ? 'medium' : 'low';

  return {
    request_id: requestId,
    ring: 'converted',
    demographics: {
      geo_distribution: regionCounts,
      avg_quality_score: qualityCount > 0 ? Math.round((totalQuality / qualityCount) * 10) / 10 : null,
      active_pct: sampleSize > 0 ? Math.round((activeCount / sampleSize) * 100) : 0,
    },
    skills: skillCounts,
    languages: Object.entries(langCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k),
    regions: Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k),
    sample_size: sampleSize,
    confidence,
    source: 'crm',
  };
}

export async function buildPaidProfile(requestId: string): Promise<ProfileData> {
  // Phase 5: will pull from ad platform APIs
  return {
    request_id: requestId,
    ring: 'paid',
    demographics: {},
    skills: {},
    languages: [],
    regions: [],
    sample_size: 0,
    confidence: 'low',
    source: 'unavailable',
  };
}

export async function buildOrganicProfile(requestId: string): Promise<ProfileData> {
  // Phase 3: will pull from GA4 session data
  return {
    request_id: requestId,
    ring: 'organic',
    demographics: {},
    skills: {},
    languages: [],
    regions: [],
    sample_size: 0,
    confidence: 'low',
    source: 'unavailable',
  };
}

export async function buildAndStoreAllProfiles(requestId: string): Promise<ProfileData[]> {
  const profiles = await Promise.all([
    buildDeclaredProfile(requestId),
    buildPaidProfile(requestId),
    buildOrganicProfile(requestId),
    buildConvertedProfile(requestId),
  ]);

  for (const profile of profiles) {
    await upsertProfile(profile);
  }

  return profiles;
}
