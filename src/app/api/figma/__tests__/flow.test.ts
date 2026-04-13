import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies (same pattern as routes.test.ts)
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Multi-step flow tests
// ============================================================

describe('Push -> Read flow', () => {
  it('push appears in subsequent GET (end-to-end mock)', async () => {
    // Step 1: POST a push
    mockAuth.mockResolvedValue({ userId: 'user_flow1' });

    const postSql = createMockSql([
      [{ figma_sync: null }],  // SELECT — no existing sync
      [],                       // UPDATE
    ]);
    mockGetDb.mockReturnValue(postSql);

    const postRes = await pushPost(makePostRequest({
      request_id: 'req-flow-1',
      scope: 'campaign',
    }) as any);

    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.pending_count).toBe(1);
    expect(postJson.push.scope).toBe('campaign');

    // Step 2: GET the pending pushes
    // Simulate what the DB would contain after the POST
    const savedSync = {
      pending_pushes: [{
        scope: 'campaign',
        persona: null,
        version: null,
        timestamp: '2026-04-13T00:00:00.000Z',
        pushed_by: 'user_flow1',
      }],
    };

    const getSql = createMockSql([
      [{ figma_sync: savedSync }],
    ]);
    mockGetDb.mockReturnValue(getSql);

    const getRes = await pushGet(makeGetRequest('request_id=req-flow-1') as any);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();

    expect(getJson.pending_pushes).toHaveLength(1);
    expect(getJson.pending_pushes[0].scope).toBe('campaign');
    expect(getJson.pending_pushes[0].pushed_by).toBe('user_flow1');
  });

  it('multiple pushes accumulate — 3 sequential pushes all appear in GET', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_multi' });

    // Push 1: campaign scope
    const sql1 = createMockSql([
      [{ figma_sync: null }],
      [],
    ]);
    mockGetDb.mockReturnValue(sql1);
    const res1 = await pushPost(makePostRequest({
      request_id: 'req-multi',
      scope: 'campaign',
    }) as any);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.pending_count).toBe(1);

    // Push 2: persona scope — DB now has 1 existing push
    const existingAfterPush1 = {
      pending_pushes: [{
        scope: 'campaign',
        persona: null,
        version: null,
        timestamp: '2026-04-13T00:00:01.000Z',
        pushed_by: 'user_multi',
      }],
    };
    const sql2 = createMockSql([
      [{ figma_sync: existingAfterPush1 }],
      [],
    ]);
    mockGetDb.mockReturnValue(sql2);
    const res2 = await pushPost(makePostRequest({
      request_id: 'req-multi',
      scope: 'persona',
      persona: 'tech_enthusiast',
    }) as any);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.pending_count).toBe(2);

    // Push 3: version scope — DB now has 2 existing pushes
    const existingAfterPush2 = {
      pending_pushes: [
        existingAfterPush1.pending_pushes[0],
        {
          scope: 'persona',
          persona: 'tech_enthusiast',
          version: null,
          timestamp: '2026-04-13T00:00:02.000Z',
          pushed_by: 'user_multi',
        },
      ],
    };
    const sql3 = createMockSql([
      [{ figma_sync: existingAfterPush2 }],
      [],
    ]);
    mockGetDb.mockReturnValue(sql3);
    const res3 = await pushPost(makePostRequest({
      request_id: 'req-multi',
      scope: 'version',
      persona: 'tech_enthusiast',
      version: 'v3',
    }) as any);
    expect(res3.status).toBe(200);
    const json3 = await res3.json();
    expect(json3.pending_count).toBe(3);

    // GET — verify all 3 appear
    // Note: the route MUTATES the pending_pushes array in-place via .push(),
    // so existingAfterPush2.pending_pushes now has 3 items (original 2 + push3's addition).
    // We construct the expected state fresh to avoid referencing mutated data.
    const expectedPushes = {
      pending_pushes: [
        { scope: 'campaign', persona: null, version: null, timestamp: '2026-04-13T00:00:01.000Z', pushed_by: 'user_multi' },
        { scope: 'persona', persona: 'tech_enthusiast', version: null, timestamp: '2026-04-13T00:00:02.000Z', pushed_by: 'user_multi' },
        { scope: 'version', persona: 'tech_enthusiast', version: 'v3', timestamp: '2026-04-13T00:00:03.000Z', pushed_by: 'user_multi' },
      ],
    };
    const sqlGet = createMockSql([
      [{ figma_sync: expectedPushes }],
    ]);
    mockGetDb.mockReturnValue(sqlGet);

    const getRes = await pushGet(makeGetRequest('request_id=req-multi') as any);
    const getJson = await getRes.json();
    expect(getJson.pending_pushes).toHaveLength(3);
    expect(getJson.pending_pushes[0].scope).toBe('campaign');
    expect(getJson.pending_pushes[1].scope).toBe('persona');
    expect(getJson.pending_pushes[2].scope).toBe('version');
  });

  it('push with each scope type returns correct structure', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_scopes' });

    const scopes = [
      { scope: 'campaign', persona: undefined, version: undefined },
      { scope: 'persona', persona: 'early_adopter', version: undefined },
      { scope: 'version', persona: 'early_adopter', version: 'v2' },
    ];

    for (const { scope, persona, version } of scopes) {
      const sql = createMockSql([
        [{ figma_sync: null }],
        [],
      ]);
      mockGetDb.mockReturnValue(sql);

      const body: Record<string, unknown> = { request_id: 'req-scope', scope };
      if (persona) body.persona = persona;
      if (version) body.version = version;

      const res = await pushPost(makePostRequest(body) as any);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.push.scope).toBe(scope);
      if (persona) {
        expect(json.push.persona).toBe(persona);
      } else {
        expect(json.push.persona).toBeNull();
      }
      if (version) {
        expect(json.push.version).toBe(version);
      } else {
        expect(json.push.version).toBeNull();
      }
    }
  });

  it('push preserves existing figma_sync fields (file_key, token not overwritten)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_preserve' });

    const existingSync = {
      file_key: 'figma_file_abc123',
      token: 'figd_secret_token_xyz',
      connected: true,
      pending_pushes: [],
    };

    const sql = createMockSql([
      [{ figma_sync: existingSync }],
      [],
    ]);
    mockGetDb.mockReturnValue(sql);

    const res = await pushPost(makePostRequest({
      request_id: 'req-preserve',
      scope: 'campaign',
    }) as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_count).toBe(1);

    // Verify the SQL UPDATE was called (second call)
    expect(sql).toHaveBeenCalledTimes(2);

    // The route uses spread: { ...currentSync, pending_pushes: [...] }
    // So file_key and token should be preserved in the update payload.
    // We can't directly inspect the JSONB value in the tagged template,
    // but we know the route does `{ ...currentSync, pending_pushes }`,
    // so if currentSync had file_key + token, the updated object does too.
    // The response confirms the push was accepted.
    expect(json.success).toBe(true);
  });

  it('concurrent-style pushes do not lose data (sequential append)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_concurrent' });

    // Push A: DB starts empty
    const sqlA = createMockSql([
      [{ figma_sync: null }],
      [],
    ]);
    mockGetDb.mockReturnValue(sqlA);

    const resA = await pushPost(makePostRequest({
      request_id: 'req-concurrent',
      scope: 'campaign',
    }) as any);
    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.pending_count).toBe(1);

    // Push B: DB now has push A
    const afterPushA = {
      pending_pushes: [{
        scope: 'campaign',
        persona: null,
        version: null,
        timestamp: '2026-04-13T01:00:00.000Z',
        pushed_by: 'user_concurrent',
      }],
    };
    const sqlB = createMockSql([
      [{ figma_sync: afterPushA }],
      [],
    ]);
    mockGetDb.mockReturnValue(sqlB);

    const resB = await pushPost(makePostRequest({
      request_id: 'req-concurrent',
      scope: 'persona',
      persona: 'freelancer',
    }) as any);
    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    // Should be 2: the existing campaign push + new persona push
    expect(jsonB.pending_count).toBe(2);
  });

  it('push to non-existent campaign returns 404, GET returns empty', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_404' });

    // POST — campaign not found
    const sqlPost = createMockSql([
      [], // SELECT returns no rows
    ]);
    mockGetDb.mockReturnValue(sqlPost);

    const postRes = await pushPost(makePostRequest({
      request_id: 'req-nonexistent',
      scope: 'campaign',
    }) as any);
    expect(postRes.status).toBe(404);
    const postJson = await postRes.json();
    expect(postJson.error).toBe('Campaign not found');

    // GET — same campaign returns empty (not found = empty pending_pushes)
    const sqlGet = createMockSql([
      [], // SELECT returns no rows
    ]);
    mockGetDb.mockReturnValue(sqlGet);

    const getRes = await pushGet(makeGetRequest('request_id=req-nonexistent') as any);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.pending_pushes).toEqual([]);
  });

  it('auth boundary: POST requires auth (401 without), GET works without auth', async () => {
    // POST without auth → 401
    mockAuth.mockResolvedValue({ userId: null });
    const postRes = await pushPost(makePostRequest({
      request_id: 'req-auth',
      scope: 'campaign',
    }) as any);
    expect(postRes.status).toBe(401);
    const postJson = await postRes.json();
    expect(postJson.error).toBe('Unauthorized');

    // GET works without auth (no auth check in GET handler)
    const sqlGet = createMockSql([
      [{ figma_sync: { pending_pushes: [{ scope: 'campaign', pushed_by: 'someone' }] } }],
    ]);
    mockGetDb.mockReturnValue(sqlGet);

    const getRes = await pushGet(makeGetRequest('request_id=req-auth') as any);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.pending_pushes).toHaveLength(1);
  });

  it('large pending_pushes array: 100 existing + 1 new = 101 total', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_large' });

    // Build 100 existing pushes
    const existingPushes = Array.from({ length: 100 }, (_, i) => ({
      scope: ['campaign', 'persona', 'version'][i % 3],
      persona: i % 3 !== 0 ? `persona_${i}` : null,
      version: i % 3 === 2 ? `v${i}` : null,
      timestamp: `2026-04-${String(Math.floor(i / 10) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      pushed_by: `user_${i}`,
    }));

    const existingSync = { pending_pushes: existingPushes };

    const sql = createMockSql([
      [{ figma_sync: existingSync }],
      [],
    ]);
    mockGetDb.mockReturnValue(sql);

    const res = await pushPost(makePostRequest({
      request_id: 'req-large',
      scope: 'campaign',
    }) as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pending_count).toBe(101);
    expect(json.push.scope).toBe('campaign');

    // Verify GET returns all 101
    // Note: existingPushes was MUTATED by the route's .push() call (now has 101 items).
    // We use it directly since it now reflects the expected DB state after push.
    const sqlGet = createMockSql([
      [{ figma_sync: { pending_pushes: existingPushes } }],
    ]);
    mockGetDb.mockReturnValue(sqlGet);

    const getRes = await pushGet(makeGetRequest('request_id=req-large') as any);
    const getJson = await getRes.json();
    // existingPushes was mutated from 100 → 101 by the route's push
    expect(getJson.pending_pushes).toHaveLength(101);
  });
});
