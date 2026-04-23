import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

export async function POST() {
  await requireRole(['admin']);
  return NextResponse.json({
    success: false,
    message: 'GA4 sync not yet configured. Connect analytics-mcp with a GA4 property ID to enable.',
    synced: 0,
  });
}
