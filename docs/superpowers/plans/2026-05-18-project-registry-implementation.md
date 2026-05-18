# Project Registry & Unified Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a canonical project registry that links WP job posts, paid campaigns, organic social, email, flyers, recruiter UTMs, and job boards into a single per-project funnel — with retroactive seeding via fuzzy matching.

**Architecture:** New `projects` table is the canonical identity. `channel_definitions` + `utm_channel_rules` provide a dynamic channel registry. `project_channel_links` connects projects to data sources. `project_daily_funnel` view unifies all channels. `project_weekly_summary` materialized view powers narrative dashboards. A Python seeder script bootstraps from WordPress.

**Tech Stack:** PostgreSQL 17 (Azure PG), pg_trgm extension, Next.js 16 API routes, `@neondatabase/serverless` raw SQL, Vitest, Python 3.12 asyncpg

**Spec:** `docs/superpowers/specs/2026-05-18-project-registry-insights-redesign-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `migrations/2026-05-18-project-registry.sql` | All tables, functions, views, seed data |
| Modify | `src/lib/db/schema.ts` | Add idempotent project tables to auto-create |
| Create | `src/lib/types/projects.ts` | TypeScript types for projects, channels, aliases |
| Create | `src/lib/db/projects.ts` | Data access: projects CRUD, aliases, fuzzy search |
| Create | `src/lib/db/channels.ts` | Data access: channel defs, UTM rules, links, unclassified |
| Create | `tests/unit/projects.test.ts` | Unit tests: project CRUD, alias matching |
| Create | `tests/unit/channels.test.ts` | Unit tests: UTM resolution, channel linking |
| Create | `src/app/api/projects/route.ts` | GET (list) / POST (create) projects |
| Create | `src/app/api/projects/[id]/route.ts` | GET / PATCH / DELETE single project |
| Create | `src/app/api/projects/[id]/aliases/route.ts` | GET / POST aliases for a project |
| Create | `src/app/api/projects/[id]/channels/route.ts` | GET / POST / PATCH channel links |
| Create | `src/app/api/projects/[id]/funnel/route.ts` | GET unified funnel data for a project |
| Create | `src/app/api/projects/unclassified/route.ts` | GET / PATCH unclassified UTMs |
| Create | `src/app/api/projects/seed/route.ts` | POST trigger retroactive seed |
| Create | `worker/scripts/seed_projects_from_wp.py` | Python: pull WP jobs → seed projects table |

---

### Task 1: Migration — Core Tables & Extension

**Files:**
- Create: `migrations/2026-05-18-project-registry.sql`

- [ ] **Step 1: Create migration file with pg_trgm + core tables**

```sql
-- migrations/2026-05-18-project-registry.sql
-- Project Registry — canonical project identity + dynamic channel registry
-- Target: Azure PG (onetake-pg-west01.postgres.database.azure.com)

BEGIN;

-- ═══ Extension ═══
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══ 1. projects ═══
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
CREATE INDEX IF NOT EXISTS idx_projects_intake ON projects(intake_id) WHERE intake_id IS NOT NULL;

-- ═══ 2. project_aliases ═══
CREATE TABLE IF NOT EXISTS project_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL UNIQUE,
  source      TEXT NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual','fuzzy_match','utm_scan','wp_scan')),
  confidence  FLOAT DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_aliases_project ON project_aliases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_aliases_trgm ON project_aliases USING gin (alias gin_trgm_ops);

-- ═══ 3. channel_definitions ═══
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

INSERT INTO channel_definitions (slug, display_name, category, is_paid) VALUES
  ('meta_paid',        'Meta Ads',              'paid_social',    TRUE),
  ('reddit_paid',      'Reddit Ads',            'paid_social',    TRUE),
  ('google_paid',      'Google Ads',            'paid_search',    TRUE),
  ('tiktok_paid',      'TikTok Ads',            'paid_social',    TRUE),
  ('linkedin_paid',    'LinkedIn Ads',          'paid_social',    TRUE),
  ('meta_organic',     'Meta Organic',          'organic_social', FALSE),
  ('linkedin_organic', 'LinkedIn Organic',      'organic_social', FALSE),
  ('reddit_organic',   'Reddit Organic',        'organic_social', FALSE),
  ('brevo_email',      'Brevo Email',           'email',          FALSE),
  ('organic_search',   'Organic Search',        'organic_search', FALSE),
  ('flyer',            'Physical Flyers',       'physical',       FALSE),
  ('qr_poster',        'QR Posters',            'physical',       FALSE),
  ('recruiter',        'Recruiter Direct',      'recruiter',      FALSE),
  ('influencer',       'Influencer',            'influencer',     TRUE),
  ('indeed',           'Indeed',                'job_board',      FALSE),
  ('glassdoor',        'Glassdoor',             'job_board',      FALSE),
  ('linkedin_jobs',    'LinkedIn Jobs',         'job_board',      FALSE),
  ('monster',          'Monster',               'job_board',      FALSE),
  ('referral',         'Employee Referral',     'referral',       FALSE),
  ('direct',           'Direct Traffic',        'direct',         FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ═══ 4. utm_channel_rules ═══
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

CREATE INDEX IF NOT EXISTS idx_utm_rules_channel ON utm_channel_rules(channel_id);

INSERT INTO utm_channel_rules (channel_id, utm_source_pattern, utm_medium_pattern, extract_label_regex, priority, notes)
SELECT cd.id, v.src, v.med, v.lbl, v.pri, v.note
FROM (VALUES
  ('flyer',            '^flyer',                          NULL,                          'flyer_(.+)',       10, 'Physical flyer with city suffix'),
  ('qr_poster',        NULL,                              '^qr$',                        NULL,               10, 'Any source with medium=qr'),
  ('recruiter',        '^recruiter_',                     NULL,                          'recruiter_(.+)',   10, 'Individual recruiter links'),
  ('recruiter',        NULL,                              '^recruiter$',                 NULL,                5, 'Fallback: medium=recruiter'),
  ('influencer',       '^influencer_',                    NULL,                          'influencer_(.+)',  10, 'Named influencer'),
  ('influencer',       NULL,                              '^influencer$',                NULL,                5, 'Fallback: medium=influencer'),
  ('indeed',           '^indeed',                         NULL,                          NULL,               10, 'Indeed organic or sponsored'),
  ('glassdoor',        '^glassdoor',                      NULL,                          NULL,               10, NULL),
  ('linkedin_jobs',    '^linkedin_jobs',                  NULL,                          NULL,               10, 'LinkedIn Jobs (not ads)'),
  ('linkedin_jobs',    '^linkedin',                       '^job',                        NULL,                8, 'linkedin + medium containing job'),
  ('meta_paid',        '^(facebook|fb|instagram|ig|meta)$', '^(cpc|paid|paidsocial)$', NULL,                5, NULL),
  ('reddit_paid',      '^reddit$',                        '^(cpc|paid)$',               NULL,                5, NULL),
  ('google_paid',      '^google$',                        '^(cpc|ppc|paid)$',           NULL,                5, NULL),
  ('meta_organic',     '^(facebook|fb|instagram|ig)$',    '^(social|organic|post)$',    NULL,                5, NULL),
  ('linkedin_organic', '^linkedin$',                      '^(social|organic|post)$',    NULL,                5, NULL),
  ('brevo_email',      '^(brevo|sendinblue|email)$',      NULL,                          NULL,                5, NULL)
) AS v(slug, src, med, lbl, pri, note)
JOIN channel_definitions cd ON cd.slug = v.slug
ON CONFLICT DO NOTHING;

-- ═══ 5. project_channel_links ═══
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
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_links_project ON project_channel_links(project_id);
CREATE INDEX IF NOT EXISTS idx_channel_links_channel ON project_channel_links(channel_id, external_id);

-- ═══ 6. unclassified_utm_log ═══
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
  resolved_at     TIMESTAMPTZ,
  UNIQUE(raw_source, raw_medium, raw_campaign)
);

