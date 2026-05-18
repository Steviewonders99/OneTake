import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAliases, addAlias } from '@/lib/db/projects';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const aliases = await listAliases(id);
  return NextResponse.json(aliases);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  if (!body.alias) {
    return NextResponse.json({ error: 'alias required' }, { status: 400 });
  }

  const alias = await addAlias(id, body.alias, body.source, body.confidence);
  return NextResponse.json(alias, { status: 201 });
}
