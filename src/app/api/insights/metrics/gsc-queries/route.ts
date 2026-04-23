import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTopQueries, getTopPages, isGscConnected } from '@/lib/audienceiq/gsc-client';

export async function GET() {
  await requireAuth();
  const connected = isGscConnected();
  if (!connected) {
    return NextResponse.json({ connected: false, message: 'GSC not configured.', queries: [], pages: [] });
  }
  const [queries, pages] = await Promise.all([getTopQueries(), getTopPages()]);
  return NextResponse.json({ connected: true, queries, pages });
}
