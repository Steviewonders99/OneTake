import { getDb } from '@/lib/db';

/**
 * Creates all database tables with proper constraints, foreign keys, and indexes.
 * Uses CREATE TABLE IF NOT EXISTS for idempotency.
 * Tables are created in dependency order (parent tables first).
 */
export async function createTables(): Promise<void> {
  const sql = getDb();

  // 1. task_type_schemas — no FK dependencies
  await sql`
    CREATE TABLE IF NOT EXISTS task_type_schemas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_type TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT NOT NULL,
      schema JSONB NOT NULL,
      version INT NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 2. schema_versions — FK to task_type_schemas
  await sql`
    CREATE TABLE IF NOT EXISTS schema_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      schema_id UUID NOT NULL REFERENCES task_type_schemas(id) ON DELETE CASCADE,
      version INT NOT NULL,
      schema JSONB NOT NULL,
      change_summary TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(schema_id, version)
    )
  `;

  // 3. option_registries — no FK dependencies
  await sql`
    CREATE TABLE IF NOT EXISTS option_registries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registry_name TEXT NOT NULL,
      option_value TEXT NOT NULL,
      option_label TEXT NOT NULL,
      metadata JSONB,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(registry_name, option_value)
    )
  `;

  // 4. intake_requests — no FK dependencies
  await sql`
    CREATE TABLE IF NOT EXISTS intake_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      task_type TEXT NOT NULL,
      urgency TEXT NOT NULL CHECK (urgency IN ('urgent', 'standard', 'pipeline')),
      target_languages TEXT[] NOT NULL DEFAULT '{}',
      target_regions TEXT[] NOT NULL DEFAULT '{}',
      volume_needed INT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'review', 'approved', 'sent', 'rejected', 'split')),
      created_by TEXT NOT NULL,
      form_data JSONB NOT NULL DEFAULT '{}',
      schema_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Add campaign_slug column to existing intake_requests (idempotent)
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS campaign_slug TEXT
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_campaign_slug
      ON intake_requests(campaign_slug)
      WHERE campaign_slug IS NOT NULL
  `;

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

  // 5. attachments — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      extracted_text TEXT,
      extraction_data JSONB,
      is_rfp BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 6. creative_briefs — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS creative_briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      brief_data JSONB NOT NULL DEFAULT '{}',
      channel_research JSONB,
      design_direction JSONB,
      content_languages TEXT[] NOT NULL DEFAULT '{}',
      evaluation_score FLOAT,
      evaluation_data JSONB,
      version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

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

  // 7. actor_profiles — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS actor_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      face_lock JSONB NOT NULL DEFAULT '{}',
      prompt_seed TEXT NOT NULL,
      outfit_variations JSONB,
      signature_accessory TEXT,
      backdrops TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 8. generated_assets — FK to intake_requests + actor_profiles
  await sql`
    CREATE TABLE IF NOT EXISTS generated_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      actor_id UUID REFERENCES actor_profiles(id),
      asset_type TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel')),
      platform TEXT NOT NULL,
      format TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      content JSONB,
      copy_data JSONB,
      blob_url TEXT,
      evaluation_score FLOAT,
      evaluation_data JSONB,
      evaluation_passed BOOLEAN NOT NULL DEFAULT FALSE,
      stage INT NOT NULL DEFAULT 1,
      version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 9. approvals — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      approved_by TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('approved', 'changes_requested', 'rejected')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // campaign_landing_pages — FK to intake_requests, unique per campaign
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_landing_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL UNIQUE REFERENCES intake_requests(id) ON DELETE CASCADE,
      job_posting_url TEXT,
      landing_page_url TEXT,
      ada_form_url TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_request
    ON campaign_landing_pages(request_id)
  `;

  // tracked_links — self-hosted short link store for recruiter UTM builder
  await sql`
    CREATE TABLE IF NOT EXISTS tracked_links (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug                TEXT NOT NULL UNIQUE,
      request_id          UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      asset_id            UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
      recruiter_clerk_id  TEXT NOT NULL,
      destination_url     TEXT NOT NULL,
      base_url            TEXT NOT NULL,
      utm_campaign        TEXT NOT NULL,
      utm_source          TEXT NOT NULL,
      utm_medium          TEXT NOT NULL DEFAULT 'social',
      utm_term            TEXT NOT NULL,
      utm_content         TEXT NOT NULL,
      click_count         INT NOT NULL DEFAULT 0,
      last_clicked_at     TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tracked_links_request ON tracked_links(request_id)`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tracked_links_recruiter
      ON tracked_links(recruiter_clerk_id, request_id)
  `;

  // 10. designer_uploads — FK to intake_requests + generated_assets
  await sql`
    CREATE TABLE IF NOT EXISTS designer_uploads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      original_asset_id UUID REFERENCES generated_assets(id),
      file_name TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 11. magic_links — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS magic_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 12. notification_deliveries — outbound delivery log (renamed from notifications)
  await sql`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('slack', 'outlook')),
      recipient TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'failed')),
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 12b. notifications — user-facing event feed
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL,
      request_id  UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('stage_complete', 'designer_update', 'eval_complete', 'status_change', 'asset_approved')),
      title       TEXT NOT NULL,
      body        TEXT,
      read        BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)`;

  // 13. pipeline_runs — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      stage INT NOT NULL,
      stage_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'retrying')),
      attempt INT NOT NULL DEFAULT 1,
      input_data JSONB,
      output_data JSONB,
      evaluation_data JSONB,
      duration_ms INT,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;

  // 14. compute_jobs — FK to intake_requests
  await sql`
    CREATE TABLE IF NOT EXISTS compute_jobs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      job_type        TEXT NOT NULL CHECK (job_type IN ('generate', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from')),
      worker_id       TEXT,
      status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
      stage_target    INT,
      asset_id        UUID,
      feedback        TEXT,
      feedback_data   JSONB,
      error_message   TEXT,
      started_at      TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 15. campaign_strategies — media plan per country
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_strategies (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id       UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      country          TEXT NOT NULL,
      tier             INT DEFAULT 1,
      monthly_budget   NUMERIC,
      budget_mode      TEXT DEFAULT 'ratio' CHECK (budget_mode IN ('fixed', 'ratio')),
      strategy_data    JSONB NOT NULL,
      evaluation_score NUMERIC,
      evaluation_data  JSONB,
      evaluation_passed BOOLEAN,
      version          INT DEFAULT 1,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_strategies_request ON campaign_strategies(request_id)`;

  // 16. user_roles — no FK dependencies
  await sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_id    TEXT UNIQUE NOT NULL,
      email       TEXT NOT NULL,
      name        TEXT,
      role        TEXT NOT NULL CHECK (role IN ('admin', 'recruiter', 'designer', 'viewer')),
      is_active   BOOLEAN DEFAULT TRUE,
      invited_by  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ============================================================
  // INDEXES
  // ============================================================

  await sql`
    CREATE INDEX IF NOT EXISTS idx_option_registries_name
    ON option_registries(registry_name) WHERE is_active = TRUE
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_status
    ON intake_requests(status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_task_type
    ON intake_requests(task_type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_created_at
    ON intake_requests(created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_languages
    ON intake_requests USING GIN (target_languages)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_form_data
    ON intake_requests USING GIN (form_data jsonb_path_ops)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_compute_jobs_pending
    ON compute_jobs (status) WHERE status = 'pending'
  `;
}
