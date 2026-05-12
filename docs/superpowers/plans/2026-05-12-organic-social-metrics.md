# Organic Social Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organic social media metrics infrastructure (Meta, LinkedIn, Reddit, GSC) with post-level tracking, asset attribution, account-level snapshots, and symmetric paid/organic drill-down dashboard widgets.

**Architecture:** Hybrid Option C — separate organic cache tables per platform + unified Postgres VIEW for cross-channel queries. Azure Python worker syncs every 6 hours via `organic_sync` job type. Frontend reads from cache tables via new API routes, rendered in 9 new dashboard widgets across 2 new widget categories.

**Tech Stack:** Python 3.13 + asyncpg + httpx (worker), Next.js + Neon serverless (frontend), Recharts (charts), Postgres VIEW (cross-channel)

**Spec:** `docs/superpowers/specs/2026-05-12-organic-social-metrics-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `migrations/2026-05-12-organic-social-metrics.sql`
- Modify: `src/lib/db/schema.ts` (add 6 tables + VIEW after line ~863)

- [ ] **Step 1: Create the migration SQL file**

```sql
-- migrations/2026-05-12-organic-social-metrics.sql
-- Organic social metrics + GSC + account snapshots + asset attribution + unified VIEW

-- 1. meta_organic_cache
CREATE TABLE IF NOT EXISTS meta_organic_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           TEXT NOT NULL,
  post_id           TEXT NOT NULL,
  post_type         TEXT,
  platform          TEXT NOT NULL,
  post_url          TEXT,
  post_text         TEXT,
  published_at      TIMESTAMPTZ,
  impressions       INT NOT NULL DEFAULT 0,
  reach             INT NOT NULL DEFAULT 0,
  engagement        INT NOT NULL DEFAULT 0,
  likes             INT NOT NULL DEFAULT 0,
  comments          INT NOT NULL DEFAULT 0,
  shares            INT NOT NULL DEFAULT 0,
  saves             INT NOT NULL DEFAULT 0,
  clicks            INT NOT NULL DEFAULT 0,
  video_views       INT DEFAULT 0,
  engagement_rate   FLOAT,
  raw_insights      JSONB DEFAULT '{}',
  date              DATE NOT NULL,
  last_synced_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meta_organic_post ON meta_organic_cache(post_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_organic_platform ON meta_organic_cache(platform, date DESC);
DO $$ BEGIN
  ALTER TABLE meta_organic_cache ADD CONSTRAINT meta_organic_cache_uq UNIQUE(page_id, post_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. linkedin_organic_cache
CREATE TABLE IF NOT EXISTS linkedin_organic_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              TEXT NOT NULL,
  post_id             TEXT NOT NULL,
  post_type           TEXT,
  post_url            TEXT,
  post_text           TEXT,
  published_at        TIMESTAMPTZ,
  impressions         INT NOT NULL DEFAULT 0,
  unique_impressions  INT DEFAULT 0,
  engagement          INT NOT NULL DEFAULT 0,
  likes               INT NOT NULL DEFAULT 0,
  comments            INT NOT NULL DEFAULT 0,
  shares              INT NOT NULL DEFAULT 0,
  clicks              INT NOT NULL DEFAULT 0,
  engagement_rate     FLOAT,
  raw_insights        JSONB DEFAULT '{}',
  date                DATE NOT NULL,
  last_synced_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_linkedin_organic_post ON linkedin_organic_cache(post_id, date DESC);
DO $$ BEGIN
  ALTER TABLE linkedin_organic_cache ADD CONSTRAINT linkedin_organic_cache_uq UNIQUE(org_id, post_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. reddit_organic_cache
CREATE TABLE IF NOT EXISTS reddit_organic_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  subreddit       TEXT NOT NULL,
  post_type       TEXT,
  post_url        TEXT,
  post_title      TEXT,
  post_text       TEXT,
  published_at    TIMESTAMPTZ,
  upvotes         INT NOT NULL DEFAULT 0,
  downvotes       INT DEFAULT 0,
  score           INT NOT NULL DEFAULT 0,
  comments        INT NOT NULL DEFAULT 0,
  upvote_ratio    FLOAT,
  crossposts      INT DEFAULT 0,
  awards          INT DEFAULT 0,
  raw_data        JSONB DEFAULT '{}',
  date            DATE NOT NULL,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reddit_organic_post ON reddit_organic_cache(post_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_organic_sub ON reddit_organic_cache(subreddit, date DESC);
DO $$ BEGIN
  ALTER TABLE reddit_organic_cache ADD CONSTRAINT reddit_organic_cache_uq UNIQUE(username, post_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. gsc_daily_cache
CREATE TABLE IF NOT EXISTS gsc_daily_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_url    TEXT NOT NULL,
  query           TEXT NOT NULL,
  page            TEXT NOT NULL,
  country         TEXT DEFAULT 'GLOBAL',
  device          TEXT DEFAULT 'ALL',
  clicks          INT NOT NULL DEFAULT 0,
  impressions     INT NOT NULL DEFAULT 0,
  ctr             FLOAT,
  position        FLOAT,
  date            DATE NOT NULL,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gsc_query ON gsc_daily_cache(query, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_page ON gsc_daily_cache(page, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_date ON gsc_daily_cache(date DESC);
DO $$ BEGIN
  ALTER TABLE gsc_daily_cache ADD CONSTRAINT gsc_daily_cache_uq UNIQUE(property_url, query, page, country, device, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. social_account_snapshots
CREATE TABLE IF NOT EXISTS social_account_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT NOT NULL,
  account_id          TEXT NOT NULL,
  account_name        TEXT,
  followers           INT DEFAULT 0,
  follower_delta      INT DEFAULT 0,
  total_reach         INT DEFAULT 0,
  total_impressions   INT DEFAULT 0,
  total_engagement    INT DEFAULT 0,
  post_count          INT DEFAULT 0,
  avg_engagement_rate FLOAT,
  profile_views       INT DEFAULT 0,
  date                DATE NOT NULL,
  last_synced_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_snapshots_platform ON social_account_snapshots(platform, date DESC);
DO $$ BEGIN
  ALTER TABLE social_account_snapshots ADD CONSTRAINT social_account_snapshots_uq UNIQUE(platform, account_id, date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. organic_post_assets
CREATE TABLE IF NOT EXISTS organic_post_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  asset_id        UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
  request_id      UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  matched_by      TEXT,
  confidence      FLOAT DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opa_asset ON organic_post_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_opa_request ON organic_post_assets(request_id);
CREATE INDEX IF NOT EXISTS idx_opa_source ON organic_post_assets(source);
DO $$ BEGIN
  ALTER TABLE organic_post_assets ADD CONSTRAINT organic_post_assets_uq UNIQUE(platform, post_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Unified VIEW
CREATE OR REPLACE VIEW channel_performance_unified AS
SELECT
  date, platform, channel, 'paid'::text as metric_type,
  impressions, clicks, spend, conversions,
  NULL::int as reach, NULL::int as engagement,
  NULL::int as likes, NULL::int as shares,
  NULL::int as saves, NULL::float as engagement_rate
FROM normalized_daily_metrics
UNION ALL
SELECT
  date, platform, platform as channel, 'organic'::text as metric_type,
  SUM(impressions)::int, SUM(clicks)::int, 0 as spend, 0 as conversions,
  SUM(reach)::int, SUM(engagement)::int,
  SUM(likes)::int, SUM(shares)::int,
  SUM(saves)::int, AVG(engagement_rate) as engagement_rate
FROM meta_organic_cache
GROUP BY date, platform
UNION ALL
SELECT
  date, 'linkedin' as platform, 'linkedin' as channel, 'organic'::text,
  SUM(impressions)::int, SUM(clicks)::int, 0, 0,
  SUM(unique_impressions)::int, SUM(engagement)::int,
  SUM(likes)::int, SUM(shares)::int,
  NULL::int, AVG(engagement_rate)
FROM linkedin_organic_cache
GROUP BY date
UNION ALL
SELECT
  date, 'reddit' as platform, 'reddit' as channel, 'organic'::text,
  0 as impressions, 0 as clicks, 0 as spend, 0 as conversions,
  0 as reach, SUM(score)::int as engagement,
  SUM(upvotes)::int as likes, NULL::int as shares,
  NULL::int as saves, AVG(upvote_ratio) as engagement_rate
FROM reddit_organic_cache
GROUP BY date;
```

- [ ] **Step 2: Add tables to `src/lib/db/schema.ts`**

Open `src/lib/db/schema.ts` and add the following AFTER the `brevo_campaign_metrics` table creation block (after line ~863, before the INDEXES section):

```typescript
  // 36. meta_organic_cache — organic post metrics from Meta Graph API (FB + IG)
  await sql`
    CREATE TABLE IF NOT EXISTS meta_organic_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id           TEXT NOT NULL,
      post_id           TEXT NOT NULL,
      post_type         TEXT,
      platform          TEXT NOT NULL,
      post_url          TEXT,
      post_text         TEXT,
      published_at      TIMESTAMPTZ,
      impressions       INT NOT NULL DEFAULT 0,
      reach             INT NOT NULL DEFAULT 0,
      engagement        INT NOT NULL DEFAULT 0,
      likes             INT NOT NULL DEFAULT 0,
      comments          INT NOT NULL DEFAULT 0,
      shares            INT NOT NULL DEFAULT 0,
      saves             INT NOT NULL DEFAULT 0,
      clicks            INT NOT NULL DEFAULT 0,
      video_views       INT DEFAULT 0,
      engagement_rate   FLOAT,
      raw_insights      JSONB DEFAULT '{}',
      date              DATE NOT NULL,
      last_synced_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_organic_post ON meta_organic_cache(post_id, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meta_organic_platform ON meta_organic_cache(platform, date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE meta_organic_cache ADD CONSTRAINT meta_organic_cache_uq UNIQUE(page_id, post_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 37. linkedin_organic_cache — organic post metrics from LinkedIn Marketing API
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
      unique_impressions  INT DEFAULT 0,
      engagement          INT NOT NULL DEFAULT 0,
      likes               INT NOT NULL DEFAULT 0,
      comments            INT NOT NULL DEFAULT 0,
      shares              INT NOT NULL DEFAULT 0,
      clicks              INT NOT NULL DEFAULT 0,
      engagement_rate     FLOAT,
      raw_insights        JSONB DEFAULT '{}',
      date                DATE NOT NULL,
      last_synced_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_linkedin_organic_post ON linkedin_organic_cache(post_id, date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE linkedin_organic_cache ADD CONSTRAINT linkedin_organic_cache_uq UNIQUE(org_id, post_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 38. reddit_organic_cache — organic post metrics from Reddit API
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_organic_cache (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username        TEXT NOT NULL,
      post_id         TEXT NOT NULL,
      subreddit       TEXT NOT NULL,
      post_type       TEXT,
      post_url        TEXT,
      post_title      TEXT,
      post_text       TEXT,
      published_at    TIMESTAMPTZ,
      upvotes         INT NOT NULL DEFAULT 0,
      downvotes       INT DEFAULT 0,
      score           INT NOT NULL DEFAULT 0,
      comments        INT NOT NULL DEFAULT 0,
      upvote_ratio    FLOAT,
      crossposts      INT DEFAULT 0,
      awards          INT DEFAULT 0,
      raw_data        JSONB DEFAULT '{}',
      date            DATE NOT NULL,
      last_synced_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_organic_post ON reddit_organic_cache(post_id, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reddit_organic_sub ON reddit_organic_cache(subreddit, date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE reddit_organic_cache ADD CONSTRAINT reddit_organic_cache_uq UNIQUE(username, post_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 39. gsc_daily_cache — Google Search Console query performance
  await sql`
    CREATE TABLE IF NOT EXISTS gsc_daily_cache (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_url    TEXT NOT NULL,
      query           TEXT NOT NULL,
      page            TEXT NOT NULL,
      country         TEXT DEFAULT 'GLOBAL',
      device          TEXT DEFAULT 'ALL',
      clicks          INT NOT NULL DEFAULT 0,
      impressions     INT NOT NULL DEFAULT 0,
      ctr             FLOAT,
      position        FLOAT,
      date            DATE NOT NULL,
      last_synced_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_gsc_query ON gsc_daily_cache(query, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gsc_page ON gsc_daily_cache(page, date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gsc_date ON gsc_daily_cache(date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE gsc_daily_cache ADD CONSTRAINT gsc_daily_cache_uq UNIQUE(property_url, query, page, country, device, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 40. social_account_snapshots — daily account-level rollup per platform
  await sql`
    CREATE TABLE IF NOT EXISTS social_account_snapshots (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform            TEXT NOT NULL,
      account_id          TEXT NOT NULL,
      account_name        TEXT,
      followers           INT DEFAULT 0,
      follower_delta      INT DEFAULT 0,
      total_reach         INT DEFAULT 0,
      total_impressions   INT DEFAULT 0,
      total_engagement    INT DEFAULT 0,
      post_count          INT DEFAULT 0,
      avg_engagement_rate FLOAT,
      profile_views       INT DEFAULT 0,
      date                DATE NOT NULL,
      last_synced_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_snapshots_platform ON social_account_snapshots(platform, date DESC)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE social_account_snapshots ADD CONSTRAINT social_account_snapshots_uq UNIQUE(platform, account_id, date);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // 41. organic_post_assets — attribution bridge: posts ↔ generated assets
  await sql`
    CREATE TABLE IF NOT EXISTS organic_post_assets (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform        TEXT NOT NULL,
      post_id         TEXT NOT NULL,
      asset_id        UUID REFERENCES generated_assets(id) ON DELETE SET NULL,
      request_id      UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
      source          TEXT NOT NULL DEFAULT 'manual',
      matched_by      TEXT,
      confidence      FLOAT DEFAULT 1.0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_opa_asset ON organic_post_assets(asset_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opa_request ON organic_post_assets(request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_opa_source ON organic_post_assets(source)`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE organic_post_assets ADD CONSTRAINT organic_post_assets_uq UNIQUE(platform, post_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  // VIEW: channel_performance_unified — unions paid + organic for cross-channel dashboards
  await sql`
    CREATE OR REPLACE VIEW channel_performance_unified AS
    SELECT date, platform, channel, 'paid'::text as metric_type,
           impressions, clicks, spend, conversions,
           NULL::int as reach, NULL::int as engagement,
           NULL::int as likes, NULL::int as shares,
           NULL::int as saves, NULL::float as engagement_rate
    FROM normalized_daily_metrics
    UNION ALL
    SELECT date, platform, platform as channel, 'organic'::text as metric_type,
           SUM(impressions)::int, SUM(clicks)::int, 0 as spend, 0 as conversions,
           SUM(reach)::int, SUM(engagement)::int,
           SUM(likes)::int, SUM(shares)::int,
           SUM(saves)::int, AVG(engagement_rate) as engagement_rate
    FROM meta_organic_cache GROUP BY date, platform
    UNION ALL
    SELECT date, 'linkedin' as platform, 'linkedin' as channel, 'organic'::text,
           SUM(impressions)::int, SUM(clicks)::int, 0, 0,
           SUM(unique_impressions)::int, SUM(engagement)::int,
           SUM(likes)::int, SUM(shares)::int, NULL::int, AVG(engagement_rate)
    FROM linkedin_organic_cache GROUP BY date
    UNION ALL
    SELECT date, 'reddit' as platform, 'reddit' as channel, 'organic'::text,
           0, 0, 0, 0, 0, SUM(score)::int,
           SUM(upvotes)::int, NULL::int, NULL::int, AVG(upvote_ratio)
    FROM reddit_organic_cache GROUP BY date
  `;
```

- [ ] **Step 3: Run migration against Neon**

```bash
cd /Users/stevenjunop/centric-intake
psql "$DATABASE_URL" -f migrations/2026-05-12-organic-social-metrics.sql
```

Expected: All `CREATE TABLE`, `CREATE INDEX`, and `CREATE OR REPLACE VIEW` succeed without errors.

- [ ] **Step 4: Verify tables exist**

```bash
psql "$DATABASE_URL" -c "\dt *organic*; \dt gsc_daily_cache; \dt social_account_snapshots; \dv channel_performance_unified;"
```

Expected: 6 tables and 1 view listed.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-05-12-organic-social-metrics.sql src/lib/db/schema.ts
git commit -m "feat: add 6 organic metrics tables + unified VIEW"
```

---

### Task 2: Worker Config + Environment Variables

**Files:**
- Modify: `worker/config.py` (add ~15 lines after line 121)
- Modify: `worker/.env.example` (add 12 env vars)
- Create: `worker/platforms/__init__.py`

- [ ] **Step 1: Add organic sync env vars to `worker/config.py`**

Add after the `NVIDIA_NIM_VQA_MODEL` line (end of file):

```python
# ---------------------------------------------------------------------------
# Organic Social Metrics Sync
# ---------------------------------------------------------------------------
META_PAGE_ACCESS_TOKEN = os.environ.get("META_PAGE_ACCESS_TOKEN", "")
META_PAGE_ID = os.environ.get("META_PAGE_ID", "")
META_IG_BUSINESS_ID = os.environ.get("META_IG_BUSINESS_ID", "")

LINKEDIN_ORG_ACCESS_TOKEN = os.environ.get("LINKEDIN_ORG_ACCESS_TOKEN", "")
LINKEDIN_ORG_ID = os.environ.get("LINKEDIN_ORG_ID", "")

REDDIT_CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
REDDIT_USERNAME = os.environ.get("REDDIT_USERNAME", "")
REDDIT_PASSWORD = os.environ.get("REDDIT_PASSWORD", "")

GSC_SERVICE_ACCOUNT_JSON = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")
GSC_PROPERTY_URL = os.environ.get("GSC_PROPERTY_URL", "")

ORGANIC_SYNC_DAYS = int(os.environ.get("ORGANIC_SYNC_DAYS", "7"))
```

- [ ] **Step 2: Add env vars to `worker/.env.example`**

Append to end of file:

```env
# Organic Social Metrics Sync
META_PAGE_ACCESS_TOKEN=
META_PAGE_ID=
META_IG_BUSINESS_ID=
LINKEDIN_ORG_ACCESS_TOKEN=
LINKEDIN_ORG_ID=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=
GSC_SERVICE_ACCOUNT_JSON=
GSC_PROPERTY_URL=
ORGANIC_SYNC_DAYS=7
```

- [ ] **Step 3: Create `worker/platforms/__init__.py`**

```python
"""Platform sync clients for organic social metrics."""
```

- [ ] **Step 4: Commit**

```bash
git add worker/config.py worker/.env.example worker/platforms/__init__.py
git commit -m "feat: add organic sync config + env vars + platforms package"
```

---

### Task 3: Meta Organic Client

**Files:**
- Create: `worker/platforms/meta_organic.py`
- Create: `worker/tests/test_meta_organic.py`

- [ ] **Step 1: Write the test file**

```python
# worker/tests/test_meta_organic.py
"""Unit tests for Meta organic client — no network calls."""
import pytest
from datetime import datetime, timezone


class TestMetaOrganicClient:

    def _make_graph_post(self, post_id="123_456", message="Hello world",
                         post_type="photo", created_time="2026-05-10T12:00:00+0000"):
        return {
            "id": post_id,
            "message": message,
            "type": post_type,
            "created_time": created_time,
            "permalink_url": f"https://facebook.com/{post_id}",
        }

    def _make_insights(self, impressions=100, reach=80, engagement=15,
                       likes=10, comments=3, shares=2, saves=0, clicks=5):
        return {
            "data": [
                {"name": "post_impressions", "values": [{"value": impressions}]},
                {"name": "post_impressions_unique", "values": [{"value": reach}]},
                {"name": "post_engaged_users", "values": [{"value": engagement}]},
                {"name": "post_reactions_like_total", "values": [{"value": likes}]},
                {"name": "post_comments", "values": [{"value": comments}]},
                {"name": "post_shares", "values": [{"value": shares}]},
                {"name": "post_saved", "values": [{"value": saves}]},
                {"name": "post_clicks", "values": [{"value": clicks}]},
            ]
        }

    def test_parse_post_data(self):
        from platforms.meta_organic import _parse_post
        post = self._make_graph_post()
        result = _parse_post(post, "facebook")
        assert result["post_id"] == "123_456"
        assert result["platform"] == "facebook"
        assert result["post_type"] == "photo"
        assert result["post_text"] == "Hello world"

    def test_parse_insights_data(self):
        from platforms.meta_organic import _parse_insights
        raw = self._make_insights(impressions=200, reach=150, likes=20)
        result = _parse_insights(raw)
        assert result["impressions"] == 200
        assert result["reach"] == 150
        assert result["likes"] == 20

    def test_parse_insights_missing_metrics(self):
        from platforms.meta_organic import _parse_insights
        result = _parse_insights({"data": []})
        assert result["impressions"] == 0
        assert result["reach"] == 0

    def test_is_connected_false(self):
        from platforms.meta_organic import MetaOrganicClient
        client = MetaOrganicClient(db=None, page_id="", token="", ig_id="")
        assert client.is_connected() is False

    def test_is_connected_true(self):
        from platforms.meta_organic import MetaOrganicClient
        client = MetaOrganicClient(db=None, page_id="123", token="tok", ig_id="456")
        assert client.is_connected() is True

    def test_engagement_rate_calc(self):
        from platforms.meta_organic import _calc_engagement_rate
        assert _calc_engagement_rate(engagement=10, reach=100) == pytest.approx(0.1)
        assert _calc_engagement_rate(engagement=10, reach=0) is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_meta_organic.py -v
```

Expected: `ModuleNotFoundError: No module named 'platforms.meta_organic'`

- [ ] **Step 3: Implement `worker/platforms/meta_organic.py`**

```python
"""Meta organic client — Facebook Page + Instagram Business insights via Graph API v21.0."""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v21.0"

POST_INSIGHT_METRICS = (
    "post_impressions,post_impressions_unique,post_engaged_users,"
    "post_reactions_like_total,post_comments,post_shares,post_saved,post_clicks"
)

IG_MEDIA_METRICS = "impressions,reach,engagement,likes,comments,shares,saved"


def _parse_post(post: dict, platform: str) -> dict:
    """Extract normalized fields from a Graph API post object."""
    return {
        "post_id": post["id"],
        "platform": platform,
        "post_type": post.get("type", post.get("media_type", "unknown")).lower(),
        "post_url": post.get("permalink_url", post.get("permalink", "")),
        "post_text": post.get("message", post.get("caption", "")),
        "published_at": post.get("created_time", post.get("timestamp")),
    }


def _parse_insights(raw: dict) -> dict:
    """Extract metric values from a Graph API insights response."""
    metrics = {}
    mapping = {
        "post_impressions": "impressions",
        "post_impressions_unique": "reach",
        "post_engaged_users": "engagement",
        "post_reactions_like_total": "likes",
        "post_comments": "comments",
        "post_shares": "shares",
        "post_saved": "saves",
        "post_clicks": "clicks",
        # IG metrics
        "impressions": "impressions",
        "reach": "reach",
        "engagement": "engagement",
        "likes": "likes",
        "comments": "comments",
        "shares": "shares",
        "saved": "saves",
    }
    for item in raw.get("data", []):
        name = item.get("name", "")
        if name in mapping:
            values = item.get("values", [{}])
            metrics[mapping[name]] = values[0].get("value", 0) if values else 0
    # Fill defaults
    for key in ("impressions", "reach", "engagement", "likes", "comments", "shares", "saves", "clicks"):
        metrics.setdefault(key, 0)
    return metrics


def _calc_engagement_rate(engagement: int, reach: int) -> float | None:
    if reach == 0:
        return None
    return engagement / reach


class MetaOrganicClient:
    def __init__(self, db, page_id: str, token: str, ig_id: str):
        self.db = db
        self.page_id = page_id
        self.token = token
        self.ig_id = ig_id

    def is_connected(self) -> bool:
        return bool(self.page_id and self.token)

    async def sync(self, days: int = 7) -> dict:
        """Fetch FB page posts + IG media, upsert to meta_organic_cache."""
        if not self.is_connected():
            return {"platform": "meta_organic", "success": False, "posts_synced": 0, "errors": 0, "message": "Not configured"}

        total_synced = 0
        errors = 0
        since = datetime.now(timezone.utc) - timedelta(days=days)
        since_ts = int(since.timestamp())

        async with httpx.AsyncClient(timeout=30) as client:
            # Facebook Page posts
            try:
                fb_posts = await self._fetch_fb_posts(client, since_ts)
                for post in fb_posts:
                    try:
                        insights = await self._fetch_fb_insights(client, post["id"])
                        await self._upsert_post(post, insights, "facebook")
                        total_synced += 1
                    except Exception as e:
                        logger.warning("Failed to sync FB post %s: %s", post.get("id"), e)
                        errors += 1
            except Exception as e:
                logger.error("Failed to fetch FB posts: %s", e)
                errors += 1

            # Instagram Business media
            if self.ig_id:
                try:
                    ig_media = await self._fetch_ig_media(client, since_ts)
                    for media in ig_media:
                        try:
                            insights = await self._fetch_ig_insights(client, media["id"])
                            await self._upsert_post(media, insights, "instagram")
                            total_synced += 1
                        except Exception as e:
                            logger.warning("Failed to sync IG media %s: %s", media.get("id"), e)
                            errors += 1
                except Exception as e:
                    logger.error("Failed to fetch IG media: %s", e)
                    errors += 1

        return {"platform": "meta_organic", "success": True, "posts_synced": total_synced, "errors": errors, "message": f"Synced {total_synced} posts"}

    async def _fetch_fb_posts(self, client: httpx.AsyncClient, since_ts: int) -> list:
        url = f"{GRAPH_API_BASE}/{self.page_id}/posts"
        params = {
            "fields": "id,message,type,created_time,permalink_url",
            "since": since_ts,
            "limit": 100,
            "access_token": self.token,
        }
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json().get("data", [])

    async def _fetch_fb_insights(self, client: httpx.AsyncClient, post_id: str) -> dict:
        url = f"{GRAPH_API_BASE}/{post_id}/insights"
        params = {"metric": POST_INSIGHT_METRICS, "access_token": self.token}
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _fetch_ig_media(self, client: httpx.AsyncClient, since_ts: int) -> list:
        url = f"{GRAPH_API_BASE}/{self.ig_id}/media"
        params = {
            "fields": "id,caption,media_type,timestamp,permalink",
            "since": since_ts,
            "limit": 100,
            "access_token": self.token,
        }
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json().get("data", [])

    async def _fetch_ig_insights(self, client: httpx.AsyncClient, media_id: str) -> dict:
        url = f"{GRAPH_API_BASE}/{media_id}/insights"
        params = {"metric": IG_MEDIA_METRICS, "access_token": self.token}
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _upsert_post(self, post: dict, insights_raw: dict, platform: str) -> None:
        parsed = _parse_post(post, platform)
        metrics = _parse_insights(insights_raw)
        eng_rate = _calc_engagement_rate(metrics["engagement"], metrics["reach"])
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        async with self.db.acquire() as conn:
            await conn.execute("""
                INSERT INTO meta_organic_cache (
                    page_id, post_id, post_type, platform, post_url, post_text, published_at,
                    impressions, reach, engagement, likes, comments, shares, saves, clicks,
                    video_views, engagement_rate, raw_insights, date
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::date)
                ON CONFLICT (page_id, post_id, date) DO UPDATE SET
                    impressions=EXCLUDED.impressions, reach=EXCLUDED.reach,
                    engagement=EXCLUDED.engagement, likes=EXCLUDED.likes,
                    comments=EXCLUDED.comments, shares=EXCLUDED.shares,
                    saves=EXCLUDED.saves, clicks=EXCLUDED.clicks,
                    video_views=EXCLUDED.video_views, engagement_rate=EXCLUDED.engagement_rate,
                    raw_insights=EXCLUDED.raw_insights, last_synced_at=NOW()
            """,
                self.page_id, parsed["post_id"], parsed["post_type"], platform,
                parsed["post_url"], parsed["post_text"], parsed["published_at"],
                metrics["impressions"], metrics["reach"], metrics["engagement"],
                metrics["likes"], metrics["comments"], metrics["shares"],
                metrics["saves"], metrics["clicks"],
                metrics.get("video_views", 0), eng_rate,
                __import__("json").dumps(insights_raw), today,
            )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_meta_organic.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/platforms/meta_organic.py worker/tests/test_meta_organic.py
git commit -m "feat: add Meta organic client (FB Page + IG Business insights)"
```

---

### Task 4: LinkedIn Organic Client

**Files:**
- Create: `worker/platforms/linkedin_organic.py`
- Create: `worker/tests/test_linkedin_organic.py`

- [ ] **Step 1: Write the test file**

```python
# worker/tests/test_linkedin_organic.py
"""Unit tests for LinkedIn organic client."""
import pytest


class TestLinkedInOrganicClient:

    def _make_share(self, share_id="urn:li:share:123", text="Check out OneForma"):
        return {
            "id": share_id,
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "IMAGE",
                }
            },
            "created": {"time": 1715356800000},
        }

    def _make_stats(self, impressions=500, unique_impressions=350, clicks=25,
                    likes=40, comments=5, shares=3, engagement=73):
        return {
            "totalShareStatistics": {
                "impressionCount": impressions,
                "uniqueImpressionsCount": unique_impressions,
                "clickCount": clicks,
                "likeCount": likes,
                "commentCount": comments,
                "shareCount": shares,
                "engagement": engagement,
            }
        }

    def test_parse_share(self):
        from platforms.linkedin_organic import _parse_share
        share = self._make_share()
        result = _parse_share(share)
        assert result["post_id"] == "urn:li:share:123"
        assert result["post_text"] == "Check out OneForma"
        assert result["post_type"] == "image"

    def test_parse_stats(self):
        from platforms.linkedin_organic import _parse_stats
        stats = self._make_stats(impressions=500, clicks=25)
        result = _parse_stats(stats)
        assert result["impressions"] == 500
        assert result["clicks"] == 25

    def test_parse_stats_empty(self):
        from platforms.linkedin_organic import _parse_stats
        result = _parse_stats({})
        assert result["impressions"] == 0

    def test_is_connected(self):
        from platforms.linkedin_organic import LinkedInOrganicClient
        client = LinkedInOrganicClient(db=None, org_id="123", token="tok")
        assert client.is_connected() is True
        client2 = LinkedInOrganicClient(db=None, org_id="", token="")
        assert client2.is_connected() is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_linkedin_organic.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `worker/platforms/linkedin_organic.py`**

```python
"""LinkedIn organic client — Organization page analytics via Marketing API v2."""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

LI_API_BASE = "https://api.linkedin.com/v2"


def _parse_share(share: dict) -> dict:
    """Extract normalized fields from a LinkedIn UGC post."""
    content = share.get("specificContent", {}).get("com.linkedin.ugc.ShareContent", {})
    media_cat = content.get("shareMediaCategory", "NONE").lower()
    text = content.get("shareCommentary", {}).get("text", "")
    created_ms = share.get("created", {}).get("time", 0)
    published = datetime.fromtimestamp(created_ms / 1000, tz=timezone.utc).isoformat() if created_ms else None
    return {
        "post_id": share.get("id", ""),
        "post_type": media_cat,
        "post_text": text,
        "published_at": published,
        "post_url": f"https://www.linkedin.com/feed/update/{share.get('id', '')}",
    }


def _parse_stats(stats: dict) -> dict:
    """Extract metrics from LinkedIn share statistics."""
    s = stats.get("totalShareStatistics", {})
    return {
        "impressions": s.get("impressionCount", 0),
        "unique_impressions": s.get("uniqueImpressionsCount", 0),
        "engagement": s.get("engagement", 0),
        "likes": s.get("likeCount", 0),
        "comments": s.get("commentCount", 0),
        "shares": s.get("shareCount", 0),
        "clicks": s.get("clickCount", 0),
    }


class LinkedInOrganicClient:
    def __init__(self, db, org_id: str, token: str):
        self.db = db
        self.org_id = org_id
        self.token = token

    def is_connected(self) -> bool:
        return bool(self.org_id and self.token)

    async def sync(self, days: int = 7) -> dict:
        if not self.is_connected():
            return {"platform": "linkedin_organic", "success": False, "posts_synced": 0, "errors": 0, "message": "Not configured"}

        total_synced = 0
        errors = 0
        headers = {"Authorization": f"Bearer {self.token}", "X-Restli-Protocol-Version": "2.0.0"}

        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            try:
                shares = await self._fetch_shares(client)
                for share in shares:
                    try:
                        stats = await self._fetch_share_stats(client, share["id"])
                        await self._upsert_post(share, stats)
                        total_synced += 1
                    except Exception as e:
                        logger.warning("Failed to sync LI share %s: %s", share.get("id"), e)
                        errors += 1
            except Exception as e:
                logger.error("Failed to fetch LI shares: %s", e)
                errors += 1

        return {"platform": "linkedin_organic", "success": True, "posts_synced": total_synced, "errors": errors, "message": f"Synced {total_synced} posts"}

    async def _fetch_shares(self, client: httpx.AsyncClient) -> list:
        url = f"{LI_API_BASE}/ugcPosts"
        params = {"q": "authors", "authors": f"List(urn:li:organization:{self.org_id})", "count": 100}
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json().get("elements", [])

    async def _fetch_share_stats(self, client: httpx.AsyncClient, share_urn: str) -> dict:
        url = f"{LI_API_BASE}/organizationalEntityShareStatistics"
        params = {"q": "organizationalEntity", "organizationalEntity": f"urn:li:organization:{self.org_id}", "shares": f"List({share_urn})"}
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        return elements[0] if elements else {}

    async def _upsert_post(self, share: dict, stats: dict) -> None:
        parsed = _parse_share(share)
        metrics = _parse_stats(stats)
        eng_rate = metrics["engagement"] / metrics["impressions"] if metrics["impressions"] > 0 else None
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        async with self.db.acquire() as conn:
            await conn.execute("""
                INSERT INTO linkedin_organic_cache (
                    org_id, post_id, post_type, post_url, post_text, published_at,
                    impressions, unique_impressions, engagement, likes, comments, shares, clicks,
                    engagement_rate, raw_insights, date
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::date)
                ON CONFLICT (org_id, post_id, date) DO UPDATE SET
                    impressions=EXCLUDED.impressions, unique_impressions=EXCLUDED.unique_impressions,
                    engagement=EXCLUDED.engagement, likes=EXCLUDED.likes,
                    comments=EXCLUDED.comments, shares=EXCLUDED.shares, clicks=EXCLUDED.clicks,
                    engagement_rate=EXCLUDED.engagement_rate, raw_insights=EXCLUDED.raw_insights,
                    last_synced_at=NOW()
            """,
                self.org_id, parsed["post_id"], parsed["post_type"],
                parsed["post_url"], parsed["post_text"], parsed["published_at"],
                metrics["impressions"], metrics["unique_impressions"], metrics["engagement"],
                metrics["likes"], metrics["comments"], metrics["shares"], metrics["clicks"],
                eng_rate, __import__("json").dumps(stats), today,
            )
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_linkedin_organic.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/platforms/linkedin_organic.py worker/tests/test_linkedin_organic.py
git commit -m "feat: add LinkedIn organic client (org page analytics)"
```

---

### Task 5: Reddit Organic + GSC Clients

**Files:**
- Create: `worker/platforms/reddit_organic.py`
- Create: `worker/platforms/gsc_client.py`
- Create: `worker/tests/test_reddit_organic.py`
- Create: `worker/tests/test_gsc_client.py`

- [ ] **Step 1: Write Reddit test file**

```python
# worker/tests/test_reddit_organic.py
"""Unit tests for Reddit organic client."""
import pytest


class TestRedditOrganicClient:

    def _make_post(self, name="t3_abc123", title="Join OneForma", subreddit="workonline",
                   score=42, ups=50, upvote_ratio=0.85, num_comments=7):
        return {
            "data": {
                "name": name,
                "title": title,
                "selftext": "We are hiring contributors...",
                "subreddit": subreddit,
                "url": f"https://reddit.com/r/{subreddit}/comments/abc123/",
                "permalink": f"/r/{subreddit}/comments/abc123/join_oneforma/",
                "score": score,
                "ups": ups,
                "upvote_ratio": upvote_ratio,
                "num_comments": num_comments,
                "num_crossposts": 0,
                "total_awards_received": 0,
                "created_utc": 1715356800.0,
                "post_hint": "self",
            }
        }

    def test_parse_post(self):
        from platforms.reddit_organic import _parse_reddit_post
        raw = self._make_post()
        result = _parse_reddit_post(raw["data"])
        assert result["post_id"] == "t3_abc123"
        assert result["subreddit"] == "workonline"
        assert result["score"] == 42
        assert result["upvote_ratio"] == 0.85

    def test_is_connected(self):
        from platforms.reddit_organic import RedditOrganicClient
        c = RedditOrganicClient(db=None, client_id="id", client_secret="sec", username="u", password="p")
        assert c.is_connected() is True
        c2 = RedditOrganicClient(db=None, client_id="", client_secret="", username="", password="")
        assert c2.is_connected() is False
```

- [ ] **Step 2: Write GSC test file**

```python
# worker/tests/test_gsc_client.py
"""Unit tests for GSC client."""
import pytest


class TestGscClient:

    def _make_row(self, query="oneforma jobs", page="https://oneforma.com/", clicks=50, impressions=1000, ctr=0.05, position=3.2):
        return {"keys": [query, page, "usa", "DESKTOP"], "clicks": clicks, "impressions": impressions, "ctr": ctr, "position": position}

    def test_parse_row(self):
        from platforms.gsc_client import _parse_gsc_row
        raw = self._make_row()
        result = _parse_gsc_row(raw)
        assert result["query"] == "oneforma jobs"
        assert result["page"] == "https://oneforma.com/"
        assert result["clicks"] == 50
        assert result["position"] == 3.2
        assert result["country"] == "usa"
        assert result["device"] == "DESKTOP"

    def test_parse_row_missing_keys(self):
        from platforms.gsc_client import _parse_gsc_row
        raw = {"keys": ["query only"], "clicks": 1, "impressions": 10, "ctr": 0.1, "position": 5.0}
        result = _parse_gsc_row(raw)
        assert result["query"] == "query only"
        assert result["page"] == ""
        assert result["country"] == "GLOBAL"

    def test_is_connected(self):
        from platforms.gsc_client import GscSyncClient
        c = GscSyncClient(db=None, service_account_json="path.json", property_url="sc-domain:oneforma.com")
        assert c.is_connected() is True
        c2 = GscSyncClient(db=None, service_account_json="", property_url="")
        assert c2.is_connected() is False
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_reddit_organic.py tests/test_gsc_client.py -v
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `worker/platforms/reddit_organic.py`**

```python
"""Reddit organic client — user submissions via Reddit API (OAuth2 script type)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"
USER_AGENT = "oneforma-metrics:v1.0 (by /u/OneForma)"


def _parse_reddit_post(data: dict) -> dict:
    """Extract normalized fields from a Reddit post data dict."""
    return {
        "post_id": data.get("name", ""),
        "subreddit": data.get("subreddit", ""),
        "post_type": data.get("post_hint", "self"),
        "post_url": f"https://reddit.com{data.get('permalink', '')}",
        "post_title": data.get("title", ""),
        "post_text": data.get("selftext", ""),
        "published_at": datetime.fromtimestamp(data.get("created_utc", 0), tz=timezone.utc).isoformat(),
        "upvotes": data.get("ups", 0),
        "downvotes": max(0, data.get("ups", 0) - data.get("score", 0)),
        "score": data.get("score", 0),
        "comments": data.get("num_comments", 0),
        "upvote_ratio": data.get("upvote_ratio", 0.0),
        "crossposts": data.get("num_crossposts", 0),
        "awards": data.get("total_awards_received", 0),
    }


class RedditOrganicClient:
    def __init__(self, db, client_id: str, client_secret: str, username: str, password: str):
        self.db = db
        self.client_id = client_id
        self.client_secret = client_secret
        self.username = username
        self.password = password

    def is_connected(self) -> bool:
        return bool(self.client_id and self.client_secret and self.username and self.password)

    async def sync(self, days: int = 7) -> dict:
        if not self.is_connected():
            return {"platform": "reddit_organic", "success": False, "posts_synced": 0, "errors": 0, "message": "Not configured"}

        total_synced = 0
        errors = 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                token = await self._get_token(client)
                headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
                posts = await self._fetch_user_posts(client, headers)

                for post_wrapper in posts:
                    data = post_wrapper.get("data", post_wrapper)
                    created = datetime.fromtimestamp(data.get("created_utc", 0), tz=timezone.utc)
                    if created < cutoff:
                        continue
                    try:
                        await self._upsert_post(data)
                        total_synced += 1
                    except Exception as e:
                        logger.warning("Failed to sync Reddit post %s: %s", data.get("name"), e)
                        errors += 1
            except Exception as e:
                logger.error("Reddit sync failed: %s", e)
                errors += 1

        return {"platform": "reddit_organic", "success": True, "posts_synced": total_synced, "errors": errors, "message": f"Synced {total_synced} posts"}

    async def _get_token(self, client: httpx.AsyncClient) -> str:
        resp = await client.post(
            REDDIT_AUTH_URL,
            data={"grant_type": "password", "username": self.username, "password": self.password},
            auth=(self.client_id, self.client_secret),
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    async def _fetch_user_posts(self, client: httpx.AsyncClient, headers: dict) -> list:
        url = f"{REDDIT_API_BASE}/user/{self.username}/submitted"
        resp = await client.get(url, params={"limit": 100, "sort": "new"}, headers=headers)
        resp.raise_for_status()
        return resp.json().get("data", {}).get("children", [])

    async def _upsert_post(self, data: dict) -> None:
        parsed = _parse_reddit_post(data)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        import json

        async with self.db.acquire() as conn:
            await conn.execute("""
                INSERT INTO reddit_organic_cache (
                    username, post_id, subreddit, post_type, post_url, post_title, post_text,
                    published_at, upvotes, downvotes, score, comments, upvote_ratio,
                    crossposts, awards, raw_data, date
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::date)
                ON CONFLICT (username, post_id, date) DO UPDATE SET
                    upvotes=EXCLUDED.upvotes, downvotes=EXCLUDED.downvotes, score=EXCLUDED.score,
                    comments=EXCLUDED.comments, upvote_ratio=EXCLUDED.upvote_ratio,
                    crossposts=EXCLUDED.crossposts, awards=EXCLUDED.awards,
                    raw_data=EXCLUDED.raw_data, last_synced_at=NOW()
            """,
                self.username, parsed["post_id"], parsed["subreddit"], parsed["post_type"],
                parsed["post_url"], parsed["post_title"], parsed["post_text"],
                parsed["published_at"], parsed["upvotes"], parsed["downvotes"],
                parsed["score"], parsed["comments"], parsed["upvote_ratio"],
                parsed["crossposts"], parsed["awards"], json.dumps(data), today,
            )
```

- [ ] **Step 5: Implement `worker/platforms/gsc_client.py`**

```python
"""Google Search Console client — query performance via Search Console API."""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3"


def _parse_gsc_row(row: dict) -> dict:
    """Parse a GSC API response row into normalized fields."""
    keys = row.get("keys", [])
    return {
        "query": keys[0] if len(keys) > 0 else "",
        "page": keys[1] if len(keys) > 1 else "",
        "country": keys[2] if len(keys) > 2 else "GLOBAL",
        "device": keys[3] if len(keys) > 3 else "ALL",
        "clicks": row.get("clicks", 0),
        "impressions": row.get("impressions", 0),
        "ctr": row.get("ctr", 0.0),
        "position": row.get("position", 0.0),
    }


class GscSyncClient:
    def __init__(self, db, service_account_json: str, property_url: str):
        self.db = db
        self.service_account_json = service_account_json
        self.property_url = property_url

    def is_connected(self) -> bool:
        return bool(self.service_account_json and self.property_url)

    async def sync(self, days: int = 7) -> dict:
        if not self.is_connected():
            return {"platform": "gsc", "success": False, "rows_synced": 0, "errors": 0, "message": "Not configured"}

        total_synced = 0
        errors = 0
        end_date = datetime.now(timezone.utc) - timedelta(days=3)  # GSC data has ~3 day lag
        start_date = end_date - timedelta(days=days)

        try:
            token = await self._get_access_token()
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

            async with httpx.AsyncClient(timeout=60, headers=headers) as client:
                url = f"{GSC_API_BASE}/sites/{self.property_url}/searchAnalytics/query"
                body = {
                    "startDate": start_date.strftime("%Y-%m-%d"),
                    "endDate": end_date.strftime("%Y-%m-%d"),
                    "dimensions": ["query", "page", "country", "device"],
                    "rowLimit": 5000,
                }
                resp = await client.post(url, json=body)
                resp.raise_for_status()
                rows = resp.json().get("rows", [])

                for row in rows:
                    try:
                        parsed = _parse_gsc_row(row)
                        await self._upsert_row(parsed, end_date.strftime("%Y-%m-%d"))
                        total_synced += 1
                    except Exception as e:
                        logger.warning("Failed to upsert GSC row: %s", e)
                        errors += 1

        except Exception as e:
            logger.error("GSC sync failed: %s", e)
            return {"platform": "gsc", "success": False, "rows_synced": 0, "errors": 1, "message": str(e)}

        return {"platform": "gsc", "success": True, "rows_synced": total_synced, "errors": errors, "message": f"Synced {total_synced} rows"}

    async def _get_access_token(self) -> str:
        """Get OAuth2 token from service account JSON using JWT grant."""
        import json
        import time
        import base64
        import hashlib
        import hmac

        # For production: use google-auth library. For now, JWT assertion flow.
        # This requires `google-auth` package. If not available, use httpx JWT.
        try:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request

            creds = service_account.Credentials.from_service_account_file(
                self.service_account_json,
                scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
            )
            creds.refresh(Request())
            return creds.token
        except ImportError:
            logger.error("google-auth package not installed — required for GSC sync")
            raise

    async def _upsert_row(self, parsed: dict, date: str) -> None:
        async with self.db.acquire() as conn:
            await conn.execute("""
                INSERT INTO gsc_daily_cache (
                    property_url, query, page, country, device,
                    clicks, impressions, ctr, position, date
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date)
                ON CONFLICT (property_url, query, page, country, device, date) DO UPDATE SET
                    clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions,
                    ctr=EXCLUDED.ctr, position=EXCLUDED.position, last_synced_at=NOW()
            """,
                self.property_url, parsed["query"], parsed["page"],
                parsed["country"], parsed["device"],
                parsed["clicks"], parsed["impressions"],
                parsed["ctr"], parsed["position"], date,
            )
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_reddit_organic.py tests/test_gsc_client.py -v
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/platforms/reddit_organic.py worker/platforms/gsc_client.py worker/tests/test_reddit_organic.py worker/tests/test_gsc_client.py
git commit -m "feat: add Reddit organic + GSC sync clients"
```

---

### Task 6: Account Snapshotter + Asset Matcher

**Files:**
- Create: `worker/platforms/account_snapshotter.py`
- Create: `worker/platforms/asset_matcher.py`
- Create: `worker/tests/test_asset_matcher.py`

- [ ] **Step 1: Write asset matcher tests**

```python
# worker/tests/test_asset_matcher.py
"""Unit tests for asset matcher — matching strategies."""
import pytest


class TestAssetMatcher:

    def test_utm_match_extracts_slug(self):
        from platforms.asset_matcher import _extract_tracked_slug
        assert _extract_tracked_slug("https://go.oneforma.com/r/abc123") == "abc123"
        assert _extract_tracked_slug("Check out go.oneforma.com/r/xyz") == "xyz"
        assert _extract_tracked_slug("https://example.com/no-match") is None

    def test_url_match_extracts_domain(self):
        from platforms.asset_matcher import _extract_urls
        urls = _extract_urls("Visit https://oneforma.com/apply and sign up")
        assert "https://oneforma.com/apply" in urls

    def test_url_match_no_urls(self):
        from platforms.asset_matcher import _extract_urls
        assert _extract_urls("No links here") == []

    def test_fuzzy_match_score(self):
        from platforms.asset_matcher import _text_similarity
        score = _text_similarity("Join OneForma today as a data contributor", "Join OneForma today as a data contributor!")
        assert score > 0.9
        score2 = _text_similarity("Completely different text", "Nothing alike at all")
        assert score2 < 0.5
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_asset_matcher.py -v
```

- [ ] **Step 3: Implement `worker/platforms/account_snapshotter.py`**

```python
"""Account snapshotter — computes daily account-level rollups from post caches."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def snapshot_accounts(db) -> dict:
    """Read today's post-level data from all platform caches, aggregate, and upsert to social_account_snapshots."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    results = {}

    async with db.acquire() as conn:
        # Meta (Facebook + Instagram)
        for platform in ("facebook", "instagram"):
            row = await conn.fetchrow("""
                SELECT COUNT(DISTINCT post_id) as post_count,
                       COALESCE(SUM(impressions), 0) as total_impressions,
                       COALESCE(SUM(reach), 0) as total_reach,
                       COALESCE(SUM(engagement), 0) as total_engagement,
                       AVG(engagement_rate) as avg_engagement_rate,
                       MIN(page_id) as account_id
                FROM meta_organic_cache
                WHERE platform = $1 AND date = $2::date
            """, platform, today)
            if row and row["account_id"]:
                await _upsert_snapshot(conn, platform, row["account_id"], platform.title(), row, today)
                results[platform] = True

        # LinkedIn
        row = await conn.fetchrow("""
            SELECT COUNT(DISTINCT post_id) as post_count,
                   COALESCE(SUM(impressions), 0) as total_impressions,
                   COALESCE(SUM(unique_impressions), 0) as total_reach,
                   COALESCE(SUM(engagement), 0) as total_engagement,
                   AVG(engagement_rate) as avg_engagement_rate,
                   MIN(org_id) as account_id
            FROM linkedin_organic_cache WHERE date = $1::date
        """, today)
        if row and row["account_id"]:
            await _upsert_snapshot(conn, "linkedin", row["account_id"], "OneForma LinkedIn", row, today)
            results["linkedin"] = True

        # Reddit
        row = await conn.fetchrow("""
            SELECT COUNT(DISTINCT post_id) as post_count,
                   0 as total_impressions,
                   0 as total_reach,
                   COALESCE(SUM(score), 0) as total_engagement,
                   AVG(upvote_ratio) as avg_engagement_rate,
                   MIN(username) as account_id
            FROM reddit_organic_cache WHERE date = $1::date
        """, today)
        if row and row["account_id"]:
            await _upsert_snapshot(conn, "reddit", row["account_id"], "OneForma Reddit", row, today)
            results["reddit"] = True

    logger.info("Account snapshots computed for %d platforms", len(results))
    return results


async def _upsert_snapshot(conn, platform: str, account_id: str, account_name: str, row, today: str) -> None:
    # Get previous follower count for delta calc
    prev = await conn.fetchrow("""
        SELECT followers FROM social_account_snapshots
        WHERE platform = $1 AND account_id = $2 AND date < $3::date
        ORDER BY date DESC LIMIT 1
    """, platform, account_id, today)
    prev_followers = prev["followers"] if prev else 0

    await conn.execute("""
        INSERT INTO social_account_snapshots (
            platform, account_id, account_name, followers, follower_delta,
            total_reach, total_impressions, total_engagement,
            post_count, avg_engagement_rate, date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date)
        ON CONFLICT (platform, account_id, date) DO UPDATE SET
            total_reach=EXCLUDED.total_reach, total_impressions=EXCLUDED.total_impressions,
            total_engagement=EXCLUDED.total_engagement, post_count=EXCLUDED.post_count,
            avg_engagement_rate=EXCLUDED.avg_engagement_rate, last_synced_at=NOW()
    """,
        platform, account_id, account_name,
        0,  # follower count fetched separately per platform
        0,  # delta computed from follower count
        row["total_reach"], row["total_impressions"], row["total_engagement"],
        row["post_count"], row["avg_engagement_rate"], today,
    )
```

- [ ] **Step 4: Implement `worker/platforms/asset_matcher.py`**

```python
"""Asset matcher — links organic posts to pipeline-generated assets."""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

TRACKED_LINK_PATTERN = re.compile(r"go\.oneforma\.com/r/([a-zA-Z0-9_-]+)")
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+")
SIMILARITY_THRESHOLD = 0.7


def _extract_tracked_slug(text: str) -> str | None:
    """Extract tracked link slug from text."""
    match = TRACKED_LINK_PATTERN.search(text or "")
    return match.group(1) if match else None


def _extract_urls(text: str) -> list[str]:
    """Extract all URLs from text."""
    return URL_PATTERN.findall(text or "")


def _text_similarity(a: str, b: str) -> float:
    """Fuzzy text similarity using SequenceMatcher (stdlib, no deps)."""
    from difflib import SequenceMatcher
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


async def match_posts(db) -> dict:
    """Run attribution matching on unmatched posts across all platform caches."""
    matched = 0
    total_checked = 0

    async with db.acquire() as conn:
        # Get all posts not yet in organic_post_assets
        for table, platform, text_col in [
            ("meta_organic_cache", "meta", "post_text"),
            ("linkedin_organic_cache", "linkedin", "post_text"),
            ("reddit_organic_cache", "reddit", "post_text"),
        ]:
            posts = await conn.fetch(f"""
                SELECT c.post_id, c.post_url, c.{text_col} as post_text, c.platform as sub_platform
                FROM {table} c
                LEFT JOIN organic_post_assets opa ON opa.post_id = c.post_id AND opa.platform = $1
                WHERE opa.id IS NULL
            """, platform if platform != "meta" else "facebook")

            for post in posts:
                total_checked += 1
                post_platform = post.get("sub_platform", platform)
                if post_platform in ("facebook", "instagram"):
                    post_platform = post_platform  # keep sub-platform for meta

                result = await _try_match(conn, post_platform, post["post_id"], post["post_url"], post["post_text"])
                if result:
                    matched += 1

    logger.info("Asset matching: checked %d posts, matched %d", total_checked, matched)
    return {"posts_checked": total_checked, "assets_matched": matched}


async def _try_match(conn, platform: str, post_id: str, post_url: str, post_text: str) -> bool:
    """Try 3-tier matching. Returns True if matched."""

    # Strategy 1: UTM tracked link match
    slug = _extract_tracked_slug(f"{post_url or ''} {post_text or ''}")
    if slug:
        row = await conn.fetchrow("""
            SELECT tl.request_id FROM tracked_links tl WHERE tl.slug = $1
        """, slug)
        if row and row["request_id"]:
            await _insert_attribution(conn, platform, post_id, None, row["request_id"], "pipeline", "utm", 1.0)
            return True

    # Strategy 2: URL match against intake_requests landing_page_url
    urls = _extract_urls(f"{post_url or ''} {post_text or ''}")
    for url in urls:
        row = await conn.fetchrow("""
            SELECT id FROM intake_requests WHERE form_data->>'landing_page_url' = $1 LIMIT 1
        """, url)
        if row:
            await _insert_attribution(conn, platform, post_id, None, row["id"], "pipeline", "url_match", 0.9)
            return True

    # Strategy 3: Text similarity against generated copy assets
    if post_text and len(post_text) > 20:
        copy_assets = await conn.fetch("""
            SELECT ga.id as asset_id, ga.request_id, ga.content->>'text' as text
            FROM generated_assets ga
            WHERE ga.asset_type = 'copy' AND ga.content->>'text' IS NOT NULL
            ORDER BY ga.created_at DESC LIMIT 200
        """)
        best_score = 0.0
        best_asset = None
        for asset in copy_assets:
            if not asset["text"]:
                continue
            score = _text_similarity(post_text, asset["text"])
            if score > best_score:
                best_score = score
                best_asset = asset
        if best_asset and best_score >= SIMILARITY_THRESHOLD:
            await _insert_attribution(
                conn, platform, post_id, best_asset["asset_id"],
                best_asset["request_id"], "pipeline", "text_similarity", round(best_score, 3),
            )
            return True

    # No match — insert as manual
    await _insert_attribution(conn, platform, post_id, None, None, "manual", None, 1.0)
    return False


async def _insert_attribution(conn, platform: str, post_id: str, asset_id, request_id, source: str, matched_by: str | None, confidence: float) -> None:
    await conn.execute("""
        INSERT INTO organic_post_assets (platform, post_id, asset_id, request_id, source, matched_by, confidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (platform, post_id) DO UPDATE SET
            asset_id=EXCLUDED.asset_id, request_id=EXCLUDED.request_id,
            source=EXCLUDED.source, matched_by=EXCLUDED.matched_by, confidence=EXCLUDED.confidence
    """, platform, post_id, asset_id, request_id, source, matched_by, confidence)
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_asset_matcher.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/platforms/account_snapshotter.py worker/platforms/asset_matcher.py worker/tests/test_asset_matcher.py
git commit -m "feat: add account snapshotter + asset matcher (3-tier attribution)"
```

---

### Task 7: Sync Orchestrator + Orchestrator Routing

**Files:**
- Create: `worker/pipeline/stage_organic_sync.py`
- Modify: `worker/pipeline/orchestrator.py` (add `organic_sync` routing)

- [ ] **Step 1: Create the sync orchestrator**

```python
# worker/pipeline/stage_organic_sync.py
"""Organic metrics sync orchestrator — runs all 4 platform clients + post-processing."""
from __future__ import annotations

import asyncio
import logging

from config import (
    META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_IG_BUSINESS_ID,
    LINKEDIN_ORG_ACCESS_TOKEN, LINKEDIN_ORG_ID,
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD,
    GSC_SERVICE_ACCOUNT_JSON, GSC_PROPERTY_URL,
    ORGANIC_SYNC_DAYS,
)

logger = logging.getLogger(__name__)


async def run_organic_sync(context: dict) -> dict:
    """Run all organic platform syncs in parallel, then snapshot + match."""
    from neon_client import _get_pool

    pool = await _get_pool()
    days = context.get("days", ORGANIC_SYNC_DAYS)
    results = {}

    # Build client instances
    clients = []

    from platforms.meta_organic import MetaOrganicClient
    meta = MetaOrganicClient(db=pool, page_id=META_PAGE_ID, token=META_PAGE_ACCESS_TOKEN, ig_id=META_IG_BUSINESS_ID)
    if meta.is_connected():
        clients.append(("meta_organic", meta))

    from platforms.linkedin_organic import LinkedInOrganicClient
    linkedin = LinkedInOrganicClient(db=pool, org_id=LINKEDIN_ORG_ID, token=LINKEDIN_ORG_ACCESS_TOKEN)
    if linkedin.is_connected():
        clients.append(("linkedin_organic", linkedin))

    from platforms.reddit_organic import RedditOrganicClient
    reddit = RedditOrganicClient(db=pool, client_id=REDDIT_CLIENT_ID, client_secret=REDDIT_CLIENT_SECRET,
                                  username=REDDIT_USERNAME, password=REDDIT_PASSWORD)
    if reddit.is_connected():
        clients.append(("reddit_organic", reddit))

    from platforms.gsc_client import GscSyncClient
    gsc = GscSyncClient(db=pool, service_account_json=GSC_SERVICE_ACCOUNT_JSON, property_url=GSC_PROPERTY_URL)
    if gsc.is_connected():
        clients.append(("gsc", gsc))

    if not clients:
        logger.warning("No organic platforms configured — nothing to sync")
        return {"organic_sync": "no_platforms_configured"}

    # Run all clients in parallel
    logger.info("Running organic sync for %d platforms (days=%d): %s",
                len(clients), days, [name for name, _ in clients])

    async def _sync_one(name: str, client) -> tuple[str, dict]:
        try:
            result = await client.sync(days=days)
            logger.info("  %s: %s", name, result.get("message", "done"))
            return name, result
        except Exception as e:
            logger.error("  %s: FAILED — %s", name, e)
            return name, {"platform": name, "success": False, "posts_synced": 0, "errors": 1, "message": str(e)}

    sync_results = await asyncio.gather(*[_sync_one(name, client) for name, client in clients])
    for name, result in sync_results:
        results[name] = result

    # Post-processing: account snapshots
    try:
        from platforms.account_snapshotter import snapshot_accounts
        snap_result = await snapshot_accounts(pool)
        results["snapshots"] = snap_result
        logger.info("Account snapshots: %s", snap_result)
    except Exception as e:
        logger.error("Account snapshotter failed: %s", e)
        results["snapshots"] = {"error": str(e)}

    # Post-processing: asset matching
    try:
        from platforms.asset_matcher import match_posts
        match_result = await match_posts(pool)
        results["matching"] = match_result
        logger.info("Asset matching: %s", match_result)
    except Exception as e:
        logger.error("Asset matcher failed: %s", e)
        results["matching"] = {"error": str(e)}

    total_synced = sum(r.get("posts_synced", r.get("rows_synced", 0)) for r in results.values() if isinstance(r, dict))
    logger.info("Organic sync complete: %d total rows synced across %d platforms", total_synced, len(clients))

    return {"organic_sync_results": results, "organic_sync_total": total_synced}
```

- [ ] **Step 2: Add `organic_sync` routing in `worker/pipeline/orchestrator.py`**

At the top of `run_pipeline()`, BEFORE the `stages = [...]` list (line 54 area), add:

```python
    # ── Organic Metrics Sync: standalone job, not a pipeline ──
    if job_type == "organic_sync":
        from pipeline.stage_organic_sync import run_organic_sync
        context: dict = {"request_id": request_id, "days": int(job.get("feedback_data", {}).get("days", 7)) if isinstance(job.get("feedback_data"), dict) else 7}
        result = await run_organic_sync(context)
        logger.info("Organic sync job complete: %s", result)
        return
```

Insert this block between the existing `request_id` / `job_type` extraction (lines 55-58) and the `stages = [...]` line (line 78). The early `return` ensures organic_sync jobs bypass the creative pipeline entirely.

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage_organic_sync.py worker/pipeline/orchestrator.py
git commit -m "feat: add organic sync orchestrator + wire into job router"
```

---

### Task 8: TypeScript Types + GSC Client Update

**Files:**
- Create: `src/lib/platforms/organic-types.ts`
- Modify: `src/lib/audienceiq/gsc-client.ts` (replace stub with real reads)

- [ ] **Step 1: Create `src/lib/platforms/organic-types.ts`**

```typescript
/**
 * Types for organic social metrics and GSC reporting.
 */

export interface OrganicPostMetrics {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'reddit';
  post_id: string;
  post_type: string;
  post_text: string | null;
  post_url: string | null;
  published_at: string;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagement_rate: number | null;
  source: 'pipeline' | 'manual';
  asset_id: string | null;
  request_id: string | null;
  matched_by: string | null;
  confidence: number;
}

export interface OrganicOverview {
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  total_clicks: number;
  follower_delta: number;
  post_count: number;
  avg_engagement_rate: number;
  per_platform: Record<string, {
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    follower_delta: number;
    post_count: number;
  }>;
}

export interface AccountSnapshot {
  platform: string;
  account_id: string;
  account_name: string | null;
  followers: number;
  follower_delta: number;
  total_reach: number;
  total_impressions: number;
  total_engagement: number;
  post_count: number;
  avg_engagement_rate: number;
  profile_views: number;
  date: string;
}

export interface GscRow {
  query: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export interface OrganicSyncResult {
  platform: string;
  success: boolean;
  posts_synced: number;
  account_snapshot: boolean;
  assets_matched: number;
  errors: number;
  duration_ms: number;
  message: string;
}

export interface OrganicConnectionStatus {
  platform: string;
  connected: boolean;
  has_data: boolean;
  last_sync_at: string | null;
  post_count: number;
}

export interface PaidOverview {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_cpa: number;
  avg_ctr: number;
  roas: number;
  per_platform: Record<string, {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpa: number;
  }>;
}
```

- [ ] **Step 2: Update `src/lib/audienceiq/gsc-client.ts`**

Replace the entire file:

```typescript
/**
 * GSC Client — reads from gsc_daily_cache (populated by worker sync).
 */

import { getDb } from '@/lib/db';

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getTopQueries(limit: number = 20): Promise<GscQueryRow[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT query, SUM(clicks)::int as clicks, SUM(impressions)::int as impressions,
           AVG(ctr)::float as ctr, AVG(position)::float as position
    FROM gsc_daily_cache
    WHERE date >= CURRENT_DATE - 28
    GROUP BY query
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;
  return rows as unknown as GscQueryRow[];
}

export async function getTopPages(limit: number = 20): Promise<GscPageRow[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT page, SUM(clicks)::int as clicks, SUM(impressions)::int as impressions,
           AVG(ctr)::float as ctr, AVG(position)::float as position
    FROM gsc_daily_cache
    WHERE date >= CURRENT_DATE - 28
    GROUP BY page
    ORDER BY clicks DESC
    LIMIT ${limit}
  `;
  return rows as unknown as GscPageRow[];
}

export function isGscConnected(): boolean {
  // Connected if there's any data in the cache (worker populates it)
  return true;  // Actual check happens at query time — empty table = "no data"
}

export async function hasGscData(): Promise<boolean> {
  const sql = getDb();
  const row = await sql`SELECT COUNT(*)::int as count FROM gsc_daily_cache LIMIT 1`;
  return (row[0] as { count: number }).count > 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/platforms/organic-types.ts src/lib/audienceiq/gsc-client.ts
git commit -m "feat: add organic types + replace GSC stub with real cache reads"
```

---

### Task 9: Organic API Routes (6 Routes)

**Files:**
- Create: `src/app/api/insights/metrics/organic-overview/route.ts`
- Create: `src/app/api/insights/metrics/organic-by-platform/route.ts`
- Create: `src/app/api/insights/metrics/organic-posts/route.ts`
- Create: `src/app/api/insights/metrics/organic-attribution/route.ts`
- Create: `src/app/api/insights/metrics/account-growth/route.ts`
- Create: `src/app/api/insights/metrics/gsc-performance/route.ts`

- [ ] **Step 1: Create organic-overview route**

```typescript
// src/app/api/insights/metrics/organic-overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const [metaRow, linkedinRow, redditRow, snapshotRows] = await Promise.all([
    sql`SELECT COALESCE(SUM(impressions),0)::int as impressions, COALESCE(SUM(reach),0)::int as reach,
        COALESCE(SUM(engagement),0)::int as engagement, COALESCE(SUM(clicks),0)::int as clicks,
        COUNT(DISTINCT post_id)::int as post_count, AVG(engagement_rate)::float as avg_eng,
        platform FROM meta_organic_cache WHERE date >= CURRENT_DATE - ${days}
        GROUP BY platform`,
    sql`SELECT COALESCE(SUM(impressions),0)::int as impressions, COALESCE(SUM(unique_impressions),0)::int as reach,
        COALESCE(SUM(engagement),0)::int as engagement, COALESCE(SUM(clicks),0)::int as clicks,
        COUNT(DISTINCT post_id)::int as post_count, AVG(engagement_rate)::float as avg_eng
        FROM linkedin_organic_cache WHERE date >= CURRENT_DATE - ${days}`,
    sql`SELECT 0 as impressions, 0 as reach, COALESCE(SUM(score),0)::int as engagement,
        0 as clicks, COUNT(DISTINCT post_id)::int as post_count, AVG(upvote_ratio)::float as avg_eng
        FROM reddit_organic_cache WHERE date >= CURRENT_DATE - ${days}`,
    sql`SELECT platform, COALESCE(SUM(follower_delta),0)::int as follower_delta
        FROM social_account_snapshots WHERE date >= CURRENT_DATE - ${days}
        GROUP BY platform`,
  ]);

  const per_platform: Record<string, any> = {};
  for (const row of metaRow) {
    const r = row as any;
    per_platform[r.platform] = { impressions: r.impressions, reach: r.reach, engagement: r.engagement, clicks: r.clicks, post_count: r.post_count, follower_delta: 0 };
  }
  if (linkedinRow.length > 0) {
    const r = linkedinRow[0] as any;
    per_platform.linkedin = { impressions: r.impressions, reach: r.reach, engagement: r.engagement, clicks: r.clicks, post_count: r.post_count, follower_delta: 0 };
  }
  if (redditRow.length > 0) {
    const r = redditRow[0] as any;
    per_platform.reddit = { impressions: r.impressions, reach: r.reach, engagement: r.engagement, clicks: r.clicks, post_count: r.post_count, follower_delta: 0 };
  }
  for (const snap of snapshotRows) {
    const s = snap as any;
    if (per_platform[s.platform]) per_platform[s.platform].follower_delta = s.follower_delta;
  }

  const totals = Object.values(per_platform).reduce((acc: any, p: any) => ({
    impressions: acc.impressions + p.impressions,
    reach: acc.reach + p.reach,
    engagement: acc.engagement + p.engagement,
    clicks: acc.clicks + p.clicks,
    post_count: acc.post_count + p.post_count,
    follower_delta: acc.follower_delta + p.follower_delta,
  }), { impressions: 0, reach: 0, engagement: 0, clicks: 0, post_count: 0, follower_delta: 0 });

  return NextResponse.json({
    ...totals,
    avg_engagement_rate: totals.reach > 0 ? totals.engagement / totals.reach : 0,
    per_platform,
  });
}
```

- [ ] **Step 2: Create organic-by-platform route**

```typescript
// src/app/api/insights/metrics/organic-by-platform/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const rows = await sql`
    SELECT date::text, metric_type, platform,
           SUM(impressions)::int as impressions, SUM(clicks)::int as clicks,
           SUM(COALESCE(reach,0))::int as reach, SUM(COALESCE(engagement,0))::int as engagement,
           SUM(COALESCE(likes,0))::int as likes, SUM(COALESCE(shares,0))::int as shares
    FROM channel_performance_unified
    WHERE date >= CURRENT_DATE - ${days} AND metric_type = 'organic'
    GROUP BY date, metric_type, platform
    ORDER BY date ASC, platform
  `;
  return NextResponse.json({ days, rows });
}
```

- [ ] **Step 3: Create organic-posts route**

```typescript
// src/app/api/insights/metrics/organic-posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const platform = req.nextUrl.searchParams.get('platform');
  const source = req.nextUrl.searchParams.get('source');
  const sort = req.nextUrl.searchParams.get('sort') || 'engagement';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  // Union all platform caches with attribution
  const rows = await sql`
    WITH all_posts AS (
      SELECT post_id, platform, post_type, post_url, post_text, published_at,
             impressions, reach, engagement, likes, comments, shares, clicks,
             engagement_rate, date
      FROM meta_organic_cache WHERE date >= CURRENT_DATE - ${days}
      UNION ALL
      SELECT post_id, 'linkedin' as platform, post_type, post_url, post_text, published_at,
             impressions, unique_impressions as reach, engagement, likes, comments, shares, clicks,
             engagement_rate, date
      FROM linkedin_organic_cache WHERE date >= CURRENT_DATE - ${days}
      UNION ALL
      SELECT post_id, 'reddit' as platform, post_type, post_url, post_title as post_text, published_at,
             0 as impressions, 0 as reach, score as engagement, upvotes as likes, comments, 0 as shares, 0 as clicks,
             upvote_ratio as engagement_rate, date
      FROM reddit_organic_cache WHERE date >= CURRENT_DATE - ${days}
    )
    SELECT p.*, COALESCE(opa.source, 'unknown') as source, opa.asset_id, opa.request_id,
           opa.matched_by, COALESCE(opa.confidence, 0) as confidence
    FROM all_posts p
    LEFT JOIN organic_post_assets opa ON opa.post_id = p.post_id AND opa.platform = p.platform
    WHERE (${platform}::text IS NULL OR p.platform = ${platform})
      AND (${source}::text IS NULL OR COALESCE(opa.source, 'unknown') = ${source})
    ORDER BY CASE WHEN ${sort} = 'engagement' THEN p.engagement
                  WHEN ${sort} = 'impressions' THEN p.impressions
                  WHEN ${sort} = 'clicks' THEN p.clicks
                  ELSE p.engagement END DESC
    LIMIT ${limit}
  `;
  return NextResponse.json({ posts: rows });
}
```

- [ ] **Step 4: Create organic-attribution route**

```typescript
// src/app/api/insights/metrics/organic-attribution/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const rows = await sql`
    WITH all_posts AS (
      SELECT post_id, platform, impressions, reach, engagement, engagement_rate, date
      FROM meta_organic_cache WHERE date >= CURRENT_DATE - ${days}
      UNION ALL
      SELECT post_id, 'linkedin', impressions, unique_impressions, engagement, engagement_rate, date
      FROM linkedin_organic_cache WHERE date >= CURRENT_DATE - ${days}
      UNION ALL
      SELECT post_id, 'reddit', 0, 0, score, upvote_ratio, date
      FROM reddit_organic_cache WHERE date >= CURRENT_DATE - ${days}
    )
    SELECT COALESCE(opa.source, 'unknown') as source,
           COUNT(DISTINCT p.post_id)::int as post_count,
           COALESCE(AVG(p.engagement),0)::float as avg_engagement,
           COALESCE(AVG(p.reach),0)::float as avg_reach,
           COALESCE(AVG(p.impressions),0)::float as avg_impressions,
           COALESCE(AVG(p.engagement_rate),0)::float as avg_engagement_rate
    FROM all_posts p
    LEFT JOIN organic_post_assets opa ON opa.post_id = p.post_id AND opa.platform = p.platform
    GROUP BY COALESCE(opa.source, 'unknown')
  `;
  return NextResponse.json({ attribution: rows });
}
```

- [ ] **Step 5: Create account-growth route**

```typescript
// src/app/api/insights/metrics/account-growth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '90');
  const platform = req.nextUrl.searchParams.get('platform');

  const rows = await sql`
    SELECT platform, account_name, date::text, followers, follower_delta,
           total_reach, total_impressions, total_engagement, post_count,
           avg_engagement_rate, profile_views
    FROM social_account_snapshots
    WHERE date >= CURRENT_DATE - ${days}
      AND (${platform}::text IS NULL OR platform = ${platform})
    ORDER BY date ASC, platform
  `;
  return NextResponse.json({ snapshots: rows });
}
```

- [ ] **Step 6: Create gsc-performance route**

```typescript
// src/app/api/insights/metrics/gsc-performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '28');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  const [topQueries, topPages, dailyTrend, hasData] = await Promise.all([
    sql`SELECT query, SUM(clicks)::int as clicks, SUM(impressions)::int as impressions,
        AVG(ctr)::float as ctr, AVG(position)::float as position
        FROM gsc_daily_cache WHERE date >= CURRENT_DATE - ${days}
        GROUP BY query ORDER BY clicks DESC LIMIT ${limit}`,
    sql`SELECT page, SUM(clicks)::int as clicks, SUM(impressions)::int as impressions,
        AVG(ctr)::float as ctr, AVG(position)::float as position
        FROM gsc_daily_cache WHERE date >= CURRENT_DATE - ${days}
        GROUP BY page ORDER BY clicks DESC LIMIT ${limit}`,
    sql`SELECT date::text, SUM(clicks)::int as clicks, SUM(impressions)::int as impressions,
        AVG(ctr)::float as ctr, AVG(position)::float as position
        FROM gsc_daily_cache WHERE date >= CURRENT_DATE - ${days}
        GROUP BY date ORDER BY date ASC`,
    sql`SELECT COUNT(*)::int as count FROM gsc_daily_cache LIMIT 1`,
  ]);

  const connected = (hasData[0] as { count: number }).count > 0;
  return NextResponse.json({ connected, top_queries: topQueries, top_pages: topPages, daily_trend: dailyTrend });
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors from the new route files.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/insights/metrics/organic-overview/route.ts src/app/api/insights/metrics/organic-by-platform/route.ts src/app/api/insights/metrics/organic-posts/route.ts src/app/api/insights/metrics/organic-attribution/route.ts src/app/api/insights/metrics/account-growth/route.ts src/app/api/insights/metrics/gsc-performance/route.ts
git commit -m "feat: add 6 organic metric API routes"
```

---

### Task 10: Paid API Routes (3 Routes)

**Files:**
- Create: `src/app/api/insights/metrics/paid-overview/route.ts`
- Create: `src/app/api/insights/metrics/paid-by-platform/route.ts`
- Create: `src/app/api/insights/metrics/paid-campaigns/route.ts`

- [ ] **Step 1: Create paid-overview route**

```typescript
// src/app/api/insights/metrics/paid-overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const rows = await sql`
    SELECT platform,
           COALESCE(SUM(impressions),0)::int as impressions,
           COALESCE(SUM(clicks),0)::int as clicks,
           COALESCE(SUM(spend),0)::float as spend,
           COALESCE(SUM(conversions),0)::int as conversions
    FROM normalized_daily_metrics
    WHERE date >= CURRENT_DATE - ${days}
    GROUP BY platform
  `;

  const per_platform: Record<string, any> = {};
  let total_spend = 0, total_impressions = 0, total_clicks = 0, total_conversions = 0;
  for (const row of rows) {
    const r = row as any;
    total_spend += r.spend; total_impressions += r.impressions;
    total_clicks += r.clicks; total_conversions += r.conversions;
    per_platform[r.platform] = {
      spend: r.spend, impressions: r.impressions, clicks: r.clicks,
      conversions: r.conversions, cpa: r.conversions > 0 ? r.spend / r.conversions : 0,
    };
  }

  return NextResponse.json({
    total_spend, total_impressions, total_clicks, total_conversions,
    avg_cpa: total_conversions > 0 ? total_spend / total_conversions : 0,
    avg_ctr: total_impressions > 0 ? total_clicks / total_impressions : 0,
    roas: total_spend > 0 ? (total_conversions * 100) / total_spend : 0,
    per_platform,
  });
}
```

- [ ] **Step 2: Create paid-by-platform route**

```typescript
// src/app/api/insights/metrics/paid-by-platform/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const rows = await sql`
    SELECT date::text, platform, channel,
           SUM(impressions)::int as impressions, SUM(clicks)::int as clicks,
           SUM(spend)::float as spend, SUM(conversions)::int as conversions
    FROM normalized_daily_metrics
    WHERE date >= CURRENT_DATE - ${days}
    GROUP BY date, platform, channel
    ORDER BY date ASC, platform
  `;
  return NextResponse.json({ days, rows });
}
```

- [ ] **Step 3: Create paid-campaigns route**

```typescript
// src/app/api/insights/metrics/paid-campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const platform = req.nextUrl.searchParams.get('platform') || 'meta_ads';
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  // Query the raw platform cache for campaign/adset detail
  const tableMap: Record<string, string> = {
    meta_ads: 'meta_ads_cache', reddit_ads: 'reddit_ads_cache',
    linkedin_ads: 'linkedin_ads_cache', google_ads: 'google_ads_cache',
    tiktok_ads: 'tiktok_ads_cache',
  };
  const table = tableMap[platform];
  if (!table) return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });

  const rows = await sql`
    SELECT campaign_name, campaign_id,
           SUM(impressions)::int as impressions, SUM(clicks)::int as clicks,
           SUM(COALESCE(spend, spend_micros::float/1000000))::float as spend,
           SUM(conversions)::int as conversions
    FROM ${sql(table)}
    WHERE date >= CURRENT_DATE - ${days}
    GROUP BY campaign_name, campaign_id
    ORDER BY spend DESC
    LIMIT ${limit}
  `;
  return NextResponse.json({ platform, campaigns: rows });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/insights/metrics/paid-overview/route.ts src/app/api/insights/metrics/paid-by-platform/route.ts src/app/api/insights/metrics/paid-campaigns/route.ts
git commit -m "feat: add 3 paid metric API routes (drill-down parity)"
```

---

### Task 11: Organic Sync + Status API Routes

**Files:**
- Create: `src/app/api/platforms/organic/sync/route.ts`
- Create: `src/app/api/platforms/organic/status/route.ts`

- [ ] **Step 1: Create organic sync trigger route**

```typescript
// src/app/api/platforms/organic/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  await requireRole(['admin']);
  const sql = getDb();
  const body = await request.json().catch(() => ({}));
  const days = (body.days as number) || 7;

  // Insert organic_sync compute job — worker picks it up
  const result = await sql`
    INSERT INTO compute_jobs (request_id, job_type, feedback_data, status)
    VALUES (gen_random_uuid(), 'organic_sync', ${JSON.stringify({ days })}::jsonb, 'pending')
    RETURNING id
  `;
  const jobId = (result[0] as { id: string }).id;
  return NextResponse.json({ job_id: jobId, message: 'Organic sync job queued' });
}
```

- [ ] **Step 2: Create organic status route**

```typescript
// src/app/api/platforms/organic/status/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  await requireAuth();
  const sql = getDb();

  const [meta, linkedin, reddit, gsc] = await Promise.all([
    sql`SELECT COUNT(*)::int as count, MAX(last_synced_at) as last_sync FROM meta_organic_cache`,
    sql`SELECT COUNT(*)::int as count, MAX(last_synced_at) as last_sync FROM linkedin_organic_cache`,
    sql`SELECT COUNT(*)::int as count, MAX(last_synced_at) as last_sync FROM reddit_organic_cache`,
    sql`SELECT COUNT(*)::int as count, MAX(last_synced_at) as last_sync FROM gsc_daily_cache`,
  ]);

  const status = (name: string, row: any) => ({
    platform: name,
    connected: true,  // env var check is worker-side; frontend just checks for data
    has_data: (row[0] as any).count > 0,
    last_sync_at: (row[0] as any).last_sync,
    post_count: (row[0] as any).count,
  });

  return NextResponse.json({
    platforms: [
      status('meta', meta), status('linkedin', linkedin),
      status('reddit', reddit), status('gsc', gsc),
    ],
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/platforms/organic/sync/route.ts src/app/api/platforms/organic/status/route.ts
git commit -m "feat: add organic sync trigger + status API routes"
```

---

### Task 12: Organic Dashboard Widgets (6 Widgets)

**Files:**
- Create: `src/components/insights/widgets/OrganicKpiWidget.tsx`
- Create: `src/components/insights/widgets/OrganicPlatformCompareWidget.tsx`
- Create: `src/components/insights/widgets/OrganicAttributionWidget.tsx`
- Create: `src/components/insights/widgets/OrganicAccountGrowthWidget.tsx`
- Create: `src/components/insights/widgets/OrganicTopPostsWidget.tsx`
- Create: `src/components/insights/widgets/GscPerformanceWidget.tsx`

This task creates all 6 organic widgets. Each follows the exact same pattern as existing widgets: `"use client"`, `useEffect` + `fetch`, skeleton loading, Recharts for charts.

- [ ] **Step 1: Create OrganicKpiWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, Users, Eye, MousePointerClick } from 'lucide-react';

interface OrgKpiData {
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  total_clicks: number;
  follower_delta: number;
  post_count: number;
  avg_engagement_rate: number;
}

export default function OrganicKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<OrgKpiData | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-overview?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const cards = [
    { label: 'Impressions', value: data.total_impressions.toLocaleString(), icon: Eye },
    { label: 'Reach', value: data.total_reach.toLocaleString(), icon: Users },
    { label: 'Engagement', value: data.total_engagement.toLocaleString(), icon: TrendingUp },
    { label: 'Clicks', value: data.total_clicks.toLocaleString(), icon: MousePointerClick },
    { label: 'Followers', value: `${data.follower_delta >= 0 ? '+' : ''}${data.follower_delta}`, icon: Users },
    { label: 'Eng Rate', value: `${(data.avg_engagement_rate * 100).toFixed(1)}%`, icon: TrendingUp },
  ];

  return (
    <div className="h-full grid grid-cols-3 gap-2">
      {cards.map(c => (
        <div key={c.label} className="px-3 py-2 rounded-lg bg-[var(--muted)] text-center cursor-pointer hover:bg-[var(--muted)]/80">
          <c.icon className="w-3.5 h-3.5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <div className="text-[10px] text-[var(--muted-foreground)]">{c.label}</div>
          <div className="text-sm font-bold text-[var(--foreground)]">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create OrganicPlatformCompareWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface PlatformRow { date: string; platform: string; impressions: number; engagement: number; clicks: number; reach: number; }

export default function OrganicPlatformCompareWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PlatformRow[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-by-platform?days=${days}`)
      .then(r => r.json()).then(d => setData(d.rows)).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No organic data yet</div>;

  // Pivot: one row per date, columns per platform
  const byDate: Record<string, any> = {};
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date };
    byDate[row.date][`${row.platform}_engagement`] = (byDate[row.date][`${row.platform}_engagement`] || 0) + row.engagement;
  }
  const chartData = Object.values(byDate);
  const platforms = [...new Set(data.map(r => r.platform))];
  const colorMap: Record<string, string> = { facebook: CHART_COLORS.blue, instagram: CHART_COLORS.purple, linkedin: CHART_COLORS.teal, reddit: CHART_COLORS.orange };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Engagement by Platform</div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend />
            {platforms.map(p => (
              <Bar key={p} dataKey={`${p}_engagement`} name={p} fill={colorMap[p] || CHART_COLORS.charcoal} radius={[2, 2, 0, 0]} stackId="stack" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create OrganicAttributionWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';

interface AttrRow { source: string; post_count: number; avg_engagement: number; avg_reach: number; avg_engagement_rate: number; }

export default function OrganicAttributionWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<AttrRow[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-attribution?days=${days}`)
      .then(r => r.json()).then(d => setData(d.attribution)).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const pipeline = data.find(d => d.source === 'pipeline');
  const manual = data.find(d => d.source === 'manual');

  const renderCol = (label: string, row: AttrRow | undefined, color: string) => (
    <div className="flex-1 text-center">
      <div className="text-xs font-semibold mb-2" style={{ color }}>{label}</div>
      <div className="space-y-2">
        <div><div className="text-lg font-bold text-[var(--foreground)]">{row ? `${(row.avg_engagement_rate * 100).toFixed(1)}%` : '—'}</div><div className="text-[10px] text-[var(--muted-foreground)]">Avg Eng Rate</div></div>
        <div><div className="text-lg font-bold text-[var(--foreground)]">{row ? Math.round(row.avg_reach).toLocaleString() : '—'}</div><div className="text-[10px] text-[var(--muted-foreground)]">Avg Reach</div></div>
        <div><div className="text-lg font-bold text-[var(--foreground)]">{row?.post_count ?? 0}</div><div className="text-[10px] text-[var(--muted-foreground)]">Posts</div></div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Pipeline vs Manual</div>
      <div className="flex-1 flex items-center gap-4">
        {renderCol('Pipeline', pipeline, '#16a34a')}
        <div className="w-px h-16 bg-[var(--muted)]" />
        {renderCol('Manual', manual, '#ca8a04')}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create OrganicAccountGrowthWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface Snap { platform: string; date: string; followers: number; follower_delta: number; }

export default function OrganicAccountGrowthWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Snap[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 90;
    fetch(`/api/insights/metrics/account-growth?days=${days}`)
      .then(r => r.json()).then(d => setData(d.snapshots)).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No snapshot data yet</div>;

  const byDate: Record<string, any> = {};
  for (const s of data) {
    if (!byDate[s.date]) byDate[s.date] = { date: s.date };
    byDate[s.date][s.platform] = s.followers;
  }
  const chartData = Object.values(byDate);
  const platforms = [...new Set(data.map(s => s.platform))];
  const colorMap: Record<string, string> = { facebook: CHART_COLORS.blue, instagram: CHART_COLORS.purple, linkedin: CHART_COLORS.teal, reddit: CHART_COLORS.orange };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Follower Growth</div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            {platforms.map(p => (
              <Line key={p} type="monotone" dataKey={p} name={p} stroke={colorMap[p] || CHART_COLORS.charcoal} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create OrganicTopPostsWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';

interface Post {
  platform: string; post_id: string; post_type: string; post_text: string | null;
  impressions: number; reach: number; engagement: number; clicks: number;
  engagement_rate: number | null; source: string; published_at: string;
}

const PLATFORM_ICONS: Record<string, string> = { facebook: '📘', instagram: '📷', linkedin: '💼', reddit: '🔶' };

export default function OrganicTopPostsWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Post[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    const platform = config.platform as string || '';
    const qp = platform ? `&platform=${platform}` : '';
    fetch(`/api/insights/metrics/organic-posts?days=${days}${qp}&sort=engagement&limit=20`)
      .then(r => r.json()).then(d => setData(d.posts)).catch(() => {});
  }, [config.days, config.platform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No posts yet</div>;

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Top Posts</div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {data.map(post => (
          <div key={`${post.platform}-${post.post_id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--muted)] cursor-pointer text-xs">
            <span className="text-sm">{PLATFORM_ICONS[post.platform] || '📋'}</span>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[var(--foreground)]">{post.post_text || '(no text)'}</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">{post.post_type}</div>
            </div>
            <div className="text-right whitespace-nowrap">
              <div className="font-semibold text-[var(--foreground)]">{post.engagement.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">engagement</div>
            </div>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${post.source === 'pipeline' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {post.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create GscPerformanceWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { Unplug } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface GscData {
  connected: boolean;
  top_queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  top_pages: { page: string; clicks: number }[];
  daily_trend: { date: string; clicks: number; impressions: number; position: number }[];
}

export default function GscPerformanceWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<GscData | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 28;
    fetch(`/api/insights/metrics/gsc-performance?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">GSC Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Run an organic sync to populate search data</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {data.daily_trend.length > 0 && (
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily_trend}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 8 }} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="clicks" stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Top Queries</div>
        <div className="space-y-1">
          {data.top_queries.slice(0, 10).map(q => (
            <div key={q.query} className="flex items-center gap-2 text-xs">
              <div className="flex-1 truncate text-[var(--foreground)]">{q.query}</div>
              <div className="text-[var(--muted-foreground)] whitespace-nowrap">{q.clicks} clicks</div>
              <div className="text-[var(--muted-foreground)] whitespace-nowrap">pos {q.position.toFixed(1)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/insights/widgets/OrganicKpiWidget.tsx src/components/insights/widgets/OrganicPlatformCompareWidget.tsx src/components/insights/widgets/OrganicAttributionWidget.tsx src/components/insights/widgets/OrganicAccountGrowthWidget.tsx src/components/insights/widgets/OrganicTopPostsWidget.tsx src/components/insights/widgets/GscPerformanceWidget.tsx
git commit -m "feat: add 6 organic social dashboard widgets"
```

---

### Task 13: Paid Dashboard Widgets (3 Widgets)

**Files:**
- Create: `src/components/insights/widgets/PaidKpiWidget.tsx`
- Create: `src/components/insights/widgets/PaidPlatformCompareWidget.tsx`
- Create: `src/components/insights/widgets/PaidCampaignDetailWidget.tsx`

- [ ] **Step 1: Create PaidKpiWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';
import { DollarSign, Eye, MousePointerClick, Target, TrendingUp } from 'lucide-react';

interface PaidKpiData {
  total_spend: number; total_impressions: number; total_clicks: number;
  total_conversions: number; avg_cpa: number; avg_ctr: number; roas: number;
}

export default function PaidKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<PaidKpiData | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-overview?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const cards = [
    { label: 'Spend', value: `$${data.total_spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign },
    { label: 'Impressions', value: data.total_impressions.toLocaleString(), icon: Eye },
    { label: 'Clicks', value: data.total_clicks.toLocaleString(), icon: MousePointerClick },
    { label: 'Conversions', value: data.total_conversions.toLocaleString(), icon: Target },
    { label: 'CPA', value: `$${data.avg_cpa.toFixed(2)}`, icon: DollarSign },
    { label: 'CTR', value: `${(data.avg_ctr * 100).toFixed(1)}%`, icon: TrendingUp },
  ];

  return (
    <div className="h-full grid grid-cols-3 gap-2">
      {cards.map(c => (
        <div key={c.label} className="px-3 py-2 rounded-lg bg-[var(--muted)] text-center cursor-pointer hover:bg-[var(--muted)]/80">
          <c.icon className="w-3.5 h-3.5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <div className="text-[10px] text-[var(--muted-foreground)]">{c.label}</div>
          <div className="text-sm font-bold text-[var(--foreground)]">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create PaidPlatformCompareWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface Row { date: string; platform: string; spend: number; impressions: number; clicks: number; conversions: number; }

export default function PaidPlatformCompareWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Row[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/paid-by-platform?days=${days}`)
      .then(r => r.json()).then(d => setData(d.rows)).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No paid data yet</div>;

  const byDate: Record<string, any> = {};
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date };
    byDate[row.date][`${row.platform}_spend`] = (byDate[row.date][`${row.platform}_spend`] || 0) + row.spend;
  }
  const chartData = Object.values(byDate);
  const platforms = [...new Set(data.map(r => r.platform))];
  const colorMap: Record<string, string> = { meta_ads: CHART_COLORS.blue, reddit_ads: CHART_COLORS.orange, linkedin_ads: CHART_COLORS.teal, google_ads: CHART_COLORS.green, tiktok_ads: CHART_COLORS.purple };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Spend by Platform</div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="date" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend />
            {platforms.map(p => (
              <Bar key={p} dataKey={`${p}_spend`} name={p} fill={colorMap[p] || CHART_COLORS.charcoal} radius={[2, 2, 0, 0]} stackId="stack" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create PaidCampaignDetailWidget.tsx**

```tsx
"use client";

import { useEffect, useState } from 'react';

interface Campaign { campaign_name: string; campaign_id: string; impressions: number; clicks: number; spend: number; conversions: number; }

export default function PaidCampaignDetailWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Campaign[] | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    const platform = (config.platform as string) || 'meta_ads';
    fetch(`/api/insights/metrics/paid-campaigns?days=${days}&platform=${platform}&limit=20`)
      .then(r => r.json()).then(d => setData(d.campaigns)).catch(() => {});
  }, [config.days, config.platform]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No campaign data</div>;

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Campaigns</div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-[10px] text-[var(--muted-foreground)] border-b border-[var(--muted)]">
            <th className="text-left py-1">Campaign</th><th className="text-right">Spend</th><th className="text-right">Impr</th><th className="text-right">Clicks</th><th className="text-right">Conv</th><th className="text-right">CPA</th>
          </tr></thead>
          <tbody>
            {data.map(c => (
              <tr key={c.campaign_id} className="border-b border-[var(--muted)] hover:bg-[var(--muted)] cursor-pointer">
                <td className="py-1.5 truncate max-w-[200px]">{c.campaign_name || c.campaign_id}</td>
                <td className="text-right">${c.spend.toFixed(0)}</td>
                <td className="text-right">{c.impressions.toLocaleString()}</td>
                <td className="text-right">{c.clicks.toLocaleString()}</td>
                <td className="text-right">{c.conversions}</td>
                <td className="text-right">{c.conversions > 0 ? `$${(c.spend / c.conversions).toFixed(0)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/insights/widgets/PaidKpiWidget.tsx src/components/insights/widgets/PaidPlatformCompareWidget.tsx src/components/insights/widgets/PaidCampaignDetailWidget.tsx
git commit -m "feat: add 3 paid drill-down dashboard widgets"
```

---

### Task 14: Widget Registration (Types + Registry)

**Files:**
- Modify: `src/components/insights/types.ts`
- Modify: `src/components/insights/widgetRegistry.ts`

- [ ] **Step 1: Add new widget types to `src/components/insights/types.ts`**

Add the following to the `WidgetType` union (before `| 'text-note'`):

```typescript
  // Organic Social
  | 'organic-kpi'
  | 'organic-platform-compare'
  | 'organic-attribution'
  | 'organic-account-growth'
  | 'organic-top-posts'
  | 'gsc-performance'
  // Paid (drill-down parity)
  | 'paid-kpi'
  | 'paid-platform-compare'
  | 'paid-campaign-detail'
```

Add to the `WidgetCategory` type:

```typescript
  | 'organic'
  | 'paid'
```

- [ ] **Step 2: Register widgets in `src/components/insights/widgetRegistry.ts`**

Add imports at the top (after existing Lucide imports):

```typescript
import { Share2, Rss, ArrowUpRight } from 'lucide-react';
```

Add 2 new categories to `WIDGET_CATEGORIES` array (before `{ id: 'utility', ... }`):

```typescript
  { id: 'organic', label: 'Organic Social' },
  { id: 'paid', label: 'Paid Media' },
```

Add 9 new entries to `WIDGET_REGISTRY` (before `'text-note'`):

```typescript
  // ── Organic Social ────────────────────────────────────────
  'organic-kpi': {
    component: lazy(() => import('./widgets/OrganicKpiWidget')),
    category: 'organic', label: 'Organic KPIs', icon: Rss,
    description: 'Impressions, reach, engagement, follower delta across all social platforms',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 },
  },
  'organic-platform-compare': {
    component: lazy(() => import('./widgets/OrganicPlatformCompareWidget')),
    category: 'organic', label: 'Platform Comparison', icon: BarChart3,
    description: 'Engagement by platform over time — Facebook, Instagram, LinkedIn, Reddit',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'organic-attribution': {
    component: lazy(() => import('./widgets/OrganicAttributionWidget')),
    category: 'organic', label: 'Pipeline vs Manual', icon: GitCompare,
    description: 'Compare AI-generated vs manually posted content performance',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'organic-account-growth': {
    component: lazy(() => import('./widgets/OrganicAccountGrowthWidget')),
    category: 'organic', label: 'Account Growth', icon: ArrowUpRight,
    description: 'Follower count trends per platform over time',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'organic-top-posts': {
    component: lazy(() => import('./widgets/OrganicTopPostsWidget')),
    category: 'organic', label: 'Top Posts', icon: Share2,
    description: 'Ranked list of posts by engagement with pipeline/manual attribution',
    defaultSize: { w: 12, h: 5 }, minSize: { w: 6, h: 3 },
  },
  'gsc-performance': {
    component: lazy(() => import('./widgets/GscPerformanceWidget')),
    category: 'organic', label: 'GSC Performance', icon: Search,
    description: 'Google Search Console queries, pages, and ranking trends',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
  },
  // ── Paid Media ────────────────────────────────────────────
  'paid-kpi': {
    component: lazy(() => import('./widgets/PaidKpiWidget')),
    category: 'paid', label: 'Paid KPIs', icon: Megaphone,
    description: 'Spend, impressions, clicks, conversions, CPA, CTR across all paid platforms',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 },
  },
  'paid-platform-compare': {
    component: lazy(() => import('./widgets/PaidPlatformCompareWidget')),
    category: 'paid', label: 'Paid Platform Comparison', icon: BarChart3,
    description: 'Spend by platform over time — Meta, Reddit, LinkedIn, Google, TikTok',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'paid-campaign-detail': {
    component: lazy(() => import('./widgets/PaidCampaignDetailWidget')),
    category: 'paid', label: 'Campaign Detail', icon: ListChecks,
    description: 'Campaign-level spend, impressions, clicks, conversions, CPA breakdown',
    defaultSize: { w: 12, h: 5 }, minSize: { w: 6, h: 3 },
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/insights/types.ts src/components/insights/widgetRegistry.ts
git commit -m "feat: register 9 new widgets (6 organic + 3 paid) in dashboard builder"
```

---

### Task 15: Verify End-to-End

- [ ] **Step 1: Run TypeScript type check**

```bash
cd /Users/stevenjunop/centric-intake
npx tsc --noEmit --pretty
```

Expected: 0 errors.

- [ ] **Step 2: Run Python unit tests**

```bash
cd /Users/stevenjunop/centric-intake/worker
python -m pytest tests/test_meta_organic.py tests/test_linkedin_organic.py tests/test_reddit_organic.py tests/test_gsc_client.py tests/test_asset_matcher.py -v
```

Expected: All tests PASS.

- [ ] **Step 3: Verify dev server starts**

```bash
cd /Users/stevenjunop/centric-intake
npm run dev &
sleep 5
curl -s http://localhost:3000/api/platforms/organic/status | python3 -m json.tool
kill %1
```

Expected: JSON response with 4 platforms, all showing `has_data: false` (no sync yet).

- [ ] **Step 4: Verify migration was applied**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM channel_performance_unified;"
```

Expected: Returns 0 rows (or whatever is in normalized_daily_metrics from paid).

- [ ] **Step 5: Final commit with any fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: end-to-end verification fixes for organic metrics"
```
