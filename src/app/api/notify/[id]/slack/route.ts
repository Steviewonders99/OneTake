import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';
import { createNotification } from '@/lib/db/notifications';
import { sendSlackNotification } from '@/lib/notifications/slack';

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

    const assets = await getAssetsByRequestId(id);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const approvalUrl = `${baseUrl}/intake/${id}`;
    const designerUrl = `${baseUrl}/designer/${id}`;

    const sent = await sendSlackNotification({
      requestTitle: intakeRequest.title,
      urgency: intakeRequest.urgency,
      creativeCount: assets.length,
      approvalUrl,
      designerUrl,
    });

    // Create notification record
    const notification = await createNotification({
      request_id: id,
      channel: 'slack',
      recipient: 'slack-webhook',
      status: sent ? 'delivered' : 'failed',
      payload: {
        title: intakeRequest.title,
        urgency: intakeRequest.urgency,
        creative_count: assets.length,
        approval_url: approvalUrl,
        designer_url: designerUrl,
      },
    });

    return Response.json(notification);
  } catch (error) {
    console.error('[api/notify/[id]/slack] Failed to send Slack notification:', error);
    return Response.json(
      { error: 'Failed to send Slack notification' },
      { status: 500 }
    );
  }
}
