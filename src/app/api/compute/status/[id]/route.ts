import { auth } from '@clerk/nextjs/server';
import { getLatestJobForRequest, getJobsByRequestId } from '@/lib/db/compute-jobs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const latestJob = await getLatestJobForRequest(id);
  const allJobs = await getJobsByRequestId(id);

  return Response.json({
    latest: latestJob,
    jobs: allJobs,
  });
}
