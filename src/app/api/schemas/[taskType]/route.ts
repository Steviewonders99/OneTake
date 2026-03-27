import { getSchemaByTaskType } from '@/lib/db/schemas';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskType: string }> }
) {
  try {
    const { taskType } = await params;
    const schema = await getSchemaByTaskType(taskType);

    if (!schema) {
      return Response.json(
        { error: `Schema not found for task type: ${taskType}` },
        { status: 404 }
      );
    }

    return Response.json(schema);
  } catch (error) {
    console.error('[api/schemas/[taskType]] Failed to get schema:', error);
    return Response.json(
      { error: 'Failed to get schema' },
      { status: 500 }
    );
  }
}
