import { getDb } from '@/lib/db';
import { seedDefaultTemplate } from '@/lib/db/dashboards';
import { seedPrebuiltDashboards } from '@/lib/db/seed-dashboards';

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

  // Figma sync state — stores token, file_key, frame hashes, last sync time
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS figma_sync JSONB DEFAULT NULL
  `;

  // Pipeline mode: organic (default) or full (after paid upgrade)
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS pipeline_mode TEXT NOT NULL DEFAULT 'organic',
      ADD COLUMN IF NOT EXISTS paid_requested_by TEXT,
      ADD COLUMN IF NOT EXISTS paid_requested_at TIMESTAMPTZ
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE intake_requests
        ADD CONSTRAINT intake_requests_pipeline_mode_check
        CHECK (pipeline_mode IN ('organic', 'full'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // Edit lock: prevents concurrent edits on the same campaign
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS edit_lock JSONB DEFAULT NULL
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
      country TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 8. generated_assets — FK to intake_requests + actor_profiles
  await sql`
    CREATE TABLE IF NOT EXISTS generated_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      actor_id UUID REFERENCES actor_profiles(id),
      asset_type TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page', 'organic_carousel', 'copy', 'video')),
      platform TEXT NOT NULL,
      format TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      country TEXT,
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

  // Expand asset_type for organic deliverables
  await sql`
    ALTER TABLE generated_assets DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check
  `;
  await sql`
    ALTER TABLE generated_assets ADD CONSTRAINT generated_assets_asset_type_check
      CHECK (asset_type IN (
        'base_image', 'composed_creative', 'carousel_panel', 'landing_page',
        'organic_carousel', 'copy', 'video',
        'wp_job_post', 'job_portal_copy', 'flyer', 'flyer_copy',
        'social_caption', 'social_graphic'
      ))
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
      request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      job_posting_url TEXT,
      landing_page_url TEXT,
      ada_form_url TEXT,
      country TEXT,
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
      country TEXT,
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
  await sql`CREATE INDEX IF NOT EXISTS idx_generated_assets_country ON generated_assets(request_id, country)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_actor_profiles_country ON actor_profiles(request_id, country)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_compute_jobs_country ON compute_jobs(request_id, country)`;

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
      country TEXT,
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
      country TEXT,
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
      country TEXT,
      job_type        TEXT NOT NULL CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from')),
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

  // Add generate_paid job type
  await sql`
    ALTER TABLE compute_jobs DROP CONSTRAINT IF EXISTS compute_jobs_job_type_check
  `;
  await sql`
    ALTER TABLE compute_jobs ADD CONSTRAINT compute_jobs_job_type_check
      CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from', 'generate_paid'))
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

  // Add lead_recruiter role
  await sql`
    ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check
  `;
  await sql`
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
      CHECK (role IN ('admin', 'recruiter', 'lead_recruiter', 'designer', 'viewer'))
  `;

  // 17. dashboards — custom analytics dashboard layouts
  await sql`
    CREATE TABLE IF NOT EXISTS dashboards (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title           TEXT NOT NULL DEFAULT 'Untitled Dashboard',
      description     TEXT,
      layout_data     JSONB NOT NULL DEFAULT '{"widgets":[],"gridLayouts":{"lg":[],"md":[],"sm":[]}}',
      created_by      TEXT NOT NULL,
      is_template     BOOLEAN NOT NULL DEFAULT FALSE,
      is_shared       BOOLEAN NOT NULL DEFAULT FALSE,
      share_token     TEXT UNIQUE,
      password_hash   TEXT,
      expires_at      TIMESTAMPTZ,
      view_count      INT NOT NULL DEFAULT 0,
      last_viewed_at  TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboards_share_token ON dashboards(share_token) WHERE share_token IS NOT NULL`;

  // 18. crm_sync_cache — cached CRM contributor data for AudienceIQ
  await sql`
    CREATE TABLE IF NOT EXISTS crm_sync_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      crm_user_id       TEXT NOT NULL,
      email             TEXT,
      country           TEXT,
      languages         TEXT[] NOT NULL DEFAULT '{}',
      skills            JSONB NOT NULL DEFAULT '{}',
      quality_score     FLOAT,
      activity_status   TEXT NOT NULL DEFAULT 'unknown',
      signup_date       TIMESTAMPTZ,
      utm_source        TEXT,
      utm_medium        TEXT,
      utm_campaign      TEXT,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(crm_user_id)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_crm_sync_email ON crm_sync_cache(email) WHERE email IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crm_sync_utm ON crm_sync_cache(utm_campaign) WHERE utm_campaign IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crm_sync_status ON crm_sync_cache(activity_status)`;

  // 19. visitor_identities — cross-device identity stitching for AudienceIQ
  await sql`
    CREATE TABLE IF NOT EXISTS visitor_identities (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_id        TEXT,
      ga4_client_id     TEXT,
      crm_user_id       TEXT,
      email             TEXT,
      email_hash        TEXT,
      utm_slug          TEXT,
      first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      identified_at     TIMESTAMPTZ,
      UNIQUE(email_hash)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_visitor_identity_visitor ON visitor_identities(visitor_id) WHERE visitor_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_visitor_identity_crm ON visitor_identities(crm_user_id) WHERE crm_user_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_visitor_identity_slug ON visitor_identities(utm_slug) WHERE utm_slug IS NOT NULL`;

  // 20. audience_profiles — unified audience profile per campaign per ring
  await sql`
    CREATE TABLE IF NOT EXISTS audience_profiles (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      ring            TEXT NOT NULL CHECK (ring IN ('declared', 'paid', 'organic', 'converted')),
      demographics    JSONB NOT NULL DEFAULT '{}',
      skills          JSONB NOT NULL DEFAULT '{}',
      languages       TEXT[] NOT NULL DEFAULT '{}',
      regions         TEXT[] NOT NULL DEFAULT '{}',
      sample_size     INT NOT NULL DEFAULT 0,
      confidence      TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
      source          TEXT NOT NULL,
      captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(request_id, ring)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_audience_profiles_request ON audience_profiles(request_id)`;

  // 21. audience_drift_snapshots — point-in-time drift calculations
  await sql`
    CREATE TABLE IF NOT EXISTS audience_drift_snapshots (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id            UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      declared_vs_paid      FLOAT NOT NULL DEFAULT 0,
      declared_vs_organic   FLOAT NOT NULL DEFAULT 0,
      paid_vs_converted     FLOAT NOT NULL DEFAULT 0,
      organic_vs_converted  FLOAT NOT NULL DEFAULT 0,
      overall_drift         FLOAT NOT NULL DEFAULT 0,
      severity              TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'moderate', 'high')),
      segment_mismatch      BOOLEAN NOT NULL DEFAULT FALSE,
      evidence              JSONB NOT NULL DEFAULT '{}',
      recommendations       TEXT[] NOT NULL DEFAULT '{}',
      computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_drift_snapshots_request ON audience_drift_snapshots(request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_drift_snapshots_computed ON audience_drift_snapshots(computed_at DESC)`;

  // 22. audience_health_scores — per-campaign health with issues
  await sql`
    CREATE TABLE IF NOT EXISTS audience_health_scores (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      score           INT NOT NULL DEFAULT 100,
      issues          JSONB NOT NULL DEFAULT '[]',
      computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_health_scores_request ON audience_health_scores(request_id)`;

  // 23. ga4_session_cache — cached GA4 session data for AudienceIQ
  await sql`
    CREATE TABLE IF NOT EXISTS ga4_session_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ga4_client_id     TEXT,
      date              DATE NOT NULL,
      source            TEXT,
      medium            TEXT,
      campaign          TEXT,
      country           TEXT,
      city              TEXT,
      device_category   TEXT,
      sessions          INT NOT NULL DEFAULT 0,
      engaged_sessions  INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      demographics      JSONB NOT NULL DEFAULT '{}',
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ga4_cache_date ON ga4_session_cache(date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ga4_cache_source ON ga4_session_cache(source) WHERE source IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ga4_cache_country ON ga4_session_cache(country) WHERE country IS NOT NULL`;

  // 24. hie_sessions — behavioral session tracking
  await sql`
    CREATE TABLE IF NOT EXISTS hie_sessions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id        TEXT NOT NULL UNIQUE,
      visitor_id        TEXT NOT NULL,
      landing_page_url  TEXT,
      referrer          TEXT,
      user_agent        TEXT,
      viewport_width    INT,
      viewport_height   INT,
      device_pixel_ratio FLOAT,
      device_type       TEXT,
      screen_width      INT,
      screen_height     INT,
      started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_sessions_visitor ON hie_sessions(visitor_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_sessions_started ON hie_sessions(started_at DESC)`;

  // 25. hie_interaction_events — clicks, CTAs, forms, mousemove, visibility
  await sql`
    CREATE TABLE IF NOT EXISTS hie_interaction_events (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id          TEXT NOT NULL,
      visitor_id          TEXT NOT NULL,
      event_type          TEXT NOT NULL,
      page_url            TEXT,
      page_hash           TEXT,
      x                   INT,
      y                   INT,
      viewport_width      INT,
      viewport_height     INT,
      element_selector    TEXT,
      element_tag         TEXT,
      element_text        TEXT,
      event_data          JSONB DEFAULT '{}',
      client_timestamp_ms BIGINT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_interactions_session ON hie_interaction_events(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_interactions_page ON hie_interaction_events(page_url, event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_interactions_hash ON hie_interaction_events(page_hash)`;

  // 26. hie_scroll_events — scroll depth tracking
  await sql`
    CREATE TABLE IF NOT EXISTS hie_scroll_events (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id          TEXT NOT NULL,
      visitor_id          TEXT NOT NULL,
      page_url            TEXT,
      page_hash           TEXT,
      scroll_y            INT,
      scroll_percent      INT,
      document_height     INT,
      viewport_height     INT,
      direction           TEXT,
      milestone           INT,
      client_timestamp_ms BIGINT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_session ON hie_scroll_events(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_page ON hie_scroll_events(page_url)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_milestone ON hie_scroll_events(page_url, milestone)`;

  // 27. hie_page_snapshots — compressed DOM for heatmap overlay
  await sql`
    CREATE TABLE IF NOT EXISTS hie_page_snapshots (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_url          TEXT NOT NULL,
      canonical_url     TEXT,
      page_hash         TEXT NOT NULL UNIQUE,
      stripped_html     BYTEA,
      viewport_width    INT,
      document_height   INT,
      element_map       JSONB DEFAULT '{}',
      captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 28. hie_heat_facts — pre-aggregated click density
  await sql`
    CREATE TABLE IF NOT EXISTS hie_heat_facts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_url          TEXT NOT NULL,
      page_hash         TEXT,
      event_type        TEXT NOT NULL,
      grid_x            INT NOT NULL,
      grid_y            INT NOT NULL,
      click_count       INT NOT NULL DEFAULT 0,
      unique_sessions   INT NOT NULL DEFAULT 0,
      unique_visitors   INT NOT NULL DEFAULT 0,
      element_selector  TEXT,
      segment_key       TEXT,
      segment_value     TEXT,
      fact_date         DATE NOT NULL DEFAULT CURRENT_DATE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_heat_facts_page ON hie_heat_facts(page_url, fact_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_heat_facts_segment ON hie_heat_facts(page_url, segment_key, fact_date)`;

  // 29. hie_scroll_facts — pre-aggregated scroll depth
  await sql`
    CREATE TABLE IF NOT EXISTS hie_scroll_facts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_url          TEXT NOT NULL,
      page_hash         TEXT,
      depth_band        TEXT NOT NULL,
      sessions_reached  INT NOT NULL DEFAULT 0,
      unique_visitors   INT NOT NULL DEFAULT 0,
      avg_time_at_depth_ms INT NOT NULL DEFAULT 0,
      segment_key       TEXT,
      segment_value     TEXT,
      fact_date         DATE NOT NULL DEFAULT CURRENT_DATE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_facts_page ON hie_scroll_facts(page_url, fact_date)`;

  // 30. google_ads_cache — raw Google Ads campaign/audience data
  await sql`
    CREATE TABLE IF NOT EXISTS google_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id       TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      ad_group_id       TEXT,
      ad_group_name     TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend_micros      BIGINT NOT NULL DEFAULT 0,
      demographics      JSONB NOT NULL DEFAULT '{}',
      audience_segments JSONB NOT NULL DEFAULT '[]',
      geo_targets       JSONB NOT NULL DEFAULT '[]',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_google_ads_cache_campaign ON google_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_google_ads_cache_date ON google_ads_cache(date DESC)`;

  // 31. meta_ads_cache — raw Meta (Facebook/Instagram) ad data
  await sql`
    CREATE TABLE IF NOT EXISTS meta_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_account_id     TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      adset_id          TEXT,
      adset_name        TEXT,
      ad_id             TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend             FLOAT NOT NULL DEFAULT 0,
      audience_insights JSONB NOT NULL DEFAULT '{}',
      targeting         JSONB NOT NULL DEFAULT '{}',
      demographics      JSONB NOT NULL DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_campaign ON meta_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_date ON meta_ads_cache(date DESC)`;

  await sql`
    DO $$ BEGIN
      ALTER TABLE meta_ads_cache ADD CONSTRAINT meta_ads_cache_uq
        UNIQUE(ad_account_id, campaign_id, adset_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 32. linkedin_ads_cache — raw LinkedIn Campaign Manager data
  await sql`
    CREATE TABLE IF NOT EXISTS linkedin_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_account_id     TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      creative_id       TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend             FLOAT NOT NULL DEFAULT 0,
      targeting         JSONB NOT NULL DEFAULT '{}',
      demographics      JSONB NOT NULL DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_ads_cache_campaign ON linkedin_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_ads_cache_date ON linkedin_ads_cache(date DESC)`;

  // 33. tiktok_ads_cache — raw TikTok Marketing API data
  await sql`
    CREATE TABLE IF NOT EXISTS tiktok_ads_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      advertiser_id     TEXT NOT NULL,
      campaign_id       TEXT NOT NULL,
      campaign_name     TEXT,
      adgroup_id        TEXT,
      impressions       INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      spend             FLOAT NOT NULL DEFAULT 0,
      audience          JSONB NOT NULL DEFAULT '{}',
      demographics      JSONB NOT NULL DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tiktok_ads_cache_campaign ON tiktok_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tiktok_ads_cache_date ON tiktok_ads_cache(date DESC)`;

  // 34. reddit_ads_cache — raw Reddit Ads campaign data
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_ads_cache (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ad_account_id   TEXT NOT NULL,
      campaign_id     TEXT NOT NULL,
      campaign_name   TEXT,
      ad_group_id     TEXT,
      ad_group_name   TEXT,
      impressions     INT NOT NULL DEFAULT 0,
      clicks          INT NOT NULL DEFAULT 0,
      conversions     INT NOT NULL DEFAULT 0,
      spend           FLOAT NOT NULL DEFAULT 0,
      ecpm            FLOAT,
      cpc             FLOAT,
      ctr             FLOAT,
      demographics    JSONB NOT NULL DEFAULT '{}',
      raw_data        JSONB NOT NULL DEFAULT '{}',
      date            DATE NOT NULL,
      last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_ads_cache_campaign ON reddit_ads_cache(campaign_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_ads_cache_date ON reddit_ads_cache(date DESC)`;

  await sql`
    DO $$ BEGIN
      ALTER TABLE reddit_ads_cache ADD CONSTRAINT reddit_ads_cache_uq
        UNIQUE(ad_account_id, campaign_id, ad_group_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 35. brevo_campaign_metrics — email campaign performance (separate from ad normalization)
  await sql`
    CREATE TABLE IF NOT EXISTS brevo_campaign_metrics (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      campaign_id     TEXT NOT NULL,
      campaign_name   TEXT,
      subject         TEXT,
      date            DATE NOT NULL,
      sends           INT DEFAULT 0,
      delivered       INT DEFAULT 0,
      opens           INT DEFAULT 0,
      unique_opens    INT DEFAULT 0,
      clicks          INT DEFAULT 0,
      unique_clicks   INT DEFAULT 0,
      bounces         INT DEFAULT 0,
      unsubscribes    INT DEFAULT 0,
      spam_reports    INT DEFAULT 0,
      open_rate       FLOAT,
      click_rate      FLOAT,
      bounce_rate     FLOAT,
      raw_data        JSONB NOT NULL DEFAULT '{}',
      synced_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(request_id, campaign_id, date)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_brevo_metrics_request ON brevo_campaign_metrics(request_id, date)`;

  // 36. meta_organic_cache — post-level Facebook/Instagram organic metrics
  await sql`
    CREATE TABLE IF NOT EXISTS meta_organic_cache (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id         TEXT NOT NULL,
      post_id         TEXT NOT NULL,
      post_type       TEXT,
      platform        TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
      post_url        TEXT,
      post_text       TEXT,
      published_at    TIMESTAMPTZ,
      impressions     INT NOT NULL DEFAULT 0,
      reach           INT NOT NULL DEFAULT 0,
      engagement      INT NOT NULL DEFAULT 0,
      likes           INT NOT NULL DEFAULT 0,
      comments        INT NOT NULL DEFAULT 0,
      shares          INT NOT NULL DEFAULT 0,
      saves           INT NOT NULL DEFAULT 0,
      clicks          INT NOT NULL DEFAULT 0,
      video_views     INT NOT NULL DEFAULT 0,
      engagement_rate FLOAT,
      raw_insights    JSONB NOT NULL DEFAULT '{}',
      date            DATE NOT NULL,
      last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_organic_page ON meta_organic_cache(page_id, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_organic_date ON meta_organic_cache(date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE meta_organic_cache ADD CONSTRAINT meta_organic_cache_uq
        UNIQUE(page_id, post_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 37. linkedin_organic_cache — post-level LinkedIn organization metrics
  await sql`
    CREATE TABLE IF NOT EXISTS linkedin_organic_cache (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id              TEXT NOT NULL,
      post_id             TEXT NOT NULL,
      post_type           TEXT,
      post_url            TEXT,
      post_text           TEXT,
      published_at        TIMESTAMPTZ,
      impressions         INT NOT NULL DEFAULT 0,
      unique_impressions   INT NOT NULL DEFAULT 0,
      engagement          INT NOT NULL DEFAULT 0,
      likes               INT NOT NULL DEFAULT 0,
      comments            INT NOT NULL DEFAULT 0,
      shares              INT NOT NULL DEFAULT 0,
      clicks              INT NOT NULL DEFAULT 0,
      engagement_rate     FLOAT,
      raw_insights        JSONB NOT NULL DEFAULT '{}',
      date                DATE NOT NULL,
      last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_organic_org ON linkedin_organic_cache(org_id, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_organic_date ON linkedin_organic_cache(date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE linkedin_organic_cache ADD CONSTRAINT linkedin_organic_cache_uq
        UNIQUE(org_id, post_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 38. reddit_organic_cache — Reddit post metrics
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_organic_cache (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username       TEXT NOT NULL,
      post_id        TEXT NOT NULL,
      subreddit      TEXT NOT NULL,
      post_type      TEXT,
      post_url       TEXT,
      post_title     TEXT,
      post_text      TEXT,
      published_at   TIMESTAMPTZ,
      upvotes        INT NOT NULL DEFAULT 0,
      downvotes      INT NOT NULL DEFAULT 0,
      score          INT NOT NULL DEFAULT 0,
      comments       INT NOT NULL DEFAULT 0,
      upvote_ratio   FLOAT,
      crossposts     INT NOT NULL DEFAULT 0,
      awards         INT NOT NULL DEFAULT 0,
      raw_data       JSONB NOT NULL DEFAULT '{}',
      date           DATE NOT NULL,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_organic_username ON reddit_organic_cache(username, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_organic_date ON reddit_organic_cache(date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE reddit_organic_cache ADD CONSTRAINT reddit_organic_cache_uq
        UNIQUE(username, post_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 39. gsc_daily_cache — Google Search Console query-level data
  await sql`
    CREATE TABLE IF NOT EXISTS gsc_daily_cache (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_url   TEXT NOT NULL,
      query          TEXT NOT NULL,
      page           TEXT NOT NULL,
      country        TEXT NOT NULL DEFAULT '',
      device         TEXT NOT NULL DEFAULT '',
      clicks         INT NOT NULL DEFAULT 0,
      impressions    INT NOT NULL DEFAULT 0,
      ctr            FLOAT,
      position       FLOAT,
      date           DATE NOT NULL,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_gsc_property ON gsc_daily_cache(property_url, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gsc_date ON gsc_daily_cache(date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gsc_query ON gsc_daily_cache(query, date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE gsc_daily_cache ADD CONSTRAINT gsc_daily_cache_uq
        UNIQUE(property_url, query, page, country, device, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 40. social_account_snapshots — daily account-level rollup across platforms
  await sql`
    CREATE TABLE IF NOT EXISTS social_account_snapshots (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform            TEXT NOT NULL,
      account_id          TEXT NOT NULL,
      account_name        TEXT,
      followers           INT NOT NULL DEFAULT 0,
      follower_delta      INT NOT NULL DEFAULT 0,
      total_reach         INT NOT NULL DEFAULT 0,
      total_impressions   INT NOT NULL DEFAULT 0,
      total_engagement    INT NOT NULL DEFAULT 0,
      post_count          INT NOT NULL DEFAULT 0,
      avg_engagement_rate FLOAT,
      profile_views       INT NOT NULL DEFAULT 0,
      date                DATE NOT NULL,
      last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_snapshots_account ON social_account_snapshots(account_id, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_snapshots_date ON social_account_snapshots(date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_snapshots_platform ON social_account_snapshots(platform, date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE social_account_snapshots ADD CONSTRAINT social_account_snapshots_uq
        UNIQUE(platform, account_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 41. organic_post_assets — attribution bridge: organic post ↔ generated assets
  await sql`
    CREATE TABLE IF NOT EXISTS organic_post_assets (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform    TEXT NOT NULL,
      post_id     TEXT NOT NULL,
      asset_id    UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
      request_id  UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
      source      TEXT NOT NULL DEFAULT 'manual',
      matched_by  TEXT,
      confidence  FLOAT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_organic_post_assets_asset ON organic_post_assets(asset_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_organic_post_assets_request ON organic_post_assets(request_id)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE organic_post_assets ADD CONSTRAINT organic_post_assets_uq
        UNIQUE(platform, post_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // channel_performance_unified VIEW — union of paid + organic metrics
  await sql`
    CREATE OR REPLACE VIEW channel_performance_unified AS
      SELECT
        date,
        platform,
        channel,
        'paid'        AS metric_type,
        impressions,
        clicks,
        spend::FLOAT  AS spend,
        conversions,
        NULL::INT     AS reach,
        NULL::INT     AS engagement,
        NULL::INT     AS likes,
        NULL::INT     AS shares,
        NULL::INT     AS saves,
        NULL::FLOAT   AS engagement_rate
      FROM normalized_daily_metrics

      UNION ALL

      SELECT
        date,
        platform,
        'organic'     AS channel,
        'organic'     AS metric_type,
        SUM(impressions)::INT     AS impressions,
        SUM(clicks)::INT          AS clicks,
        0.0                       AS spend,
        0                         AS conversions,
        SUM(reach)::INT           AS reach,
        SUM(engagement)::INT      AS engagement,
        SUM(likes)::INT           AS likes,
        SUM(shares)::INT          AS shares,
        SUM(saves)::INT           AS saves,
        AVG(engagement_rate)      AS engagement_rate
      FROM meta_organic_cache
      GROUP BY date, platform

      UNION ALL

      SELECT
        date,
        'linkedin'    AS platform,
        'organic'     AS channel,
        'organic'     AS metric_type,
        SUM(impressions)::INT        AS impressions,
        SUM(clicks)::INT             AS clicks,
        0.0                          AS spend,
        0                            AS conversions,
        SUM(unique_impressions)::INT AS reach,
        SUM(engagement)::INT         AS engagement,
        SUM(likes)::INT              AS likes,
        SUM(shares)::INT             AS shares,
        NULL::INT                    AS saves,
        AVG(engagement_rate)         AS engagement_rate
      FROM linkedin_organic_cache
      GROUP BY date

      UNION ALL

      SELECT
        date,
        'reddit'      AS platform,
        'organic'     AS channel,
        'organic'     AS metric_type,
        NULL::INT     AS impressions,
        NULL::INT     AS clicks,
        0.0           AS spend,
        0             AS conversions,
        NULL::INT     AS reach,
        (SUM(upvotes) + SUM(comments))::INT AS engagement,
        SUM(upvotes)::INT                   AS likes,
        SUM(crossposts)::INT                AS shares,
        NULL::INT                           AS saves,
        AVG(upvote_ratio)                   AS engagement_rate
      FROM reddit_organic_cache
      GROUP BY date
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

  // interest_nodes — GraphRAG platform interest knowledge graph
  await sql`
    CREATE TABLE IF NOT EXISTS interest_nodes (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform    TEXT NOT NULL,
      category    TEXT NOT NULL,
      subcategory TEXT,
      interest    TEXT NOT NULL,
      tier        TEXT DEFAULT 'standard',
      keywords    TEXT[] DEFAULT '{}',
      is_active   BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, category, interest)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_nodes_platform ON interest_nodes(platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_nodes_category ON interest_nodes(platform, category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_nodes_search ON interest_nodes USING GIN(keywords)`;

  // interest_edges — relationships between interest nodes
  await sql`
    CREATE TABLE IF NOT EXISTS interest_edges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
      target_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
      edge_type   TEXT NOT NULL CHECK (edge_type IN ('equivalent_on', 'related_to', 'parent_of', 'sibling')),
      weight      FLOAT DEFAULT 1.0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_id, target_id, edge_type)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_edges_source ON interest_edges(source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_edges_target ON interest_edges(target_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_edges_type ON interest_edges(edge_type)`;

  // ============================================================
  // COMMAND CENTER TABLES (SRC Port — Analytics + ROAS)
  // ============================================================

  // 35. normalized_daily_metrics — aggregated daily metrics by platform/channel
  await sql`
    CREATE TABLE IF NOT EXISTS normalized_daily_metrics (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      country         TEXT,
      date            DATE NOT NULL,
      platform        TEXT NOT NULL,
      channel         TEXT,
      impressions     INT DEFAULT 0,
      clicks          INT DEFAULT 0,
      spend           NUMERIC(12,2) DEFAULT 0,
      conversions     INT DEFAULT 0,
      conversion_value NUMERIC(12,2) DEFAULT 0,
      signups         INT DEFAULT 0,
      profile_completes INT DEFAULT 0,
      quality_score   FLOAT,
      cpa             NUMERIC(12,2),
      ctr             FLOAT,
      roas            FLOAT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(request_id, country, date, platform, channel)
    )
  `;

  // 36. attribution_journeys — user conversion journeys
  await sql`
    CREATE TABLE IF NOT EXISTS attribution_journeys (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      visitor_id      TEXT NOT NULL,
      country         TEXT,
      converted       BOOLEAN DEFAULT FALSE,
      revenue         NUMERIC(12,2) DEFAULT 0,
      first_touch_at  TIMESTAMPTZ,
      last_touch_at   TIMESTAMPTZ,
      conversion_at   TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 37. attribution_touchpoints — individual touchpoints in journeys
  await sql`
    CREATE TABLE IF NOT EXISTS attribution_touchpoints (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      journey_id      UUID NOT NULL REFERENCES attribution_journeys(id) ON DELETE CASCADE,
      touchpoint_order INT NOT NULL,
      channel         TEXT NOT NULL,
      platform        TEXT,
      utm_source      TEXT,
      utm_medium      TEXT,
      utm_campaign    TEXT,
      utm_content     TEXT,
      utm_term        TEXT,
      page_url        TEXT,
      timestamp       TIMESTAMPTZ NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 38. revbrain_snapshots — materialized truth layer for budget recommendations
  await sql`
    CREATE TABLE IF NOT EXISTS revbrain_snapshots (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      country         TEXT,
      snapshot_date   DATE NOT NULL,
      period_start    DATE NOT NULL,
      period_end      DATE NOT NULL,
      metrics_data    JSONB NOT NULL DEFAULT '{}',
      recommendations JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 39. campaign_dashboards — user-created reporting surfaces
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_dashboards (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      layout          JSONB NOT NULL DEFAULT '{}',
      filters         JSONB DEFAULT '{}',
      created_by      TEXT NOT NULL,
      is_default      BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 40. campaign_exports — async-generated report artifacts
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_exports (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      export_type     TEXT NOT NULL CHECK (export_type IN ('pdf', 'xlsx', 'csv', 'pptx')),
      title           TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'complete', 'failed')),
      blob_url        TEXT,
      filters         JSONB DEFAULT '{}',
      created_by      TEXT NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    )
  `;

  // 41. campaign_share_links — public sharing with optional password
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_share_links (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      token           TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      resource_type   TEXT NOT NULL CHECK (resource_type IN ('dashboard', 'export')),
      resource_id     UUID NOT NULL,
      password_hash   TEXT,
      expires_at      TIMESTAMPTZ,
      view_count      INT DEFAULT 0,
      created_by      TEXT NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 42. roas_config — per-campaign ROAS calculation parameters
  await sql`
    CREATE TABLE IF NOT EXISTS roas_config (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      country         TEXT,
      contract_value  NUMERIC(14,2),
      required_participants INT,
      variable_cost_per_participant NUMERIC(10,2) DEFAULT 0,
      fulfillment_rate FLOAT DEFAULT 0.65,
      rpp             NUMERIC(10,2),
      net_rpp         NUMERIC(10,2),
      breakeven_cpa   NUMERIC(10,2),
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(request_id, country)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_daily_metrics_request ON normalized_daily_metrics(request_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_metrics_country ON normalized_daily_metrics(request_id, country)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attribution_journeys_request ON attribution_journeys(request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_journey ON attribution_touchpoints(journey_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_revbrain_request ON revbrain_snapshots(request_id, snapshot_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboards_request ON campaign_dashboards(request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_exports_request ON campaign_exports(request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_share_links_token ON campaign_share_links(token)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_roas_config_request ON roas_config(request_id, country)`;

  // Seed default Insights dashboard template
  await seedDefaultTemplate();

  // Seed 4 pre-built story dashboards
  await seedPrebuiltDashboards();
}
