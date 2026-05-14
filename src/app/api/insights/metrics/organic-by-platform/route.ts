import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);

  const rows = await sql`
    SELECT
      date,
      platform,
      metric_type,
      COALESCE(SUM(impressions), 0)::bigint AS impressions,
      COALESCE(SUM(reach), 0)::bigint AS reach,
      COALESCE(SUM(engagement), 0)::bigint AS engagement,
      COALESCE(SUM(clicks), 0)::bigint AS clicks,
      COALESCE(SUM(post_count), 0)::int AS post_count
    FROM channel_performance_unified
    WHERE metric_type = 'organic'
      AND date >= CURRENT_DATE - make_interval(days => ${days})
    GROUP BY date, platform, metric_type
    ORDER BY date ASC, platform ASC
  `;

  return NextResponse.json({ days, rows });
}
