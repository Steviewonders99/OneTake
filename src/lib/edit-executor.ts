/**
 * Edit executor — applies edits to assets based on classified action type.
 * Handles copy_update, link_update, targeted_edit.
 * locale_add is handled separately (creates worker jobs).
 */

import { getDb } from '@/lib/db';

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || '';
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export interface EditResult {
  asset_id: string;
  success: boolean;
  error?: string;
  original_snapshot?: Record<string, unknown>;
}

/**
 * Revise copy on a single asset using Gemma 3 27B.
 * Reuses the proven revision logic from /api/revise.
 */
export async function reviseCopyAsset(
  assetId: string,
  instruction: string,
  batchId: string,
  editedBy: string,
): Promise<EditResult> {
  const sql = getDb();

  try {
    // Fetch the asset
    const rows = await sql`SELECT * FROM generated_assets WHERE id = ${assetId}::uuid`;
    if (!rows.length) return { asset_id: assetId, success: false, error: 'Asset not found' };
    const asset = rows[0];
    const content = (asset.content || {}) as Record<string, unknown>;
    const copyData = (asset.copy_data || {}) as Record<string, unknown>;

    // Snapshot original for rollback
    const originalSnapshot = { content: { ...content }, copy_data: { ...copyData } };

    // Build current copy text for the LLM
    const currentCopy = JSON.stringify({ ...copyData, ...content }, null, 2);

    const systemPrompt = `You are an elite recruitment copywriter for OneForma.
Revise the following content based on the user's instruction.
Preserve the JSON structure exactly. Only change what the instruction asks for.
Return ONLY the revised JSON, nothing else.`;

    const userPrompt = `Current content:\n${currentCopy}\n\nInstruction: ${instruction}\n\nReturn the revised JSON with the same structure.`;

    const nimRes = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!nimRes.ok) {
      const err = await nimRes.text();
      return { asset_id: assetId, success: false, error: `Gemma API failed: ${err.slice(0, 200)}` };
    }

    const nimData = await nimRes.json();
    const revisedText = nimData.choices?.[0]?.message?.content?.trim() || '';

    // Parse revised JSON
    let revisedContent: Record<string, unknown>;
    try {
      const cleaned = revisedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      revisedContent = JSON.parse(cleaned);
    } catch {
      return { asset_id: assetId, success: false, error: 'Failed to parse revised content as JSON' };
    }

    // Build edit history entry
    const historyEntry = {
      type: 'recruiter_edit',
      action_type: 'copy_update',
      instruction,
      edited_by: editedBy,
      timestamp: new Date().toISOString(),
      original_value: originalSnapshot,
      batch_id: batchId,
    };

    // Merge revised content, preserving edit_history
    const existingHistory = Array.isArray(content.edit_history) ? content.edit_history : [];
    const mergedContent = {
      ...content,
      ...revisedContent,
      edit_history: [...existingHistory, historyEntry],
    };

    // Update asset: merge revised content + increment version
    await sql`
      UPDATE generated_assets
      SET content = ${JSON.stringify(mergedContent)}::jsonb,
          version = COALESCE(version, 1) + 1
      WHERE id = ${assetId}::uuid
    `;

    return { asset_id: assetId, success: true, original_snapshot: originalSnapshot };
  } catch (e) {
    return { asset_id: assetId, success: false, error: String(e) };
  }
}

/**
 * Update link references across assets for a given request.
 * Updates form_data on the request + QR destination in flyer content.
 */
export async function updateLinksForRequest(
  requestId: string,
  newUrl: string,
  batchId: string,
  editedBy: string,
): Promise<EditResult[]> {
  const sql = getDb();
  const results: EditResult[] = [];

  // Update ada_form_url in form_data
  await sql`
    UPDATE intake_requests
    SET form_data = jsonb_set(COALESCE(form_data, '{}'::jsonb), '{ada_form_url}', ${JSON.stringify(newUrl)}::jsonb)
    WHERE id = ${requestId}::uuid
  `;

  // Find all flyer assets for this request
  const flyers = await sql`
    SELECT id, content FROM generated_assets
    WHERE request_id = ${requestId}::uuid AND asset_type = 'flyer'
  `;

  for (const flyer of flyers) {
    try {
      const content = (flyer.content || {}) as Record<string, unknown>;
      const originalSnapshot = { content: { ...content } };

      const historyEntry = {
        type: 'recruiter_edit',
        action_type: 'link_update',
        instruction: `Updated link to: ${newUrl}`,
        edited_by: editedBy,
        timestamp: new Date().toISOString(),
        original_value: originalSnapshot,
        batch_id: batchId,
      };

      const existingHistory = Array.isArray(content.edit_history) ? content.edit_history : [];

      await sql`
        UPDATE generated_assets
        SET content = ${JSON.stringify({
          ...content,
          qr_destination: newUrl,
          edit_history: [...existingHistory, historyEntry],
        })}::jsonb,
            version = COALESCE(version, 1) + 1
        WHERE id = ${flyer.id}::uuid
      `;

      results.push({ asset_id: flyer.id, success: true, original_snapshot: originalSnapshot });
    } catch (e) {
      results.push({ asset_id: flyer.id, success: false, error: String(e) });
    }
  }

  // Update tracked_links destinations
  await sql`
    UPDATE tracked_links
    SET destination_url = regexp_replace(
      destination_url,
      '^https?://[^?]+',
      ${newUrl}
    )
    WHERE request_id = ${requestId}::uuid
  `;

  return results;
}

/**
 * Rollback all assets in a batch to their pre-edit state.
 */
export async function rollbackBatch(
  requestId: string,
  batchId: string,
): Promise<number> {
  const sql = getDb();

  // Find all assets that have this batch_id in their edit_history
  const assets = await sql`
    SELECT id, content FROM generated_assets
    WHERE request_id = ${requestId}::uuid
      AND content->'edit_history' @> ${JSON.stringify([{ batch_id: batchId }])}::jsonb
  `;

  let reverted = 0;
  for (const asset of assets) {
    const content = (asset.content || {}) as Record<string, unknown>;
    const editHistory = (content.edit_history || []) as Array<Record<string, unknown>>;

    // Find the edit entry for this batch
    const batchEntry = editHistory.find((e) => e.batch_id === batchId);
    if (!batchEntry || !batchEntry.original_value) continue;

    const original = batchEntry.original_value as Record<string, Record<string, unknown>>;

    // Restore original content, remove this edit from history
    const filteredHistory = editHistory.filter((e) => e.batch_id !== batchId);

    const restoredContent = {
      ...(original.content || {}),
      edit_history: filteredHistory,
    };

    await sql`
      UPDATE generated_assets
      SET content = ${JSON.stringify(restoredContent)}::jsonb,
          copy_data = CASE
            WHEN ${JSON.stringify(original.copy_data || null)}::jsonb IS NOT NULL
            THEN ${JSON.stringify(original.copy_data || {})}::jsonb
            ELSE copy_data
          END,
          version = GREATEST(COALESCE(version, 1) - 1, 1)
      WHERE id = ${asset.id}::uuid
    `;
    reverted++;
  }

  return reverted;
}
