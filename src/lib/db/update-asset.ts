import { getDb } from "../db";

/**
 * Partially update an asset's content and/or copy_data JSONB fields.
 * Uses Postgres || operator for shallow merge (preserves existing keys).
 */
export async function updateAssetFields(
  id: string,
  updates: {
    content?: Record<string, unknown>;
    copy_data?: Record<string, unknown>;
  },
): Promise<{ id: string; content: Record<string, unknown>; copy_data: Record<string, unknown> } | null> {
  const sql = getDb();

  const contentJson = updates.content ? JSON.stringify(updates.content) : null;
  const copyDataJson = updates.copy_data ? JSON.stringify(updates.copy_data) : null;

  const rows = await sql`
    UPDATE generated_assets
    SET
      content = CASE
        WHEN ${contentJson}::jsonb IS NOT NULL
        THEN COALESCE(content, '{}'::jsonb) || ${contentJson}::jsonb
        ELSE content
      END,
      copy_data = CASE
        WHEN ${copyDataJson}::jsonb IS NOT NULL
        THEN COALESCE(copy_data, '{}'::jsonb) || ${copyDataJson}::jsonb
        ELSE copy_data
      END
    WHERE id = ${id}
    RETURNING id, content, copy_data
  `;

  if (rows.length === 0) return null;
  return rows[0] as { id: string; content: Record<string, unknown>; copy_data: Record<string, unknown> };
}
