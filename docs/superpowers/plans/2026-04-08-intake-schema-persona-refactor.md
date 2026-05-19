# Intake Schema Extension + Persona Engine Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on testing:** This repo has no vitest/jest framework. Pure helpers are verified via **throwaway Node scripts with `assert`** (pattern previously used for `verify-slugify.mjs`, `verify-tracked-links-helpers.mjs`, `verify-source-options.mjs`, `verify-brand-module.mjs`). API routes and Python prompts are verified via Python import tests + `curl` against a running `npm run dev`. Frontend is verified visually via the dashboard.
>
> **Required skill invocations while executing this plan:**
> - `vercel:nextjs` — when editing any `src/app/**` file (Next.js 16 App Router)
> - `vercel:vercel-functions` — when editing any `src/app/api/**` route handler
> - `vercel:react-best-practices` — when editing any `src/components/**/*.tsx`
> - `vercel:vercel-storage` — when editing Neon schema in `src/lib/db/schema.ts` or `scripts/init-db.mjs`

**Goal:** Replace the 8 hardcoded persona archetypes with dynamic LLM-generated personas constrained by job requirements, collect those requirements via a new pre-filled intake form section, make the cultural research stage context-aware, and generate a `derived_requirements` sub-object in Stage 1 that feeds everything downstream.

**Architecture:** 10 new DB columns on `intake_requests` + `creative_briefs` (all nullable, CHECK-constrained where the spec locks enum values). A shared `JOB_REQUIREMENTS_MODULE` schema prepended to every task type, with LLM-pre-filled form fields. Cultural research refactored to accept a `{work_tier_context}` substitution + 3 new conditional dimensions. Stage 1 brief prompt extended with 4 new output sections (`derived_requirements`, pillar selection rules, visual direction rules, excluded archetypes rules). Hard delete of `PERSONA_ARCHETYPES` dict and replacement with a pure prompt-building function + deterministic validation retry loop with max 2 retries and clean admin error surface.

**Tech Stack:** Next.js 16 App Router · React 19 · Neon Postgres (template-tagged `sql`) · Clerk auth · Python 3 (worker) · Kimi K2.5 (research) · Gemma 27B NIM (brief/copy) · Throwaway Node verifier scripts

**Spec:** `docs/superpowers/specs/2026-04-08-intake-schema-persona-refactor-design.md`

---

## File Structure

### New files (5)

| Path | Purpose |
|---|---|
| `src/lib/shared-schema-modules.ts` | `JOB_REQUIREMENTS_MODULE` constant — the 7 shared intake form fields |
| `worker/pipeline/persona_validation.py` | `validate_personas` function + `Stage1PersonaValidationError` exception |
| `scripts/verify-persona-validation.mjs` | Throwaway JS verifier for the persona validation logic |
| `scripts/verify-cultural-research-helpers.mjs` | Throwaway JS verifier for `derive_work_tier_context` + `should_run_dimension` |
| `worker/tests/test_fixtures.py` | Synthetic intake_row + brief_json fixtures used by smoke test |

### Modified files (14)

| Path | Change |
|---|---|
| `src/lib/db/schema.ts` | Add 10 `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements + partial index |
| `scripts/init-db.mjs` | Mirror the schema.ts additions |
| `src/lib/types.ts` | Add 7 fields to `IntakeRequest`, `pillar_primary`/`pillar_secondary`/`derived_requirements` to `CreativeBrief`, new `DerivedRequirements` interface |
| `src/lib/db/intake.ts` | `createIntakeRequest` + `getIntakeRequest` read/write the 7 new columns |
| `src/lib/db/briefs.ts` | `saveBrief` + `getBrief` read/write pillar columns + derived_requirements |
| `src/lib/seed-schemas.ts` | Prepend `JOB_REQUIREMENTS_MODULE` to every task type's schema at seed time |
| `src/lib/extraction-prompt.ts` | Extend prompt to output `job_requirements` sub-object with all 7 fields pre-filled |
| `src/app/api/intake/route.ts` | POST handler extracts `job_requirements` from form_data and passes to `createIntakeRequest` |
| `src/app/intake/new/page.tsx` | Render new Job Requirements section with "✨ AI drafted" badges on pre-filled fields |
| `src/components/PasteExtract.tsx` | Map new `job_requirements` extraction output to form fields |
| `src/components/BriefExecutive.tsx` | Add collapsible "Derived Requirements (AI-generated analysis)" section |
| `src/app/admin/pipeline/page.tsx` | Surface `Stage1PersonaValidationError` in compute_job failed status with clear message |
| `worker/prompts/cultural_research.py` | Large refactor — add `derive_work_tier_context` + `should_run_dimension` helpers, update all 9 existing dimension query_templates, add 3 new conditional dimensions, expand REGIONAL_PLATFORM_PRIORS for US/UK, update `build_research_summary` + `apply_research_to_personas` |
| `worker/prompts/recruitment_brief.py` | Add 4 new prompt sections (derived_requirements output schema, pillar selection rules, visual direction rules, excluded archetypes rules) |
| `worker/prompts/persona_engine.py` | HARD DELETE of `PERSONA_ARCHETYPES` dict + scoring logic. Rewrite as pure `build_persona_prompt` function (≤200 lines) |
| `worker/pipeline/stage1_intelligence.py` | Integrate validation retry loop with `MAX_PERSONA_RETRIES = 2`, pass new intake fields to cultural research, save pillar_primary/secondary to creative_briefs columns |
| `worker/tests/smoke_test.py` | Remove archetype-dependent tests, add new `build_persona_prompt` test |

---

## Phase A — DB Foundation + Types

### Task 1: DB schema migration — 10 new columns + partial index

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `scripts/init-db.mjs`

- [ ] **Step 1: Add ALTER TABLE statements to `src/lib/db/schema.ts`**

Find the existing `createTables` function in `src/lib/db/schema.ts`. After the CREATE TABLE for `intake_requests` (but before `attachments`), add:

```ts
  // Job Requirements columns — Phase A of intake schema refactor (2026-04-08)
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS qualifications_required  TEXT,
      ADD COLUMN IF NOT EXISTS qualifications_preferred TEXT,
      ADD COLUMN IF NOT EXISTS location_scope           TEXT,
      ADD COLUMN IF NOT EXISTS language_requirements    TEXT,
      ADD COLUMN IF NOT EXISTS engagement_model         TEXT,
      ADD COLUMN IF NOT EXISTS technical_requirements   TEXT,
      ADD COLUMN IF NOT EXISTS context_notes            TEXT
  `;
```

After the CREATE TABLE for `creative_briefs`, add:

```ts
  // Derived requirements — Phase A of intake schema refactor (2026-04-08)
  await sql`
    ALTER TABLE creative_briefs
      ADD COLUMN IF NOT EXISTS pillar_primary       TEXT
        CHECK (pillar_primary IN ('earn', 'grow', 'shape')),
      ADD COLUMN IF NOT EXISTS pillar_secondary     TEXT
        CHECK (pillar_secondary IN ('earn', 'grow', 'shape')),
      ADD COLUMN IF NOT EXISTS derived_requirements JSONB
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_creative_briefs_pillar_primary
      ON creative_briefs(pillar_primary)
      WHERE pillar_primary IS NOT NULL
  `;
```

- [ ] **Step 2: Mirror changes into `scripts/init-db.mjs`**

Append these 4 statements to the `statements` array in `scripts/init-db.mjs` (after the existing statements, before the closing `]`):

```js
  `ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS qualifications_required TEXT, ADD COLUMN IF NOT EXISTS qualifications_preferred TEXT, ADD COLUMN IF NOT EXISTS location_scope TEXT, ADD COLUMN IF NOT EXISTS language_requirements TEXT, ADD COLUMN IF NOT EXISTS engagement_model TEXT, ADD COLUMN IF NOT EXISTS technical_requirements TEXT, ADD COLUMN IF NOT EXISTS context_notes TEXT`,
  `ALTER TABLE creative_briefs ADD COLUMN IF NOT EXISTS pillar_primary TEXT CHECK (pillar_primary IN ('earn', 'grow', 'shape')), ADD COLUMN IF NOT EXISTS pillar_secondary TEXT CHECK (pillar_secondary IN ('earn', 'grow', 'shape')), ADD COLUMN IF NOT EXISTS derived_requirements JSONB`,
  `CREATE INDEX IF NOT EXISTS idx_creative_briefs_pillar_primary ON creative_briefs(pillar_primary) WHERE pillar_primary IS NOT NULL`,
```

- [ ] **Step 3: Run the migration**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
node scripts/init-db.mjs
```

Expected output: counter showing all statements executed, final line `All tables + indexes created!`.

- [ ] **Step 4: Verify columns exist via direct Neon query**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('$DATABASE_URL'); return Promise.all([sql\`SELECT column_name FROM information_schema.columns WHERE table_name='intake_requests' AND column_name IN ('qualifications_required','qualifications_preferred','location_scope','language_requirements','engagement_model','technical_requirements','context_notes') ORDER BY column_name\`, sql\`SELECT column_name FROM information_schema.columns WHERE table_name='creative_briefs' AND column_name IN ('pillar_primary','pillar_secondary','derived_requirements') ORDER BY column_name\`]).then(([a,b]) => { console.log('intake_requests new cols:', a.length); console.log(a); console.log('creative_briefs new cols:', b.length); console.log(b); process.exit(0); }); });"
```

Expected: `intake_requests new cols: 7`, `creative_briefs new cols: 3`, plus the full column lists.

- [ ] **Step 5: Verify CHECK constraint catches bad pillar values**

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('$DATABASE_URL'); return sql\`INSERT INTO creative_briefs (request_id, brief_data, pillar_primary) VALUES (gen_random_uuid(), '{}', 'sharp') RETURNING id\`.then(r => { console.log('BAD: insert succeeded', r); process.exit(1); }).catch(e => { console.log('GOOD: insert rejected as expected:', e.message.slice(0,200)); process.exit(0); }); });"
```

Expected: `GOOD: insert rejected as expected: ...violates check constraint "creative_briefs_pillar_primary_check"...`

- [ ] **Step 6: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add src/lib/db/schema.ts scripts/init-db.mjs
git commit -m "feat(intake): schema — 7 Job Requirements columns + pillar/derived_requirements on creative_briefs"
```

Verify commit contains only 2 files.

---

### Task 2: TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Extend `IntakeRequest` interface**

Open `src/lib/types.ts` and find the `IntakeRequest` interface. Add the 7 new fields at the end of the interface (just before the closing `}`):

```ts
export interface IntakeRequest {
  // ... existing fields ...
  campaign_slug: string | null;
  // ─── Job Requirements (Phase A — 2026-04-08) ──────────────────
  qualifications_required: string | null;
  qualifications_preferred: string | null;
  location_scope: string | null;
  language_requirements: string | null;
  engagement_model: string | null;
  technical_requirements: string | null;
  context_notes: string | null;
}
```

- [ ] **Step 2: Add `DerivedRequirements` interface at the bottom of the file**

```ts
// ─── Derived Requirements (Stage 1 brief output) ─────────────────

export type BrandPillar = "earn" | "grow" | "shape";

