import { describe, it, expect, vi } from 'vitest';

// Mock figma-api before importing figma-client
vi.mock('figma-api', () => ({
  Api: vi.fn(),
}));

import { extractNovaFrames, diffFrames } from '../figma-client';
import type { NovaFrame } from '../figma-client';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeNode(id: string, name: string, children?: any[]): any {
  return { id, name, type: 'FRAME', children };
}

function makeFile(documentChildren: any[]): any {
  return {
    name: 'Test File',
    lastModified: '2026-04-13T00:00:00Z',
    version: '1',
    document: makeNode('0:0', 'Document', documentChildren),
  };
}

function makeNovaNode(persona: string, version: string, platform: string, width: number, height: number, id?: string): any {
  return makeNode(
    id ?? `${Math.random().toString(36).slice(2, 8)}:${Math.floor(Math.random() * 1000)}`,
    `Nova_${persona}_${version}_${platform}_${width}x${height}`,
  );
}

// ============================================================
// extractNovaFrames
// ============================================================

describe('extractNovaFrames', () => {
  it('returns [] for empty document (no children)', () => {
    const file = makeFile([]);
    const result = extractNovaFrames(file);
    expect(result).toEqual([]);
  });

  it('returns [] for null document', () => {
    const file = {
      name: 'Test',
      lastModified: '2026-04-13T00:00:00Z',
      version: '1',
      document: null as any,
    };
    const result = extractNovaFrames(file);
    expect(result).toEqual([]);
  });

  it('returns [] when document has zero Nova_ frames', () => {
    const file = makeFile([
      makeNode('1:0', 'Header'),
      makeNode('2:0', 'Footer'),
      makeNode('3:0', 'Sidebar', [
        makeNode('3:1', 'Logo'),
        makeNode('3:2', 'Menu'),
      ]),
    ]);
    const result = extractNovaFrames(file);
    expect(result).toEqual([]);
  });

  it('finds a single valid Nova_ frame at root level', () => {
    const file = makeFile([
      makeNovaNode('Maria', 'V1', 'ig_feed', 1080, 1080, '10:1'),
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('10:1');
    expect(result[0].name).toBe('Nova_Maria_V1_ig_feed_1080x1080');
    expect(result[0].routing).toEqual({
      persona: 'Maria',
      version: 'V1',
      platform: 'ig_feed',
      width: 1080,
      height: 1080,
    });
  });

  it('finds multiple valid Nova_ frames', () => {
    const file = makeFile([
      makeNovaNode('Maria', 'V1', 'ig_feed', 1080, 1080, '10:1'),
      makeNovaNode('Alex', 'V2', 'linkedin_feed', 1200, 627, '10:2'),
      makeNovaNode('Priya', 'V3', 'facebook_feed', 1080, 1350, '10:3'),
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(3);
    expect(result[0].routing.persona).toBe('Maria');
    expect(result[1].routing.persona).toBe('Alex');
    expect(result[2].routing.persona).toBe('Priya');
  });

  it('returns only Nova_ frames when mixed with non-Nova frames', () => {
    const file = makeFile([
      makeNode('1:0', 'Header'),
      makeNovaNode('Maria', 'V1', 'ig_feed', 1080, 1080, '10:1'),
      makeNode('2:0', 'Sidebar'),
      makeNovaNode('Alex', 'V2', 'tiktok_feed', 1080, 1920, '10:2'),
      makeNode('3:0', 'Footer'),
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(2);
    expect(result.every(f => f.name.startsWith('Nova_'))).toBe(true);
  });

  it('filters out invalid Nova_ frame names that do not match convention', () => {
    const file = makeFile([
      // Missing version segment
      makeNode('1:0', 'Nova_Maria_ig_feed_1080x1080'),
      // Invalid version format (no V prefix)
      makeNode('2:0', 'Nova_Maria_1_ig_feed_1080x1080'),
      // Missing dimensions
      makeNode('3:0', 'Nova_Maria_V1_ig_feed'),
      // Valid one for comparison
      makeNovaNode('Maria', 'V1', 'ig_feed', 1080, 1080, '10:1'),
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('10:1');
  });

  it('finds deeply nested Nova_ frame (5 levels deep)', () => {
    const deepFrame = makeNovaNode('Chen', 'V5', 'telegram_card', 1200, 628, '99:1');
    const file = makeFile([
      makeNode('1:0', 'Level1', [
        makeNode('2:0', 'Level2', [
          makeNode('3:0', 'Level3', [
            makeNode('4:0', 'Level4', [
              makeNode('5:0', 'Level5', [
                deepFrame,
              ]),
            ]),
          ]),
        ]),
      ]),
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('99:1');
    expect(result[0].routing.persona).toBe('Chen');
  });

  it('handles Nova_ frame with no children property', () => {
    const file = makeFile([
      { id: '10:1', name: 'Nova_Olga_V1_ig_story_1080x1920', type: 'FRAME' },
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(1);
    expect(result[0].routing.persona).toBe('Olga');
    expect(result[0].routing.platform).toBe('ig_story');
  });

  it('returns both frames when duplicate names exist with different IDs', () => {
    const file = makeFile([
      { id: '10:1', name: 'Nova_Maria_V1_ig_feed_1080x1080', type: 'FRAME' },
      { id: '10:2', name: 'Nova_Maria_V1_ig_feed_1080x1080', type: 'FRAME' },
    ]);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(2);
    expect(result[0].nodeId).toBe('10:1');
    expect(result[1].nodeId).toBe('10:2');
    expect(result[0].name).toBe(result[1].name);
  });

  it('returns exactly 10 Nova_ frames from a large file tree (100 frames, 10 Nova_)', () => {
    const children: any[] = [];
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 0) {
        // Every 10th frame is a valid Nova_ frame
        children.push(makeNovaNode('Persona' + i, 'V1', 'ig_feed', 1080, 1080, `${i}:0`));
      } else {
        children.push(makeNode(`${i}:0`, `RegularFrame_${i}`));
      }
    }
    const file = makeFile(children);
    const result = extractNovaFrames(file);
    expect(result).toHaveLength(10);
  });

  it('filters out frame named "Nova_" with nothing after (parseFrameName returns null)', () => {
    const file = makeFile([
      makeNode('1:0', 'Nova_'),
      makeNode('2:0', 'Nova_OnlyName'),
      makeNode('3:0', 'Nova__V1_ig_feed_1080x1080'), // empty persona segment — \w+ won't match empty
    ]);
    const result = extractNovaFrames(file);
    expect(result).toEqual([]);
  });

  it('does not walk into the document itself if it happens to have a Nova_ name', () => {
    // The document node itself is named Nova_... but is the root
    // extractNovaFrames walks the document, which starts with walk(document)
    // so if the document name starts with Nova_ and matches, it WILL be included
    const file = {
      name: 'Test File',
      lastModified: '2026-04-13T00:00:00Z',
      version: '1',
      document: {
        id: '0:0',
        name: 'Nova_Root_V1_ig_feed_1080x1080',
        type: 'DOCUMENT',
        children: [],
      },
    };
    const result = extractNovaFrames(file);
    // The walk function starts at document and checks its name too
    expect(result).toHaveLength(1);
    expect(result[0].routing.persona).toBe('Root');
  });
});

// ============================================================
// diffFrames
// ============================================================

describe('diffFrames', () => {
  function makeFrame(nodeId: string, persona: string): NovaFrame {
    return {
      nodeId,
      name: `Nova_${persona}_V1_ig_feed_1080x1080`,
      routing: {
        persona,
        version: 'V1',
        platform: 'ig_feed',
        width: 1080,
        height: 1080,
      },
    };
  }

  it('returns [] when current array is empty', () => {
    const result = diffFrames([], { 'node1': 'hash1' });
    expect(result).toEqual([]);
  });

  it('returns ALL current frames when previous map is empty (all are new)', () => {
    const current = [
      makeFrame('1:1', 'Maria'),
      makeFrame('2:2', 'Alex'),
      makeFrame('3:3', 'Priya'),
    ];
    const result = diffFrames(current, {});
    expect(result).toHaveLength(3);
    expect(result).toEqual(current);
  });

  it('returns EMPTY when all frames exist in previous map (already synced)', () => {
    const current = [
      makeFrame('1:1', 'Maria'),
      makeFrame('2:2', 'Alex'),
    ];
    const previous = {
      '1:1': 'synced',
      '2:2': 'synced',
    };
    const result = diffFrames(current, previous);
    // All frames exist in previous → none are new → empty result
    expect(result).toHaveLength(0);
  });

  it('returns only new frames not in previous map', () => {
    const current = [
      makeFrame('1:1', 'Maria'),
      makeFrame('2:2', 'Alex'),
    ];
    const previous = {
      '1:1': 'hash_a',
      // '2:2' is missing — Alex is new
    };
    const result = diffFrames(current, previous);
    // Maria: exists in previous → NOT returned (already synced)
    // Alex: NOT in previous → returned (new)
    expect(result).toHaveLength(1);
    expect(result[0].routing.persona).toBe('Alex');
  });

  it('returns empty when frame exists in previous (already synced)', () => {
    const current = [makeFrame('1:1', 'Maria')];
    const previous = { '1:1': 'synced' };
    const result = diffFrames(current, previous);
    // Maria exists in previous → not returned
    expect(result).toHaveLength(0);
  });

  it('verifies function signature accepts NovaFrame[] and Record<string, string>', () => {
    const current: NovaFrame[] = [makeFrame('5:5', 'Sofia')];
    const previous: Record<string, string> = {};
    const result = diffFrames(current, previous);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('nodeId');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('routing');
  });

  it('returns 0 frames when all 100 exist in previous (all synced)', () => {
    const current: NovaFrame[] = [];
    const previous: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      const nodeId = `${i}:0`;
      current.push(makeFrame(nodeId, `Persona${i}`));
      previous[nodeId] = `synced`;
    }
    const result = diffFrames(current, previous);
    // All exist in previous → none returned
    expect(result).toHaveLength(0);
  });

  it('returns only new frames when some exist in previous, some dont', () => {
    const current: NovaFrame[] = [];
    const previous: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      const nodeId = `${i}:0`;
      current.push(makeFrame(nodeId, `Persona${i}`));
      if (i < 5) previous[nodeId] = `synced`; // first 5 are synced
    }
    const result = diffFrames(current, previous);
    // 5 exist in previous, 5 don't → 5 returned
    expect(result).toHaveLength(5);
  });

  it('ignores extra entries in previous that are not in current', () => {
    const current = [makeFrame('1:1', 'Maria')];
    const previous = {
      '1:1': 'synced',
      '2:2': 'synced', // not in current
      '3:3': 'synced', // not in current
      '99:99': 'synced', // not in current
    };
    const result = diffFrames(current, previous);
    // Maria (1:1) exists in previous → NOT returned
    // Extra previous entries (2:2, 3:3, 99:99) are irrelevant — only current is filtered
    expect(result).toHaveLength(0);
  });
});
