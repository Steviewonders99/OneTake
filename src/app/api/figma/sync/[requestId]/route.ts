import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { put } from "@vercel/blob";
import {
  createFigmaClient,
  extractNovaFrames,
  exportFramesAsPng,
  parseFrameName,
} from "@/lib/figma-client";

// ── Types ────────────────────────────────────────────────────

interface FigmaSyncState {
  file_key: string;
  file_url: string;
  token: string;
  last_modified: string | null;
  last_synced: string | null;
  frame_hashes: Record<string, string>;
  sync_enabled: boolean;
}

interface AssetRow {
  id: string;
  blob_url: string | null;
  content: Record<string, string | number | undefined> | null;
  platform: string;
}

interface SyncedFrame {
  frame_name: string;
  asset_id: string;
  original_url: string | null;
  new_url: string;
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Download a PNG from a Figma-provided URL and return the raw bytes.
 */
async function downloadPng(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw new Error(`Failed to download PNG: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Match a frame to a DB asset by platform (+ optional persona).
 * Returns the first matching asset, or null if no match found.
 *
 * v1 strategy: match by platform first, then filter by persona name
 * if available. When multiple matches exist, log a warning and pick first.
 */
function matchFrameToAsset(
  persona: string,
  platform: string,
  assets: AssetRow[],
): AssetRow | null {
  // Filter by platform
  const platformMatches = assets.filter((a) => a.platform === platform);

  if (platformMatches.length === 0) return null;

  // Try to narrow by persona name match (actor_name starts with persona)
  const personaMatches = platformMatches.filter((a) => {
    const actorName = String(a.content?.actor_name ?? "");
    const personaField = String(a.content?.persona ?? "");
    return (
      actorName.toLowerCase().startsWith(persona.toLowerCase()) ||
      personaField.toLowerCase() === persona.toLowerCase()
    );
  });

  if (personaMatches.length > 0) {
    if (personaMatches.length > 1) {
      console.warn(
        `[figma/sync] Multiple persona matches for ${persona}/${platform}: ${personaMatches.length} found, using first`,
      );
    }
    return personaMatches[0];
  }

  // Fallback: just pick the first platform match
  if (platformMatches.length > 1) {
    console.warn(
      `[figma/sync] No persona match for ${persona}/${platform}, falling back to first of ${platformMatches.length} platform matches`,
    );
  }
  return platformMatches[0];
}

// ── Route Handler ────────────────────────────────────────────

/**
 * POST /api/figma/sync/[requestId]
 *
 * Performs one sync cycle:
 * 1. Poll Figma file for changes
 * 2. Detect changed Nova_ frames
 * 3. Export changed frames as PNG
 * 4. Download PNGs, upload to Blob, replace asset blob_urls
 * 5. Update sync state
 *
 * Returns: { synced: boolean, synced_count?, changed_frames?, reason?, errors? }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  // ── 1. Auth check ──────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;

  const sql = getDb();

  // ── 2. Fetch figma_sync state from DB ──────────────────────
  let figmaSync: FigmaSyncState | null = null;
  try {
    const rows = await sql`
      SELECT figma_sync
      FROM intake_requests
      WHERE id = ${requestId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    figmaSync = (rows[0]?.figma_sync as FigmaSyncState) ?? null;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("figma_sync") && errMsg.includes("column")) {
      return Response.json({
        synced: false,
        reason: "not_connected",
      });
    }
    console.error("[figma/sync] DB query failed:", err);
    return Response.json(
      { error: "Failed to fetch sync state" },
      { status: 500 },
    );
  }

  // ── 3. Check if connected + sync enabled ───────────────────
  if (!figmaSync || !figmaSync.file_key || !figmaSync.sync_enabled) {
    return Response.json({
      synced: false,
      reason: "not_connected",
    });
  }

  const { file_key, token, last_modified, frame_hashes } = figmaSync;

  // ── 4. Call Figma API to get file tree ─────────────────────
  let fileData: ReturnType<typeof extractNovaFrames> extends infer R
    ? R
    : never;
  let fileLastModified: string;

  try {
    const api = createFigmaClient(token);
    const rawFile = await api.getFile({ file_key });

    // Extract lastModified from the file metadata
    fileLastModified = (rawFile as { lastModified?: string }).lastModified ?? "";

    // ── 5. Check if file changed since last sync ─────────────
    if (last_modified && fileLastModified === last_modified) {
      return Response.json({
        synced: false,
        reason: "no_changes",
      });
    }

    // ── 6. Extract Nova frames ───────────────────────────────
    const novaFrames = extractNovaFrames(
      rawFile as Parameters<typeof extractNovaFrames>[0],
    );

    if (novaFrames.length === 0) {
      // Update last_modified even if no frames (file was modified but no Nova frames)
      await updateSyncState(sql, requestId, figmaSync, fileLastModified, {});
      return Response.json({
        synced: false,
        reason: "no_nova_frames",
      });
    }

    // ── 7. Determine which frames changed ────────────────────
    // For v1, since we already checked lastModified at the file level,
    // treat all frames as potentially changed. Use frame_hashes to
    // skip frames we've already synced at this file version.
    const previousHashes = frame_hashes || {};
    const changedFrames = novaFrames.filter((f) => {
      const prevHash = previousHashes[f.nodeId];
      // A frame is "changed" if we've never seen it or the file was modified
      return !prevHash || prevHash !== fileLastModified;
    });

    if (changedFrames.length === 0) {
      await updateSyncState(
        sql,
        requestId,
        figmaSync,
        fileLastModified,
        previousHashes,
      );
      return Response.json({
        synced: false,
        reason: "no_changes",
      });
    }

    // ── 8. Export changed frames as PNG ───────────────────────
    const nodeIds = changedFrames.map((f) => f.nodeId);
    let pngUrls: Record<string, string>;
    try {
      pngUrls = await exportFramesAsPng(api, file_key, nodeIds);
    } catch (exportErr) {
      console.error("[figma/sync] Failed to export frames as PNG:", exportErr);
      return Response.json(
        { error: "Figma API error: failed to export frames" },
        { status: 502 },
      );
    }

    // ── 9. Fetch all composed_creative assets for matching ───
    const allAssets = (await sql`
      SELECT id, blob_url, content, platform
      FROM generated_assets
      WHERE request_id = ${requestId}
        AND asset_type = 'composed_creative'
      ORDER BY created_at
    `) as AssetRow[];

    // ── 10. Process each exported PNG ────────────────────────
    const syncedFrames: SyncedFrame[] = [];
    const errors: string[] = [];
    const newFrameHashes: Record<string, string> = { ...previousHashes };

    for (const frame of changedFrames) {
      const pngUrl = pngUrls[frame.nodeId];
      if (!pngUrl) {
        errors.push(`No PNG URL returned for frame ${frame.name}`);
        continue;
      }

      try {
        // Parse the frame name for routing
        const routing = parseFrameName(frame.name);
        if (!routing) {
          errors.push(
            `Could not parse frame name: ${frame.name}`,
          );
          continue;
        }

        // Match frame to DB asset
        const matchedAsset = matchFrameToAsset(
          routing.persona,
          routing.platform,
          allAssets,
        );

        if (!matchedAsset) {
          errors.push(
            `No matching asset found for ${frame.name} (persona=${routing.persona}, platform=${routing.platform})`,
          );
          // Still update the hash so we don't retry next sync
          newFrameHashes[frame.nodeId] = fileLastModified;
          continue;
        }

        // Download the PNG from Figma's CDN
        const pngBuffer = await downloadPng(pngUrl);

        // Upload to Vercel Blob
        const blobFilename = `figma-sync/${requestId}/${frame.name}.png`;
        const blob = await put(blobFilename, pngBuffer, {
          access: "public",
          addRandomSuffix: true,
          contentType: "image/png",
        });

        const originalUrl = matchedAsset.blob_url;

        // Update asset blob_url in DB
        await sql`
          UPDATE generated_assets
          SET blob_url = ${blob.url},
              updated_at = NOW()
          WHERE id = ${matchedAsset.id}
        `;

        // Add edit_history entry
        const editEntry = {
          action: "figma_sync",
          timestamp: new Date().toISOString(),
          frame_name: frame.name,
          original_url: originalUrl,
          new_url: blob.url,
          synced_by: userId,
        };

        await sql`
          UPDATE generated_assets
          SET content = jsonb_set(
            COALESCE(content, '{}'::jsonb),
            '{edit_history}',
            COALESCE(content->'edit_history', '[]'::jsonb) || ${JSON.stringify(editEntry)}::jsonb
          ),
          updated_at = NOW()
          WHERE id = ${matchedAsset.id}
        `;

        // Track success
        syncedFrames.push({
          frame_name: frame.name,
          asset_id: matchedAsset.id,
          original_url: originalUrl,
          new_url: blob.url,
        });

        // Update hash so we skip this frame next time (until file changes again)
        newFrameHashes[frame.nodeId] = fileLastModified;
      } catch (frameErr) {
        const msg =
          frameErr instanceof Error ? frameErr.message : String(frameErr);
        console.warn(
          `[figma/sync] Failed to process frame ${frame.name}:`,
          msg,
        );
        errors.push(`Failed to process ${frame.name}: ${msg}`);
        // Continue to next frame — don't crash the whole sync
      }
    }

    // ── 11. Update sync state ────────────────────────────────
    await updateSyncState(
      sql,
      requestId,
      figmaSync,
      fileLastModified,
      newFrameHashes,
    );

    console.log(
      `[figma/sync] Sync complete for ${requestId}: ${syncedFrames.length} synced, ${errors.length} errors`,
    );

    return Response.json({
      synced: true,
      synced_count: syncedFrames.length,
      changed_frames: syncedFrames.map((f) => f.frame_name),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (figmaErr) {
    console.error("[figma/sync] Figma API error:", figmaErr);
    return Response.json(
      { error: "Figma API error" },
      { status: 502 },
    );
  }
}

// ── Sync State Persistence ───────────────────────────────────

/**
 * Update the figma_sync JSONB column with new sync state.
 */
async function updateSyncState(
  sql: ReturnType<typeof getDb>,
  requestId: string,
  current: FigmaSyncState,
  lastModified: string,
  frameHashes: Record<string, string>,
) {
  const updatedState: FigmaSyncState = {
    ...current,
    last_modified: lastModified,
    last_synced: new Date().toISOString(),
    frame_hashes: frameHashes,
  };

  try {
    await sql`
      UPDATE intake_requests
      SET figma_sync = ${JSON.stringify(updatedState)},
          updated_at = NOW()
      WHERE id = ${requestId}
    `;
  } catch (err) {
    console.error("[figma/sync] Failed to update sync state:", err);
    // Non-fatal — the sync data was already applied to assets
  }
}
