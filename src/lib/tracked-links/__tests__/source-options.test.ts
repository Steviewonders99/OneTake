import { describe, it, expect } from 'vitest';
import {
  SOURCE_OPTIONS,
  CONTENT_OPTIONS,
  UTM_MEDIUM,
  getContentOptionsForSource,
  isValidSource,
  isValidContentForSource,
  getDefaultContentForChannel,
} from '../source-options';

describe('UTM_MEDIUM', () => {
  it('is always "referral"', () => {
    expect(UTM_MEDIUM).toBe('referral');
  });
});

describe('SOURCE_OPTIONS', () => {
  it('has exactly 5 sources', () => {
    expect(SOURCE_OPTIONS).toHaveLength(5);
  });

  it('contains job_board, social, email, internal, influencer', () => {
    const values = SOURCE_OPTIONS.map((s) => s.value);
    expect(values).toContain('job_board');
    expect(values).toContain('social');
    expect(values).toContain('email');
    expect(values).toContain('internal');
    expect(values).toContain('influencer');
  });
});

describe('isValidSource', () => {
  it('returns true for all 5 valid sources', () => {
    expect(isValidSource('job_board')).toBe(true);
    expect(isValidSource('social')).toBe(true);
    expect(isValidSource('email')).toBe(true);
    expect(isValidSource('internal')).toBe(true);
    expect(isValidSource('influencer')).toBe(true);
  });

  it('returns false for "invalid"', () => {
    expect(isValidSource('invalid')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidSource('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidSource(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidSource(undefined)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isValidSource(123)).toBe(false);
  });
});

describe('isValidContentForSource', () => {
  it('returns true for valid combo: social + linkedin_post', () => {
    expect(isValidContentForSource('social', 'linkedin_post')).toBe(true);
  });

  it('returns true for valid combo: job_board + glassdoor', () => {
    expect(isValidContentForSource('job_board', 'glassdoor')).toBe(true);
  });

  it('returns true for valid combo: email + college', () => {
    expect(isValidContentForSource('email', 'college')).toBe(true);
  });

  it('returns false for mismatched source/content: social + glassdoor', () => {
    expect(isValidContentForSource('social', 'glassdoor')).toBe(false);
  });

  it('returns false for mismatched source/content: job_board + linkedin_post', () => {
    expect(isValidContentForSource('job_board', 'linkedin_post')).toBe(false);
  });

  it('returns false for a nonexistent content value', () => {
    expect(isValidContentForSource('social', 'nonexistent')).toBe(false);
  });
});

describe('getContentOptionsForSource', () => {
  it('returns only social options for "social"', () => {
    const results = getContentOptionsForSource('social');
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      expect(item.source).toBe('social');
    }
  });

  it('returns only job_board options for "job_board"', () => {
    const results = getContentOptionsForSource('job_board');
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      expect(item.source).toBe('job_board');
    }
  });

  it('does not include options from other sources', () => {
    const socialResults = getContentOptionsForSource('social');
    const values = socialResults.map((c) => c.value);
    expect(values).not.toContain('glassdoor');
    expect(values).not.toContain('college');
  });
});

describe('CONTENT_OPTIONS integrity', () => {
  it('every CONTENT_OPTIONS entry has a source that exists in SOURCE_OPTIONS', () => {
    const validSources = new Set(SOURCE_OPTIONS.map((s) => s.value));
    for (const content of CONTENT_OPTIONS) {
      expect(validSources.has(content.source)).toBe(true);
    }
  });
});

describe('getDefaultContentForChannel', () => {
  it('returns linkedin_post for "linkedin"', () => {
    const result = getDefaultContentForChannel('linkedin');
    expect(result).not.toBeNull();
    expect(result!.value).toBe('linkedin_post');
  });

  it('returns facebook option for "facebook"', () => {
    const result = getDefaultContentForChannel('facebook');
    expect(result).not.toBeNull();
    expect(result!.value).toBe('facebook');
  });

  it('returns null for unknown channel', () => {
    const result = getDefaultContentForChannel('unknown_channel');
    expect(result).toBeNull();
  });

  it('is case-insensitive (LinkedIn → linkedin_post)', () => {
    const result = getDefaultContentForChannel('LinkedIn');
    expect(result).not.toBeNull();
    expect(result!.value).toBe('linkedin_post');
  });
});
