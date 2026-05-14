import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);

  const rows = await sql`
    SELECT
      platform,
      COALESCE(SUM(spend), 0) AS total_spend,
      COALESCE(SUM(impressions), 0)::int AS total_impressions,
      COALESCE(SUM(clicks), 0)::int AS total_clicks,
      COALESCE(SUM(conversions), 0)::int AS total_conversions
    FROM normalized_daily_metrics
    WHERE date >= CURRENT_DATE - make_interval(days => ${days})
    GROUP BY platform
    ORDER BY total_spend DESC
  `;

  const total_spend = rows.reduce((s: number, r: any) => s + Number(r.total_spend ?? 0), 0);
  const total_impressions = rows.reduce((s: number, r: any) => s + Number(r.total_impressions ?? 0), 0);
  const total_clicks = rows.reduce((s: number, r: any) => s + Number(r.total_clicks ?? 0), 0);
  const total_conversions = rows.reduce((s: number, r: any) => s + Number(r.total_conversions ?? 0), 0);

  const per_platform: Record<string, any> = {};
  for (const row of rows as any[]) {
    per_platform[row.platform] = {
      spend: Number(row.total_spend), impressions: Number(row.total_impressions),
      clicks: Number(row.total_clicks), conversions: Number(row.total_conversions),
      cpa: Number(row.total_conversions) > 0 ? Number(row.total_spend) / Number(row.total_conversions) : 0,
    };
  }

  return NextResponse.json({
    total_spend, total_impressions, total_clicks, total_conversions,
    avg_cpa: total_conversions > 0 ? total_spend / total_conversions : 0,
    avg_ctr: total_impressions > 0 ? total_clicks / total_impressions : 0,
    roas: 0,
    per_platform,
    // Aliases for widget compatibility
    spend: total_spend, impressions: total_impressions, clicks: total_clicks,
    conversions: total_conversions, cpa: total_conversions > 0 ? total_spend / total_conversions : 0,
    ctr: total_impressions > 0 ? (total_clicks / total_impressions * 100) : 0,
  });
}