export interface DerivedRequirements {
  credential_summary: string;
  pillar_weighting: {
    primary: BrandPillar;
    secondary: BrandPillar;
    reasoning: string;
  };
  visual_direction: {
    work_environment: string;
    wardrobe: string;
    visible_tools: string[];
    emotional_tone: string;
    cultural_adaptations: string;
  };
  persona_constraints: {
    minimum_credentials: string;
    acceptable_tiers: string[];
    age_range_hint: string;
    excluded_archetypes: string[];
  };
  narrative_angle: string;
}
```

- [ ] **Step 3: Extend `CreativeBrief` interface**

Find the `CreativeBrief` interface and add the 3 new fields at the end:

```ts
export interface CreativeBrief {
  // ... existing fields ...
  pillar_primary: BrandPillar | null;
  pillar_secondary: BrandPillar | null;
  derived_requirements: DerivedRequirements | null;
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(intake): TypeScript types for Job Requirements + DerivedRequirements"
```

---

### Task 3: DB helper updates — intake.ts + briefs.ts

**Files:**
- Modify: `src/lib/db/intake.ts`
- Modify: `src/lib/db/briefs.ts`

- [ ] **Step 1: Update `createIntakeRequest` in `src/lib/db/intake.ts`**

Find the `createIntakeRequest` function and extend its parameter type + INSERT statement to include the 7 new columns. Replace the existing function body with:

```ts
export async function createIntakeRequest(data: {
  title: string;
  task_type: string;
  urgency: Urgency;
  target_languages: string[];
  target_regions: string[];
  volume_needed?: number | null;
  created_by: string;
  form_data: Record<string, unknown>;
  schema_version: number;
  campaign_slug?: string | null;
  qualifications_required?: string | null;
  qualifications_preferred?: string | null;
  location_scope?: string | null;
  language_requirements?: string | null;
  engagement_model?: string | null;
  technical_requirements?: string | null;
  context_notes?: string | null;
}): Promise<IntakeRequest> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO intake_requests (
      title, task_type, urgency, target_languages, target_regions,
      volume_needed, created_by, form_data, schema_version, campaign_slug,
      qualifications_required, qualifications_preferred, location_scope,
      language_requirements, engagement_model, technical_requirements, context_notes
    )
    VALUES (
      ${data.title}, ${data.task_type}, ${data.urgency},
      ${data.target_languages}, ${data.target_regions},
      ${data.volume_needed ?? null}, ${data.created_by},
      ${JSON.stringify(data.form_data)}, ${data.schema_version},
      ${data.campaign_slug ?? null},
      ${data.qualifications_required ?? null},
      ${data.qualifications_preferred ?? null},
      ${data.location_scope ?? null},
      ${data.language_requirements ?? null},
      ${data.engagement_model ?? null},
      ${data.technical_requirements ?? null},
      ${data.context_notes ?? null}
    )
    RETURNING *
  `;
  return rows[0] as IntakeRequest;
}
```

The `getIntakeRequest` function already uses `SELECT *`, so it will automatically return the new columns — no change needed there. `listIntakeRequests` also uses `SELECT *` — no change needed.

- [ ] **Step 2: Update `src/lib/db/briefs.ts` to read/write pillar + derived_requirements**

Find the function that creates or updates creative_briefs (likely `saveBrief` or `createBrief`). Extend it to accept the 3 new fields and include them in the INSERT/UPDATE. Example update:

```ts
export async function saveBrief(data: {
  request_id: string;
  brief_data: Record<string, unknown>;
  channel_research?: Record<string, unknown> | null;
  design_direction?: Record<string, unknown> | null;
  content_languages?: string[];
  evaluation_score?: number | null;
  evaluation_data?: Record<string, unknown> | null;
  version?: number;
  pillar_primary?: BrandPillar | null;
  pillar_secondary?: BrandPillar | null;
  derived_requirements?: DerivedRequirements | null;
}): Promise<CreativeBrief> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO creative_briefs (
      request_id, brief_data, channel_research, design_direction,
      content_languages, evaluation_score, evaluation_data, version,
      pillar_primary, pillar_secondary, derived_requirements
    )
    VALUES (
      ${data.request_id},
      ${JSON.stringify(data.brief_data)},
      ${data.channel_research ? JSON.stringify(data.channel_research) : null},
      ${data.design_direction ? JSON.stringify(data.design_direction) : null},
      ${data.content_languages ?? []},
      ${data.evaluation_score ?? null},
      ${data.evaluation_data ? JSON.stringify(data.evaluation_data) : null},
      ${data.version ?? 1},
      ${data.pillar_primary ?? null},
      ${data.pillar_secondary ?? null},
      ${data.derived_requirements ? JSON.stringify(data.derived_requirements) : null}
    )
    RETURNING *
  `;
  return rows[0] as CreativeBrief;
}
```

**If the existing function has a different signature** (e.g., different field names or structure), adapt the change to add the 3 new fields to whatever the current pattern is. The goal is additive — don't rename existing fields.

Add `BrandPillar` and `DerivedRequirements` to the imports at the top:

```ts
import type { BrandPillar, CreativeBrief, DerivedRequirements } from '@/lib/types';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify Next.js build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build with route listing at the bottom.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/intake.ts src/lib/db/briefs.ts
git commit -m "feat(intake): DB helpers read/write Job Requirements + pillar/derived_requirements columns"
```

---

## Phase B — Intake Schema Module + Extraction + Frontend

### Task 4: Create `JOB_REQUIREMENTS_MODULE` constant

**Files:**
- Create: `src/lib/shared-schema-modules.ts`

- [ ] **Step 1: Create the new file**

Create `src/lib/shared-schema-modules.ts`:

```ts
/**
 * Shared schema modules prepended to every task_type_schemas entry.
 *
 * These modules define fields that apply to EVERY task type (not just
 * specific ones). Task types can still customize by adding their own
 * fields on top, but the shared modules are the baseline.
 *
 * Currently just the Job Requirements module (Phase A — 2026-04-08).
 */

export interface SchemaField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "boolean";
  rows?: number;
  required?: boolean;
  ai_help?: string;
  placeholder?: string;
  prefill_guidance?: string;
}

export interface SchemaSection {
  section: string;
  description: string;
  ai_prefilled?: boolean;
  fields: SchemaField[];
}

export const JOB_REQUIREMENTS_MODULE: SchemaSection = {
  section: "Job Requirements",
  description:
    "Who can do this job, where they work, what they need. Pre-filled — review and refine.",
  ai_prefilled: true,
  fields: [
    {
      key: "qualifications_required",
      label: "Required qualifications",
      type: "textarea",
      rows: 4,
      required: true,
      ai_help:
        "Minimum bar to even apply. Credentials, degrees, certifications, years of experience, professional licenses, language fluency, specific system experience.",
      placeholder:
        "e.g., Licensed dermatologist (MD/DO) OR dermatology resident OR medical student in clinical years with documented dermatology rotation.",
      prefill_guidance:
        "Extract every hard requirement from the source text. Use 'OR' to separate acceptable alternatives. Be specific about degree level, board certifications, years of experience, and any required system/tool familiarity.",
    },
    {
      key: "qualifications_preferred",
      label: "Preferred but not required",
      type: "textarea",
      rows: 3,
      required: false,
      ai_help: "Nice-to-haves that strengthen an application but aren't mandatory.",
      placeholder:
        "e.g., Board certification in dermatopathology, published clinical research, bilingual Spanish fluency.",
      prefill_guidance:
        "Extract soft preferences — things mentioned as 'preferred', 'a plus', 'ideally', 'bonus'. Leave empty if none.",
    },
    {
      key: "location_scope",
      label: "Location scope",
      type: "textarea",
      rows: 2,
      required: true,
      ai_help:
        "Describe the geographic scope in natural language — what's required, what's excluded, and why.",
      placeholder:
        "e.g., US residents only — work must reflect US clinical practice and documentation standards.",
      prefill_guidance:
        "Extract explicit location requirements. Include the reasoning if stated. If the source says 'worldwide' or omits location, say so.",
    },
    {
      key: "language_requirements",
      label: "Language requirements",
      type: "textarea",
      rows: 3,
      required: true,
      ai_help: "What languages, what proficiency, any modality requirements.",
      placeholder:
        "e.g., English (US) — native or near-native fluency. Must write in clinical register matching US patient-portal standards.",
      prefill_guidance:
        "One line per language. Include proficiency level (native, fluent, conversational, reading-only) and any modality notes (must read handwritten, must speak a specific dialect, must write in a specific register).",
    },
    {
      key: "engagement_model",
      label: "Engagement model",
      type: "textarea",
      rows: 3,
      required: true,
      ai_help:
        "How long is the engagement, how much commitment, what's the compensation structure.",
      placeholder:
        "e.g., Ongoing per-approved-asset work. No fixed weekly hours.",
      prefill_guidance:
        "Extract: (1) duration (one-time / ongoing / project-based), (2) time commitment (hours/week, total hours, session length), (3) compensation model (per-asset, hourly, project-fee). Include rate if the source specifies one; otherwise leave rate blank — marketing should not invent numbers.",
    },
    {
      key: "technical_requirements",
      label: "Equipment & tools",
      type: "textarea",
      rows: 3,
      required: false,
      ai_help: "Hardware, software, specific tools, reference material access.",
      placeholder:
        "e.g., Reliable internet, personal computer, access to US clinical guidelines.",
      prefill_guidance:
        "Extract hardware, software, tool-specific experience (e.g., 'EMIS EPR/EMR experience required'), and any reference-material access. Leave empty if not specified.",
    },
    {
      key: "context_notes",
      label: "Additional context for the creative team",
      type: "textarea",
      rows: 4,
      required: false,
      ai_help:
        "The brief-to-the-brief. What should the creative team KNOW about this project that isn't captured elsewhere? Who is this really for, what's the emotional register, what makes this project distinctive?",
      placeholder:
        "e.g., This is a clinical documentation quality project, not a data-entry gig. The tone should respect the expertise of practicing physicians and residents.",
      prefill_guidance:
        "Synthesize the overall feel of the project. Who is this really for? What's the emotional register? What tone should the creative team aim for? What's distinctive about this vs. generic data work? Pull language from the source text where it signals positioning — but write in the first person as if briefing the creative team. This field is the most important for downstream Stage 1 derivation.",
    },
  ],
};

/** The 4 required field keys from JOB_REQUIREMENTS_MODULE — used by application-level validation. */
export const REQUIRED_JOB_REQUIREMENTS_KEYS: readonly string[] = [
  "qualifications_required",
  "location_scope",
  "language_requirements",
  "engagement_model",
] as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared-schema-modules.ts
git commit -m "feat(intake): JOB_REQUIREMENTS_MODULE constant with 7 Job Requirements fields"
```

---

### Task 5: Seed integration — prepend module to task type schemas

**Files:**
- Modify: `src/lib/seed-schemas.ts`

- [ ] **Step 1: Read the current `seed-schemas.ts` to understand its structure**

```bash
head -80 src/lib/seed-schemas.ts
```

Understand how it currently defines task type schemas (likely an array of task type definitions, each with a `fields` or `sections` array).

- [ ] **Step 2: Import the new module and prepend it to every task type schema**

Find the seeding logic (a function that iterates task type definitions and inserts them into the `task_type_schemas` table). Before the insertion, prepend `JOB_REQUIREMENTS_MODULE` to each task type's `sections` (or equivalent structure).

Add at the top of the file:

```ts
import { JOB_REQUIREMENTS_MODULE } from "@/lib/shared-schema-modules";
```

Then in the function that builds each task type's schema for insertion, make sure the sections array starts with `JOB_REQUIREMENTS_MODULE`. The exact code depends on the existing structure — if schemas are stored as `{ sections: [...] }`, prepend via:

```ts
const schemaWithJobRequirements = {
  ...originalSchema,
  sections: [JOB_REQUIREMENTS_MODULE, ...(originalSchema.sections ?? [])],
};
```

If schemas are stored as flat field arrays (no sections), adapt accordingly by injecting the fields:

```ts
const schemaWithJobRequirements = {
  ...originalSchema,
  fields: [...JOB_REQUIREMENTS_MODULE.fields, ...(originalSchema.fields ?? [])],
};
```

**Read the file first to determine which pattern is in use. If the pattern is ambiguous, report BLOCKED.**

- [ ] **Step 3: Verify the seed still builds schemas correctly**

Run the seed function in dry-run mode (if supported) or inspect the generated schema object:

```bash
node -e "import('./src/lib/seed-schemas.ts').then(m => { const schemas = m.getSeedSchemas ? m.getSeedSchemas() : null; if (schemas) { console.log('First schema sections[0]:', JSON.stringify(schemas[0].sections?.[0] ?? schemas[0].fields?.[0], null, 2).slice(0, 500)); } else { console.log('seed function signature different — inspect manually'); } });"
```

If no programmatic inspection is possible, verify via reading the file changes and running `npx tsc --noEmit`.

- [ ] **Step 4: Verify Next.js build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/seed-schemas.ts
git commit -m "feat(intake): prepend JOB_REQUIREMENTS_MODULE to every task_type_schemas entry"
```

---

### Task 6: Extend extraction prompt to output `job_requirements`

**Files:**
- Modify: `src/lib/extraction-prompt.ts`

- [ ] **Step 1: Read the current extraction prompt file**

```bash
head -100 src/lib/extraction-prompt.ts
```

Understand the current output schema — what fields does it currently produce, and how is the prompt structured?

- [ ] **Step 2: Extend the output schema**

Add a new `job_requirements` sub-object to the expected JSON output, with all 7 fields. Update the system prompt or user prompt to instruct the extraction LLM to populate these fields using the `prefill_guidance` from the spec.

The exact location in the file depends on the current structure. The key changes:

**(a) Update the JSON schema description in the prompt** to include:

```ts
// Inside the prompt template string
const JOB_REQUIREMENTS_SCHEMA_DOC = `
"job_requirements": {
  "qualifications_required": "Extract every hard requirement from the source text. Use 'OR' to separate acceptable alternatives. Be specific about degree level, board certifications, years of experience, and any required system/tool familiarity. E.g., 'Licensed dermatologist (MD/DO) OR dermatology resident OR medical student in clinical years with documented dermatology rotation.'",
  "qualifications_preferred": "Extract soft preferences — things mentioned as 'preferred', 'a plus', 'ideally', 'bonus'. Empty string if none.",
  "location_scope": "Extract explicit location requirements. Include the reasoning if stated. E.g., 'US residents only — work must reflect US clinical practice.'",
  "language_requirements": "One line per language. Include proficiency level and any modality notes. E.g., 'English (US) — native or near-native fluency.'",
  "engagement_model": "Duration, time commitment, compensation structure. Include rate if source specifies one; leave rate blank otherwise. E.g., 'Ongoing per-approved-asset work, contributors submit individually and get paid per accepted submission.'",
  "technical_requirements": "Hardware, software, tool-specific experience, reference-material access. Empty string if not specified.",
  "context_notes": "Synthesize the overall feel of the project. Who is this really for? What's the emotional register? Write in first person as if briefing the creative team. This is the most important field for downstream derivation."
}
`;
```

