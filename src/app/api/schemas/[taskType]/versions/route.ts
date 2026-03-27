import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskType: string }> }
) {
  try {
    const { taskType } = await params;
    const sql = getDb();

    // First get the schema ID for this task type
    const schemas = await sql`
      SELECT id FROM task_type_schemas WHERE task_type = ${taskType}
    `;

    if (schemas.length === 0) {
      return Response.json(
        { error: `Schema not found for task type: ${taskType}` },
        { status: 404 }
      );
    }

    const schemaId = schemas[0].id as string;

    const versions = await sql`
      SELECT * FROM schema_versions
      WHERE schema_id = ${schemaId}
      ORDER BY version DESC
    `;

    return Response.json(versions);
  } catch (error) {
    console.error('[api/schemas/[taskType]/versions] Failed to list versions:', error);
    return Response.json(
      { error: 'Failed to list schema versions' },
      { status: 500 }
    );
  }
}
