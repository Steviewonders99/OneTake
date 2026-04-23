import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const [bySource, byMedium, byCampaign, bySourceMedium, totalRow] = recruiterId
    ? await Promise.all([
        sql`SELECT utm_source, SUM(click_count)::int as clicks, COUNT(*)::int as link_count FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId} GROUP BY utm_source ORDER BY clicks DESC`,
        sql`SELECT utm_medium, SUM(click_count)::int as clicks, COUNT(*)::int as link_count FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId} GROUP BY utm_medium ORDER BY clicks DESC`,
        sql`SELECT utm_campaign, SUM(click_count)::int as clicks, COUNT(*)::int as link_count FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId} GROUP BY utm_campaign ORDER BY clicks DESC LIMIT 15`,
        sql`SELECT utm_source, utm_medium, SUM(click_count)::int as clicks FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId} GROUP BY utm_source, utm_medium ORDER BY clicks DESC LIMIT 20`,
        sql`SELECT COALESCE(SUM(click_count), 0)::int as total_clicks, COUNT(*)::int as total_links FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId}`,
      ])
    : await Promise.all([
        sql`SELECT utm_source, SUM(click_count)::int as clicks, COUNT(*)::int as link_count FROM tracked_links GROUP BY utm_source ORDER BY clicks DESC`,
        sql`SELECT utm_medium, SUM(click_count)::int as clicks, COUNT(*)::int as link_count FROM tracked_links GROUP BY utm_medium ORDER BY clicks DESC`,
        sql`SELECT utm_campaign, SUM(click_count)::int as clicks, COUNT(*)::int as link_count FROM tracked_links GROUP BY utm_campaign ORDER BY clicks DESC LIMIT 15`,
        sql`SELECT utm_source, utm_medium, SUM(click_count)::int as clicks FROM tracked_links GROUP BY utm_source, utm_medium ORDER BY clicks DESC LIMIT 20`,
        sql`SELECT COALESCE(SUM(click_count), 0)::int as total_clicks, COUNT(*)::int as total_links FROM tracked_links`,
      ]);

  return NextResponse.json({
    total_clicks: totalRow[0]?.total_clicks ?? 0,
    total_links: totalRow[0]?.total_links ?? 0,
    by_source: bySource,
    by_medium: byMedium,
    by_campaign: byCampaign,
    source_medium_matrix: bySourceMedium,
  });
}
