import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getScrollDepth } from '@/lib/hie/query';

export async function GET(req: NextRequest) {
  await requireAuth();
  const pageUrl = req.nextUrl.searchParams.get('page_url');
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const bands = await getScrollDepth(pageUrl);
  return NextResponse.json({ page_url: pageUrl, bands });
}
