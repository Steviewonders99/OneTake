import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  await requireAuth();
  const sql = getDb();

  const leaderboard = await sql`
    SELECT
      tl.recruiter_clerk_id,
      COALESCE(ur.name, ur.email, tl.recruiter_clerk_id) as recruiter_name,
      SUM(tl.click_count)::int as total_clicks,
      COUNT(tl.id)::int as links_created,
      MAX(tl.click_count)::int as best_link_clicks,
      COUNT(DISTINCT tl.request_id)::int as campaigns_active
    FROM tracked_links tl
    LEFT JOIN user_roles ur ON ur.clerk_id = tl.recruiter_clerk_id
    GROUP BY tl.recruiter_clerk_id, ur.name, ur.email
    ORDER BY total_clicks DESC
    LIMIT 20
  `;

  return NextResponse.json({ leaderboard });
}
