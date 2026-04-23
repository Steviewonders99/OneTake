/**
 * HIE Query — click density and scroll depth from facts or raw events.
 */

import { getDb } from '@/lib/db';

export interface HeatmapCell {
  grid_x: number;
  grid_y: number;
  click_count: number;
  unique_sessions: number;
}

export interface ScrollBand {
  depth_band: string;
  sessions_reached: number;
  unique_visitors: number;
  pct_of_total: number;
}

export async function getClickDensity(pageUrl: string, gridSize: number = 50): Promise<HeatmapCell[]> {
  const sql = getDb();

  // Try facts first
  const facts = await sql`
    SELECT grid_x, grid_y, SUM(click_count)::int as click_count, SUM(unique_sessions)::int as unique_sessions
    FROM hie_heat_facts WHERE page_url = ${pageUrl}
    GROUP BY grid_x, grid_y ORDER BY click_count DESC
  `;

  if (facts.length > 0) return facts as HeatmapCell[];

  // Fallback to raw events
  const raw = await sql`
    SELECT
      FLOOR(x::float / NULLIF(viewport_width, 0) * ${gridSize})::int as grid_x,
      FLOOR(y::float / NULLIF(viewport_height, 0) * ${gridSize})::int as grid_y,
      COUNT(*)::int as click_count,
      COUNT(DISTINCT session_id)::int as unique_sessions
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND event_type IN ('click_interaction', 'cta_click') AND x IS NOT NULL AND y IS NOT NULL
    GROUP BY grid_x, grid_y ORDER BY click_count DESC
  `;

  return raw as HeatmapCell[];
}

export async function getScrollDepth(pageUrl: string): Promise<ScrollBand[]> {
  const sql = getDb();

  // Try facts first
  const facts = await sql`
    SELECT depth_band, SUM(sessions_reached)::int as sessions_reached, SUM(unique_visitors)::int as unique_visitors
    FROM hie_scroll_facts WHERE page_url = ${pageUrl}
    GROUP BY depth_band ORDER BY depth_band
  `;

  if (facts.length > 0) {
    const maxSessions = Math.max(...(facts as { sessions_reached: number }[]).map(f => f.sessions_reached), 1);
    return (facts as ScrollBand[]).map(f => ({ ...f, pct_of_total: Math.round((f.sessions_reached / maxSessions) * 100) }));
  }

  // Fallback to raw events — compute depth bands
  const raw = await sql`
    SELECT
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
      END as depth_band,
      COUNT(DISTINCT session_id)::int as sessions_reached,
      COUNT(DISTINCT visitor_id)::int as unique_visitors
    FROM hie_scroll_events WHERE page_url = ${pageUrl}
    GROUP BY depth_band ORDER BY depth_band
  `;

  const maxSessions = Math.max(...(raw as { sessions_reached: number }[]).map(r => r.sessions_reached), 1);
  return (raw as ScrollBand[]).map(r => ({ ...r, pct_of_total: Math.round((r.sessions_reached / maxSessions) * 100) }));
}

export async function getTrackedPages(): Promise<{ page_url: string; event_count: number; session_count: number }[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT page_url, COUNT(*)::int as event_count, COUNT(DISTINCT session_id)::int as session_count
    FROM hie_interaction_events WHERE page_url IS NOT NULL
    GROUP BY page_url ORDER BY event_count DESC LIMIT 50
  `;
  return rows as { page_url: string; event_count: number; session_count: number }[];
}
