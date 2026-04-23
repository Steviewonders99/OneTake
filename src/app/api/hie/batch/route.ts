import { NextRequest, NextResponse } from 'next/server';
import { ingestBatch } from '@/lib/hie/ingest';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = Array.isArray(body) ? body : body.events;
  if (!Array.isArray(events)) return NextResponse.json({ error: 'events array required' }, { status: 400 });
  if (events.length > 100) return NextResponse.json({ error: 'max 100 events per batch' }, { status: 400 });
  const result = await ingestBatch(events);
  return NextResponse.json(result);
}
