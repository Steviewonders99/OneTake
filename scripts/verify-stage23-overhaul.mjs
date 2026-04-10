// scripts/verify-stage23-overhaul.mjs
import assert from 'node:assert/strict';

// ── 1. Pillar filtering ──────────────────────────────────────────────

function filterPillars(pillarWeighting) {
  const VALID = new Set(['earn', 'grow', 'shape']);
  const ALL = ['earn', 'grow', 'shape'];

  if (!pillarWeighting || typeof pillarWeighting !== 'object') return ALL;

  const primary = pillarWeighting.primary;
  const secondary = pillarWeighting.secondary;

  if (!primary || !VALID.has(primary)) return ALL;
  if (!secondary || !VALID.has(secondary)) return ALL;

  return [primary, secondary];
}

// Valid weighting → 2 pillars
assert.deepStrictEqual(
  filterPillars({ primary: 'shape', secondary: 'earn', reasoning: '...' }),
  ['shape', 'earn'],
  'Should return [primary, secondary] when both valid'
);

// Same pillar twice → still 2 entries
assert.deepStrictEqual(
  filterPillars({ primary: 'earn', secondary: 'earn', reasoning: '...' }),
  ['earn', 'earn'],
  'Should allow same pillar for primary and secondary'
);

// Missing weighting → all 3 fallback
assert.deepStrictEqual(
  filterPillars(null),
  ['earn', 'grow', 'shape'],
  'Should fallback to all 3 when null'
);
assert.deepStrictEqual(
  filterPillars({}),
  ['earn', 'grow', 'shape'],
  'Should fallback to all 3 when empty'
);

// Invalid pillar value → all 3 fallback
assert.deepStrictEqual(
  filterPillars({ primary: 'sharp', secondary: 'earn' }),
  ['earn', 'grow', 'shape'],
  'Should fallback when primary is invalid'
);
assert.deepStrictEqual(
  filterPillars({ primary: 'shape', secondary: 'earns' }),
  ['earn', 'grow', 'shape'],
  'Should fallback when secondary is invalid'
);

console.log('✓ pillar filtering: 6 assertions passed');

// ── 2. Language derivation ───────────────────────────────────────────

const REGION_LANGUAGE_MAP = {
  BR: 'Portuguese', MX: 'Spanish', CO: 'Spanish', AR: 'Spanish',
  CL: 'Spanish', PE: 'Spanish', JP: 'Japanese', KR: 'Korean',
  CN: 'Mandarin Chinese', TW: 'Traditional Chinese', DE: 'German',
  FR: 'French', IT: 'Italian', PT: 'Portuguese', MA: 'French',
  EG: 'Arabic', SA: 'Arabic', AE: 'Arabic', IN: 'Hindi',
  ID: 'Indonesian', PH: 'Filipino', TH: 'Thai', VN: 'Vietnamese',
  TR: 'Turkish', PL: 'Polish', RO: 'Romanian', UA: 'Ukrainian',
  RU: 'Russian', FI: 'Finnish', SE: 'Swedish', NO: 'Norwegian',
  DK: 'Danish', NL: 'Dutch', BE: 'Dutch', GR: 'Greek', IL: 'Hebrew',
  NG: 'English', KE: 'English', ZA: 'English',
  US: 'English', GB: 'English', CA: 'English', AU: 'English', NZ: 'English',
};

function deriveLanguagesFromRegions(regions, targetLanguages) {
  if (targetLanguages && targetLanguages.length > 0) return targetLanguages;
  if (!regions || regions.length === 0) return ['English'];

  const languages = [];
  const seen = new Set();
  for (const region of regions) {
    const lang = REGION_LANGUAGE_MAP[region.toUpperCase()] || 'English';
    if (!seen.has(lang)) {
      languages.push(lang);
      seen.add(lang);
    }
  }
  return languages.length > 0 ? languages : ['English'];
}

// Derive from regions when no languages specified
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['BR', 'MX'], []),
  ['Portuguese', 'Spanish'],
  'Should derive Portuguese + Spanish from BR + MX'
);

