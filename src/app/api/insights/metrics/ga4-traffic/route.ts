import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getGa4TrafficSummary, isGa4Connected } from '@/lib/audienceiq/ga4-client';

export async function GET(req: NextRequest) {
  await requireAuth();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const connected = await isGa4Connected();
  if (!connected) {
    return NextResponse.json({ connected: false, message: 'No GA4 data available.', total_sessions: 0, total_engaged: 0, total_conversions: 0, by_source: [], by_country: [], by_device: [] });
  }
  const summary = await getGa4TrafficSummary(days);
  return NextResponse.json({ connected: true, ...summary });
}