CREATE INDEX IF NOT EXISTS idx_unclassified_unresolved
  ON unclassified_utm_log(resolved, hit_count DESC)
  WHERE resolved = FALSE;

COMMIT;
```

- [ ] **Step 2: Verify migration is valid SQL**

Run against Azure PG (dry run):
```bash
cd /Users/stevenjunop/centric-intake
psql "$DATABASE_URL" -f migrations/2026-05-18-project-registry.sql
```

Expected: All `CREATE TABLE`, `CREATE INDEX`, `INSERT` succeed. No errors.

- [ ] **Step 3: Commit**

```bash
git add migrations/2026-05-18-project-registry.sql
git commit -m "feat: add project registry migration — tables, channel defs, UTM rules"
```

---

### Task 2: Migration — Functions & Views

**Files:**
- Modify: `migrations/2026-05-18-project-registry.sql` (append after COMMIT)

- [ ] **Step 1: Append functions to migration file**

Add a second transaction block after the existing COMMIT:

```sql
-- ═══════════════════════════════════════════════════════════════
-- PART 2: Functions & Views (separate transaction)
-- ═══════════════════════════════════════════════════════════════
BEGIN;

-- ═══ normalize_utm_display ═══
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

-- ═══ resolve_utm_channel ═══
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

-- ═══ seed_project_from_wp ═══
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

-- ═══ link_intake_to_projects ═══
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

-- ═══ unclassified_channels_pending VIEW ═══
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

-- ═══ project_daily_funnel VIEW ═══
CREATE OR REPLACE VIEW project_daily_funnel AS

-- Paid via intake_id (OneTake campaigns)
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

-- Paid via channel_links (historical without intake_request)
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

-- Organic: Meta
SELECT
  p.id, p.codename, moc.date, moc.platform, 'organic', 'organic',
  moc.impressions, moc.clicks, 0::NUMERIC, 0, 0, 0,
  moc.reach, moc.engagement, NULL::NUMERIC, NULL::FLOAT, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'meta_organic'
JOIN meta_organic_cache moc ON moc.post_id = pcl.external_id

UNION ALL

-- Organic: LinkedIn
SELECT
  p.id, p.codename, loc.date, 'linkedin', 'organic', 'organic',
  loc.impressions, loc.clicks, 0::NUMERIC, 0, 0, 0,
  loc.unique_impressions, loc.engagement, NULL::NUMERIC, NULL::FLOAT, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'linkedin_organic'
JOIN linkedin_organic_cache loc ON loc.post_id = pcl.external_id

UNION ALL

-- Email: Brevo
SELECT
  p.id, p.codename, bcm.date, 'brevo', 'email', 'email',
  0, bcm.clicks, 0::NUMERIC, 0, 0, 0,
  bcm.delivered, bcm.opens, NULL::NUMERIC, NULL::FLOAT, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'brevo_email'
JOIN brevo_campaign_metrics bcm ON bcm.campaign_id::TEXT = pcl.external_id

UNION ALL

-- Organic Search: GSC
SELECT
  p.id, p.codename, gsc.date, 'google', 'organic_search', 'organic',
  gsc.impressions, gsc.clicks, 0::NUMERIC, 0, 0, 0,
  NULL::INT, NULL::INT, NULL::NUMERIC, gsc.ctr, NULL::FLOAT
FROM projects p
JOIN project_channel_links pcl ON pcl.project_id = p.id AND pcl.confirmed_at IS NOT NULL
JOIN channel_definitions cd ON cd.id = pcl.channel_id AND cd.slug = 'organic_search'
JOIN gsc_daily_cache gsc ON gsc.page LIKE pcl.external_id;

-- ═══ project_weekly_summary MATERIALIZED VIEW ═══
CREATE MATERIALIZED VIEW IF NOT EXISTS project_weekly_summary AS
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
```

- [ ] **Step 2: Run migration on Azure PG**

```bash
psql "$DATABASE_URL" -f migrations/2026-05-18-project-registry.sql
```

Expected: Both transactions succeed. Verify:
```sql
SELECT * FROM resolve_utm_channel('flyer_seattle', 'qr', 'centaurus');
-- → slug: flyer, label: seattle

SELECT normalize_utm_display('recruiter_jane_smith');
-- → 'Recruiter Jane Smith'
```

- [ ] **Step 3: Commit**

```bash
git add migrations/2026-05-18-project-registry.sql
git commit -m "feat: add project registry functions, views, materialized summary"
```

---

### Task 3: TypeScript Types

**Files:**
- Create: `src/lib/types/projects.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/types/projects.ts

