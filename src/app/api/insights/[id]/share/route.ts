import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { toggleShare, updateShareSettings } from '@/lib/db/dashboards';
import crypto from 'crypto';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const result = await toggleShare(id);
  return NextResponse.json(result);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const updates: { password_hash?: string; expires_at?: string | null } = {};
  if (body.password) {
    updates.password_hash = crypto.createHash('sha256').update(body.password).digest('hex');
  }
  if (body.expires_in_days) {
    const d = new Date();
    d.setDate(d.getDate() + body.expires_in_days);
    updates.expires_at = d.toISOString();
  } else if (body.expires_in_days === 0) {
    updates.expires_at = null;
  }
  const dashboard = await updateShareSettings(id, updates);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard);
}
