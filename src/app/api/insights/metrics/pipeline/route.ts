import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const [statusCounts, urgencyCounts, totalRow, recentRows] = recruiterId
    ? await Promise.all([
        sql`SELECT status, COUNT(*)::int as count FROM intake_requests WHERE created_by = ${recruiterId} GROUP BY status ORDER BY status`,
        sql`SELECT urgency, COUNT(*)::int as count FROM intake_requests WHERE created_by = ${recruiterId} GROUP BY urgency`,
        sql`SELECT COUNT(*)::int as total FROM intake_requests WHERE created_by = ${recruiterId}`,
        sql`SELECT id, title, status, urgency, task_type, created_at FROM intake_requests WHERE created_by = ${recruiterId} ORDER BY created_at DESC LIMIT 10`,
      ])
    : await Promise.all([
        sql`SELECT status, COUNT(*)::int as count FROM intake_requests GROUP BY status ORDER BY status`,
        sql`SELECT urgency, COUNT(*)::int as count FROM intake_requests GROUP BY urgency`,
        sql`SELECT COUNT(*)::int as total FROM intake_requests`,
        sql`SELECT id, title, status, urgency, task_type, created_at FROM intake_requests ORDER BY created_at DESC LIMIT 10`,
      ]);

  return NextResponse.json({
    total: totalRow[0]?.total ?? 0,
    by_status: statusCounts,
    by_urgency: urgencyCounts,
    recent: recentRows,
  });
}
