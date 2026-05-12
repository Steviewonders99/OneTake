import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  await requireAuth();
  const sql = getDb();

  const [metaRows, linkedinRows, redditRows, gscRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int          AS post_count,
        MAX(synced_at)         AS last_sync_at
      FROM meta_organic_cache
    `,
    sql`
      SELECT
        COUNT(*)::int          AS post_count,
        MAX(synced_at)         AS last_sync_at
      FROM linkedin_organic_cache
    `,
    sql`
      SELECT
        COUNT(*)::int          AS post_count,
        MAX(synced_at)         AS last_sync_at
      FROM reddit_organic_cache
    `,
    sql`
      SELECT
        COUNT(*)::int          AS post_count,
        MAX(synced_at)         AS last_sync_at
      FROM gsc_daily_cache
    `,
  ]);

  const platforms = [
    {
      platform: 'meta',
      connected: true,
      has_data: (metaRows[0]?.post_count ?? 0) > 0,
      last_sync_at: metaRows[0]?.last_sync_at ?? null,
      post_count: metaRows[0]?.post_count ?? 0,
    },
    {
      platform: 'linkedin',
      connected: true,
      has_data: (linkedinRows[0]?.post_count ?? 0) > 0,
      last_sync_at: linkedinRows[0]?.last_sync_at ?? null,
      post_count: linkedinRows[0]?.post_count ?? 0,
    },
    {
      platform: 'reddit',
      connected: true,
      has_data: (redditRows[0]?.post_count ?? 0) > 0,
      last_sync_at: redditRows[0]?.last_sync_at ?? null,
      post_count: redditRows[0]?.post_count ?? 0,
    },
    {
      platform: 'gsc',
      connected: true,
      has_data: (gscRows[0]?.post_count ?? 0) > 0,
      last_sync_at: gscRows[0]?.last_sync_at ?? null,
      post_count: gscRows[0]?.post_count ?? 0,
    },
  ];

  return NextResponse.json({ platforms });
}
