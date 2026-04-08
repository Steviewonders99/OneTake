# Intake Schema Extension + Persona Engine Refactor — Design Spec

**Date:** 2026-04-08
**Status:** Approved design, ready for implementation plan
**Owner:** Steven Junop

## Goal

Fix the root cause of persona mismatches in the OneForma pipeline: the current 8-archetype persona engine generates "student / gig worker / stay-at-home parent" personas even for high-credential jobs like Cutis (clinical dermatology documentation). This produces downstream pipeline outputs that are visually and messaging-wise incoherent — a dermatology project ends up with photos of students in home offices and copy that talks about "earning extra income on the side."

This spec covers **Phase A** (intake schema extension) and **Phase B** (persona engine refactor) as a single ship. It is Phase 1 of a 2-phase initiative. Phase 2 (the next spec cycle) will cover scene awareness in Stage 2 + copy pillar weighting in Stage 3 + composition template selection in Stage 4 — all of which will consume the `derived_requirements` data this spec introduces.

The core architectural move is: **replace hardcoded taxonomies with LLM-driven derivation over flexible free-text inputs.** No new database columns. No new enums. No Cutis-specific patches. A schema that accommodates a sommelier palate evaluation job tomorrow and a deep-sea welder job next year without code changes.

## Why

- The current `worker/prompts/persona_engine.py` contains 8 hardcoded archetypes (`the_student`, `the_freelancer`, `the_stay_at_home_parent`, `the_recent_graduate`, `the_multilingual_professional`, `the_retiree`, `the_side_hustler`, `the_gig_worker`). None of these fit a credentialed medical job. The LLM tries to "customize" one of them for Cutis and produces incoherent output.
- The current intake form does not capture the data that matters most for persona generation: required credentials, location strictness, work environment, wardrobe, visible tools, engagement model, technical requirements, creative-team context. The Stage 1 brief LLM has to infer everything, and when it infers wrong, Stage 2 generates a student in a kitchen for a dermatology project.
- The memory file `persona-engine-refactor.md` has flagged this as a critical issue since the Lumina run. It has been blocking proper Domain Expert campaigns for weeks.
- The Phase 1 brand voice rewrite (shipped yesterday, commit `d3138d7`) introduced the 3 brand pillars (Earn / Grow / Shape) and expectation-locked CTAs. For Shape-pillar copy (*"Your cardiology expertise is exactly what AI is missing"*) to land visually, the pipeline must generate actual credentialed medical professionals in actual medical environments — not generic archetypes. Without this spec, the Phase 1 brand voice work cannot fully land for credentialed jobs.

## Intended Outcome

After this spec ships:

- The intake form includes a new shared "Job Requirements" section with 7 free-text fields pre-filled by LLM extraction from whatever source the recruiter provides (pasted text, uploaded file, etc.). The recruiter reviews and refines the drafts, then submits.
- Stage 1 brief generation produces a new `derived_requirements` sub-object in the brief JSON output, computed from the job requirements + cultural research. This sub-object contains `credential_summary`, `pillar_weighting`, `visual_direction`, `persona_constraints`, and `narrative_angle`.
- The persona engine no longer references the 8 hardcoded archetypes. The archetypes are **deleted from the runtime source** (not bypassed, not commented out). Persona generation becomes a pure LLM call constrained by `derived_requirements.persona_constraints` + cultural research.
- A deterministic validation loop rejects any generated persona that matches `excluded_archetypes` phrases and retries Stage 1 up to 2 times with specific feedback. If validation persistently fails, the compute job ends in `failed` status with a clear error surface in the admin dashboard.
- Running Stage 1 regenerate on the existing Project Cutis campaign produces credentialed medical personas (dermatology residents, board-certified dermatologists, clinical-year med students), not students or gig workers.
- Running Stage 1 on a contrasting job like Onyx Finnish OCR produces language-focused personas with minimal credential constraints and `pillar_weighting.primary === "earn"`.
- Stages 2, 3, and 4 continue to work unchanged — they read personas via the existing fields and simply receive credential-aware personas instead of archetype-customized ones. The next spec cycle updates those stages to also read `derived_requirements.visual_direction`.

## Scope

### In scope (Phase A + Phase B in one spec)

**Phase A — Intake schema extension:**

- New shared schema module `JOB_REQUIREMENTS_MODULE` defining 7 free-text fields, prepended to every task type's schema
- Update to `task_type_schemas` seed so every existing task type inherits the module
- Extension of `src/lib/extraction-prompt.ts` to output the 7 new fields in its extraction JSON
- UI update in `src/app/intake/new/page.tsx` (or its dynamic form renderer) to render the new section with "✨ AI drafted — review and edit" badge on pre-filled fields
- Re-extract confirm dialog: if the recruiter has manually edited fields and clicks Re-extract, prompt before overwriting

**Phase B — Persona engine refactor:**

- Hard delete of the `PERSONA_ARCHETYPES` dict from `worker/prompts/persona_engine.py`, the scoring logic that ranks archetypes, and all references to specific archetype keys across `worker/` and `src/`
- Rewrite of `persona_engine.py` as a pure prompt-building function (~150 lines, down from ~400)
- Extension of the Stage 1 brief prompt in `worker/prompts/recruitment_brief.py` to output the `derived_requirements` sub-object
- New deterministic validation function `validate_personas` in `worker/pipeline/persona_validation.py`
- Integration of the validation retry loop in `worker/pipeline/stage1_intelligence.py` (max 2 retries, then `Stage1PersonaValidationError`)
- Admin dashboard update to surface `Stage1PersonaValidationError` with the violation list
- New throwaway verifier script `scripts/verify-persona-validation.mjs`
- Update to `worker/tests/smoke_test.py` to remove archetype-dependent tests and add a test for dynamic persona prompt building

### Deferred to the next spec cycle (Phase C + Phase D)

- **Scene awareness in Stage 2** — `worker/prompts/recruitment_actors.py` updates to read `derived_requirements.visual_direction` and inject work environment, wardrobe, and visible tools into Seedream scene generation. Replaces the hardcoded `REGION_SETTINGS` fallback.
- **Copy pillar weighting in Stage 3** — `worker/prompts/recruitment_copy.py` updates to read `derived_requirements.pillar_weighting` and bias the 3 copy variations toward the appropriate pillar for credentialed vs gig jobs.
- **Composition template selection in Stage 4** — the HTML template library (Phase 2 of brand voice) picks templates based on pillar and visual direction.
- **Cultural research extension** — adding a "work_environment_norms" dimension to `cultural_research.py` so regional scene specifics can influence Stage 2 visuals.

### Explicitly NOT in scope

