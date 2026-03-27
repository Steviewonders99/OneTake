import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { createPipelineRun, updatePipelineRun } from '@/lib/db/pipeline-runs';
import { runStage1 } from '@/lib/pipeline/stage1-intelligence';
import { getBriefByRequestId } from '@/lib/db/briefs';

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

    // Create pipeline run record
    const run = await createPipelineRun({
      request_id: id,
      stage: 1,
      stage_name: 'Strategic Intelligence',
      status: 'running',
    });

    const startTime = Date.now();

    try {
      const result = await runStage1(id);
      const durationMs = Date.now() - startTime;

      await updatePipelineRun(run.id, {
        status: 'passed',
        output_data: result,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });

      return Response.json({
        pipeline_run_id: run.id,
        stage: 1,
        status: 'passed',
        duration_ms: durationMs,
        result,
      });
    } catch (stageError) {
      const durationMs = Date.now() - startTime;
      const errorMessage = stageError instanceof Error ? stageError.message : String(stageError);

      await updatePipelineRun(run.id, {
        status: 'failed',
        error_message: errorMessage,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });

      return Response.json(
        { error: 'Stage 1 failed', details: errorMessage, pipeline_run_id: run.id },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[api/generate/[id]/brief] Failed:', error);
    return Response.json(
      { error: 'Failed to run Stage 1' },
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
    const brief = await getBriefByRequestId(id);
    return Response.json({ brief });
  } catch (error) {
    console.error('[api/generate/[id]/brief] GET failed:', error);
    return Response.json(
      { error: 'Failed to fetch brief' },
      { status: 500 }
    );
  }
}
