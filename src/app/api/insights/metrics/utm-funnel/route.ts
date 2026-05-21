import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const recruiterId = url.searchParams.get('recruiterId');

  try {
    const sql = getDb();

    let rows;
    if (recruiterId) {
      rows = await sql`
        SELECT utm_source, sum(click_count) as clicks, count(*) as links
        FROM tracked_links
        WHERE recruiter_clerk_id = ${recruiterId}
        GROUP BY utm_source
        ORDER BY clicks DESC
      `;
    } else {
      rows = await sql`
        SELECT utm_source, sum(click_count) as clicks, count(*) as links
        FROM tracked_links
        GROUP BY utm_source
        ORDER BY clicks DESC
      `;
    }

    const total_clicks = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.clicks), 0);
    const total_links = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.links), 0);

    return Response.json({
      total_clicks,
      total_links,
      by_source: rows.map((r: Record<string, unknown>) => ({
        utm_source: r.utm_source,
        clicks: Number(r.clicks),
      })),
    });
  } catch (error) {
    console.error('[utm-funnel] error:', error);
    return Response.json({ total_clicks: 0, total_links: 0, by_source: [] });
  }
}
