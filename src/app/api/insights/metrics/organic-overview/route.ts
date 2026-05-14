import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30') || 30);

  const [metaRows, snapshotRows] = await Promise.all([
    sql`
      SELECT platform,
        COALESCE(SUM(impressions),0)::int as impressions,
        COALESCE(SUM(reach),0)::int as reach,
        COALESCE(SUM(engagement),0)::int as engagement,
        COALESCE(SUM(clicks),0)::int as clicks,
        COUNT(DISTINCT post_id)::int as post_count,
        AVG(engagement_rate) as avg_eng_rate
      FROM meta_organic_cache
      WHERE date >= CURRENT_DATE - make_interval(days => ${days})
      GROUP BY platform
    `,
    sql`
      SELECT platform, COALESCE(SUM(follower_delta),0)::int as follower_delta
      FROM social_account_snapshots
      WHERE date >= CURRENT_DATE - make_interval(days => ${days})
      GROUP BY platform
    `,
  ]);

  const per_platform: Record<string, any> = {};
  let total_impressions = 0, total_reach = 0, total_engagement = 0, total_clicks = 0, total_posts = 0, total_follower_delta = 0;

  for (const row of metaRows as any[]) {
    const p = row.platform;
    per_platform[p] = {
      impressions: Number(row.impressions), reach: Number(row.reach),
      engagement: Number(row.engagement), clicks: Number(row.clicks),
      post_count: Number(row.post_count), follower_delta: 0,
    };
    total_impressions += Number(row.impressions);
    total_reach += Number(row.reach);
    total_engagement += Number(row.engagement);
    total_clicks += Number(row.clicks);
    total_posts += Number(row.post_count);
  }

  for (const snap of snapshotRows as any[]) {
    if (per_platform[snap.platform]) {
      per_platform[snap.platform].follower_delta = Number(snap.follower_delta);
    }
    total_follower_delta += Number(snap.follower_delta);
  }

  return NextResponse.json({
    impressions: total_impressions,
    reach: total_reach,
    engagement: total_engagement,
    clicks: total_clicks,
    post_count: total_posts,
    followers_delta: total_follower_delta,
    engagement_rate: total_reach > 0 ? (total_engagement / total_reach * 100) : 0,
    avg_engagement_rate: total_reach > 0 ? (total_engagement / total_reach * 100) : 0,
    per_platform,
  });
}