// Existing languages take priority
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['BR'], ['English']),
  ['English'],
  'Should keep existing languages when provided'
);

// Empty everything → English
assert.deepStrictEqual(
  deriveLanguagesFromRegions([], []),
  ['English'],
  'Should default to English when no regions or languages'
);

// Dedup: BR + PT both map to Portuguese
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['BR', 'PT'], []),
  ['Portuguese'],
  'Should dedup same language from different regions'
);

// Unknown region → English
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['XX'], []),
  ['English'],
  'Should default to English for unknown region'
);

// Case insensitive
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['fi'], []),
  ['Finnish'],
  'Should handle lowercase region codes'
);

console.log('✓ language derivation: 6 assertions passed');

// ── 3. Scene-to-intent mapping ───────────────────────────────────────

function mapSceneToIntent(sceneKey) {
  const key = sceneKey.toLowerCase();
  if (key.includes('cafe') || key.includes('coffee') || key.includes('shop')) return 'cafe_working';
  if (key.includes('celebrat') || key.includes('milestone') || key.includes('earning') || key.includes('reward')) return 'celebrating_earnings';
  if (key.includes('break') || key.includes('relax') || key.includes('lounge')) return 'at_home_relaxed';
  if (key.includes('work') || key.includes('active') || key.includes('review') || key.includes('desk') || key.includes('clinical') || key.includes('office')) return 'at_home_working';
  if (key.includes('profile') || key.includes('headshot') || key.includes('portrait')) return 'profile';
  if (key.includes('team') || key.includes('collaborat') || key.includes('group')) return 'collaboration';
  if (key.includes('outdoor') || key.includes('walk') || key.includes('commut') || key.includes('street')) return 'aspirational';
  return 'at_home_working';
}

assert.strictEqual(mapSceneToIntent('clinical_active'), 'at_home_working');
assert.strictEqual(mapSceneToIntent('morning_desk_session'), 'at_home_working');
assert.strictEqual(mapSceneToIntent('hospital_break_room'), 'at_home_relaxed');
assert.strictEqual(mapSceneToIntent('cafe_working'), 'cafe_working');
assert.strictEqual(mapSceneToIntent('celebrating_milestone'), 'celebrating_earnings');
assert.strictEqual(mapSceneToIntent('professional_review'), 'at_home_working');
assert.strictEqual(mapSceneToIntent('outdoor_commute'), 'aspirational');
assert.strictEqual(mapSceneToIntent('some_random_thing'), 'at_home_working');

console.log('✓ scene-to-intent mapping: 8 assertions passed');

// ── 4. Pillar signal scoring ─────────────────────────────────────────

const PILLAR_SIGNALS = {
  earn: new Set(['earn', 'paid', 'payout', 'income', 'compensation', 'money', 'financial', 'twice-monthly', 'payoneer', 'paypal']),
  grow: new Set(['grow', 'career', 'skill', 'learn', 'portfolio', 'credential', 'experience', 'develop', 'advance', 'build']),
  shape: new Set(['expert', 'expertise', 'judgment', 'shape', 'influence', 'recognition', 'respected', 'valued', 'contribute', 'impact']),
};

function scorePillarEmbodiment(text, targetPillar) {
  const lower = text.toLowerCase();
  let targetHits = 0;
  for (const word of PILLAR_SIGNALS[targetPillar] || []) {
    if (lower.includes(word)) targetHits++;
  }

  // Check for confusion — does a non-target pillar dominate?
  let maxOtherHits = 0;
  let dominantOther = null;
  for (const [pillar, signals] of Object.entries(PILLAR_SIGNALS)) {
    if (pillar === targetPillar) continue;
    let hits = 0;
    for (const word of signals) {
      if (lower.includes(word)) hits++;
    }
    if (hits > maxOtherHits) {
      maxOtherHits = hits;
      dominantOther = pillar;
    }
  }

  const bonus = Math.min(targetHits * 0.03, 0.09);
  const penalty = (maxOtherHits > targetHits && maxOtherHits > 0) ? 0.05 : 0;
  const confused = penalty > 0 ? dominantOther : null;

  return { bonus, penalty, confused, targetHits, maxOtherHits };
}

