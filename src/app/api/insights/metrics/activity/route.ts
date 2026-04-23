import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const [campaigns, regions, languages] = recruiterId
    ? await Promise.all([
        sql`SELECT id, title, status, urgency, task_type, target_regions, target_languages, created_at, updated_at FROM intake_requests WHERE created_by = ${recruiterId} ORDER BY updated_at DESC LIMIT 20`,
        sql`SELECT unnest(target_regions) as region, COUNT(*)::int as count FROM intake_requests WHERE created_by = ${recruiterId} GROUP BY region ORDER BY count DESC`,
        sql`SELECT unnest(target_languages) as language, COUNT(*)::int as count FROM intake_requests WHERE created_by = ${recruiterId} GROUP BY language ORDER BY count DESC`,
      ])
    : await Promise.all([
        sql`SELECT id, title, status, urgency, task_type, target_regions, target_languages, created_at, updated_at FROM intake_requests ORDER BY updated_at DESC LIMIT 20`,
        sql`SELECT unnest(target_regions) as region, COUNT(*)::int as count FROM intake_requests GROUP BY region ORDER BY count DESC`,
        sql`SELECT unnest(target_languages) as language, COUNT(*)::int as count FROM intake_requests GROUP BY language ORDER BY count DESC`,
      ]);

  return NextResponse.json({ recent_campaigns: campaigns, by_region: regions, by_language: languages });
}
