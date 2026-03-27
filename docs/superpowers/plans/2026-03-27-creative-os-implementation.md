# Creative OS Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend for a schema-driven intake form + 5-stage AI creative pipeline (proxy to VYRA API) + approval workflow + notifications + export, with enterprise-polish frontend as the final pass.

**Architecture:** Next.js 16 App Router with server-side API routes. Neon Postgres for data. Schema-driven dynamic forms stored as JSONB. Pipeline stages proxy to local VYRA Creative API. Kimi K2.5 via OpenRouter for research. Vercel Blob for assets. Clerk for auth.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Neon Postgres (@neondatabase/serverless), Clerk, Vercel Blob, OpenRouter API, Tailwind CSS 4, Lucide React.

**Frontend approach:** Backend-first. All API routes, DB, pipeline, and workflow built first. Frontend is the FINAL task — enterprise polish, stunning UI, effortless UX.

**Spec:** `docs/superpowers/specs/2026-03-27-creative-os-pipeline-design.md`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── schemas/
│   │   │   ├── route.ts                    # GET: list all active schemas
│   │   │   └── [taskType]/
│   │   │       ├── route.ts                # GET: full schema for task type
│   │   │       └── versions/route.ts       # GET: schema version history
│   │   ├── registries/
│   │   │   └── [name]/route.ts             # GET: options for a registry
│   │   ├── intake/
│   │   │   ├── route.ts                    # POST: create, GET: list all
│   │   │   └── [id]/
│   │   │       └── route.ts               # GET: detail, PATCH: update, DELETE
│   │   ├── extract/
│   │   │   ├── rfp/route.ts               # POST: upload RFP → extract via Kimi K2.5
│   │   │   ├── paste/route.ts             # POST: paste text → extract via Kimi K2.5
│   │   │   └── upload/route.ts            # POST: upload file to Vercel Blob
│   │   ├── generate/
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts               # POST: trigger full pipeline, GET: status
│   │   │   │   ├── brief/route.ts         # POST: Stage 1a brief generation
│   │   │   │   ├── research/route.ts      # POST: Stage 1b channel research
│   │   │   │   ├── actors/route.ts        # POST: Stage 2a actor cards
│   │   │   │   ├── images/route.ts        # POST: Stage 2b+2c image gen + QA
│   │   │   │   ├── copy/route.ts          # POST: Stage 3 copy gen
│   │   │   │   └── compose/route.ts       # POST: Stage 4 layout composition
│   │   ├── approve/
│   │   │   └── [id]/
│   │   │       ├── route.ts               # POST: approve request
│   │   │       └── changes/route.ts       # POST: request changes
│   │   ├── designer/
│   │   │   └── [id]/
│   │   │       ├── route.ts               # GET: validate magic link + get assets
│   │   │       └── upload/route.ts        # POST: upload refined creative
│   │   ├── notify/
│   │   │   └── [id]/
│   │   │       ├── slack/route.ts         # POST: send Slack notification
│   │   │       └── outlook/route.ts       # POST: send Outlook notification
│   │   └── export/
│   │       └── [id]/route.ts              # GET: generate + download ZIP
│   ├── intake/
│   │   ├── new/page.tsx                    # Dual-mode intake form (manual + RFP)
│   │   └── [id]/page.tsx                   # Detail + approval view
│   ├── designer/
│   │   └── [id]/page.tsx                   # Designer magic link view
│   ├── admin/
│   │   └── schemas/page.tsx                # Schema admin UI (Steven only)
│   ├── page.tsx                            # Dashboard
│   ├── layout.tsx                          # Root layout
│   └── globals.css                         # OneForma brand tokens
├── components/                              # (rebuilt in final frontend pass)
├── lib/
│   ├── db.ts                               # Neon database client
│   ├── db/
│   │   ├── schema.ts                       # SQL table creation + seed queries
│   │   ├── intake.ts                       # Intake CRUD operations
│   │   ├── schemas.ts                      # Task type schema operations
│   │   ├── registries.ts                   # Option registry operations
│   │   ├── briefs.ts                       # Creative brief operations
│   │   ├── actors.ts                       # Actor profile operations
│   │   ├── assets.ts                       # Generated asset operations
│   │   ├── approvals.ts                    # Approval workflow operations
│   │   ├── magic-links.ts                  # Magic link operations
│   │   ├── notifications.ts               # Notification log operations
│   │   └── pipeline-runs.ts               # Pipeline execution log operations
│   ├── types.ts                            # All TypeScript types/interfaces
│   ├── validation.ts                       # Schema-driven form validation
│   ├── openrouter.ts                       # OpenRouter API client (Kimi K2.5)
│   ├── vyra-client.ts                      # VYRA Creative API client
│   ├── blob.ts                             # Vercel Blob upload helpers
│   ├── pipeline/
│   │   ├── orchestrator.ts                 # Pipeline orchestrator (stages sequentially)
│   │   ├── stage1-intelligence.ts          # Brief + research + eval gate
│   │   ├── stage2-images.ts               # Actors + image gen + VL QA gate
│   │   ├── stage3-copy.ts                 # Copy gen + eval gate
│   │   ├── stage4-compose.ts              # Layout composition + eval gate
│   │   └── stage5-surface.ts              # Upload + notify + surface
│   ├── notifications/
│   │   ├── slack.ts                        # Slack webhook sender
│   │   └── outlook.ts                      # Microsoft Graph email sender
│   ├── export.ts                           # ZIP package generator
│   └── seed-schemas.ts                     # Seed data for 7 task type schemas + registries
└── middleware.ts                            # Clerk auth (existing)
```

---

## Task 1: Database Client + Types

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Install dependencies**

Run: `pnpm add @neondatabase/serverless`

Note: Already in package.json but verify it's installed.

- [ ] **Step 2: Create database client**

Create `src/lib/db.ts`:

```typescript
import { neon } from '@neondatabase/serverless';

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}
```

- [ ] **Step 3: Create TypeScript types**

Create `src/lib/types.ts` with ALL types from the spec:

```typescript
// ============================================================
// FIELD DEFINITION TYPES (Schema-driven forms)
// ============================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'button_group'
  | 'checkbox_group'
  | 'toggle'
  | 'toggle_with_text'
  | 'tags'
  | 'file'
  | 'range'
  | 'date'
  | 'divider'
  | 'heading';

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ShowWhenCondition {
  field: string;
  equals?: unknown;
  contains?: string;
  not_equals?: unknown;
  greater_than?: number;
  is_truthy?: boolean;
}

export interface FieldValidation {
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom_message?: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  default_value?: unknown;
  options?: FieldOption[];
  options_source?: string;
  show_when?: ShowWhenCondition;
  validation?: FieldValidation;
  width?: 'full' | 'half';
  group?: string;
  toggle_label?: string;
  text_placeholder?: string;
}

export interface TaskTypeSchema {
  id: string;
  task_type: string;
  display_name: string;
  icon: string;
  description: string;
  schema: {
    base_fields: FieldDefinition[];
    task_fields: FieldDefinition[];
    conditional_fields: FieldDefinition[];
    common_fields: FieldDefinition[];
  };
  version: number;
  is_active: boolean;
  sort_order: number;
}