- New database tables or columns
- Hardcoded enums for credential tiers, work environments, session types, etc.
- Backfill of existing intake_requests — they gracefully handle missing `job_requirements` by letting Stage 1 infer from existing fields; on next recruiter edit, the pre-filled drafts populate and can be reviewed
- Runtime regex scrubber for sensitive info (the Phase 1 curated allowlist via `worker/brand/oneforma.py` is sufficient)
- LLM-based persona validator (Option C from brainstorm) — YAGNI until the deterministic validator proves insufficient

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  INTAKE FORM — /intake/new                                        │
│                                                                    │
│  Step 1: Recruiter pastes source text (RFP, job description,      │
│          project brief — we stay source-agnostic)                 │
│                                                                    │
│  Step 2: LLM extraction fires automatically                       │
│     POST /api/intake/extract                                      │
│     Extended extraction prompt now outputs a job_requirements      │
│     sub-object with all 7 fields pre-filled                       │
│                                                                    │
│  Step 3: Form renders all 7 fields with "✨ AI drafted — review   │
│          and edit" badge. Recruiter reviews, edits, submits.      │
│                                                                    │
│  Data lands in NEW first-class columns on intake_requests         │
│  (7 TEXT columns for the Job Requirements fields, nullable at DB, │
│  required-ness enforced in application code — see § 2 below)      │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  CULTURAL RESEARCH — now context-aware                            │
│  worker/prompts/cultural_research.py (refactored — see § 3)        │
│                                                                    │
│  Reads:                                                            │
│    - intake_requests.* (including the 7 new Job Requirements cols) │
│    - regional_platform_priors (expanded with professional         │
│      platform data)                                                │
│                                                                    │
│  Runs all 9 existing research dimensions with updated query       │
│  templates that include the {work_tier_context} substitution      │
│  derived from qualifications_required. Also runs 3 new            │
│  conditional dimensions when credentials are involved:            │
│    - professional_community (activates for credentialed jobs)     │
│    - domain_trust_signals (activates for credentialed jobs)       │
│    - work_environment_norms (activates always, adapts by tier)    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 1 — Brief generation                                       │
│  worker/prompts/recruitment_brief.py (extended)                    │
│                                                                    │
│  Reads:                                                            │
│    - intake_requests.* (including the 7 new Job Requirements cols) │
│    - context-aware cultural_research output                       │
│    - brand voice block from worker/brand/oneforma.py              │
│                                                                    │
│  LLM generates brief JSON now including:                          │
│    creative_briefs.brief_data.derived_requirements = {            │
│      credential_summary: "...",                                   │
│      pillar_weighting: { primary, secondary, reasoning },         │
│      visual_direction: {                                          │
│        work_environment, wardrobe, visible_tools,                 │
│        emotional_tone, cultural_adaptations                       │
│      },                                                            │
│      persona_constraints: {                                       │
│        minimum_credentials, acceptable_tiers,                     │
│        age_range_hint, excluded_archetypes                        │
│      },                                                            │
│      narrative_angle: "..."                                       │
│    }                                                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 1 (cont.) — Dynamic persona generation                     │
│  worker/prompts/persona_engine.py (rewritten, 8 archetypes DELETED)│
│                                                                    │
│  LLM generates 3 dynamic personas constrained by:                 │
│    - derived_requirements.persona_constraints                     │
│    - cultural_research output                                     │
│    - brief messaging strategy                                     │
│                                                                    │
│  Each persona carries a NEW matched_tier field linking it to      │
│  one of acceptable_tiers.                                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Deterministic persona validation                                 │
│  worker/pipeline/persona_validation.py (new)                       │
│                                                                    │
│  For each persona, scan archetype + lifestyle + matched_tier +    │
│  motivations as a lowercased text blob. Check if any              │
│  excluded_archetypes phrase appears as a substring.                │
│                                                                    │
│  Violations trigger retry (max 2) with specific feedback.         │
│  Persistent failure raises Stage1PersonaValidationError and       │
│  fails the compute_job with a clear error in the admin dashboard. │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         [Stage 2 / 3 / 4 unchanged in THIS spec — they consume
          personas via existing fields; derived_requirements is
          dormant data until the next spec cycle]
```

## Section Map

| § | Topic | Phase |
|---|---|---|
| 1 | Intake Schema Module (7 new Job Requirements fields) | A |
| 2 | DB Schema Changes (10 new columns + 1 JSONB column + 1 partial index) | A |
| 3 | Cultural Research Refactor (context-aware dimensions + 3 new conditional dimensions) | A/B |
| 4 | Stage 1 Brief Extension (`derived_requirements` sub-object) | B |
| 5 | Persona Engine Refactor (hard delete 8 archetypes + dynamic generation + validation) | B |
| 6 | Data Flow Walkthrough (Cutis + Onyx examples) | — |
| 7 | Error Handling + Edge Cases | — |
| 8 | Testing Strategy | — |
| 9 | Migration / Rollout | — |
| 10 | Success Criteria | — |
| 11 | Open Questions Deferred to Implementation | — |

## § 1 — Intake Schema Module

### The `JOB_REQUIREMENTS_MODULE` definition

Stored as a reusable constant in `src/lib/seed-schemas.ts` (or a new file `src/lib/shared-schema-modules.ts`). Prepended to every task type's field list during seed.

```jsonc
{
  "section": "Job Requirements",
  "description": "Who can do this job, where they work, what they need. Pre-filled — review and refine.",
  "ai_prefilled": true,
  "fields": [
    {
      "key": "qualifications_required",
      "label": "Required qualifications",
      "type": "textarea",
      "rows": 4,
      "required": true,
      "ai_help": "Minimum bar to even apply. Credentials, degrees, certifications, years of experience, professional licenses, language fluency, specific system experience.",
      "placeholder": "e.g., Licensed dermatologist (MD/DO) OR dermatology resident OR medical student in clinical years with documented dermatology rotation.",
      "prefill_guidance": "Extract every hard requirement from the source text. Use 'OR' to separate acceptable alternatives. Be specific about degree level, board certifications, years of experience, and any required system/tool familiarity."
    },
    {
      "key": "qualifications_preferred",
      "label": "Preferred but not required",
      "type": "textarea",
      "rows": 3,
      "required": false,
      "ai_help": "Nice-to-haves that strengthen an application but aren't mandatory.",
      "placeholder": "e.g., Board certification in dermatopathology, published clinical research, bilingual Spanish fluency.",
      "prefill_guidance": "Extract soft preferences — things mentioned as 'preferred', 'a plus', 'ideally', 'bonus'. Leave empty if none."
    },
    {
      "key": "location_scope",
      "label": "Location scope",
      "type": "textarea",
      "rows": 2,
      "required": true,
      "ai_help": "Describe the geographic scope in natural language — what's required, what's excluded, and why.",
      "placeholder": "e.g., US residents only — work must reflect US clinical practice and documentation standards.",
      "prefill_guidance": "Extract explicit location requirements. Include the reasoning if stated. If the source says 'worldwide' or omits location, say so."
    },
    {
      "key": "language_requirements",
      "label": "Language requirements",
      "type": "textarea",
      "rows": 3,
      "required": true,
      "ai_help": "What languages, what proficiency, any modality requirements.",
      "placeholder": "e.g., English (US) — native or near-native fluency. Must write in clinical register matching US patient-portal standards.",
      "prefill_guidance": "One line per language. Include proficiency level (native, fluent, conversational, reading-only) and any modality notes (must read handwritten, must speak a specific dialect, must write in a specific register)."
    },
    {
      "key": "engagement_model",
      "label": "Engagement model",
      "type": "textarea",
      "rows": 3,
      "required": true,
      "ai_help": "How long is the engagement, how much commitment, what's the compensation structure.",
      "placeholder": "e.g., Ongoing per-approved-asset work. No fixed weekly hours.",
      "prefill_guidance": "Extract: (1) duration (one-time / ongoing / project-based), (2) time commitment (hours/week, total hours, session length), (3) compensation model (per-asset, hourly, project-fee). Include rate if the source specifies one; otherwise leave rate blank — marketing should not invent numbers."
    },
    {
      "key": "technical_requirements",
      "label": "Equipment & tools",
      "type": "textarea",
      "rows": 3,
      "required": false,
      "ai_help": "Hardware, software, specific tools, reference material access.",
      "placeholder": "e.g., Reliable internet, personal computer, access to US clinical guidelines.",
      "prefill_guidance": "Extract hardware, software, tool-specific experience (e.g., 'EMIS EPR/EMR experience required'), and any reference-material access. Leave empty if not specified."
    },
    {
      "key": "context_notes",
      "label": "Additional context for the creative team",
      "type": "textarea",
      "rows": 4,
      "required": false,
      "ai_help": "The brief-to-the-brief. What should the creative team KNOW about this project that isn't captured elsewhere? Who is this really for, what's the emotional register, what makes this project distinctive?",
      "placeholder": "e.g., This is a clinical documentation quality project, not a data-entry gig. The tone should respect the expertise of practicing physicians and residents.",
      "prefill_guidance": "Synthesize the overall feel of the project. Who is this really for? What's the emotional register? What tone should the creative team aim for? What's distinctive about this vs. generic data work? Pull language from the source text where it signals positioning — but write in the first person as if briefing the creative team. This field is the most important for downstream Stage 1 derivation."
    }
  ]
}
```

### Pre-fill UX

- The 7 fields are **never empty on first render**. They are pre-filled by LLM inference from whatever source text the recruiter provided (pasted RFP, uploaded file, long task description — we stay source-agnostic in user-facing copy).
- Each pre-filled field shows a subtle **"✨ AI drafted — review and edit"** badge. The badge is removed once the field is manually edited.
- **Fallback for missing source text:** If the recruiter hasn't provided source text, the extraction still runs using the available fields (title, task type, region, language). The drafts will be more generic; the recruiter will edit them more heavily. This is expected.
- **Re-extract confirm:** If the recruiter clicks "Re-extract" after editing fields manually, a confirm dialog warns: "This will replace N fields you've edited. Continue?" No diff UI in v1 — that's a v2 polish item.

### Extraction prompt extension

`src/lib/extraction-prompt.ts` is extended to output a `job_requirements` sub-object in its extraction JSON, populated field-by-field using each field's `prefill_guidance`. The existing fields the extractor already produces (title, languages, regions) continue to work unchanged — we're adding a new nested object, not restructuring the existing output.

### Admin schema editor compatibility

The existing admin schema editor in `src/app/admin/schemas/` renders task type schemas as editable forms. The new section and fields use the existing schema structure (section / fields / type / required), so the editor should render them without changes. The `ai_prefilled` flag and `prefill_guidance` field are additive metadata — if the editor doesn't render them, that's fine; they're consumed only by the extraction prompt and the frontend badge logic.

## § 2 — DB Schema Changes

The 7 Job Requirements fields AND the critical pillar values get first-class DB columns for accuracy, queryability, and write-time validation. Free-text nested structures stay in JSONB.

### The hybrid decision

**Columns for shared/required/queryable data. JSONB for genuinely variable, nested, or array-heavy data.**

Rule applied:
- Shared across all task types + fixed shape + queried for branching or analytics → **first-class column**
- Nested arrays, sub-objects, or fields that only one consumer reads → **JSONB**

### New columns on `intake_requests`

```sql
ALTER TABLE intake_requests
  -- The 7 Job Requirements fields (nullable at DB, required-ness in app code)
  ADD COLUMN IF NOT EXISTS qualifications_required   TEXT,
  ADD COLUMN IF NOT EXISTS qualifications_preferred  TEXT,
  ADD COLUMN IF NOT EXISTS location_scope            TEXT,
  ADD COLUMN IF NOT EXISTS language_requirements     TEXT,
  ADD COLUMN IF NOT EXISTS engagement_model          TEXT,
  ADD COLUMN IF NOT EXISTS technical_requirements    TEXT,
  ADD COLUMN IF NOT EXISTS context_notes             TEXT;
