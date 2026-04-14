import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { callNIM } from '@/lib/nim';

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

    const channelResponse = await callNIM(
      'You are a media strategist specializing in digital advertising channels across global markets. Return JSON only.',
      `Given these target regions: ${intakeRequest.target_regions.join(', ')} and target languages: ${intakeRequest.target_languages.join(', ')}, provide channel recommendations per region. Include recommended platforms, optimal posting times, audience demographics, and content format preferences. Return valid JSON with a "regions" array.`,
    );

    const channelResearch = JSON.parse(channelResponse);

    return Response.json({
      request_id: id,
      channel_research: channelResearch,
    });
  } catch (error) {
    console.error('[api/generate/[id]/research] Failed:', error);
    return Response.json(
      { error: 'Failed to run channel research' },
      { status: 500 }
    );
  }
}
