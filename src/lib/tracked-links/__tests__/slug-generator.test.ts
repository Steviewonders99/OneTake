import { describe, it, expect } from 'vitest';
import { generateSlug } from '../slug-generator';

const BASE62_RE = /^[0-9A-Za-z]{6}$/;

describe('generateSlug', () => {
  it('returns exactly 6 characters', () => {
    expect(generateSlug()).toHaveLength(6);
  });

  it('only contains base62 chars (digits + uppercase + lowercase)', () => {
    const slug = generateSlug();
    expect(BASE62_RE.test(slug)).toBe(true);
  });

  it('100 generated slugs all pass format validation', () => {
    for (let i = 0; i < 100; i++) {
      expect(BASE62_RE.test(generateSlug())).toBe(true);
    }
  });

  it('100 generated slugs are all unique', () => {
    const slugs = Array.from({ length: 100 }, () => generateSlug());
    const unique = new Set(slugs);
    expect(unique.size).toBe(100);
  });

  it('does not contain hyphens', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSlug()).not.toContain('-');
    }
  });

  it('does not contain underscores', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSlug()).not.toContain('_');
    }
  });

  it('does not contain special characters', () => {
    const special = /[^0-9A-Za-z]/;
    for (let i = 0; i < 50; i++) {
      expect(special.test(generateSlug())).toBe(false);
    }
  });
});