```

**All 7 are nullable at the DB level.** Required-ness (for `qualifications_required`, `location_scope`, `language_requirements`, `engagement_model`) is enforced in application code — specifically in `src/lib/validation.ts` on form submit and in `src/app/api/intake/route.ts` on POST. This matches the existing pattern where `intake_requests.volume_needed INT` is nullable but validated in the app layer.

**Why these 7 are columns instead of JSONB:**

1. They are SHARED across all task types (every task needs them)
2. They are queried via `ILIKE` in the admin dashboard (e.g., "show campaigns where qualifications_required mentions 'board certified'")
3. They appear in `information_schema.columns` so the schema self-documents
4. No JSONB path gymnastics required in downstream code — just `SELECT qualifications_required`
5. Standard full-text search indexes work without custom JSONB path configuration

### New columns on `creative_briefs`

```sql
ALTER TABLE creative_briefs
  ADD COLUMN IF NOT EXISTS pillar_primary       TEXT
    CHECK (pillar_primary IN ('earn', 'grow', 'shape')),
  ADD COLUMN IF NOT EXISTS pillar_secondary     TEXT
    CHECK (pillar_secondary IN ('earn', 'grow', 'shape')),
  ADD COLUMN IF NOT EXISTS derived_requirements JSONB;

CREATE INDEX IF NOT EXISTS idx_creative_briefs_pillar_primary
  ON creative_briefs(pillar_primary)
  WHERE pillar_primary IS NOT NULL;
```

**Why `pillar_primary` and `pillar_secondary` are enum-constrained columns (not JSONB):**

1. These are the ONLY closed-enum fields in the whole `derived_requirements` data structure
2. Downstream Stage 3 copy generation and Stage 4 composition (both in the next spec cycle) will BRANCH on `pillar_primary` — this is the single most important value in the derived data
3. The `CHECK` constraint catches LLM hallucinations at write time (e.g., if the LLM outputs `"shapes"` or `"sharp"` instead of `"shape"`, the INSERT fails loudly instead of silently breaking downstream stages)
4. Analytics queries ("what percent of campaigns this month are Shape pillar?") run as simple `GROUP BY pillar_primary` instead of painful JSONB path expressions
5. Partial index on `pillar_primary` where non-null enables fast pillar-based dashboard queries

**Why `derived_requirements` is a JSONB column (not more individual columns):**

1. `visible_tools`, `acceptable_tiers`, and `excluded_archetypes` are arrays of free-text — awkward to model as columns
2. `visual_direction` has 5 nested sub-fields — flattening them into 5 individual columns is noisy
3. `persona_constraints` has similar nested structure
4. These fields are READ by Stage 1/2/3/4 consumers but not queried by analytics or admin dashboards — JSONB read access is fine
5. If future derived fields need to be added (e.g., `voice_tone` for Stage 5 video), they land inside this JSONB without any migration

### What stays in existing JSONB

- **`intake_requests.form_data`** — continues to hold task-type-specific fields (e.g., medical annotation could add a "HIPAA training confirmation" field via the schema editor). The 7 shared Job Requirements fields MOVE OUT of form_data into their own columns. `form_data` remains for per-task-type customization that the admin schema editor manages.
- **`creative_briefs.brief_data`** — continues to hold the rest of the brief output (summary, messaging_strategy, personas, etc.). Only the `derived_requirements` sub-object gets promoted to its own column for cleaner structure and downstream consumption.

### Migration pattern

Same idempotent `IF NOT EXISTS` pattern as the Phase 1 brand voice migration (`campaign_slug`, `tracked_links`):

1. **Update both files in sync**:
   - `src/lib/db/schema.ts` — TypeScript-side schema definitions
   - `scripts/init-db.mjs` — JS init script with raw SQL statements
2. **Run `node scripts/init-db.mjs`** — idempotent, safe to re-run, adds columns without touching existing data
3. **Existing rows get NULL values** for the new columns — graceful degradation
4. **Application code reads from columns first** when populated, falls back to `form_data.job_requirements` sub-object for any stale rows that used the earlier JSONB approach (if any exist — we're early enough in development that they probably don't, but the fallback is cheap insurance)
5. **No forced backfill** — existing intake_requests (Project Cutis) gracefully show NULL until the next form edit or regenerate, at which point the pre-fill extraction populates the columns

### Schema changes summary table

| Table | Change | Type | Nullable | Rationale |
|---|---|---|---|---|
| `intake_requests` | +`qualifications_required` | TEXT | yes | Shared, queryable, required in app code |
| `intake_requests` | +`qualifications_preferred` | TEXT | yes | Shared, optional |
| `intake_requests` | +`location_scope` | TEXT | yes | Shared, queryable, required in app code |
| `intake_requests` | +`language_requirements` | TEXT | yes | Shared, queryable, required in app code |
| `intake_requests` | +`engagement_model` | TEXT | yes | Shared, queryable, required in app code |
| `intake_requests` | +`technical_requirements` | TEXT | yes | Shared, optional |
| `intake_requests` | +`context_notes` | TEXT | yes | Shared, optional |
| `creative_briefs` | +`pillar_primary` | TEXT w/ CHECK | yes | 3-enum, branched on by Stage 3/4, analytics-critical |
| `creative_briefs` | +`pillar_secondary` | TEXT w/ CHECK | yes | 3-enum, backup angle |
| `creative_briefs` | +`derived_requirements` | JSONB | yes | Nested arrays + free-text, read-only downstream |
| `creative_briefs` | +`idx_creative_briefs_pillar_primary` | partial index | — | Fast pillar-based analytics |

**Total: 10 new columns + 1 JSONB column + 1 partial index across 2 existing tables. No new tables. No destructive changes.**

## § 3 — Cultural Research Refactor

The cultural research engine (`worker/prompts/cultural_research.py`, 1056 lines) currently has 9 hardcoded research dimensions, all framed around gig work / freelance / data annotation. This completely breaks for credentialed jobs like Cutis — a dermatology project gets back research about "AI fatigue among gig workers" and "scam associations with work-from-home online" when it should get research about the US dermatology professional community.

Cultural research is the FIRST pipeline stage that sees the intake data. Making it context-aware makes everything downstream (Stage 1 brief, derived_requirements, personas) automatically smarter.

### Scope of the refactor

**In scope:**
- Pass the 7 Job Requirements columns (read from `intake_requests`) into the cultural research prompt
- Add a `{work_tier_context}` substitution helper that produces a 1-sentence descriptor from `qualifications_required` (e.g., "credentialed medical clinical documentation work" vs "language-based data annotation")
- Update ALL 9 existing dimensions' `query_template` strings to reference `{work_tier_context}` so they adapt to the credential tier
- Add 3 NEW conditional dimensions: `professional_community`, `domain_trust_signals`, `work_environment_norms`
- Update `build_research_summary` helper to include the new dimensions in its output
- Update `apply_research_to_personas` helper to pass the new context through to persona generation
- Expand `REGIONAL_PLATFORM_PRIORS` with baseline professional platform data for US and UK (Doximity, medical Twitter, Justia, specialty subreddits, LinkedIn groups for credentialed work)

**Out of scope (deferred to future cycles):**
- Rewriting existing dimensions from scratch (we're updating query templates, not gutting them)
- Adding 10+ more domain-specific dimensions (we're adding 3, not 10)
- Fully dynamic dimension selection via LLM classification (we're using conditional activation via boolean flags, not ML classification)
- Exhaustive `REGIONAL_PLATFORM_PRIORS` coverage for every region × profession (US + UK only in this ship)

### The `{work_tier_context}` helper

New function added to `worker/prompts/cultural_research.py`:

```python
def derive_work_tier_context(intake_row: dict) -> str:
    """Produce a 1-sentence descriptor of the work tier from job requirements.

    Used as the {work_tier_context} substitution in research query templates.
    Keeps dimension queries aware of whether this is credentialed, professional,
    or gig-tier work without hardcoded branching on specific job types.

    Examples:
      Cutis  → "credentialed US clinical documentation work for licensed
                medical professionals"
      Onyx   → "language-based remote data annotation requiring Finnish
                fluency, no professional credentials required"
      UK GPs → "one-time professional research session for practicing UK
                general practitioners"

    Parameters
    ----------
    intake_row
        Dict-like with keys: qualifications_required, location_scope,
        language_requirements, engagement_model, task_type, context_notes
    """
    parts: list[str] = []

    quals = (intake_row.get("qualifications_required") or "").strip()
    if quals:
        # Use first sentence of qualifications as the credential signal
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
        task_type = intake_row.get("task_type", "data work")
        return f"{task_type} work described in the intake form"

    return ". ".join(parts)