export interface Project {
  id: string;
  codename: string;
  display_name: string;
  wp_job_id: number | null;
  wp_slug: string | null;
  wp_published_at: string | null;
  intake_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  countries: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectAlias {
  id: string;
  project_id: string;
  alias: string;
  source: 'manual' | 'fuzzy_match' | 'utm_scan' | 'wp_scan';
  confidence: number;
  created_at: string;
}

export interface ChannelDefinition {
  id: string;
  slug: string;
  display_name: string;
  category: ChannelCategory;
  icon: string | null;
  is_paid: boolean;
  created_at: string;
}

export type ChannelCategory =
  | 'paid_social' | 'paid_search' | 'organic_social' | 'organic_search'
  | 'email' | 'job_board' | 'physical' | 'recruiter'
  | 'influencer' | 'referral' | 'direct' | 'other';

export interface UtmChannelRule {
  id: string;
  channel_id: string;
  utm_source_pattern: string | null;
  utm_medium_pattern: string | null;
  utm_campaign_pattern: string | null;
  priority: number;
  extract_label_regex: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectChannelLink {
  id: string;
  project_id: string;
  channel_id: string;
  external_id: string;
  external_name: string | null;
  extracted_label: string | null;
  match_method: 'manual' | 'fuzzy' | 'exact' | 'regex';
  confidence: number;
  confirmed_at: string | null;
  created_at: string;
  // Joined fields (from channel_definitions)
  channel_slug?: string;
  channel_name?: string;
  channel_category?: ChannelCategory;
}

export interface UnclassifiedUtm {
  id: string;
  project_id: string | null;
  raw_source: string | null;
  raw_medium: string | null;
  raw_campaign: string | null;
  normalized_name: string;
  hit_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved: boolean;
  resolved_to: string | null;
  resolved_at: string | null;
  // From the view
  source_display?: string;
  medium_display?: string;
  project?: string;
  suggested_channel?: string;
}

export interface ProjectFunnelRow {
  project_id: string;
  codename: string;
  date: string;
  platform: string;
  channel: string;
  metric_type: 'paid' | 'organic' | 'email';
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  signups: number;
  profile_completes: number;
  reach: number | null;
  engagement: number | null;
  cpa: number | null;
  ctr: number | null;
  roas: number | null;
}

export interface ProjectWeeklySummary {
  project_id: string;
  codename: string;
  week_start: string;
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_conversions: number;
  total_reach: number;
  total_engagement: number;
  paid_spend: number;
  paid_clicks: number;
  paid_conversions: number;
  organic_clicks: number;
  email_clicks: number;
  conversion_rate: number;
  blended_cpa: number | null;
  active_channels: number;
}

export interface AliasSuggestion {
  project_id: string;
  codename: string;
  discovered: string;
  source_table: string;
  similarity: number;
}

export interface ChannelLinkSuggestion {
  project_id: string;
  codename: string;
  channel_type: string;
  external_id: string;
  external_name: string;
  similarity: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/lib/types/projects.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/projects.ts
git commit -m "feat: add TypeScript types for project registry"
```

---

### Task 4: Data Access Layer — Projects

**Files:**
- Create: `src/lib/db/projects.ts`

- [ ] **Step 1: Create projects data access module**

```typescript
// src/lib/db/projects.ts
import { getDb } from '@/lib/db';
import type { Project, ProjectAlias, AliasSuggestion } from '@/lib/types/projects';

export async function listProjects(status?: string): Promise<Project[]> {
  const sql = getDb();
  if (status) {
    const rows = await sql`
      SELECT * FROM projects WHERE status = ${status} ORDER BY codename
    `;
    return rows as Project[];
  }
  const rows = await sql`SELECT * FROM projects ORDER BY codename`;
  return rows as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return (rows[0] as Project) ?? null;
}

export async function getProjectByCodename(codename: string): Promise<Project | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM projects WHERE codename = ${codename.toLowerCase().trim()}
  `;
  return (rows[0] as Project) ?? null;
}

export async function createProject(data: {
  codename: string;
  display_name: string;
  wp_job_id?: number;
  wp_slug?: string;
  wp_published_at?: string;
  countries?: string[];
  status?: string;
}): Promise<Project> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO projects (codename, display_name, wp_job_id, wp_slug, wp_published_at, countries, status)
    VALUES (
      ${data.codename.toLowerCase().trim()},
      ${data.display_name},
      ${data.wp_job_id ?? null},
      ${data.wp_slug ?? null},
      ${data.wp_published_at ?? null},
      ${data.countries ?? []},
      ${data.status ?? 'active'}
    )
    RETURNING *
  `;
  return rows[0] as Project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'display_name' | 'status' | 'countries' | 'wp_job_id' | 'wp_slug' | 'intake_id'>>
): Promise<Project | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE projects SET
      display_name = COALESCE(${updates.display_name ?? null}, display_name),
      status       = COALESCE(${updates.status ?? null}, status),
      countries    = COALESCE(${updates.countries ?? null}, countries),
      wp_job_id    = COALESCE(${updates.wp_job_id ?? null}, wp_job_id),
      wp_slug      = COALESCE(${updates.wp_slug ?? null}, wp_slug),
      intake_id    = COALESCE(${updates.intake_id ?? null}, intake_id),
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Project) ?? null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ── Aliases ───────────────────────────────────────────────────────────

export async function listAliases(projectId: string): Promise<ProjectAlias[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM project_aliases WHERE project_id = ${projectId} ORDER BY confidence DESC
  `;
  return rows as ProjectAlias[];
}

export async function addAlias(
  projectId: string,
  alias: string,
  source: ProjectAlias['source'] = 'manual',
  confidence: number = 1.0
): Promise<ProjectAlias> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO project_aliases (project_id, alias, source, confidence)
    VALUES (${projectId}, ${alias.toLowerCase().trim()}, ${source}, ${confidence})
    ON CONFLICT (alias) DO UPDATE SET
      confidence = GREATEST(project_aliases.confidence, EXCLUDED.confidence)
    RETURNING *
  `;
  return rows[0] as ProjectAlias;
}

export async function deleteAlias(aliasId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM project_aliases WHERE id = ${aliasId} RETURNING id`;
  return rows.length > 0;
}

// ── Fuzzy Search ──────────────────────────────────────────────────────

export async function searchProjectsByFuzzy(query: string, minSimilarity = 0.3): Promise<(Project & { similarity: number })[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT p.*, greatest(
      similarity(${query.toLowerCase()}, p.codename),
      COALESCE((SELECT max(similarity(${query.toLowerCase()}, pa.alias))
                FROM project_aliases pa WHERE pa.project_id = p.id), 0)
    ) AS similarity
    FROM projects p
    WHERE greatest(
      similarity(${query.toLowerCase()}, p.codename),
      COALESCE((SELECT max(similarity(${query.toLowerCase()}, pa.alias))
                FROM project_aliases pa WHERE pa.project_id = p.id), 0)
    ) >= ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT 10
  `;
  return rows as (Project & { similarity: number })[];
}

// ── Seeding ───────────────────────────────────────────────────────────

export async function seedFromWp(data: {
  codename: string;
  display_name: string;
  wp_job_id: number;
  wp_slug: string;
  wp_published_at: string;
  countries?: string[];
}): Promise<string> {
  const sql = getDb();
  const rows = await sql`
    SELECT seed_project_from_wp(
      ${data.codename}, ${data.display_name},
      ${data.wp_job_id}, ${data.wp_slug},
      ${data.wp_published_at}::TIMESTAMPTZ,
      ${data.countries ?? []}::TEXT[]
    ) AS id
  `;
  return rows[0].id as string;
}

export async function linkIntakeToProjects(): Promise<number> {
  const sql = getDb();
  const rows = await sql`SELECT link_intake_to_projects() AS count`;
  return rows[0].count as number;
}

export async function discoverAliases(minSimilarity = 0.35): Promise<AliasSuggestion[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM discover_aliases(${minSimilarity})`;
  return rows as AliasSuggestion[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/projects.ts
git commit -m "feat: add projects data access layer — CRUD, aliases, fuzzy search, seeding"
```

---

### Task 5: Data Access Layer — Channels

**Files:**
- Create: `src/lib/db/channels.ts`

- [ ] **Step 1: Create channels data access module**

```typescript
// src/lib/db/channels.ts
import { getDb } from '@/lib/db';
import type {
  ChannelDefinition,
  UtmChannelRule,
  ProjectChannelLink,
  UnclassifiedUtm,
  ChannelLinkSuggestion,
} from '@/lib/types/projects';

// ── Channel Definitions ───────────────────────────────────────────────

export async function listChannelDefinitions(): Promise<ChannelDefinition[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM channel_definitions ORDER BY category, slug`;
  return rows as ChannelDefinition[];
}

export async function createChannelDefinition(data: {
  slug: string;
  display_name: string;
  category: string;
  is_paid?: boolean;
  icon?: string;
}): Promise<ChannelDefinition> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO channel_definitions (slug, display_name, category, is_paid, icon)
    VALUES (${data.slug}, ${data.display_name}, ${data.category}, ${data.is_paid ?? false}, ${data.icon ?? null})
    RETURNING *
  `;
  return rows[0] as ChannelDefinition;
}

// ── UTM Rules ─────────────────────────────────────────────────────────

export async function listUtmRules(channelId?: string): Promise<UtmChannelRule[]> {
  const sql = getDb();
  if (channelId) {
    const rows = await sql`
      SELECT * FROM utm_channel_rules WHERE channel_id = ${channelId} ORDER BY priority DESC
    `;
    return rows as UtmChannelRule[];
  }
  const rows = await sql`SELECT * FROM utm_channel_rules ORDER BY priority DESC`;
  return rows as UtmChannelRule[];
}

export async function createUtmRule(data: {
  channel_id: string;
  utm_source_pattern?: string;
  utm_medium_pattern?: string;
  utm_campaign_pattern?: string;
  priority?: number;
  extract_label_regex?: string;
  notes?: string;
}): Promise<UtmChannelRule> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO utm_channel_rules
      (channel_id, utm_source_pattern, utm_medium_pattern, utm_campaign_pattern,
       priority, extract_label_regex, notes)
    VALUES (
      ${data.channel_id},
      ${data.utm_source_pattern ?? null},
      ${data.utm_medium_pattern ?? null},
      ${data.utm_campaign_pattern ?? null},
      ${data.priority ?? 0},
      ${data.extract_label_regex ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `;
  return rows[0] as UtmChannelRule;
}

