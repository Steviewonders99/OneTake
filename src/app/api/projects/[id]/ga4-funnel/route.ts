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
    const res = await fetch(`${PROXY_URL}/projects/${id}/ga4-funnel`, {
      headers: { Authorization: `Bearer ${PROXY_SECRET}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'Proxy error' }, { status: res.status });
    return NextResponse.json(await res.json());
  }

  const sql = getDb();
  const rows = await sql`
    SELECT campaign_name, source, medium, wp_entry, apply_click, signup, mfa_setup,
           profile_created, nda_signed, certification, browsing_jobs, doing_tasks
    FROM ga4_project_funnel WHERE project_id = ${id} ORDER BY nda_signed DESC
  `;

  const total = (key: string) => rows.reduce((s: number, r: any) => s + (r[key] ?? 0), 0);
  const tw = total('wp_entry');

  return NextResponse.json({
    by_source: rows,
    totals: {
      wp_entry: tw, apply_click: total('apply_click'), signup: total('signup'),
      mfa_setup: total('mfa_setup'),
      profile_created: total('profile_created'), nda_signed: total('nda_signed'),
      certification: total('certification'), browsing_jobs: total('browsing_jobs'),
      doing_tasks: total('doing_tasks'),
    },
    rates: {
      wp_to_signup: tw > 0 ? Math.round(total('signup') / tw * 1000) / 10 : 0,
      wp_to_profile: tw > 0 ? Math.round(total('profile_created') / tw * 1000) / 10 : 0,
      wp_to_nda: tw > 0 ? Math.round(total('nda_signed') / tw * 1000) / 10 : 0,
      wp_to_tasks: tw > 0 ? Math.round(total('doing_tasks') / tw * 1000) / 10 : 0,
      nda_to_tasks: total('nda_signed') > 0 ? Math.round(total('doing_tasks') / total('nda_signed') * 1000) / 10 : 0,
    },
  });
}
