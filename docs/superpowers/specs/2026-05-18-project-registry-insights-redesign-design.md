# Project Registry & Insights Redesign — Design Spec

**Date:** 2026-05-18
**Author:** Steven Junop
**Status:** Approved (brainstorm complete)
**Target DB:** Azure PG (`onetake-pg-west01.postgres.database.azure.com`)

---

## Problem

Current insights dashboards are widget grids showing raw data. They don't tell a story. The SVP responded "Good work here — helpful insights" to a plain-English Meta weekly email because it had:

1. Emotional hook + headline numbers
2. WoW comparison with % changes and color-coded trends
3. Narrative explaining what's working and why
4. Actionable recommendations (INCREASE/HOLD/PAUSE/FIX)
5. Proactive win/flag callouts

The dashboards need to replicate that style. But first, the data model has a fundamental gap: **there is no canonical project identity that ties all channels together.** Paid campaigns live in `meta_ads_cache`, organic posts in `linkedin_organic_cache`, email blasts in `brevo_campaign_metrics`, flyer QR scans in UTM touchpoints, recruiter links in `attribution_touchpoints` — all disconnected.

Additionally:
- Not all jobs have paid campaigns — some are organic-only (LinkedIn posts, recruiter links, flyers, job boards)
- Some organic LinkedIn posts link directly to `myoneforma.com`, bypassing the marketing site
- Cross-domain tracking exists (same GTM container), but the prod DB link to GA4 sessions is TBD
- UTM sources include bizarre non-standard values: flyers, influencers, individual recruiters, various job boards
- Historical data must be surfaced retroactively — all jobs have WP posts but the link to analytics data was never formalized

## Approach: Project Registry + Fuzzy Linker

A `projects` table becomes the canonical source of truth. Every WordPress job post gets a row. A fuzzy matching engine (pg_trgm) scans all existing data sources and proposes codename-based links. High-confidence matches auto-confirm; low-confidence matches surface for human review. A dynamic channel registry handles arbitrary UTM patterns without schema migrations.

---

## Section 1: Core Project Registry

### projects table

The canonical project identity. Every job that exists on WordPress gets a row here, whether or not it has paid campaigns, OneTake intake records, or any data at all yet.

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codename        TEXT NOT NULL UNIQUE,       -- 'centaurus', 'humus', 'kilo'
  display_name    TEXT NOT NULL,              -- 'Centaurus — MFA Data Annotation'
  wp_job_id       INT,                        -- WordPress post ID
  wp_slug         TEXT,                       -- 'data-annotation-specialist-centaurus'
  wp_published_at TIMESTAMPTZ,
  intake_id       UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','completed','archived')),
  countries       TEXT[],                     -- ['US','DE','PH']
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### project_aliases table

Codename variants for fuzzy matching. `'humus'`, `'hummus'`, `'humus-twins'`, `'humus-siblings'` all resolve to project `'humus'`.

```sql
CREATE TABLE project_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual','fuzzy_match','utm_scan','wp_scan')),
  confidence  FLOAT DEFAULT 1.0,             -- 1.0 = confirmed, <1.0 = suggested
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias)
);

CREATE INDEX idx_project_aliases_alias ON project_aliases USING gin (alias gin_trgm_ops);
```

---

## Section 2: Dynamic Channel Registry & Linking

### channel_definitions table

Add new channels without migrations. Covers paid, organic, email, physical (flyers/QR), recruiter, influencer, job boards, and anything else that shows up.

