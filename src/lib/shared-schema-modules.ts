/**
 * Shared schema field modules prepended to every task_type_schemas entry.
 *
 * These modules define fields that apply to EVERY task type (not just
 * specific ones). Task types can still customize by adding their own
 * fields on top, but the shared modules are the baseline.
 *
 * Phase A of intake schema refactor (2026-04-08) — Job Requirements.
 *
 * Uses the FieldDefinition type from src/lib/types.ts to stay compatible
 * with the existing schema seed + admin editor + dynamic form renderer.
 * The ai_help, prefill_guidance, and rows fields are optional metadata
 * that the extraction prompt and frontend form can read but which the
 * existing admin editor safely ignores.
 */
import type { FieldDefinition } from '@/lib/types';

/** The 7 Job Requirements fields shared across every task type. */
export const JOB_REQUIREMENTS_FIELDS: FieldDefinition[] = [
  {
    key: 'qualifications_required',
    label: 'Required qualifications',
    type: 'textarea',
    rows: 4,
    required: true,
    width: 'full',
    description: 'Minimum bar to even apply. Credentials, degrees, certifications, years of experience, professional licenses, language fluency, specific system experience.',
    placeholder: 'e.g., Licensed dermatologist (MD/DO) OR dermatology resident OR medical student in clinical years with documented dermatology rotation.',
    ai_help: 'Minimum bar to even apply. Credentials, degrees, certifications, years of experience, professional licenses, language fluency, specific system experience.',
    prefill_guidance:
      "Extract every hard requirement from the source text. Use 'OR' to separate acceptable alternatives. Be specific about degree level, board certifications, years of experience, and any required system/tool familiarity.",
  },
  {
    key: 'qualifications_preferred',
    label: 'Preferred but not required',
    type: 'textarea',
    rows: 3,
    required: false,
    width: 'full',
    description: "Nice-to-haves that strengthen an application but aren't mandatory.",
    placeholder: 'e.g., Board certification in dermatopathology, published clinical research, bilingual Spanish fluency.',
    ai_help: "Nice-to-haves that strengthen an application but aren't mandatory.",
    prefill_guidance:
      "Extract soft preferences — things mentioned as 'preferred', 'a plus', 'ideally', 'bonus'. Leave empty if none.",
  },
  {
    key: 'location_scope',
    label: 'Location scope',
    type: 'textarea',
    rows: 2,
    required: true,
    width: 'full',
    description: "Describe the geographic scope in natural language — what's required, what's excluded, and why.",
    placeholder: 'e.g., US residents only — work must reflect US clinical practice and documentation standards.',
    ai_help: "Describe the geographic scope in natural language — what's required, what's excluded, and why.",
    prefill_guidance:
      "Extract explicit location requirements. Include the reasoning if stated. If the source says 'worldwide' or omits location, say so.",
  },
  {
    key: 'language_requirements',
    label: 'Language requirements',
    type: 'textarea',
    rows: 3,
    required: true,
    width: 'full',
    description: 'What languages, what proficiency, any modality requirements.',
    placeholder: 'e.g., English (US) — native or near-native fluency. Must write in clinical register matching US patient-portal standards.',
    ai_help: 'What languages, what proficiency, any modality requirements.',
    prefill_guidance:
      'One line per language. Include proficiency level (native, fluent, conversational, reading-only) and any modality notes (must read handwritten, must speak a specific dialect, must write in a specific register).',
  },
  {
    key: 'engagement_model',
    label: 'Engagement model',
    type: 'textarea',
    rows: 3,
    required: true,
    width: 'full',
    description: "How long is the engagement, how much commitment, what's the compensation structure.",
    placeholder: 'e.g., Ongoing per-approved-asset work. No fixed weekly hours.',
    ai_help: "How long is the engagement, how much commitment, what's the compensation structure.",
    prefill_guidance:
      'Extract: (1) duration (one-time / ongoing / project-based), (2) time commitment (hours/week, total hours, session length), (3) compensation model (per-asset, hourly, project-fee). Include rate if the source specifies one; otherwise leave rate blank — marketing should not invent numbers.',
  },
  {
    key: 'technical_requirements',
    label: 'Equipment & tools',
    type: 'textarea',
    rows: 3,
    required: false,
    width: 'full',
    description: 'Hardware, software, specific tools, reference material access.',
    placeholder: 'e.g., Reliable internet, personal computer, access to US clinical guidelines.',
    ai_help: 'Hardware, software, specific tools, reference material access.',
    prefill_guidance:
      "Extract hardware, software, tool-specific experience (e.g., 'EMIS EPR/EMR experience required'), and any reference-material access. Leave empty if not specified.",
  },
  {
    key: 'context_notes',
    label: 'Additional context for the creative team',
    type: 'textarea',
    rows: 4,
    required: false,
    width: 'full',
    description: 'The brief-to-the-brief. What should the creative team KNOW about this project?',
    placeholder: 'e.g., This is a clinical documentation quality project, not a data-entry gig. Respect the expertise of practicing physicians and residents.',
    ai_help:
      "The brief-to-the-brief. What should the creative team KNOW about this project that isn't captured elsewhere? Who is this really for, what's the emotional register, what makes this project distinctive?",
    prefill_guidance:
      "Synthesize the overall feel of the project. Who is this really for? What's the emotional register? What tone should the creative team aim for? What's distinctive about this vs. generic data work? Pull language from the source text where it signals positioning — but write in the first person as if briefing the creative team. This field is the most important for downstream Stage 1 derivation.",
  },
];

/** The 4 required field keys from JOB_REQUIREMENTS_FIELDS — used by application-level validation. */
export const REQUIRED_JOB_REQUIREMENTS_KEYS: readonly string[] = [
  'qualifications_required',
  'location_scope',
  'language_requirements',
  'engagement_model',
] as const;
