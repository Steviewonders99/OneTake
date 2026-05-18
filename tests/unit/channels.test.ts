import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: () => mockSql,
}));

import {
  listChannelDefinitions,
  createChannelDefinition,
  resolveUtm,
  listChannelLinks,
  confirmChannelLink,
  dismissChannelLink,
  listUnclassified,
  resolveUnclassified,
} from '@/lib/db/channels';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listChannelDefinitions', () => {
  it('returns all channel definitions', async () => {
    const mockChannels = [
      { slug: 'brevo_email', display_name: 'Brevo Email', category: 'email', is_paid: false },
      { slug: 'meta_paid', display_name: 'Meta Ads', category: 'paid_social', is_paid: true },
    ];
    mockSql.mockResolvedValueOnce(mockChannels);

    const result = await listChannelDefinitions();
    expect(result).toHaveLength(2);
  });
});

describe('createChannelDefinition', () => {
  it('creates a new channel with defaults', async () => {
    const mockChannel = { slug: 'jobberman', display_name: 'Jobberman', category: 'job_board', is_paid: false };
    mockSql.mockResolvedValueOnce([mockChannel]);

    const result = await createChannelDefinition({
      slug: 'jobberman',
      display_name: 'Jobberman',
      category: 'job_board',
    });
    expect(result.slug).toBe('jobberman');
    expect(result.is_paid).toBe(false);
  });
});

describe('resolveUtm', () => {
  it('returns resolved channel for known UTM', async () => {
    mockSql.mockResolvedValueOnce([{
      channel_slug: 'flyer',
      channel_name: 'Physical Flyers',
      category: 'physical',
      extracted_label: 'seattle',
      confidence: 0.8,
    }]);

    const result = await resolveUtm('flyer_seattle', 'qr', 'centaurus');
    expect(result).not.toBeNull();
    expect(result!.channel_slug).toBe('flyer');
    expect(result!.extracted_label).toBe('seattle');
  });

  it('returns null for unknown UTM', async () => {
    mockSql.mockResolvedValueOnce([]);
    const result = await resolveUtm('totally_unknown', 'weird', 'test');
    expect(result).toBeNull();
  });
});

describe('channel links', () => {
  it('listChannelLinks returns links with channel info', async () => {
    const mockLinks = [{
      id: '1', project_id: 'p1', channel_id: 'c1', external_id: 'ext1',
      channel_slug: 'meta_paid', channel_name: 'Meta Ads', channel_category: 'paid_social',
    }];
    mockSql.mockResolvedValueOnce(mockLinks);

    const result = await listChannelLinks('p1');
    expect(result[0].channel_slug).toBe('meta_paid');
  });

  it('confirmChannelLink returns true when confirmed', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await confirmChannelLink('1')).toBe(true);
  });

  it('confirmChannelLink returns false if already confirmed', async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await confirmChannelLink('1')).toBe(false);
  });

  it('dismissChannelLink deletes the link', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await dismissChannelLink('1')).toBe(true);
  });
});

describe('unclassified UTMs', () => {
  it('listUnclassified returns pending items', async () => {
    const mockItems = [{
      id: '1', normalized_name: 'Recruiter Ahmed Rafiq', hit_count: 28,
      raw_source: 'recruiter_ahmed_rafiq', project: 'kilo',
      suggested_channel: 'Recruiter Direct',
    }];
    mockSql.mockResolvedValueOnce(mockItems);

    const result = await listUnclassified();
    expect(result[0].normalized_name).toBe('Recruiter Ahmed Rafiq');
  });

  it('resolveUnclassified marks as resolved', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await resolveUnclassified('1', 'channel-id')).toBe(true);
  });
});
