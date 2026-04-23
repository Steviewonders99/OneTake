import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  await requireAuth();
  const sql = getDb();

  const [statusCounts, avgDuration, recentJobs] = await Promise.all([
    sql`SELECT status, COUNT(*)::int as count FROM compute_jobs GROUP BY status`,
    sql`SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::int as avg_seconds FROM compute_jobs WHERE completed_at IS NOT NULL AND started_at IS NOT NULL`,
    sql`SELECT id, request_id, job_type, status, error_message, started_at, completed_at, created_at FROM compute_jobs ORDER BY created_at DESC LIMIT 10`,
  ]);

  return NextResponse.json({
    by_status: statusCounts,
    avg_duration_seconds: avgDuration[0]?.avg_seconds ?? 0,
    recent: recentJobs,
  });
}