// ── UTM Resolution ────────────────────────────────────────────────────

export async function resolveUtm(source: string, medium: string, campaign?: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM resolve_utm_channel(${source}, ${medium}, ${campaign ?? null})
  `;
  if (rows.length === 0) return null;
  return rows[0] as {
    channel_slug: string;
    channel_name: string;
    category: string;
    extracted_label: string | null;
    confidence: number;
  };
}

// ── Channel Links ─────────────────────────────────────────────────────

export async function listChannelLinks(projectId: string): Promise<ProjectChannelLink[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT pcl.*, cd.slug AS channel_slug, cd.display_name AS channel_name, cd.category AS channel_category
    FROM project_channel_links pcl
    JOIN channel_definitions cd ON cd.id = pcl.channel_id
    WHERE pcl.project_id = ${projectId}
    ORDER BY cd.category, pcl.confidence DESC
  `;
  return rows as ProjectChannelLink[];
}

export async function createChannelLink(data: {
  project_id: string;
  channel_id: string;
  external_id: string;
  external_name?: string;
  extracted_label?: string;
  match_method?: string;
  confidence?: number;
  confirmed?: boolean;
}): Promise<ProjectChannelLink> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO project_channel_links
      (project_id, channel_id, external_id, external_name, extracted_label,
       match_method, confidence, confirmed_at)
    VALUES (
      ${data.project_id}, ${data.channel_id}, ${data.external_id},
      ${data.external_name ?? null}, ${data.extracted_label ?? null},
      ${data.match_method ?? 'manual'}, ${data.confidence ?? 1.0},
      ${data.confirmed ? 'NOW()' : null}
    )
    ON CONFLICT (channel_id, external_id) DO UPDATE SET
      confidence = GREATEST(project_channel_links.confidence, EXCLUDED.confidence)
    RETURNING *
  `;
  return rows[0] as ProjectChannelLink;
}

export async function confirmChannelLink(linkId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE project_channel_links SET confirmed_at = NOW()
    WHERE id = ${linkId} AND confirmed_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function dismissChannelLink(linkId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM project_channel_links WHERE id = ${linkId} RETURNING id`;
  return rows.length > 0;
}

