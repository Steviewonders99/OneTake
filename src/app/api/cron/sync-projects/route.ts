import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { seedFromWp, linkIntakeToProjects, discoverAliases, addAlias } from '@/lib/db/projects';
import { suggestChannelLinks } from '@/lib/db/channels';

/**
 * Cron endpoint — syncs project registry from WordPress + auto-links channels.
 *
 * Called by Vercel Cron every 3 hours (after sync-metrics).
 * Full pipeline:
 *   1. Pull new job posts from WP REST API → seed into projects table
 *   2. Link intake_requests to projects via campaign_slug
 *   3. Auto-confirm high-confidence alias discoveries
 *   4. Auto-confirm high-confidence channel links
 *   5. Refresh project_weekly_summary materialized view
 *
 * Auth: Vercel Cron sends CRON_SECRET header. Fallback: ?secret= query param.
 */

const WP_BASE_URL = process.env.WP_BASE_URL || 'https://www.oneforma.com';
const WP_USERNAME = process.env.WP_USERNAME || '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';
const AUTO_CONFIRM_THRESHOLD = 0.7;

interface WpJob {
  id: number;
  title: { rendered: string };
  slug: string;
  date_gmt: string;
  acf?: { apply_job?: Array<{ apply_language?: string }> };
}

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || querySecret;
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const sql = getDb();
  const log: { step: string; result: string; ms: number }[] = [];
  const t0 = Date.now();

  // ── Step 1: Pull WP jobs → seed projects ──────────────────────
  let wpSeeded = 0;
  let wpTotal = 0;
  try {
    const jobs = await fetchWpJobs();
    wpTotal = jobs.length;

    // Get existing codenames to skip already-seeded
    const existing = await sql`SELECT codename FROM projects`;
    const existingSet = new Set(existing.map((r: any) => r.codename));

    for (const job of jobs) {
      const codename = extractCodename(job.title.rendered, job.slug);
      if (existingSet.has(codename)) continue;

      const countries = (job.acf?.apply_job ?? [])
        .map(r => r.apply_language ?? '')
        .filter(Boolean);

      try {
        await seedFromWp({
          codename,
          display_name: decodeHtmlEntities(job.title.rendered),
          wp_job_id: job.id,
          wp_slug: job.slug,
          wp_published_at: job.date_gmt,
          countries,
        });
        wpSeeded++;
      } catch {
        // seed_project_from_wp uses ON CONFLICT — safe to skip errors
      }
    }
    log.push({ step: 'wp_sync', result: `${wpSeeded} new / ${wpTotal} total WP jobs`, ms: Date.now() - t0 });
  } catch (err) {
    log.push({ step: 'wp_sync', result: `error: ${(err as Error).message?.slice(0, 200)}`, ms: Date.now() - t0 });
  }

  // ── Step 2: Link intake_requests → projects ───────────────────
  const t1 = Date.now();
  try {
    const linked = await linkIntakeToProjects();
    log.push({ step: 'intake_link', result: `${linked} intake_requests linked`, ms: Date.now() - t1 });
  } catch (err) {
    log.push({ step: 'intake_link', result: `error: ${(err as Error).message?.slice(0, 200)}`, ms: Date.now() - t1 });
  }

  // ── Step 3: Discover + auto-confirm aliases ───────────────────
  const t2 = Date.now();
  try {
    const candidates = await discoverAliases(0.35);
    let confirmed = 0;
    for (const c of candidates) {
      if (c.similarity >= AUTO_CONFIRM_THRESHOLD) {
        await addAlias(c.project_id, c.discovered, 'fuzzy_match', c.similarity);
        confirmed++;
      }
    }
    log.push({ step: 'alias_discovery', result: `${candidates.length} found, ${confirmed} auto-confirmed (>=${AUTO_CONFIRM_THRESHOLD})`, ms: Date.now() - t2 });
  } catch (err) {
    log.push({ step: 'alias_discovery', result: `error: ${(err as Error).message?.slice(0, 200)}`, ms: Date.now() - t2 });
  }

  // ── Step 4: Suggest + auto-confirm channel links ──────────────
  const t3 = Date.now();
  try {
    const suggestions = await suggestChannelLinks(0.3);
    let autoConfirmed = 0;
    for (const s of suggestions) {
      if (s.similarity >= AUTO_CONFIRM_THRESHOLD) {
        // Auto-create confirmed link
        await sql`
          INSERT INTO project_channel_links
            (project_id, channel_id, external_id, external_name, match_method, confidence, confirmed_at)
          SELECT
            ${s.project_id},
            (SELECT id FROM channel_definitions WHERE slug = ${s.channel_type}),
            ${s.external_id},
            ${s.external_name},
            'fuzzy',
            ${s.similarity},
            NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM project_channel_links pcl
            JOIN channel_definitions cd ON cd.id = pcl.channel_id
            WHERE cd.slug = ${s.channel_type} AND pcl.external_id = ${s.external_id}
          )
        `;
        autoConfirmed++;
      }
    }
    log.push({ step: 'channel_link', result: `${suggestions.length} found, ${autoConfirmed} auto-confirmed`, ms: Date.now() - t3 });
  } catch (err) {
    log.push({ step: 'channel_link', result: `error: ${(err as Error).message?.slice(0, 200)}`, ms: Date.now() - t3 });
  }

  // ── Step 5: Sync locale links from WP ACF fields ──────────────
  const t4a = Date.now();
  try {
    const jobs = await fetchWpJobs();
    let newLinks = 0;
    let updatedLinks = 0;

    for (const job of jobs) {
      const wpId = job.id;
      const projectRows = await sql`SELECT id FROM projects WHERE wp_job_id = ${wpId}`;
      if (projectRows.length === 0) continue;
      const projectId = projectRows[0].id;

      const applyLinks = job.acf?.apply_job ?? [];
      for (const link of applyLinks) {
        const language = (link as any).language?.trim();
        const applyUrl = (link as any).apply_url?.trim();
        if (!language || !applyUrl) continue;

        // Extract requestId from URL
        let requestId: string | null = null;
        try {
          const url = new URL(applyUrl);
          requestId = url.searchParams.get('requestId');
          if (!requestId) {
            const crowdMatch = applyUrl.match(/\/crowd\/jobs\/(\d+)/);
            if (crowdMatch) requestId = `crowd_${crowdMatch[1]}`;
            const legacyMatch = url.searchParams.get('job_id');
            if (legacyMatch) requestId = `legacy_${legacyMatch}`;
          }
        } catch {}

        const result = await sql`
          INSERT INTO project_locale_links (project_id, language, apply_url, platform_request_id)
          VALUES (${projectId}, ${language}, ${applyUrl}, ${requestId})
          ON CONFLICT (project_id, language) DO UPDATE SET
            apply_url = EXCLUDED.apply_url,
            platform_request_id = COALESCE(EXCLUDED.platform_request_id, project_locale_links.platform_request_id),
            last_seen_at = NOW(), is_active = TRUE, removed_at = NULL
          RETURNING (xmax = 0) AS is_new
        `;
        if (result[0]?.is_new) newLinks++;
        else updatedLinks++;
      }
    }
    log.push({
      step: 'locale_links',
      result: `${newLinks} new, ${updatedLinks} updated`,
      ms: Date.now() - t4a,
    });
  } catch (err) {
    log.push({ step: 'locale_links', result: `error: ${(err as Error).message?.slice(0, 200)}`, ms: Date.now() - t4a });
  }

  // ── Step 6: Refresh materialized view ─────────────────────────
  const t4 = Date.now();
  try {
    await sql`REFRESH MATERIALIZED VIEW project_weekly_summary`;
    log.push({ step: 'refresh_view', result: 'project_weekly_summary refreshed', ms: Date.now() - t4 });
  } catch (err) {
    // View may not exist yet on fresh installs
    log.push({ step: 'refresh_view', result: `skipped: ${(err as Error).message?.slice(0, 100)}`, ms: Date.now() - t4 });
  }

  const totalMs = Date.now() - t0;
  return NextResponse.json({
    ok: true,
    total_ms: totalMs,
    wp_jobs: wpTotal,
    new_projects: wpSeeded,
    steps: log,
  });
}

