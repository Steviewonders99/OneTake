import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SLUG_LENGTH = 6;

/**
 * Generate a random 6-character base62 slug using cryptographically-secure randomness.
 * Alphabet is [0-9A-Za-z] — no `-` or `_` to keep URLs visually clean.
 * 62^6 ≈ 56.8 billion possibilities.
 */
export function generateSlug(): string {
  let out = '';
  for (let i = 0; i < SLUG_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}
