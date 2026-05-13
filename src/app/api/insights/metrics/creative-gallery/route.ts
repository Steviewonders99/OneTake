import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Creative Gallery API — reads from ad_creatives_cache (populated by worker backfill).
 *
 * The backfill_creatives.py worker script pulls Meta ad creatives + images,
 * enriches with GA4 per-creative funnel data (via utm_content first-touch attribution),
 * and stores everything in ad_creatives_cache. This route just reads.
 *
 * Query params:
 *   ?days=30          — matches date_range_start (default 30)
 *   ?campaign=humus   — filter by campaign name (exact, case-insensitive)
 *   ?sort=conversions — sort key: conversions | ctr | clicks | spend | funnel_cvr
 *   ?limit=20         — max results (capped at 50)
 */
export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);
  const campaign = req.nextUrl.searchParams.get('campaign') || '';
  const sort = req.nextUrl.searchParams.get('sort') || 'conversions';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20') || 20, 50);

  // Valid sort columns (prevent injection)
  const sortMap: Record<string, string> = {
    conversions: 'conversions',
    ctr: 'ctr',
    clicks: 'clicks',
    spend: 'spend',
    funnel_cvr: 'funnel_cvr',
    funnel_completions: 'funnel_completions',
  };
  const sortCol = sortMap[sort] || 'conversions';

  // Query the cache — all data is pre-populated by the worker
  let creatives: any[];

  if (campaign) {
    creatives = await sql`
      SELECT *
      FROM ad_creatives_cache
      WHERE LOWER(campaign_name) = ${campaign.toLowerCase()}
      ORDER BY
        CASE WHEN ${sortCol} = 'ctr' THEN ctr
             WHEN ${sortCol} = 'clicks' THEN clicks
             WHEN ${sortCol} = 'spend' THEN spend
             WHEN ${sortCol} = 'funnel_cvr' THEN funnel_cvr
             WHEN ${sortCol} = 'funnel_completions' THEN funnel_completions
             ELSE conversions END DESC
      LIMIT ${limit}
    `;
  } else {
    creatives = await sql`
      SELECT *
      FROM ad_creatives_cache
      ORDER BY
        CASE WHEN ${sortCol} = 'ctr' THEN ctr
             WHEN ${sortCol} = 'clicks' THEN clicks
             WHEN ${sortCol} = 'spend' THEN spend
             WHEN ${sortCol} = 'funnel_cvr' THEN funnel_cvr
             WHEN ${sortCol} = 'funnel_completions' THEN funnel_completions
             ELSE conversions END DESC
      LIMIT ${limit}
    `;
  }

  // Available campaigns for dropdown
  const available_campaigns = await sql`
    SELECT DISTINCT campaign_name, SUM(conversions)::int AS total_conversions
    FROM ad_creatives_cache
    WHERE campaign_name IS NOT NULL AND campaign_name != ''
    GROUP BY campaign_name
    ORDER BY total_conversions DESC
    LIMIT 20
  `.catch(() => []);

  return NextResponse.json({
    creatives,
    total: creatives.length,
    available_campaigns,
  });
}