export async function suggestChannelLinks(minSimilarity = 0.3): Promise<ChannelLinkSuggestion[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM suggest_channel_links(${minSimilarity})`;
  return rows as ChannelLinkSuggestion[];
}

// ── Unclassified UTMs ─────────────────────────────────────────────────

export async function listUnclassified(): Promise<UnclassifiedUtm[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM unclassified_channels_pending`;
  return rows as UnclassifiedUtm[];
}

export async function resolveUnclassified(utmId: string, channelId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    UPDATE unclassified_utm_log
    SET resolved = TRUE, resolved_to = ${channelId}, resolved_at = NOW()
    WHERE id = ${utmId}
    RETURNING id
  `;
  return rows.length > 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/channels.ts
git commit -m "feat: add channels data access — definitions, UTM rules, links, unclassified"
```

---

### Task 6: Unit Tests — Projects

**Files:**
- Create: `tests/unit/projects.test.ts`

- [ ] **Step 1: Write unit tests for project data access**

```typescript
// tests/unit/projects.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: () => mockSql,
}));

import {
  listProjects,
  getProject,
  getProjectByCodename,
  createProject,
  updateProject,
  deleteProject,
  addAlias,
  searchProjectsByFuzzy,
} from '@/lib/db/projects';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProjects', () => {
  it('returns all projects ordered by codename', async () => {
    const mockProjects = [
      { id: '1', codename: 'centaurus', display_name: 'Centaurus', status: 'active' },
      { id: '2', codename: 'humus', display_name: 'Humus', status: 'active' },
    ];
    mockSql.mockResolvedValueOnce(mockProjects);

    const result = await listProjects();
    expect(result).toEqual(mockProjects);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('filters by status when provided', async () => {
    mockSql.mockResolvedValueOnce([]);

    await listProjects('archived');
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe('getProject', () => {
  it('returns project by id', async () => {
    const mockProject = { id: '1', codename: 'centaurus' };
    mockSql.mockResolvedValueOnce([mockProject]);

    const result = await getProject('1');
    expect(result).toEqual(mockProject);
  });

  it('returns null when not found', async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getProject('nonexistent');
    expect(result).toBeNull();
  });
});

describe('getProjectByCodename', () => {
  it('lowercases and trims the codename', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1', codename: 'humus' }]);

    const result = await getProjectByCodename('  HUMUS  ');
    expect(result).toBeTruthy();
  });
});

describe('createProject', () => {
  it('creates project with lowercase codename', async () => {
    const mockProject = { id: '1', codename: 'kilo', display_name: 'Kilo NYC' };
    mockSql.mockResolvedValueOnce([mockProject]);

    const result = await createProject({ codename: 'Kilo', display_name: 'Kilo NYC' });
    expect(result.codename).toBe('kilo');
  });
});

describe('updateProject', () => {
  it('returns updated project', async () => {
    const updated = { id: '1', codename: 'humus', status: 'paused' };
    mockSql.mockResolvedValueOnce([updated]);

    const result = await updateProject('1', { status: 'paused' });
    expect(result?.status).toBe('paused');
  });

  it('returns null when project not found', async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await updateProject('nonexistent', { status: 'archived' });
    expect(result).toBeNull();
  });
});

describe('deleteProject', () => {
  it('returns true when deleted', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await deleteProject('1')).toBe(true);
  });

  it('returns false when not found', async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await deleteProject('nope')).toBe(false);
  });
});

describe('addAlias', () => {
  it('lowercases and trims the alias', async () => {
    const mockAlias = { id: '1', alias: 'hummus', source: 'manual', confidence: 1.0 };
    mockSql.mockResolvedValueOnce([mockAlias]);

    const result = await addAlias('proj-1', '  HUMMUS  ');
    expect(result.alias).toBe('hummus');
  });
});

describe('searchProjectsByFuzzy', () => {
  it('returns projects sorted by similarity', async () => {
    const results = [
      { id: '1', codename: 'humus', similarity: 0.9 },
      { id: '2', codename: 'hummus-twins', similarity: 0.6 },
    ];
    mockSql.mockResolvedValueOnce(results);

    const found = await searchProjectsByFuzzy('humus');
    expect(found).toHaveLength(2);
    expect(found[0].similarity).toBeGreaterThan(found[1].similarity);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/stevenjunop/centric-intake && npx vitest run tests/unit/projects.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/projects.test.ts
git commit -m "test: add unit tests for projects data access layer"
```

---

### Task 7: Unit Tests — Channels

**Files:**
- Create: `tests/unit/channels.test.ts`

- [ ] **Step 1: Write unit tests for channel data access**

```typescript
// tests/unit/channels.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: () => mockSql,
}));

import {
  listChannelDefinitions,
  createChannelDefinition,
  resolveUtm,
  listChannelLinks,
  createChannelLink,
  confirmChannelLink,
  dismissChannelLink,
  listUnclassified,
  resolveUnclassified,
} from '@/lib/db/channels';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listChannelDefinitions', () => {
  it('returns all channel definitions ordered by category', async () => {
    const mockChannels = [
      { slug: 'brevo_email', display_name: 'Brevo Email', category: 'email', is_paid: false },
      { slug: 'meta_paid', display_name: 'Meta Ads', category: 'paid_social', is_paid: true },
    ];
    mockSql.mockResolvedValueOnce(mockChannels);

    const result = await listChannelDefinitions();
    expect(result).toHaveLength(2);
  });
});

describe('createChannelDefinition', () => {
  it('creates a new channel with defaults', async () => {
    const mockChannel = { slug: 'jobberman', display_name: 'Jobberman', category: 'job_board', is_paid: false };
    mockSql.mockResolvedValueOnce([mockChannel]);

    const result = await createChannelDefinition({
      slug: 'jobberman',
      display_name: 'Jobberman',
      category: 'job_board',
    });
    expect(result.slug).toBe('jobberman');
    expect(result.is_paid).toBe(false);
  });
});

describe('resolveUtm', () => {
  it('returns resolved channel for known UTM', async () => {
    mockSql.mockResolvedValueOnce([{
      channel_slug: 'flyer',
      channel_name: 'Physical Flyers',
      category: 'physical',
      extracted_label: 'seattle',
      confidence: 0.8,
    }]);

    const result = await resolveUtm('flyer_seattle', 'qr', 'centaurus');
    expect(result).not.toBeNull();
    expect(result!.channel_slug).toBe('flyer');
    expect(result!.extracted_label).toBe('seattle');
  });

  it('returns null for unknown UTM', async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await resolveUtm('totally_unknown', 'weird', 'test');
    expect(result).toBeNull();
  });
});

describe('channel links', () => {
  it('listChannelLinks returns links with channel info', async () => {
    const mockLinks = [{
      id: '1', project_id: 'p1', channel_id: 'c1', external_id: 'ext1',
      channel_slug: 'meta_paid', channel_name: 'Meta Ads', channel_category: 'paid_social',
    }];
    mockSql.mockResolvedValueOnce(mockLinks);

    const result = await listChannelLinks('p1');
    expect(result[0].channel_slug).toBe('meta_paid');
  });

  it('confirmChannelLink sets confirmed_at', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await confirmChannelLink('1')).toBe(true);
  });

  it('confirmChannelLink returns false if already confirmed', async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await confirmChannelLink('1')).toBe(false);
  });

  it('dismissChannelLink deletes the link', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await dismissChannelLink('1')).toBe(true);
  });
});

describe('unclassified UTMs', () => {
  it('listUnclassified returns pending items from view', async () => {
    const mockItems = [{
      id: '1', normalized_name: 'Recruiter Ahmed Rafiq', hit_count: 28,
      raw_source: 'recruiter_ahmed_rafiq', project: 'kilo',
      suggested_channel: 'Recruiter Direct',
    }];
    mockSql.mockResolvedValueOnce(mockItems);

    const result = await listUnclassified();
    expect(result[0].normalized_name).toBe('Recruiter Ahmed Rafiq');
  });

  it('resolveUnclassified marks as resolved', async () => {
    mockSql.mockResolvedValueOnce([{ id: '1' }]);
    expect(await resolveUnclassified('1', 'channel-id')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/stevenjunop/centric-intake && npx vitest run tests/unit/channels.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/channels.test.ts
git commit -m "test: add unit tests for channels data access layer"
```

---

### Task 8: Schema.ts — Idempotent Table Creation

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add project registry tables to createTables()**

Append the following at the end of the `createTables()` function, before the closing `}`:

```typescript
  // ═══ Project Registry ═══

  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  await sql`
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_aliases (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      alias       TEXT NOT NULL UNIQUE,
      source      TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','fuzzy_match','utm_scan','wp_scan')),
      confidence  FLOAT DEFAULT 1.0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_project_aliases_trgm ON project_aliases USING gin (alias gin_trgm_ops)`;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  await sql`
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
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(channel_id, external_id)
    )
  `;

  await sql`
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
      resolved_at     TIMESTAMPTZ,
      UNIQUE(raw_source, raw_medium, raw_campaign)
    )
  `;
```

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
cd /Users/stevenjunop/centric-intake && npx vitest run
```

Expected: All existing tests pass. No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add project registry tables to idempotent schema creation"
```

