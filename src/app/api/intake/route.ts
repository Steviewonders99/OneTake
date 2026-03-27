import { auth } from '@clerk/nextjs/server';
import { listIntakeRequests, createIntakeRequest } from '@/lib/db/intake';
import { getSchemaByTaskType } from '@/lib/db/schemas';
import { validateFormData } from '@/lib/validation';
import type { Status } from '@/lib/types';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as Status | null;
    const taskType = url.searchParams.get('task_type');

    const requests = await listIntakeRequests({
      status: status ?? undefined,
      task_type: taskType ?? undefined,
    });

    return Response.json(requests);
  } catch (error) {
    console.error('[api/intake] Failed to list intake requests:', error);
    return Response.json(
      { error: 'Failed to list intake requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required top-level fields
    if (!body.task_type) {
      return Response.json(
        { error: 'task_type is required' },
        { status: 400 }
      );
    }

    if (!body.title) {
      return Response.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    // Get schema for validation
    const schema = await getSchemaByTaskType(body.task_type);
    if (!schema) {
      return Response.json(
        { error: `Unknown task type: ${body.task_type}` },
        { status: 400 }
      );
    }

    // Validate form_data against schema
    const formData = body.form_data ?? {};
    const validation = validateFormData(schema, formData);

    if (!validation.valid) {
      return Response.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    const intakeRequest = await createIntakeRequest({
      title: body.title,
      task_type: body.task_type,
      urgency: body.urgency ?? 'standard',
      target_languages: body.target_languages ?? [],
      target_regions: body.target_regions ?? [],
      volume_needed: body.volume_needed ?? null,
      created_by: userId,
      form_data: formData,
      schema_version: schema.version,
    });

    return Response.json(intakeRequest, { status: 201 });
  } catch (error) {
    console.error('[api/intake] Failed to create intake request:', error);
    return Response.json(
      { error: 'Failed to create intake request' },
      { status: 500 }
    );
  }
}
