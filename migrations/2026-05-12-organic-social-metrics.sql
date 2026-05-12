-- migrations/2026-05-12-organic-social-metrics.sql
-- Organic Social Metrics — 6 tables + unified channel_performance VIEW

-- 36. meta_organic_cache — post-level Facebook/Instagram organic metrics
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
);

CREATE INDEX IF NOT EXISTS idx_meta_organic_page ON meta_organic_cache(page_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_organic_date ON meta_organic_cache(date DESC);

DO $$ BEGIN
  ALTER TABLE meta_organic_cache ADD CONSTRAINT meta_organic_cache_uq
    UNIQUE(page_id, post_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 37. linkedin_organic_cache — post-level LinkedIn organization metrics
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
);

CREATE INDEX IF NOT EXISTS idx_linkedin_organic_org ON linkedin_organic_cache(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_organic_date ON linkedin_organic_cache(date DESC);

DO $$ BEGIN
  ALTER TABLE linkedin_organic_cache ADD CONSTRAINT linkedin_organic_cache_uq
    UNIQUE(org_id, post_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 38. reddit_organic_cache — Reddit post metrics
CREATE TABLE IF NOT EXISTS reddit_organic_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL,
  post_id       TEXT NOT NULL,
  subreddit     TEXT NOT NULL,
  post_type     TEXT,
  post_url      TEXT,
  post_title    TEXT,
  post_text     TEXT,
  published_at  TIMESTAMPTZ,
  upvotes       INT NOT NULL DEFAULT 0,
  downvotes     INT NOT NULL DEFAULT 0,
  score         INT NOT NULL DEFAULT 0,
  comments      INT NOT NULL DEFAULT 0,
  upvote_ratio  FLOAT,
  crossposts    INT NOT NULL DEFAULT 0,
  awards        INT NOT NULL DEFAULT 0,
  raw_data      JSONB NOT NULL DEFAULT '{}',
  date          DATE NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reddit_organic_username ON reddit_organic_cache(username, date DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_organic_date ON reddit_organic_cache(date DESC);

DO $$ BEGIN
  ALTER TABLE reddit_organic_cache ADD CONSTRAINT reddit_organic_cache_uq
    UNIQUE(username, post_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 39. gsc_daily_cache — Google Search Console query-level data
CREATE TABLE IF NOT EXISTS gsc_daily_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_url  TEXT NOT NULL,
  query         TEXT NOT NULL,
  page          TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT '',
  device        TEXT NOT NULL DEFAULT '',
  clicks        INT NOT NULL DEFAULT 0,
  impressions   INT NOT NULL DEFAULT 0,
  ctr           FLOAT,
  position      FLOAT,
  date          DATE NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsc_property ON gsc_daily_cache(property_url, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_date ON gsc_daily_cache(date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_query ON gsc_daily_cache(query, date DESC);

DO $$ BEGIN
  ALTER TABLE gsc_daily_cache ADD CONSTRAINT gsc_daily_cache_uq
    UNIQUE(property_url, query, page, country, device, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 40. social_account_snapshots — daily account-level rollup across platforms
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
);

CREATE INDEX IF NOT EXISTS idx_social_snapshots_account ON social_account_snapshots(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_social_snapshots_date ON social_account_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_social_snapshots_platform ON social_account_snapshots(platform, date DESC);

DO $$ BEGIN
  ALTER TABLE social_account_snapshots ADD CONSTRAINT social_account_snapshots_uq
    UNIQUE(platform, account_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 41. organic_post_assets — attribution bridge: organic post ↔ generated assets
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
);

CREATE INDEX IF NOT EXISTS idx_organic_post_assets_asset ON organic_post_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_organic_post_assets_request ON organic_post_assets(request_id);

DO $$ BEGIN
  ALTER TABLE organic_post_assets ADD CONSTRAINT organic_post_assets_uq
    UNIQUE(platform, post_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- channel_performance_unified VIEW — union of paid + organic metrics
CREATE OR REPLACE VIEW channel_performance_unified AS
  -- Paid: normalized_daily_metrics
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

  -- Organic: Meta (FB/IG) aggregated by page + date
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

  -- Organic: LinkedIn aggregated by org + date
  SELECT
    date,
    'linkedin'    AS platform,
    'organic'     AS channel,
    'organic'     AS metric_type,
    SUM(impressions)::INT     AS impressions,
    SUM(clicks)::INT          AS clicks,
    0.0                       AS spend,
    0                         AS conversions,
    SUM(unique_impressions)::INT AS reach,
    SUM(engagement)::INT      AS engagement,
    SUM(likes)::INT           AS likes,
    SUM(shares)::INT          AS shares,
    NULL::INT                 AS saves,
    AVG(engagement_rate)      AS engagement_rate
  FROM linkedin_organic_cache
  GROUP BY date

  UNION ALL

  -- Organic: Reddit aggregated by date
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
    SUM(upvotes)::INT AS likes,
    SUM(crossposts)::INT AS shares,
    NULL::INT     AS saves,
    AVG(upvote_ratio) AS engagement_rate
  FROM reddit_organic_cache
  GROUP BY date;
