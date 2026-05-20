-- migrations/2026-05-20-fix-data-pipeline.sql
-- Comprehensive fix: create missing tables, link NDM to projects, rebuild views.
--
-- Problems fixed:
-- 1. ga4_project_funnel table missing → GA4 endpoint 500s
-- 2. ga4_organic_weekly table missing → organic share = 0%
-- 3. project_locale_links table missing → locale data missing
-- 4. page_display_names table missing → page normalizer broken
-- 5. NDM has no project_id → paid funnel returns empty
-- 6. Campaign names don't match external_id → channel link JOIN broken
--
-- Safe to run multiple times (all operations are idempotent).

-- ═══════════════════════════════════════════════════════════════
-- PART 1: Create missing tables
-- ═══════════════════════════════════════════════════════════════
BEGIN;

-- ─── ga4_project_funnel ──────────────────────────────────────
-- Holds per-source/medium GA4 acquisition funnel data per project
CREATE TABLE IF NOT EXISTS ga4_project_funnel (
  id              SERIAL PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_name   TEXT,
  source          TEXT NOT NULL DEFAULT '(not set)',
  medium          TEXT NOT NULL DEFAULT '(not set)',
  wp_entry        INT DEFAULT 0,
  apply_click     INT DEFAULT 0,
  signup          INT DEFAULT 0,
  mfa_setup       INT DEFAULT 0,
  profile_created INT DEFAULT 0,
  nda_signed      INT DEFAULT 0,
  certification   INT DEFAULT 0,
  browsing_jobs   INT DEFAULT 0,
  doing_tasks     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, source, medium)
);

-- ─── ga4_organic_weekly ──────────────────────────────────────
-- Time-distributed organic data from GA4 funnel
CREATE TABLE IF NOT EXISTS ga4_organic_weekly (
  id            SERIAL PRIMARY KEY,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  codename      TEXT NOT NULL,
  week_start    DATE NOT NULL,
  source        TEXT NOT NULL,
  medium        TEXT NOT NULL,
  channel       TEXT NOT NULL,
  metric_type   TEXT NOT NULL DEFAULT 'organic',
  impressions   INT DEFAULT 0,
  clicks        INT DEFAULT 0,
  spend         NUMERIC(12,2) DEFAULT 0,
  conversions   INT DEFAULT 0,
  reach         INT DEFAULT 0,
  engagement    INT DEFAULT 0,
  UNIQUE(project_id, week_start, source, medium)
);

-- ─── project_locale_links ────────────────────────────────────
-- Per-language apply URLs + platform request IDs from WP ACF fields
CREATE TABLE IF NOT EXISTS project_locale_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language              TEXT NOT NULL,
  apply_url             TEXT,
  platform_request_id   TEXT,
  is_active             BOOLEAN DEFAULT TRUE,
  first_seen_at         TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, language)
);

CREATE INDEX IF NOT EXISTS idx_locale_links_project ON project_locale_links(project_id);

-- ─── page_display_names ──────────────────────────────────────
-- Human-readable names for GA4 page paths
CREATE TABLE IF NOT EXISTS page_display_names (
  id              SERIAL PRIMARY KEY,
  page_path       TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  category        TEXT,
  project_codename TEXT
);

-- ─── normalize_page_path function ────────────────────────────
CREATE OR REPLACE FUNCTION normalize_page_path(p_path TEXT)
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- 1. Lookup table first
  SELECT display_name INTO v_name FROM page_display_names WHERE page_path = p_path;
  IF v_name IS NOT NULL THEN RETURN v_name; END IF;

  -- 2. Pattern matching
  IF p_path LIKE '/join/%' THEN
    RETURN 'LP: ' || initcap(replace(split_part(p_path, '/', 3), '-', ' '));
  END IF;
  IF p_path LIKE '/jobs/%' THEN
    RETURN 'Job Page: ' || initcap(replace(split_part(p_path, '/', 3), '-', ' '));
  END IF;
  IF p_path LIKE '/crowd/jobs/%' THEN
    RETURN 'Platform Job #' || split_part(p_path, '/', 4);
  END IF;

  -- 3. Fallback: clean up path
  RETURN initcap(replace(replace(trim(both '/' from p_path), '/', ' > '), '-', ' '));
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- PART 2: Fix NDM → Project linkage
-- ═══════════════════════════════════════════════════════════════
BEGIN;

-- Add project_id column to normalized_daily_metrics if it doesn't exist
DO $$ BEGIN
  ALTER TABLE normalized_daily_metrics ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ndm_project_id ON normalized_daily_metrics(project_id);

-- Clear and re-populate project_id via campaign name → project mapping
-- Uses explicit mapping for known campaigns + fuzzy codename match as fallback
UPDATE normalized_daily_metrics SET project_id = NULL;

