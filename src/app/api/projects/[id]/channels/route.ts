import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listChannelLinks, createChannelLink, confirmChannelLink, dismissChannelLink } from '@/lib/db/channels';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const links = await listChannelLinks(id);
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  if (!body.channel_id || !body.external_id) {
    return NextResponse.json({ error: 'channel_id and external_id required' }, { status: 400 });
  }

  const link = await createChannelLink({ project_id: id, ...body });
  return NextResponse.json(link, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await requireAuth();
  const body = await req.json();

  if (body.action === 'confirm' && body.link_id) {
    const ok = await confirmChannelLink(body.link_id);
    return NextResponse.json({ ok });
  }
  if (body.action === 'dismiss' && body.link_id) {
    const ok = await dismissChannelLink(body.link_id);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'action and link_id required' }, { status: 400 });
}
