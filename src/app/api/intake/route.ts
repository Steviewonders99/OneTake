import { auth } from '@clerk/nextjs/server';
import { getAuthContext } from '@/lib/permissions';
import { listIntakeRequests, createIntakeRequest } from '@/lib/db/intake';
import { getSchemaByTaskType } from '@/lib/db/schemas';
import { validateFormData } from '@/lib/validation';
import type { Status } from '@/lib/types';
import { slugify } from '@/lib/slugify';
import { REQUIRED_JOB_REQUIREMENTS_KEYS } from '@/lib/shared-schema-modules';

export async function GET(request: Request) {
  const ctx = await getAuthContext();

  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as Status | null;
    const taskType = url.searchParams.get('task_type');

    // Recruiters only see their own requests; admins and viewers see all
    const createdByFilter = ctx.role === 'recruiter' ? ctx.userId : undefined;

    const requests = await listIntakeRequests({
      status: status ?? undefined,
      task_type: taskType ?? undefined,
      created_by: createdByFilter,
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

    // Extract the 7 Job Requirements fields from form_data.
    // The shared JOB_REQUIREMENTS_FIELDS module prepends these to every task
    // type's task_fields, so they land in formData alongside task-specific fields.
    // We promote them to first-class columns here and validate the 4 required ones.
    function readJobReqString(key: string): string | null {
      const raw = formData[key];
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    const qualifications_required = readJobReqString('qualifications_required');
    const qualifications_preferred = readJobReqString('qualifications_preferred');
    const location_scope = readJobReqString('location_scope');
    const language_requirements = readJobReqString('language_requirements');
    const engagement_model = readJobReqString('engagement_model');
    const technical_requirements = readJobReqString('technical_requirements');
    const context_notes = readJobReqString('context_notes');

    // Application-level required-field validation for the 4 mandatory Job
    // Requirements keys. The DB columns are nullable (for backwards compat with
    // existing rows), so we enforce required-ness here.
    const jobRequirementValues: Record<string, string | null> = {
      qualifications_required,
      qualifications_preferred,
      location_scope,
      language_requirements,
      engagement_model,
      technical_requirements,
      context_notes,
    };

    const missingRequired = REQUIRED_JOB_REQUIREMENTS_KEYS.filter(
      (key) => !jobRequirementValues[key]
    );
    if (missingRequired.length > 0) {
      return Response.json(
        {
          error: 'Missing required Job Requirements fields',
          missing_fields: missingRequired,
        },
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
      campaign_slug: slugify(body.title) || null,
      qualifications_required,
      qualifications_preferred,
      location_scope,
      language_requirements,
      engagement_model,
      technical_requirements,
      context_notes,
    });

    // Auto-queue generation — no manual "Generate" button needed.
    // The local worker will pick this up and run the full pipeline.
    try {
      const { createComputeJob } = await import('@/lib/db/compute-jobs');
      const { updateIntakeRequest } = await import('@/lib/db/intake');

      await updateIntakeRequest(intakeRequest.id, { status: 'generating' });
      await createComputeJob({
        request_id: intakeRequest.id,
        job_type: 'generate',
      });
    } catch (jobError) {
      // Don't fail the request creation if job queuing fails
      console.error('[api/intake] Failed to auto-queue generation:', jobError);
    }

    return Response.json(intakeRequest, { status: 201 });
  } catch (error) {
    console.error('[api/intake] Failed to create intake request:', error);
    return Response.json(
      { error: 'Failed to create intake request' },
      { status: 500 }
    );
  }
}
