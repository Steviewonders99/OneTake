import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { refreshHeatFacts, refreshScrollFacts } from '@/lib/hie/facts';

export async function POST(req: NextRequest) {
  await requireRole(['admin']);
  const body = await req.json();
  const pageUrl = body.page_url;
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const [heatRows, scrollRows] = await Promise.all([refreshHeatFacts(pageUrl), refreshScrollFacts(pageUrl)]);
  return NextResponse.json({ page_url: pageUrl, heat_facts: heatRows, scroll_facts: scrollRows });
}
