import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const VALID_SORT_COLS = ['engagement', 'impressions', 'reach', 'clicks', 'post_date'] as const;
type SortCol = typeof VALID_SORT_COLS[number];

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();

  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const platform = req.nextUrl.searchParams.get('platform') || null;
  const source = req.nextUrl.searchParams.get('source') || null;
  const rawSort = req.nextUrl.searchParams.get('sort') || 'engagement';
  const sort: SortCol = VALID_SORT_COLS.includes(rawSort as SortCol) ? (rawSort as SortCol) : 'engagement';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  // Build UNION of all platform caches with common shape
  // LEFT JOIN organic_post_assets for attribution source
  const rows = await sql`
    SELECT
      p.post_id,
      p.platform,
      p.post_date,
      p.impressions,
      p.reach,
      p.engagement,
      p.clicks,
      p.engagement_rate,
      p.post_url,
      p.caption,
      a.source_label AS attribution_source,
      a.request_id   AS attribution_request_id
    FROM (
      SELECT
        post_id,
        platform,
        post_date,
        COALESCE(impressions, 0)::bigint    AS impressions,
        COALESCE(reach, 0)::bigint          AS reach,
        COALESCE(engagement, 0)::bigint     AS engagement,
        COALESCE(clicks, 0)::bigint         AS clicks,
        COALESCE(engagement_rate, 0)        AS engagement_rate,
        post_url,
        caption
      FROM meta_organic_cache
      WHERE post_date >= CURRENT_DATE - ${days}::int
        AND (${platform}::text IS NULL OR platform = ${platform})

      UNION ALL

      SELECT
        post_id,
        'linkedin'                                    AS platform,
        post_date,
        COALESCE(impressions, 0)::bigint              AS impressions,
        COALESCE(unique_impressions, 0)::bigint       AS reach,
        COALESCE(engagement, 0)::bigint               AS engagement,
        COALESCE(clicks, 0)::bigint                   AS clicks,
        COALESCE(engagement_rate, 0)                  AS engagement_rate,
        post_url,
        caption
      FROM linkedin_organic_cache
      WHERE post_date >= CURRENT_DATE - ${days}::int
        AND (${platform}::text IS NULL OR ${platform} = 'linkedin')

      UNION ALL

      SELECT
        post_id,
        'reddit'                                      AS platform,
        post_date,
        COALESCE(impressions, 0)::bigint              AS impressions,
        0::bigint                                     AS reach,
        (COALESCE(upvotes, 0) + COALESCE(comments, 0))::bigint AS engagement,
        COALESCE(clicks, 0)::bigint                   AS clicks,
        CASE WHEN COALESCE(impressions, 0) > 0
             THEN (COALESCE(upvotes, 0) + COALESCE(comments, 0))::float / impressions
             ELSE 0 END                               AS engagement_rate,
        post_url,
        title                                         AS caption
      FROM reddit_organic_cache
      WHERE post_date >= CURRENT_DATE - ${days}::int
        AND (${platform}::text IS NULL OR ${platform} = 'reddit')
    ) p
    LEFT JOIN organic_post_assets a ON a.post_id = p.post_id AND a.platform = p.platform
    WHERE (${source}::text IS NULL OR a.source_label = ${source})
    ORDER BY
      CASE WHEN ${sort} = 'engagement'   THEN p.engagement   END DESC NULLS LAST,
      CASE WHEN ${sort} = 'impressions'  THEN p.impressions  END DESC NULLS LAST,
      CASE WHEN ${sort} = 'reach'        THEN p.reach        END DESC NULLS LAST,
      CASE WHEN ${sort} = 'clicks'       THEN p.clicks       END DESC NULLS LAST,
      CASE WHEN ${sort} = 'post_date'    THEN EXTRACT(EPOCH FROM p.post_date) END DESC NULLS LAST
    LIMIT ${limit}
  `;

  return NextResponse.json({ posts: rows });
}