```sql
CREATE TABLE channel_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,           -- 'meta_paid', 'flyer', 'recruiter', 'indeed'
  display_name  TEXT NOT NULL,                  -- 'Physical Flyers', 'Recruiter Direct'
  category      TEXT NOT NULL CHECK (category IN (
    'paid_social','paid_search','organic_social','organic_search',
    'email','job_board','physical','recruiter','influencer','referral','direct','other'
  )),
  icon          TEXT,                           -- for dashboard UI
  is_paid       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Seed data:**

| slug | display_name | category | is_paid |
|---|---|---|---|
| meta_paid | Meta Ads | paid_social | true |
| reddit_paid | Reddit Ads | paid_social | true |
| google_paid | Google Ads | paid_search | true |
| tiktok_paid | TikTok Ads | paid_social | true |
| linkedin_paid | LinkedIn Ads | paid_social | true |
| meta_organic | Meta Organic | organic_social | false |
| linkedin_organic | LinkedIn Organic | organic_social | false |
| reddit_organic | Reddit Organic | organic_social | false |
| brevo_email | Brevo Email | email | false |
| organic_search | Organic Search | organic_search | false |
| flyer | Physical Flyers | physical | false |
| qr_poster | QR Posters | physical | false |
| recruiter | Recruiter Direct | recruiter | false |
| influencer | Influencer | influencer | true |
| indeed | Indeed | job_board | false |
| glassdoor | Glassdoor | job_board | false |
| linkedin_jobs | LinkedIn Jobs | job_board | false |
| monster | Monster | job_board | false |
| referral | Employee Referral | referral | false |
| direct | Direct Traffic | direct | false |

### utm_channel_rules table

The "decoder ring" for bizarre UTMs. Maps raw UTM patterns to channel definitions using regex, with priority-based resolution when multiple rules match.

```sql
CREATE TABLE utm_channel_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES channel_definitions(id) ON DELETE CASCADE,
  utm_source_pattern    TEXT,    -- regex: '^flyer', '^recruiter_'
  utm_medium_pattern    TEXT,    -- regex: '^qr$', '^cpc$'
  utm_campaign_pattern  TEXT,    -- optional further filter
  priority      INT NOT NULL DEFAULT 0,
  extract_label_regex   TEXT,    -- capture group: 'flyer_(.+)' → 'seattle'
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_utm_rules_source ON utm_channel_rules(utm_source_pattern);
CREATE INDEX idx_utm_rules_medium ON utm_channel_rules(utm_medium_pattern);
```

**Seed rules:**

| channel | source pattern | medium pattern | extract regex | priority | notes |
|---|---|---|---|---|---|
| flyer | `^flyer` | — | `flyer_(.+)` | 10 | Physical flyer with city suffix |
| qr_poster | — | `^qr$` | — | 10 | Any source with medium=qr |
| recruiter | `^recruiter_` | — | `recruiter_(.+)` | 10 | Individual recruiter links |
| recruiter | — | `^recruiter$` | — | 5 | Fallback: medium=recruiter |
| influencer | `^influencer_` | — | `influencer_(.+)` | 10 | Named influencer |
| influencer | — | `^influencer$` | — | 5 | Fallback: medium=influencer |
| indeed | `^indeed` | — | — | 10 | Indeed organic or sponsored |
| glassdoor | `^glassdoor` | — | — | 10 | — |
| linkedin_jobs | `^linkedin_jobs` | — | — | 10 | LinkedIn Jobs (not ads) |
| linkedin_jobs | `^linkedin` | `^job` | — | 8 | linkedin + medium containing job |
| meta_paid | `^(facebook\|fb\|instagram\|ig\|meta)$` | `^(cpc\|paid\|paidsocial)$` | — | 5 | — |
| reddit_paid | `^reddit$` | `^(cpc\|paid)$` | — | 5 | — |
| google_paid | `^google$` | `^(cpc\|ppc\|paid)$` | — | 5 | — |
| meta_organic | `^(facebook\|fb\|instagram\|ig)$` | `^(social\|organic\|post)$` | — | 5 | — |
| linkedin_organic | `^linkedin$` | `^(social\|organic\|post)$` | — | 5 | — |
| brevo_email | `^(brevo\|sendinblue\|email)$` | — | — | 5 | — |

### project_channel_links table

Each row = "this data source belongs to this project." Uses dynamic `channel_id` FK instead of hardcoded enum.

```sql
CREATE TABLE project_channel_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel_id    UUID NOT NULL REFERENCES channel_definitions(id),
  external_id   TEXT NOT NULL,        -- campaign_id, post_id, utm pattern, URL pattern
  external_name TEXT,                 -- human-readable label from the source
  extracted_label TEXT,               -- 'seattle' from flyer_seattle, 'jane_smith' from recruiter_jane
  match_method  TEXT NOT NULL DEFAULT 'manual'
                CHECK (match_method IN ('manual','fuzzy','exact','regex')),
  confidence    FLOAT DEFAULT 1.0,
  confirmed_at  TIMESTAMPTZ,          -- NULL = unconfirmed suggestion
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, external_id)
);

