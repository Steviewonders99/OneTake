import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isProxyEnabled } from '@/lib/db-proxy';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;

  if (isProxyEnabled()) {
    const PROXY_URL = process.env.DB_PROXY_URL!;
    const PROXY_SECRET = process.env.DB_PROXY_SECRET ?? '';
    const res = await fetch(`${PROXY_URL}/projects/${id}/locales`, {
      headers: { Authorization: `Bearer ${PROXY_SECRET}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    return NextResponse.json(await res.json());
  }

  const sql = getDb();
  const rows = await sql`
    SELECT language, apply_url, platform_request_id, is_active, first_seen_at, last_seen_at
    FROM project_locale_links WHERE project_id = ${id} ORDER BY language
  `;
  return NextResponse.json(rows);
}
