import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '28') || 28);
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  // Check if we have any GSC data at all
  const [countRows] = await sql`
    SELECT COUNT(*)::int AS total FROM gsc_daily_cache
    WHERE date >= CURRENT_DATE - ${days}::int
  `;

  const hasData = (countRows?.total ?? 0) > 0;

  if (!hasData) {
    return NextResponse.json({
      connected: false,
      days,
      top_queries: [],
      top_pages: [],
      daily_trend: [],
    });
  }

  const [top_queries, top_pages, daily_trend] = await Promise.all([
    sql`
      SELECT
        query,
        SUM(clicks)::int        AS clicks,
        SUM(impressions)::int   AS impressions,
        AVG(position)           AS avg_position,
        AVG(ctr)                AS avg_ctr
      FROM gsc_daily_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY query
      ORDER BY clicks DESC
      LIMIT ${limit}
    `,
    sql`
      SELECT
        page,
        SUM(clicks)::int        AS clicks,
        SUM(impressions)::int   AS impressions,
        AVG(position)           AS avg_position,
        AVG(ctr)                AS avg_ctr
      FROM gsc_daily_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY page
      ORDER BY clicks DESC
      LIMIT ${limit}
    `,
    sql`
      SELECT
        date,
        SUM(clicks)::int        AS clicks,
        SUM(impressions)::int   AS impressions,
        AVG(position)           AS avg_position,
        AVG(ctr)                AS avg_ctr
      FROM gsc_daily_cache
      WHERE date >= CURRENT_DATE - ${days}::int
      GROUP BY date
      ORDER BY date ASC
    `,
  ]);

  return NextResponse.json({ connected: true, days, top_queries, top_pages, daily_trend });
}