-- Explicit campaign-to-project mapping (handles tricky names)
WITH campaign_map(campaign_pattern, codename) AS (VALUES
  ('Centaurus%',                'centaurus'),
  ('Hummus%',                   'humus'),
  ('Milky Way%',                'milky_way'),
  ('Lumina%',                   'lumina'),
  ('Andromeda%',                'andromeda'),
  ('Fred%',                     'fred'),
  ('Jellyfish%',                'jellyfish'),
  ('Fur Frame%',                'fur_frame'),
  ('Lighthouse%',               'lighthouse_3'),
  ('Rebuilt LightHouse%',       'lighthouse_3'),
  ('AMP%',                      'amp'),
  ('Amber%',                    'amber_imageannotator'),
  ('Onyx%',                     'onyx'),
  ('ONYX%',                     'onyx'),
  ('Cosmos%',                   'cosmos'),
  ('Cochera%',                  'cochera'),
  ('Casas%',                    'casas'),
  ('Nighthawk%',                'nighthawk'),
  ('Nora%',                     'nora'),
  ('Sugar%',                    'sugar'),
  ('Vega%',                     'vega'),
  ('Nexa%',                     'nexa'),
  ('Adloc%',                    'adloc'),
  ('Kilo%',                     'kilo'),
  ('Mosaic%',                   'mosaic'),
  ('Motto%',                    'motto'),
  ('reddit_promoted',           'humus')
)
UPDATE normalized_daily_metrics ndm
SET project_id = p.id
FROM campaign_map cm
JOIN projects p ON p.codename = cm.codename
WHERE ndm.channel LIKE cm.campaign_pattern
  AND ndm.project_id IS NULL;

-- Fallback: fuzzy match on codename (handles underscores → spaces)
UPDATE normalized_daily_metrics ndm
SET project_id = p.id
FROM projects p
WHERE ndm.project_id IS NULL
  AND lower(ndm.channel) LIKE '%' || replace(lower(p.codename), '_', ' ') || '%';

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- PART 3: Rebuild project_daily_funnel view (now uses project_id on NDM)
-- ═══════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE VIEW project_daily_funnel AS

-- PAID: NDM rows with project_id set (direct link, no JOIN needed)
SELECT
  ndm.project_id, p.codename, ndm.date, ndm.platform, ndm.channel,
  'paid' AS metric_type,
  ndm.impressions, ndm.clicks, ndm.spend, ndm.conversions,
  ndm.signups, ndm.profile_completes,
  NULL::INT AS reach, NULL::INT AS engagement,
  ndm.cpa, ndm.ctr, ndm.roas
FROM normalized_daily_metrics ndm
JOIN projects p ON p.id = ndm.project_id
WHERE ndm.project_id IS NOT NULL

UNION ALL

-- ORGANIC: from GA4 funnel data (distributed across recent weeks)
SELECT
  gow.project_id, gow.codename, gow.week_start AS date,
  gow.source AS platform, gow.channel,
  'organic' AS metric_type,
  gow.impressions, gow.clicks, gow.spend, gow.conversions,
  0 AS signups, 0 AS profile_completes,
  gow.reach, gow.engagement,
  NULL::NUMERIC AS cpa, NULL::FLOAT AS ctr, NULL::FLOAT AS roas
FROM ga4_organic_weekly gow

UNION ALL

-- ORGANIC: Meta (FB/IG) — from cache if populated
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

-- ORGANIC: LinkedIn — from cache if populated
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

-- ─── Rebuild materialized view ───────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS project_weekly_summary';
END $$;

CREATE MATERIALIZED VIEW project_weekly_summary AS
SELECT
  project_id, codename,
  date_trunc('week', date)::DATE AS week_start,
  SUM(impressions)       AS total_impressions,
  SUM(clicks)            AS total_clicks,
  SUM(spend)             AS total_spend,
  SUM(conversions)       AS total_conversions,
  SUM(reach)             AS total_reach,
  SUM(engagement)        AS total_engagement,
  SUM(CASE WHEN metric_type = 'paid' THEN spend ELSE 0 END)       AS paid_spend,
  SUM(CASE WHEN metric_type = 'paid' THEN clicks ELSE 0 END)      AS paid_clicks,
  SUM(CASE WHEN metric_type = 'paid' THEN conversions ELSE 0 END) AS paid_conversions,
  SUM(CASE WHEN metric_type = 'organic' THEN clicks ELSE 0 END)   AS organic_clicks,
  SUM(CASE WHEN metric_type = 'email' THEN clicks ELSE 0 END)     AS email_clicks,
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

-- ═══════════════════════════════════════════════════════════════
-- PART 4: Seed page_display_names
-- ═══════════════════════════════════════════════════════════════
INSERT INTO page_display_names (page_path, display_name, category, project_codename) VALUES
  ('/', 'Homepage', 'site', NULL),
  ('/center/login', 'Login Page', 'auth', NULL),
  ('/center/signup', 'Account Signup', 'auth', NULL),
  ('/crowd/nda', 'NDA Agreement', 'onboarding', NULL),
  ('/crowd/profile', 'Worker Profile', 'onboarding', NULL),
  ('/webapp/dataCollection/login', 'Data Collection Login', 'platform', NULL),
  ('/jobs', 'All Job Listings', 'jobs', NULL),
  ('/crowd/jobs', 'Platform Job Board', 'platform', NULL),
  ('/MAPS/Evaluation-Guideline/index.html', 'Milky Way LP', 'lp', 'milky_way')
ON CONFLICT (page_path) DO NOTHING;
