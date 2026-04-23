import { NextRequest, NextResponse } from 'next/server';
import { registerSession } from '@/lib/hie/ingest';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ok = await registerSession(body);
  return NextResponse.json({ ok }, { status: ok ? 201 : 400 });
}