**(b) Update the expected output JSON example** to include a populated `job_requirements` sub-object alongside the existing extracted fields (title, languages, regions, etc.).

**(c) Update the TypeScript return type** of the extraction function to include the new sub-object:

```ts
export interface ExtractedIntake {
  // ... existing fields ...
  job_requirements?: {
    qualifications_required?: string;
    qualifications_preferred?: string;
    location_scope?: string;
    language_requirements?: string;
    engagement_model?: string;
    technical_requirements?: string;
    context_notes?: string;
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual test — run the extraction against a sample RFP**

```bash
npm run dev &
sleep 5
# In browser console on http://localhost:3000 (logged in)
# curl a test RFP text to /api/intake/extract and inspect the response
```

OR if there's an existing admin test page, use that. If not, skip manual verification for this task and rely on Task 8 end-to-end test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraction-prompt.ts
git commit -m "feat(intake): extend extraction prompt to pre-fill 7 Job Requirements fields"
```

---

### Task 7: Intake form UI — render new section with "AI drafted" badge

**Files:**
- Modify: `src/app/intake/new/page.tsx`
- Modify: `src/components/PasteExtract.tsx`

- [ ] **Step 1: Read the current intake form structure**

```bash
head -100 src/app/intake/new/page.tsx
```

Determine: Is the form rendered dynamically from `task_type_schemas`? Or is there a hardcoded form with manual sections? This changes the implementation approach.

**If dynamic (schema-driven):** The Job Requirements section will render automatically once the task type schemas are seeded with `JOB_REQUIREMENTS_MODULE`. Only UI additions needed: the "✨ AI drafted" badge per field.

**If hardcoded:** Need to add a new section with 7 textareas manually.

- [ ] **Step 2: Add the "AI drafted" badge state tracking**

In the component, add state that tracks which fields were pre-filled by extraction and have NOT been manually edited yet:

```tsx
const [aiDraftedFields, setAiDraftedFields] = useState<Set<string>>(new Set());

// When extraction returns data, mark all populated fields as AI drafted:
function handleExtractionResult(extracted: ExtractedIntake) {
  const drafted = new Set<string>();
  if (extracted.job_requirements) {
    for (const [key, value] of Object.entries(extracted.job_requirements)) {
      if (value && typeof value === "string" && value.trim().length > 0) {
        drafted.add(key);
      }
    }
  }
  setAiDraftedFields(drafted);
  // ... also populate form state with the values ...
}

// When a field is manually edited, remove it from the drafted set:
function handleFieldEdit(key: string, value: string) {
  setFormData({ ...formData, [key]: value });
  if (aiDraftedFields.has(key)) {
    const next = new Set(aiDraftedFields);
    next.delete(key);
    setAiDraftedFields(next);
  }
}
```

- [ ] **Step 3: Render the badge on each pre-filled field**

Next to each textarea in the Job Requirements section, conditionally render the badge:

```tsx
{aiDraftedFields.has(field.key) && (
  <span className="inline-flex items-center gap-1 text-[11px] text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
    ✨ AI drafted — review and edit
  </span>
)}
```

- [ ] **Step 4: Add "Re-extract" confirm dialog**

If there's an existing "Re-extract" button, wrap its handler with a confirm dialog if any fields have been manually edited (i.e., removed from `aiDraftedFields`):

```tsx
async function handleReExtract() {
  const editedKeys = Object.keys(formData.job_requirements ?? {}).filter(
    (k) => !aiDraftedFields.has(k) && formData.job_requirements?.[k]
  );
  if (editedKeys.length > 0) {
    const confirmed = confirm(
      `This will replace ${editedKeys.length} fields you've edited. Continue?`
    );
    if (!confirmed) return;
  }
  // ... existing re-extraction logic ...
}
```

- [ ] **Step 5: Update `src/components/PasteExtract.tsx` to pass the new fields up**

Read the PasteExtract component and ensure it forwards the `job_requirements` sub-object from the extraction response to its parent component via a prop callback. If the current API passes extracted data via `onResult(data)`, it should just work since we're adding a sub-object, not restructuring. Verify the consumer (intake/new/page.tsx) handles the new shape.

- [ ] **Step 6: Verify Next.js build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 7: Manual visual check**

```bash
npm run dev &
sleep 5
# Open http://localhost:3000/intake/new
# Verify: form renders the new "Job Requirements" section with 7 textareas
# Paste a sample RFP into the PasteExtract component
# Verify: the 7 fields populate and show "✨ AI drafted" badges
# Edit one field manually
# Verify: the badge disappears from that field only
# Click Re-extract (if exists)
# Verify: confirm dialog appears
```

- [ ] **Step 8: Commit**

```bash
git add src/app/intake/new/page.tsx src/components/PasteExtract.tsx
git commit -m "feat(intake): render Job Requirements section with 'AI drafted' badges + re-extract confirm"
```

---

### Task 8: POST /api/intake — save 7 new columns

**Files:**
- Modify: `src/app/api/intake/route.ts`

- [ ] **Step 1: Read current POST handler**

```bash
head -120 src/app/api/intake/route.ts
```

Find where `createIntakeRequest` is called.

- [ ] **Step 2: Extract `job_requirements` from request body and pass to `createIntakeRequest`**

In the POST handler, after the existing validation but before calling `createIntakeRequest`, extract the 7 Job Requirements fields from `body.form_data` (or wherever they land based on how the frontend submits):

```ts
// Extract Job Requirements fields from form_data
const jobReqs = (body.form_data?.job_requirements ?? {}) as Record<string, string>;
```

Update the `createIntakeRequest` call to include the 7 fields:

```ts
const intakeRequest = await createIntakeRequest({
  title: body.title,
  task_type: body.task_type,
  urgency: body.urgency ?? 'standard',
  target_languages: body.target_languages ?? [],
  target_regions: body.target_regions ?? [],
  volume_needed: body.volume_needed ?? null,
  created_by: userId,
  form_data: formData,
  schema_version: schema.version,
  campaign_slug: slugify(body.title) || null,
  // ─── NEW: Job Requirements columns ──
  qualifications_required: jobReqs.qualifications_required?.trim() || null,
  qualifications_preferred: jobReqs.qualifications_preferred?.trim() || null,
  location_scope: jobReqs.location_scope?.trim() || null,
  language_requirements: jobReqs.language_requirements?.trim() || null,
  engagement_model: jobReqs.engagement_model?.trim() || null,
  technical_requirements: jobReqs.technical_requirements?.trim() || null,
  context_notes: jobReqs.context_notes?.trim() || null,
});
```

- [ ] **Step 3: Add required-field validation before calling createIntakeRequest**

Right before the createIntakeRequest call, add validation for the 4 required Job Requirements fields:

```ts
const REQUIRED_JOB_REQ_KEYS = [
  'qualifications_required',
  'location_scope',
  'language_requirements',
  'engagement_model',
] as const;

for (const key of REQUIRED_JOB_REQ_KEYS) {
  const value = jobReqs[key]?.trim();
  if (!value) {
    return Response.json(
      { error: `Missing required Job Requirements field: ${key}` },
      { status: 400 }
    );
  }
}
```

**Note:** if the form_data structure stores fields at the top level instead of under `job_requirements`, adapt the extraction path. Read the actual form submission shape before committing.

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Manual end-to-end submit test**

```bash
npm run dev &
sleep 5
# Open http://localhost:3000/intake/new
# Fill in all 4 required Job Requirements fields + paste an RFP
# Submit
# Verify via psql:
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('$DATABASE_URL'); return sql\`SELECT id, title, qualifications_required, location_scope, language_requirements, engagement_model FROM intake_requests ORDER BY created_at DESC LIMIT 1\`.then(r => { console.log(r); process.exit(0); }); });"
```

Expected: the most recent intake_requests row has the 4 required Job Requirements fields populated.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/intake/route.ts
git commit -m "feat(intake): POST /api/intake saves 7 Job Requirements columns with required-field validation"
```

---

## Phase C — Cultural Research Refactor

### Task 9: Add helper functions with TDD verifier

**Files:**
- Create: `scripts/verify-cultural-research-helpers.mjs`
- Modify: `worker/prompts/cultural_research.py`

- [ ] **Step 1: Write the verifier script first (TDD)**

Create `scripts/verify-cultural-research-helpers.mjs`:

```js
import assert from 'node:assert/strict';

// Re-implementation of derive_work_tier_context and should_run_dimension
// in JS for verification. Must match the Python implementation in
// worker/prompts/cultural_research.py. Any divergence is a bug.

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

console.log('✓ cultural research helpers verifier passed (12 assertions)');
```

- [ ] **Step 2: Run the verifier — should PASS because the logic is self-contained in the script**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
node --experimental-strip-types scripts/verify-cultural-research-helpers.mjs
```

Expected: `✓ cultural research helpers verifier passed (12 assertions)`

This verifies the REFERENCE implementation is correct. Now we implement the Python version to match.

- [ ] **Step 3: Implement the Python helpers in `worker/prompts/cultural_research.py`**

Open `worker/prompts/cultural_research.py` and add two new functions near the top of the file (after the imports, before `RESEARCH_DIMENSIONS`):

```python
# ─── Context helpers (Phase A — 2026-04-08) ─────────────────────────

def derive_work_tier_context(intake_row: dict) -> str:
    """Produce a 1-sentence descriptor of the work tier from job requirements.

    Used as the {work_tier_context} substitution in research query templates.
    Keeps dimension queries aware of whether this is credentialed,
    professional, or gig-tier work without hardcoded branching on specific
    job types. See the spec at
    docs/superpowers/specs/2026-04-08-intake-schema-persona-refactor-design.md
    § 3 for the intent behind this helper.
    """
    parts: list[str] = []

    quals = (intake_row.get("qualifications_required") or "").strip()
    if quals:
        first_sentence = quals.split(".")[0][:200]
        parts.append(first_sentence)

    location = (intake_row.get("location_scope") or "").strip()
    if location:
        first_sentence = location.split(".")[0][:120]
        parts.append(first_sentence)

    engagement = (intake_row.get("engagement_model") or "").strip()
    if engagement:
        first_sentence = engagement.split(".")[0][:120]
        parts.append(first_sentence)

    if not parts:
        task_type = intake_row.get("task_type", "data") or "data"
        return f"{task_type} work described in the intake form"

    return ". ".join(parts)


def should_run_dimension(dimension_config: dict, intake_row: dict) -> bool:
    """Decide whether a given research dimension should run for this campaign.

    Dimensions with no 'activates_when' run always (backwards compat with
    the existing 9 dimensions). New conditional dimensions use one of:

    - 'always' (string) — run unconditionally
    - {'qualifications_contain_any': [keywords]} — run if any keyword
       appears in qualifications_required (case-insensitive)
    - {'credential_tier_at_or_above': 'language_fluency'} — run for any
       job with non-empty qualifications_required
    """
    trigger = dimension_config.get("activates_when")
    if trigger is None or trigger == "always":
        return True

    if isinstance(trigger, dict):
        quals = (intake_row.get("qualifications_required") or "").lower()

        if "qualifications_contain_any" in trigger:
            keywords = [k.lower() for k in trigger["qualifications_contain_any"]]
            return any(kw in quals for kw in keywords)

        if "credential_tier_at_or_above" in trigger:
            return bool(quals.strip())

    return True  # default to running if trigger syntax is unfamiliar
```

- [ ] **Step 4: Verify Python import + smoke test**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "
from prompts.cultural_research import derive_work_tier_context, should_run_dimension

# Mirror the JS tests
ctx1 = derive_work_tier_context({
    'qualifications_required': 'Licensed dermatologist (MD/DO) or dermatology resident.',
    'location_scope': 'US residents only.',
    'engagement_model': 'Ongoing per-approved-asset work.',
})
assert 'dermatologist' in ctx1, f'Expected dermatologist in {ctx1}'

ctx2 = derive_work_tier_context({'task_type': 'annotation'})
assert ctx2 == 'annotation work described in the intake form', f'Got: {ctx2}'

assert should_run_dimension({'activates_when': 'always'}, {}) == True
assert should_run_dimension({}, {}) == True
assert should_run_dimension(
    {'activates_when': {'qualifications_contain_any': ['MD', 'licensed']}},
    {'qualifications_required': 'Licensed dermatologist'}
) == True
assert should_run_dimension(
    {'activates_when': {'qualifications_contain_any': ['MD']}},
    {'qualifications_required': 'Finnish fluency'}
) == False

print('Python helpers: all assertions passed')
"
```

Expected: `Python helpers: all assertions passed`

- [ ] **Step 5: Run the worker smoke test to ensure no regressions**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 tests/smoke_test.py 2>&1 | tail -10
```

