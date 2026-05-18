-- migrations/2026-05-18-project-registry.sql
-- Project Registry — tables, seed data, functions, views
--
-- Run against Neon production database:
--   psql $DATABASE_URL -f migrations/2026-05-18-project-registry.sql
--
-- Safe to run multiple times (all operations are idempotent).
-- Covers: Project registry, dynamic channel definitions, UTM channel rules,
--         channel linking, unclassified UTM log, funnel views, weekly summary.

-- ═══════════════════════════════════════════════════════════════════════
-- PART 1: Tables + Seed Data
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- pg_trgm for fuzzy alias matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── projects ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codename        TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  wp_job_id       INT,
  wp_slug         TEXT,
  wp_published_at TIMESTAMPTZ,
  intake_id       UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','completed','archived')),
  countries       TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_codename ON projects(codename);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_intake ON projects(intake_id);

-- ─── project_aliases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual','fuzzy_match','utm_scan','wp_scan')),
  confidence  FLOAT DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE project_aliases ADD CONSTRAINT project_aliases_alias_key UNIQUE(alias);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_aliases_alias
  ON project_aliases USING gin (alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_project_aliases_project
  ON project_aliases(project_id);

-- ─── channel_definitions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN (
    'paid_social','paid_search','organic_social','organic_search',
    'email','job_board','physical','recruiter','influencer','referral','direct','other'
  )),
  icon          TEXT,
  is_paid       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 20 channel definitions
INSERT INTO channel_definitions (slug, display_name, category, is_paid) VALUES
  ('meta_paid',       'Meta Ads',           'paid_social',     TRUE),
  ('reddit_paid',     'Reddit Ads',         'paid_social',     TRUE),
  ('google_paid',     'Google Ads',         'paid_search',     TRUE),
  ('tiktok_paid',     'TikTok Ads',         'paid_social',     TRUE),
  ('linkedin_paid',   'LinkedIn Ads',       'paid_social',     TRUE),
  ('meta_organic',    'Meta Organic',       'organic_social',  FALSE),
  ('linkedin_organic','LinkedIn Organic',   'organic_social',  FALSE),
  ('reddit_organic',  'Reddit Organic',     'organic_social',  FALSE),
  ('brevo_email',     'Brevo Email',        'email',           FALSE),
  ('organic_search',  'Organic Search',     'organic_search',  FALSE),
  ('flyer',           'Physical Flyers',    'physical',        FALSE),
  ('qr_poster',       'QR Posters',         'physical',        FALSE),
  ('recruiter',       'Recruiter Direct',   'recruiter',       FALSE),
  ('influencer',      'Influencer',         'influencer',      TRUE),
  ('indeed',          'Indeed',             'job_board',       FALSE),
  ('glassdoor',       'Glassdoor',          'job_board',       FALSE),
  ('linkedin_jobs',   'LinkedIn Jobs',      'job_board',       FALSE),
  ('monster',         'Monster',            'job_board',       FALSE),
  ('referral',        'Employee Referral',  'referral',        FALSE),
  ('direct',          'Direct Traffic',     'direct',          FALSE)
ON CONFLICT DO NOTHING;

-- ─── utm_channel_rules ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utm_channel_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            UUID NOT NULL REFERENCES channel_definitions(id) ON DELETE CASCADE,
  utm_source_pattern    TEXT,
  utm_medium_pattern    TEXT,
  utm_campaign_pattern  TEXT,
  priority              INT NOT NULL DEFAULT 0,
  extract_label_regex   TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utm_rules_source ON utm_channel_rules(utm_source_pattern);
CREATE INDEX IF NOT EXISTS idx_utm_rules_medium ON utm_channel_rules(utm_medium_pattern);

