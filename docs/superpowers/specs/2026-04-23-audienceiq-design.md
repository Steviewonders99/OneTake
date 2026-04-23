# AudienceIQ — Recruitment Audience Intelligence System

## Overview

AudienceIQ is a four-ring audience drift detection engine that answers: **"What is the gap between who we're targeting, who we're reaching, and who actually becomes a quality contributor?"**

It fuses five data sources — UTM click tracking (built), CRM contributor datalake, GA4/GTM/GSC analytics, HIE behavioral heatmaps (ported from VYRA), and ad platform audience reports — into a unified intelligence layer that no competitor can replicate.

**Core differentiator:** OneForma's CRM contains contributor quality scores, skills, activity status, and retention data. Connecting this to ad attribution creates a closed-loop feedback system that measures cost-per-quality-contributor, not just cost-per-click.

---

## The Four-Ring Drift Model

AudienceIQ computes drift across four audience rings for every campaign:

### Ring 1 — Declared ICP (Who We WANT)
**Source:** `intake_requests` persona data + `campaign_strategies` + ad platform targeting configs
**Data:** Demographics, languages, regions, skills, experience level, engagement model, job requirements

### Ring 2 — Paid Audience (Who We're PAYING to Reach)
**Source:** Google Ads API, Meta Ads API, LinkedIn Campaign Manager, TikTok Ads API
**Data:** Audience targeting settings, demographic breakdowns, interest segments, lookalike sources

### Ring 3 — Observed Audience (Who We're Actually REACHING)
**Source:** GA4 sessions + HIE behavioral signals + UTM click profiles
**Data:** Actual visitor demographics, device/geo/language, behavior patterns, scroll depth, engagement quality, form interaction

### Ring 4 — Converted Audience (Who We're CLOSING — Ground Truth)
**Source:** CRM Postgres datalake — contributor profiles matched to campaign via UTM passthrough
**Data:** Signup source, skills verified, quality scores, activity status, retention, earnings, project history

### Drift Calculation (adapted from VYRA's three-way model)

```
Overall Drift = (
  declared_vs_paid     x 0.25    // Are ads targeting right people?
  declared_vs_organic  x 0.20    // Are the right people finding us organically?
  paid_vs_converted    x 0.30    // Are we CLOSING who we're paying for? (highest weight)
  organic_vs_converted x 0.25    // Does organic attract quality contributors?
)
```

`paid_vs_converted` gets the highest weight because it directly measures ad spend waste.

**Drift severity thresholds** (from VYRA):
- <= 15%: LOW (healthy — targeting is aligned)
- 15-25%: MODERATE (optimization needed)
- > 25%: HIGH (significant mismatch — budget reallocation required)

**Segment mismatch triggered:** When `overall_drift > 15.0`

---

## Identity Stitching & Cross-Device Tracking

### UTM Passthrough (Signup → CRM)
The OneForma signup flow passes UTM parameters through to the CRM record. This means every CRM contributor can be traced back to the campaign, source, medium, and creative that brought them in.

Match chain: `tracked_link.slug` → `/r/[slug]` redirect → `destination_url?utm_*` → signup form → CRM record with `referral_source` / UTM fields.

### Anonymous-to-Known Identity Resolution
Three-stage identity stitching:

1. **Anonymous:** HIE assigns `vyra_vid` (visitor cookie) + `vyra_hsid` (session cookie). GA4 assigns `client_id`. UTM click assigns `tracked_link.slug`.
2. **Pseudonymous:** When visitor submits a form or engages with a CTA, HIE captures the form interaction event (no field values — just field types and completion). GA4 fires a conversion event.
3. **Known:** On CRM signup, the UTM params link the anonymous visitor chain to a real contributor profile. The `client_id` / `visitor_id` is associated with the CRM `user_id` / `email`.

Cross-device: Once the email is known from CRM signup, all sessions with that email (across devices) are stitched into one journey. This is stored in a `visitor_identities` mapping table.

