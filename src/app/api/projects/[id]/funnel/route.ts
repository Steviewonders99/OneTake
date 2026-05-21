import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { isProxyEnabled, proxyGetFunnel } from '@/lib/db-proxy';
import type { ProjectFunnelRow, ProjectWeeklySummary } from '@/lib/types/projects';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const view = req.nextUrl.searchParams.get('view') ?? 'weekly';

  // Use proxy when available (Azure PG via Container App)
  if (isProxyEnabled()) {
    const extra = req.nextUrl.searchParams.toString().replace(/view=[^&]*&?/, '').replace(/&$/, '');
    const data = await proxyGetFunnel(id, view, extra);
    return NextResponse.json(data);
  }

  const sql = getDb();

  if (view === 'daily') {
    const startDate = req.nextUrl.searchParams.get('start') ?? '2026-01-01';
    const endDate = req.nextUrl.searchParams.get('end') ?? '2099-12-31';
    const rows = await sql`
      SELECT * FROM project_daily_funnel
      WHERE project_id = ${id} AND date >= ${startDate}::DATE AND date <= ${endDate}::DATE
      ORDER BY date DESC
    `;
    return NextResponse.json(rows as ProjectFunnelRow[]);
  }

  // Weekly summary with WoW deltas
  const rows = await sql`
    SELECT * FROM project_weekly_summary
    WHERE project_id = ${id}
    ORDER BY week_start DESC
    LIMIT 12
  ` as ProjectWeeklySummary[];

  const current = rows[0] ?? null;
  const previous = rows[1] ?? null;

  const wow = current && previous ? {
    impressions_delta: previous.total_impressions > 0
      ? ((current.total_impressions - previous.total_impressions) / previous.total_impressions * 100)
      : null,
    clicks_delta: previous.total_clicks > 0
      ? ((current.total_clicks - previous.total_clicks) / previous.total_clicks * 100)
      : null,
    spend_delta: previous.total_spend > 0
      ? ((current.total_spend - previous.total_spend) / previous.total_spend * 100)
      : null,
    conversions_delta: previous.total_conversions > 0
      ? ((current.total_conversions - previous.total_conversions) / previous.total_conversions * 100)
      : null,
    cpa_direction: current.blended_cpa && previous.blended_cpa
      ? (current.blended_cpa > previous.blended_cpa ? 'up' : 'down')
      : null,
  } : null;

  return NextResponse.json({ weeks: rows, wow, current, previous });
}
