import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { duplicateDashboard } from '@/lib/db/dashboards';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  const { id } = await params;
  const dashboard = await duplicateDashboard(id, user.userId);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard, { status: 201 });
}