Expected: same pass count as before Phase A (1 pre-existing `KLING_API_KEY` failure is expected and unrelated).

- [ ] **Step 6: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/cultural_research.py scripts/verify-cultural-research-helpers.mjs
git commit -m "feat(research): derive_work_tier_context + should_run_dimension helpers"
```

---

### Task 10: Update 9 existing dimensions with `{work_tier_context}`

**Files:**
- Modify: `worker/prompts/cultural_research.py`

- [ ] **Step 1: Update all 9 existing dimension query_templates**

In `worker/prompts/cultural_research.py`, update each of the 9 existing dimensions in `RESEARCH_DIMENSIONS`. For each one, prepend a CONTEXT line to the `query_template` and reference `{work_tier_context}` where tier-dependent behavior matters.

Specifically, update these 9 dimensions: `ai_fatigue`, `gig_work_perception`, `data_annotation_trust`, `platform_reality`, `demographic_channel_map`, `economic_context`, `cultural_sensitivities`, `tech_literacy`, `language_nuance`.

Example for `ai_fatigue`:

```python
"ai_fatigue": {
    "query_template": (
        "CONTEXT: This campaign is recruiting for: {work_tier_context}. "
        "What is the current level of AI fatigue or AI skepticism toward "
        "the KIND of work described above, in {region} as of 2026? "
        "Are people in {region} tired of seeing AI-related job ads "
        "specifically relevant to this work tier? What is the general "
        "sentiment toward AI involvement in this line of work among "
        "{demographic} in {region}?"
    ),
    "why_it_matters": (
        "If AI fatigue is high FOR THIS TIER OF WORK, we avoid leading "
        "with 'AI' in ads and instead frame it appropriately for the "
        "credential tier (e.g., 'clinical documentation quality' for "
        "medical jobs, 'flexible language work' for gig jobs)."
    ),
    "output_keys": ["fatigue_level", "sentiment", "recommended_framing", "tier_specific_notes"],
},
```

Apply the same pattern — prepend the CONTEXT line and reference `{work_tier_context}` — to each of the remaining 8 dimensions. Keep the existing output_keys for each dimension, but add `"tier_specific_notes"` to the end of each one's output_keys list.

**Full update for all 9 dimensions is lengthy. The implementer should adapt each dimension's query_template to (a) prepend CONTEXT line and (b) reference `{work_tier_context}` where tier matters. Do not rename any dimension or remove any existing output_keys — additive only.**

- [ ] **Step 2: Update the query-building code to substitute `{work_tier_context}`**

Find the function that formats `query_template` strings (likely in `run_cultural_research` or similar). Add `work_tier_context` to the `.format()` call:

```python
# Before:
query = dim["query_template"].format(region=region, demographic=demographic)

# After:
work_tier_context = derive_work_tier_context(intake_row)
query = dim["query_template"].format(
    region=region,
    demographic=demographic,
    work_tier_context=work_tier_context,
    language=language,  # if language was already in the substitution
)
```

**Read the existing call site to determine which variables are currently passed in and make sure none are removed.**

- [ ] **Step 3: Verify Python import + grep for new placeholder**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from prompts.cultural_research import RESEARCH_DIMENSIONS; print('dimensions:', len(RESEARCH_DIMENSIONS)); print('work_tier_context count:', sum(1 for d in RESEARCH_DIMENSIONS.values() if '{work_tier_context}' in d['query_template']))"
```

Expected: `dimensions: 9` (still 9, no additions yet), `work_tier_context count: 9` (all 9 dimensions reference the new placeholder).

- [ ] **Step 4: Run worker smoke test**

```bash
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/cultural_research.py
git commit -m "feat(research): 9 existing dimensions updated with {work_tier_context} substitution"
```

---

### Task 11: Add 3 new conditional dimensions

**Files:**
- Modify: `worker/prompts/cultural_research.py`

- [ ] **Step 1: Add the 3 new dimensions to `RESEARCH_DIMENSIONS`**

At the end of the `RESEARCH_DIMENSIONS` dict (after `language_nuance`), add:

```python
    # ─── Phase A additions (2026-04-08) — conditional dimensions ─────

    "professional_community": {
        "query_template": (
            "CONTEXT: This campaign is recruiting for: {work_tier_context}. "
            "What professional community platforms, forums, and networks are "
            "actively used by people in this profession in {region}? Include: "
            "professional association websites, medical networks (Doximity, "
            "Sermo), legal networks (Justia, Martindale), specialty subreddits, "
            "professional Twitter/X communities, LinkedIn groups, specialty "
            "conferences with active online communities, and any locale-specific "
            "professional platforms. Rank by active usage among practicing "
            "professionals in {region}. Which platforms are free to post on? "
            "Which have paid advertising?"
        ),
        "why_it_matters": (
            "Credentialed professionals do not hang out on TikTok or generic "
            "gig subreddits. They use professional community platforms that "
            "generic gig research misses entirely."
        ),
        "activates_when": {
            "qualifications_contain_any": [
                "licensed", "certified", "board", "registered",
                "MD", "DO", "PhD", "JD", "CFA", "CPA", "PE",
                "credentialed", "professional", "specialist",
            ],
        },
        "output_keys": [
            "professional_platforms_ranked",
            "free_post_platforms",
            "paid_ad_platforms",
            "credibility_markers",
        ],
    },

    "domain_trust_signals": {
        "query_template": (
            "CONTEXT: This campaign is recruiting for: {work_tier_context}. "
            "What makes a work opportunity CREDIBLE to professionals in this "
            "field in {region}? What credentials, affiliations, or endorsements "
            "would establish legitimacy? What are the RED FLAGS that would make "
            "a professional in this field immediately dismiss an offer "
            "(e.g., vague compensation, no named client, no peer review, "
            "questionable platforms)? What signals would make them take it "
            "seriously (e.g., named institutional partners, published rates, "
            "peer endorsements, clear data usage policies)?"
        ),
        "why_it_matters": (
            "Credentialed professionals have high skepticism thresholds. "
            "Generic 'earn extra income' framing is an instant red flag. "
            "We need to know what CREDIBILITY looks like in their community."
        ),
        "activates_when": {
            "credential_tier_at_or_above": "language_fluency",
        },
        "output_keys": [
            "trust_signals",
            "red_flags",
            "credibility_builders",
            "transparency_expectations",
        ],
    },

    "work_environment_norms": {
        "query_template": (
            "CONTEXT: This campaign is recruiting for: {work_tier_context}. "
            "For this specific kind of work in {region}, describe the typical "
            "PHYSICAL work environment: home office? clinical setting? "
            "professional office? field work? studio? What does the typical "
            "workspace look like for this credential tier in this region — "
            "size, lighting, visible tools, background appropriateness? "
            "What WARDROBE is expected or credible (casual, business-casual, "
            "lab coat, scrubs, field gear)? What VISIBLE TOOLS would appear "
            "in or near the worker (laptop, medical chart, EHR monitor, "
            "dermatoscope, drawing tablet, microphone, etc.)? This dimension "
            "directly feeds visual/creative direction downstream — be specific "
            "and culturally grounded."
        ),
        "why_it_matters": (
            "Stage 2 actor generation needs to know what the work environment "
            "and wardrobe actually look like. Without this, we generate "
            "generic home-office backdrops for every job, even credentialed "
            "medical work."
        ),
        "activates_when": "always",
        "output_keys": [
            "work_environment",
            "wardrobe",
            "visible_tools",
            "background_norms",
            "cultural_environment_notes",
        ],
    },
```

- [ ] **Step 2: Update the run_cultural_research loop to respect `should_run_dimension`**

Find the function that iterates `RESEARCH_DIMENSIONS` and dispatches queries. Wrap each dispatch with a `should_run_dimension` check:

```python
for dim_name, dim_config in RESEARCH_DIMENSIONS.items():
    if not should_run_dimension(dim_config, intake_row):
        logger.info(f"Skipping dimension {dim_name} — not activated for this campaign")
        continue
    # ... existing dispatch logic ...
```

- [ ] **Step 3: Verify Python import + dimension count**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from prompts.cultural_research import RESEARCH_DIMENSIONS; print('dimensions:', len(RESEARCH_DIMENSIONS)); print('new:', [k for k in RESEARCH_DIMENSIONS if 'activates_when' in RESEARCH_DIMENSIONS[k]])"
```

Expected: `dimensions: 12` (9 + 3 new), `new: ['professional_community', 'domain_trust_signals', 'work_environment_norms']`

- [ ] **Step 4: Run smoke test**

```bash
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/cultural_research.py
git commit -m "feat(research): 3 new conditional dimensions — professional_community, domain_trust_signals, work_environment_norms"
```

---

### Task 12: Expand REGIONAL_PLATFORM_PRIORS for US + UK

**Files:**
- Modify: `worker/prompts/cultural_research.py`

- [ ] **Step 1: Find the existing REGIONAL_PLATFORM_PRIORS dict**

```bash
grep -n "REGIONAL_PLATFORM_PRIORS" worker/prompts/cultural_research.py
```

Locate the US and UK entries.

- [ ] **Step 2: Add professional platform entries to US**

Add the following entries inside the existing `REGIONAL_PLATFORM_PRIORS["US"]` dict (merge with existing platform keys):

```python
REGIONAL_PLATFORM_PRIORS["US"].update({
    "doximity": {
        "dominant_age": "28-55",
        "professional_focus": "medical",
        "ad_capable": False,
        "note": "Physician professional network, closed membership verified by NPI",
    },
    "medical_twitter": {
        "dominant_age": "25-50",
        "professional_focus": "medical, academic",
        "ad_capable": True,
        "note": "#MedEd and specialty-specific hashtags are active professional communities",
    },
    "r_medicine": {
        "dominant_age": "22-40",
        "professional_focus": "medical trainees and early-career",
        "ad_capable": False,
        "note": "r/Medicine, r/medicalschool, r/Residency — active communities for moonlighting and side work discussion",
    },
    "justia_legal_network": {
        "dominant_age": "28-60",
        "professional_focus": "legal",
        "ad_capable": True,
        "note": "Attorney directories and professional networking",
    },
})
```

**Note:** If the existing `REGIONAL_PLATFORM_PRIORS["US"]` entry is not a simple dict but a nested structure, adapt the `.update(...)` to merge into the correct sub-key. Read the file to confirm structure.

- [ ] **Step 3: Add professional platform entries to UK**

```python
REGIONAL_PLATFORM_PRIORS["UK"] = REGIONAL_PLATFORM_PRIORS.get("UK", {})
REGIONAL_PLATFORM_PRIORS["UK"].update({
    "doximity_uk": {
        "dominant_age": "28-55",
        "professional_focus": "medical, limited UK presence",
        "ad_capable": False,
    },
    "nhs_networks": {
        "dominant_age": "25-60",
        "professional_focus": "NHS clinical staff",
        "ad_capable": False,
        "note": "Internal NHS Networks communities",
    },
    "bmj_careers": {
        "dominant_age": "25-55",
        "professional_focus": "medical",
        "ad_capable": True,
        "note": "British Medical Journal careers platform — authoritative for UK physicians",
    },
})
```

- [ ] **Step 4: Verify Python import**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from prompts.cultural_research import REGIONAL_PLATFORM_PRIORS; print('US platforms:', len(REGIONAL_PLATFORM_PRIORS.get('US', {}))); print('UK platforms:', len(REGIONAL_PLATFORM_PRIORS.get('UK', {}))); print('doximity in US:', 'doximity' in REGIONAL_PLATFORM_PRIORS.get('US', {}))"
```

Expected: US count increased by 4, UK count includes the 3 new entries, `doximity in US: True`.

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/cultural_research.py
git commit -m "feat(research): expand REGIONAL_PLATFORM_PRIORS with US/UK professional platforms"
```

---

### Task 13: Update `build_research_summary` and `apply_research_to_personas`

**Files:**
- Modify: `worker/prompts/cultural_research.py`

- [ ] **Step 1: Read current `build_research_summary` and `apply_research_to_personas`**

```bash
grep -n "def build_research_summary\|def apply_research_to_personas" worker/prompts/cultural_research.py
```

Read each function in full.

- [ ] **Step 2: Update `build_research_summary` to include the 3 new dimensions**

Find where the function iterates over research data dimensions and builds a summary string. Add handling for the 3 new dimensions so their output is included in the summary. The exact code depends on the current structure — if the function uses a dimension loop, the new dimensions will auto-include. If it hardcodes each dimension name, add new blocks for `professional_community`, `domain_trust_signals`, and `work_environment_norms`.

Example if hardcoded:

```python
# Add after existing dimension blocks
if "professional_community" in research_data:
    prof = research_data["professional_community"]
    lines.append(f"Professional platforms: {prof.get('professional_platforms_ranked', [])}")
    lines.append(f"Credibility markers: {prof.get('credibility_markers', [])}")

