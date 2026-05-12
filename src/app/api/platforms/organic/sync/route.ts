import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  const sql = getDb();
  const body = await request.json().catch(() => ({}));
  const days = (body.days as number) ?? 30;

  const rows = await sql`
    INSERT INTO compute_jobs (job_type, feedback_data)
    VALUES (
      'organic_sync',
      ${JSON.stringify({ days })}::jsonb
    )
    RETURNING id
  `;

  const job_id = rows[0]?.id;

  return NextResponse.json({
    job_id,
    message: `Organic sync job queued (last ${days} days). Job ID: ${job_id}`,
  });
}
