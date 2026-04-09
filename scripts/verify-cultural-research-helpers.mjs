import assert from 'node:assert/strict';

// Reference implementations of derive_work_tier_context and should_run_dimension
// in JS for verification. Must match the Python implementation in
// worker/prompts/cultural_research.py. Any divergence is a bug — update both
// sides in sync.

function deriveWorkTierContext(intakeRow) {
  const parts = [];
  const quals = (intakeRow.qualifications_required || '').trim();
  if (quals) parts.push(quals.split('.')[0].slice(0, 200));
  const loc = (intakeRow.location_scope || '').trim();
  if (loc) parts.push(loc.split('.')[0].slice(0, 120));
  const eng = (intakeRow.engagement_model || '').trim();
  if (eng) parts.push(eng.split('.')[0].slice(0, 120));
  if (parts.length === 0) {
    const taskType = intakeRow.task_type || 'data work';
    return `${taskType} work described in the intake form`;
  }
  return parts.join('. ');
}

function shouldRunDimension(dimensionConfig, intakeRow) {
  const trigger = dimensionConfig.activates_when;
  if (trigger === undefined || trigger === 'always') return true;
  if (typeof trigger === 'object' && trigger !== null) {
    const quals = (intakeRow.qualifications_required || '').toLowerCase();
    if (trigger.qualifications_contain_any) {
      const keywords = trigger.qualifications_contain_any.map((k) => k.toLowerCase());
      return keywords.some((kw) => quals.includes(kw));
    }
    if (trigger.credential_tier_at_or_above) {
      return Boolean(quals.trim());
    }
  }
  return true;
}

// ─── derive_work_tier_context tests ──
assert.equal(
  deriveWorkTierContext({
    qualifications_required: 'Licensed dermatologist (MD/DO) or dermatology resident.',
    location_scope: 'US residents only.',
    engagement_model: 'Ongoing per-approved-asset work.',
  }),
  'Licensed dermatologist (MD/DO) or dermatology resident. US residents only. Ongoing per-approved-asset work'
);

assert.equal(
  deriveWorkTierContext({
    qualifications_required: 'Finnish fluency and ability to read handwritten Finnish.',
    location_scope: 'Worldwide.',
    engagement_model: 'Ongoing hourly annotation work.',
  }),
  'Finnish fluency and ability to read handwritten Finnish. Worldwide. Ongoing hourly annotation work'
);

assert.equal(
  deriveWorkTierContext({ task_type: 'annotation' }),
  'annotation work described in the intake form'
);

assert.equal(
  deriveWorkTierContext({}),
  'data work work described in the intake form'
);

// ─── should_run_dimension tests ──
// always activation
assert.equal(
  shouldRunDimension({ activates_when: 'always' }, {}),
  true
);

// no activation trigger = always
assert.equal(
  shouldRunDimension({}, {}),
  true
);

// qualifications_contain_any positive match
assert.equal(
  shouldRunDimension(
    { activates_when: { qualifications_contain_any: ['MD', 'PhD', 'licensed'] } },
    { qualifications_required: 'Licensed dermatologist (MD/DO)' }
  ),
  true
);

// qualifications_contain_any case-insensitive
assert.equal(
  shouldRunDimension(
    { activates_when: { qualifications_contain_any: ['md', 'phd'] } },
    { qualifications_required: 'Board-certified MD' }
  ),
  true
);

// qualifications_contain_any negative match
assert.equal(
  shouldRunDimension(
    { activates_when: { qualifications_contain_any: ['MD', 'PhD', 'licensed'] } },
    { qualifications_required: 'Finnish fluency' }
  ),
  false
);

// credential_tier_at_or_above positive (non-empty quals)
assert.equal(
  shouldRunDimension(
    { activates_when: { credential_tier_at_or_above: 'language_fluency' } },
    { qualifications_required: 'Finnish fluency' }
  ),
  true
);

// credential_tier_at_or_above negative (empty quals)
assert.equal(
  shouldRunDimension(
    { activates_when: { credential_tier_at_or_above: 'language_fluency' } },
    { qualifications_required: '' }
  ),
  false
);

// credential_tier_at_or_above negative (missing quals)
assert.equal(
  shouldRunDimension(
    { activates_when: { credential_tier_at_or_above: 'language_fluency' } },
    {}
  ),
  false
);

console.log('✓ cultural research helpers verifier passed (12 assertions)');