CREATE INDEX idx_channel_links_project ON project_channel_links(project_id);
CREATE INDEX idx_channel_links_channel ON project_channel_links(channel_id, external_id);
```

### resolve_utm_channel function

Given a UTM set, returns which channel it belongs to via the rules engine.

```sql
CREATE OR REPLACE FUNCTION resolve_utm_channel(
  p_source TEXT,
  p_medium TEXT,
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
```

---

## Section 3: Unclassified UTM Handling

When a UTM combo doesn't match any rule, it must land in a visible inbox with a **real normalized name** — never just "unknown."

### normalize_utm_display function

Turns raw garbage UTMs into human-readable names.

```sql
CREATE OR REPLACE FUNCTION normalize_utm_display(raw_value TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN initcap(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(raw_value, 'direct')),
          '[_\-]+', ' ', 'g'              -- underscores & hyphens → spaces
        ),
        '^(utm|src|ref|campaign|source)\s+', '', 'i'  -- strip noise prefixes
      ),
      '\s+', ' ', 'g'                     -- collapse multiple spaces
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Examples:**

| Raw UTM | Normalized |
|---|---|
| `recruiter_jane_smith` | Recruiter Jane Smith |
| `flyer_seattle_waterfront` | Flyer Seattle Waterfront |
| `indeed_sponsored_2026` | Indeed Sponsored 2026 |
| `influencer_tiktok_sarah_m` | Influencer Tiktok Sarah M |
| `glassdoor-premium-listing` | Glassdoor Premium Listing |
| `qr_poster_manila_office` | Qr Poster Manila Office |
| `NULL` | Direct |

### unclassified_utm_log table

The inbox for new channels. Surfaces real normalized names + hit counts for quick resolution.

```sql
CREATE TABLE unclassified_utm_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  raw_source      TEXT,
  raw_medium      TEXT,
  raw_campaign    TEXT,
  normalized_name TEXT NOT NULL,    -- cleaned display name, NEVER 'unknown'
  hit_count       INT NOT NULL DEFAULT 1,
  first_seen_at   DATE NOT NULL,
  last_seen_at    DATE NOT NULL,
  resolved        BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_to     UUID REFERENCES channel_definitions(id),
  resolved_at     TIMESTAMPTZ,
  UNIQUE(raw_source, raw_medium, raw_campaign)
);

CREATE INDEX idx_unclassified_unresolved
  ON unclassified_utm_log(resolved, hit_count DESC)
  WHERE resolved = FALSE;
```

### unclassified_channels_pending view

What the dashboard queries to show the unclassified inbox.

```sql
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
```

**Dashboard display:**

```
┌─────────────────────────────────────────────────────────────┐
│  3 Unclassified Sources (47 sessions)                       │
├──────────────────────────┬────────┬──────┬──────────────────┤
│ Name                     │ Hits   │ Proj │ Suggested Match  │
├──────────────────────────┼────────┼──────┼──────────────────┤
│ Recruiter Ahmed Rafiq    │ 28     │ kilo │ Recruiter Direct │
│ Flyer Dubai Mall         │ 14     │ kilo │ Physical Flyers  │
│ Jobberman Premium        │  5     │ humus│ —                │
└──────────────────────────┴────────┴──────┴──────────────────┘
              [ Assign Channel ]    [ Create New Channel ]
```

One click to assign → adds rule to `utm_channel_rules` → marks resolved → retroactively classifies all past and future hits. "Create New Channel" adds a `channel_definitions` row first, then assigns.

---

## Section 4: Unified Project Funnel View

### project_daily_funnel view

Single query surface that powers the narrative dashboard. One project → all channels → one funnel.

```sql
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
```

### project_weekly_summary materialized view

The data layer behind the narrative-style dashboard. Precomputes WoW comparisons, channel mix, and blended metrics.

```sql
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

CREATE UNIQUE INDEX idx_project_weekly_pk
  ON project_weekly_summary(project_id, week_start);
```

**Refresh:** `REFRESH MATERIALIZED VIEW CONCURRENTLY project_weekly_summary;` — nightly via cron or on-demand after sync.

**Dashboard consumption:** Frontend queries current week + previous week, computes WoW deltas, feeds them into the NIM narrative layer to produce plain-English summaries with INCREASE/HOLD/PAUSE/FIX recommendations per channel per project.

---

## Section 5: Retroactive Seeding Process

