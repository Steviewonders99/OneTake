import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
  it('basic: "Hello World" → "hello-world"', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('already clean: "hello-world" → "hello-world"', () => {
    expect(slugify('hello-world')).toBe('hello-world');
  });

  it('unicode accents: "Café Résumé" → "cafe-resume"', () => {
    expect(slugify('Café Résumé')).toBe('cafe-resume');
  });

  it('multiple delimiters: "hello---world" → "hello-world"', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('mixed special chars: "Hello! @World#" → "hello-world"', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world');
  });

  it('leading hyphens stripped: "---hello" → "hello"', () => {
    expect(slugify('---hello')).toBe('hello');
  });

  it('trailing hyphens stripped: "hello---" → "hello"', () => {
    expect(slugify('hello---')).toBe('hello');
  });

  it('numbers preserved: "test123" → "test123"', () => {
    expect(slugify('test123')).toBe('test123');
  });

  it('empty string: "" → ""', () => {
    expect(slugify('')).toBe('');
  });

  it('non-string input: null → ""', () => {
    expect(slugify(null as any)).toBe('');
  });

  it('non-string input: 123 → ""', () => {
    expect(slugify(123 as any)).toBe('');
  });

  it('truncates to maxLen and no trailing hyphen after truncation', () => {
    // 70 chars of 'a' — default maxLen is 60
    const long = 'a'.repeat(70);
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).not.toMatch(/-$/);

    // String that, when truncated at 10, would land on a hyphen
    // "hello-world-foo" truncated to 10 gives "hello-worl" — no trailing hyphen
    const withHyphenAtCut = slugify('hello-world-foo', 10);
    expect(withHyphenAtCut.length).toBeLessThanOrEqual(10);
    expect(withHyphenAtCut).not.toMatch(/-$/);

    // Truncation landing on a hyphen: "hello world" at maxLen=6 → "hello-" → stripped → "hello"
    const trailingHyphenCase = slugify('hello world', 6);
    expect(trailingHyphenCase).not.toMatch(/-$/);
  });

  it('only special chars: "!@#$%" → ""', () => {
    expect(slugify('!@#$%')).toBe('');
  });
});
