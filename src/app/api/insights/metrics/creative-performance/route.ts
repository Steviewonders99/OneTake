import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const creativePerf = recruiterId
    ? await sql`
        SELECT
          ga.id as asset_id,
          ga.asset_type,
          ga.platform,
          ga.blob_url,
          ga.evaluation_score,
          ga.evaluation_passed,
          COALESCE(SUM(tl.click_count), 0)::int as total_clicks,
          COUNT(tl.id)::int as link_count
        FROM generated_assets ga
        LEFT JOIN tracked_links tl ON tl.asset_id = ga.id AND tl.recruiter_clerk_id = ${recruiterId}
        WHERE ga.asset_type IN ('composed_creative', 'carousel_panel', 'base_image')
        GROUP BY ga.id, ga.asset_type, ga.platform, ga.blob_url, ga.evaluation_score, ga.evaluation_passed
        ORDER BY total_clicks DESC
        LIMIT 20
      `
    : await sql`
        SELECT
          ga.id as asset_id,
          ga.asset_type,
          ga.platform,
          ga.blob_url,
          ga.evaluation_score,
          ga.evaluation_passed,
          COALESCE(SUM(tl.click_count), 0)::int as total_clicks,
          COUNT(tl.id)::int as link_count
        FROM generated_assets ga
        LEFT JOIN tracked_links tl ON tl.asset_id = ga.id
        WHERE ga.asset_type IN ('composed_creative', 'carousel_panel', 'base_image')
        GROUP BY ga.id, ga.asset_type, ga.platform, ga.blob_url, ga.evaluation_score, ga.evaluation_passed
        ORDER BY total_clicks DESC
        LIMIT 20
      `;

  return NextResponse.json({ creatives: creativePerf });
}
