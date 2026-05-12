import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const since = `CURRENT_DATE - INTERVAL '${days} days'`;

  const [metaRows, linkedinRows, redditRows, snapshotRows] = await Promise.all([
    sql`
      SELECT
        platform,
        COALESCE(SUM(impressions), 0)::bigint AS impressions,
        COALESCE(SUM(reach), 0)::bigint AS reach,
        COALESCE(SUM(engagement), 0)::bigint AS engagement,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        COUNT(*)::int AS post_count
      FROM meta_organic_cache
      WHERE post_date >= CURRENT_DATE - ${days}::int
      GROUP BY platform
    `,
    sql`
      SELECT
        'linkedin' AS platform,
        COALESCE(SUM(impressions), 0)::bigint AS impressions,
        COALESCE(SUM(unique_impressions), 0)::bigint AS reach,
        COALESCE(SUM(engagement), 0)::bigint AS engagement,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        COUNT(*)::int AS post_count
      FROM linkedin_organic_cache
      WHERE post_date >= CURRENT_DATE - ${days}::int
    `,
    sql`
      SELECT
        'reddit' AS platform,
        COALESCE(SUM(impressions), 0)::bigint AS impressions,
        0::bigint AS reach,
        COALESCE(SUM(upvotes) + SUM(comments), 0)::bigint AS engagement,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        COUNT(*)::int AS post_count
      FROM reddit_organic_cache
      WHERE post_date >= CURRENT_DATE - ${days}::int
    `,
    sql`
      SELECT
        platform,
        MAX(follower_count) - MIN(follower_count) AS follower_delta
      FROM social_account_snapshots
      WHERE snapshot_date >= CURRENT_DATE - ${days}::int
      GROUP BY platform
    `,
  ]);

  // Merge all platform rows
  const platformMap: Record<string, {
    platform: string;
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    post_count: number;
    follower_delta: number;
  }> = {};

  for (const row of [...metaRows, ...linkedinRows, ...redditRows]) {
    const p = row.platform as string;
    if (!platformMap[p]) {
      platformMap[p] = {
        platform: p,
        impressions: 0,
        reach: 0,
        engagement: 0,
        clicks: 0,
        post_count: 0,
        follower_delta: 0,
      };
    }
    platformMap[p].impressions += Number(row.impressions ?? 0);
    platformMap[p].reach += Number(row.reach ?? 0);
    platformMap[p].engagement += Number(row.engagement ?? 0);
    platformMap[p].clicks += Number(row.clicks ?? 0);
    platformMap[p].post_count += Number(row.post_count ?? 0);
  }

  for (const row of snapshotRows) {
    const p = row.platform as string;
    if (platformMap[p]) {
      platformMap[p].follower_delta = Number(row.follower_delta ?? 0);
    }
  }

  const platforms = Object.values(platformMap);

  const total_impressions = platforms.reduce((s, r) => s + r.impressions, 0);
  const total_reach = platforms.reduce((s, r) => s + r.reach, 0);
  const total_engagement = platforms.reduce((s, r) => s + r.engagement, 0);
  const total_clicks = platforms.reduce((s, r) => s + r.clicks, 0);
  const follower_delta = platforms.reduce((s, r) => s + r.follower_delta, 0);
  const post_count = platforms.reduce((s, r) => s + r.post_count, 0);
  const avg_engagement_rate = total_impressions > 0
    ? total_engagement / total_impressions
    : 0;

  return NextResponse.json({
    days,
    total_impressions,
    total_reach,
    total_engagement,
    total_clicks,
    follower_delta,
    post_count,
    avg_engagement_rate,
    platforms,
  });
}
