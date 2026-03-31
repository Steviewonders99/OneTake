import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { asset_id, edit_prompt, image_url } = await request.json();
  if (!edit_prompt || !image_url) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'bytedance-seed/seedream-4.5',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: edit_prompt },
            { type: 'image_url', image_url: { url: image_url } },
          ],
        }],
        max_tokens: 4096,
      }),
    });

    const data = await res.json();
    return Response.json({ asset_id, result: data });
  } catch (error) {
    console.error('[api/designer/edit] Seedream API failed:', error);
    return Response.json({ error: 'Seedream API failed' }, { status: 502 });
  }
}