---

### Task 9: API Routes — Projects CRUD

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`
- Create: `src/app/api/projects/[id]/aliases/route.ts`

- [ ] **Step 1: Create projects list/create route**

```typescript
// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listProjects, createProject, searchProjectsByFuzzy } from '@/lib/db/projects';

export async function GET(req: NextRequest) {
  await requireAuth();
  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  const search = req.nextUrl.searchParams.get('search');

  if (search) {
    const results = await searchProjectsByFuzzy(search);
    return NextResponse.json(results);
  }

  const projects = await listProjects(status);
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json();

  if (!body.codename || !body.display_name) {
    return NextResponse.json({ error: 'codename and display_name required' }, { status: 400 });
  }

  const project = await createProject(body);
  return NextResponse.json(project, { status: 201 });
}
```

- [ ] **Step 2: Create single project route**

```typescript
// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProject, updateProject, deleteProject } from '@/lib/db/projects';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const project = await updateProject(id, body);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const deleted = await deleteProject(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create aliases route**

```typescript
// src/app/api/projects/[id]/aliases/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAliases, addAlias } from '@/lib/db/projects';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const aliases = await listAliases(id);
  return NextResponse.json(aliases);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  if (!body.alias) {
    return NextResponse.json({ error: 'alias required' }, { status: 400 });
  }

  const alias = await addAlias(id, body.alias, body.source, body.confidence);
  return NextResponse.json(alias, { status: 201 });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/route.ts src/app/api/projects/\[id\]/route.ts src/app/api/projects/\[id\]/aliases/route.ts
git commit -m "feat: add projects API routes — CRUD, search, aliases"
```

---

### Task 10: API Routes — Channels, Funnel, Unclassified

**Files:**
- Create: `src/app/api/projects/[id]/channels/route.ts`
- Create: `src/app/api/projects/[id]/funnel/route.ts`
- Create: `src/app/api/projects/unclassified/route.ts`

- [ ] **Step 1: Create channel links route**

```typescript
// src/app/api/projects/[id]/channels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listChannelLinks, createChannelLink, confirmChannelLink, dismissChannelLink } from '@/lib/db/channels';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const links = await listChannelLinks(id);
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();

  if (!body.channel_id || !body.external_id) {
    return NextResponse.json({ error: 'channel_id and external_id required' }, { status: 400 });
  }

  const link = await createChannelLink({ project_id: id, ...body });
  return NextResponse.json(link, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await requireAuth();
  const body = await req.json();

  if (body.action === 'confirm' && body.link_id) {
    const ok = await confirmChannelLink(body.link_id);
    return NextResponse.json({ ok });
  }
  if (body.action === 'dismiss' && body.link_id) {
    const ok = await dismissChannelLink(body.link_id);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'action and link_id required' }, { status: 400 });
}
```

