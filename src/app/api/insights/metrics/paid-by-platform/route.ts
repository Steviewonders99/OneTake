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
      channel,
      COALESCE(SUM(spend), 0)                AS spend,
      COALESCE(SUM(impressions), 0)::bigint  AS impressions,
      COALESCE(SUM(clicks), 0)::bigint       AS clicks,
      COALESCE(SUM(conversions), 0)          AS conversions,
      COALESCE(SUM(revenue), 0)              AS revenue
    FROM normalized_daily_metrics
    WHERE date >= CURRENT_DATE - make_interval(days => ${days})
    GROUP BY date, platform, channel
    ORDER BY date ASC, platform ASC, channel ASC
  `;

  return NextResponse.json({ days, rows });
}
