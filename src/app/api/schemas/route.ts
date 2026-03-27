import { listActiveSchemas } from '@/lib/db/schemas';

export async function GET() {
  try {
    const schemas = await listActiveSchemas();
    return Response.json(schemas);
  } catch (error) {
    console.error('[api/schemas] Failed to list schemas:', error);
    return Response.json(
      { error: 'Failed to list schemas' },
      { status: 500 }
    );
  }
}