---

## Data Architecture

### Five Data Sources

| Source | Type | Connection | Latency |
|--------|------|-----------|---------|
| **UTM Tracking** | First-party, built | Same Neon DB (`tracked_links`) | Real-time |
| **CRM Datalake** | First-party, existing | Read-only Postgres connection (separate instance) | Near-real-time (sync job) |
| **GA4** | Google API | Analytics MCP server (configured) + GA4 Data API | Hourly/daily |
| **HIE** | First-party, ported | Neon DB (new tables) + client-side JS via GTM | Real-time ingest, daily aggregation |
| **Ad Platforms** | Third-party APIs | Google Ads API, Meta Marketing API | Daily sync |

### New Database Tables (Neon)

```
audience_profiles          -- Unified audience profile per campaign
  id, request_id, ring (declared|paid|organic|converted)
  demographics JSONB       -- age_range, gender_dist, geo_dist
  skills JSONB             -- skill categories, experience levels
  languages TEXT[]
  regions TEXT[]
  sample_size INT
  confidence TEXT           -- high|medium|low
  source TEXT               -- intake_form|google_ads|ga4|crm|hie
  captured_at TIMESTAMPTZ

audience_drift_snapshots   -- Point-in-time drift calculations
  id, request_id
  declared_vs_paid FLOAT
  declared_vs_organic FLOAT
  paid_vs_converted FLOAT
  organic_vs_converted FLOAT
  overall_drift FLOAT
  severity TEXT             -- low|moderate|high
  segment_mismatch BOOLEAN
  evidence JSONB            -- detailed comparison data
  recommendations TEXT[]
  computed_at TIMESTAMPTZ

audience_health_scores     -- Per-campaign health with issues
  id, request_id
  score INT                 -- 0-100
  issues JSONB              -- [{type, message, recommended_action, severity}]
  computed_at TIMESTAMPTZ

visitor_identities         -- Cross-device identity stitching
  id
  visitor_id TEXT           -- HIE vyra_vid cookie
  ga4_client_id TEXT        -- GA4 client_id
  crm_user_id TEXT          -- CRM contributor ID
  email TEXT                -- Known email (after signup)
  utm_slug TEXT             -- First tracked link clicked
  first_seen_at TIMESTAMPTZ
  identified_at TIMESTAMPTZ -- When anonymous became known

hie_sessions               -- Ported from VYRA (simplified)
  id, visitor_id, session_id
  landing_page_url, referrer, user_agent
  viewport_width, viewport_height
  device_type TEXT          -- mobile|tablet|desktop
  started_at TIMESTAMPTZ

hie_events                 -- Ported from VYRA (unified event table)
  id, session_id, visitor_id
  event_type TEXT           -- click|cta_click|scroll|form|mousemove|visibility
  page_url TEXT, page_hash TEXT
  x INT, y INT
  viewport_width INT, viewport_height INT
  element_selector TEXT, element_tag TEXT
  event_data JSONB          -- Type-specific overflow
  client_timestamp_ms BIGINT
  created_at TIMESTAMPTZ

hie_heat_facts             -- Pre-aggregated click density (from VYRA)
  page_url, page_hash, event_type
  grid_x INT, grid_y INT
  click_count INT, unique_sessions INT
  segment_key TEXT, segment_value TEXT
  fact_date DATE

hie_scroll_facts           -- Pre-aggregated scroll depth (from VYRA)
  page_url, page_hash
  depth_band TEXT           -- 0-10, 10-20, ..., 90-100
  sessions_reached INT
  avg_time_at_depth_ms INT
  segment_key TEXT, segment_value TEXT
  fact_date DATE

crm_sync_cache             -- Cached CRM data (avoid hammering datalake)
  id, crm_user_id TEXT
  email TEXT
  country TEXT, languages TEXT[]
  skills JSONB
  quality_score FLOAT
  activity_status TEXT      -- active|inactive|churned
  signup_date TIMESTAMPTZ
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT
  last_synced_at TIMESTAMPTZ

ga4_session_cache           -- Cached GA4 session data
  id
  ga4_client_id TEXT
  date DATE
  source TEXT, medium TEXT, campaign TEXT
  country TEXT, city TEXT
  device_category TEXT
  sessions INT, engaged_sessions INT
  conversions INT
  demographics JSONB        -- age_bracket, gender (when available)
  last_synced_at TIMESTAMPTZ
```

