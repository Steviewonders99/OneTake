import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '@/lib/db';
import { GET } from '../route';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// Helper: create a mock SQL tagged-template function that returns the given rows
function createMockSql(rows: unknown[] = []) {
  return vi.fn(async () => rows);
}

// Helper: build request + params for the given slug
function makeRequest(slug: string) {
  return {
    request: new Request(`http://localhost:3000/r/${slug}`),
    context: { params: Promise.resolve({ slug }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /r/[slug]', () => {
  // ─── Valid slug → 301 redirect ────────────────────────────────────────────

  it('returns 301 redirect to destination_url for a valid, existing slug', async () => {
    const destinationUrl = 'https://example.com/apply?utm_source=social';
    const mockSql = createMockSql([{ destination_url: destinationUrl }]);
    mockGetDb.mockReturnValue(mockSql);

    const { request, context } = makeRequest('Abc123');
    const response = await GET(request, context);

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(destinationUrl);
  });

  // ─── Click count increment ────────────────────────────────────────────────

  it('calls getDb and executes an UPDATE query that increments click_count', async () => {
    const mockSql = createMockSql([{ destination_url: 'https://example.com/apply' }]);
    mockGetDb.mockReturnValue(mockSql);

    const { request, context } = makeRequest('Abc123');
    await GET(request, context);

    // getDb was called once
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    // The sql tagged-template function was invoked once (UPDATE … RETURNING)
    expect(mockSql).toHaveBeenCalledTimes(1);

    // Inspect the raw template strings passed to the tagged-template call
    const [templateStrings] = mockSql.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    const rawSql = templateStrings.join('').toLowerCase();
    expect(rawSql).toContain('click_count + 1');
  });

  // ─── SQL receives the correct slug value ──────────────────────────────────

  it('passes the slug as a parameterised value to the SQL query', async () => {
    const mockSql = createMockSql([{ destination_url: 'https://example.com/apply' }]);
    mockGetDb.mockReturnValue(mockSql);

    const { request, context } = makeRequest('Abc123');
    await GET(request, context);

    // The slug should appear as a tagged-template interpolation argument
    const callArgs = mockSql.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    const interpolatedValues = callArgs.slice(1);
    expect(interpolatedValues).toContain('Abc123');
  });

  // ─── Non-existent valid slug → 404 ───────────────────────────────────────

  it('returns 404 HTML when the slug is valid format but not found in DB', async () => {
    const mockSql = createMockSql([]); // no rows
    mockGetDb.mockReturnValue(mockSql);

    const { request, context } = makeRequest('Zz9999');
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toContain('<!DOCTYPE html>');
  });

  // ─── Invalid slug formats → 404 without hitting DB ───────────────────────

  it('returns 404 for slug that is too short (5 chars)', async () => {
    const { request, context } = makeRequest('Ab12c');
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    // Must NOT have hit the database
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it('returns 404 for slug that is too long (7 chars)', async () => {
    const { request, context } = makeRequest('Ab12c3X');
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it('returns 404 for slug containing special characters', async () => {
    const { request, context } = makeRequest('Ab-12c');
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it('returns 404 for empty slug', async () => {
    const { request, context } = makeRequest('');
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  // ─── 404 response is HTML ─────────────────────────────────────────────────

  it('returns Content-Type text/html for invalid slug 404s', async () => {
    const { request, context } = makeRequest('bad!!');
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });
});
