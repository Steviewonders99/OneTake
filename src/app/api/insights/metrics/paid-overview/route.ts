import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const rows = await sql`
    SELECT
      platform,
      COALESCE(SUM(spend), 0)                     AS total_spend,
      COALESCE(SUM(impressions), 0)::bigint        AS total_impressions,
      COALESCE(SUM(clicks), 0)::bigint             AS total_clicks,
      COALESCE(SUM(conversions), 0)                AS total_conversions,
      CASE WHEN SUM(conversions) > 0
           THEN SUM(spend) / SUM(conversions)
           ELSE NULL END                           AS avg_cpa,
      CASE WHEN SUM(impressions) > 0
           THEN SUM(clicks)::float / SUM(impressions)
           ELSE NULL END                           AS avg_ctr,
      CASE WHEN SUM(spend) > 0
           THEN SUM(revenue) / SUM(spend)
           ELSE NULL END                           AS roas
    FROM normalized_daily_metrics
    WHERE date >= CURRENT_DATE - ${days}::int
    GROUP BY platform
    ORDER BY total_spend DESC
  `;

  const total_spend = rows.reduce((s, r) => s + Number(r.total_spend ?? 0), 0);
  const total_impressions = rows.reduce((s, r) => s + Number(r.total_impressions ?? 0), 0);
  const total_clicks = rows.reduce((s, r) => s + Number(r.total_clicks ?? 0), 0);
  const total_conversions = rows.reduce((s, r) => s + Number(r.total_conversions ?? 0), 0);

  const avg_cpa = total_conversions > 0 ? total_spend / total_conversions : null;
  const avg_ctr = total_impressions > 0 ? total_clicks / total_impressions : null;

  const total_revenue = rows.reduce((s, r) => {
    // Re-derive revenue from roas * spend per platform
    const spend = Number(r.total_spend ?? 0);
    const roas = r.roas != null ? Number(r.roas) : null;
    return s + (roas != null ? spend * roas : 0);
  }, 0);
  const roas = total_spend > 0 ? total_revenue / total_spend : null;

  return NextResponse.json({
    days,
    total_spend,
    total_impressions,
    total_clicks,
    total_conversions,
    avg_cpa,
    avg_ctr,
    roas,
    platforms: rows,
  });
}