-- Seed ~16 UTM rules — JOIN channel_definitions by slug via VALUES subquery
-- Guard: only seed if table is empty (prevents duplicates on re-run)
INSERT INTO utm_channel_rules (channel_id, utm_source_pattern, utm_medium_pattern, priority, extract_label_regex, notes)
SELECT cd.id, v.source_pat, v.medium_pat, v.pri, v.extract_re, v.notes
FROM (VALUES
  ('flyer',           '^flyer',                                         NULL,                              10, 'flyer_(.+)',       'Physical flyer with city suffix'),
  ('qr_poster',       NULL,                                             '^qr$',                            10, NULL,               'Any source with medium=qr'),
  ('recruiter',       '^recruiter_',                                    NULL,                              10, 'recruiter_(.+)',   'Individual recruiter links'),
  ('recruiter',       NULL,                                             '^recruiter$',                      5, NULL,               'Fallback: medium=recruiter'),
  ('influencer',      '^influencer_',                                   NULL,                              10, 'influencer_(.+)',  'Named influencer'),
  ('influencer',      NULL,                                             '^influencer$',                     5, NULL,               'Fallback: medium=influencer'),
  ('indeed',          '^indeed',                                        NULL,                              10, NULL,               'Indeed organic or sponsored'),
  ('glassdoor',       '^glassdoor',                                     NULL,                              10, NULL,               NULL),
  ('linkedin_jobs',   '^linkedin_jobs',                                 NULL,                              10, NULL,               'LinkedIn Jobs (not ads)'),
  ('linkedin_jobs',   '^linkedin',                                      '^job',                             8, NULL,               'linkedin + medium containing job'),
  ('meta_paid',       '^(facebook|fb|instagram|ig|meta)$',              '^(cpc|paid|paidsocial)$',          5, NULL,               NULL),
  ('reddit_paid',     '^reddit$',                                       '^(cpc|paid)$',                     5, NULL,               NULL),
  ('google_paid',     '^google$',                                       '^(cpc|ppc|paid)$',                 5, NULL,               NULL),
  ('meta_organic',    '^(facebook|fb|instagram|ig)$',                   '^(social|organic|post)$',          5, NULL,               NULL),
  ('linkedin_organic','^linkedin$',                                     '^(social|organic|post)$',          5, NULL,               NULL),
  ('brevo_email',     '^(brevo|sendinblue|email)$',                     NULL,                               5, NULL,               NULL)
) AS v(slug, source_pat, medium_pat, pri, extract_re, notes)
JOIN channel_definitions cd ON cd.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM utm_channel_rules LIMIT 1);

-- ─── project_channel_links ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_channel_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel_id      UUID NOT NULL REFERENCES channel_definitions(id),
  external_id     TEXT NOT NULL,
  external_name   TEXT,
  extracted_label TEXT,
  match_method    TEXT NOT NULL DEFAULT 'manual'
                  CHECK (match_method IN ('manual','fuzzy','exact','regex')),
  confidence      FLOAT DEFAULT 1.0,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE project_channel_links ADD CONSTRAINT project_channel_links_channel_external_uq
    UNIQUE(channel_id, external_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_channel_links_project ON project_channel_links(project_id);
CREATE INDEX IF NOT EXISTS idx_channel_links_channel ON project_channel_links(channel_id, external_id);

-- ─── unclassified_utm_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unclassified_utm_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  raw_source      TEXT,
  raw_medium      TEXT,
  raw_campaign    TEXT,
  normalized_name TEXT NOT NULL,
  hit_count       INT NOT NULL DEFAULT 1,
  first_seen_at   DATE NOT NULL,
  last_seen_at    DATE NOT NULL,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_to     UUID REFERENCES channel_definitions(id),
  resolved_at     TIMESTAMPTZ
);

DO $$ BEGIN
  ALTER TABLE unclassified_utm_log ADD CONSTRAINT unclassified_utm_log_source_medium_campaign_uq
    UNIQUE(raw_source, raw_medium, raw_campaign);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unclassified_unresolved
  ON unclassified_utm_log(resolved, hit_count DESC)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_unclassified_project
  ON unclassified_utm_log(project_id);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- PART 2: Functions + Views
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── normalize_utm_display ────────────────────────────────────────────
-- Turns raw garbage UTMs into human-readable names.
-- e.g. 'recruiter_ahmed_rafiq' → 'Recruiter Ahmed Rafiq'
CREATE OR REPLACE FUNCTION normalize_utm_display(raw_value TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN initcap(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(raw_value, 'direct')),
          '[_\-]+', ' ', 'g'
        ),
        '^(utm|src|ref|campaign|source)\s+', '', 'i'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── resolve_utm_channel ──────────────────────────────────────────────
