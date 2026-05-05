import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, canEditCampaign } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { rollbackBatch } from '@/lib/edit-executor';
import { sendTeamsNotification } from '@/lib/notifications/teams';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: requestId } = await params;
  const sql = getDb();

  // Fetch campaign
  const rows = await sql`
    SELECT id, status, created_by, title FROM intake_requests WHERE id = ${requestId}
  `;
  const campaign = rows[0];
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (!canEditCampaign(authCtx, campaign.created_by, campaign.status)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json();
  const { batch_id } = body;

  if (!batch_id) {
    return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });
  }

  const reverted = await rollbackBatch(requestId, batch_id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onetake.oneforma.com';
  await sendTeamsNotification({
    title: `Edit Rolled Back — ${campaign.title}`,
    subtitle: `${reverted} assets reverted to previous version`,
    facts: [
      { title: 'Batch ID', value: batch_id.slice(0, 8) },
      { title: 'Assets Reverted', value: String(reverted) },
      { title: 'By', value: authCtx.email || authCtx.userId },
    ],
    actionUrl: `${appUrl}/intake/${requestId}`,
    actionLabel: 'View Campaign',
  }).catch(() => {});

  return NextResponse.json({
    assets_reverted: reverted,
    batch_id,
  });
}
