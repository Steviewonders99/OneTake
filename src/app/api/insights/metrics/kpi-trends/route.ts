import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);
  const half = Math.floor(days / 2);

  const [paidDaily, organicDaily, paidCurr, paidPrev, orgCurr, orgPrev] = await Promise.all([
    sql`SELECT date::text, COALESCE(SUM(spend),0)::float as spend, COALESCE(SUM(impressions),0)::int as impressions,
        COALESCE(SUM(clicks),0)::int as clicks, COALESCE(SUM(conversions),0)::int as conversions
        FROM normalized_daily_metrics WHERE date >= CURRENT_DATE - make_interval(days => ${days}) GROUP BY date ORDER BY date`,
    sql`SELECT date::text, COALESCE(SUM(impressions),0)::int as impressions, COALESCE(SUM(reach),0)::int as reach,
        COALESCE(SUM(engagement),0)::int as engagement, COALESCE(SUM(clicks),0)::int as clicks
        FROM meta_organic_cache WHERE date >= CURRENT_DATE - make_interval(days => ${days}) GROUP BY date ORDER BY date`,
    // Current half
    sql`SELECT COALESCE(SUM(spend),0)::float as spend, COALESCE(SUM(impressions),0)::int as impressions,
        COALESCE(SUM(clicks),0)::int as clicks, COALESCE(SUM(conversions),0)::int as conversions
        FROM normalized_daily_metrics WHERE date >= CURRENT_DATE - make_interval(days => ${half})`,
    // Previous half
    sql`SELECT COALESCE(SUM(spend),0)::float as spend, COALESCE(SUM(impressions),0)::int as impressions,
        COALESCE(SUM(clicks),0)::int as clicks, COALESCE(SUM(conversions),0)::int as conversions
        FROM normalized_daily_metrics WHERE date >= CURRENT_DATE - make_interval(days => ${days}) AND date < CURRENT_DATE - make_interval(days => ${half})`,
    // Organic current half
    sql`SELECT COALESCE(SUM(impressions),0)::int as impressions, COALESCE(SUM(reach),0)::int as reach,
        COALESCE(SUM(engagement),0)::int as engagement, COALESCE(SUM(clicks),0)::int as clicks
        FROM meta_organic_cache WHERE date >= CURRENT_DATE - make_interval(days => ${half})`,
    // Organic previous half
    sql`SELECT COALESCE(SUM(impressions),0)::int as impressions, COALESCE(SUM(reach),0)::int as reach,
        COALESCE(SUM(engagement),0)::int as engagement, COALESCE(SUM(clicks),0)::int as clicks
        FROM meta_organic_cache WHERE date >= CURRENT_DATE - make_interval(days => ${days}) AND date < CURRENT_DATE - make_interval(days => ${half})`,
  ]);

  const pct = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 1000) / 10 : 0;
  const pc = (paidCurr[0] || {}) as Record<string, number>;
  const pp = (paidPrev[0] || {}) as Record<string, number>;
  const oc = (orgCurr[0] || {}) as Record<string, number>;
  const op = (orgPrev[0] || {}) as Record<string, number>;

  return NextResponse.json({
    paid_daily: paidDaily,
    organic_daily: organicDaily,
    paid_deltas: {
      spend: pct(pc.spend, pp.spend),
      impressions: pct(pc.impressions, pp.impressions),
      clicks: pct(pc.clicks, pp.clicks),
      conversions: pct(pc.conversions, pp.conversions),
    },
    organic_deltas: {
      impressions: pct(oc.impressions, op.impressions),
      reach: pct(oc.reach, op.reach),
      engagement: pct(oc.engagement, op.engagement),
      clicks: pct(oc.clicks, op.clicks),
    },
  });
}
