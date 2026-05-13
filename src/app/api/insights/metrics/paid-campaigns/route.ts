import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Safe allowlist of platform → table mappings (never user-interpolated)
const PLATFORM_TABLE_MAP: Record<string, string> = {
  meta_ads: 'meta_ads_cache',
  reddit_ads: 'reddit_ads_cache',
  linkedin_ads: 'linkedin_ads_cache',
  google_ads: 'google_ads_cache',
};

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();

  const rawPlatform = req.nextUrl.searchParams.get('platform') || 'meta_ads';
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  // Validate platform against allowlist
  if (!PLATFORM_TABLE_MAP[rawPlatform]) {
    return NextResponse.json(
      { error: `Unsupported platform: ${rawPlatform}. Allowed: ${Object.keys(PLATFORM_TABLE_MAP).join(', ')}` },
      { status: 400 }
    );
  }

  // Use safe if/else chain — never interpolate table name via tagged template
  let campaigns;

  if (rawPlatform === 'meta_ads') {
    campaigns = await sql`
      SELECT
        campaign_id,
        campaign_name,
        COALESCE(SUM(spend), 0)                AS spend,
        COALESCE(SUM(impressions), 0)::bigint  AS impressions,
        COALESCE(SUM(clicks), 0)::bigint       AS clicks,
        COALESCE(SUM(conversions), 0)          AS conversions,
        COALESCE(SUM(revenue), 0)              AS revenue,
        CASE WHEN SUM(impressions) > 0
             THEN SUM(clicks)::float / SUM(impressions)
             ELSE NULL END                     AS ctr,
        CASE WHEN SUM(conversions) > 0
             THEN SUM(spend) / SUM(conversions)
             ELSE NULL END                     AS cpa,
        MIN(date)                              AS first_date,
        MAX(date)                              AS last_date
      FROM meta_ads_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
      LIMIT ${limit}
    `;
  } else if (rawPlatform === 'reddit_ads') {
    campaigns = await sql`
      SELECT
        campaign_id,
        campaign_name,
        COALESCE(SUM(spend), 0)                AS spend,
        COALESCE(SUM(impressions), 0)::bigint  AS impressions,
        COALESCE(SUM(clicks), 0)::bigint       AS clicks,
        COALESCE(SUM(conversions), 0)          AS conversions,
        COALESCE(SUM(revenue), 0)              AS revenue,
        CASE WHEN SUM(impressions) > 0
             THEN SUM(clicks)::float / SUM(impressions)
             ELSE NULL END                     AS ctr,
        CASE WHEN SUM(conversions) > 0
             THEN SUM(spend) / SUM(conversions)
             ELSE NULL END                     AS cpa,
        MIN(date)                              AS first_date,
        MAX(date)                              AS last_date
      FROM reddit_ads_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
      LIMIT ${limit}
    `;
  } else if (rawPlatform === 'linkedin_ads') {
    campaigns = await sql`
      SELECT
        campaign_id,
        campaign_name,
        COALESCE(SUM(spend), 0)                AS spend,
        COALESCE(SUM(impressions), 0)::bigint  AS impressions,
        COALESCE(SUM(clicks), 0)::bigint       AS clicks,
        COALESCE(SUM(conversions), 0)          AS conversions,
        COALESCE(SUM(revenue), 0)              AS revenue,
        CASE WHEN SUM(impressions) > 0
             THEN SUM(clicks)::float / SUM(impressions)
             ELSE NULL END                     AS ctr,
        CASE WHEN SUM(conversions) > 0
             THEN SUM(spend) / SUM(conversions)
             ELSE NULL END                     AS cpa,
        MIN(date)                              AS first_date,
        MAX(date)                              AS last_date
      FROM linkedin_ads_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
      LIMIT ${limit}
    `;
  } else {
    // google_ads
    campaigns = await sql`
      SELECT
        campaign_id,
        campaign_name,
        COALESCE(SUM(spend), 0)                AS spend,
        COALESCE(SUM(impressions), 0)::bigint  AS impressions,
        COALESCE(SUM(clicks), 0)::bigint       AS clicks,
        COALESCE(SUM(conversions), 0)          AS conversions,
        COALESCE(SUM(revenue), 0)              AS revenue,
        CASE WHEN SUM(impressions) > 0
             THEN SUM(clicks)::float / SUM(impressions)
             ELSE NULL END                     AS ctr,
        CASE WHEN SUM(conversions) > 0
             THEN SUM(spend) / SUM(conversions)
             ELSE NULL END                     AS cpa,
        MIN(date)                              AS first_date,
        MAX(date)                              AS last_date
      FROM google_ads_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
      LIMIT ${limit}
    `;
  }

  return NextResponse.json({ platform: rawPlatform, days, campaigns });
}
