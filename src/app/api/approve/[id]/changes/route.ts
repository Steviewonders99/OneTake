import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest, updateIntakeRequest } from '@/lib/db/intake';
import { createApproval } from '@/lib/db/approvals';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.notes || typeof body.notes !== 'string') {
      return Response.json(
        { error: 'notes is required and must be a string' },
        { status: 400 }
      );
    }

    // Create approval record with changes_requested status
    const approval = await createApproval({
      request_id: id,
      approved_by: userId,
      status: 'changes_requested',
      notes: body.notes,
    });

    // Reset intake request status to draft
    await updateIntakeRequest(id, { status: 'draft' });

    return Response.json(approval);
  } catch (error) {
    console.error('[api/approve/[id]/changes] Failed to request changes:', error);
    return Response.json(
      { error: 'Failed to request changes' },
      { status: 500 }
    );
  }
}
