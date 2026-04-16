import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS task_type_schemas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), task_type TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, icon TEXT DEFAULT 'file-text', description TEXT, schema JSONB NOT NULL, version INT DEFAULT 1, is_active BOOLEAN DEFAULT TRUE, sort_order INT DEFAULT 0, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS schema_versions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schema_id UUID REFERENCES task_type_schemas(id) ON DELETE CASCADE, version INT NOT NULL, schema JSONB NOT NULL, change_summary TEXT, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(schema_id, version))`,
  `CREATE TABLE IF NOT EXISTS option_registries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), registry_name TEXT NOT NULL, option_value TEXT NOT NULL, option_label TEXT NOT NULL, metadata JSONB DEFAULT '{}', sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(registry_name, option_value))`,
  `CREATE TABLE IF NOT EXISTS intake_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, task_type TEXT NOT NULL, urgency TEXT CHECK (urgency IN ('urgent','standard','pipeline')), target_languages TEXT[], target_regions TEXT[], volume_needed INT, status TEXT DEFAULT 'draft' CHECK (status IN ('draft','generating','review','approved','sent','rejected')), created_by TEXT NOT NULL, form_data JSONB DEFAULT '{}', schema_version INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS attachments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, file_name TEXT NOT NULL, file_type TEXT NOT NULL, blob_url TEXT NOT NULL, extracted_text TEXT, extraction_data JSONB, is_rfp BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS creative_briefs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, brief_data JSONB NOT NULL, channel_research JSONB, design_direction JSONB, content_languages TEXT[], evaluation_score FLOAT, evaluation_data JSONB, version INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS actor_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, name TEXT NOT NULL, face_lock JSONB NOT NULL, prompt_seed TEXT NOT NULL, outfit_variations JSONB, signature_accessory TEXT, backdrops TEXT[], created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS generated_assets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, actor_id UUID REFERENCES actor_profiles(id), asset_type TEXT NOT NULL CHECK (asset_type IN ('base_image','composed_creative','carousel_panel')), platform TEXT NOT NULL, format TEXT NOT NULL, language TEXT DEFAULT 'en', content JSONB, copy_data JSONB, blob_url TEXT, evaluation_score FLOAT, evaluation_data JSONB, evaluation_passed BOOLEAN DEFAULT FALSE, stage INT NOT NULL, version INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, approved_by TEXT NOT NULL, status TEXT CHECK (status IN ('approved','changes_requested','rejected')), notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS designer_uploads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, original_asset_id UUID REFERENCES generated_assets(id), file_name TEXT NOT NULL, blob_url TEXT NOT NULL, uploaded_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS magic_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, channel TEXT CHECK (channel IN ('slack','outlook','teams')), recipient TEXT, status TEXT CHECK (status IN ('sent','delivered','failed')), payload JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS pipeline_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, stage INT NOT NULL, stage_name TEXT NOT NULL, status TEXT CHECK (status IN ('running','passed','failed','retrying')), attempt INT DEFAULT 1, input_data JSONB, output_data JSONB, evaluation_data JSONB, duration_ms INT, error_message TEXT, started_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ)`,
  `CREATE TABLE IF NOT EXISTS compute_jobs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE, job_type TEXT NOT NULL CHECK (job_type IN ('generate','regenerate','regenerate_stage','regenerate_asset')), status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')), stage_target INT, asset_id UUID, feedback TEXT, feedback_data JSONB, error_message TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clerk_id TEXT UNIQUE NOT NULL, email TEXT NOT NULL, name TEXT, role TEXT NOT NULL CHECK (role IN ('admin','recruiter','designer','viewer')), is_active BOOLEAN DEFAULT TRUE, invited_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS campaign_landing_pages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL UNIQUE REFERENCES intake_requests(id) ON DELETE CASCADE, job_posting_url TEXT, landing_page_url TEXT, ada_form_url TEXT, updated_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_request ON campaign_landing_pages(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_option_registries_name ON option_registries(registry_name) WHERE is_active = TRUE`,
  `CREATE INDEX IF NOT EXISTS idx_intake_status ON intake_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_intake_task_type ON intake_requests(task_type)`,
  `CREATE INDEX IF NOT EXISTS idx_intake_created_at ON intake_requests(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_compute_jobs_pending ON compute_jobs(status) WHERE status = 'pending'`,
  `ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS campaign_slug TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_intake_campaign_slug ON intake_requests(campaign_slug) WHERE campaign_slug IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS tracked_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, request_id UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE, asset_id UUID REFERENCES generated_assets(id) ON DELETE SET NULL, recruiter_clerk_id TEXT NOT NULL, destination_url TEXT NOT NULL, base_url TEXT NOT NULL, utm_campaign TEXT NOT NULL, utm_source TEXT NOT NULL, utm_medium TEXT NOT NULL DEFAULT 'social', utm_term TEXT NOT NULL, utm_content TEXT NOT NULL, click_count INT NOT NULL DEFAULT 0, last_clicked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_tracked_links_request ON tracked_links(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tracked_links_recruiter ON tracked_links(recruiter_clerk_id, request_id)`,
  `ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS qualifications_required TEXT, ADD COLUMN IF NOT EXISTS qualifications_preferred TEXT, ADD COLUMN IF NOT EXISTS location_scope TEXT, ADD COLUMN IF NOT EXISTS language_requirements TEXT, ADD COLUMN IF NOT EXISTS engagement_model TEXT, ADD COLUMN IF NOT EXISTS technical_requirements TEXT, ADD COLUMN IF NOT EXISTS context_notes TEXT`,
  `ALTER TABLE creative_briefs ADD COLUMN IF NOT EXISTS pillar_primary TEXT CHECK (pillar_primary IN ('earn', 'grow', 'shape')), ADD COLUMN IF NOT EXISTS pillar_secondary TEXT CHECK (pillar_secondary IN ('earn', 'grow', 'shape')), ADD COLUMN IF NOT EXISTS derived_requirements JSONB`,
  `CREATE INDEX IF NOT EXISTS idx_creative_briefs_pillar_primary ON creative_briefs(pillar_primary) WHERE pillar_primary IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS design_artifacts (artifact_id TEXT PRIMARY KEY, category TEXT NOT NULL, description TEXT NOT NULL, blob_url TEXT NOT NULL, dimensions TEXT, css_class TEXT, usage_snippet TEXT NOT NULL, usage_notes TEXT, pillar_affinity TEXT[] DEFAULT '{}', format_affinity TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_design_artifacts_category ON design_artifacts(category)`,
  `CREATE INDEX IF NOT EXISTS idx_design_artifacts_active ON design_artifacts(is_active) WHERE is_active = true`,
];

async function init() {
  for (let i = 0; i < statements.length; i++) {
    await sql.query(statements[i]);
    process.stdout.write(`\r${i + 1}/${statements.length} done`);
  }
  console.log('\nAll tables + indexes created!');

  const result = await sql.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in database:', result.rows[0].count);
}

init().catch(e => console.error('Error:', e.message));