- [ ] **Step 2: Create funnel data route**

```typescript
// src/app/api/projects/[id]/funnel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { ProjectFunnelRow, ProjectWeeklySummary } from '@/lib/types/projects';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const view = req.nextUrl.searchParams.get('view') ?? 'weekly';
  const sql = getDb();

  if (view === 'daily') {
    const startDate = req.nextUrl.searchParams.get('start') ?? '2026-01-01';
    const endDate = req.nextUrl.searchParams.get('end') ?? '2099-12-31';
    const rows = await sql`
      SELECT * FROM project_daily_funnel
      WHERE project_id = ${id} AND date >= ${startDate}::DATE AND date <= ${endDate}::DATE
      ORDER BY date DESC
    `;
    return NextResponse.json(rows as ProjectFunnelRow[]);
  }

  // Weekly summary with WoW deltas
  const rows = await sql`
    SELECT * FROM project_weekly_summary
    WHERE project_id = ${id}
    ORDER BY week_start DESC
    LIMIT 12
  ` as ProjectWeeklySummary[];

  // Compute WoW deltas for the most recent 2 weeks
  const current = rows[0] ?? null;
  const previous = rows[1] ?? null;

  const wow = current && previous ? {
    impressions_delta: previous.total_impressions > 0
      ? ((current.total_impressions - previous.total_impressions) / previous.total_impressions * 100)
      : null,
    clicks_delta: previous.total_clicks > 0
      ? ((current.total_clicks - previous.total_clicks) / previous.total_clicks * 100)
      : null,
    spend_delta: previous.total_spend > 0
      ? ((current.total_spend - previous.total_spend) / previous.total_spend * 100)
      : null,
    conversions_delta: previous.total_conversions > 0
      ? ((current.total_conversions - previous.total_conversions) / previous.total_conversions * 100)
      : null,
    cpa_direction: current.blended_cpa && previous.blended_cpa
      ? (current.blended_cpa > previous.blended_cpa ? 'up' : 'down')
      : null,
  } : null;

  return NextResponse.json({ weeks: rows, wow, current, previous });
}
```

- [ ] **Step 3: Create unclassified UTMs route**

```typescript
// src/app/api/projects/unclassified/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listUnclassified, resolveUnclassified } from '@/lib/db/channels';
import { listChannelDefinitions, createChannelDefinition, createUtmRule } from '@/lib/db/channels';

export async function GET() {
  await requireAuth();
  const items = await listUnclassified();
  const channels = await listChannelDefinitions();
  return NextResponse.json({ items, channels });
}

export async function PATCH(req: NextRequest) {
  await requireAuth();
  const body = await req.json();

  // Resolve an unclassified UTM to an existing channel
  if (body.action === 'resolve' && body.utm_id && body.channel_id) {
    const ok = await resolveUnclassified(body.utm_id, body.channel_id);

    // Optionally create a UTM rule so future hits auto-classify
    if (ok && body.create_rule && body.utm_source_pattern) {
      await createUtmRule({
        channel_id: body.channel_id,
        utm_source_pattern: body.utm_source_pattern,
        utm_medium_pattern: body.utm_medium_pattern ?? null,
        priority: body.priority ?? 5,
        extract_label_regex: body.extract_label_regex ?? null,
      });
    }

    return NextResponse.json({ ok });
  }

  // Create a brand-new channel, then resolve the UTM to it
  if (body.action === 'create_and_resolve' && body.utm_id && body.slug && body.display_name && body.category) {
    const channel = await createChannelDefinition({
      slug: body.slug,
      display_name: body.display_name,
      category: body.category,
      is_paid: body.is_paid ?? false,
    });

    const ok = await resolveUnclassified(body.utm_id, channel.id);
    return NextResponse.json({ ok, channel });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/\[id\]/channels/route.ts src/app/api/projects/\[id\]/funnel/route.ts src/app/api/projects/unclassified/route.ts
git commit -m "feat: add API routes — channel links, funnel data, unclassified UTMs"
```

---

### Task 11: API Route — Retroactive Seed

**Files:**
- Create: `src/app/api/projects/seed/route.ts`

- [ ] **Step 1: Create seed trigger route**

```typescript
// src/app/api/projects/seed/route.ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { linkIntakeToProjects, discoverAliases } from '@/lib/db/projects';
import { suggestChannelLinks } from '@/lib/db/channels';

export async function POST() {
  await requireRole(['admin']);
  const sql = getDb();
  const results: { step: string; result: string }[] = [];

  // Step 1: Count projects
  const projectCount = await sql`SELECT count(*)::int AS count FROM projects`;
  results.push({ step: 'projects_count', result: `${projectCount[0].count} projects in registry` });

  // Step 2: Discover alias candidates
  const aliases = await discoverAliases(0.35);
  results.push({ step: 'alias_discovery', result: `${aliases.length} alias candidates found` });

  // Step 3: Link intake_requests
  const intakeLinked = await linkIntakeToProjects();
  results.push({ step: 'intake_linking', result: `${intakeLinked} intake_requests linked to projects` });

  // Step 4: Suggest channel links
  const suggestions = await suggestChannelLinks(0.3);
  results.push({ step: 'channel_suggestions', result: `${suggestions.length} channel link candidates found` });

  // Step 5: Classify UTMs
  const utmResult = await sql`SELECT * FROM classify_historical_utms()`;
  const classified = utmResult[0]?.classified ?? 0;
  const unclassified = utmResult[0]?.unclassified ?? 0;
  results.push({
    step: 'utm_classification',
    result: `${classified} classified, ${unclassified} unclassified`,
  });

  // Step 6: Refresh materialized view
  await sql`REFRESH MATERIALIZED VIEW project_weekly_summary`;
  results.push({ step: 'materialized_view', result: 'project_weekly_summary refreshed' });

  return NextResponse.json({
    results,
    review: {
      aliases: aliases.slice(0, 20),
      channel_suggestions: suggestions.slice(0, 20),
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/projects/seed/route.ts
git commit -m "feat: add retroactive seed API — triggers full project discovery pipeline"
```

