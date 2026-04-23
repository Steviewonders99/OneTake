/**
 * HIE Fact Materialization — aggregates raw events into heat/scroll fact tables.
 */

import { getDb } from '@/lib/db';

export async function refreshHeatFacts(pageUrl: string, gridSize: number = 50): Promise<number> {
  const sql = getDb();

  // Delete existing facts for this page + today
  await sql`DELETE FROM hie_heat_facts WHERE page_url = ${pageUrl} AND fact_date = CURRENT_DATE`;

  // Aggregate from raw events
  const result = await sql`
    INSERT INTO hie_heat_facts (page_url, page_hash, event_type, grid_x, grid_y, click_count, unique_sessions, unique_visitors, element_selector, fact_date)
    SELECT
      page_url,
      page_hash,
      event_type,
      FLOOR(x::float / NULLIF(viewport_width, 0) * ${gridSize})::int as grid_x,
      FLOOR(y::float / NULLIF(viewport_height, 0) * ${gridSize})::int as grid_y,
      COUNT(*)::int,
      COUNT(DISTINCT session_id)::int,
      COUNT(DISTINCT visitor_id)::int,
      MODE() WITHIN GROUP (ORDER BY element_selector),
      CURRENT_DATE
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND event_type IN ('click_interaction', 'cta_click') AND x IS NOT NULL AND y IS NOT NULL
    GROUP BY page_url, page_hash, event_type, grid_x, grid_y
    RETURNING id
  `;

  return result.length;
}

export async function refreshScrollFacts(pageUrl: string): Promise<number> {
  const sql = getDb();

  await sql`DELETE FROM hie_scroll_facts WHERE page_url = ${pageUrl} AND fact_date = CURRENT_DATE`;

  const result = await sql`
    INSERT INTO hie_scroll_facts (page_url, page_hash, depth_band, sessions_reached, unique_visitors, avg_time_at_depth_ms, fact_date)
    SELECT
      page_url,
      page_hash,
      CASE
        WHEN scroll_percent < 10 THEN '0-10'
        WHEN scroll_percent < 20 THEN '10-20'
        WHEN scroll_percent < 30 THEN '20-30'
        WHEN scroll_percent < 40 THEN '30-40'
        WHEN scroll_percent < 50 THEN '40-50'
        WHEN scroll_percent < 60 THEN '50-60'
        WHEN scroll_percent < 70 THEN '60-70'
        WHEN scroll_percent < 80 THEN '70-80'
        WHEN scroll_percent < 90 THEN '80-90'
        ELSE '90-100'
      END,
      COUNT(DISTINCT session_id)::int,
      COUNT(DISTINCT visitor_id)::int,
      0,
      CURRENT_DATE
    FROM hie_scroll_events
    WHERE page_url = ${pageUrl}
    GROUP BY page_url, page_hash, depth_band
    RETURNING id
  `;

  return result.length;
}
