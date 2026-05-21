import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isProxyEnabled } from '@/lib/db-proxy';

export async function GET(_req: NextRequest) {
  await requireAuth();

  if (isProxyEnabled()) {
    const PROXY_URL = process.env.DB_PROXY_URL!;
    const PROXY_SECRET = process.env.DB_PROXY_SECRET ?? '';
    const qs = _req.nextUrl.search;
    const res = await fetch(`${PROXY_URL}/gsc/pages${qs}`, {
      headers: { Authorization: `Bearer ${PROXY_SECRET}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'Proxy error' }, { status: res.status });
    return NextResponse.json(await res.json());
  }

  return NextResponse.json([]);
}