```

The helper is pure string processing — no LLM call, no classification model, no branching on specific domains. It just concatenates the first sentences of the relevant job requirements fields into a descriptive blob. The research LLM reads this blob and adapts its dimension queries accordingly.

### Updated existing dimensions

Each of the 9 existing dimensions gets its `query_template` updated to reference `{work_tier_context}`. Example for `gig_work_perception`:

**Before:**
```python
"gig_work_perception": {
    "query_template": (
        "How is gig work / freelance work perceived in {region} among "
        "{demographic}? Is it stigmatized, aspirational, or seen as a necessity?"
    ),
}
```

**After:**
```python
"gig_work_perception": {
    "query_template": (
        "CONTEXT: This campaign is recruiting people for: {work_tier_context}. "
        "How is this specific KIND of work perceived in {region} among "
        "{demographic}? Adapt your answer to the credential tier — "
        "if the work is credentialed professional work, research how "
        "professional-tier contract work or moonlighting is viewed in {region}. "
        "If it's entry-level gig or language work, research how gig work is "
        "viewed. Is the work in this tier stigmatized, aspirational, or seen "
        "as a necessity within its own tier?"
    ),
    "why_it_matters": (
        "Gig work stigma is irrelevant for credentialed professionals. "
        "We need to know how THIS specific tier of work is perceived in "
        "the region, not generic gig framing."
    ),
    "output_keys": ["perception", "cultural_framing", "messaging_implication", "tier_specific_notes"],
}
```

Similar updates apply to all 9 dimensions. The `{work_tier_context}` substitution happens at query-build time, giving each dimension the specific job context.

### The 3 new conditional dimensions

Added to the `RESEARCH_DIMENSIONS` dict, activated via a new `activates_when` field:

```python
"professional_community": {
    "query_template": (
        "CONTEXT: This campaign is recruiting for: {work_tier_context}. "
        "What professional community platforms, forums, and networks are "
        "actively used by people in this profession in {region}? "
        "Include: professional association websites, medical networks "
        "(Doximity, Sermo), legal networks (Justia, Martindale), "
        "specialty subreddits, professional Twitter/X communities, "
        "LinkedIn groups, specialty conferences/events with active online "
        "communities, and any locale-specific professional platforms. "
        "Rank by active usage among practicing professionals in {region}. "
        "Which platforms are free to post on? Which have paid advertising?"
    ),
    "why_it_matters": (
        "Credentialed professionals do not hang out on TikTok or Reddit "
        "r/beermoney. They use professional community platforms that "
        "generic gig research misses entirely."
    ),
    "activates_when": {
        "qualifications_contain_any": [
            "licensed", "certified", "board", "registered",
            "MD", "DO", "PhD", "JD", "CFA", "CPA", "PE",
            "credentialed", "professional", "specialist",
        ]
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
        "would establish legitimacy? What are the RED FLAGS that would "
        "make a professional in this field immediately dismiss an offer "
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
        "credential_tier_at_or_above": "language_fluency"  # any non-generic job
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
        "PHYSICAL work environment: home office? clinical setting? professional "
        "office? field work? studio? What does the typical workspace look "
        "like for this credential tier in this region — size, lighting, "
        "visible tools, background appropriateness? What WARDROBE is "
        "expected or credible (casual, business-casual, lab coat, scrubs, "
        "field gear)? What VISIBLE TOOLS would appear in or near the "
        "worker (laptop, medical chart, EHR monitor, dermatoscope, "
        "drawing tablet, microphone, etc.)? This dimension directly feeds "
        "visual/creative direction downstream — be specific and culturally "
        "grounded."
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

### Conditional activation logic

New helper function:

```python
def should_run_dimension(
    dimension_name: str,
    dimension_config: dict,
    intake_row: dict,
) -> bool:
    """Decide whether a given dimension should run for this campaign.

    Dimensions with no 'activates_when' run always (backwards compat with
    the existing 9 dimensions). New conditional dimensions use one of:

    - "activates_when": "always" — run unconditionally
    - "activates_when": {"qualifications_contain_any": [keywords]}
        — run if any keyword appears in qualifications_required (case-insens)
    - "activates_when": {"credential_tier_at_or_above": "language_fluency"}
        — run for any job with non-empty qualifications_required
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
            # Simple non-empty check — any populated qualifications field
            # counts as at-or-above language_fluency
            return bool(quals.strip())

    return True  # default to running if trigger syntax is unfamiliar
```

The runner in `run_cultural_research()` (existing function in `cultural_research.py`) iterates all dimensions and calls `should_run_dimension` before dispatching each query.

### Expanded `REGIONAL_PLATFORM_PRIORS`

Add professional platform baseline data to the US and UK entries:

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

Other regions get added incrementally as campaigns need them. US + UK cover the two example jobs in this spec (Cutis US, Physicians UK).

### Updated `build_research_summary` and `apply_research_to_personas`

Both helpers are updated to include the new dimensions in their output:

- `build_research_summary` adds new sections for `professional_community`, `domain_trust_signals`, and `work_environment_norms` when those dimensions ran
- `apply_research_to_personas` feeds the new context into the persona generation prompt so personas are informed by professional community data + trust signals + work environment norms

### Data flow with the refactored research

```
intake_requests (with 7 new Job Requirements columns populated)
                          │
                          ▼
derive_work_tier_context(intake_row) → "credentialed US clinical
                                         documentation work for licensed
                                         medical professionals"
                          │
                          ▼
run_cultural_research(region, language, intake_row, work_tier_context)
  For each dimension in RESEARCH_DIMENSIONS:
    if should_run_dimension(dim_name, dim_config, intake_row):
      build query using query_template.format(
        region=region,
        language=language,
        work_tier_context=work_tier_context,
        demographic=demographic,
      )
      call Kimi K2.5 with the query
      parse structured output
  All 9 base dimensions run (context-aware)
  professional_community runs (keyword match on "licensed", "MD", etc.)
  domain_trust_signals runs (non-empty qualifications_required)
  work_environment_norms runs (always)
                          │
                          ▼
creative_briefs.brief_data.cultural_research = {
  ai_fatigue: { fatigue_level: "...", sentiment: "..." },
  gig_work_perception: { perception: "...", tier_specific_notes: "..." },
  // ... all 9 base dimensions with tier-aware content ...
  professional_community: { professional_platforms_ranked: [...], credibility_markers: [...] },
  domain_trust_signals: { trust_signals: [...], red_flags: [...] },
  work_environment_norms: { work_environment: "...", wardrobe: "...", visible_tools: [...] },
}
                          │
                          ▼
Stage 1 brief generation reads BOTH:
  - intake_requests job requirements columns (raw facts)
  - cultural_research (context-aware regional intelligence)
  → produces derived_requirements (visual_direction gets seeded from
     work_environment_norms; persona_constraints gets informed by
     professional_community + domain_trust_signals)
```

### Files touched for § 3

| Path | State | Change |
|---|---|---|
| `worker/prompts/cultural_research.py` | MODIFIED (large) | Update all 9 dimension query_templates to use `{work_tier_context}`. Add 3 new conditional dimensions with `activates_when` triggers. Add `derive_work_tier_context` and `should_run_dimension` helper functions. Expand `REGIONAL_PLATFORM_PRIORS` for US and UK. Update `build_research_summary` and `apply_research_to_personas` to include new dimensions. |
| `worker/pipeline/stage1_intelligence.py` | MODIFIED (minor) | Updated to pass the 7 intake Job Requirements columns into `run_cultural_research` |

### Risk mitigation for § 3

- **Risk:** Existing research queries break because the `{work_tier_context}` substitution happens at format-time, and if any existing template uses `{}` braces that aren't meant as format placeholders, the substitution would fail silently or crash.
  **Mitigation:** Every existing `query_template` is reviewed during the edit. Only the explicit placeholders (`{region}`, `{demographic}`, `{language}`, `{work_tier_context}`) are `.format`-ted. Any literal `{` in a query is escaped as `{{`.

- **Risk:** The conditional dimensions add 3 extra LLM calls per campaign, increasing cost and latency.
  **Mitigation:** The 3 new dimensions only run when appropriate (keyword-triggered or always for `work_environment_norms`). For a typical Cutis-style campaign, all 3 run = 3 extra calls = maybe 10-15 seconds and a few cents of LLM cost. Worth it. For language-only jobs, only `work_environment_norms` runs = 1 extra call.

- **Risk:** `REGIONAL_PLATFORM_PRIORS` for professional platforms could be inaccurate (e.g., claiming Doximity has strong UK presence when it's US-dominant).
  **Mitigation:** Only add priors we're confident about. When uncertain, omit — the LLM will research it fresh. Priors are a validation layer + fallback, not the source of truth.

## § 4 — Stage 1 Brief Extension (`derived_requirements`)

### The output schema

Added as a new sub-object in the existing `creative_briefs.brief_data` JSONB output. No rename or restructure of existing fields. Downstream consumers that don't know about `derived_requirements` continue to work.

```jsonc
{
  "credential_summary": "2-3 sentence compressed read of qualifications_required — what level of expertise does this job demand in one glance?",

  "pillar_weighting": {
    "primary": "shape | grow | earn",
    "secondary": "shape | grow | earn",
    "reasoning": "1-2 sentences explaining WHY this pillar."
  },

  "visual_direction": {
    "work_environment": "Free-text description of the physical environment where this work credibly happens. Be specific.",
    "wardrobe": "Free-text description of appropriate attire.",
    "visible_tools": ["Array of credible props that should appear in or near the actor"],
    "emotional_tone": "Free-text description of the emotional register.",
    "cultural_adaptations": "Free-text pulling from cultural_research — regional/cultural specifics the scene should respect."
  },

  "persona_constraints": {
    "minimum_credentials": "Free-text statement of the minimum bar.",
    "acceptable_tiers": ["Free-text array of acceptable applicant profiles"],
    "age_range_hint": "Free-text age guidance based on credential progression.",
    "excluded_archetypes": ["Array of DISAMBIGUATED phrases (not single words) that must not appear in generated personas"]
  },

  "narrative_angle": "One-sentence positioning summary for the creative team."
}
```

### Key properties

- **Free-text everywhere, no enums.** Any future job type fits without code changes.
- **`pillar_weighting.primary` is the only constrained field** — must be one of `earn | grow | shape`. This is the single handoff to the existing Phase 1 brand voice module.
- **`excluded_archetypes` phrases MUST be disambiguated** (not single words like `"student"`). The Stage 1 prompt rules instruct the LLM to write phrases like `"general student without clinical years"` or `"pre-med undergraduate"` so they don't collide with acceptable tiers. The validator matches on full substring, not word-boundary regex.

### Prompt modifications

The Stage 1 brief prompt in `worker/prompts/recruitment_brief.py` is extended with 4 new sections in the system prompt:

1. **`## DERIVED REQUIREMENTS (NEW — REQUIRED OUTPUT)`** — tells the LLM it must populate a `derived_requirements` sub-object using the job requirements + cultural research.

2. **`## PILLAR SELECTION RULES`**:
   - Board-certified or licensed professional credentials required → `shape` primary
   - Professional experience or domain knowledge required (but no license) → `grow` primary
   - Language fluency or general detail-orientation only → `earn` primary
   - Secondary pillar picks the next-closest fit along the Shape → Grow → Earn ladder

3. **`## VISUAL DIRECTION RULES`**:
   - If qualifications require a clinical license → `work_environment` must be clinical
   - If qualifications require business professional credentials → `work_environment` must be professional office
   - Language-only or detail work → home office is fine
   - Physical/outdoor work → `work_environment` describes the actual setting
   - `wardrobe` must match credential tier
   - `visible_tools` should be credible for the work described

4. **`## EXCLUDED ARCHETYPES RULES`**:
   - For credentialed jobs, `excluded_archetypes` MUST include disambiguated phrases like `"general gig worker"`, `"stay-at-home parent without the specific credential"`, `"side-hustle freelancer"`, `"pre-med undergraduate"`
   - Phrases must be specific enough to not collide with acceptable tiers
   - For gig/language jobs, `excluded_archetypes` may be empty or minimal
   - The validator matches the phrase as a full substring (case-insensitive), so single-word entries would over-match and must be avoided

### Admin visibility

A new collapsible section in `src/components/BriefExecutive.tsx` called **"Derived Requirements (AI-generated analysis)"** renders the 5 sub-fields so Steven can audit the LLM's interpretation before approval. Read-only in v1. If the derived output looks wrong, Steven regenerates Stage 1 with a feedback note via the existing regenerate flow.

## § 5 — Persona Engine Refactor

### Hard deletion of the 8 archetypes

Before any new code lands, every reference to the old archetype system is swept from the repo:

```bash
grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/
```

Every hit is addressed in the deletion commit:

- If it's a runtime reference in `worker/prompts/persona_engine.py` — replaced with the new dynamic generation path
- If it's an import elsewhere in the worker — deleted (and the consuming code updated to call the new `build_persona_prompt` function)
- If it's a test in `worker/tests/smoke_test.py` — deleted or replaced with a new test for `validate_personas`
- If it's a docstring or comment — updated to reflect the new architecture

**Acceptance criterion for the deletion commit:** `grep` returns zero hits for all of the patterns above after the commit lands.

### The new `persona_engine.py`

Target size: ≤200 lines (down from ~400). Structure:

```python
"""Persona Engine — generates dynamic target personas from derived_requirements
and cultural research.

Replaced the legacy 8-archetype system (deleted in commit <SHA>) with
LLM-generated personas constrained by intake job requirements + cultural
research. See worker/brand/oneforma.py for brand voice constraints and
worker/prompts/recruitment_brief.py for the derived_requirements source.
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
    "Return ONLY valid JSON. No markdown. No commentary."
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
        output of the cultural_research stage
    persona_constraints
        derived_requirements.persona_constraints from the Stage 1 brief
    brief_messaging
        optional messaging_strategy from the brief for additional context
    previous_violations
        optional list of validation failures from an earlier attempt,
        injected into the prompt as feedback
    """
    ...
```

The function returns a prompt string that the existing Stage 1 runner in `worker/pipeline/stage1_intelligence.py` passes to its existing LLM client. No new LLM infrastructure required.

### The new persona schema

Each generated persona keeps the field names existing consumers read (so Stage 2/3 don't break), but the content becomes credential-aware:

```python
{
    "name": "Culturally-appropriate full name",
    "archetype": "Description of who this person is — derived from acceptable_tiers, NOT a hardcoded archetype key",
    "age_range": "Specific within age_range_hint",
    "lifestyle": "What their daily life actually looks like — specific to the credential context",
    "motivations": ["Why THIS persona would do this job"],
    "pain_points": ["What frustrates THIS persona"],
    "digital_habitat": ["Where THIS persona spends time online — from cultural_research"],
    "psychology_profile": {
        "primary_bias": "...",
        "secondary_bias": "...",
        "messaging_angle": "...",
        "trigger_words": ["..."]
    },
    "jobs_to_be_done": { "functional": "...", "emotional": "...", "social": "..." },
    "objections": ["..."],
    "best_channels": ["..."],

    // NEW field — links persona back to the constraint it satisfies
    "matched_tier": "Which of the acceptable_tiers this persona represents"
}
```

The new `matched_tier` field is the only schema addition. Existing consumers ignore it; the validator uses it to confirm the persona satisfies a declared tier.

### Validation function

New file: `worker/pipeline/persona_validation.py`.

```python
"""Deterministic persona validation against derived_requirements.persona_constraints.

Matches excluded_archetype phrases as full-substring, case-insensitive against
a concatenated blob of persona fields. Single-word entries in excluded_archetypes
are discouraged by the Stage 1 prompt rules because they would over-match and
reject valid personas.
"""
from __future__ import annotations


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
        for kw in constraints.get("excluded_archetypes", [])
        if kw and isinstance(kw, str)
    ]

    for i, persona in enumerate(personas):
        if not isinstance(persona, dict):
            violations.append(f"Persona at index {i} is not a dict — cannot validate.")
            continue

        persona_name = persona.get("name", f"persona_{i + 1}")

        # Check matched_tier is populated
        if not persona.get("matched_tier"):
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

**Why full substring match instead of word-boundary regex?** The Stage 1 prompt rules instruct the LLM to write disambiguated multi-word phrases in `excluded_archetypes` (e.g., `"pre-med undergraduate"`, not `"student"`). Full substring matching on the complete phrase is safer than token-level word-boundary matching, which would let single-word entries over-match legitimate personas.

### Retry loop integration

In `worker/pipeline/stage1_intelligence.py`, the Stage 1 runner gains a new post-generation loop:

```python
MAX_PERSONA_RETRIES = 2  # configurable via env var if needed

previous_violations: list[str] = []
for attempt in range(MAX_PERSONA_RETRIES + 1):
    brief_json = run_stage1_brief(
        request,
        cultural_research,
        feedback=previous_violations,
    )
    derived = brief_json.get("derived_requirements", {})
    constraints = derived.get("persona_constraints", {})
    personas = brief_json.get("personas", [])

    ok, violations = validate_personas(personas, constraints)
    if ok:
        save_brief(brief_json)
        save_personas(personas)
        break

    if attempt >= MAX_PERSONA_RETRIES:
        raise Stage1PersonaValidationError(
            f"Persona validation failed after {MAX_PERSONA_RETRIES + 1} attempts. "
            f"Violations: {'; '.join(violations)}"
        )

    previous_violations = violations
```

The existing Stage 1 brief prompt already has a `feedback_section` for retry loops (from the Phase 1 brand voice rewrite). The validation violations are fed into that section as specific corrective feedback.

### New exception class

`worker/pipeline/persona_validation.py` also exports:

```python
class Stage1PersonaValidationError(Exception):
    """Raised when Stage 1 persona validation persistently fails after max retries.

    The compute_job runner catches this exception and marks the job as failed
    with the error message surfaced in the admin dashboard for manual review.
    """
```

### Admin dashboard error surface

`src/app/admin/pipeline/page.tsx` (or wherever the worker/pipeline monitor lives) is updated to display `Stage1PersonaValidationError` messages prominently when a compute_job is in `failed` status. The error message includes the full violation list so Steven can see exactly why the brief kept generating bad personas. Typical remediation: edit the intake form fields (especially `context_notes` and `qualifications_required`) to be more specific, then regenerate.

## § 6 — Data Flow Walkthrough (Cutis example)

```
1. Recruiter opens /intake/new, selects "Data Annotation" task type,
   pastes the Cutis source text into the PasteExtract component.

2. POST /api/intake/extract fires with the source text + task_type.
   The extended extraction prompt returns:
     {
       title: "Cutis – Clinical Dermatology Documentation",
       target_languages: ["en"],
       target_regions: ["US"],
       job_requirements: {
         qualifications_required: "Licensed dermatologist (MD/DO) OR ...",
         qualifications_preferred: "Board certification in dermatopathology, ...",
         location_scope: "US residents only — work must reflect US clinical ...",
         language_requirements: "English (US) — native or near-native fluency ...",
         engagement_model: "Ongoing per-approved-asset work ...",
         technical_requirements: "Reliable internet, personal computer, ...",
         context_notes: "This is a clinical documentation quality project ..."
       }
     }

3. Form renders all fields with "✨ AI drafted" badges on the 7 new
   Job Requirements fields. Recruiter reviews, tweaks engagement_model
   wording, submits.

4. intake_requests row created with form_data.job_requirements populated.
   Status set to 'generating'. compute_job queued.

5. Worker picks up the compute_job. Stage 1 starts:
   - Reads form_data.job_requirements
   - Calls cultural_research stage (unchanged)
   - Calls LLM with updated brief prompt (brand voice + derived requirements rules)
   - LLM returns brief_json with:
     {
       summary: "...",
       messaging_strategy: { ... },
       personas: [
         {
           name: "Dr. Jennifer Chen",
           archetype: "Second-year dermatology resident at a US teaching hospital",
           matched_tier: "Dermatology resident at US teaching hospital",
           ...
         },
         {
           name: "Dr. Marcus Rivera",
           archetype: "Board-certified dermatologist in private practice",
           matched_tier: "Board-certified dermatologist in US practice",
           ...
         },
         {
           name: "Priya Patel",
           archetype: "Fourth-year US medical student on dermatology rotation",
           matched_tier: "Fourth-year US med student on derm rotation",
           ...
         }
       ],
       derived_requirements: {
         credential_summary: "Credentialed US clinical dermatology professionals ...",
         pillar_weighting: {
           primary: "shape",
           secondary: "grow",
           reasoning: "..."
         },
         visual_direction: {
           work_environment: "Modern US dermatology exam room OR clinician workstation ...",
           wardrobe: "White lab coat over business-casual or scrubs ...",
           visible_tools: ["Tablet or monitor showing EHR interface", ...],
           emotional_tone: "Authoritative and empathetic ...",
           cultural_adaptations: "US clinical aesthetic, EHR-heavy workflow ..."
         },
         persona_constraints: {
           minimum_credentials: "MD/DO with dermatology training OR ...",
           acceptable_tiers: [
             "Board-certified dermatologist in US practice",
             "Dermatology resident at US teaching hospital",
             "Fourth-year US med student on derm rotation",
             "Family medicine physician with documented dermatology experience"
           ],
           age_range_hint: "24-55",
           excluded_archetypes: [
             "generic gig worker",
             "stay-at-home parent without medical training",
             "side-hustle freelancer",
             "pre-med undergraduate",
             "retiree without active clinical practice",
             "non-medical multilingual professional",
             "general student without clinical years"
           ]
         },
         narrative_angle: "Credentialed US clinical professionals contributing ..."
       }
     }

6. validate_personas() runs against the 3 personas + constraints.
   For each persona, it builds a blob from archetype + lifestyle +
   matched_tier + motivations, lowercases it, and checks each
   excluded_archetypes phrase as a full substring.

   All 3 personas pass — none of them contain the phrases
   "generic gig worker", "stay-at-home parent without medical training",
   "pre-med undergraduate", etc. The word "student" does appear in
   Priya Patel's description, but "general student without clinical
   years" does NOT appear as a full phrase, so the substring match
   doesn't trigger.

7. Brief and personas saved to creative_briefs + actor_profiles.
   Stage 2 continues with the new credentialed personas. Visual output
   is still generic (home office backdrops) because Stage 2 doesn't yet
   read derived_requirements.visual_direction — that's the next spec cycle.

8. Admin dashboard shows the brief with a new "Derived Requirements
   (AI-generated analysis)" card where Steven can audit the pillar
   weighting, visual direction, persona constraints, and narrative angle
   before approving.
```

### Contrasting example — Onyx Finnish OCR

For a non-credentialed job, the same flow produces very different output:

- `derived_requirements.pillar_weighting.primary === "earn"` (language fluency only, no credential tier)
- `derived_requirements.visual_direction.work_environment === "home office with laptop and good lighting"` (gig-appropriate)
- `derived_requirements.persona_constraints.excluded_archetypes === []` (no exclusions needed for a language-only job)
- Generated personas include language-focused profiles (Finnish native speakers, bilingual students, multilingual freelancers — all valid for a gig-tier job)

This proves the system generalizes: the same schema and same LLM prompt produce credential-appropriate output for both credentialed and gig jobs, with zero hardcoded branching.

## § 7 — Error Handling + Edge Cases

| Case | Behavior |
|---|---|
| Extraction fails or times out | Fields remain empty; user can still fill them manually. No blocking error. |
| Recruiter submits with empty required job_requirements fields | Form validation blocks submit. Required fields must be non-empty. |
| Existing intake_requests without job_requirements (Project Cutis, etc.) | Stage 1 gracefully handles missing section. LLM infers from title/task_type/region/language with weaker output. On next form edit, pre-fill runs and populates the fields for review. |
| Stage 1 LLM generates a persona that violates excluded_archetypes | Deterministic validator catches it, feeds violations back into the retry prompt, Stage 1 regenerates. Max 2 retries. |
| Validation fails persistently (after 2 retries) | `Stage1PersonaValidationError` raised, compute_job marked failed, admin dashboard shows error with violation list for manual remediation. |
| LLM outputs malformed `derived_requirements` JSON (missing fields, wrong shape) | Treated as a brief generation failure — falls into the existing brief retry loop, not the persona validation loop. If persistently malformed after retries, the compute_job fails. |
| `excluded_archetypes` contains a single word that over-matches (e.g., `"student"`) | The substring match WILL over-match, rejecting valid personas. This is considered prompt engineering user error. Mitigation: the Stage 1 prompt rules explicitly tell the LLM to use disambiguated multi-word phrases. Admin can also manually review the derived_requirements card and regenerate if they see a bad excluded list. |
| Recruiter clicks Re-extract after manually editing | Confirm dialog warns about losing edits. User must explicitly confirm. |
| Extraction prompt returns a field with invalid type (e.g., array instead of string) | Frontend renders what it can and logs a warning. The form validation catches type mismatches on submit. |
| Brand voice block from Phase 1 isn't loading (missing import) | Stage 1 prompt construction fails with a clear ImportError. This is a deploy-time issue, not a runtime issue. |
| Cultural research is unavailable or fails | Stage 1 continues with just job_requirements context. Derived requirements will be less culturally nuanced but still functional. |

## § 8 — Testing Strategy

### Throwaway verifier scripts (established Phase 1 pattern)

**1. `scripts/verify-persona-validation.mjs`** — tests `validate_personas` logic with synthetic personas + constraints:

- Clean persona with matched_tier and no excluded phrases → passes
- Persona containing exact excluded phrase in archetype → fails with specific violation
- Persona with ambiguous keyword that is NOT an excluded phrase → passes (substring match, not token match)
- Persona missing `matched_tier` field → fails with specific violation
- Empty `excluded_archetypes` list → always passes for valid personas
- Multiple violations in one persona → reports only the first (one per persona for feedback brevity)
- Non-dict persona at an index → fails with clear message
- Non-string items in `excluded_archetypes` → filtered out, no error
- Case-insensitive matching: `"Student"` phrase matches `"student"` in blob

Run with:
```bash
node --experimental-strip-types scripts/verify-persona-validation.mjs
```

Note: this script must import the Python function, which requires either a Python-to-Node bridge or re-implementing the logic in JS. **Decision:** re-implement the validation logic in the verifier script as a reference implementation. Both sides (Python production, JS verifier) match the same specification. Any divergence is a bug. This is cheaper than setting up a Python ↔ Node bridge for throwaway tests.

### Smoke test updates

`worker/tests/smoke_test.py`:

- Remove any tests that import or assert on `PERSONA_ARCHETYPES` or specific archetype keys
- Add a new test: `test_persona_prompt_builds_from_constraints` — calls `build_persona_prompt` with synthetic constraints and verifies the returned prompt string contains expected markers (e.g., the acceptable_tiers, the age_range_hint, the excluded_archetypes phrases)
- Keep the existing `test_all_imports` test — it should continue to pass after the persona_engine.py rewrite (the module still exports `PERSONA_SYSTEM_PROMPT` and `build_persona_prompt`, just not archetypes)

### Manual verification checklist

After the implementation lands, verify end-to-end:

1. **Brand module + persona engine sanity**
   ```bash
   cd worker && python3 -c "
   from prompts.persona_engine import build_persona_prompt, PERSONA_SYSTEM_PROMPT
   from prompts.recruitment_brief import BRIEF_SYSTEM_PROMPT
   from pipeline.persona_validation import validate_personas, Stage1PersonaValidationError
   print('All imports OK')
   "
   ```

2. **Archetype deletion verification**
   ```bash
   grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/ && echo "FOUND LEAKED" || echo "CLEAN"
   ```
   Expected: `CLEAN` — no hits across worker/ and src/.

3. **Line count check on persona_engine.py**
   ```bash
   wc -l worker/prompts/persona_engine.py
   ```
   Expected: ≤200 lines.

4. **Worker smoke test**
   ```bash
   cd worker && python3 tests/smoke_test.py
   ```
   Expected: all tests pass. The 1 pre-existing `KLING_API_KEY` failure from Phase 1 brand voice work is unrelated and still expected.

5. **Validation verifier script**
   ```bash
   node --experimental-strip-types scripts/verify-persona-validation.mjs
   ```
   Expected: `✓ persona validation verifier passed (N assertions)`

6. **Next.js build sanity**
   ```bash
   npm run build
   ```
   Expected: clean build. This spec adds a schema field and a form section but doesn't restructure any routes.

7. **Manual end-to-end on Cutis** (after deploy)
   - Edit the existing Project Cutis intake via admin to populate the new job_requirements fields (or let them auto-extract from the existing form_data)
   - Trigger a Stage 1 regenerate via the admin dashboard
   - Inspect the generated brief in `creative_briefs.brief_data`
   - Verify `derived_requirements.pillar_weighting.primary === "shape"`
   - Verify `derived_requirements.persona_constraints.excluded_archetypes` contains disambiguated multi-word phrases
   - Verify the 3 generated personas each have a distinct `matched_tier` linking them to one of the acceptable_tiers
   - Verify no persona contains the phrase `"gig worker"` or `"stay-at-home parent without medical training"` in its fields
   - Take screenshots of the new "Derived Requirements" admin card for the progress checkpoint

8. **Manual end-to-end on a contrasting non-credentialed job** (new intake)
   - Create a new intake with the Onyx Finnish OCR source text
   - Verify pre-fill extraction populates the 7 fields with language-focused guidance
   - Verify `derived_requirements.pillar_weighting.primary === "earn"`
   - Verify `derived_requirements.persona_constraints.excluded_archetypes` is empty or minimal
   - Verify generated personas are language-focused (no medical credentials)

9. **Validation retry loop smoke test**
   - Inject a synthetic test where the LLM is forced to generate a persona with an excluded archetype phrase (via a dev-only test endpoint or a manual prompt override)
   - Verify the retry loop fires with correct feedback
   - Verify after 2 failed retries the compute_job ends in `failed` with `Stage1PersonaValidationError` in the error_message
   - Verify the admin dashboard surfaces the error with the full violation list

## § 9 — Migration / Rollout

- **DB migration required.** Idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements added to both `src/lib/db/schema.ts` and `scripts/init-db.mjs` (both files must stay in sync — lesson from Phase 1 brand voice work). Run `node scripts/init-db.mjs` once after deployment to apply. Safe to re-run.
- **No destructive changes.** All 10 new columns are nullable; existing rows get NULL values automatically. `CHECK` constraints on `pillar_primary` / `pillar_secondary` only fire on new writes, not existing rows.
- **Schema seed re-run.** After the column migration, the task_type_schemas seed must be re-run (or the admin manually updates each task type via the schema editor) to prepend the new `JOB_REQUIREMENTS_MODULE` section to existing task type schemas. This is a one-time post-deploy action.
- **Existing intake_requests** (Project Cutis and any others) can be edited via the admin intake editor to populate the new Job Requirements columns. On the next regenerate, Stage 1 will pick them up and produce the new derived_requirements output. No forced backfill script — the columns are nullable and gracefully degrade.
- **Worker restart required.** Because this spec changes Python files in `worker/` (`cultural_research.py`, `recruitment_brief.py`, `persona_engine.py`, `stage1_intelligence.py`, `persona_validation.py`), the long-running worker process must be restarted via the existing `worker/main.py` control mechanism for the changes to take effect.
- **Vercel deploy required** for the frontend updates — this spec touches `src/app/intake/new/page.tsx`, `src/lib/extraction-prompt.ts`, `src/app/admin/schemas/`, `src/components/BriefExecutive.tsx`, and `src/lib/db/schema.ts`. Standard deploy flow: merge feature branch → `vercel --prod` → alias to `nova-intake.vercel.app`.
- **Recommended deploy order:**
  1. Merge to main
  2. Run `node scripts/init-db.mjs` (adds columns — idempotent, safe if already run)
  3. Deploy frontend via `vercel --prod`
  4. Restart the worker process
  5. Re-run the task_type_schemas seed
  6. Verify the new Job Requirements section appears in `/intake/new`
  7. Trigger a test Stage 1 regenerate on Project Cutis and verify the new derived_requirements output

## § 10 — Success Criteria

- ✅ `grep -rn "PERSONA_ARCHETYPES\|the_student\|the_freelancer\|the_stay_at_home_parent\|the_recent_graduate\|the_multilingual_professional\|the_retiree\|the_side_hustler\|the_gig_worker" worker/ src/` returns zero hits
- ✅ `worker/prompts/persona_engine.py` is ≤200 lines and imports without error
- ✅ DB migration applies cleanly: `node scripts/init-db.mjs` completes without error and 10 new columns exist on `intake_requests` + `creative_briefs` after the run
- ✅ CHECK constraints reject bad pillar values: manually attempting to INSERT `pillar_primary = 'sharp'` via psql fails with a constraint violation
- ✅ Intake form at `/intake/new` shows the new Job Requirements section with 7 fields
- ✅ Pasting source text into the intake form pre-fills all 7 fields with "✨ AI drafted" badges
- ✅ Submitted intake populates the 7 new columns on `intake_requests` (verify via psql: `SELECT qualifications_required, location_scope FROM intake_requests ORDER BY created_at DESC LIMIT 1`)
- ✅ Cultural research runs the 3 new conditional dimensions for a credentialed job and skips `professional_community` + `domain_trust_signals` for a language-only job
- ✅ `{work_tier_context}` substitution appears in the cultural_research output dimension queries (spot-check the logged prompts)
- ✅ Stage 1 brief output includes a populated `derived_requirements` JSONB column AND `pillar_primary` / `pillar_secondary` text columns with valid enum values
- ✅ `BriefExecutive.tsx` displays a new "Derived Requirements (AI-generated analysis)" admin card
- ✅ Running Stage 1 regenerate on Project Cutis produces 3 personas with `matched_tier` fields mapping to acceptable dermatology tiers, zero personas containing excluded archetype phrases, and `pillar_primary = 'shape'`
- ✅ Running Stage 1 on a contrasting language-only job produces earn-pillar personas with minimal excluded archetypes and `pillar_primary = 'earn'`
- ✅ Persona validation retry loop demonstrably fires and fails cleanly with clear error messaging when violations persist
- ✅ All verification checks from § 8 pass

## § 11 — Open Questions Deferred to Implementation

- **Exact location of `JOB_REQUIREMENTS_MODULE` constant.** `src/lib/seed-schemas.ts` vs. new file `src/lib/shared-schema-modules.ts` — decide during implementation based on file size and existing conventions.
- **Admin schema editor rendering of `ai_prefilled` flag.** May require a small UI update to render a label. Check during implementation.
- **Re-extract confirm dialog copy.** Exact wording of "This will replace N fields you've edited. Continue?" — decide during implementation (small polish item).
- **`MAX_PERSONA_RETRIES` env var name.** Default 2. Name it something like `STAGE1_PERSONA_MAX_RETRIES` for consistency with existing worker env vars.
- **Whether to add the `JOB_REQUIREMENTS_MODULE` to `task_type_schemas` via seed re-run or via a one-shot migration script.** Seed re-run is simpler if it's idempotent; otherwise a one-shot script. Decide during implementation.

## Post-Phase-A+B → Next Spec Cycle Preview

Once this spec ships and produces credential-aware personas for Project Cutis and a contrasting gig job, the next spec cycle begins with its own brainstorm → spec → plan:

- **Phase C — Scene awareness in Stage 2.** `worker/prompts/recruitment_actors.py` reads `derived_requirements.visual_direction` and injects `work_environment`, `wardrobe`, `visible_tools`, `emotional_tone`, and `cultural_adaptations` into the Seedream scene generation prompt. The hardcoded `REGION_SETTINGS` fallback is retired. For Cutis, the generated actor photos show credentialed medical professionals in clinical environments — not students in home offices.
- **Phase D — Copy pillar weighting in Stage 3.** `worker/prompts/recruitment_copy.py` reads `derived_requirements.pillar_weighting` and biases the 3 copy variations per persona/platform toward the appropriate pillar. Shape-heavy for credentialed jobs, Earn-heavy for gig jobs, Grow-heavy for mid-tier career-building jobs. The existing hero copy templates from the Phase 1 brand voice module are the source of truth for pillar-specific copy patterns.
- **Phase E — HTML template library + Stage 4 composition.** This is Phase 2 of the brand voice initiative. Rebuilds the existing 10 templates + adds ~35 more to reach 45 total. Template selection at composition time uses `derived_requirements.pillar_weighting` to pick the right template category. Consumes `PALETTE`, `TYPOGRAPHY`, `DESIGN_MOTIFS` from `worker/brand/oneforma.py`.

Each phase is its own spec → plan → implementation cycle. This spec (A+B) is the foundation that makes all of them possible.
