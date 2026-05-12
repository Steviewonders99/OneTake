/**
 * GSC Client — reads search query/page data from gsc_daily_cache.
 *
 * GSC data is written to gsc_daily_cache by the Python worker's GSC sync job.
 * This module provides query functions over that cache for the frontend.
 */

import { getDb } from '@/lib/db';

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Fetch top search queries over the last 28 days from gsc_daily_cache.
 */
export async function getTopQueries(limit: number = 20): Promise<GscQueryRow[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      query,
      SUM(clicks)::int       AS clicks,
      SUM(impressions)::int  AS impressions,
      AVG(ctr)::float        AS ctr,
      AVG(position)::float   AS position
    FROM gsc_daily_cache
    WHERE date >= CURRENT_DATE - INTERVAL '28 days'
    GROUP BY query
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;
  return rows as GscQueryRow[];
}

/**
 * Fetch top pages over the last 28 days from gsc_daily_cache.
 */
export async function getTopPages(limit: number = 20): Promise<GscPageRow[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      page,
      SUM(clicks)::int       AS clicks,
      SUM(impressions)::int  AS impressions,
      AVG(ctr)::float        AS ctr,
      AVG(position)::float   AS position
    FROM gsc_daily_cache
    WHERE date >= CURRENT_DATE - INTERVAL '28 days'
    GROUP BY page
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;
  return rows as GscPageRow[];
}

/**
 * Returns true — actual connection validity is managed at the worker level.
 */
export function isGscConnected(): boolean {
  return true;
}

/**
 * Returns true if there is any data in gsc_daily_cache.
 */
export async function hasGscData(): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*)::int AS cnt FROM gsc_daily_cache`;
  return (rows[0]?.cnt ?? 0) > 0;
}
