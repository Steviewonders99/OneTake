// src/app/api/projects/seed/route.ts — Retroactive seed trigger
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { linkIntakeToProjects, discoverAliases } from '@/lib/db/projects';
import { suggestChannelLinks } from '@/lib/db/channels';

export async function POST() {
  await requireRole(['admin']);
  const sql = getDb();
  const results: { step: string; result: string }[] = [];

  // Step 1: Count projects
  const projectCount = await sql`SELECT count(*)::int AS count FROM projects`;
  results.push({ step: 'projects_count', result: `${projectCount[0].count} projects in registry` });

  // Step 2: Discover alias candidates
  const aliases = await discoverAliases(0.35);
  results.push({ step: 'alias_discovery', result: `${aliases.length} alias candidates found` });

  // Step 3: Link intake_requests
  const intakeLinked = await linkIntakeToProjects();
  results.push({ step: 'intake_linking', result: `${intakeLinked} intake_requests linked to projects` });

  // Step 4: Suggest channel links
  const suggestions = await suggestChannelLinks(0.3);
  results.push({ step: 'channel_suggestions', result: `${suggestions.length} channel link candidates found` });

  // Step 5: Refresh materialized view
  try {
    await sql`REFRESH MATERIALIZED VIEW project_weekly_summary`;
    results.push({ step: 'materialized_view', result: 'project_weekly_summary refreshed' });
  } catch {
    results.push({ step: 'materialized_view', result: 'skipped (view may not exist yet)' });
  }

  return NextResponse.json({
    results,
    review: {
      aliases: aliases.slice(0, 20),
      channel_suggestions: suggestions.slice(0, 20),
    },
  });
}
