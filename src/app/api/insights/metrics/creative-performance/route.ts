import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const recruiterId = url.searchParams.get('recruiterId');

  try {
    const sql = getDb();

    let rows;
    if (recruiterId) {
      rows = await sql`
        SELECT asset_id, utm_content as platform, sum(click_count) as total_clicks
        FROM tracked_links
        WHERE recruiter_clerk_id = ${recruiterId} AND asset_id IS NOT NULL
        GROUP BY asset_id, utm_content
        ORDER BY total_clicks DESC
        LIMIT 10
      `;
    } else {
      rows = await sql`
        SELECT asset_id, utm_content as platform, sum(click_count) as total_clicks
        FROM tracked_links
        WHERE asset_id IS NOT NULL
        GROUP BY asset_id, utm_content
        ORDER BY total_clicks DESC
        LIMIT 10
      `;
    }

    return Response.json({
      creatives: rows.map((r: Record<string, unknown>) => ({
        asset_id: r.asset_id,
        platform: r.platform,
        total_clicks: Number(r.total_clicks),
      })),
    });
  } catch (error) {
    console.error('[creative-performance] error:', error);
    return Response.json({ creatives: [] });
  }
}