export interface OptionRegistryItem {
  id: string;
  registry_name: string;
  option_value: string;
  option_label: string;
  metadata?: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

// ============================================================
// INTAKE REQUEST TYPES
// ============================================================

export type Status = 'draft' | 'generating' | 'review' | 'approved' | 'sent' | 'rejected';
export type Urgency = 'urgent' | 'standard' | 'pipeline';

export interface IntakeRequest {
  id: string;
  title: string;
  task_type: string;
  urgency: Urgency;
  target_languages: string[];
  target_regions: string[];
  volume_needed: number | null;
  status: Status;
  created_by: string;
  form_data: Record<string, unknown>;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ATTACHMENT TYPES
// ============================================================

export interface Attachment {
  id: string;
  request_id: string;
  file_name: string;
  file_type: string;
  blob_url: string;
  extracted_text: string | null;
  extraction_data: Record<string, unknown> | null;
  is_rfp: boolean;
  created_at: string;
}

// ============================================================
// CREATIVE BRIEF TYPES
// ============================================================

export interface CreativeBrief {
  id: string;
  request_id: string;
  brief_data: Record<string, unknown>;
  channel_research: Record<string, unknown> | null;
  design_direction: Record<string, unknown> | null;
  content_languages: string[];
  evaluation_score: number | null;
  evaluation_data: Record<string, unknown> | null;
  version: number;
  created_at: string;
}

// ============================================================
// ACTOR PROFILE TYPES
// ============================================================

export interface ActorProfile {
  id: string;
  request_id: string;
  name: string;
  face_lock: Record<string, unknown>;
  prompt_seed: string;
  outfit_variations: Record<string, unknown> | null;
  signature_accessory: string | null;
  backdrops: string[];
  created_at: string;
}

// ============================================================
// GENERATED ASSET TYPES
// ============================================================

export type AssetType = 'base_image' | 'composed_creative' | 'carousel_panel';

export interface GeneratedAsset {
  id: string;
  request_id: string;
  actor_id: string | null;
  asset_type: AssetType;
  platform: string;
  format: string;
  language: string;
  content: Record<string, unknown> | null;
  copy_data: Record<string, unknown> | null;
  blob_url: string | null;
  evaluation_score: number | null;
  evaluation_data: Record<string, unknown> | null;
  evaluation_passed: boolean;
  stage: number;
  version: number;
  created_at: string;
}

// ============================================================
// APPROVAL TYPES
// ============================================================

export type ApprovalStatus = 'approved' | 'changes_requested' | 'rejected';

export interface Approval {
  id: string;
  request_id: string;
  approved_by: string;
  status: ApprovalStatus;
  notes: string | null;
  created_at: string;
}

// ============================================================
// MAGIC LINK TYPES
// ============================================================

export interface MagicLink {
  id: string;
  request_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================

export type NotificationChannel = 'slack' | 'outlook';
export type NotificationStatus = 'sent' | 'delivered' | 'failed';

export interface Notification {
  id: string;
  request_id: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// PIPELINE RUN TYPES
// ============================================================

export type PipelineStageStatus = 'running' | 'passed' | 'failed' | 'retrying';

export interface PipelineRun {
  id: string;
  request_id: string;
  stage: number;
  stage_name: string;
  status: PipelineStageStatus;
  attempt: number;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  evaluation_data: Record<string, unknown> | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================================
// RFP EXTRACTION TYPES
// ============================================================

export interface ExtractionResult {
  detected_task_type: string;
  base_fields: Record<string, unknown>;
  task_fields: Record<string, unknown>;
  confidence_flags: {
    fields_confidently_extracted: string[];
    fields_inferred: string[];
    fields_missing: string[];
    notes: string;
  };
  extracted_details?: {
    client_name?: string;
    project_deadline?: string;
    quality_requirements?: string;
    training_required?: string;
    equipment_needed?: string;
    data_sensitivity?: string;
  };
}

// ============================================================
// VYRA API TYPES
// ============================================================

export interface VyraGenerateRequest {
  platform: string;
  campaign_name: string;
  product: string;
  target_audience: string;
  goals: string;
  cta_text?: string;
  hero_image_url?: string;
  headline?: string;
  num_variants?: number;
  client_dna?: Record<string, unknown>;
}

export interface VyraGenerateResponse {
  success: boolean;
  variants: Array<{
    image_url: string;
    html: string;
    headline: string;
    cta_text: string;
    template: string;
    platform: string;
    evaluation_score: number;
    evaluation_passed: boolean;
  }>;
  seedream_image_url: string;
  errors: string[];
}

export interface VyraCarouselRequest {
  platform: string;
  panels: Array<{
    panel_type: string;
    headline: string;
    subheadline?: string;
    cta_text?: string;
    proof_badge?: string;
  }>;
  seedream_image_url: string;
}

// ============================================================
// FORM VALIDATION TYPES
// ============================================================

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat: add database client and TypeScript types for all entities"
```

---

## Task 2: Database Schema + Seed Data

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/seed-schemas.ts`

- [ ] **Step 1: Create schema migration file**

Create `src/lib/db/schema.ts` with the complete SQL from the spec (all 12 tables + indexes). This file exports functions to create tables and seed initial data.

```typescript
import { getDb } from '../db';

export async function createTables() {
  const sql = getDb();

  // Run all CREATE TABLE statements from the spec
  // task_type_schemas, schema_versions, option_registries,
  // intake_requests, attachments, creative_briefs, actor_profiles,
  // generated_assets, approvals, designer_uploads, magic_links,
  // notifications, pipeline_runs

  await sql`
    CREATE TABLE IF NOT EXISTS task_type_schemas (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_type       TEXT UNIQUE NOT NULL,
      display_name    TEXT NOT NULL,
      icon            TEXT DEFAULT 'file-text',
      description     TEXT,
      schema          JSONB NOT NULL,
      version         INT DEFAULT 1,
      is_active       BOOLEAN DEFAULT TRUE,
      sort_order      INT DEFAULT 0,
      created_by      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS schema_versions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      schema_id       UUID REFERENCES task_type_schemas(id) ON DELETE CASCADE,
      version         INT NOT NULL,
      schema          JSONB NOT NULL,
      change_summary  TEXT,
      created_by      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(schema_id, version)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS option_registries (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registry_name   TEXT NOT NULL,
      option_value    TEXT NOT NULL,
      option_label    TEXT NOT NULL,
      metadata        JSONB DEFAULT '{}',
      sort_order      INT DEFAULT 0,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(registry_name, option_value)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_option_registries_name
    ON option_registries(registry_name) WHERE is_active = TRUE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS intake_requests (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title           TEXT NOT NULL,
      task_type       TEXT NOT NULL,
      urgency         TEXT CHECK (urgency IN ('urgent', 'standard', 'pipeline')),
      target_languages TEXT[],
      target_regions  TEXT[],
      volume_needed   INT,
      status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'review', 'approved', 'sent', 'rejected')),
      created_by      TEXT NOT NULL,
      form_data       JSONB DEFAULT '{}',
      schema_version  INT DEFAULT 1,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_intake_status ON intake_requests(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_intake_task_type ON intake_requests(task_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_intake_created_at ON intake_requests(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_intake_languages ON intake_requests USING GIN(target_languages)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_intake_form_data ON intake_requests USING GIN(form_data jsonb_path_ops)`;

  await sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      file_name       TEXT NOT NULL,
      file_type       TEXT NOT NULL,
      blob_url        TEXT NOT NULL,
      extracted_text  TEXT,
      extraction_data JSONB,
      is_rfp          BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS creative_briefs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      brief_data      JSONB NOT NULL,
      channel_research JSONB,
      design_direction JSONB,
      content_languages TEXT[],
      evaluation_score FLOAT,
      evaluation_data  JSONB,
      version         INT DEFAULT 1,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS actor_profiles (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      face_lock       JSONB NOT NULL,
      prompt_seed     TEXT NOT NULL,
      outfit_variations JSONB,
      signature_accessory TEXT,
      backdrops       TEXT[],
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS generated_assets (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      actor_id        UUID REFERENCES actor_profiles(id),
      asset_type      TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel')),
      platform        TEXT NOT NULL,
      format          TEXT NOT NULL,
      language        TEXT DEFAULT 'en',
      content         JSONB,
      copy_data       JSONB,
      blob_url        TEXT,
      evaluation_score FLOAT,
      evaluation_data  JSONB,
      evaluation_passed BOOLEAN DEFAULT FALSE,
      stage           INT NOT NULL,
      version         INT DEFAULT 1,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS approvals (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      approved_by     TEXT NOT NULL,
      status          TEXT CHECK (status IN ('approved', 'changes_requested', 'rejected')),
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS designer_uploads (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      original_asset_id UUID REFERENCES generated_assets(id),
      file_name       TEXT NOT NULL,
      blob_url        TEXT NOT NULL,
      uploaded_by     TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS magic_links (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      token           TEXT UNIQUE NOT NULL,
      expires_at      TIMESTAMPTZ NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      channel         TEXT CHECK (channel IN ('slack', 'outlook')),
      recipient       TEXT,
      status          TEXT CHECK (status IN ('sent', 'delivered', 'failed')),
      payload         JSONB,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      stage           INT NOT NULL,
      stage_name      TEXT NOT NULL,
      status          TEXT CHECK (status IN ('running', 'passed', 'failed', 'retrying')),
      attempt         INT DEFAULT 1,
      input_data      JSONB,
      output_data     JSONB,
      evaluation_data JSONB,
      duration_ms     INT,
      error_message   TEXT,
      started_at      TIMESTAMPTZ DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    )
  `;
}
```

- [ ] **Step 2: Create seed data file with 7 task type schemas + registries**

Create `src/lib/seed-schemas.ts` — this is a large file containing the full JSON schemas for all 7 task types (audio_annotation, image_annotation, text_labeling, data_collection, guided_feedback, transcription, other) plus the 4 option registries (languages, regions, skills, equipment).

The schemas follow the `FieldDefinition` interface from `types.ts`. Each task type has `base_fields`, `task_fields`, `conditional_fields`, and `common_fields`.

Export a `seedDatabase()` function that INSERTs all schemas and registry options.

```typescript
import { getDb } from './db';

export async function seedDatabase() {
  const sql = getDb();

  // Seed task type schemas
  const schemas = [
    {
      task_type: 'audio_annotation',
      display_name: 'Audio Annotation',
      icon: 'headphones',
      description: 'Voice/audio segmentation, transcription, and labeling tasks',
      sort_order: 1,
      schema: {
        base_fields: [
          { key: 'title', label: 'Project Name', type: 'text', required: true, placeholder: 'e.g., Cosmos — Voice Interaction Segmentation' },
          { key: 'urgency', label: 'Urgency', type: 'button_group', required: true, options: [
            { value: 'urgent', label: 'Urgent', description: 'Need contributors THIS WEEK' },
            { value: 'standard', label: 'Standard', description: 'Within 2 weeks' },
            { value: 'pipeline', label: 'Pipeline', description: 'Building contributor pool' },
          ]},
          { key: 'target_languages', label: 'Target Languages', type: 'multi_select', required: true, options_source: 'languages_registry' },
          { key: 'target_regions', label: 'Target Regions', type: 'multi_select', required: true, options_source: 'regions_registry' },
          { key: 'volume_needed', label: 'Contributors Needed', type: 'number', required: true, placeholder: '200' },
          { key: 'compensation_model', label: 'Compensation', type: 'select', required: true, options: [
            { value: 'fixed_hourly', label: 'Fixed Rate Per Hour' },
            { value: 'per_task', label: 'Per Task' },
            { value: 'per_unit', label: 'Per Unit (e.g., per audio minute)' },
          ]},
        ],
        task_fields: [
          { key: 'audio_type', label: 'Audio Type', type: 'select', required: true, options: [
            { value: 'voice_assistant', label: 'Voice Assistant Conversations' },
            { value: 'call_center', label: 'Call Center Recordings' },
            { value: 'podcast', label: 'Podcast / Long-form' },
            { value: 'short_clips', label: 'Short Audio Clips' },
          ]},
          { key: 'annotation_tasks', label: 'What contributors will do', type: 'checkbox_group', required: true, options: [
            { value: 'segmentation', label: 'Segment audio into exchanges' },
            { value: 'speaker_labeling', label: 'Label speaker turns' },
            { value: 'transcription', label: 'Transcribe speech' },
            { value: 'intent_labeling', label: 'Label user intent' },
            { value: 'quality_rating', label: 'Rate audio quality' },
            { value: 'emotion_tagging', label: 'Tag emotional tone' },
          ]},
          { key: 'avg_audio_length', label: 'Average Audio Length', type: 'select', options: [
            { value: 'under_1min', label: 'Under 1 minute' },
            { value: '1_5min', label: '1-5 minutes' },
            { value: '5_30min', label: '5-30 minutes' },
            { value: 'over_30min', label: 'Over 30 minutes' },
          ]},
          { key: 'equipment_required', label: 'Equipment Required', type: 'checkbox_group', options_source: 'equipment_registry' },
        ],
        conditional_fields: [
          { key: 'transcription_accuracy', label: 'Required Transcription Accuracy', type: 'select',
            show_when: { field: 'annotation_tasks', contains: 'transcription' },
            options: [
              { value: '95', label: '95%+ (standard)' },
              { value: '98', label: '98%+ (high accuracy)' },
              { value: '99', label: '99%+ (medical/legal grade)' },
            ]
          },
        ],
        common_fields: [
          { key: 'commitment_level', label: 'Time Commitment', type: 'button_group', options: [
            { value: 'flexible', label: 'Flexible', description: 'No minimum hours' },
            { value: 'part_time', label: 'Part-time', description: '4-5 hours/day' },
            { value: 'full_time', label: 'Full-time', description: '8 hours/day' },
          ]},
          { key: 'training_required', label: 'Training / Calibration', type: 'toggle_with_text',
            toggle_label: 'Contributors need training before starting', text_placeholder: 'Describe training requirements...' },
          { key: 'nda_required', label: 'NDA Required', type: 'toggle', default_value: false },
          { key: 'special_notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Cultural considerations, quality thresholds, deadline info...' },
        ],
      },
    },
    // ... (remaining 6 schemas follow the same pattern — image_annotation, text_labeling,
    //      data_collection, guided_feedback, transcription, other)
    //      Each has unique task_fields relevant to that task type.
    //      Full schemas will be written during implementation.
  ];

  for (const s of schemas) {
    await sql`
      INSERT INTO task_type_schemas (task_type, display_name, icon, description, sort_order, schema)
      VALUES (${s.task_type}, ${s.display_name}, ${s.icon}, ${s.description}, ${s.sort_order}, ${JSON.stringify(s.schema)})
      ON CONFLICT (task_type) DO NOTHING
    `;
  }

  // Seed language registry (35+ languages)
  const languages = [
    { value: 'ar', label: 'Arabic' }, { value: 'zh-CN', label: 'Chinese (Simplified)' },
    { value: 'zh-TW', label: 'Chinese (Traditional)' }, { value: 'da', label: 'Danish' },
    { value: 'nl', label: 'Dutch' }, { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' }, { value: 'fi', label: 'Finnish' },
    { value: 'fr', label: 'French' }, { value: 'de', label: 'German' },
    { value: 'hi', label: 'Hindi' }, { value: 'it', label: 'Italian' },
    { value: 'ja', label: 'Japanese' }, { value: 'ko', label: 'Korean' },
    { value: 'ms', label: 'Malay' }, { value: 'no', label: 'Norwegian' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' }, { value: 'pt-PT', label: 'Portuguese (Portugal)' },
    { value: 'ru', label: 'Russian' }, { value: 'es', label: 'Spanish' },
    { value: 'sv', label: 'Swedish' }, { value: 'th', label: 'Thai' },
    { value: 'tr', label: 'Turkish' }, { value: 'uk', label: 'Ukrainian' },
    { value: 'vi', label: 'Vietnamese' }, { value: 'pl', label: 'Polish' },
    { value: 'ro', label: 'Romanian' }, { value: 'cs', label: 'Czech' },
    { value: 'el', label: 'Greek' }, { value: 'he', label: 'Hebrew' },
    { value: 'id', label: 'Indonesian' }, { value: 'tl', label: 'Tagalog' },
    { value: 'bn', label: 'Bengali' }, { value: 'ta', label: 'Tamil' },
    { value: 'yue', label: 'Cantonese' },
  ];

  for (let i = 0; i < languages.length; i++) {
    const lang = languages[i];
    await sql`
      INSERT INTO option_registries (registry_name, option_value, option_label, sort_order)
      VALUES ('languages_registry', ${lang.value}, ${lang.label}, ${i})
      ON CONFLICT (registry_name, option_value) DO NOTHING
    `;
  }

  // Seed regions registry (50+ regions — abbreviated here, full list in implementation)
  const regions = [
    { value: 'MA', label: 'Morocco' }, { value: 'EG', label: 'Egypt' },
    { value: 'BR', label: 'Brazil' }, { value: 'IN', label: 'India' },
    { value: 'PH', label: 'Philippines' }, { value: 'DE', label: 'Germany' },
    { value: 'JP', label: 'Japan' }, { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' }, { value: 'FR', label: 'France' },
    { value: 'RU', label: 'Russia' }, { value: 'CN', label: 'China' },
    { value: 'KR', label: 'South Korea' }, { value: 'MX', label: 'Mexico' },
    { value: 'ID', label: 'Indonesia' }, { value: 'TR', label: 'Turkey' },
    { value: 'PK', label: 'Pakistan' }, { value: 'NG', label: 'Nigeria' },
    { value: 'BD', label: 'Bangladesh' }, { value: 'VN', label: 'Vietnam' },
    // ... full list during implementation
  ];

  for (let i = 0; i < regions.length; i++) {
    const reg = regions[i];
    await sql`
      INSERT INTO option_registries (registry_name, option_value, option_label, sort_order)
      VALUES ('regions_registry', ${reg.value}, ${reg.label}, ${i})
      ON CONFLICT (registry_name, option_value) DO NOTHING
    `;
  }

  // Seed equipment registry
  const equipment = [
    { value: 'headphones', label: 'Headphones' },
    { value: 'microphone', label: 'Microphone' },
    { value: 'quiet_environment', label: 'Quiet environment' },
    { value: 'webcam', label: 'Webcam' },
    { value: 'smartphone', label: 'Smartphone' },
    { value: 'specific_os', label: 'Specific OS (specify in notes)' },
    { value: 'desktop_computer', label: 'Desktop computer' },
    { value: 'high_speed_internet', label: 'High-speed internet' },
  ];

  for (let i = 0; i < equipment.length; i++) {
    const eq = equipment[i];
    await sql`
      INSERT INTO option_registries (registry_name, option_value, option_label, sort_order)
      VALUES ('equipment_registry', ${eq.value}, ${eq.label}, ${i})
      ON CONFLICT (registry_name, option_value) DO NOTHING
    `;
  }

  // Seed skills registry
  const skills = [
    { value: 'active_listening', label: 'Active listening' },
    { value: 'attention_to_detail', label: 'Attention to detail' },
    { value: 'language_fluency', label: 'Language fluency' },
    { value: 'typing_speed', label: 'Typing speed' },
    { value: 'transcription', label: 'Transcription' },
    { value: 'domain_expertise', label: 'Domain expertise' },
    { value: 'image_labeling', label: 'Image labeling' },
    { value: 'data_entry', label: 'Data entry' },
    { value: 'quality_assessment', label: 'Quality assessment' },
    { value: 'conversational_analysis', label: 'Conversational analysis' },
  ];

  for (let i = 0; i < skills.length; i++) {
    const sk = skills[i];
    await sql`
      INSERT INTO option_registries (registry_name, option_value, option_label, sort_order)
      VALUES ('skills_registry', ${sk.value}, ${sk.label}, ${i})
      ON CONFLICT (registry_name, option_value) DO NOTHING
    `;
  }
}
```

- [ ] **Step 3: Create DB setup API route (for initial migration)**

Create `src/app/api/setup/route.ts`:

```typescript
import { createTables } from '@/lib/db/schema';
import { seedDatabase } from '@/lib/seed-schemas';
import { auth } from '@clerk/nextjs/server';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await createTables();
    await seedDatabase();
    return Response.json({ success: true, message: 'Database initialized and seeded' });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/seed-schemas.ts src/app/api/setup/route.ts
git commit -m "feat: add database schema creation and seed data for 7 task types + 4 registries"
```

---

## Task 3: DB Operation Modules

**Files:**
- Create: `src/lib/db/intake.ts`
- Create: `src/lib/db/schemas.ts`
- Create: `src/lib/db/registries.ts`
- Create: `src/lib/db/briefs.ts`
- Create: `src/lib/db/actors.ts`
- Create: `src/lib/db/assets.ts`
- Create: `src/lib/db/approvals.ts`
- Create: `src/lib/db/magic-links.ts`
- Create: `src/lib/db/notifications.ts`
- Create: `src/lib/db/pipeline-runs.ts`

Each module exports CRUD functions for its table. All use the Neon tagged template literal syntax.

- [ ] **Step 1: Create schemas DB operations**

Create `src/lib/db/schemas.ts`:

```typescript
import { getDb } from '../db';
import type { TaskTypeSchema } from '../types';

export async function listActiveSchemas(): Promise<TaskTypeSchema[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM task_type_schemas
    WHERE is_active = TRUE
    ORDER BY sort_order ASC
  `;
  return rows as TaskTypeSchema[];
}

export async function getSchemaByTaskType(taskType: string): Promise<TaskTypeSchema | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM task_type_schemas
    WHERE task_type = ${taskType} AND is_active = TRUE
    LIMIT 1
  `;
  return (rows[0] as TaskTypeSchema) ?? null;
}

export async function createSchema(data: {
  task_type: string;
  display_name: string;
  icon?: string;
  description?: string;
  schema: Record<string, unknown>;
  created_by?: string;
}): Promise<TaskTypeSchema> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO task_type_schemas (task_type, display_name, icon, description, schema, created_by)
    VALUES (${data.task_type}, ${data.display_name}, ${data.icon ?? 'file-text'}, ${data.description ?? ''}, ${JSON.stringify(data.schema)}, ${data.created_by ?? null})
    RETURNING *
  `;
  return rows[0] as TaskTypeSchema;
}

export async function updateSchema(taskType: string, data: {
  schema: Record<string, unknown>;
  change_summary?: string;
  created_by?: string;
}): Promise<TaskTypeSchema> {
  const sql = getDb();

  // Get current version
  const current = await getSchemaByTaskType(taskType);
  if (!current) throw new Error(`Schema not found: ${taskType}`);

  const newVersion = current.version + 1;

  // Save version history
  await sql`
    INSERT INTO schema_versions (schema_id, version, schema, change_summary, created_by)
    VALUES (${current.id}, ${current.version}, ${JSON.stringify(current.schema)}, ${data.change_summary ?? null}, ${data.created_by ?? null})
  `;

  // Update schema
  const rows = await sql`
    UPDATE task_type_schemas
    SET schema = ${JSON.stringify(data.schema)}, version = ${newVersion}, updated_at = NOW()
    WHERE task_type = ${taskType}
    RETURNING *
  `;
  return rows[0] as TaskTypeSchema;
}
```

- [ ] **Step 2: Create registries DB operations**

Create `src/lib/db/registries.ts`:

```typescript
import { getDb } from '../db';
import type { OptionRegistryItem } from '../types';

export async function getRegistryOptions(registryName: string): Promise<OptionRegistryItem[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM option_registries
    WHERE registry_name = ${registryName} AND is_active = TRUE
    ORDER BY sort_order ASC
  `;
  return rows as OptionRegistryItem[];
}

export async function addRegistryOption(data: {
  registry_name: string;
  option_value: string;
  option_label: string;
  metadata?: Record<string, unknown>;
  sort_order?: number;
}): Promise<OptionRegistryItem> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO option_registries (registry_name, option_value, option_label, metadata, sort_order)
    VALUES (${data.registry_name}, ${data.option_value}, ${data.option_label}, ${JSON.stringify(data.metadata ?? {})}, ${data.sort_order ?? 0})
    RETURNING *
  `;
  return rows[0] as OptionRegistryItem;
}
```

- [ ] **Step 3: Create intake DB operations**

Create `src/lib/db/intake.ts`:

```typescript
import { getDb } from '../db';
import type { IntakeRequest } from '../types';

export async function createIntakeRequest(data: {
  title: string;
  task_type: string;
  urgency: string;
  target_languages: string[];
  target_regions: string[];
  volume_needed: number | null;
  form_data: Record<string, unknown>;
  schema_version: number;
  created_by: string;
}): Promise<IntakeRequest> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO intake_requests (title, task_type, urgency, target_languages, target_regions, volume_needed, form_data, schema_version, created_by)
    VALUES (${data.title}, ${data.task_type}, ${data.urgency}, ${data.target_languages}, ${data.target_regions}, ${data.volume_needed}, ${JSON.stringify(data.form_data)}, ${data.schema_version}, ${data.created_by})
    RETURNING *
  `;
  return rows[0] as IntakeRequest;
}

export async function listIntakeRequests(filters?: {
  status?: string;
  task_type?: string;
}): Promise<IntakeRequest[]> {
  const sql = getDb();

  if (filters?.status && filters?.task_type) {
    return await sql`
      SELECT * FROM intake_requests
      WHERE status = ${filters.status} AND task_type = ${filters.task_type}
      ORDER BY created_at DESC
    ` as IntakeRequest[];
  }
  if (filters?.status) {
    return await sql`
      SELECT * FROM intake_requests WHERE status = ${filters.status} ORDER BY created_at DESC
    ` as IntakeRequest[];
  }
  if (filters?.task_type) {
    return await sql`
      SELECT * FROM intake_requests WHERE task_type = ${filters.task_type} ORDER BY created_at DESC
    ` as IntakeRequest[];
  }
  return await sql`SELECT * FROM intake_requests ORDER BY created_at DESC` as IntakeRequest[];
}

export async function getIntakeRequest(id: string): Promise<IntakeRequest | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM intake_requests WHERE id = ${id} LIMIT 1`;
  return (rows[0] as IntakeRequest) ?? null;
}

export async function updateIntakeRequest(id: string, data: Partial<{
  title: string;
  status: string;
  form_data: Record<string, unknown>;
}>): Promise<IntakeRequest> {
  const sql = getDb();
  const sets: string[] = [];

  // Build dynamic update — for now, handle the common cases
  if (data.status) {
    const rows = await sql`
      UPDATE intake_requests SET status = ${data.status}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return rows[0] as IntakeRequest;
  }

  if (data.form_data) {
    const rows = await sql`
      UPDATE intake_requests SET form_data = ${JSON.stringify(data.form_data)}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return rows[0] as IntakeRequest;
  }

  const rows = await sql`
    UPDATE intake_requests SET updated_at = NOW() WHERE id = ${id} RETURNING *
  `;
  return rows[0] as IntakeRequest;
}

export async function deleteIntakeRequest(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM intake_requests WHERE id = ${id}`;
}
```

- [ ] **Step 4: Create remaining DB operation modules**

Create `src/lib/db/briefs.ts`, `src/lib/db/actors.ts`, `src/lib/db/assets.ts`, `src/lib/db/approvals.ts`, `src/lib/db/magic-links.ts`, `src/lib/db/notifications.ts`, `src/lib/db/pipeline-runs.ts`.

Each follows the same pattern: import `getDb`, export CRUD functions with typed returns. All use the Neon tagged template syntax.

Key functions per module:
- **briefs.ts**: `createBrief()`, `getBriefByRequestId()`, `updateBrief()`
- **actors.ts**: `createActor()`, `getActorsByRequestId()`
- **assets.ts**: `createAsset()`, `getAssetsByRequestId()`, `updateAssetEvaluation()`
- **approvals.ts**: `createApproval()`, `getApprovalsByRequestId()`
- **magic-links.ts**: `createMagicLink()`, `validateMagicLink()`, `deleteMagicLink()`
- **notifications.ts**: `createNotification()`, `getNotificationsByRequestId()`
- **pipeline-runs.ts**: `createPipelineRun()`, `updatePipelineRun()`, `getRunsByRequestId()`

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/
git commit -m "feat: add all DB operation modules (schemas, registries, intake, briefs, actors, assets, approvals, magic-links, notifications, pipeline-runs)"
```

---

## Task 4: Schema + Registry API Routes

**Files:**
- Create: `src/app/api/schemas/route.ts`
- Create: `src/app/api/schemas/[taskType]/route.ts`
- Create: `src/app/api/registries/[name]/route.ts`

- [ ] **Step 1: Create schemas list endpoint**

Create `src/app/api/schemas/route.ts`:

```typescript
import { listActiveSchemas } from '@/lib/db/schemas';

export async function GET() {
  const schemas = await listActiveSchemas();
  return Response.json(schemas);
}
```

- [ ] **Step 2: Create single schema endpoint**

Create `src/app/api/schemas/[taskType]/route.ts`:

```typescript
import { getSchemaByTaskType } from '@/lib/db/schemas';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskType: string }> }
) {
  const { taskType } = await params;
  const schema = await getSchemaByTaskType(taskType);

  if (!schema) {
    return Response.json({ error: 'Schema not found' }, { status: 404 });
  }

  return Response.json(schema);
}
```

- [ ] **Step 3: Create registry options endpoint**

Create `src/app/api/registries/[name]/route.ts`:

```typescript
import { getRegistryOptions } from '@/lib/db/registries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const options = await getRegistryOptions(name);
  return Response.json(options);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/schemas/ src/app/api/registries/
git commit -m "feat: add schema and registry API endpoints"
```

---

## Task 5: Intake CRUD API Routes

**Files:**
- Create: `src/app/api/intake/route.ts`
- Create: `src/app/api/intake/[id]/route.ts`

- [ ] **Step 1: Create intake list + create endpoint**

Create `src/app/api/intake/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server';
import { createIntakeRequest, listIntakeRequests } from '@/lib/db/intake';
import { getSchemaByTaskType } from '@/lib/db/schemas';
import { validateFormData } from '@/lib/validation';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const taskType = url.searchParams.get('task_type') ?? undefined;

  const requests = await listIntakeRequests({ status, task_type: taskType });
  return Response.json(requests);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Validate against schema
  const schema = await getSchemaByTaskType(body.task_type);
  if (!schema) {
    return Response.json({ error: `Unknown task type: ${body.task_type}` }, { status: 400 });
  }

  const validation = validateFormData(schema, body.form_data ?? {});
  if (!validation.valid) {
    return Response.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 });
  }

  const intake = await createIntakeRequest({
    title: body.title,
    task_type: body.task_type,
    urgency: body.urgency,
    target_languages: body.target_languages ?? [],
    target_regions: body.target_regions ?? [],
    volume_needed: body.volume_needed ?? null,
    form_data: body.form_data ?? {},
    schema_version: schema.version,
    created_by: userId,
  });

  return Response.json(intake, { status: 201 });
}
```

- [ ] **Step 2: Create intake detail endpoint**

Create `src/app/api/intake/[id]/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest, updateIntakeRequest, deleteIntakeRequest } from '@/lib/db/intake';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const intake = await getIntakeRequest(id);
  if (!intake) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(intake);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const updated = await updateIntakeRequest(id, body);
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteIntakeRequest(id);
  return Response.json({ success: true });
}
```

- [ ] **Step 3: Create form validation engine**

Create `src/lib/validation.ts`:

```typescript
import type { TaskTypeSchema, FieldDefinition, FieldError, ValidationResult, ShowWhenCondition } from './types';

export function evaluateCondition(condition: ShowWhenCondition, formData: Record<string, unknown>): boolean {
  const value = formData[condition.field];

  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.not_equals !== undefined) return value !== condition.not_equals;
  if (condition.contains !== undefined && Array.isArray(value)) return value.includes(condition.contains);
  if (condition.greater_than !== undefined && typeof value === 'number') return value > condition.greater_than;
  if (condition.is_truthy !== undefined) return Boolean(value) === condition.is_truthy;

  return false;
}

function validateField(field: FieldDefinition, value: unknown): string | null {
  if (field.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
    return `${field.label} is required`;
  }

  if (value === undefined || value === null || value === '') return null;

  if (field.validation) {
    const v = field.validation;
    if (v.min_length && typeof value === 'string' && value.length < v.min_length) {
      return v.custom_message ?? `${field.label} must be at least ${v.min_length} characters`;
    }
    if (v.max_length && typeof value === 'string' && value.length > v.max_length) {
      return v.custom_message ?? `${field.label} must be at most ${v.max_length} characters`;
    }
    if (v.min !== undefined && typeof value === 'number' && value < v.min) {
      return v.custom_message ?? `${field.label} must be at least ${v.min}`;
    }
    if (v.max !== undefined && typeof value === 'number' && value > v.max) {
      return v.custom_message ?? `${field.label} must be at most ${v.max}`;
    }
    if (v.pattern && typeof value === 'string' && !new RegExp(v.pattern).test(value)) {
      return v.custom_message ?? `${field.label} has invalid format`;
    }
  }

  return null;
}

export function validateFormData(schema: TaskTypeSchema, formData: Record<string, unknown>): ValidationResult {
  const errors: FieldError[] = [];
  const allFields = [
    ...schema.schema.base_fields,
    ...schema.schema.task_fields,
    ...schema.schema.common_fields,
  ];

  for (const field of allFields) {
    const error = validateField(field, formData[field.key]);
    if (error) errors.push({ field: field.key, message: error });
  }

  // Conditional fields: only validate if condition is met
  for (const field of schema.schema.conditional_fields) {
    if (field.show_when && evaluateCondition(field.show_when, formData)) {
      const error = validateField(field, formData[field.key]);
      if (error) errors.push({ field: field.key, message: error });
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/intake/ src/lib/validation.ts
git commit -m "feat: add intake CRUD API routes with schema-driven validation"
```

---

## Task 6: OpenRouter Client + RFP Extraction API

**Files:**
- Create: `src/lib/openrouter.ts`
- Create: `src/app/api/extract/rfp/route.ts`
- Create: `src/app/api/extract/paste/route.ts`
- Create: `src/app/api/extract/upload/route.ts`
- Create: `src/lib/blob.ts`

- [ ] **Step 1: Install Vercel Blob**

Run: `pnpm add @vercel/blob`

- [ ] **Step 2: Create OpenRouter client**

Create `src/lib/openrouter.ts`:

```typescript
export async function callKimiK25(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? '';
}
```

- [ ] **Step 3: Create Blob upload helper**

Create `src/lib/blob.ts`:

```typescript
import { put } from '@vercel/blob';

export async function uploadToBlob(file: File, folder: string): Promise<string> {
  const blob = await put(`${folder}/${file.name}`, file, {
    access: 'public',
  });
  return blob.url;
}

export async function uploadBufferToBlob(buffer: Buffer, filename: string, folder: string): Promise<string> {
  const blob = await put(`${folder}/${filename}`, buffer, {
    access: 'public',
  });
  return blob.url;
}
```

- [ ] **Step 4: Create RFP extraction route**

Create `src/app/api/extract/rfp/route.ts` — handles file upload, text extraction, and Kimi K2.5 extraction. Returns structured fields matching the detected task type schema.

- [ ] **Step 5: Create paste extraction route**

Create `src/app/api/extract/paste/route.ts` — same extraction logic but takes raw text instead of file.

- [ ] **Step 6: Create upload route**

Create `src/app/api/extract/upload/route.ts` — simple file upload to Vercel Blob, returns URL.

- [ ] **Step 7: Commit**

```bash
git add src/lib/openrouter.ts src/lib/blob.ts src/app/api/extract/
git commit -m "feat: add RFP extraction (Kimi K2.5 via OpenRouter) and file upload endpoints"
```

---

## Task 7: VYRA Client + Pipeline Orchestrator

**Files:**
- Create: `src/lib/vyra-client.ts`
- Create: `src/lib/pipeline/orchestrator.ts`
- Create: `src/lib/pipeline/stage1-intelligence.ts`
- Create: `src/lib/pipeline/stage2-images.ts`
- Create: `src/lib/pipeline/stage3-copy.ts`
- Create: `src/lib/pipeline/stage4-compose.ts`
- Create: `src/lib/pipeline/stage5-surface.ts`

- [ ] **Step 1: Create VYRA API client**

Create `src/lib/vyra-client.ts`:

```typescript
const VYRA_API_URL = process.env.VYRA_API_URL ?? 'http://localhost:8000';

export async function vyraFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${VYRA_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VYRA API error: ${response.status} ${error}`);
  }

  return response.json() as T;
}

export async function vyraHealthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${VYRA_API_URL}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

// Stage-specific VYRA calls
export async function generateBrief(intakeData: Record<string, unknown>) {
  return vyraFetch('/creative/brief', intakeData);
}

export async function generateActors(briefData: Record<string, unknown>) {
  return vyraFetch('/creative/actors', briefData);
}

export async function generateImages(actorData: Record<string, unknown>) {
  return vyraFetch('/creative/generate', actorData);
}

export async function validateImage(imageUrl: string, criteria: Record<string, unknown>) {
  return vyraFetch('/creative/validate-image', { image_url: imageUrl, ...criteria });
}

export async function generateCopy(briefData: Record<string, unknown>) {
  return vyraFetch('/creative/copy', briefData);
}

export async function composeCreatives(compositionData: Record<string, unknown>) {
  return vyraFetch('/creative/compose', compositionData);
}

export async function generateCarousel(carouselData: Record<string, unknown>) {
  return vyraFetch('/creative/carousel', carouselData);
}

export async function evaluateCreative(creativeData: Record<string, unknown>) {
  return vyraFetch('/creative/evaluate', creativeData);
}
```

- [ ] **Step 2: Create pipeline orchestrator**

Create `src/lib/pipeline/orchestrator.ts`:

```typescript
import { updateIntakeRequest } from '@/lib/db/intake';
import { createPipelineRun, updatePipelineRun } from '@/lib/db/pipeline-runs';
import { runStage1 } from './stage1-intelligence';
import { runStage2 } from './stage2-images';
import { runStage3 } from './stage3-copy';
import { runStage4 } from './stage4-compose';
import { runStage5 } from './stage5-surface';

export async function runPipeline(requestId: string) {
  // Update status to generating
  await updateIntakeRequest(requestId, { status: 'generating' });

  const stages = [
    { num: 1, name: 'Strategic Intelligence', fn: runStage1 },
    { num: 2, name: 'Character-Driven Image Generation', fn: runStage2 },
    { num: 3, name: 'Copy Generation', fn: runStage3 },
    { num: 4, name: 'Layout Composition', fn: runStage4 },
    { num: 5, name: 'Surface & Distribute', fn: runStage5 },
  ];

  for (const stage of stages) {
    const run = await createPipelineRun({
      request_id: requestId,
      stage: stage.num,
      stage_name: stage.name,
      status: 'running',
    });

    const startTime = Date.now();

    try {
      const result = await stage.fn(requestId);

      await updatePipelineRun(run.id, {
        status: 'passed',
        output_data: result,
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      await updatePipelineRun(run.id, {
        status: 'failed',
        error_message: String(error),
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      });

      // Don't continue past a failed stage
      return { success: false, failed_stage: stage.num, error: String(error) };
    }
  }

  // Update status to review
  await updateIntakeRequest(requestId, { status: 'review' });
  return { success: true };
}
```

- [ ] **Step 3: Create stage implementation files**

Create all 5 stage files. Each stage:
1. Reads the intake request + any previous stage outputs from the DB
2. Calls the appropriate VYRA API / OpenRouter endpoint
3. Runs the evaluation gate (with retry loop, max 3 attempts)
4. Stores results in the DB
5. Returns the output for the next stage

The stage files import from `vyra-client.ts` and `openrouter.ts` and the relevant DB modules.

- [ ] **Step 4: Commit**

```bash
git add src/lib/vyra-client.ts src/lib/pipeline/
git commit -m "feat: add VYRA API client and 5-stage pipeline orchestrator"
```

---

## Task 8: Pipeline API Routes

**Files:**
- Create: `src/app/api/generate/[id]/route.ts`
- Create: `src/app/api/generate/[id]/brief/route.ts`
- Create: `src/app/api/generate/[id]/research/route.ts`
- Create: `src/app/api/generate/[id]/actors/route.ts`
- Create: `src/app/api/generate/[id]/images/route.ts`
- Create: `src/app/api/generate/[id]/copy/route.ts`
- Create: `src/app/api/generate/[id]/compose/route.ts`

Each route is auth-protected, validates the request exists, and delegates to the appropriate pipeline stage or orchestrator.

- [ ] **Step 1: Create main pipeline trigger route**

Create `src/app/api/generate/[id]/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { getRunsByRequestId } from '@/lib/db/pipeline-runs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const intake = await getIntakeRequest(id);
  if (!intake) return Response.json({ error: 'Not found' }, { status: 404 });

  // Run pipeline asynchronously (don't await — return immediately)
  // In production, this would use Vercel Queues or Workflow DevKit
  // For v1, we run inline and the client polls for status
  runPipeline(id).catch(console.error);

  return Response.json({ message: 'Pipeline started', request_id: id });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const runs = await getRunsByRequestId(id);
  return Response.json(runs);
}
```

- [ ] **Step 2: Create individual stage routes**

Create the 6 stage routes — each calls a single stage function for granular control / retry.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/
git commit -m "feat: add pipeline trigger and status API routes"
```

---

## Task 9: Approval + Magic Link + Notification APIs

**Files:**
- Create: `src/app/api/approve/[id]/route.ts`
- Create: `src/app/api/approve/[id]/changes/route.ts`
- Create: `src/app/api/designer/[id]/route.ts`
- Create: `src/app/api/designer/[id]/upload/route.ts`
- Create: `src/app/api/notify/[id]/slack/route.ts`
- Create: `src/app/api/notify/[id]/outlook/route.ts`
- Create: `src/lib/notifications/slack.ts`
- Create: `src/lib/notifications/outlook.ts`

- [ ] **Step 1: Create approval route**

Approve → creates approval record, generates magic link, triggers notifications.

- [ ] **Step 2: Create changes requested route**

Request changes → creates approval record with status='changes_requested', updates intake status back to 'draft'.

- [ ] **Step 3: Create designer magic link validation route**

GET validates token, returns assets if valid and not expired.

- [ ] **Step 4: Create designer upload route**

POST accepts file upload from designer (no auth — magic link is the auth).

- [ ] **Step 5: Create Slack notification sender**

```typescript
export async function sendSlackNotification(webhookUrl: string, message: {
  title: string;
  urgency: string;
  creativeCount: number;
  approvalUrl: string;
}) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `New Creative Package: ${message.title}` }},
        { type: 'section', text: { type: 'mrkdwn', text: `*Urgency:* ${message.urgency}\n*Creatives:* ${message.creativeCount} variants generated\n<${message.approvalUrl}|View & Download>` }},
      ],
    }),
  });
}
```

- [ ] **Step 6: Create Outlook notification sender (Microsoft Graph)**

- [ ] **Step 7: Commit**

```bash
git add src/app/api/approve/ src/app/api/designer/ src/app/api/notify/ src/lib/notifications/
git commit -m "feat: add approval workflow, magic links, Slack and Outlook notifications"
```

---

## Task 10: Export ZIP API

**Files:**
- Create: `src/lib/export.ts`
- Create: `src/app/api/export/[id]/route.ts`

- [ ] **Step 1: Install archiver**

Run: `pnpm add archiver && pnpm add -D @types/archiver`

- [ ] **Step 2: Create ZIP export utility**

Create `src/lib/export.ts` — fetches all assets for a request, organizes by channel/format, generates ZIP with: PNGs, brief PDF, copy CSV, targeting specs, evaluation report.

- [ ] **Step 3: Create export route**

GET `/api/export/[id]` — streams the ZIP file as a download.

- [ ] **Step 4: Commit**

```bash
git add src/lib/export.ts src/app/api/export/
git commit -m "feat: add ZIP export endpoint for agency packages"
```

---

## Task 11: Frontend — Enterprise Polish (FINAL TASK)

**This is the final task. ALL backend is complete before this starts.**

**Files:**
- Rebuild: `src/app/page.tsx` — Dashboard
- Rebuild: `src/app/intake/new/page.tsx` — Dual-mode intake with DynamicForm
- Rebuild: `src/app/intake/[id]/page.tsx` — Detail + approval view
- Create: `src/app/designer/[id]/page.tsx` — Designer magic link view
- Create: `src/app/admin/schemas/page.tsx` — Schema admin
- Rebuild: `src/components/Header.tsx`
- Create: `src/components/DynamicForm.tsx` — Schema-driven form renderer
- Create: `src/components/DynamicField.tsx` — Individual field renderers
- Create: `src/components/ConfidenceIndicator.tsx` — Extraction confidence badges
- Create: `src/components/PipelineStatus.tsx` — Pipeline stage progress
- Create: `src/components/CreativeGrid.tsx` — Creatives grouped by channel x format
- Create: `src/components/EvaluationScores.tsx` — 7-dimension score display
- Create: `src/components/ChannelStrategy.tsx` — Channel recommendations with sources
- Create: `src/components/ActorCard.tsx` — Actor identity card display
- Rebuild: `src/components/IntakeCard.tsx`
- Rebuild: `src/components/StatusBadge.tsx`

**Design requirements (from CLAUDE.md):**
- LIGHT theme (OneForma brand — white bg, dark text, charcoal #32373C)
- System fonts only (no Google Fonts)
- Pill-shaped buttons (rounded-full)
- Use existing CSS classes: `.btn-primary`, `.btn-secondary`, `.badge-*`, `.card`
- Generous whitespace (gap-6, p-6, space-y-4)
- All interactive elements need `cursor-pointer`
- Lucide React icons only (no emojis)
- Enterprise polish — clean layouts, effortless UX, stunning UI

- [ ] **Step 1: Build DynamicForm + DynamicField components**

The core form renderer that reads any task type schema and renders the correct fields with conditional visibility, validation, and confidence indicators.

- [ ] **Step 2: Rebuild intake/new page with dual-mode entry**

Tab or card toggle between "Fill Manually" and "Upload Client RFP". Task type picker loads schemas. Form renders dynamically based on selected type.

- [ ] **Step 3: Rebuild dashboard with real data**

Kanban pipeline board connected to `/api/intake` with proper filtering, loading states, empty states.

- [ ] **Step 4: Rebuild intake/[id] detail page**

Full creative package display: brief, channel strategy with sources, actor profiles, creatives grid grouped by channel x format, evaluation scores with progress bars, approval actions.

- [ ] **Step 5: Build designer magic link page**

No-auth page that validates magic link token, displays all creatives for download, and supports file upload for refined versions.

- [ ] **Step 6: Build pipeline status component**

Real-time progress indicator showing which stage is running, passed, or failed. Polls `/api/generate/[id]` for status updates.

- [ ] **Step 7: Build schema admin page (Steven only)**

Simple CRUD UI for task type schemas and option registries. Protected to Steven's Clerk user ID.

- [ ] **Step 8: Final polish pass**

- Consistent spacing, borders, shadows across all pages
- Loading skeletons for async data
- Error states with helpful messages
- Empty states with clear CTAs
- Toast notifications (sonner) for actions
- Mobile responsiveness (at minimum tablet-friendly)
- 0 TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: enterprise-polish frontend with dynamic forms, pipeline status, creative grid, and approval workflow"
```

---

## Task 12: Environment Setup + Deploy

- [ ] **Step 1: Create .env.local template**

Create `.env.example`:

```env
# Neon Postgres
DATABASE_URL=postgresql://...

# Clerk Auth
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# VYRA Creative API (local sidecar)
VYRA_API_URL=http://localhost:8000

# OpenRouter (Kimi K2.5 for research + RFP extraction)
OPENROUTER_API_KEY=sk-or-...

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
# OUTLOOK_CLIENT_ID=...
# OUTLOOK_CLIENT_SECRET=...
# OUTLOOK_TENANT_ID=...
```

- [ ] **Step 2: Link Vercel project and pull env vars**

Run:
```bash
vercel link
vercel env pull
```

- [ ] **Step 3: Initialize database**

Run the app locally, hit `POST /api/setup` to create tables and seed data.

- [ ] **Step 4: Deploy to Vercel**

Run: `vercel --prod`

- [ ] **Step 5: Commit env template**

```bash
git add .env.example
git commit -m "docs: add environment variable template"
```
