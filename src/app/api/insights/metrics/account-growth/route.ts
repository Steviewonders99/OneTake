import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '90') || 90);
  const platform = req.nextUrl.searchParams.get('platform') || null;

  const snapshots = await sql`
    SELECT
      platform,
      account_id,
      account_name,
      follower_count,
      following_count,
      snapshot_date,
      metadata
    FROM social_account_snapshots
    WHERE snapshot_date >= CURRENT_DATE - ${days}::int
      AND (${platform}::text IS NULL OR platform = ${platform})
    ORDER BY platform ASC, snapshot_date ASC
  `;

  return NextResponse.json({ days, snapshots });
}