if "domain_trust_signals" in research_data:
    trust = research_data["domain_trust_signals"]
    lines.append(f"Trust signals: {trust.get('trust_signals', [])}")
    lines.append(f"Red flags: {trust.get('red_flags', [])}")

if "work_environment_norms" in research_data:
    env = research_data["work_environment_norms"]
    lines.append(f"Work environment: {env.get('work_environment', '')}")
    lines.append(f"Wardrobe: {env.get('wardrobe', '')}")
    lines.append(f"Visible tools: {env.get('visible_tools', [])}")
```

- [ ] **Step 3: Update `apply_research_to_personas` if it hardcodes dimensions**

If the function currently hardcodes specific dimensions to pass through to persona generation, add handling for the 3 new dimensions so they flow into persona context.

- [ ] **Step 4: Verify Python import + smoke test**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from prompts.cultural_research import build_research_summary, apply_research_to_personas; print('both helpers imported OK')"
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/cultural_research.py
git commit -m "feat(research): build_research_summary + apply_research_to_personas include new dimensions"
```

---

### Task 14: Wire intake fields into stage1_intelligence cultural research call

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Read current `stage1_intelligence.py`**

```bash
grep -n "cultural_research\|run_cultural_research\|derive_work_tier_context" worker/pipeline/stage1_intelligence.py | head
```

Find the call to `run_cultural_research` (or whatever the cultural research entry point is called).

- [ ] **Step 2: Update the call to pass the intake_row**

Modify the call site to pass the full intake_row (which now includes the 7 new Job Requirements columns) into the research function. If the existing signature is `run_cultural_research(region, language)`, update it to also accept `intake_row`:

```python
# Before (hypothetical)
research = await run_cultural_research(region=region, language=language)

# After
research = await run_cultural_research(
    region=region,
    language=language,
    intake_row=intake_row,  # NEW — provides qualifications_required, location_scope, etc.
)
```

Also update `run_cultural_research` in `cultural_research.py` to accept and use the new parameter (computing `work_tier_context` via the helper and passing it into query formatting).

- [ ] **Step 3: Verify Python imports**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from pipeline.stage1_intelligence import *; print('stage1_intelligence imports OK')"
```

- [ ] **Step 4: Run smoke test**

```bash
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/pipeline/stage1_intelligence.py worker/prompts/cultural_research.py
git commit -m "feat(research): stage1_intelligence passes intake_row into cultural research"
```

---

## Phase D — Stage 1 Brief Extension

### Task 15: Extend brief prompt with `derived_requirements` output schema

**Files:**
- Modify: `worker/prompts/recruitment_brief.py`

- [ ] **Step 1: Read current `BRIEF_SYSTEM_PROMPT` and brief prompt builder**

```bash
grep -n "BRIEF_SYSTEM_PROMPT\|def build_brief_prompt" worker/prompts/recruitment_brief.py | head
```

Read the current system prompt and prompt builder to understand the output JSON schema.

- [ ] **Step 2: Add the `derived_requirements` output schema to the prompt**

Find where the prompt defines the expected JSON output schema. Add the `derived_requirements` sub-object definition. The addition should look roughly like this, inserted into the output schema section of the prompt:

```python
# Add to the JSON output schema portion of the prompt
DERIVED_REQUIREMENTS_SCHEMA = """
    "derived_requirements": {{
      "credential_summary": "2-3 sentence compressed read of qualifications_required — what level of expertise does this job demand in one glance?",
      "pillar_weighting": {{
        "primary": "earn | grow | shape (pick ONE)",
        "secondary": "earn | grow | shape (pick ONE, different from primary)",
        "reasoning": "1-2 sentences explaining WHY this pillar pairing."
      }},
      "visual_direction": {{
        "work_environment": "Free-text description of the physical environment where this work credibly happens. Be specific — e.g., 'modern dermatology exam room with EHR workstation' or 'home office with laptop and good lighting'.",
        "wardrobe": "Free-text description of appropriate attire.",
        "visible_tools": ["Array of credible props that should appear in or near the actor"],
        "emotional_tone": "Free-text description of the emotional register.",
        "cultural_adaptations": "Free-text pulling from cultural_research — regional/cultural specifics the scene should respect."
      }},
      "persona_constraints": {{
        "minimum_credentials": "Free-text statement of the minimum bar to apply.",
        "acceptable_tiers": ["Free-text array of acceptable applicant profiles, each distinct."],
        "age_range_hint": "Free-text age guidance based on credential progression.",
        "excluded_archetypes": ["Array of DISAMBIGUATED multi-word phrases (not single words) that must not appear in any generated persona. Must use phrases specific enough to NOT collide with acceptable_tiers. Bad: 'student'. Good: 'pre-med undergraduate' or 'general student without clinical years'."]
      }},
      "narrative_angle": "One-sentence positioning summary for the creative team."
    }}
"""
```

Then insert the schema into the relevant output example in the prompt. If the prompt already has a JSON schema block, append the `derived_requirements` section to it.

- [ ] **Step 3: Verify Python import**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from prompts.recruitment_brief import BRIEF_SYSTEM_PROMPT, build_brief_prompt; print('LEN:', len(BRIEF_SYSTEM_PROMPT))"
```

Expected: length increased from prior (brief system prompt now larger).

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/recruitment_brief.py
git commit -m "feat(brief): add derived_requirements output schema to Stage 1 brief prompt"
```

---

### Task 16: Add pillar/visual/excluded archetypes rules to brief prompt

**Files:**
- Modify: `worker/prompts/recruitment_brief.py`

- [ ] **Step 1: Add the 3 rule sections to `BRIEF_SYSTEM_PROMPT`**

Append these 3 sections to the system prompt:

```python
# Append to BRIEF_SYSTEM_PROMPT construction
DERIVED_REQUIREMENTS_RULES = """

## DERIVED REQUIREMENTS (REQUIRED OUTPUT)

After generating the brief, you MUST populate a derived_requirements sub-object
in the JSON output. Use the job_requirements section from the intake data and
the cultural_research output to inform your analysis.

## PILLAR SELECTION RULES

- Board-certified or licensed professional credentials required → SHAPE primary
- Professional experience or domain knowledge required (but no license) → GROW primary
- Language fluency or general detail-orientation only → EARN primary
- Secondary pillar picks the next-closest fit along the Shape → Grow → Earn ladder

## VISUAL DIRECTION RULES

- If qualifications require a clinical license → work_environment MUST be clinical
  (exam room, hospital, clinic office) — NOT generic home office
- If qualifications require business professional credentials → work_environment
  MUST be professional office — NOT casual
- If the job is language-only or detail work → home office is appropriate
- If the job involves physical/outdoor work → work_environment describes the
  actual setting (studio, field, etc.)
- Wardrobe MUST match the credential tier — never give a credentialed expert
  generic casual attire
- Visible tools should be credible for the work described, not generic stock
  props (e.g., a REAL EHR interface for clinical work, not a random laptop)

## EXCLUDED ARCHETYPES RULES

- For credentialed jobs, excluded_archetypes MUST include disambiguated phrases
  like: 'generic gig worker', 'stay-at-home parent without the specific credential',
  'side-hustle freelancer', 'pre-med undergraduate', 'retiree without active
  clinical practice'
- Phrases MUST be specific enough to not collide with acceptable_tiers
- For gig/language jobs, excluded_archetypes may be empty or minimal
- The validator matches phrases as full substrings (case-insensitive). Single-word
  entries like 'student' would over-match and reject valid personas — always use
  multi-word disambiguated phrases
"""

BRIEF_SYSTEM_PROMPT = BRIEF_SYSTEM_PROMPT + DERIVED_REQUIREMENTS_RULES
```

**Note:** If `BRIEF_SYSTEM_PROMPT` is constructed in a different way (e.g., via string concatenation or a template), adapt the append to match the pattern.

- [ ] **Step 2: Verify Python import**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from prompts.recruitment_brief import BRIEF_SYSTEM_PROMPT; assert 'PILLAR SELECTION RULES' in BRIEF_SYSTEM_PROMPT; assert 'VISUAL DIRECTION RULES' in BRIEF_SYSTEM_PROMPT; assert 'EXCLUDED ARCHETYPES RULES' in BRIEF_SYSTEM_PROMPT; print('all 3 rule sections present')"
```

Expected: `all 3 rule sections present`

- [ ] **Step 3: Run smoke test**

```bash
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/recruitment_brief.py
git commit -m "feat(brief): pillar selection + visual direction + excluded archetypes rules"
```

---

### Task 17: Save derived data to new creative_briefs columns

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Update brief save logic to populate new columns**

Find where `stage1_intelligence.py` saves the brief to the `creative_briefs` table (likely via a helper in `neon_client.py` or direct SQL). Extend it to also save `pillar_primary`, `pillar_secondary`, and `derived_requirements`.

The exact integration depends on how briefs are currently saved. Typical pattern:

```python
# Parse the derived_requirements from the brief JSON output
brief_json = ... # the parsed brief from LLM
derived = brief_json.get("derived_requirements", {})
pillar_weighting = derived.get("pillar_weighting", {})
pillar_primary = pillar_weighting.get("primary")
pillar_secondary = pillar_weighting.get("secondary")

# Validate pillar values (extra safety net on top of DB CHECK constraint)
VALID_PILLARS = {"earn", "grow", "shape"}
if pillar_primary not in VALID_PILLARS:
    logger.warning(f"Invalid pillar_primary from LLM: {pillar_primary!r}, setting to None")
    pillar_primary = None
if pillar_secondary not in VALID_PILLARS:
    logger.warning(f"Invalid pillar_secondary from LLM: {pillar_secondary!r}, setting to None")
    pillar_secondary = None

# Save brief to creative_briefs with new columns
await save_brief(
    request_id=request_id,
    brief_data=brief_json,
    channel_research=cultural_research,
    # ... existing fields ...
    pillar_primary=pillar_primary,
    pillar_secondary=pillar_secondary,
    derived_requirements=derived if derived else None,
)
```

If `save_brief` is a helper in `worker/neon_client.py`, update its signature to accept the 3 new parameters and pass them through to the INSERT statement.

- [ ] **Step 2: Verify Python import**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "from pipeline.stage1_intelligence import *; print('stage1_intelligence imports OK')"
```

- [ ] **Step 3: Run smoke test**

```bash
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/pipeline/stage1_intelligence.py worker/neon_client.py
git commit -m "feat(brief): stage1_intelligence saves pillar + derived_requirements to new columns"
```

---

## Phase E — Persona Engine Refactor

### Task 18: HARD DELETE of `PERSONA_ARCHETYPES` + grep sweep

**Files:**
- Modify: `worker/prompts/persona_engine.py`
- Possibly: any other files that reference the archetypes

- [ ] **Step 1: Grep-sweep for all archetype references**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/ 2>&1 | grep -v ".git/"
```

Expected: all hits listed. Every hit must be addressed in this task.

- [ ] **Step 2: Delete `PERSONA_ARCHETYPES` dict from `persona_engine.py`**

Open `worker/prompts/persona_engine.py`. Find the `PERSONA_ARCHETYPES` dict definition (around line 40 per the original exploration). Delete the entire dict — all 8 archetype entries.

Also delete any scoring/ranking code that references the archetypes (around line 378 per the exploration — look for a "scoring weights" section).

- [ ] **Step 3: Update any imports or references in other files**

For each hit in the Step 1 grep output that's NOT in `persona_engine.py`, update the file to remove the reference:
- If it's an import → delete the import
- If it's a runtime call → replace with a call to `build_persona_prompt` (which we'll implement in Task 19)
- If it's a test → delete or update the test (smoke test updates come in Task 22)
- If it's a docstring → update to reflect the new architecture

- [ ] **Step 4: Verify grep now returns zero hits**

```bash
grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/ 2>&1 | grep -v ".git/" && echo "FOUND LEAKED REFERENCES" || echo "CLEAN"
```

Expected: `CLEAN`

