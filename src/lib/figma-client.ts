/**
 * Figma REST API client wrapper for Nova.
 *
 * Uses `figma-api` npm package for typed API calls.
 * Provides Nova-specific helpers: frame name parsing, diff detection,
 * image export, and sync state management.
 */

import { Api } from "figma-api";

// ── Minimal Figma type interfaces ────────────────────────────
// The @figma/rest-api-spec package is a transitive dependency not
// directly importable in pnpm. We define the subset we need here.

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

// ── Frame Name Convention ────────────────────────────────────
// Nova_{PersonaFirstName}_{Version}_{Platform}_{Width}x{Height}
// Example: Nova_Maria_V1_ig_feed_1080x1080

export interface NovaFrameRouting {
  persona: string;
  version: string;
  platform: string;
  width: number;
  height: number;
}

export interface NovaFrame {
  nodeId: string;
  name: string;
  routing: NovaFrameRouting;
  lastModified?: string;
}

/**
 * Parse a Figma frame name into routing metadata.
 * Returns null if the name doesn't match the Nova convention.
 */
export function parseFrameName(name: string): NovaFrameRouting | null {
  // Nova_Maria_V1_ig_feed_1080x1080
  const match = /^Nova_(\w+)_(V\d+)_([a-z_]+)_(\d+)x(\d+)$/.exec(name);
  if (!match) return null;
  return {
    persona: match[1],
    version: match[2],
    platform: match[3],
    width: parseInt(match[4], 10),
    height: parseInt(match[5], 10),
  };
}

/**
 * Build a Nova frame name from routing metadata.
 */
export function buildFrameName(routing: NovaFrameRouting): string {
  return `Nova_${routing.persona}_${routing.version}_${routing.platform}_${routing.width}x${routing.height}`;
}

/**
 * Create a Figma API client from a personal access token.
 */
export function createFigmaClient(token: string) {
  return new Api({ personalAccessToken: token });
}

/**
 * Extract the file key from a Figma URL.
 * Supports: https://www.figma.com/file/KEY/Name and https://www.figma.com/design/KEY/Name
 */
export function extractFileKey(url: string): string | null {
  const match = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/.exec(url);
  return match ? match[2] : null;
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
 * Diff two sets of Nova frames to find which ones changed.
 * Compares by node ID — if a frame exists in both but has different
 * content (detected by Figma's version field), it's considered changed.
 */
export function diffFrames(
  current: NovaFrame[],
  previous: Record<string, string>, // nodeId → last known hash/version
): NovaFrame[] {
  return current.filter((frame) => {
    const prevHash = previous[frame.nodeId];
    // If we don't have a previous hash, it's new (count as changed)
    // If we do, we'll compare after image export (hash the PNG)
    return !prevHash || prevHash !== frame.nodeId; // simplified — real diff uses image hashes
  });
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