---

### Task 12: Python WP Seeder Script

**Files:**
- Create: `worker/scripts/seed_projects_from_wp.py`

- [ ] **Step 1: Create the WP seeder script**

```python
#!/usr/bin/env python3.12
"""Seed the projects table from WordPress job posts.

Pulls all published 'job' posts from the WP REST API and calls
seed_project_from_wp() for each one.

Usage:
    python3.12 worker/scripts/seed_projects_from_wp.py

Requires:
    WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD in environment or .env
    DATABASE_URL for Azure PG connection
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys

import asyncpg
import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────

WP_BASE_URL = os.environ.get("WP_BASE_URL", "https://oneforma.com")
WP_USERNAME = os.environ.get("WP_USERNAME", "")
WP_APP_PASSWORD = os.environ.get("WP_APP_PASSWORD", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

CODENAME_PATTERN = re.compile(
    r"(?:project[_\-\s]?)?([a-z][a-z0-9_\-]+)",
    re.IGNORECASE,
)


def extract_codename(title: str, slug: str) -> str:
    """Extract a codename from the job title or slug.

    Priority: explicit codename in title (e.g. 'Centaurus — MFA ...'),
    then slug with common suffixes stripped.
    """
    # Check for dash/em-dash separated codename prefix
    for sep in ["—", "–", "-", ":"]:
        if sep in title:
            candidate = title.split(sep)[0].strip().lower()
            candidate = re.sub(r"[^a-z0-9_\-]", "", candidate.replace(" ", "_"))
            if len(candidate) >= 3:
                return candidate

    # Fall back to slug, strip common WP suffixes
    clean = re.sub(r"-(job|position|role|hiring|apply|oneforma|2026|2025)$", "", slug)
    return clean.lower()


async def fetch_wp_jobs() -> list[dict]:
    """Fetch all published 'job' posts from WP REST API."""
    jobs: list[dict] = []
    page = 1
    auth = (WP_USERNAME, WP_APP_PASSWORD) if WP_USERNAME else None

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = f"{WP_BASE_URL}/wp-json/wp/v2/job?per_page=50&page={page}&status=publish"
            resp = await client.get(url, auth=auth)
            if resp.status_code != 200:
                logger.warning("WP API returned %d on page %d", resp.status_code, page)
                break
            batch = resp.json()
            if not batch:
                break
            jobs.extend(batch)
            page += 1
            logger.info("Fetched page %d (%d jobs so far)", page - 1, len(jobs))

    return jobs


async def seed_to_db(jobs: list[dict]) -> int:
    """Insert jobs into projects table via seed_project_from_wp()."""
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    seeded = 0

    async with pool.acquire() as conn:
        for job in jobs:
            title = job.get("title", {}).get("rendered", "Untitled")
            slug = job.get("slug", "")
            wp_id = job.get("id")
            published = job.get("date_gmt", "")
            codename = extract_codename(title, slug)

            # Extract countries from ACF fields if present
            acf = job.get("acf", {}) or {}
            countries: list[str] = []
            apply_rows = acf.get("apply_job", []) or []
            for row in apply_rows:
                lang = row.get("apply_language", "")
                if lang and lang not in countries:
                    countries.append(lang)

            try:
                project_id = await conn.fetchval(
                    "SELECT seed_project_from_wp($1, $2, $3, $4, $5::TIMESTAMPTZ, $6::TEXT[])",
                    codename, title, wp_id, slug,
                    published if published else None,
                    countries if countries else [],
                )
                logger.info("Seeded: %s → %s (id=%s)", codename, title[:40], project_id)
                seeded += 1
            except Exception as e:
                logger.error("Failed to seed %s: %s", codename, e)

    await pool.close()
    return seeded


async def main():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    logger.info("Fetching jobs from %s ...", WP_BASE_URL)
    jobs = await fetch_wp_jobs()
    logger.info("Found %d published jobs", len(jobs))

    if not jobs:
        logger.warning("No jobs found. Check WP_BASE_URL and credentials.")
        return

    seeded = await seed_to_db(jobs)
    logger.info("Done. Seeded %d / %d jobs into projects table.", seeded, len(jobs))


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Test the script can at least parse (dry run)**

```bash
cd /Users/stevenjunop/centric-intake && /opt/homebrew/bin/python3.12 -c "import ast; ast.parse(open('worker/scripts/seed_projects_from_wp.py').read()); print('Syntax OK')"
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add worker/scripts/seed_projects_from_wp.py
git commit -m "feat: add WP job seeder script — pulls all jobs into projects table"
```

---

### Task 13: Run Full Test Suite & Verify Build

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

```bash
cd /Users/stevenjunop/centric-intake && npx vitest run
```

Expected: All tests pass including the new `projects.test.ts` and `channels.test.ts`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Verify build succeeds**

```bash
cd /Users/stevenjunop/centric-intake && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Run migration on Azure PG**

```bash
psql "$DATABASE_URL" -f migrations/2026-05-18-project-registry.sql
```

Verify functions work:
```sql
SELECT normalize_utm_display('recruiter_jane_smith');
-- → 'Recruiter Jane Smith'

SELECT * FROM resolve_utm_channel('flyer_seattle', 'qr', 'centaurus');
-- → slug: flyer, label: seattle

SELECT count(*) FROM channel_definitions;
-- → 20
```

- [ ] **Step 5: Run WP seeder**

```bash
cd /Users/stevenjunop/centric-intake && /opt/homebrew/bin/python3.12 worker/scripts/seed_projects_from_wp.py
```

Expected: Jobs seeded into projects table. Check count:
```sql
SELECT count(*) FROM projects;
SELECT codename, display_name, wp_job_id FROM projects ORDER BY codename;
```

- [ ] **Step 6: Trigger retroactive seed**

```bash
curl -X POST http://localhost:3000/api/projects/seed \
  -H "Content-Type: application/json" \
  -H "Cookie: <clerk-session-cookie>"
```

Or via the running dev server UI. Expected: JSON with step results showing alias discoveries, intake links, channel suggestions, and UTM classification counts.
