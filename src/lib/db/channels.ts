// src/lib/db/channels.ts — Channel definitions, UTM rules, links, unclassified
import { getDb } from '@/lib/db';
import type {
  ChannelDefinition,
  UtmChannelRule,
  ProjectChannelLink,
  UnclassifiedUtm,
  ChannelLinkSuggestion,
} from '@/lib/types/projects';

// ── Channel Definitions ───────────────────────────────────────────

export async function listChannelDefinitions(): Promise<ChannelDefinition[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM channel_definitions
    ORDER BY category, slug
  `;
  return rows as ChannelDefinition[];
}

export async function createChannelDefinition(data: {
  slug: string;
  display_name: string;
  category: string;
  is_paid?: boolean;
  icon?: string;
}): Promise<ChannelDefinition> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO channel_definitions (slug, display_name, category, is_paid, icon)
    VALUES (
      ${data.slug},
      ${data.display_name},
      ${data.category},
      ${data.is_paid ?? false},
      ${data.icon ?? null}
    )
    RETURNING *
  `;
  return rows[0] as ChannelDefinition;
}

// ── UTM Rules ─────────────────────────────────────────────────────

export async function listUtmRules(channelId?: string): Promise<UtmChannelRule[]> {
  const sql = getDb();

  if (channelId) {
    const rows = await sql`
      SELECT * FROM utm_channel_rules
      WHERE channel_id = ${channelId}
      ORDER BY priority DESC
    `;
    return rows as UtmChannelRule[];
  }

  const rows = await sql`
    SELECT * FROM utm_channel_rules
    ORDER BY priority DESC
  `;
  return rows as UtmChannelRule[];
}

export async function createUtmRule(data: {
  channel_id: string;
  utm_source_pattern?: string;
  utm_medium_pattern?: string;
  utm_campaign_pattern?: string;
  priority?: number;
  extract_label_regex?: string;
  notes?: string;
}): Promise<UtmChannelRule> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO utm_channel_rules (
      channel_id, utm_source_pattern, utm_medium_pattern,
      utm_campaign_pattern, priority, extract_label_regex, notes
    )
    VALUES (
      ${data.channel_id},
      ${data.utm_source_pattern ?? null},
      ${data.utm_medium_pattern ?? null},
      ${data.utm_campaign_pattern ?? null},
      ${data.priority ?? 0},
      ${data.extract_label_regex ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `;
  return rows[0] as UtmChannelRule;
}

// ── UTM Resolution ────────────────────────────────────────────────

export async function resolveUtm(
  source: string,
  medium: string,
  campaign?: string,
): Promise<{
  channel_slug: string;
  channel_name: string;
  category: string;
  extracted_label: string | null;
  confidence: number;
} | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM resolve_utm_channel(${source}, ${medium}, ${campaign ?? null})
  `;
  if (rows.length === 0) return null;
  return rows[0] as {
    channel_slug: string;
    channel_name: string;
    category: string;
    extracted_label: string | null;
    confidence: number;
  };
}

// ── Channel Links ─────────────────────────────────────────────────

export async function listChannelLinks(projectId: string): Promise<ProjectChannelLink[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      pcl.*,
      cd.slug   AS channel_slug,
      cd.display_name AS channel_name,
      cd.category
    FROM project_channel_links pcl
    JOIN channel_definitions cd ON cd.id = pcl.channel_id
    WHERE pcl.project_id = ${projectId}
    ORDER BY cd.category, pcl.confidence DESC
  `;
  return rows as ProjectChannelLink[];
}

export async function createChannelLink(data: {
  project_id: string;
  channel_id: string;
  external_id: string;
  external_name?: string;
  extracted_label?: string;
  match_method?: string;
  confidence?: number;
  confirmed?: boolean;
}): Promise<ProjectChannelLink> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO project_channel_links (
      project_id, channel_id, external_id, external_name,
      extracted_label, match_method, confidence, confirmed_at
    )
    VALUES (
      ${data.project_id},
      ${data.channel_id},
      ${data.external_id},
      ${data.external_name ?? null},
      ${data.extracted_label ?? null},
      ${data.match_method ?? 'manual'},
      ${data.confidence ?? 1.0},
      ${data.confirmed ? sql`NOW()` : null}
    )
    ON CONFLICT (channel_id, external_id) DO UPDATE SET
      confidence = GREATEST(project_channel_links.confidence, EXCLUDED.confidence),
      confirmed_at = COALESCE(project_channel_links.confirmed_at, EXCLUDED.confirmed_at)
    RETURNING *
  `;
  return rows[0] as ProjectChannelLink;
}

export async function confirmChannelLink(linkId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE project_channel_links
    SET confirmed_at = NOW()
    WHERE id = ${linkId} AND confirmed_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function dismissChannelLink(linkId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    DELETE FROM project_channel_links
    WHERE id = ${linkId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function suggestChannelLinks(minSimilarity = 0.3): Promise<ChannelLinkSuggestion[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM suggest_channel_links(${minSimilarity})
  `;
  return rows as ChannelLinkSuggestion[];
}

// ── Unclassified UTMs ─────────────────────────────────────────────

export async function listUnclassified(): Promise<UnclassifiedUtm[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM unclassified_channels_pending
  `;
  return rows as UnclassifiedUtm[];
}

export async function resolveUnclassified(utmId: string, channelId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE unclassified_utm_log
    SET resolved = TRUE,
        resolved_to = ${channelId},
        resolved_at = NOW()
    WHERE id = ${utmId}
    RETURNING id
  `;
  return rows.length > 0;
}