// ── WP Fetcher ──────────────────────────────────────────────────

async function fetchWpJobs(): Promise<WpJob[]> {
  const jobs: WpJob[] = [];
  let page = 1;

  const headers: Record<string, string> = {};
  if (WP_USERNAME && WP_APP_PASSWORD) {
    headers['Authorization'] = 'Basic ' + btoa(`${WP_USERNAME}:${WP_APP_PASSWORD}`);
  }

  while (true) {
    const url = `${WP_BASE_URL}/wp-json/wp/v2/job?per_page=100&page=${page}&status=publish`;
    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) break;

    const batch: WpJob[] = await res.json();
    if (!batch.length) break;

    jobs.push(...batch);
    page++;

    // Safety: max 500 jobs
    if (jobs.length >= 500) break;
  }

  return jobs;
}

// ── Codename Extractor ──────────────────────────────────────────

function extractCodename(title: string, slug: string): string {
  const decoded = decodeHtmlEntities(title);

  // Check for separator-based codename: "Centaurus — MFA ..."
  for (const sep of ['\u2014', '\u2013', ' - ', ':']) {
    if (decoded.includes(sep)) {
      const candidate = decoded.split(sep)[0].trim().toLowerCase()
        .replace(/[^a-z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      if (candidate.length >= 3) return candidate;
    }
  }

  // Fall back to slug, strip common suffixes
  return slug
    .replace(/-(job|position|role|hiring|apply|oneforma|2026|2025)$/g, '')
    .toLowerCase();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}