### CRM Datalake Connection

- **Read-only** connection to the OneForma CRM Postgres instance
- **Sync job** runs every 15 minutes, pulling new/updated contributor profiles into `crm_sync_cache`
- Matching: `crm_sync_cache.utm_campaign` → `tracked_links.utm_campaign` AND/OR `crm_sync_cache.email` → `visitor_identities.email`
- Never writes to the CRM — only reads

### GA4 Integration

- **Analytics MCP server** already configured in toolchain (`mcp__analytics-mcp__run_report`, `mcp__analytics-mcp__run_realtime_report`)
- **Daily sync job** pulls session data, demographics, traffic sources into `ga4_session_cache`
- **Real-time widget** can call MCP directly for live session counts
- **GSC integration** for search query data (which searches lead to OneForma pages)

---

## HIE Port (from VYRA)

### What Gets Ported

| VYRA Component | Lines | Adaptation |
|----------------|-------|------------|
| `vyra-tracking-hie.js` (client script) | 741 | Rename cookies, change endpoint URLs, deploy via GTM |
| Event ingest routes | 311 | Next.js API routes instead of FastAPI |
| Session/event DB models | 300 | Neon tables (simplified — unified `hie_events` instead of 3 tables) |
| Fact materialization service | 500 | Cron job or scheduled API route |
| Query service | 200 | Next.js API routes |
| Diagnostics service | 600 | Port detectors (scroll cliff, CTA weakness, form friction) |
| Frontend: HIEHeatmap, HIEScrollmap, HIEReplay | 1000+ | Port as Insights widgets (light theme) |

### What Gets Simplified

- **Single `hie_events` table** instead of VYRA's separate `hie_interaction_events` + `hie_scroll_events` (recruitment pages have lower traffic volume)
- **No separate snapshot service initially** — DOM snapshots deferred to Phase 3
- **Fact materialization via cron** instead of dedicated scheduler service
- **5 diagnostics detectors** instead of VYRA's full set (scroll_cliff, cta_weakness, form_friction, platform_mismatch, ignored_section)

### HIE Deployment via GTM

The HIE client script is injected on OneForma landing pages via Google Tag Manager:
1. Upload `nova-tracking-hie.js` to Vercel Blob (or serve from `/api/hie/script.js`)
2. Create GTM Custom HTML tag that loads the script
3. Configure trigger: fire on all OneForma landing pages
4. Script sends events to `POST /api/hie/batch` with API key auth

---

## Recruitment-Adapted Health Scoring

Starts at 100, deducts for issues:

| Detector | Description | Deduction | Source |
|----------|-------------|-----------|--------|
| `quality_drift` | Signup volume high but avg quality score declining | -30 | CRM |
| `retention_drift` | Campaign produces signups who churn within 30 days | -25 | CRM |
| `skill_mismatch` | Targeting "ML engineers" but closing "data entry" profiles | -25 | CRM vs Declared |
| `geo_mismatch` | Ads target Morocco but quality contributors come from Egypt | -20 | CRM vs Paid |
| `demographic_mismatch` | Age/experience profile doesn't match targeting | -15 | CRM vs Declared |
| `cpa_burnout` | Cost per acquisition rising >25% over 7 days | -20 | Ad Platforms |
| `ctr_decay` | Click-through rate declining >20% over 7 days | -15 | Ad Platforms |
| `scroll_cliff` | >30% drop at a scroll milestone on landing page | -15 | HIE |
| `cta_weakness` | High hover/attention but low click rate on CTA | -15 | HIE |
| `form_friction` | High form abandonment rate | -20 | HIE |
| `lp_mismatch` | Good CTR but low conversion — landing page problem | -20 | GA4 + HIE |

