import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listUnclassified, resolveUnclassified, listChannelDefinitions, createChannelDefinition, createUtmRule } from '@/lib/db/channels';

export async function GET() {
  await requireAuth();
  const items = await listUnclassified();
  const channels = await listChannelDefinitions();
  return NextResponse.json({ items, channels });
}

export async function PATCH(req: NextRequest) {
  await requireAuth();
  const body = await req.json();

  // Resolve an unclassified UTM to an existing channel
  if (body.action === 'resolve' && body.utm_id && body.channel_id) {
    const ok = await resolveUnclassified(body.utm_id, body.channel_id);

    // Optionally create a UTM rule so future hits auto-classify
    if (ok && body.create_rule && body.utm_source_pattern) {
      await createUtmRule({
        channel_id: body.channel_id,
        utm_source_pattern: body.utm_source_pattern,
        utm_medium_pattern: body.utm_medium_pattern ?? null,
        priority: body.priority ?? 5,
        extract_label_regex: body.extract_label_regex ?? null,
      });
    }

    return NextResponse.json({ ok });
  }

  // Create a brand-new channel, then resolve the UTM to it
  if (body.action === 'create_and_resolve' && body.utm_id && body.slug && body.display_name && body.category) {
    const channel = await createChannelDefinition({
      slug: body.slug,
      display_name: body.display_name,
      category: body.category,
      is_paid: body.is_paid ?? false,
    });

    const ok = await resolveUnclassified(body.utm_id, channel.id);
    return NextResponse.json({ ok, channel });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
