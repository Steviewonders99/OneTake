import assert from 'node:assert/strict';

// Reference implementation of validate_personas in JS. Must match the Python
// implementation in worker/pipeline/persona_validation.py. Any divergence is
// a bug — update both sides in sync.

function validatePersonas(personas, constraints) {
  const violations = [];
  const excluded = (constraints.excluded_archetypes || [])
    .filter((kw) => typeof kw === 'string' && kw.trim())
    .map((kw) => kw.trim().toLowerCase());

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    if (typeof persona !== 'object' || persona === null) {
      violations.push(`Persona at index ${i} is not an object — cannot validate.`);
      continue;
    }
    const personaName = persona.name || `persona_${i + 1}`;

    // Check matched_tier is populated
    if (!persona.matched_tier || !String(persona.matched_tier).trim()) {
      violations.push(
        `Persona '${personaName}' is missing matched_tier — cannot verify it satisfies any acceptable_tier.`
      );
    }

    // Build searchable blob
    const motivations = Array.isArray(persona.motivations)
      ? persona.motivations.join(' ')
      : String(persona.motivations || '');
    const textFields = [
      String(persona.archetype || ''),
      String(persona.lifestyle || ''),
      String(persona.matched_tier || ''),
      motivations,
    ];
    const blob = textFields.join(' ').toLowerCase();

    // Full-substring match on each excluded phrase
    for (const kw of excluded) {
      if (kw && blob.includes(kw)) {
        violations.push(
          `Persona '${personaName}' contains excluded archetype phrase: '${kw}'`
        );
        break; // one violation per persona is enough
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

// ─── Tests ──

// 1. Clean persona passes
{
  const personas = [
    {
      name: 'Dr. Chen',
      archetype: 'Second-year dermatology resident',
      matched_tier: 'Dermatology resident at US teaching hospital',
      lifestyle: 'Long residency hours',
      motivations: ['Build clinical writing portfolio'],
    },
  ];
  const constraints = {
    excluded_archetypes: ['generic gig worker', 'pre-med undergraduate'],
  };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, true, 'Clean persona should pass');
  assert.equal(result.violations.length, 0);
}

// 2. Persona with excluded phrase fails
{
  const personas = [
    {
      name: 'Alex',
      archetype: 'Pre-med undergraduate student',
      matched_tier: 'Undergraduate',
      lifestyle: 'College life',
      motivations: ['earn money'],
    },
  ];
  const constraints = {
    excluded_archetypes: ['pre-med undergraduate'],
  };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, false);
  assert.ok(result.violations[0].includes('pre-med undergraduate'));
}

// 3. Persona with ambiguous keyword passes if it's not an excluded PHRASE
{
  const personas = [
    {
      name: 'Priya Patel',
      archetype: 'Fourth-year medical student on dermatology rotation',
      matched_tier: 'Fourth-year US med student on derm rotation',
      lifestyle: 'Clinical rotations',
      motivations: ['Build residency application portfolio'],
    },
  ];
  const constraints = {
    excluded_archetypes: ['general student without clinical years'],
  };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, true, 'Fourth-year med student should pass');
}

// 4. Persona missing matched_tier fails
{
  const personas = [
    {
      name: 'Jordan',
      archetype: 'Dermatologist',
      lifestyle: 'Private practice',
      motivations: ['Contribute to AI research'],
    },
  ];
  const constraints = { excluded_archetypes: [] };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('matched_tier')));
}

// 5. Empty excluded_archetypes list always passes
{
  const personas = [
    {
      name: 'Kai',
      archetype: 'Any archetype',
      matched_tier: 'Some tier',
      lifestyle: 'Any lifestyle',
      motivations: [],
    },
  ];
  const constraints = { excluded_archetypes: [] };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, true);
}

// 6. Case-insensitive matching
{
  const personas = [
    {
      name: 'Sam',
      archetype: 'Generic GIG Worker',
      matched_tier: 'Gig',
      lifestyle: 'Freelance',
      motivations: [],
    },
  ];
  const constraints = { excluded_archetypes: ['generic gig worker'] };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, false);
  assert.ok(result.violations[0].includes('generic gig worker'));
}

// 7. Non-dict persona fails gracefully
{
  const personas = [null, 'a string', { name: 'OK', matched_tier: 'ok', archetype: 'x', lifestyle: 'x', motivations: [] }];
  const constraints = { excluded_archetypes: [] };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((v) => v.includes('is not an object')));
}

// 8. Non-string items in excluded_archetypes filtered out
{
  const personas = [
    {
      name: 'Alex',
      archetype: 'Dermatologist',
      matched_tier: 'Board-certified dermatologist',
      lifestyle: 'Private practice',
      motivations: [],
    },
  ];
  const constraints = {
    excluded_archetypes: [null, 123, '', '  ', 'pre-med undergraduate'],
  };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, true);
}

console.log('✓ persona validation verifier passed (8 assertion groups)');