---

## AudienceIQ Widgets (for Insights Dashboard)

### New Widgets to Build

| Widget | Category | Data | What It Shows |
|--------|----------|------|---------------|
| **Drift Radar** | audienceiq | drift_snapshots | Four-ring drift visualization with severity colors |
| **Audience Health** | audienceiq | health_scores | Circular gauge (0-100) + issue list with actions |
| **Targeting vs Reality** | audienceiq | audience_profiles | Side-by-side: declared ICP vs CRM actuals (demographics, skills, regions) |
| **Quality by Channel** | audienceiq | crm + utm | Bar chart: avg quality score per utm_source |
| **Retention Curve** | audienceiq | crm | Line chart: contributor retention by campaign over 30/60/90 days |
| **Contributor Funnel** | audienceiq | utm + crm | Funnel: clicks → signups → active → quality threshold |
| **Skill Distribution** | audienceiq | crm + declared | Declared skills vs actual CRM skills — divergence chart |
| **HIE Heatmap** | hie | hie_heat_facts | Click density grid overlay on landing page screenshot |
| **HIE Scrollmap** | hie | hie_scroll_facts | Scroll depth bar chart with milestone annotations |
| **HIE Form Friction** | hie | hie_events | Form field abandonment rates + time-on-field |
| **GA4 Traffic** | analytics | ga4_session_cache | Sessions, sources, device breakdown |
| **GSC Queries** | analytics | GSC API | Top search queries driving traffic to OneForma |

### Ported from VYRA (adapted)

| VYRA Widget | Recruitment Adaptation |
|-------------|----------------------|
| `AudienceDriftRadarWidget` | Four rings instead of three, CRM ring added |
| `AudienceHealthWidget` | Recruitment detectors replace marketing ones |
| `AudienceDemographicsWidget` | CRM-verified demographics instead of GA4-only |
| `AudienceSignalsWidget` | Contributor signals (skills, quality) instead of interest segments |
| `OrganicPaidAlignmentWidget` | Organic vs paid alignment with CRM validation |

---

## Build Phases

### Phase 1: CRM Connection + Attribution Funnel (Ship First)
**Why first:** Highest value, lowest risk. CRM data exists NOW. No scripts to deploy, no data accumulation wait.

- Read-only Postgres connection to CRM datalake
- `crm_sync_cache` table + 15-minute sync job
- `visitor_identities` table for UTM → CRM matching
- Contributor Funnel widget (clicks → signups → active → quality)
- Quality by Channel widget
- Retention Curve widget
- Skill Distribution widget (declared vs actual)
- Targeting vs Reality widget
- Add "AudienceIQ" widget category to Insights dashboard registry

### Phase 2: Drift Engine + Health Scoring
**Why second:** Builds on CRM data to compute the core drift metrics.