The bootstrap sequence that populates the project registry from existing data and runs the fuzzy linker.

### Step 1: seed_project_from_wp

Called by a Python script that pulls all jobs from WP REST API.

```sql
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
```

### Step 2: discover_aliases

Scans all existing campaign names, UTM values, and Brevo names. Fuzzy-matches them against known projects to discover alias variants.

```sql
CREATE OR REPLACE FUNCTION discover_aliases(p_min_similarity FLOAT DEFAULT 0.35)
RETURNS TABLE (
  project_id    UUID,
  codename      TEXT,
  discovered    TEXT,
  source_table  TEXT,
  similarity    FLOAT
) AS $$
BEGIN
  RETURN QUERY

  -- utm_campaign values from attribution_touchpoints
  SELECT DISTINCT p.id, p.codename, lower(at.utm_campaign),
    'attribution_touchpoints'::TEXT,
    greatest(
      similarity(lower(at.utm_campaign), p.codename),
      (SELECT max(similarity(lower(at.utm_campaign), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    )
  FROM attribution_touchpoints at CROSS JOIN projects p
  WHERE at.utm_campaign IS NOT NULL AND at.utm_campaign != ''
    AND NOT EXISTS (SELECT 1 FROM project_aliases pa WHERE pa.alias = lower(at.utm_campaign))
    AND greatest(
      similarity(lower(at.utm_campaign), p.codename),
      (SELECT max(similarity(lower(at.utm_campaign), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    ) >= p_min_similarity

  UNION ALL

  -- meta campaign names
  SELECT DISTINCT p.id, p.codename, lower(mac.campaign_name),
    'meta_ads_cache'::TEXT,
    greatest(
      similarity(lower(mac.campaign_name), p.codename),
      (SELECT max(similarity(lower(mac.campaign_name), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    )
  FROM meta_ads_cache mac CROSS JOIN projects p
  WHERE mac.campaign_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM project_aliases pa WHERE pa.alias = lower(mac.campaign_name))
    AND greatest(
      similarity(lower(mac.campaign_name), p.codename),
      (SELECT max(similarity(lower(mac.campaign_name), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    ) >= p_min_similarity

  UNION ALL

  -- brevo campaign names
  SELECT DISTINCT p.id, p.codename, lower(bcm.campaign_name),
    'brevo_campaign_metrics'::TEXT,
    greatest(
      similarity(lower(bcm.campaign_name), p.codename),
      (SELECT max(similarity(lower(bcm.campaign_name), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    )
  FROM brevo_campaign_metrics bcm CROSS JOIN projects p
  WHERE bcm.campaign_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM project_aliases pa WHERE pa.alias = lower(bcm.campaign_name))
    AND greatest(
      similarity(lower(bcm.campaign_name), p.codename),
      (SELECT max(similarity(lower(bcm.campaign_name), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    ) >= p_min_similarity

  UNION ALL

  -- reddit campaign names
  SELECT DISTINCT p.id, p.codename, lower(rac.campaign_name),
    'reddit_ads_cache'::TEXT,
    greatest(
      similarity(lower(rac.campaign_name), p.codename),
      (SELECT max(similarity(lower(rac.campaign_name), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    )
  FROM reddit_ads_cache rac CROSS JOIN projects p
  WHERE rac.campaign_name IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM project_aliases pa WHERE pa.alias = lower(rac.campaign_name))
    AND greatest(
      similarity(lower(rac.campaign_name), p.codename),
      (SELECT max(similarity(lower(rac.campaign_name), pa.alias))
       FROM project_aliases pa WHERE pa.project_id = p.id)
    ) >= p_min_similarity

  ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql;
```

### Step 3: suggest_channel_links

Finds unlinked campaigns that fuzzy-match a project alias. Used by the auto-linker.

