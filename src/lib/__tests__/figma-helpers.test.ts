import { describe, it, expect } from 'vitest';
import { parseFrameName, buildFrameName, extractFileKey } from '../figma-helpers';

// ─── parseFrameName ──────────────────────────────────────────────────────────

describe('parseFrameName', () => {
  it('parses valid ig_feed frame', () => {
    expect(parseFrameName('Nova_Maria_V1_ig_feed_1080x1080')).toEqual({
      persona: 'Maria',
      version: 'V1',
      platform: 'ig_feed',
      width: 1080,
      height: 1080,
    });
  });

  it('parses valid linkedin_feed frame', () => {
    expect(parseFrameName('Nova_Alex_V2_linkedin_feed_1200x627')).toEqual({
      persona: 'Alex',
      version: 'V2',
      platform: 'linkedin_feed',
      width: 1200,
      height: 627,
    });
  });

  it('parses valid tiktok_feed frame', () => {
    expect(parseFrameName('Nova_Priya_V3_tiktok_feed_1080x1920')).toEqual({
      persona: 'Priya',
      version: 'V3',
      platform: 'tiktok_feed',
      width: 1080,
      height: 1920,
    });
  });

  it('handles large version numbers', () => {
    const result = parseFrameName('Nova_X_V99_ig_feed_100x100');
    expect(result).not.toBeNull();
    expect(result!.version).toBe('V99');
  });

  it('handles platform with multiple underscores (wechat_moments)', () => {
    // The regex [a-z_]+ is greedy — it will capture "wechat_moments" then
    // fail because the remaining "_1080x1080" needs an underscore separator
    // before digits. Actually [a-z_]+ followed by _(\d+)x(\d+)$ — the last
    // underscore before digits gets consumed by the platform group ambiguity.
    // Let's test what actually happens:
    const result = parseFrameName('Nova_X_V1_wechat_moments_1080x1080');
    // The regex: /^Nova_(\w+)_(V\d+)_([a-z_]+)_(\d+)x(\d+)$/
    // [a-z_]+ is greedy, so it tries to match "wechat_moments_1080x1080"
    // then backtracks until (\d+)x(\d+)$ can match.
    // It should capture platform = "wechat_moments", width = 1080, height = 1080
    expect(result).toEqual({
      persona: 'X',
      version: 'V1',
      platform: 'wechat_moments',
      width: 1080,
      height: 1080,
    });
  });

  it('returns null for empty string', () => {
    expect(parseFrameName('')).toBeNull();
  });

  it('returns null without Nova_ prefix', () => {
    expect(parseFrameName('Frame_Maria_V1_ig_feed_1080x1080')).toBeNull();
  });

  it('returns null when version is missing', () => {
    expect(parseFrameName('Nova_Maria_ig_feed_1080x1080')).toBeNull();
  });

  it('returns null when dimensions are missing', () => {
    expect(parseFrameName('Nova_Maria_V1_ig_feed')).toBeNull();
  });

  it('returns null for non-numeric dimensions', () => {
    expect(parseFrameName('Nova_Maria_V1_ig_feed_ABCxDEF')).toBeNull();
  });

  it('returns null for just "Nova_"', () => {
    expect(parseFrameName('Nova_')).toBeNull();
  });

  it('returns null with extra text after dimensions', () => {
    // Regex is anchored with $ so trailing content should fail
    expect(parseFrameName('Nova_Maria_V1_ig_feed_1080x1080_extra')).toBeNull();
  });

  it('returns null for uppercase platform', () => {
    // Regex platform group is [a-z_]+ — uppercase letters won't match
    expect(parseFrameName('Nova_Maria_V1_IG_FEED_1080x1080')).toBeNull();
  });

  it('handles accented characters in persona via \\w', () => {
    // JavaScript \w is [A-Za-z0-9_] — it does NOT match accented chars like "a"
    // so "Maria" with accent should fail
    expect(parseFrameName('Nova_Mar\u00eda_V1_ig_feed_1080x1080')).toBeNull();
  });

  it('parses zero dimensions', () => {
    expect(parseFrameName('Nova_X_V1_test_0x0')).toEqual({
      persona: 'X',
      version: 'V1',
      platform: 'test',
      width: 0,
      height: 0,
    });
  });

  it('handles single-char persona name', () => {
    const result = parseFrameName('Nova_A_V1_fb_story_1080x1920');
    expect(result).toEqual({
      persona: 'A',
      version: 'V1',
      platform: 'fb_story',
      width: 1080,
      height: 1920,
    });
  });

  it('handles persona with underscores (greedy \\w+ consumes them)', () => {
    // (\w+) is greedy and \w matches underscore, so "Maria_Jane" would be
    // consumed by the persona group. Let's see if the overall regex still matches.
    // Nova_Maria_Jane_V1_ig_feed_1080x1080
    // (\w+) greedily takes "Maria_Jane_V1_ig_feed_1080x1080", then backtracks
    // until (V\d+) matches. Should still work with persona = "Maria_Jane"
    const result = parseFrameName('Nova_Maria_Jane_V1_ig_feed_1080x1080');
    expect(result).not.toBeNull();
    expect(result!.persona).toBe('Maria_Jane');
    expect(result!.version).toBe('V1');
  });
});

