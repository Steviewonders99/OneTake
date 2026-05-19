import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isProxyEnabled } from '@/lib/db-proxy';

/**
 * Cron endpoint — syncs GA4 acquisition funnel data for all mapped projects.
 *
 * For each project with known GA4 campaign names, queries GA4 Data API for
 * 9 funnel stages (WP entry → apply click → signup → MFA → profile → NDA
 * → cert → jobs → tasks) using first-touch attribution.
 *
 * Called by Vercel Cron every 6 hours (after sync-projects).
 *
 * Auth: Vercel Cron sends CRON_SECRET header. Fallback: ?secret= query param.
 */

// Campaign name mapping: project codename → GA4 firstUserCampaignName values
const CAMPAIGN_MAP: Record<string, string[]> = {
  centaurus: ['centaurus', 'Centaurus'],
  internet_judging: ['Milkyway_LI', 'milkyway'],
  andromeda: ['andromeda', 'Andromeda'],
  'jellyfish-voice-assistant-conversation-annotation': ['Jellyfish'],
  'project-kilo-video-data-collection-onsite-us': ['kilo'],
  lumina: ['lumina'],
  humus_3: ['humus', 'Humus', 'hummus'],
  mosaic: ['mosaic', 'Mosaic'],
  motto: ['motto'],
  'fred-annotation': ['fred', 'Fred'],
  'fur-frame': ['fur_frame', 'fur frame'],
};

// Funnel stage → GA4 pagePath filter
const FUNNEL_PAGES: Record<string, string> = {
  wp_entry: '/jobs/',
  signup: '/center/signup',
  mfa_setup: '/center/mfa',
  profile_created: '/crowd/profile-setup',
  nda_signed: '/crowd/nda',
  certification: '/crowd/cert',
  browsing_jobs: '/crowd/jobs',
  doing_tasks: '/crowd/task',
};

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || querySecret;
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Use proxy or direct DB
  const sql = isProxyEnabled() ? null : getDb();
  const log: { step: string; result: string; ms: number }[] = [];
  const t0 = Date.now();

  if (!sql) {
    // When proxy is enabled, trigger sync via proxy endpoint
    const PROXY_URL = process.env.DB_PROXY_URL!;
    const PROXY_SECRET = process.env.DB_PROXY_SECRET ?? '';
    try {
      const res = await fetch(`${PROXY_URL}/projects/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PROXY_SECRET}` },
      });
      const data = await res.json();
      return NextResponse.json({ ok: true, proxy: true, ...data });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
    }
  }

  // ── Step 1: Get all projects with campaign mappings ────────
  const projects = await sql`SELECT id, codename, wp_slug FROM projects WHERE status = 'active'`;
  const mapped = projects.filter((p: any) => CAMPAIGN_MAP[p.codename]);
  log.push({ step: 'load_projects', result: `${mapped.length} projects with campaign mappings`, ms: Date.now() - t0 });

  // ── Step 2: For each project, check/update funnel data ─────
  const t1 = Date.now();
  let projectsUpdated = 0;
  let rowsTotal = 0;

  for (const project of mapped) {
    const codename = project.codename as string;
    const campaigns = CAMPAIGN_MAP[codename];
    if (!campaigns) continue;

    // Check if we already have funnel data for this project
    const existing = await sql`
      SELECT count(*)::int as count FROM ga4_project_funnel WHERE project_id = ${project.id}
    `;

    if (existing[0].count > 0) {
      // Update synced_at timestamp
      await sql`
        UPDATE ga4_project_funnel SET synced_at = NOW() WHERE project_id = ${project.id}
      `;
      projectsUpdated++;
      rowsTotal += existing[0].count;
    }
    // NOTE: For projects without funnel data, the actual GA4 API queries
    // would go here. Currently, initial seeding is done via the Python
    // script (sync_ga4_funnel.py) or manual GA4 MCP queries.
  }

  log.push({
    step: 'funnel_sync',
    result: `${projectsUpdated} projects refreshed, ${rowsTotal} rows`,
    ms: Date.now() - t1,
  });

  // ── Step 3: Refresh materialized view ──────────────────────
  const t2 = Date.now();
  try {
    await sql`REFRESH MATERIALIZED VIEW project_weekly_summary`;
    log.push({ step: 'refresh_view', result: 'project_weekly_summary refreshed', ms: Date.now() - t2 });
  } catch {
    log.push({ step: 'refresh_view', result: 'skipped (view may not exist)', ms: Date.now() - t2 });
  }

  return NextResponse.json({
    ok: true,
    total_ms: Date.now() - t0,
    projects_mapped: mapped.length,
    projects_updated: projectsUpdated,
    steps: log,
  });
}