```sql
CREATE OR REPLACE FUNCTION suggest_channel_links(min_similarity FLOAT DEFAULT 0.3)
RETURNS TABLE (
  project_id    UUID,
  codename      TEXT,
  channel_type  TEXT,
  external_id   TEXT,
  external_name TEXT,
  similarity    FLOAT
) AS $$
BEGIN
  RETURN QUERY

  SELECT p.id, p.codename, 'meta_paid'::TEXT,
    mac.campaign_id, mac.campaign_name,
    greatest(
      similarity(lower(mac.campaign_name), lower(pa.alias)),
      similarity(lower(mac.campaign_name), lower(p.codename))
    )
  FROM meta_ads_cache mac
  CROSS JOIN projects p
  LEFT JOIN project_aliases pa ON pa.project_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM project_channel_links pcl
    JOIN channel_definitions cd ON cd.id = pcl.channel_id
    WHERE cd.slug = 'meta_paid' AND pcl.external_id = mac.campaign_id
  )
  AND greatest(
    similarity(lower(mac.campaign_name), lower(pa.alias)),
    similarity(lower(mac.campaign_name), lower(p.codename))
  ) >= min_similarity

  UNION ALL

  SELECT p.id, p.codename, 'brevo_email'::TEXT,
    bcm.campaign_id::TEXT, bcm.campaign_name,
    greatest(
      similarity(lower(bcm.campaign_name), lower(pa.alias)),
      similarity(lower(bcm.campaign_name), lower(p.codename))
    )
  FROM brevo_campaign_metrics bcm
  CROSS JOIN projects p
  LEFT JOIN project_aliases pa ON pa.project_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM project_channel_links pcl
    JOIN channel_definitions cd ON cd.id = pcl.channel_id
    WHERE cd.slug = 'brevo_email' AND pcl.external_id = bcm.campaign_id::TEXT
  )
  AND greatest(
    similarity(lower(bcm.campaign_name), lower(pa.alias)),
    similarity(lower(bcm.campaign_name), lower(p.codename))
  ) >= min_similarity

  ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql;
```

### Step 4: link_intake_to_projects

Matches existing `intake_requests.campaign_slug` to `projects.codename`.

```sql
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
```

### Step 5: auto_link_channels

Takes fuzzy matches above a threshold and creates confirmed links. High similarity (>=0.7) auto-confirms; lower similarity goes to review queue.

```sql
CREATE OR REPLACE FUNCTION auto_link_channels(
  p_auto_confirm_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE (
  action        TEXT,
  project_name  TEXT,
  channel       TEXT,
  external_name TEXT,
  similarity    FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH suggestions AS (
    SELECT * FROM suggest_channel_links(0.3)
  ),
  auto_confirmed AS (
    INSERT INTO project_channel_links
      (project_id, channel_id, external_id, external_name, match_method, confidence, confirmed_at)
    SELECT
      s.project_id,
      (SELECT id FROM channel_definitions WHERE slug = s.channel_type),
      s.external_id, s.external_name,
      'fuzzy', s.similarity,
      CASE WHEN s.similarity >= p_auto_confirm_threshold THEN NOW() ELSE NULL END
    FROM suggestions s
    ON CONFLICT (channel_id, external_id) DO NOTHING
    RETURNING *
  )
  SELECT
    CASE WHEN ac.confirmed_at IS NOT NULL THEN 'AUTO-CONFIRMED' ELSE 'NEEDS REVIEW' END,
    p.codename, cd.display_name, ac.external_name, ac.confidence
  FROM auto_confirmed ac
  JOIN projects p ON p.id = ac.project_id
  JOIN channel_definitions cd ON cd.id = ac.channel_id
  ORDER BY ac.confidence DESC;
END;
$$ LANGUAGE plpgsql;
```

### Step 6: classify_historical_utms

Scans `attribution_touchpoints` for UTM combos. Classifies known patterns via rules engine, logs unclassified combos with normalized names for review.

