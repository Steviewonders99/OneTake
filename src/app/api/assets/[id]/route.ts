import { auth } from '@clerk/nextjs/server';
import { getAuthContext } from '@/lib/permissions';
import { deleteAsset } from '@/lib/db/assets';
import { updateAssetFields } from '@/lib/db/update-asset';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin and designer can delete assets
  if (ctx.role !== 'admin' && ctx.role !== 'designer') {
    return Response.json({ error: 'Forbidden — only admin and designer can delete assets' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await deleteAsset(id);
    return Response.json({ success: true, deleted: id });
  } catch (error) {
    console.error('[api/assets/[id]] DELETE failed:', error);
    return Response.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'admin' && ctx.role !== 'designer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const { content, copy_data } = body as {
      content?: Record<string, unknown>;
      copy_data?: Record<string, unknown>;
    };

    if (!content && !copy_data) {
      return Response.json({ error: 'No update fields provided' }, { status: 400 });
    }

    const result = await updateAssetFields(id, { content, copy_data });

    if (!result) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[api/assets/[id]] PATCH failed:', error);
    return Response.json({ error: 'Failed to update asset' }, { status: 500 });
  }
}
