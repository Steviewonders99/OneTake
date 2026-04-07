import { getAuthContext } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import { slugify } from '@/lib/slugify';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const { id } = await params;
  const intake = await getIntakeRequest(id);
  if (!intake) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { campaign_slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.campaign_slug !== 'string') {
    return Response.json({ error: 'campaign_slug must be a string' }, { status: 400 });
  }

  const normalized = slugify(body.campaign_slug);
  if (!normalized) {
    return Response.json(
      { error: 'campaign_slug must contain at least one alphanumeric character' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const rows = await sql`
    UPDATE intake_requests
       SET campaign_slug = ${normalized},
           updated_at = NOW()
     WHERE id = ${id}
     RETURNING id, campaign_slug, updated_at
  `;

  return Response.json(rows[0]);
}
