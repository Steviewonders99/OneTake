import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getClickDensity } from '@/lib/hie/query';

export async function GET(req: NextRequest) {
  await requireAuth();
  const pageUrl = req.nextUrl.searchParams.get('page_url');
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const gridSize = parseInt(req.nextUrl.searchParams.get('grid_size') || '50');
  const cells = await getClickDensity(pageUrl, gridSize);
  return NextResponse.json({ page_url: pageUrl, grid_size: gridSize, cells });
}