// ─── buildFrameName ──────────────────────────────────────────────────────────

describe('buildFrameName', () => {
  it('builds standard frame name', () => {
    expect(
      buildFrameName({
        persona: 'Maria',
        version: 'V1',
        platform: 'ig_feed',
        width: 1080,
        height: 1080,
      })
    ).toBe('Nova_Maria_V1_ig_feed_1080x1080');
  });

  it('roundtrips with parseFrameName', () => {
    const routing = {
      persona: 'Alex',
      version: 'V2',
      platform: 'linkedin_feed',
      width: 1200,
      height: 627,
    };
    const name = buildFrameName(routing);
    const parsed = parseFrameName(name);
    expect(parsed).toEqual(routing);
  });

  it('handles zero dimensions', () => {
    expect(
      buildFrameName({
        persona: 'X',
        version: 'V1',
        platform: 'test',
        width: 0,
        height: 0,
      })
    ).toBe('Nova_X_V1_test_0x0');
  });

  it('handles empty strings in fields (no validation)', () => {
    expect(
      buildFrameName({
        persona: '',
        version: 'V1',
        platform: '',
        width: 0,
        height: 0,
      })
    ).toBe('Nova__V1__0x0');
  });

  it('handles large dimensions', () => {
    expect(
      buildFrameName({
        persona: 'Banner',
        version: 'V1',
        platform: 'display',
        width: 9999,
        height: 12345,
      })
    ).toBe('Nova_Banner_V1_display_9999x12345');
  });

  it('preserves platform with multiple underscores', () => {
    expect(
      buildFrameName({
        persona: 'Kai',
        version: 'V3',
        platform: 'youtube_shorts_vertical',
        width: 1080,
        height: 1920,
      })
    ).toBe('Nova_Kai_V3_youtube_shorts_vertical_1080x1920');
  });
});

// ─── extractFileKey ──────────────────────────────────────────────────────────

describe('extractFileKey', () => {
  it('extracts key from /file/ URL with https://www', () => {
    expect(
      extractFileKey('https://www.figma.com/file/abc123/My-Design')
    ).toBe('abc123');
  });

  it('extracts key from /design/ URL', () => {
    expect(
      extractFileKey('https://www.figma.com/design/xyz789/Name')
    ).toBe('xyz789');
  });

  it('extracts key without https:// prefix', () => {
    expect(extractFileKey('figma.com/file/key123/Name')).toBe('key123');
  });

  it('returns null for missing key (empty segment)', () => {
    // "figma.com/file//Name" — regex needs [a-zA-Z0-9]+ which won't match empty
    expect(extractFileKey('figma.com/file//Name')).toBeNull();
  });

  it('returns null for wrong path segment', () => {
    expect(extractFileKey('figma.com/project/key123')).toBeNull();
  });

  it('returns null for just domain', () => {
    expect(extractFileKey('figma.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFileKey('')).toBeNull();
  });

  it('returns null for non-figma URL', () => {
    expect(extractFileKey('https://google.com/file/abc')).toBeNull();
  });

  it('extracts key with no trailing path', () => {
    expect(extractFileKey('figma.com/file/abc123')).toBe('abc123');
  });

  it('extracts mixed case key', () => {
    expect(extractFileKey('figma.com/file/AbCxYz123/Name')).toBe('AbCxYz123');
  });

  it('extracts only alphanumeric portion for key with hyphens', () => {
    // Regex [a-zA-Z0-9]+ stops at the hyphen, so only "abc" is captured
    expect(extractFileKey('figma.com/file/abc-123/Name')).toBe('abc');
  });

  it('handles URL with query params after key', () => {
    // The regex matches greedily up to a non-[a-zA-Z0-9] char
    expect(
      extractFileKey('https://figma.com/file/abc123?node-id=1:2')
    ).toBe('abc123');
  });
});