-- Matches UTM parameters against utm_channel_rules by priority DESC LIMIT 1.
-- Returns channel info + extracted label + confidence score.
CREATE OR REPLACE FUNCTION resolve_utm_channel(
  p_source   TEXT,
  p_medium   TEXT,
  p_campaign TEXT DEFAULT NULL
) RETURNS TABLE (
  channel_slug    TEXT,
  channel_name    TEXT,
  category        TEXT,
  extracted_label TEXT,
  confidence      FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.slug,
    cd.display_name,
    cd.category,
    CASE
      WHEN ucr.extract_label_regex IS NOT NULL
      THEN (regexp_match(p_source, ucr.extract_label_regex))[1]
      ELSE NULL
    END,
    CASE
      WHEN ucr.utm_source_pattern IS NOT NULL AND ucr.utm_medium_pattern IS NOT NULL THEN 1.0
      WHEN ucr.utm_source_pattern IS NOT NULL THEN 0.8
      WHEN ucr.utm_medium_pattern IS NOT NULL THEN 0.7
      ELSE 0.5
    END
  FROM utm_channel_rules ucr
  JOIN channel_definitions cd ON cd.id = ucr.channel_id
  WHERE
    (ucr.utm_source_pattern IS NULL OR p_source ~* ucr.utm_source_pattern)
    AND (ucr.utm_medium_pattern IS NULL OR p_medium ~* ucr.utm_medium_pattern)
    AND (ucr.utm_campaign_pattern IS NULL OR p_campaign ~* ucr.utm_campaign_pattern)
  ORDER BY ucr.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ─── seed_project_from_wp ─────────────────────────────────────────────
-- INSERT ON CONFLICT UPDATE for projects + auto-creates aliases for codename + wp_slug.
CREATE OR REPLACE FUNCTION seed_project_from_wp(
  p_codename      TEXT,
  p_display_name  TEXT,
  p_wp_job_id     INT,
  p_wp_slug       TEXT,
  p_wp_published  TIMESTAMPTZ,
  p_countries     TEXT[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_project_id UUID;
BEGIN
  INSERT INTO projects (codename, display_name, wp_job_id, wp_slug, wp_published_at, countries)
  VALUES (lower(trim(p_codename)), p_display_name, p_wp_job_id, p_wp_slug, p_wp_published, p_countries)
  ON CONFLICT (codename) DO UPDATE SET
    display_name    = EXCLUDED.display_name,
    wp_job_id       = COALESCE(EXCLUDED.wp_job_id, projects.wp_job_id),
    wp_slug         = COALESCE(EXCLUDED.wp_slug, projects.wp_slug),
    wp_published_at = COALESCE(EXCLUDED.wp_published_at, projects.wp_published_at),
    countries       = CASE WHEN array_length(EXCLUDED.countries, 1) > 0
                      THEN EXCLUDED.countries ELSE projects.countries END,
    updated_at      = NOW()
  RETURNING id INTO v_project_id;

  INSERT INTO project_aliases (project_id, alias, source, confidence)
  VALUES (v_project_id, lower(trim(p_codename)), 'wp_scan', 1.0)
  ON CONFLICT (alias) DO NOTHING;

  IF p_wp_slug IS NOT NULL THEN
    INSERT INTO project_aliases (project_id, alias, source, confidence)
    VALUES (v_project_id, lower(trim(p_wp_slug)), 'wp_scan', 0.9)
    ON CONFLICT (alias) DO NOTHING;
  END IF;

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- ─── link_intake_to_projects ──────────────────────────────────────────
-- UPDATE projects SET intake_id matching on campaign_slug.
CREATE OR REPLACE FUNCTION link_intake_to_projects()
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE projects p
  SET intake_id = ir.id, updated_at = NOW()
  FROM intake_requests ir
  WHERE lower(trim(ir.campaign_slug)) = p.codename
    AND p.intake_id IS NULL
    AND ir.campaign_slug IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ─── unclassified_channels_pending VIEW ───────────────────────────────
-- Dashboard query surface: unclassified UTM combos with suggested channel.
CREATE OR REPLACE VIEW unclassified_channels_pending AS
SELECT
  u.id,
  u.normalized_name,
  normalize_utm_display(u.raw_source) AS source_display,
  normalize_utm_display(u.raw_medium) AS medium_display,
  u.raw_source,
  u.raw_medium,
  u.raw_campaign,
  u.hit_count,
  u.first_seen_at,
  u.last_seen_at,
  p.codename AS project,
  (SELECT cd.display_name
   FROM channel_definitions cd
   JOIN utm_channel_rules ucr ON ucr.channel_id = cd.id
   WHERE u.raw_source ~* coalesce(ucr.utm_source_pattern, '.*')
   ORDER BY ucr.priority DESC LIMIT 1
  ) AS suggested_channel
FROM unclassified_utm_log u
LEFT JOIN projects p ON p.id = u.project_id
WHERE u.resolved = FALSE
ORDER BY u.hit_count DESC, u.last_seen_at DESC;

-- ─── project_daily_funnel VIEW ────────────────────────────────────────
-- UNION ALL of: paid via intake_id, paid via channel_links,
-- organic meta, organic linkedin, email brevo, organic search GSC.
CREATE OR REPLACE VIEW project_daily_funnel AS

-- PAID (via intake_id link — OneTake campaigns)
SELECT
  p.id AS project_id, p.codename, ndm.date, ndm.platform, ndm.channel,
  'paid' AS metric_type,
  ndm.impressions, ndm.clicks, ndm.spend, ndm.conversions,
  ndm.signups, ndm.profile_completes,
  NULL::INT AS reach, NULL::INT AS engagement,
  ndm.cpa, ndm.ctr, ndm.roas
FROM projects p
JOIN normalized_daily_metrics ndm ON ndm.request_id = p.intake_id
WHERE p.intake_id IS NOT NULL

UNION ALL

-- PAID (via channel_links — historical campaigns without intake_request)
SELECT
  p.id AS project_id, p.codename, ndm.date, ndm.platform, ndm.channel,
  'paid' AS metric_type,
  ndm.impressions, ndm.clicks, ndm.spend, ndm.conversions,
  ndm.signups, ndm.profile_completes,
  NULL::INT AS reach, NULL::INT AS engagement,
  ndm.cpa, ndm.ctr, ndm.roas
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id
  AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.is_paid = TRUE
JOIN normalized_daily_metrics ndm
  ON ndm.platform = split_part(cd.slug, '_', 1)
WHERE p.intake_id IS NULL

UNION ALL

-- ORGANIC: Meta (FB/IG)
SELECT
  p.id, p.codename, moc.date, moc.platform, 'organic',
  'organic',
  moc.impressions, moc.clicks, 0::NUMERIC, 0, 0, 0,
  moc.reach, moc.engagement,
  NULL::NUMERIC, NULL::FLOAT, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'meta_organic'
JOIN meta_organic_cache moc ON moc.post_id = pcl.external_id

UNION ALL

-- ORGANIC: LinkedIn
SELECT
  p.id, p.codename, loc.date, 'linkedin', 'organic',
  'organic',
  loc.impressions, loc.clicks, 0::NUMERIC, 0, 0, 0,
  loc.unique_impressions, loc.engagement,
  NULL::NUMERIC, NULL::FLOAT, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'linkedin_organic'
JOIN linkedin_organic_cache loc ON loc.post_id = pcl.external_id

UNION ALL

-- EMAIL: Brevo
SELECT
  p.id, p.codename, bcm.date, 'brevo', 'email',
  'email',
  0, bcm.clicks, 0::NUMERIC, 0, 0, 0,
  bcm.delivered, bcm.opens,
  NULL::NUMERIC, NULL::FLOAT, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'brevo_email'
JOIN brevo_campaign_metrics bcm ON bcm.campaign_id::TEXT = pcl.external_id

UNION ALL

-- ORGANIC SEARCH: GSC
SELECT
  p.id, p.codename, gsc.date, 'google', 'organic_search',
  'organic',
  gsc.impressions, gsc.clicks, 0::NUMERIC, 0, 0, 0,
  NULL::INT, NULL::INT,
  NULL::NUMERIC, gsc.ctr, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'organic_search'
JOIN gsc_daily_cache gsc ON gsc.page LIKE pcl.external_id;

-- ─── project_weekly_summary MATERIALIZED VIEW ─────────────────────────
-- Aggregates project_daily_funnel by week with paid/organic/email breakdowns.
-- Drop first for idempotency since CREATE MATERIALIZED VIEW IF NOT EXISTS
-- is not supported. Use DO block to handle the case where it already exists.
DO $$ BEGIN
  EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS project_weekly_summary';
END $$;

CREATE MATERIALIZED VIEW project_weekly_summary AS
SELECT
  project_id, codename,
  date_trunc('week', date)::DATE AS week_start,

  -- Funnel totals
  SUM(impressions)       AS total_impressions,
  SUM(clicks)            AS total_clicks,
  SUM(spend)             AS total_spend,
  SUM(conversions)       AS total_conversions,
  SUM(reach)             AS total_reach,
  SUM(engagement)        AS total_engagement,

  -- Per-type breakdown
  SUM(CASE WHEN metric_type = 'paid' THEN spend ELSE 0 END)       AS paid_spend,
  SUM(CASE WHEN metric_type = 'paid' THEN clicks ELSE 0 END)      AS paid_clicks,
  SUM(CASE WHEN metric_type = 'paid' THEN conversions ELSE 0 END) AS paid_conversions,
  SUM(CASE WHEN metric_type = 'organic' THEN clicks ELSE 0 END)   AS organic_clicks,
  SUM(CASE WHEN metric_type = 'email' THEN clicks ELSE 0 END)     AS email_clicks,

  -- Computed metrics
  CASE WHEN SUM(clicks) > 0
    THEN SUM(conversions)::FLOAT / SUM(clicks)
    ELSE 0 END AS conversion_rate,
  CASE WHEN SUM(conversions) > 0
    THEN SUM(spend) / SUM(conversions)
    ELSE NULL END AS blended_cpa,

  COUNT(DISTINCT channel) AS active_channels

FROM project_daily_funnel
GROUP BY project_id, codename, date_trunc('week', date)::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_weekly_pk
  ON project_weekly_summary(project_id, week_start);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION (run after migration)
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT count(*) FROM channel_definitions;  -- should be 20
-- SELECT count(*) FROM utm_channel_rules;    -- should be 16
-- SELECT * FROM resolve_utm_channel('flyer_seattle', 'cpc');
-- SELECT normalize_utm_display('recruiter_ahmed_rafiq');
-- SELECT * FROM unclassified_channels_pending LIMIT 5;
