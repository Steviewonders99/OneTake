import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, canRequestPaid } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { createComputeJob } from '@/lib/db/compute-jobs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canRequestPaid(authCtx)) {
    return NextResponse.json({ error: 'Only lead recruiters can request paid media' }, { status: 403 });
  }

  const { id } = await params;
  const sql = getDb();

  // Verify request exists and is in valid state for paid upgrade
  const rows = await sql`
    SELECT id, status, pipeline_mode, title FROM intake_requests WHERE id = ${id}
  `;
  const intakeRequest = rows[0];
  if (!intakeRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (!['review', 'approved'].includes(intakeRequest.status)) {
    return NextResponse.json(
      { error: 'Campaign must be in review or approved status to request paid media' },
      { status: 400 }
    );
  }
  if (intakeRequest.pipeline_mode === 'full') {
    return NextResponse.json(
      { error: 'Paid media already requested for this campaign' },
      { status: 400 }
    );
  }

  // Parse body for optional paid config (budget, platforms)
  const body = await request.json().catch(() => ({}));
  const paidConfig = {
    budget: body.budget ?? null,
    platforms: body.platforms ?? ['meta', 'linkedin', 'tiktok', 'google'],
    date_range: body.date_range ?? null,
  };

  // Update request to full mode
  await sql`
    UPDATE intake_requests
    SET pipeline_mode = 'full',
        paid_requested_by = ${authCtx.userId},
        paid_requested_at = NOW(),
        status = 'generating',
        form_data = form_data || ${JSON.stringify({ paid_config: paidConfig })}::jsonb
    WHERE id = ${id}
  `;

  // Create compute job for paid pipeline
  const job = await createComputeJob({
    request_id: id,
    job_type: 'generate_paid',
    feedback_data: paidConfig,
  });

  return NextResponse.json({
    success: true,
    job_id: job.id,
    message: 'Paid media generation started',
  });
}
