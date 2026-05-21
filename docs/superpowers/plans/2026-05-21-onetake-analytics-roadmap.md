# OneTake Analytics Platform — Roadmap & Status

> **Updated:** May 21, 2026 | **Author:** Steven Junop | **Status:** Production-ready, K8s proxy deployed

---

## What's Shipped (Production)

### Dashboard 1: Project Command Center
- [x] 53 WP projects auto-seeded via cron (every 3h)
- [x] GA4 first-touch attribution (totalUsers dedup, firstUserCampaignName)
- [x] Hero metrics: applications, spend, CPA, organic share (date-range responsive)
- [x] Performance Over Time chart (daily for 7d/14d, weekly for 30d+)
- [x] Channel-Level Funnel Comparison with brand icons (react-icons)
- [x] Country filter via GA4 project_country_performance (141 countries)
- [x] Project filter, date range (7d/14d/30d/90d/All)
- [x] Click-through to Deep Dive (URL param handoff)
- [x] Sticky header with backdrop-filter blur

### Dashboard 2: Project Deep Dive
- [x] Adaptive funnel (paid/organic/AidaForm auto-detected from WP locale links)
- [x] 9-stage funnel: WP Entry → Apply Click → Signup → MFA → Profile → NDA → Cert → Browsing → Doing Tasks
- [x] Source attribution table with brand icons, UTM detail (utm_content, utm_term)
- [x] Paid media section: NDM campaigns + GA4 conversions for real CPA
- [x] Country pills with "See more" for 5+ countries
- [x] Blank intro state when no project selected
- [x] Date-range responsive (ga4_organic_weekly date-filtered path)

### Dashboard 3: Channel Intelligence
- [x] 20+ channel selector with grouped hierarchy (Meta, LinkedIn, Google, AI, Job Boards, etc.)
- [x] Per-slug GA4 source matching (SLUG_SOURCE_MATCH with PAID_MEDIUMS exclusion)
- [x] Three filters: channel, project, country — all verified working
- [x] Date range responsive (7d/14d/30d/90d)
- [x] **Paid channels:** NDM campaign table with SCALE/HOLD/KILL verdicts + Meta Ads adset drill-down
- [x] **Organic channels:** GA4 source breakdown table + project breakdown
- [x] **Instagram:** 212 posts from Meta Graph API with engagement/likes/comments/saves + post classification
- [x] **Google Organic:** Top Landing Pages from GA4 (195 rows) + Connect GSC prompt
- [x] GSC pipeline fully built (proxy + API route + sync + cron) — awaiting SA credentials

### Analytics Homepage
- [x] 3 featured gradient cards (Command Center, Deep Dive, Channel Intel)
- [x] 6 pre-built mini dashboard cards with cohesive BRAND palette
- [x] Custom dashboards section with New Dashboard button
- [x] AI Composer removed from homepage (moved to floating chat on dashboard)

### AI Dashboard Builder
- [x] Floating chat FAB on dashboard pages (purple gradient, sparkles icon)
- [x] Expandable/collapsible chat panel with message history
- [x] 47 widgets exposed to LLM (up from 17) across 8 categories
- [x] LLM assembles widgets only — never touches data (complete data security)
- [x] Compose endpoint: prompt → Kimi K2.5 → widget selection → grid layout → dashboard created

### Sidebar Navigation
- [x] "Insights" removed — "Analytics" section header links to homepage
- [x] Only active child highlighted (no double-active badge)

### Infrastructure
- [x] Python aiohttp proxy (db_proxy.py) with 20+ REST endpoints
- [x] Azure K8s deployment (Pengfei configured router + Azure PG)
- [x] Docker image: python3.12-slim + aiohttp + asyncpg (~50MB)
- [x] Rate limiting 1000 req/min, Bearer token auth, security headers
- [x] 6-step cron pipeline: WP seed → locale links → GA4 funnel → link intakes → GSC sync → refresh view
- [x] Local dev proxy: DB_PROXY_URL=http://localhost:8080 in .env.local

---

## In Progress / Needs Wiring

### Channel Intelligence — Platform API Wiring
- [ ] **GSC Keywords:** SA `onedata-mcp@...` needs to be added to Search Console + key exported (GCP org policy blocks creation)
- [ ] **LinkedIn Posts:** `LI_ORG_ID` + `LI_TOKEN` not configured in worker/.env
- [ ] **Reddit Posts:** `REDDIT_CLIENT_SECRET` + `REDDIT_PASSWORD` env var escaping issue
- [ ] **Facebook Engagement:** 197 posts in cache but metrics = 0. Page token may need refresh
- [ ] **Meta Paid adset drill-down:** Wired but needs K8s proxy endpoint for meta_ads_cache

### K8s Proxy — Wire & Test
- [ ] Deploy updated db_proxy.py with 5 new endpoints (meta organic posts, meta ads, GA4 landing pages, GSC keywords, GSC pages)
- [ ] Verify Vercel → K8s proxy connectivity for new routes
- [ ] Set `DB_PROXY_URL` + `DB_PROXY_SECRET` in Vercel env vars to K8s URL
- [ ] Run `sync_organic_landing_pages.py` on K8s to seed landing page data
- [ ] Add `sync_organic_landing_pages` to cron pipeline

### Data Quality
- [ ] GTM v53 trigger cleanup (12 tags multi-firing 3-6x) — spec written, not deployed
- [ ] CSP blocking on my.oneforma.com — email drafted for Wentao/Michael
- [ ] 28K unattributed platform conversions pending platform team's /crowd/jobs/{id} mapping

---

## Future / Backlog

### Phase 2: AI Intelligence Layer
- [ ] Auto-insights per widget (LLM generates one-line insight from widget data summary)
- [ ] Proactive alerts (anomaly detection, budget pacing, CPA spikes)
- [ ] Chat sidebar iteration (modify/remove widgets through conversation)

### Phase 3: Platform Integrations
- [ ] Google Ads API (stub exists, needs credentials)
- [ ] TikTok Ads API (stub exists, needs credentials)
- [ ] LinkedIn Ads API (stub exists, needs credentials)
- [ ] Brevo email campaign metrics
- [ ] Real-time GA4 reports via Analytics MCP

### Phase 4: Advanced Features
- [ ] Shared/public dashboard links (infrastructure exists — `/insights/public/[token]`)
- [ ] Scheduled email reports (PDF export + Brevo send)
- [ ] Recruiter self-service UTM view
- [ ] Creative A/B test comparison widget
