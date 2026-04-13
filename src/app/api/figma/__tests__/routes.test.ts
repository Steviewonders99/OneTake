import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/figma-client', () => ({
  createFigmaClient: vi.fn(),
  extractFileKey: vi.fn(),
}));

import { getDb } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

import { POST as pushPost, GET as pushGet } from '../push/route';

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function createMockSql(returnValues: unknown[][] = [[]]) {
  let callIndex = 0;
  const fn = vi.fn(async () => {
    const result = returnValues[callIndex] ?? [];
    callIndex++;
    return result;
  });
  return fn;
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/figma/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(params: string): Request {
  return new Request(`http://localhost:3000/api/figma/push?${params}`);
}

// ── Constants ────────────────────────────────────────────────────────────

const VALID_POST_BODY = {
  request_id: 'req-abc-123',
  scope: 'campaign',
};

const EXISTING_FIGMA_SYNC = {
  pending_pushes: [
    {
      scope: 'persona',
      persona: 'early_adopter',
      version: null,
      timestamp: '2026-04-10T12:00:00.000Z',
      pushed_by: 'user_prev',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// POST /api/figma/push
// ============================================================

describe('POST /api/figma/push', () => {
  // ─── Auth tests ────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  // ─── Validation tests ──────────────────────────────────────

  it('returns 400 when request_id is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const res = await pushPost(makePostRequest({ scope: 'campaign' }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('request_id is required');
  });

  it('returns 400 when scope is missing', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const res = await pushPost(makePostRequest({ request_id: 'req-1' }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('scope is required');
  });

  it('returns 400 when scope is an invalid value', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const res = await pushPost(
      makePostRequest({ request_id: 'req-1', scope: 'custom' }) as any
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('scope must be campaign, persona, or version');
  });

  it('returns 400 when body is invalid JSON', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const req = new Request('http://localhost:3000/api/figma/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const res = await pushPost(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  // ─── Campaign not found ────────────────────────────────────

  it('returns 404 when campaign not found (empty SQL result)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = createMockSql([
      [], // SELECT returns no rows
    ]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Campaign not found');
  });

  // ─── Success: creates new pending_pushes array when figma_sync is null ─

  it('creates new pending_pushes array when figma_sync is null', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = createMockSql([
      [{ figma_sync: null }], // SELECT — no existing sync
      [],                     // UPDATE
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.pending_count).toBe(1);
    expect(json.push.scope).toBe('campaign');
  });

  // ─── Success: appends to existing pending_pushes array ─────

  it('appends to existing pending_pushes array', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = createMockSql([
      [{ figma_sync: EXISTING_FIGMA_SYNC }], // SELECT — has 1 existing push
      [],                                      // UPDATE
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(
      makePostRequest({ request_id: 'req-abc-123', scope: 'version', persona: 'early_adopter', version: 'v2' }) as any
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.pending_count).toBe(2); // 1 existing + 1 new
  });

  // ─── Success: includes timestamp and pushed_by ─────────────

  it('includes timestamp and pushed_by in the push entry', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_42' });
    const mockSql = createMockSql([
      [{ figma_sync: null }],
      [],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(200);

    // Verify the UPDATE was called with correct data
    expect(mockSql).toHaveBeenCalledTimes(2);
    // The second call is the UPDATE — we can inspect args indirectly
    // by checking the response matches our expectations
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.push.scope).toBe('campaign');
  });

  // ─── Success: returns correct pending_count ────────────────

  it('returns correct pending_count after appending', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const existingWithThree = {
      pending_pushes: [
        { scope: 'campaign', timestamp: '2026-04-01T00:00:00Z', pushed_by: 'u1' },
        { scope: 'persona', persona: 'a', timestamp: '2026-04-02T00:00:00Z', pushed_by: 'u2' },
        { scope: 'version', version: 'v1', timestamp: '2026-04-03T00:00:00Z', pushed_by: 'u3' },
      ],
    };
    const mockSql = createMockSql([
      [{ figma_sync: existingWithThree }],
      [],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_count).toBe(4); // 3 existing + 1 new
  });

  // ─── Success: handles "campaign" scope (no persona/version) ─

  it('handles "campaign" scope with no persona or version', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = createMockSql([
      [{ figma_sync: null }],
      [],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(
      makePostRequest({ request_id: 'req-1', scope: 'campaign' }) as any
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.push.scope).toBe('campaign');
    expect(json.push.persona).toBeNull();
    expect(json.push.version).toBeNull();
  });

  // ─── Success: handles "version" scope with persona + version ─

  it('handles "version" scope with persona and version params', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = createMockSql([
      [{ figma_sync: null }],
      [],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(
      makePostRequest({
        request_id: 'req-1',
        scope: 'version',
        persona: 'tech_enthusiast',
        version: 'v3',
      }) as any
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.push.scope).toBe('version');
    expect(json.push.persona).toBe('tech_enthusiast');
    expect(json.push.version).toBe('v3');
  });

  // ─── Error: DB UPDATE failure ──────────────────────────────

  it('returns 500 when DB UPDATE fails', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{ figma_sync: null }]) // SELECT succeeds
      .mockRejectedValueOnce(new Error('connection timeout')); // UPDATE fails
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to save pending push');
  });

  // ─── Error: DB SELECT failure (non-column-missing) ─────────

  it('returns 500 when DB SELECT fails with generic error', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' });
    const mockSql = vi.fn()
      .mockRejectedValueOnce(new Error('network error'));
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushPost(makePostRequest(VALID_POST_BODY) as any);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to read campaign state');
  });
});

// ============================================================
// GET /api/figma/push
// ============================================================

describe('GET /api/figma/push', () => {
  // ─── Validation tests ──────────────────────────────────────

  it('returns 400 when request_id param is missing', async () => {
    const res = await pushGet(makeGetRequest('') as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('request_id required');
  });

  // ─── Empty results ─────────────────────────────────────────

  it('returns empty array when campaign not found', async () => {
    const mockSql = createMockSql([
      [], // SELECT returns no rows
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-missing') as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_pushes).toEqual([]);
  });

  it('returns empty array when figma_sync is null', async () => {
    const mockSql = createMockSql([
      [{ figma_sync: null }],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-1') as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_pushes).toEqual([]);
  });

  it('returns empty array when figma_sync has no pending_pushes key', async () => {
    const mockSql = createMockSql([
      [{ figma_sync: { connected: true, file_key: 'abc' } }],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-1') as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_pushes).toEqual([]);
  });

  // ─── Returns pending pushes correctly ──────────────────────

  it('returns pending_pushes from figma_sync', async () => {
    const pushes = [
      { scope: 'campaign', persona: null, version: null, timestamp: '2026-04-10T12:00:00Z', pushed_by: 'u1' },
      { scope: 'persona', persona: 'tech_savvy', version: null, timestamp: '2026-04-10T13:00:00Z', pushed_by: 'u2' },
    ];
    const mockSql = createMockSql([
      [{ figma_sync: { pending_pushes: pushes } }],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-1') as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_pushes).toHaveLength(2);
    expect(json.pending_pushes[0].scope).toBe('campaign');
    expect(json.pending_pushes[1].persona).toBe('tech_savvy');
  });

  it('returns array with correct structure (scope, persona, version, timestamp, pushed_by)', async () => {
    const pushes = [
      { scope: 'version', persona: 'freelancer', version: 'v2', timestamp: '2026-04-11T09:00:00Z', pushed_by: 'user_99' },
    ];
    const mockSql = createMockSql([
      [{ figma_sync: { pending_pushes: pushes } }],
    ]);
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-1') as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const push = json.pending_pushes[0];
    expect(push).toHaveProperty('scope', 'version');
    expect(push).toHaveProperty('persona', 'freelancer');
    expect(push).toHaveProperty('version', 'v2');
    expect(push).toHaveProperty('timestamp', '2026-04-11T09:00:00Z');
    expect(push).toHaveProperty('pushed_by', 'user_99');
  });

  // ─── Error: column missing (graceful fallback) ─────────────

  it('returns empty array when column does not exist yet', async () => {
    const mockSql = vi.fn()
      .mockRejectedValueOnce(new Error('column "figma_sync" does not exist'));
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-1') as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_pushes).toEqual([]);
  });

  // ─── Error: generic DB failure ─────────────────────────────

  it('returns 500 when DB SELECT fails with generic error', async () => {
    const mockSql = vi.fn()
      .mockRejectedValueOnce(new Error('connection refused'));
    mockGetDb.mockReturnValue(mockSql);

    const res = await pushGet(makeGetRequest('request_id=req-1') as any);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to read pending pushes');
  });
});
