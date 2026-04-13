import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

const VALID_SCOPES = ["campaign", "persona", "version"] as const;
type PushScope = (typeof VALID_SCOPES)[number];

/**
 * POST /api/figma/push
 *
 * Saves a pending push to the campaign's figma_sync JSONB.
 * The Figma plugin polls GET /api/figma/push?request_id=... to find work.
 *
 * Body: { request_id: string, scope: "campaign"|"persona"|"version", persona?: string, version?: string }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    request_id?: unknown;
    scope?: unknown;
    persona?: unknown;
    version?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { request_id, scope, persona, version } = body;

  if (!request_id || typeof request_id !== "string") {
    return Response.json({ error: "request_id is required" }, { status: 400 });
  }

  if (!scope || typeof scope !== "string") {
    return Response.json({ error: "scope is required" }, { status: 400 });
  }

  if (!VALID_SCOPES.includes(scope as PushScope)) {
    return Response.json(
      { error: "scope must be campaign, persona, or version" },
      { status: 400 },
    );
  }

  const sql = getDb();

  // Read current figma_sync state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[];
  try {
    rows = await sql`
      SELECT figma_sync FROM intake_requests WHERE id = ${request_id}
    `;
  } catch (err: unknown) {
    // If the column doesn't exist, add it and retry
    const errMsg = err instanceof Error ? err.message : String(err);
    const isColumnMissing =
      errMsg.includes("column") && errMsg.includes("figma_sync");

    if (isColumnMissing) {
      try {
        await sql`
          ALTER TABLE intake_requests
          ADD COLUMN IF NOT EXISTS figma_sync JSONB DEFAULT NULL
        `;
        rows = await sql`
          SELECT figma_sync FROM intake_requests WHERE id = ${request_id}
        `;
      } catch (altErr: unknown) {
        console.error("[api/figma/push] ALTER TABLE failed:", altErr);
        return Response.json(
          { error: "Failed to read campaign state" },
          { status: 500 },
        );
      }
    } else {
      console.error("[api/figma/push] DB SELECT failed:", err);
      return Response.json(
        { error: "Failed to read campaign state" },
        { status: 500 },
      );
    }
  }

  if (rows.length === 0) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const currentSync = (rows[0].figma_sync || {}) as Record<string, unknown>;
  const pendingPushes = (
    Array.isArray(currentSync.pending_pushes) ? currentSync.pending_pushes : []
  ) as Array<Record<string, unknown>>;

  // Append new pending push
  const newPush = {
    scope: scope as PushScope,
    persona: typeof persona === "string" ? persona : null,
    version: typeof version === "string" ? version : null,
    timestamp: new Date().toISOString(),
    pushed_by: userId,
  };
  pendingPushes.push(newPush);

  const updatedSync = { ...currentSync, pending_pushes: pendingPushes };

  try {
    await sql`
      UPDATE intake_requests
      SET figma_sync = ${JSON.stringify(updatedSync)}::jsonb
      WHERE id = ${request_id}
    `;
  } catch (err: unknown) {
    console.error("[api/figma/push] DB UPDATE failed:", err);
    return Response.json(
      { error: "Failed to save pending push" },
      { status: 500 },
    );
  }

  return Response.json({
    success: true,
    pending_count: pendingPushes.length,
    push: { scope: scope as PushScope, persona: newPush.persona, version: newPush.version },
  });
}

/**
 * GET /api/figma/push?request_id=...
 *
 * Returns pending pushes for a campaign.
 * Unauthenticated — the Figma plugin polls this endpoint with its own token,
 * not a Clerk session.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("request_id");

  if (!requestId) {
    return Response.json({ error: "request_id required" }, { status: 400 });
  }

  const sql = getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[];
  try {
    rows = await sql`
      SELECT figma_sync FROM intake_requests WHERE id = ${requestId}
    `;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isColumnMissing =
      errMsg.includes("column") && errMsg.includes("figma_sync");

    if (isColumnMissing) {
      // Column doesn't exist yet — return empty pending list, no ALTER needed here
      return Response.json({ pending_pushes: [] });
    }

    console.error("[api/figma/push GET] DB SELECT failed:", err);
    return Response.json(
      { error: "Failed to read pending pushes" },
      { status: 500 },
    );
  }

  if (rows.length === 0) {
    return Response.json({ pending_pushes: [] });
  }

  const sync = (rows[0].figma_sync || {}) as Record<string, unknown>;
  const pendingPushes = Array.isArray(sync.pending_pushes)
    ? sync.pending_pushes
    : [];

  return Response.json({ pending_pushes: pendingPushes });
}