- `audience_profiles` table — build profiles from each ring
- Profile builders: declared (from intake form), converted (from CRM cache)
- `audience_drift_snapshots` table + drift calculator (adapted from VYRA's `detect_drift()`)
- `audience_health_scores` table + health scorer (adapted from VYRA's `score_audience_health()`)
- Drift Radar widget (four-ring visualization)
- Audience Health widget (gauge + issues)
- Drift computation cron (daily, or on-demand per campaign)

### Phase 3: GA4 + GSC Integration
**Why third:** Enriches the "observed" ring with real analytics data.

- GA4 Data API integration via analytics MCP server
- `ga4_session_cache` table + daily sync
- GSC search query data pull
- GA4 Traffic widget
- GSC Queries widget
- Enhanced drift: GA4 demographics feed into Ring 3 (observed audience)

### Phase 4: HIE Behavioral Layer
**Why fourth:** Requires deploying tracking script, waiting for data accumulation.

- Port `nova-tracking-hie.js` client script (adapted from VYRA's 741-line HIE script)
- Deploy via GTM on OneForma landing pages
- HIE ingest API routes (`/api/hie/session`, `/api/hie/batch`)
- `hie_sessions`, `hie_events`, `hie_heat_facts`, `hie_scroll_facts` tables
- Fact materialization cron
- HIE Heatmap widget, HIE Scrollmap widget, HIE Form Friction widget
- Diagnostics: scroll_cliff, cta_weakness, form_friction, lp_mismatch
- Feed HIE behavioral signals into Ring 3 (observed audience)

### Phase 5: Ad Platform Audiences + Full Loop
**Why last:** Requires API credentials for each ad platform. Completes Ring 2.

- Google Ads API integration (audience reports, demographic breakdowns)
- Meta Marketing API (audience insights)
- LinkedIn Campaign Manager API (engagement data)
- Platform audience sync into `audience_profiles` (Ring 2)
- Full four-ring drift with all data sources flowing
- Budget reallocation recommendations based on CRM-verified ROI

---

## API Routes Structure

```
/api/audienceiq/
  drift/
    [requestId]/route.ts         -- GET drift snapshot for campaign
    compute/route.ts             -- POST trigger drift computation
  health/
    [requestId]/route.ts         -- GET health score for campaign
  profiles/
    [requestId]/route.ts         -- GET all 4 ring profiles for campaign
  funnel/
    [requestId]/route.ts         -- GET contributor funnel for campaign
  crm/
    sync/route.ts                -- POST trigger CRM sync
    status/route.ts              -- GET sync status
    contributors/route.ts        -- GET matched contributors for campaign
  identity/
    resolve/route.ts             -- POST stitch visitor → CRM identity

/api/hie/
  session/route.ts               -- POST register HIE session
  batch/route.ts                 -- POST ingest event batch
  heatmap/route.ts               -- GET click density grid
  scrollmap/route.ts             -- GET scroll depth summary
  diagnostics/route.ts           -- GET CRO diagnostics
  facts/refresh/route.ts         -- POST trigger fact materialization

/api/insights/metrics/
  ga4-traffic/route.ts           -- GET GA4 session data
  gsc-queries/route.ts           -- GET GSC search query data
```

---

## Privacy & Compliance

- **CRM connection is read-only** — never writes to the contributor datalake
- **HIE consent gate** — respects `window.nova.hieConsent === false`
- **No form field values captured** by HIE — only field types, completion status, timing
- **PII handling:** email used only for identity stitching, stored hashed in `visitor_identities`
- **GDPR right-to-forget:** DELETE endpoint purges all behavioral + identity data for a visitor
- **Cross-device tracking is opt-in** — only stitches when user explicitly provides email via signup
- **Data retention:** HIE raw events purged after 90 days, fact tables retained indefinitely
- **CRM cache TTL:** 24 hours — stale records refreshed on next sync cycle

---

## Success Metrics

After 30 days of Phase 1+2 deployment:

- Can answer: "Which campaign produces the highest quality contributors?"
- Can identify: drift between declared ICP and actual converter profile
- Can recommend: budget reallocation based on CRM-verified cost-per-quality-contributor
- Can detect: campaigns producing high signup volume but low quality/retention (vanity metrics)

After full deployment (all 5 phases):

- Four-ring drift score computed daily for every active campaign
- Health score with actionable issue detection (quality drift, retention drift, skill mismatch)
- HIE behavioral evidence on landing pages (scroll cliffs, CTA weakness, form friction)
- GA4-enriched traffic attribution with cross-device identity stitching
- Full-funnel visibility: ad impression → click → page visit → behavior → signup → active contributor → quality score
