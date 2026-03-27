import { auth } from '@clerk/nextjs/server';
import {
  getIntakeRequest,
  updateIntakeRequest,
  deleteIntakeRequest,
} from '@/lib/db/intake';

export async function GET(
  _request: Request,
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

    return Response.json(intakeRequest);
  } catch (error) {
    console.error('[api/intake/[id]] Failed to get intake request:', error);
    return Response.json(
      { error: 'Failed to get intake request' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify the request exists
    const existing = await getIntakeRequest(id);
    if (!existing) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updated = await updateIntakeRequest(id, {
      title: body.title,
      task_type: body.task_type,
      urgency: body.urgency,
      target_languages: body.target_languages,
      target_regions: body.target_regions,
      volume_needed: body.volume_needed,
      status: body.status,
      form_data: body.form_data,
      schema_version: body.schema_version,
    });

    return Response.json(updated);
  } catch (error) {
    console.error('[api/intake/[id]] Failed to update intake request:', error);
    return Response.json(
      { error: 'Failed to update intake request' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify the request exists
    const existing = await getIntakeRequest(id);
    if (!existing) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    await deleteIntakeRequest(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[api/intake/[id]] Failed to delete intake request:', error);
    return Response.json(
      { error: 'Failed to delete intake request' },
      { status: 500 }
    );
  }
}
