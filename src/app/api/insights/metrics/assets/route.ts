import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const [totalRow, byType, byPlatform, passRate] = recruiterId
    ? await Promise.all([
        sql`SELECT COUNT(*)::int as total FROM generated_assets WHERE request_id IN (SELECT id FROM intake_requests WHERE created_by = ${recruiterId})`,
        sql`SELECT asset_type, COUNT(*)::int as count FROM generated_assets WHERE request_id IN (SELECT id FROM intake_requests WHERE created_by = ${recruiterId}) GROUP BY asset_type ORDER BY count DESC`,
        sql`SELECT platform, COUNT(*)::int as count FROM generated_assets WHERE request_id IN (SELECT id FROM intake_requests WHERE created_by = ${recruiterId}) GROUP BY platform ORDER BY count DESC`,
        sql`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE evaluation_passed = TRUE)::int as passed FROM generated_assets WHERE evaluation_score IS NOT NULL AND request_id IN (SELECT id FROM intake_requests WHERE created_by = ${recruiterId})`,
      ])
    : await Promise.all([
        sql`SELECT COUNT(*)::int as total FROM generated_assets`,
        sql`SELECT asset_type, COUNT(*)::int as count FROM generated_assets GROUP BY asset_type ORDER BY count DESC`,
        sql`SELECT platform, COUNT(*)::int as count FROM generated_assets GROUP BY platform ORDER BY count DESC`,
        sql`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE evaluation_passed = TRUE)::int as passed FROM generated_assets WHERE evaluation_score IS NOT NULL`,
      ]);

  return NextResponse.json({
    total: totalRow[0]?.total ?? 0,
    by_type: byType,
    by_platform: byPlatform,
    pass_rate: passRate[0] ?? { total: 0, passed: 0 },
  });
}
