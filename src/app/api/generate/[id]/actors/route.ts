import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { createComputeJob } from '@/lib/db/compute-jobs';
import { getActorsByRequestId } from '@/lib/db/actors';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const intakeRequest = await getIntakeRequest(id);

  if (!intakeRequest) {
    return Response.json({ error: 'Intake request not found' }, { status: 404 });
  }

  // Create compute job for local worker to pick up
  const job = await createComputeJob({
    request_id: id,
    job_type: 'regenerate_stage',
    stage_target: 2,
  });

  return Response.json(
    { message: 'Stage 2 regeneration job queued', job_id: job.id, status: 'pending' },
    { status: 202 }
  );
}

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
    const actors = await getActorsByRequestId(id);
    return Response.json({ actors });
  } catch (error) {
    console.error('[api/generate/[id]/actors] GET failed:', error);
    return Response.json(
      { error: 'Failed to fetch actors' },
      { status: 500 }
    );
  }
}
