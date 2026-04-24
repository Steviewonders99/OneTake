import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/db/audienceiq', () => ({
  upsertIdentity: vi.fn(async () => {}),
}));

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => mockSql),
}));

import { stitchSignup, autoMatchContributors } from '@/lib/crm/identity';
import { upsertIdentity } from '@/lib/db/audienceiq';

// ── Helpers ────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('stitchSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls upsertIdentity with email_hash (SHA-256 of lowercase email)', async () => {
    await stitchSignup({ email: 'Test@Example.COM', crm_user_id: 'u1' });

    expect(upsertIdentity).toHaveBeenCalledOnce();
    const call = vi.mocked(upsertIdentity).mock.calls[0][0];
    expect(call.email_hash).toBe(sha256('test@example.com'));
  });

  it('same email always produces same hash (consistency)', async () => {
    await stitchSignup({ email: 'alice@acme.io', crm_user_id: 'u2' });
    await stitchSignup({ email: 'alice@acme.io', crm_user_id: 'u3' });

    const calls = vi.mocked(upsertIdentity).mock.calls;
    expect(calls[0][0].email_hash).toBe(calls[1][0].email_hash);
  });

  it('email is normalized to lowercase + trimmed before hashing', async () => {
    await stitchSignup({ email: '  Alice@ACME.io  ', crm_user_id: 'u4' });

    const call = vi.mocked(upsertIdentity).mock.calls[0][0];
    expect(call.email_hash).toBe(sha256('alice@acme.io'));
  });

  it('passes utm_slug when provided', async () => {
    await stitchSignup({ email: 'a@b.com', crm_user_id: 'u5', utm_slug: 'spring-promo' });

    const call = vi.mocked(upsertIdentity).mock.calls[0][0];
    expect(call.utm_slug).toBe('spring-promo');
  });

  it('passes null for optional fields when not provided', async () => {
    await stitchSignup({ email: 'a@b.com', crm_user_id: 'u6' });

    const call = vi.mocked(upsertIdentity).mock.calls[0][0];
    expect(call.visitor_id).toBeNull();
    expect(call.ga4_client_id).toBeNull();
    expect(call.utm_slug).toBeNull();
  });
});

describe('autoMatchContributors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when no unmatched records (empty query result)', async () => {
    // First call: unmatched query returns empty
    mockSql.mockResolvedValueOnce([]);

    const count = await autoMatchContributors();
    expect(count).toBe(0);
    expect(upsertIdentity).not.toHaveBeenCalled();
  });

  it('calls upsertIdentity for each unmatched contributor', async () => {
    // First call: unmatched query returns 2 rows
    mockSql.mockResolvedValueOnce([
      { crm_user_id: 'c1', email: 'one@test.com', utm_campaign: 'camp-a' },
      { crm_user_id: 'c2', email: 'two@test.com', utm_campaign: 'camp-b' },
    ]);
    // tracked_links query for contributor 1
    mockSql.mockResolvedValueOnce([{ slug: 'slug-a' }]);
    // tracked_links query for contributor 2
    mockSql.mockResolvedValueOnce([]);

    await autoMatchContributors();

    expect(upsertIdentity).toHaveBeenCalledTimes(2);
    expect(vi.mocked(upsertIdentity).mock.calls[0][0]).toMatchObject({
      email: 'one@test.com',
      crm_user_id: 'c1',
      utm_slug: 'slug-a',
    });
    expect(vi.mocked(upsertIdentity).mock.calls[1][0]).toMatchObject({
      email: 'two@test.com',
      crm_user_id: 'c2',
      utm_slug: null,
    });
  });

  it('returns the count of newly matched', async () => {
    mockSql.mockResolvedValueOnce([
      { crm_user_id: 'c1', email: 'a@test.com', utm_campaign: 'x' },
      { crm_user_id: 'c2', email: 'b@test.com', utm_campaign: 'y' },
      { crm_user_id: 'c3', email: 'c@test.com', utm_campaign: 'z' },
    ]);
    // tracked_links queries for each
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);

    const count = await autoMatchContributors();
    expect(count).toBe(3);
  });
});
