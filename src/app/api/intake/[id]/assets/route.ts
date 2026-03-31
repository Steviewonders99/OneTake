import { getAuthContext, canAccessRequest } from '@/lib/permissions';
import { getIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();

  if (!ctx) {
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

    if (!canAccessRequest(ctx, intakeRequest.created_by)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const assets = await getAssetsByRequestId(id);
    return Response.json(assets);
  } catch (error) {
    console.error('[api/intake/[id]/assets] Failed to get assets:', error);
    return Response.json(
      { error: 'Failed to get assets' },
      { status: 500 }
    );
  }
}
