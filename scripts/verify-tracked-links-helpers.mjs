import assert from 'node:assert/strict';
import { generateSlug } from '../src/lib/tracked-links/slug-generator.ts';
import { buildDestinationUrl } from '../src/lib/tracked-links/build-url.ts';

// --- slug generator ---
const slugs = new Set();
for (let i = 0; i < 1000; i++) {
  const s = generateSlug();
  assert.equal(s.length, 6, `slug length: ${s}`);
  assert.match(s, /^[0-9A-Za-z]{6}$/, `slug alphabet: ${s}`);
  slugs.add(s);
}
// 1000 draws should yield ~1000 unique values
assert.ok(slugs.size > 990, `expected ~1000 unique slugs in 1000 draws, got ${slugs.size}`);

// --- build url ---
const baseUtm = {
  utm_campaign: 'project-cutis-dermatology',
  utm_source: 'linkedin',
  utm_medium: 'social',
  utm_term: 'SJ-like-a-boss',
  utm_content: 'emily-square-01',
};

// Simple base URL
const simple = buildDestinationUrl('https://oneforma.com/apply/cutis', baseUtm);
assert.equal(
  simple,
  'https://oneforma.com/apply/cutis?utm_campaign=project-cutis-dermatology&utm_source=linkedin&utm_medium=social&utm_term=SJ-like-a-boss&utm_content=emily-square-01'
);

// Base URL with existing query string
const withQuery = buildDestinationUrl('https://oneforma.com/apply?src=email', baseUtm);
assert.ok(withQuery.includes('src=email'), `pre-existing query preserved: ${withQuery}`);
assert.ok(withQuery.includes('utm_campaign=project-cutis-dermatology'), 'utm_campaign appended');
assert.ok(withQuery.includes('utm_source=linkedin'), 'utm_source appended');

// Idempotent (calling twice with same params gives same result)
const once = buildDestinationUrl('https://oneforma.com/apply/cutis', baseUtm);
const twice = buildDestinationUrl(once, baseUtm);
assert.equal(once, twice, 'buildDestinationUrl should be idempotent');

// Special characters get encoded
const special = buildDestinationUrl('https://oneforma.com/apply/cutis', {
  ...baseUtm,
  utm_term: 'SJ with space',
});
assert.ok(special.includes('SJ+with+space') || special.includes('SJ%20with%20space'), `space encoded: ${special}`);

console.log('✓ slug generator + build-url verifier passed');
