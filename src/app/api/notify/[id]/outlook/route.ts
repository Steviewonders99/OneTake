import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';
import { createNotification } from '@/lib/db/notifications';
import { sendOutlookNotification } from '@/lib/notifications/outlook';

export async function POST(
  request: Request,
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

    const body = await request.json();
    const recipientEmail = body.to as string | undefined;

    if (!recipientEmail) {
      return Response.json(
        { error: 'to (email address) is required' },
        { status: 400 }
      );
    }

    const assets = await getAssetsByRequestId(id);

    const sent = await sendOutlookNotification({
      to: recipientEmail,
      subject: `Creative assets ready for review: ${intakeRequest.title}`,
      body: `${intakeRequest.title} has ${assets.length} creative variants ready for review. Urgency: ${intakeRequest.urgency}.`,
    });

    // Create notification record
    const notification = await createNotification({
      request_id: id,
      channel: 'outlook',
      recipient: recipientEmail,
      status: sent ? 'delivered' : 'failed',
      payload: {
        title: intakeRequest.title,
        urgency: intakeRequest.urgency,
        creative_count: assets.length,
        to: recipientEmail,
      },
    });

    return Response.json(notification);
  } catch (error) {
    console.error('[api/notify/[id]/outlook] Failed to send Outlook notification:', error);
    return Response.json(
      { error: 'Failed to send Outlook notification' },
      { status: 500 }
    );
  }
}
