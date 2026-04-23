import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isGa4Connected } from '@/lib/audienceiq/ga4-client';

export async function GET() {
  await requireAuth();
  const connected = await isGa4Connected();
  return NextResponse.json({
    connected,
    message: connected ? 'GA4 data available in cache' : 'No GA4 data yet. Trigger a sync or configure analytics-mcp.',
  });
}
