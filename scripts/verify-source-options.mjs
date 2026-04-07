import assert from 'node:assert/strict';
import {
  SOURCE_OPTIONS,
  CONTENT_OPTIONS,
  UTM_MEDIUM,
  getContentOptionsForSource,
  isValidSource,
  isValidContentForSource,
  getDefaultContentForChannel,
} from '../src/lib/tracked-links/source-options.ts';

// Source options
assert.equal(SOURCE_OPTIONS.length, 5, '5 source options expected');
assert.deepEqual(
  SOURCE_OPTIONS.map((s) => s.value).sort(),
  ['email', 'influencer', 'internal', 'job_board', 'social']
);

// Medium constant
assert.equal(UTM_MEDIUM, 'referral');

// Content options — totals per source
const expected = {
  job_board: 19,
  social: 10,
  email: 20,
  internal: 3,
  influencer: 10,
};
for (const [source, count] of Object.entries(expected)) {
  const got = getContentOptionsForSource(source).length;
  assert.equal(got, count, `${source}: expected ${count} content options, got ${got}`);
}
assert.equal(CONTENT_OPTIONS.length, 19 + 10 + 20 + 3 + 10);

// Each content option has a source that's in SOURCE_OPTIONS
for (const c of CONTENT_OPTIONS) {
  assert.ok(isValidSource(c.source), `content ${c.value} has invalid source ${c.source}`);
}

// Content slugs are unique within a source (allowing dupes across sources is fine but we don't have any in v1)
const seen = new Set();
for (const c of CONTENT_OPTIONS) {
  const key = `${c.source}::${c.value}`;
  assert.ok(!seen.has(key), `duplicate (source, content) pair: ${key}`);
  seen.add(key);
}

// isValidSource type guard
assert.equal(isValidSource('job_board'), true);
assert.equal(isValidSource('social'), true);
assert.equal(isValidSource('not_a_source'), false);
assert.equal(isValidSource(null), false);
assert.equal(isValidSource(123), false);

// isValidContentForSource
assert.equal(isValidContentForSource('job_board', 'glassdoor'), true);
assert.equal(isValidContentForSource('job_board', 'linkedin_post'), false, 'linkedin_post is social, not job_board');
assert.equal(isValidContentForSource('social', 'linkedin_post'), true);
assert.equal(isValidContentForSource('social', 'not_real'), false);

// getDefaultContentForChannel — should pick natural defaults
assert.equal(getDefaultContentForChannel('linkedin')?.value, 'linkedin_post');
assert.equal(getDefaultContentForChannel('facebook')?.value, 'facebook');
assert.equal(getDefaultContentForChannel('instagram')?.value, 'instagram');
assert.equal(getDefaultContentForChannel('reddit')?.value, 'reddit');
assert.equal(getDefaultContentForChannel('tiktok')?.value, 'tiktok');
assert.equal(getDefaultContentForChannel('unknown_channel'), null);

console.log(`✓ source-options verifier: ${SOURCE_OPTIONS.length} sources, ${CONTENT_OPTIONS.length} content options, all assertions passed`);
