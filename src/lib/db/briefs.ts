import { getDb } from '../db';
import type { BrandPillar, CreativeBrief, DerivedRequirements } from '@/lib/types';

export async function createBrief(data: {
  request_id: string;
  brief_data: Record<string, unknown>;
  channel_research?: Record<string, unknown> | null;
  design_direction?: Record<string, unknown> | null;
  content_languages?: string[];
  evaluation_score?: number | null;
  evaluation_data?: Record<string, unknown> | null;
  version?: number;
  pillar_primary?: BrandPillar | null;
  pillar_secondary?: BrandPillar | null;
  derived_requirements?: DerivedRequirements | null;
}): Promise<CreativeBrief> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO creative_briefs (
      request_id, brief_data, channel_research, design_direction,
      content_languages, evaluation_score, evaluation_data, version,
      pillar_primary, pillar_secondary, derived_requirements
    )
    VALUES (
      ${data.request_id},
      ${JSON.stringify(data.brief_data)},
      ${data.channel_research ? JSON.stringify(data.channel_research) : null},
      ${data.design_direction ? JSON.stringify(data.design_direction) : null},
      ${data.content_languages ?? []},
      ${data.evaluation_score ?? null},
      ${data.evaluation_data ? JSON.stringify(data.evaluation_data) : null},
      ${data.version ?? 1},
      ${data.pillar_primary ?? null},
      ${data.pillar_secondary ?? null},
      ${data.derived_requirements ? JSON.stringify(data.derived_requirements) : null}
    )
    RETURNING *
  `;
  return rows[0] as CreativeBrief;
}

export async function getBriefByRequestId(requestId: string): Promise<CreativeBrief | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM creative_briefs
    WHERE request_id = ${requestId}
    ORDER BY version DESC
    LIMIT 1
  `;
  return (rows[0] as CreativeBrief) ?? null;
}

export async function updateBrief(
  id: string,
  data: Partial<{
    brief_data: Record<string, unknown>;
    channel_research: Record<string, unknown> | null;
    design_direction: Record<string, unknown> | null;
    content_languages: string[];
    evaluation_score: number | null;
    evaluation_data: Record<string, unknown> | null;
  }>
): Promise<CreativeBrief> {
  const sql = getDb();
  const rows = await sql`
    UPDATE creative_briefs
    SET
      brief_data = COALESCE(${data.brief_data ? JSON.stringify(data.brief_data) : null}, brief_data),
      channel_research = COALESCE(${data.channel_research !== undefined ? JSON.stringify(data.channel_research) : null}, channel_research),
      design_direction = COALESCE(${data.design_direction !== undefined ? JSON.stringify(data.design_direction) : null}, design_direction),
      content_languages = COALESCE(${data.content_languages ?? null}, content_languages),
      evaluation_score = COALESCE(${data.evaluation_score ?? null}, evaluation_score),
      evaluation_data = COALESCE(${data.evaluation_data !== undefined ? JSON.stringify(data.evaluation_data) : null}, evaluation_data)
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) {
    throw new Error(`Creative brief not found: ${id}`);
  }
  return rows[0] as CreativeBrief;
}
