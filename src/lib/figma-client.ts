/**
 * Figma REST API client wrapper for Nova — SERVER-ONLY.
 *
 * Uses `figma-api` npm package for typed API calls.
 * For client-safe helpers (parseFrameName, buildFrameName, extractFileKey),
 * import from `@/lib/figma-helpers` instead.
 *
 * This module re-exports the helpers for backward compat with server routes.
 */

import { Api } from "figma-api";
import { parseFrameName } from "./figma-helpers";

// Re-export pure helpers so server routes can import from either module
export {
  parseFrameName,
  buildFrameName,
  extractFileKey,
} from "./figma-helpers";
export type { NovaFrameRouting } from "./figma-helpers";

// ── Minimal Figma type interfaces ────────────────────────────

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaFileResponse {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
}

export interface NovaFrame {
  nodeId: string;
  name: string;
  routing: import("./figma-helpers").NovaFrameRouting;
  lastModified?: string;
}

/**
 * Create a Figma API client from a personal access token.
 */
export function createFigmaClient(token: string) {
  return new Api({ personalAccessToken: token });
}

/**
 * Get all Nova-managed frames from a Figma file.
 * Walks the file tree and returns frames whose names start with "Nova_".
 */
export function extractNovaFrames(fileData: FigmaFileResponse): NovaFrame[] {
  const frames: NovaFrame[] = [];

  function walk(node: FigmaNode) {
    if (node.name.startsWith("Nova_")) {
      const routing = parseFrameName(node.name);
      if (routing) {
        frames.push({
          nodeId: node.id,
          name: node.name,
          routing,
        });
      }
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  if (fileData.document) {
    walk(fileData.document);
  }

  return frames;
}

/**
 * Diff two sets of Nova frames to find which ones are new (not previously synced).
 *
 * The sync route already checks file-level `lastModified` before calling this.
 * If lastModified changed, ALL frames are potentially changed — this function
 * filters to only frames we haven't synced before (new frames).
 *
 * For frames that existed before, the sync route re-exports them because
 * we can't tell WHICH frames changed from the file-level timestamp alone.
 * This is a known trade-off: we over-export but never miss a change.
 *
 * @param current - Nova frames found in the current file tree
 * @param previous - Map of nodeId → "synced" for previously synced frames
 * @returns Frames not in the previous map (new/unsynced frames)
 */
export function diffFrames(
  current: NovaFrame[],
  previous: Record<string, string>, // nodeId → "synced" marker
): NovaFrame[] {
  if (Object.keys(previous).length === 0) {
    // No previous state — all frames are new
    return current;
  }
  // Return frames NOT in previous (new frames only)
  // When file lastModified changed, the sync route re-exports everything
  // regardless — this filter is for the initial import case
  return current.filter((frame) => !(frame.nodeId in previous));
}

/**
 * Export specific frames as PNG from a Figma file.
 * Returns a map of nodeId → PNG URL.
 */
export async function exportFramesAsPng(
  api: Api,
  fileKey: string,
  nodeIds: string[],
  scale: number = 2,
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};

  const result = await api.getImages(
    { file_key: fileKey },
    { ids: nodeIds.join(","), format: "png", scale },
  );

  const urls: Record<string, string> = {};
  const images = result.images as Record<string, string | null> | undefined;
  if (images) {
    for (const [id, url] of Object.entries(images)) {
      if (url) urls[id] = url;
    }
  }
  return urls;
}