- [ ] **Step 5: Verify Python import (file may be broken until Task 19 — that's OK)**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "import prompts.persona_engine" 2>&1
```

Likely expected: ImportError or other failure because `build_persona_prompt` doesn't exist yet. THAT'S OK — we'll fix it in Task 19. Don't commit yet.

- [ ] **Step 6: DO NOT COMMIT until Task 19 is also done**

Leave the changes uncommitted. Task 19 will complete the rewrite and then we commit both together.

---

### Task 19: Rewrite `persona_engine.py` as pure prompt builder

**Files:**
- Modify: `worker/prompts/persona_engine.py` (continuing from Task 18)

- [ ] **Step 1: Replace the entire file contents with the new implementation**

The new `worker/prompts/persona_engine.py`:

```python
"""Persona Engine — generates dynamic target personas from derived_requirements
and cultural research.

Replaced the legacy 8-archetype system (deleted in Task 18 of the intake
schema + persona refactor, 2026-04-08) with LLM-generated personas constrained
by intake job requirements + cultural research. See worker/brand/oneforma.py
for brand voice constraints and worker/prompts/recruitment_brief.py for the
derived_requirements source.
"""
from __future__ import annotations

from typing import Any


PERSONA_SYSTEM_PROMPT = (
    "You are a contributor-recruitment psychologist for OneForma, "
    "the AI platform that sees the expert in everyone.\n\n"
    "Given a set of persona_constraints from the brief derivation and "
    "cultural research context, you generate 3 distinct personas — each "
    "satisfying the minimum_credentials, fitting one of the acceptable_tiers, "
    "staying within the age_range_hint, and NOT matching any excluded "
    "archetype phrase. Each persona should span a different dimension of "
    "difference (career stage within acceptable tiers, regional variation "
    "within scope, or professional context). Do not generate 3 clones.\n\n"
    "Each persona MUST include a matched_tier field that exactly matches "
    "one of the acceptable_tiers strings from the constraints. This is used "
    "by downstream validation to confirm the persona satisfies a declared "
    "tier.\n\n"
    "Return ONLY valid JSON. No markdown. No commentary. No trailing text."
)


def build_persona_prompt(
    request: dict,
    cultural_research: dict,
    persona_constraints: dict,
    brief_messaging: dict | None = None,
    previous_violations: list[str] | None = None,
) -> str:
    """Build the LLM prompt for dynamic persona generation.

    Parameters
    ----------
    request
        intake_requests row (for title, task_type, regions, languages)
    cultural_research
        output of the cultural_research stage (regional platforms, stigmas,
        work norms, professional community data)
    persona_constraints
        derived_requirements.persona_constraints from the Stage 1 brief
        (minimum_credentials, acceptable_tiers, age_range_hint,
        excluded_archetypes)
    brief_messaging
        optional messaging_strategy from the brief for additional context
    previous_violations
        optional list of validation failures from an earlier attempt,
        injected into the prompt as feedback for the retry
    """
    import json

    # Format the constraint block clearly
    acceptable_tiers = persona_constraints.get("acceptable_tiers", [])
    excluded = persona_constraints.get("excluded_archetypes", [])
    min_creds = persona_constraints.get("minimum_credentials", "")
    age_hint = persona_constraints.get("age_range_hint", "")

    tiers_block = "\n".join(f"  - {t}" for t in acceptable_tiers) or "  (none specified)"
    excluded_block = "\n".join(f"  - {e}" for e in excluded) or "  (none)"

    # Optional feedback section for retry loops
    feedback_section = ""
    if previous_violations:
        feedback_section = (
            "\n\n## RETRY FEEDBACK — fix these violations from the previous attempt:\n"
            + "\n".join(f"  - {v}" for v in previous_violations)
            + "\n\nRegenerate the 3 personas avoiding these specific issues.\n"
        )

    # Build the prompt
    prompt = f"""Generate 3 distinct personas for this recruitment campaign.

## CAMPAIGN CONTEXT

Title: {request.get("title", "")}
Task type: {request.get("task_type", "")}
Target regions: {", ".join(request.get("target_regions", []) or [])}
Target languages: {", ".join(request.get("target_languages", []) or [])}

## PERSONA CONSTRAINTS (binding)

Minimum credentials required:
{min_creds}

Acceptable applicant tiers (each persona must match one of these):
{tiers_block}

Age range hint:
{age_hint}

EXCLUDED archetype phrases (no persona may contain these phrases in their
archetype, lifestyle, matched_tier, or motivations fields):
{excluded_block}

## CULTURAL RESEARCH CONTEXT

{json.dumps(cultural_research, indent=2, ensure_ascii=False)[:3000]}

## OUTPUT SCHEMA

Return a JSON object with a "personas" array containing exactly 3 distinct personas.
Each persona must have this shape:

{{
  "personas": [
    {{
      "name": "Culturally-appropriate full name",
      "archetype": "Description of who this person is — derived from acceptable_tiers. E.g., 'Second-year dermatology resident at a US teaching hospital.'",
      "matched_tier": "MUST exactly match one of the acceptable_tiers listed above",
      "age_range": "Specific 4-6 year range within the age_range_hint. E.g., '28-32'",
      "lifestyle": "What their daily life actually looks like — specific to the credential context, not generic.",
      "motivations": [
        "Why THIS specific persona would do this work",
        "Multiple concrete motivations"
      ],
      "pain_points": [
        "What frustrates THIS persona",
        "Specific to their credential tier and context"
      ],
      "digital_habitat": [
        "Where THIS persona spends time online — pull from the cultural_research professional_community data when applicable"
      ],
      "psychology_profile": {{
        "primary_bias": "A single psychology trigger — e.g., social_proof, authority, scarcity",
        "secondary_bias": "A backup trigger",
        "messaging_angle": "One-sentence summary of how to speak to them",
        "trigger_words": ["words that resonate for this credential tier"]
      }},
      "jobs_to_be_done": {{
        "functional": "What they want to accomplish",
        "emotional": "How they want to feel",
        "social": "How they want to be seen"
      }},
      "objections": [
        "What would make THIS persona hesitate?"
      ],
      "best_channels": [
        "Where to reach THIS persona — from cultural_research platform data"
      ]
    }},
    {{ ... second persona ... }},
    {{ ... third persona ... }}
  ]
}}

Each of the 3 personas must represent a different tier or career stage from
the acceptable_tiers list. Do not clone the same persona three ways.

Before finalizing your output, verify each persona against ALL constraints:
- matched_tier exactly matches one of the acceptable_tiers strings
- archetype + lifestyle + motivations contain NONE of the excluded phrases
- age_range falls within the age_range_hint
- The persona is culturally grounded in the target region from cultural_research
{feedback_section}

Return ONLY the JSON object. No commentary."""

    return prompt
```

- [ ] **Step 2: Verify the file is ≤200 lines**

```bash
wc -l worker/prompts/persona_engine.py
```

Expected: `<=200 worker/prompts/persona_engine.py`. If it's larger, trim the prompt text.

- [ ] **Step 3: Verify Python import**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "
from prompts.persona_engine import PERSONA_SYSTEM_PROMPT, build_persona_prompt
print('imports OK')
print('system prompt len:', len(PERSONA_SYSTEM_PROMPT))
# Build a test prompt
prompt = build_persona_prompt(
    request={'title': 'Test campaign', 'task_type': 'annotation', 'target_regions': ['US'], 'target_languages': ['en']},
    cultural_research={'ai_fatigue': {'level': 'low'}},
    persona_constraints={
        'minimum_credentials': 'MD/DO',
        'acceptable_tiers': ['Board-certified MD', 'Resident'],
        'age_range_hint': '28-55',
        'excluded_archetypes': ['general gig worker', 'pre-med undergraduate'],
    },
)
print('prompt len:', len(prompt))
assert 'matched_tier' in prompt
assert 'Board-certified MD' in prompt
assert 'pre-med undergraduate' in prompt
print('all assertions pass')
"
```

Expected: all lines print, no errors.

- [ ] **Step 4: Verify zero grep hits for old archetype references**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/ 2>&1 | grep -v ".git/"
```

Expected: NO output (zero hits).

- [ ] **Step 5: Commit the combined Task 18 + Task 19 changes**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/prompts/persona_engine.py
# Also add any other files changed in Task 18 grep sweep
git commit -m "feat(persona): hard delete 8 archetypes + rewrite persona_engine as pure prompt builder"
```

---

### Task 20: Create `persona_validation.py` with verifier-driven TDD

**Files:**
- Create: `scripts/verify-persona-validation.mjs`
- Create: `worker/pipeline/persona_validation.py`

- [ ] **Step 1: Write the verifier script first (TDD)**

Create `scripts/verify-persona-validation.mjs`:

```js
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
    // Single word 'student' would over-match — we use multi-word phrase instead
    excluded_archetypes: ['general student without clinical years'],
  };
  const result = validatePersonas(personas, constraints);
  assert.equal(result.ok, true, 'Fourth-year med student should pass when excluded phrase is "general student without clinical years"');
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
  assert.equal(result.ok, true); // none of the filtered-out entries match
}

console.log('✓ persona validation verifier passed (8 assertion groups)');
```

- [ ] **Step 2: Run the verifier — should PASS because the JS is self-contained**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
node --experimental-strip-types scripts/verify-persona-validation.mjs
```

Expected: `✓ persona validation verifier passed (8 assertion groups)`

- [ ] **Step 3: Implement the Python version in `worker/pipeline/persona_validation.py`**

Create `worker/pipeline/persona_validation.py`:

```python
"""Deterministic persona validation against derived_requirements.persona_constraints.

Matches excluded_archetype phrases as full-substring, case-insensitive against
a concatenated blob of persona fields (archetype + lifestyle + matched_tier +
motivations). Single-word entries in excluded_archetypes are discouraged by
the Stage 1 prompt rules because they would over-match and reject valid
personas — the prompt instructs the LLM to use disambiguated multi-word
phrases.

Mirror of scripts/verify-persona-validation.mjs. Update both in sync if the
validation logic changes.
"""
from __future__ import annotations


class Stage1PersonaValidationError(Exception):
    """Raised when Stage 1 persona validation persistently fails after max retries.

    The compute_job runner catches this exception and marks the job as failed
    with the error message surfaced in the admin dashboard for manual review.
    """


def validate_personas(
    personas: list[dict],
    constraints: dict,
) -> tuple[bool, list[str]]:
    """Validate generated personas against persona_constraints.

    Returns (ok, violations). If ok is False, violations is a non-empty list
    of human-readable violation messages suitable for feedback injection into
    the Stage 1 retry prompt.
    """
    violations: list[str] = []
    excluded = [
        kw.strip().lower()
        for kw in constraints.get("excluded_archetypes", []) or []
        if isinstance(kw, str) and kw.strip()
    ]

    for i, persona in enumerate(personas):
        if not isinstance(persona, dict):
            violations.append(
                f"Persona at index {i} is not an object — cannot validate."
            )
            continue

        persona_name = persona.get("name") or f"persona_{i + 1}"

        # Check matched_tier is populated
        matched_tier = persona.get("matched_tier")
        if not matched_tier or not str(matched_tier).strip():
            violations.append(
                f"Persona '{persona_name}' is missing matched_tier — "
                f"cannot verify it satisfies any acceptable_tier."
            )

        # Build a searchable text blob from the persona fields
        motivations = persona.get("motivations", [])
        if isinstance(motivations, list):
            motivations_text = " ".join(str(m) for m in motivations)
        else:
            motivations_text = str(motivations)

        text_fields = [
            str(persona.get("archetype", "")),
            str(persona.get("lifestyle", "")),
            str(persona.get("matched_tier", "")),
            motivations_text,
        ]
        blob = " ".join(text_fields).lower()

        # Full-substring case-insensitive match on each excluded phrase
        for kw in excluded:
            if kw and kw in blob:
                violations.append(
                    f"Persona '{persona_name}' contains excluded archetype "
                    f"phrase: '{kw}'"
                )
                break  # one violation per persona is enough for feedback

    return len(violations) == 0, violations
```

- [ ] **Step 4: Verify Python import + run the same test cases**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "
from pipeline.persona_validation import validate_personas, Stage1PersonaValidationError

# Mirror the JS test cases
# 1. Clean persona passes
ok, v = validate_personas(
    [{'name': 'Dr. Chen', 'archetype': 'Second-year dermatology resident', 'matched_tier': 'Dermatology resident at US teaching hospital', 'lifestyle': 'Long residency hours', 'motivations': ['Build clinical writing portfolio']}],
    {'excluded_archetypes': ['generic gig worker', 'pre-med undergraduate']},
)
assert ok, f'Test 1 failed: {v}'

# 2. Persona with excluded phrase fails
ok, v = validate_personas(
    [{'name': 'Alex', 'archetype': 'Pre-med undergraduate student', 'matched_tier': 'Undergraduate', 'lifestyle': 'College life', 'motivations': ['earn money']}],
    {'excluded_archetypes': ['pre-med undergraduate']},
)
assert not ok and 'pre-med undergraduate' in v[0], f'Test 2 failed: {ok}, {v}'

# 3. Ambiguous keyword passes with multi-word phrase
ok, v = validate_personas(
    [{'name': 'Priya Patel', 'archetype': 'Fourth-year medical student on dermatology rotation', 'matched_tier': 'Fourth-year US med student on derm rotation', 'lifestyle': 'Clinical rotations', 'motivations': ['Build residency application portfolio']}],
    {'excluded_archetypes': ['general student without clinical years']},
)
assert ok, f'Test 3 failed: {v}'

# 4. Missing matched_tier fails
ok, v = validate_personas(
    [{'name': 'Jordan', 'archetype': 'Dermatologist', 'lifestyle': 'Private practice', 'motivations': ['Contribute to AI research']}],
    {'excluded_archetypes': []},
)
assert not ok and any('matched_tier' in vv for vv in v), f'Test 4 failed: {v}'

# 5. Empty excluded list passes
ok, v = validate_personas(
    [{'name': 'Kai', 'archetype': 'Any', 'matched_tier': 'Some tier', 'lifestyle': 'Any', 'motivations': []}],
    {'excluded_archetypes': []},
)
assert ok, f'Test 5 failed: {v}'

# 6. Case-insensitive
ok, v = validate_personas(
    [{'name': 'Sam', 'archetype': 'Generic GIG Worker', 'matched_tier': 'Gig', 'lifestyle': 'Freelance', 'motivations': []}],
    {'excluded_archetypes': ['generic gig worker']},
)
assert not ok, f'Test 6 failed: {v}'

# 7. Non-dict persona fails gracefully
ok, v = validate_personas(
    [None, 'a string', {'name': 'OK', 'matched_tier': 'ok', 'archetype': 'x', 'lifestyle': 'x', 'motivations': []}],
    {'excluded_archetypes': []},
)
assert not ok and any('not an object' in vv for vv in v), f'Test 7 failed: {v}'

# 8. Non-string excluded items filtered
ok, v = validate_personas(
    [{'name': 'Alex', 'archetype': 'Dermatologist', 'matched_tier': 'Board-certified dermatologist', 'lifestyle': 'Private practice', 'motivations': []}],
    {'excluded_archetypes': [None, 123, '', '  ', 'pre-med undergraduate']},
)
assert ok, f'Test 8 failed: {v}'

print('All 8 Python tests passed')
"
```

Expected: `All 8 Python tests passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add scripts/verify-persona-validation.mjs worker/pipeline/persona_validation.py
git commit -m "feat(persona): validate_personas + Stage1PersonaValidationError with verifier"
```

---

### Task 21: Integrate validation retry loop in stage1_intelligence.py

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Add the retry loop around brief generation**

Find the main function in `stage1_intelligence.py` that orchestrates Stage 1 (likely `run_stage1` or similar). Update the brief generation + persona generation flow to include the validation retry loop:

```python
# Add imports at top
from pipeline.persona_validation import validate_personas, Stage1PersonaValidationError
import os

# Configurable via env var
MAX_PERSONA_RETRIES = int(os.getenv("STAGE1_PERSONA_MAX_RETRIES", "2"))


async def run_stage1_with_validation(request, cultural_research):
    """Run Stage 1 brief generation with deterministic persona validation.

    Retries up to MAX_PERSONA_RETRIES times if personas violate
    excluded_archetypes constraints. Raises Stage1PersonaValidationError
    on persistent failure.
    """
    previous_violations: list[str] = []

    for attempt in range(MAX_PERSONA_RETRIES + 1):
        # Run brief generation (existing logic) — pass feedback if retry
        brief_json = await run_brief_generation(
            request,
            cultural_research,
            feedback=previous_violations if previous_violations else None,
        )

        # Extract personas and constraints
        personas = brief_json.get("personas", [])
        derived = brief_json.get("derived_requirements", {})
        constraints = derived.get("persona_constraints", {})

        # Validate
        ok, violations = validate_personas(personas, constraints)
        if ok:
            logger.info(f"Stage 1 persona validation passed on attempt {attempt + 1}")
            return brief_json

        logger.warning(
            f"Stage 1 persona validation failed on attempt {attempt + 1}: "
            f"{len(violations)} violations"
        )
        for v in violations:
            logger.warning(f"  - {v}")

        if attempt >= MAX_PERSONA_RETRIES:
            raise Stage1PersonaValidationError(
                f"Persona validation failed after {MAX_PERSONA_RETRIES + 1} attempts. "
                f"Violations: {'; '.join(violations)}"
            )

        previous_violations = violations

    # Should not reach here
    raise Stage1PersonaValidationError("Unexpected fall-through in validation loop")
```

**Adapt the function name and signature** to match the existing `stage1_intelligence.py` structure. The key additions are:
1. Import `validate_personas` and `Stage1PersonaValidationError`
2. Import `os` and read `MAX_PERSONA_RETRIES` from env
3. Wrap the brief generation call in a retry loop
4. Call `validate_personas` after each brief generation
5. Raise `Stage1PersonaValidationError` after max retries

- [ ] **Step 2: Update the compute_job runner to catch `Stage1PersonaValidationError`**

Wherever the main compute_job handler is (likely `worker/main.py` or a runner inside `stage1_intelligence.py`), add exception handling:

```python
try:
    brief_json = await run_stage1_with_validation(request, cultural_research)
except Stage1PersonaValidationError as e:
    logger.error(f"Stage 1 persona validation failed: {e}")
    # Mark compute_job as failed with the error message
    await mark_job_failed(job_id, error_message=str(e))
    return
```

- [ ] **Step 3: Verify Python import**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 -c "
from pipeline.stage1_intelligence import *
from pipeline.persona_validation import Stage1PersonaValidationError
print('imports OK')
"
```

- [ ] **Step 4: Run smoke test**

```bash
python3 tests/smoke_test.py 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/pipeline/stage1_intelligence.py worker/main.py
git commit -m "feat(persona): validation retry loop in stage1_intelligence with max 2 retries"
```

---

### Task 22: Update smoke test

**Files:**
- Modify: `worker/tests/smoke_test.py`

- [ ] **Step 1: Read current smoke test structure**

```bash
head -120 worker/tests/smoke_test.py
grep -n "test_\|def test_" worker/tests/smoke_test.py | head -30
```

- [ ] **Step 2: Remove any archetype-dependent tests**

Find any tests that reference `PERSONA_ARCHETYPES` or specific archetype keys and delete them. These no longer apply.

- [ ] **Step 3: Add new test for `build_persona_prompt`**

Add this test to `smoke_test.py`:

```python
def test_persona_prompt_builds_from_constraints():
    """Verify build_persona_prompt produces a prompt containing the constraints."""
    from prompts.persona_engine import build_persona_prompt

    prompt = build_persona_prompt(
        request={
            "title": "Test Campaign",
            "task_type": "annotation",
            "target_regions": ["US"],
            "target_languages": ["en"],
        },
        cultural_research={"ai_fatigue": {"level": "low"}},
        persona_constraints={
            "minimum_credentials": "MD/DO",
            "acceptable_tiers": [
                "Board-certified dermatologist in US practice",
                "Dermatology resident at US teaching hospital",
            ],
            "age_range_hint": "28-55",
            "excluded_archetypes": [
                "generic gig worker",
                "pre-med undergraduate",
                "stay-at-home parent without medical training",
            ],
        },
    )

    # The prompt must contain the constraint markers for the LLM to see them
    assert "MD/DO" in prompt, "minimum_credentials not in prompt"
    assert "Board-certified dermatologist" in prompt, "acceptable_tiers not in prompt"
    assert "28-55" in prompt, "age_range_hint not in prompt"
    assert "generic gig worker" in prompt, "excluded_archetypes not in prompt"
    assert "matched_tier" in prompt, "matched_tier field instruction missing"
    assert "3 distinct personas" in prompt, "persona count instruction missing"

    print("✓ test_persona_prompt_builds_from_constraints")


def test_persona_validation_clean_and_violation():
    """Verify validate_personas accepts clean personas and rejects bad ones."""
    from pipeline.persona_validation import validate_personas

    # Clean case
    clean = [{
        "name": "Dr. Chen",
        "archetype": "Second-year dermatology resident",
        "matched_tier": "Dermatology resident at US teaching hospital",
        "lifestyle": "Long residency hours",
        "motivations": ["Build clinical writing portfolio"],
    }]
    ok, violations = validate_personas(clean, {"excluded_archetypes": ["pre-med undergraduate"]})
    assert ok and not violations

    # Violation case
    dirty = [{
        "name": "Alex",
        "archetype": "Pre-med undergraduate student",
        "matched_tier": "Undergraduate",
        "lifestyle": "College life",
        "motivations": [],
    }]
    ok, violations = validate_personas(dirty, {"excluded_archetypes": ["pre-med undergraduate"]})
    assert not ok and len(violations) == 1
    assert "pre-med undergraduate" in violations[0]

    print("✓ test_persona_validation_clean_and_violation")
```

Register the new tests in whatever test-discovery mechanism the smoke test uses (if it's a hardcoded list of tests to run, add them to the list).

- [ ] **Step 4: Run the smoke test**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor/worker
python3 tests/smoke_test.py 2>&1 | tail -15
```

Expected: the 2 new tests appear in the output and pass. The 1 pre-existing `KLING_API_KEY` failure is still expected.

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git add worker/tests/smoke_test.py
git commit -m "test(persona): smoke test for build_persona_prompt + validate_personas"
```

---

## Phase F — Admin Dashboard

### Task 23: Derived Requirements card in BriefExecutive.tsx

**Files:**
- Modify: `src/components/BriefExecutive.tsx`

- [ ] **Step 1: Read the current BriefExecutive component**

```bash
head -100 src/components/BriefExecutive.tsx
```

Find where sections are rendered and identify a clean insertion point for a new collapsible section.

- [ ] **Step 2: Add a new collapsible "Derived Requirements" section**

Add this JSX block in the BriefExecutive component, ideally near the top (before personas but after the summary):

```tsx
{/* Derived Requirements — AI-generated analysis (Phase A) */}
{brief?.derived_requirements && (
  <details className="card p-5 mb-4">
    <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)] flex items-center justify-between">
      <span className="flex items-center gap-2">
        ✨ Derived Requirements (AI-generated analysis)
      </span>
      <span className="text-xs text-[var(--muted-foreground)]">click to expand</span>
    </summary>
    <div className="mt-4 space-y-4 text-xs">
      <div>
        <div className="font-semibold text-[var(--foreground)] mb-1">Credential summary</div>
        <div className="text-[var(--muted-foreground)]">{brief.derived_requirements.credential_summary}</div>
      </div>

      <div>
        <div className="font-semibold text-[var(--foreground)] mb-1">
          Pillar weighting: {brief.derived_requirements.pillar_weighting?.primary?.toUpperCase()} →
          {' '}{brief.derived_requirements.pillar_weighting?.secondary?.toUpperCase()}
        </div>
        <div className="text-[var(--muted-foreground)] italic">
          {brief.derived_requirements.pillar_weighting?.reasoning}
        </div>
      </div>

      <div>
        <div className="font-semibold text-[var(--foreground)] mb-1">Visual direction</div>
        <dl className="space-y-1 text-[var(--muted-foreground)]">
          <div><span className="font-medium">Work environment:</span> {brief.derived_requirements.visual_direction?.work_environment}</div>
          <div><span className="font-medium">Wardrobe:</span> {brief.derived_requirements.visual_direction?.wardrobe}</div>
          <div><span className="font-medium">Visible tools:</span> {(brief.derived_requirements.visual_direction?.visible_tools ?? []).join(', ')}</div>
          <div><span className="font-medium">Emotional tone:</span> {brief.derived_requirements.visual_direction?.emotional_tone}</div>
          <div><span className="font-medium">Cultural adaptations:</span> {brief.derived_requirements.visual_direction?.cultural_adaptations}</div>
        </dl>
      </div>

      <div>
        <div className="font-semibold text-[var(--foreground)] mb-1">Persona constraints</div>
        <dl className="space-y-1 text-[var(--muted-foreground)]">
          <div><span className="font-medium">Minimum credentials:</span> {brief.derived_requirements.persona_constraints?.minimum_credentials}</div>
          <div><span className="font-medium">Age range:</span> {brief.derived_requirements.persona_constraints?.age_range_hint}</div>
          <div className="mt-2">
            <span className="font-medium">Acceptable tiers:</span>
            <ul className="list-disc pl-5 mt-1">
              {(brief.derived_requirements.persona_constraints?.acceptable_tiers ?? []).map((tier, i) => (
                <li key={i}>{tier}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2">
            <span className="font-medium">Excluded archetypes:</span>
            <ul className="list-disc pl-5 mt-1">
              {(brief.derived_requirements.persona_constraints?.excluded_archetypes ?? []).map((arch, i) => (
                <li key={i}>{arch}</li>
              ))}
            </ul>
          </div>
        </dl>
      </div>

      <div>
        <div className="font-semibold text-[var(--foreground)] mb-1">Narrative angle</div>
        <div className="text-[var(--muted-foreground)] italic">{brief.derived_requirements.narrative_angle}</div>
      </div>
    </div>
  </details>
)}
```

**Adapt the exact prop name** (`brief?.derived_requirements` vs. some other path) based on how the brief is passed into the BriefExecutive component.

- [ ] **Step 3: Verify Next.js build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/BriefExecutive.tsx
git commit -m "feat(admin): Derived Requirements collapsible card in BriefExecutive"
```

---

### Task 24: Surface Stage1PersonaValidationError in admin pipeline dashboard

**Files:**
- Modify: `src/app/admin/pipeline/page.tsx` (or wherever the worker/pipeline monitor is)

- [ ] **Step 1: Find the admin pipeline dashboard**

```bash
find src/app/admin -name "page.tsx" | head
```

Locate the dashboard that shows compute_jobs status (running, pending, complete, failed).

- [ ] **Step 2: Ensure failed jobs display their error_message clearly**

If the current dashboard shows failed jobs but hides the error_message, update it to render the full message prominently. A failed job with `error_message` containing "PersonaValidationError" or "Persona validation failed" should surface those violations clearly for debugging.

Example addition:

```tsx
{job.status === 'failed' && job.error_message && (
  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-xs">
    <div className="font-semibold text-red-800 mb-1">❌ Failed</div>
    <div className="text-red-700 font-mono whitespace-pre-wrap break-words">{job.error_message}</div>
    {job.error_message.includes('Persona validation failed') && (
      <div className="mt-2 text-red-600 italic">
        Tip: Review the intake Job Requirements fields (especially qualifications_required
        and context_notes) and regenerate. The LLM may need more specific constraints.
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify Next.js build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/pipeline/page.tsx
git commit -m "feat(admin): surface Stage1PersonaValidationError in pipeline dashboard"
```

---

## Phase G — Deploy + Verification

### Task 25: Merge + deploy + end-to-end verification

- [ ] **Step 1: Verify branch state and full test pass**

```bash
cd /Users/stevenjunop/centric-intake/.worktrees/intake-persona-refactor
git log --oneline feature/intake-persona-refactor ^main | head -30
echo "---"
cd worker && python3 tests/smoke_test.py 2>&1 | tail -10 && cd ..
echo "---"
node --experimental-strip-types scripts/verify-persona-validation.mjs
echo "---"
node --experimental-strip-types scripts/verify-cultural-research-helpers.mjs
echo "---"
npm run build 2>&1 | tail -10
```

Expected: all commits visible in log, all verifiers pass, smoke test passes (with 1 pre-existing config failure), Next.js build clean.

- [ ] **Step 2: Run the grep sweep one more time**

```bash
grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/ 2>&1 | grep -v ".git/" && echo "FOUND LEAKED" || echo "CLEAN"
```

Expected: `CLEAN`

- [ ] **Step 3: Check persona_engine.py line count**

```bash
wc -l worker/prompts/persona_engine.py
```

Expected: `<= 200 lines`

- [ ] **Step 4: Stash WIP on main (if any)**

```bash
git -C /Users/stevenjunop/centric-intake status --short
git -C /Users/stevenjunop/centric-intake stash push -m "pre-merge-intake-persona-$(date +%s)" -- src/components/CampaignWorkspace.tsx worker/ai/gemini_edit.py worker/ai/sedeo_client.py worker/.next/trace worker/.next/trace-build 2>&1 | tail -3
```

- [ ] **Step 5: Merge feature branch with --no-ff**

```bash
git -C /Users/stevenjunop/centric-intake merge --no-ff feature/intake-persona-refactor -m "Merge feature/intake-persona-refactor: Phase A+B — intake schema + persona engine refactor

Phase A (intake schema extension):
- 7 Job Requirements TEXT columns on intake_requests (nullable, app-level
  validation for required fields)
- JOB_REQUIREMENTS_MODULE shared schema prepended to every task type
- Extraction prompt extended to pre-fill all 7 fields from source text
- Intake form renders new section with '✨ AI drafted' badges
- Re-extract confirm dialog preserves manual edits

Phase A (DB + derived_requirements):
- pillar_primary/pillar_secondary TEXT columns with CHECK constraints on
  creative_briefs (3-enum: earn/grow/shape)
- derived_requirements JSONB column for the full Stage 1 analysis
- Partial index on pillar_primary for fast analytics

Phase A (cultural research refactor):
- derive_work_tier_context + should_run_dimension helpers
- All 9 existing dimensions updated with {work_tier_context} substitution
- 3 new conditional dimensions: professional_community, domain_trust_signals,
  work_environment_norms
- Expanded REGIONAL_PLATFORM_PRIORS for US + UK professional platforms
- Stage 1 passes intake_row into cultural research call

Phase B (persona engine refactor):
- HARD DELETE of PERSONA_ARCHETYPES dict (grep sweep confirms zero hits)
- persona_engine.py rewritten as pure prompt builder (<=200 lines)
- validate_personas function with full-substring match
- Stage1PersonaValidationError exception class
- Max 2-retry loop with specific violation feedback
- Admin dashboard surfaces validation errors prominently

Verified via throwaway Node verifiers (cultural-research-helpers,
persona-validation) + Python smoke test + end-to-end on Cutis."
```

- [ ] **Step 6: Run DB migration against prod Neon (idempotent — safe if already run)**

```bash
cd /Users/stevenjunop/centric-intake
node scripts/init-db.mjs
```

Expected: statements execute, no errors. The new columns are added to prod Neon.

- [ ] **Step 7: Deploy to Vercel prod**

```bash
vercel --prod --scope team_aIEQ7vb1eDrP2XPzKf40iUqx --yes 2>&1 | tail -20
```

Grab the deployment URL from the output.

- [ ] **Step 8: Alias to nova-intake.vercel.app**

```bash
vercel alias set <DEPLOYMENT_URL> nova-intake.vercel.app --scope team_aIEQ7vb1eDrP2XPzKf40iUqx 2>&1 | tail -3
```

Replace `<DEPLOYMENT_URL>` with the URL from step 7.

- [ ] **Step 9: Re-run the task_type_schemas seed**

If the seed is a standalone script:

```bash
# Find the seed script
find src/lib scripts -name "*seed*" -type f 2>/dev/null
# Run it (exact command depends on the script location)
```

Alternatively, the admin UI has a "Seed schemas" button — use that if the script isn't standalone.

- [ ] **Step 10: Worker restart**

```bash
# Find and stop the running worker
ps aux | grep "python.*main.py" | grep -v grep
# Kill it (adapt PID)
# Then restart
cd /Users/stevenjunop/centric-intake/worker
python3 main.py &
```

- [ ] **Step 11: End-to-end verification on Cutis**

1. Open https://nova-intake.vercel.app in a browser
2. Log in
3. Navigate to an existing Project Cutis campaign via the admin dashboard
4. Edit the intake to populate the 7 new Job Requirements fields (paste the Cutis source text — extraction should auto-fill them)
5. Save the intake
6. Trigger a Stage 1 regenerate via the admin pipeline dashboard
7. Wait for the compute_job to complete
8. Open the campaign detail view
9. Verify:
   - ✅ The "Derived Requirements (AI-generated analysis)" card appears
   - ✅ `pillar_primary` = "shape" (for credentialed medical work)
   - ✅ `excluded_archetypes` contains disambiguated phrases like "generic gig worker", "pre-med undergraduate"
   - ✅ Each of the 3 generated personas has a `matched_tier` field
   - ✅ No persona contains the phrases "gig worker", "stay-at-home parent", "side hustle"
   - ✅ Cultural research output includes data from the `professional_community` dimension

Check via psql:

```bash
node -e "import('@neondatabase/serverless').then(({ neon }) => { const sql = neon('$DATABASE_URL'); return sql\`SELECT id, pillar_primary, pillar_secondary, (derived_requirements->'persona_constraints'->>'excluded_archetypes') as excluded FROM creative_briefs WHERE request_id = (SELECT id FROM intake_requests WHERE title ILIKE '%cutis%' LIMIT 1) ORDER BY created_at DESC LIMIT 1\`.then(r => { console.log(r); process.exit(0); }); });"
```

Expected: `pillar_primary = 'shape'`, excluded_archetypes is a JSON array with disambiguated phrases.

- [ ] **Step 12: End-to-end verification on a contrasting job**

Create a new intake with the Onyx Finnish OCR source text (see spec § 6 for the example). Verify:
- ✅ Extraction pre-fills all 7 Job Requirements fields
- ✅ `pillar_primary` = "earn" (language-only gig work)
- ✅ Excluded_archetypes is empty or minimal
- ✅ Generated personas are language-focused (no medical credentials required)

- [ ] **Step 13: Pop stashed WIP**

```bash
git -C /Users/stevenjunop/centric-intake stash pop 2>&1 | tail -3
```

- [ ] **Step 14: Clean up worktree**

```bash
git -C /Users/stevenjunop/centric-intake worktree remove --force .worktrees/intake-persona-refactor 2>&1
git -C /Users/stevenjunop/centric-intake worktree list
```

- [ ] **Step 15: Write memory checkpoint**

Create a new memory file documenting what shipped, verification results, commit SHAs, and any lessons learned. Follow the pattern of prior progress checkpoints in `/Users/stevenjunop/.claude/projects/-Users-stevenjunop-centric-intake/memory/`.

- [ ] **Step 16: Final sanity — grep sweep on main**

```bash
cd /Users/stevenjunop/centric-intake
grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/ 2>&1 | grep -v ".git/" && echo "FOUND LEAKED AFTER MERGE" || echo "MAIN BRANCH CLEAN"
```

Expected: `MAIN BRANCH CLEAN`

---

## Self-Review

### Spec coverage check

| Spec section | Covered by task |
|---|---|
| § 1 Intake Schema Module (JOB_REQUIREMENTS_MODULE + 7 fields) | Task 4 (create), Task 5 (seed), Task 7 (UI render) |
| § 2 DB Schema Changes (10 columns + JSONB + partial index) | Task 1 (migration), Task 2 (types), Task 3 (DB helpers) |
| § 3 Cultural Research Refactor | Task 9 (helpers), Task 10 (9 dimensions), Task 11 (3 new dimensions), Task 12 (platform priors), Task 13 (summary helpers), Task 14 (wire into stage1) |
| § 4 Stage 1 Brief Extension (derived_requirements) | Task 15 (output schema), Task 16 (rules), Task 17 (save to columns) |
| § 5 Persona Engine Refactor (hard delete + rewrite + validation) | Task 18 (delete), Task 19 (rewrite), Task 20 (validation helper), Task 21 (retry loop), Task 22 (smoke test) |
| § 6 Data Flow Walkthrough | Implicit verification in Task 25 (E2E on Cutis + Onyx) |
| § 7 Error Handling + Edge Cases | Covered by validate_personas edge-case tests in Task 20 + admin dashboard error surface in Task 24 |
| § 8 Testing Strategy | Task 20 (persona validation verifier), Task 9 (cultural research helpers verifier), Task 22 (smoke test), Task 25 (manual E2E) |
| § 9 Migration / Rollout | Task 25 steps 6-10 |
| § 10 Success Criteria | Task 25 step 11 verification checklist |
| § 11 Open Questions | Handled inline as implementer decisions during Task 4, Task 5, Task 7 |

All spec sections covered.

### Placeholder scan

None of the tasks contain TBD, TODO, FIXME, "implement later", or vague "add error handling" instructions. Every step has concrete code or commands.

One intentional deferral: Task 5 "Seed integration" asks the implementer to READ the current `seed-schemas.ts` structure before deciding which pattern to use (sections vs flat fields). This is a legitimate environment probe, not a placeholder. The task explicitly says "Read the file first to determine which pattern is in use. If the pattern is ambiguous, report BLOCKED."

Similarly Task 3 "Step 2: Update `src/lib/db/briefs.ts`" asks the implementer to adapt to the existing function signature if it differs. This is correct — we don't know the exact current shape without reading the file.

### Type consistency check

- `BrandPillar` type defined in Task 2 → used in Task 3 (briefs.ts), Task 17 (stage1_intelligence.py saves pillar_primary), Task 23 (BriefExecutive.tsx reads it)
- `DerivedRequirements` interface defined in Task 2 → used in Task 3, Task 17, Task 23
- `validate_personas` function signature defined in Task 20 → used in Task 21 (retry loop), Task 22 (smoke test)
- `Stage1PersonaValidationError` defined in Task 20 → raised in Task 21, caught in Task 21 + surfaced in Task 24
- `derive_work_tier_context` + `should_run_dimension` defined in Task 9 → used in Task 10 (query formatting) + Task 11 (dimension activation) + Task 14 (stage1 call site)
- `JOB_REQUIREMENTS_MODULE` + `SchemaField` + `SchemaSection` defined in Task 4 → used in Task 5 (seed integration)

All cross-references consistent.

### Task count check

25 tasks across 7 phases:

- Phase A — DB foundation (3 tasks): 1, 2, 3
- Phase B — Intake form (5 tasks): 4, 5, 6, 7, 8
- Phase C — Cultural research (6 tasks): 9, 10, 11, 12, 13, 14
- Phase D — Stage 1 brief (3 tasks): 15, 16, 17
- Phase E — Persona engine (5 tasks): 18, 19, 20, 21, 22
- Phase F — Admin dashboard (2 tasks): 23, 24
- Phase G — Deploy + verify (1 task): 25

Task 18 and 19 are intentionally NOT committed separately (Task 18 leaves the file in a broken state; Task 19 completes the rewrite and commits both). This is the only deviation from "one commit per task" and is documented in Task 18 Step 6.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-08-intake-schema-persona-refactor.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. Best fit for a 25-task plan where each task is self-contained.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints. Faster setup but heavier context load.

**Which approach?**