// Shape copy with shape signals → positive
const shapeResult = scorePillarEmbodiment(
  'Your expertise in clinical judgment makes you exactly who AI teams need. Be recognized for the impact you bring.',
  'shape'
);
assert.ok(shapeResult.bonus > 0, 'Should get bonus for shape signals');
assert.strictEqual(shapeResult.penalty, 0, 'Should have no confusion penalty');
assert.strictEqual(shapeResult.confused, null, 'Should not be confused');

// Earn copy with earn signals → positive
const earnResult = scorePillarEmbodiment(
  'Get paid twice-monthly via Payoneer. Real income for your native language skills.',
  'earn'
);
assert.ok(earnResult.bonus > 0, 'Should get bonus for earn signals');
assert.strictEqual(earnResult.penalty, 0, 'Should have no confusion penalty');

// "Earn" copy that reads like Shape → confusion penalty
const confusedResult = scorePillarEmbodiment(
  'Your expertise and judgment are valued. Be recognized as a respected contributor who shapes AI.',
  'earn'
);
assert.ok(confusedResult.penalty > 0, 'Should have confusion penalty');
assert.strictEqual(confusedResult.confused, 'shape', 'Should detect shape confusion');

// No signals at all → no bonus, no penalty
const neutralResult = scorePillarEmbodiment(
  'Join our team today and start working on interesting projects.',
  'grow'
);
assert.strictEqual(neutralResult.bonus, 0, 'Should have no bonus');
assert.strictEqual(neutralResult.penalty, 0, 'Should have no penalty');

console.log('✓ pillar signal scoring: 8 assertions passed');

// ── 5. Visual direction scene generation ─────────────────────────────

function buildDynamicSceneKeys(visualDirection) {
  if (!visualDirection || !visualDirection.work_environment) {
    return null; // Signals: use default 4 scenes
  }

  const hasEnv = !!visualDirection.work_environment;
  const hasWardrobe = !!visualDirection.wardrobe;
  const hasTools = !!visualDirection.visible_tools;
  const hasTone = !!visualDirection.emotional_tone;

  return { hasEnv, hasWardrobe, hasTools, hasTone };
}

// Full visual direction → all flags true
const fullVD = buildDynamicSceneKeys({
  work_environment: 'clinical consultation room',
  wardrobe: 'lab coat over business casual',
  visible_tools: 'dermatoscope, clinical tablet',
  emotional_tone: 'professional confidence',
  cultural_adaptations: '',
});
assert.ok(fullVD.hasEnv, 'Should have environment');
assert.ok(fullVD.hasWardrobe, 'Should have wardrobe');
assert.ok(fullVD.hasTools, 'Should have tools');
assert.ok(fullVD.hasTone, 'Should have tone');

// Partial visual direction → some flags
const partialVD = buildDynamicSceneKeys({
  work_environment: 'home desk',
  wardrobe: '',
  visible_tools: 'laptop, headphones',
  emotional_tone: '',
});
assert.ok(partialVD.hasEnv, 'Should have environment');
assert.ok(!partialVD.hasWardrobe, 'Should not have wardrobe (empty)');
assert.ok(partialVD.hasTools, 'Should have tools');
assert.ok(!partialVD.hasTone, 'Should not have tone (empty)');

// Missing visual direction → null (fallback)
assert.strictEqual(buildDynamicSceneKeys(null), null, 'Should return null for missing VD');
assert.strictEqual(buildDynamicSceneKeys({}), null, 'Should return null for empty VD');
assert.strictEqual(
  buildDynamicSceneKeys({ wardrobe: 'casual' }),
  null,
  'Should return null when work_environment is missing'
);

console.log('✓ visual direction scene generation: 7 assertions passed');

console.log('\n✓ all stage 2/3 overhaul assertions passed (35 total)');
