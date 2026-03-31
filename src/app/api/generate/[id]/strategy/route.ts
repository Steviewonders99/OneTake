import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

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
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM campaign_strategies
      WHERE request_id = ${id}
      ORDER BY created_at DESC
    `;
    return Response.json({ strategies: rows });
  } catch (error) {
    console.error('[api/generate/[id]/strategy] GET failed:', error);
    return Response.json(
      { error: 'Failed to fetch campaign strategies' },
      { status: 500 }
    );
  }
}
