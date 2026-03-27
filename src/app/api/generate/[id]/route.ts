import { auth } from '@clerk/nextjs/server';
import { after } from 'next/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { getRunsByRequestId } from '@/lib/db/pipeline-runs';
import { runPipeline } from '@/lib/pipeline/orchestrator';

export async function POST(
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

    if (intakeRequest.status !== 'draft') {
      return Response.json(
        { error: `Request is in '${intakeRequest.status}' status, must be 'draft' to start pipeline` },
        { status: 400 }
      );
    }

    // Fire-and-forget: run the pipeline in the background after the response is sent
    after(() => runPipeline(id));

    return Response.json({
      message: 'Pipeline started',
      request_id: id,
    });
  } catch (error) {
    console.error('[api/generate/[id]] Failed to start pipeline:', error);
    return Response.json(
      { error: 'Failed to start pipeline' },
      { status: 500 }
    );
  }
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
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    const runs = await getRunsByRequestId(id);

    return Response.json({
      request_id: id,
      status: intakeRequest.status,
      pipeline_runs: runs,
    });
  } catch (error) {
    console.error('[api/generate/[id]] Failed to get pipeline status:', error);
    return Response.json(
      { error: 'Failed to get pipeline status' },
      { status: 500 }
    );
  }
}
