import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { asset_id, new_blob_url, edit_description } = await request.json();

  if (!asset_id || !new_blob_url) {
    return Response.json({ error: 'Missing asset_id or new_blob_url' }, { status: 400 });
  }

  const sql = getDb();

  try {
    await sql`
      UPDATE generated_assets SET blob_url = ${new_blob_url}
      WHERE id = ${asset_id}::uuid
    `;

    // Create notification for marketing manager
    const asset = await sql`SELECT request_id FROM generated_assets WHERE id = ${asset_id}::uuid`;
    if (asset?.[0]?.request_id) {
      await sql`
        INSERT INTO notifications (user_id, request_id, type, title, body)
        SELECT created_by, ${asset[0].request_id}, 'designer_update',
          'Designer refined an asset', ${edit_description || 'An image was updated'}
        FROM intake_requests WHERE id = ${asset[0].request_id}::uuid
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[api/designer/replace] Failed to replace asset:', error);
    return Response.json({ error: 'Failed to replace asset' }, { status: 500 });
  }
}
