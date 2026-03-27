import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest, updateIntakeRequest } from '@/lib/db/intake';
import { createComputeJob, getJobsByRequestId } from '@/lib/db/compute-jobs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const intake = await getIntakeRequest(id);
  if (!intake) return Response.json({ error: 'Not found' }, { status: 404 });

  // Update status to generating
  await updateIntakeRequest(id, { status: 'generating' });

  // Create compute job for local worker to pick up
  const job = await createComputeJob({
    request_id: id,
    job_type: 'generate',
  });

  return Response.json(
    { message: 'Generation job queued', job_id: job.id, status: 'pending' },
    { status: 202 }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const jobs = await getJobsByRequestId(id);
  return Response.json({ jobs });
}
