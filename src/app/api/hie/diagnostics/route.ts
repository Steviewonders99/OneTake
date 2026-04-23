import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { runDiagnostics } from '@/lib/hie/diagnostics';

export async function GET(req: NextRequest) {
  await requireAuth();
  const pageUrl = req.nextUrl.searchParams.get('page_url');
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const observations = await runDiagnostics(pageUrl);
  return NextResponse.json({ page_url: pageUrl, observations });
}
