-- migrations/2026-05-20-organic-ga4-flow.sql
-- Wire GA4 organic source data into the funnel pipeline.
--
-- The ga4_project_funnel table already has organic source rows
-- (medium != 'paid'), but they weren't flowing into project_daily_funnel
-- because the organic branches depended on empty cache tables.
--
-- This migration:
-- 1. Creates ga4_organic_weekly to hold time-distributed organic data
-- 2. Populates it from ga4_project_funnel (distributes totals across last 4 weeks)
-- 3. Rebuilds project_daily_funnel view to include GA4 organic data
-- 4. Refreshes the materialized view

BEGIN;

-- ─── Step 1: Create staging table for GA4 organic data ────────────
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

-- ─── Step 2: Populate from GA4 funnel (distribute across 4 weeks) ─
-- Clear and re-populate for idempotency
DELETE FROM ga4_organic_weekly;

INSERT INTO ga4_organic_weekly (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
SELECT
  g.project_id,
  p.codename,
  ws.week_start,
  g.source,
  g.medium,
  CASE
    WHEN g.source IN ('facebook', 'instagram', 'fb', 'ig') AND g.medium != 'paid' THEN 'meta_organic'
    WHEN g.source = 'linkedin' AND g.medium != 'paid' THEN 'linkedin_organic'
    WHEN g.source IN ('reddit', 'twitter', 'x') THEN 'reddit_organic'
    WHEN g.source IN ('social') THEN 'social_referral'
    WHEN g.source = 'email' THEN 'email'
    WHEN g.source = 'job_board' THEN 'job_board'
    WHEN g.source = 'recruiter' THEN 'recruiter'
    WHEN g.source = 'direct' THEN 'direct'
    ELSE g.source
  END,
  'organic',
  -- Distribute wp_entry across 4 weeks (most recent week gets the most)
  CASE
    WHEN ws.week_num = 1 THEN GREATEST(ROUND(g.wp_entry * 0.35), 0)
    WHEN ws.week_num = 2 THEN GREATEST(ROUND(g.wp_entry * 0.30), 0)
    WHEN ws.week_num = 3 THEN GREATEST(ROUND(g.wp_entry * 0.20), 0)
    WHEN ws.week_num = 4 THEN GREATEST(ROUND(g.wp_entry * 0.15), 0)
    ELSE 0
  END,
  -- Distribute profile_created across weeks (proxy for conversions from organic)
  CASE
    WHEN ws.week_num = 1 THEN GREATEST(ROUND(g.profile_created * 0.35), 0)
    WHEN ws.week_num = 2 THEN GREATEST(ROUND(g.profile_created * 0.30), 0)
    WHEN ws.week_num = 3 THEN GREATEST(ROUND(g.profile_created * 0.20), 0)
    WHEN ws.week_num = 4 THEN GREATEST(ROUND(g.profile_created * 0.15), 0)
    ELSE 0
  END
FROM ga4_project_funnel g
JOIN projects p ON p.id = g.project_id
CROSS JOIN (
  SELECT 1 AS week_num, date_trunc('week', CURRENT_DATE)::DATE AS week_start
  UNION ALL SELECT 2, (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::DATE
  UNION ALL SELECT 3, (date_trunc('week', CURRENT_DATE) - INTERVAL '14 days')::DATE
  UNION ALL SELECT 4, (date_trunc('week', CURRENT_DATE) - INTERVAL '21 days')::DATE
) ws
WHERE g.medium != 'paid'
ON CONFLICT (project_id, week_start, source, medium) DO UPDATE SET
  clicks = EXCLUDED.clicks,
  conversions = EXCLUDED.conversions,
  channel = EXCLUDED.channel;

-- ─── Step 3: Rebuild project_daily_funnel view with GA4 organic ───
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

-- PAID (via channel_links — match NDM channel name to link external_id)
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
  ON ndm.channel = pcl.external_id
WHERE p.intake_id IS NULL

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

-- ─── Step 4: Refresh materialized view to pick up organic data ────
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
