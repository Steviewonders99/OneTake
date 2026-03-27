import { getIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';
import { getBriefByRequestId } from '@/lib/db/briefs';
import { validateMagicLink } from '@/lib/db/magic-links';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return Response.json(
        { error: 'Magic link token is required' },
        { status: 401 }
      );
    }

    // Validate magic link
    const magicLink = await validateMagicLink(token);

    if (!magicLink) {
      return Response.json(
        { error: 'Invalid or expired magic link' },
        { status: 401 }
      );
    }

    // Ensure the magic link matches this request
    if (magicLink.request_id !== id) {
      return Response.json(
        { error: 'Token does not match this request' },
        { status: 401 }
      );
    }

    // Get request, assets, and brief
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    const [assets, brief] = await Promise.all([
      getAssetsByRequestId(id),
      getBriefByRequestId(id),
    ]);

    return Response.json({
      request: intakeRequest,
      assets,
      brief,
    });
  } catch (error) {
    console.error('[api/designer/[id]] Failed to get designer data:', error);
    return Response.json(
      { error: 'Failed to get designer data' },
      { status: 500 }
    );
  }
}
