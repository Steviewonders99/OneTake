import { NextRequest, NextResponse } from 'next/server';
import { resolveShareToken } from '@/lib/db/dashboards';
import crypto from 'crypto';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const dashboard = await resolveShareToken(token);
  if (!dashboard) return NextResponse.json({ error: 'Not found or expired' }, { status: 404 });
  if (dashboard.password_hash) {
    return NextResponse.json({ password_required: true, title: dashboard.title }, { status: 401 });
  }
  return NextResponse.json({ title: dashboard.title, layout_data: dashboard.layout_data, view_count: dashboard.view_count });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json();
  const dashboard = await resolveShareToken(token);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (dashboard.password_hash) {
    const hash = crypto.createHash('sha256').update(body.password || '').digest('hex');
    if (hash !== dashboard.password_hash) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
  return NextResponse.json({ title: dashboard.title, layout_data: dashboard.layout_data, view_count: dashboard.view_count });
}
