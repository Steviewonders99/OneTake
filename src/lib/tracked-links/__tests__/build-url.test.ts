import { describe, it, expect } from 'vitest';
import { buildDestinationUrl } from '../build-url';

const baseUtm = {
  utm_campaign: 'q2-hiring',
  utm_source: 'social',
  utm_medium: 'referral',
  utm_term: 'data-annotator',
  utm_content: 'linkedin_post',
};

describe('buildDestinationUrl', () => {
  it('appends all 5 UTM params to a clean URL', () => {
    const result = buildDestinationUrl('https://example.com', baseUtm);
    const url = new URL(result);
    expect(url.searchParams.get('utm_campaign')).toBe('q2-hiring');
    expect(url.searchParams.get('utm_source')).toBe('social');
    expect(url.searchParams.get('utm_medium')).toBe('referral');
    expect(url.searchParams.get('utm_term')).toBe('data-annotator');
    expect(url.searchParams.get('utm_content')).toBe('linkedin_post');
  });

  it('preserves existing query params on the base URL', () => {
    const result = buildDestinationUrl('https://example.com?ref=header&lang=en', baseUtm);
    const url = new URL(result);
    expect(url.searchParams.get('ref')).toBe('header');
    expect(url.searchParams.get('lang')).toBe('en');
    expect(url.searchParams.get('utm_source')).toBe('social');
  });

  it('URL-encodes special characters in UTM values (spaces, ampersands)', () => {
    const utm = {
      ...baseUtm,
      utm_campaign: 'hello world & more',
      utm_term: 'a+b=c',
    };
    const result = buildDestinationUrl('https://example.com', utm);
    const url = new URL(result);
    expect(url.searchParams.get('utm_campaign')).toBe('hello world & more');
    expect(url.searchParams.get('utm_term')).toBe('a+b=c');
    // Ensure the raw string is encoded (no unencoded spaces or &)
    expect(result).not.toMatch(/utm_campaign=hello world/);
  });

  it('overwrites existing UTM params if base URL already has them', () => {
    const base = 'https://example.com?utm_source=old_source&utm_campaign=old_campaign';
    const result = buildDestinationUrl(base, baseUtm);
    const url = new URL(result);
    expect(url.searchParams.get('utm_source')).toBe('social');
    expect(url.searchParams.get('utm_campaign')).toBe('q2-hiring');
    // Should not have duplicates — getAll returns exactly 1
    expect(url.searchParams.getAll('utm_source')).toHaveLength(1);
    expect(url.searchParams.getAll('utm_campaign')).toHaveLength(1);
  });

  it('works with HTTPS URLs', () => {
    const result = buildDestinationUrl('https://oneforma.com', baseUtm);
    expect(result.startsWith('https://')).toBe(true);
    expect(() => new URL(result)).not.toThrow();
  });

  it('works with HTTP URLs', () => {
    const result = buildDestinationUrl('http://oneforma.com', baseUtm);
    expect(result.startsWith('http://')).toBe(true);
    expect(() => new URL(result)).not.toThrow();
  });

  it('works with URLs that have a path', () => {
    const result = buildDestinationUrl('https://example.com/jobs/apply', baseUtm);
    const url = new URL(result);
    expect(url.pathname).toBe('/jobs/apply');
    expect(url.searchParams.get('utm_source')).toBe('social');
  });

  it('works with trailing slash URLs', () => {
    const result = buildDestinationUrl('https://example.com/', baseUtm);
    const url = new URL(result);
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('utm_campaign')).toBe('q2-hiring');
  });

  it('output is always a valid URL', () => {
    const result = buildDestinationUrl('https://example.com/path?existing=1', baseUtm);
    expect(() => new URL(result)).not.toThrow();
  });
});
