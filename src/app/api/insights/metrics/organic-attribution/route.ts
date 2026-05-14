import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);

  const attribution = await sql`
    SELECT
      COALESCE(a.source_label, 'unattributed')          AS source,
      COUNT(p.post_id)::int                             AS post_count,
      AVG(p.engagement)                                 AS avg_engagement,
      AVG(p.reach)                                      AS avg_reach,
      AVG(p.impressions)                                AS avg_impressions,
      AVG(
        CASE WHEN p.impressions > 0
             THEN p.engagement::float / p.impressions
             ELSE 0 END
      )                                                 AS avg_engagement_rate
    FROM (
      SELECT
        post_id,
        platform,
        COALESCE(impressions, 0)::bigint  AS impressions,
        COALESCE(reach, 0)::bigint        AS reach,
        COALESCE(engagement, 0)::bigint   AS engagement
      FROM meta_organic_cache
      WHERE date >= CURRENT_DATE - make_interval(days => ${days})

      UNION ALL

      SELECT
        post_id,
        'linkedin'                              AS platform,
        COALESCE(impressions, 0)::bigint        AS impressions,
        COALESCE(unique_impressions, 0)::bigint AS reach,
        COALESCE(engagement, 0)::bigint         AS engagement
      FROM linkedin_organic_cache
      WHERE date >= CURRENT_DATE - make_interval(days => ${days})

      UNION ALL

      SELECT
        post_id,
        'reddit'                                                       AS platform,
        COALESCE(impressions, 0)::bigint                               AS impressions,
        0::bigint                                                      AS reach,
        (COALESCE(upvotes, 0) + COALESCE(comments, 0))::bigint        AS engagement
      FROM reddit_organic_cache
      WHERE date >= CURRENT_DATE - make_interval(days => ${days})
    ) p
    LEFT JOIN organic_post_assets a ON a.post_id = p.post_id AND a.platform = p.platform
    GROUP BY source
    ORDER BY post_count DESC
  `;

  return NextResponse.json({ days, attribution });
}