```sql
CREATE OR REPLACE FUNCTION classify_historical_utms()
RETURNS TABLE (classified INT, unclassified INT) AS $$
DECLARE
  v_classified INT := 0;
  v_unclassified INT := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      at.utm_source, at.utm_medium, at.utm_campaign,
      count(*) AS hits,
      min(at.timestamp)::DATE AS first_seen,
      max(at.timestamp)::DATE AS last_seen,
      aj.request_id
    FROM attribution_touchpoints at
    JOIN attribution_journeys aj ON aj.id = at.journey_id
    WHERE at.utm_source IS NOT NULL
    GROUP BY at.utm_source, at.utm_medium, at.utm_campaign, aj.request_id
  LOOP
    IF EXISTS (SELECT 1 FROM resolve_utm_channel(r.utm_source, r.utm_medium, r.utm_campaign)) THEN
      v_classified := v_classified + 1;
    ELSE
      INSERT INTO unclassified_utm_log
        (project_id, raw_source, raw_medium, raw_campaign,
         normalized_name, hit_count, first_seen_at, last_seen_at)
      VALUES (
        (SELECT pa.project_id FROM project_aliases pa
         WHERE similarity(lower(r.utm_campaign), pa.alias) > 0.4
         ORDER BY similarity(lower(r.utm_campaign), pa.alias) DESC LIMIT 1),
        r.utm_source, r.utm_medium, r.utm_campaign,
        normalize_utm_display(r.utm_source) || ' / ' || normalize_utm_display(r.utm_medium),
        r.hits, r.first_seen, r.last_seen
      )
      ON CONFLICT (raw_source, raw_medium, raw_campaign) DO UPDATE SET
        hit_count = unclassified_utm_log.hit_count + EXCLUDED.hit_count,
        last_seen_at = greatest(unclassified_utm_log.last_seen_at, EXCLUDED.last_seen_at);
      v_unclassified := v_unclassified + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_classified, v_unclassified;
END;
$$ LANGUAGE plpgsql;
```

### Master Orchestrator: run_retroactive_seed

Run once to bootstrap everything.

```sql
CREATE OR REPLACE FUNCTION run_retroactive_seed()
RETURNS TABLE (step TEXT, result TEXT) AS $$
DECLARE
  v_intake_linked INT;
  v_classified INT;
  v_unclassified INT;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  RETURN QUERY SELECT 'step_1'::TEXT,
    (SELECT count(*)::TEXT || ' projects in registry' FROM projects);

  RETURN QUERY SELECT 'step_2'::TEXT,
    (SELECT count(*)::TEXT || ' alias candidates found' FROM discover_aliases(0.35));

  SELECT link_intake_to_projects() INTO v_intake_linked;
  RETURN QUERY SELECT 'step_3'::TEXT,
    v_intake_linked::TEXT || ' intake_requests linked to projects';

  PERFORM auto_link_channels(0.7);
  RETURN QUERY SELECT 'step_4'::TEXT,
    (SELECT count(*)::TEXT || ' channel links created (' ||
            count(*) FILTER (WHERE confirmed_at IS NOT NULL)::TEXT || ' auto-confirmed)'
     FROM project_channel_links);

  SELECT * INTO v_classified, v_unclassified FROM classify_historical_utms();
  RETURN QUERY SELECT 'step_5'::TEXT,
    v_classified::TEXT || ' UTM combos classified, ' ||
    v_unclassified::TEXT || ' unclassified (need review)';

  RETURN QUERY SELECT 'done'::TEXT,
    'Review: SELECT * FROM unclassified_channels_pending; ' ||
    'Review: SELECT * FROM project_channel_links WHERE confirmed_at IS NULL ORDER BY confidence DESC;';
END;
$$ LANGUAGE plpgsql;
```

**Execution order:**

1. Python script: `GET /wp-json/wp/v2/jobs` → call `seed_project_from_wp()` per job
2. Manual pass: add known aliases (`hummus`→humus, `kilo-nyc`→kilo, etc.)
3. `SELECT * FROM run_retroactive_seed();`
4. Review dashboard shows results:
   - `step_1: 23 projects in registry`
   - `step_2: 47 alias candidates found`
   - `step_3: 12 intake_requests linked to projects`
   - `step_4: 89 channel links created (71 auto-confirmed)`
   - `step_5: 134 UTM combos classified, 18 unclassified (need review)`
5. Review the unclassified + low-confidence links, confirm or dismiss
6. System runs continuously going forward

---

## Future: Prod DB Integration

When access to the OneForma production database (`myoneforma.com`) is secured:

1. Identify the key that ties a GA4 session to a prod DB applicant record (email, user_id, or URL parameter)
2. Add a `project_applications` table or extend `attribution_journeys` with prod DB conversion data
3. Close the funnel: Awareness → Traffic → Engagement → Application → Completion → Hire
4. The `projects` table is already there to attach this data to — no schema changes needed for the project identity layer

---

## Migration Dependency

Requires `pg_trgm` extension on Azure PG (should already be available on Azure Database for PostgreSQL Flexible Server — just needs `CREATE EXTENSION`).

All tables use `IF NOT EXISTS` / `ON CONFLICT` patterns for idempotent reruns.
