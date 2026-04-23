import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDashboard, updateDashboard, deleteDashboard } from '@/lib/db/dashboards';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const dashboard = await getDashboard(id);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const dashboard = await updateDashboard(id, {
    title: body.title,
    description: body.description,
    layout_data: body.layout_data,
  });
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const deleted = await deleteDashboard(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
