import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listDashboards, createDashboard } from '@/lib/db/dashboards';

export async function GET() {
  await requireAuth();
  const dashboards = await listDashboards();
  return NextResponse.json(dashboards);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  const body = await req.json();
  const dashboard = await createDashboard(
    body.title || 'Untitled Dashboard',
    user.userId,
    body.layout_data,
    body.description,
  );
  return NextResponse.json(dashboard, { status: 201 });
}
