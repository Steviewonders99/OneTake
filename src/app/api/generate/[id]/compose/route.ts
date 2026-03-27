import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { createPipelineRun, updatePipelineRun } from '@/lib/db/pipeline-runs';
import { runStage4 } from '@/lib/pipeline/stage4-compose';

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
      stage: 4,
      stage_name: 'Layout Composition',
      status: 'running',
    });

    const startTime = Date.now();

    try {
      const result = await runStage4(id);
      const durationMs = Date.now() - startTime;

      await updatePipelineRun(run.id, {
        status: 'passed',
        output_data: result,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });

      return Response.json({
        pipeline_run_id: run.id,
        stage: 4,
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
        { error: 'Stage 4 failed', details: errorMessage, pipeline_run_id: run.id },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[api/generate/[id]/compose] Failed:', error);
    return Response.json(
      { error: 'Failed to run Stage 4' },
      { status: 500 }
    );
  }
}
