# OneTake Platform Roadmap — Updated April 24, 2026

> Day 18 of deployment. 740+ commits. 80K+ LOC. Production at nova-intake.vercel.app.

---

## Executive Summary

OneTake is a fully autonomous recruitment marketing platform that takes a job description and produces localized creative packages across 16+ countries in under 2 hours. This roadmap tracks the **6-week rollout** from Day 1 (April 6) through the SVP pitch (target: May 5, Day 30).

**Day 18 status:** Core pipeline deployed. 4 portals live. AudienceIQ intelligence layer shipped. GraphRAG interest routing live with 1,054 real platform interests. Unified Campaign Workspace with country-level navigation built. GPT Image 2 live. Michael deliverables shipped. CI fully green (614 tests). Azure migration plan approved by China engineering team.

---

## What's Live (Shipped)

### Core Pipeline (6 Stages)
| Stage | Name | Status | Details |
|---|---|---|---|
| 1 | Strategic Intelligence | Live | Cultural research, personas, campaign strategy, interest graph routing |
| 2 | Image Generation | Live | GPT Image 2 (via OpenRouter, configurable quality), VQA validation, actor identity cards |
| 3 | Copy Generation | Live | Per-persona x channel x language, brand voice, cultural adaptation |
| 4 | Composition Engine | Live | HTML template rendering via GLM-5, VQA gate |
| 5 | Video Pipeline | Partial | Kling API integration built, credits being loaded |
| 6 | Landing Pages | Partial | Template system built, design polish in progress |

### Four Portals
| Portal | Role | Status |
|---|---|---|
| Recruiter | Intake form, creative library, UTM link builder | Live |
| Marketing Manager | Command center, campaign workspace, insights dashboard | Live |
| Designer | Gallery, edit suite, Figma integration | Live |
| Agency | Magic-link handoff, ad set targeting, budget allocation | Live |

### Unified Campaign Workspace (NEW — April 23)
- **Country bar** — primary navigation with per-country status badges (DONE/GEN/PEND)
- **All Countries overview** — grid of country cards with status filters + aggregate stats
- **Section pills** — Brief / Personas / Creatives / Media Strategy / Channel Mix / Videos / Cultural Research
- **Client-side filtering** — `useMemo` filters actors/assets/strategies by country, instant switching
- **Persona scaling** — 2 personas x 2 actors (1-2 countries), 1 x 1 (3+ countries)
- **Country job creator** — replaces campaign splitter. One campaign, many compute_jobs.
- **93 tests** (46 Python + 47 TypeScript)

### Day 18 Ships (NEW — April 24)
- **GPT Image 2 integration** — switched from Seedream to GPT Image 2 via OpenRouter. Configurable quality (low/medium/high). $0.225/image.
- **IMAGE_CONCURRENCY configurable** — now 15 (was hardcoded 9)
- **Michael deliverables complete** — Dockerfile, env manifest, Azure Blob adapter, Command Center schema all shipped
- **README updated to OneTake** — full AudienceIQ docs + 40+ table inventory
- **CI fully green** — 614 tests (413 TypeScript + 201 Python), 5 gates
- **Smoke test fix** — KLING_API_KEY environment variable
- **Vitest config expanded** — catches all test files
- **Tracked-links draft/generating status gate** — prevents sharing incomplete links
- **Ruff lint cleanup** — across all worker files

### GraphRAG Platform Interest Routing (NEW — April 23)
- **Knowledge graph**: 1,054 interest nodes across 6 platforms (Meta 312, LinkedIn 274, TikTok 130, Reddit 118, Snapchat 84, WeChat 141)
- **1,018 edges**: 740 hierarchy (parent_of) + 278 cross-platform (equivalent_on)
- **Interest router**: Maps LLM concepts to real platform interests → `{hyper[], hot[], broad[]}`
- **Cross-platform intelligence**: Traverses `equivalent_on` edges for consistent targeting
- **Stage 1 integration**: Post-processes strategy output, non-fatal fallback
- **Frontend fixes**: AdSetRow simplified, MediaStrategyEditor null safety
- **29 tests** (13 seeder integrity + 16 router logic)

### AudienceIQ Intelligence Layer (NEW — April 23)
Four-ring audience drift detection: "What is the gap between who we target, who we reach, and who converts?"

| Phase | Name | Status | What It Does |
|---|---|---|---|
| 1 | CRM Integration | Shipped | Identity stitching (UTM → CRM), contributor funnel, quality-by-channel, retention curves, skill distribution |
| 2 | Drift Engine | Shipped | Four-ring drift calculation (declared vs paid vs organic vs converted), 100-point health scoring, issue detection |
| 3 | GA4 + GSC | Shipped | Session caching, traffic sources, device breakdown, search query analysis, organic profile building |
| 4 | HIE Behavioral | Planned | VYRA tracking script port, scroll depth, CTA clicks, form friction, heatmaps |
| 5 | Ad Platform APIs | Planned | Google Ads, Meta Marketing API, LinkedIn Campaign Manager — paid audience ring |

**9 AudienceIQ widgets** deployed to Insights dashboard:
1. ContributorFunnelWidget — clicks → signups → active → quality
2. QualityByChannelWidget — avg quality per utm_source
3. RetentionCurveWidget — retention over 30/60/90 days
4. SkillDistributionWidget — declared vs actual skills
5. TargetingVsRealityWidget — targeting config vs CRM reality
6. DriftRadarWidget — four-ring visualization with severity
7. AudienceHealthWidget — circular gauge (0-100) + issue list
8. Ga4TrafficWidget — sessions, sources, devices
9. GscQueriesWidget — top search queries + CTR/position

### Country Quotas & Demographics (NEW — April 23)
- **Spec complete**: Per-country volume, rates, demographic quotas in intake wizard
- **Data model**: `CountryQuota` + `DemographicQuota` types
- **Locale rate integration**: Feeds into ROAS framework (RPP per locale)
- **Persona scaling rule**: Dynamic persona/actor counts based on country count
- **Implementation**: Plan written, ready for execution

### Infrastructure & Security
- 17-commit security hardening (auth bypass, IDOR, XSS, secrets, CSP)
- GitHub Actions CI: build, lint, test, Python lint, Docker build
- Multi-arch Dockerfile (Azure VM + Apple Silicon)
- WordPress auto-publish with Yoast SEO
- UTM tracked link builder with click tracking
- Teams + Outlook webhook notifications

---

## What's Planned (Not Yet Shipped)

### CI/CD to Azure Container Registry (NEW)
GitHub Actions auto-deploy — every green push builds Docker image and pushes to Azure Container Registry. Eliminates manual deployment steps for the Python worker.

**Needs:** ACR credentials + service principal from Michael's team.

### Microsoft Integrations (via Azure Function Apps + Microsoft Graph API) (NEW)
- **MS Teams** — production webhook URL for campaign notifications (currently test URL)
- **Outlook** — automated email notifications to recruiters/stakeholders
- **SharePoint** — auto-create folders per campaign, push generated assets + documents (briefs, reports, creative packages)
- **Azure AD / Entra ID** — sync with Clerk auth for role-based permissions per campaign, dynamic recruiter access to specific requests and leads

### OpenAI Direct API Transition (NEW)
Move from OpenRouter ($0.225/image) to OpenAI API direct ($0.006/image) for GPT Image 2. **37x cost reduction**, same quality. Needs: OpenAI API key setup.

### onetake.oneforma.com Subdomain (NEW)
Changed from nova.oneforma.com to onetake.oneforma.com. CNAME → cname.vercel-dns.com. Waiting on IT.

### Server-Side GTM for Meta Conversions API (SHIPPED — April 25)
Server-side Google Tag Manager container deployed with Meta Conversions API. Real conversion tracking live:
- Signup completions (not just landing page visits)
- Profile completions (the actual conversion event)
- Quality contributor status (from CRM datalake feedback loop)

Feeds into AudienceIQ Ring 2 (Paid Audience) and enables true ROAS calculation. Bypasses ad blockers and iOS privacy restrictions.

### CRM Datalake Integration
Connect the CRM datalake (richer than transactional CRM) into AudienceIQ:
- Quality scores per contributor
- Task completion rates
- Retention metrics (30/60/90 day)
- Skill match accuracy
- Geographic distribution

Extends the existing `CRM_DATABASE_URL` pattern. Feeds Ring 4 (Converted Audience) with deeper quality signals for drift detection and health scoring.

### ROAS Formula Unification
Unify the revised ROAS and target CPA formulas from `/Users/stevenjunop/Oneformadata/roas_framework.md` into the Command Center + AudienceIQ:
- Per-country ROAS using locale rates from country_quotas
- Target CPA benchmarks per campaign type
- Breakeven CPA calculation with fulfillment rate adjustment
- RevBrain budget recommendations powered by real conversion data (from server-side GTM)

### Fixed: WordPress Taxonomy Posting (April 23)
WordPress auto-publish now correctly assigns custom post types, ACF fields, and taxonomy terms. Previously posts were going to wrong categories.

### Week 3-4: Azure Migration (4 days estimated)
Michael (China engineering lead) completed code review April 22. Proposed hybrid deployment:

| Component | Current | Target | Effort |
|---|---|---|---|
| Frontend (Next.js) | Vercel | Vercel (no change) | 0 min |
| Python Worker | Local MLX poller | Azure Container Apps | Add Dockerfile (~2 hours) |
| Database | Neon Postgres | Azure Postgres Flexible | pg_dump/restore + swap DATABASE_URL (~1 hour) |
| File Storage | Vercel Blob | Azure Blob | Swap blob.ts (~30 min) |
| Auth | Clerk | Clerk (no change) | 0 min |
| Domain | nova-intake.vercel.app | onetake.oneforma.com | DNS CNAME (~15 min) |

**GPU infrastructure ask**: Steven asked Michael about company GPU access for self-hosted NIM models (Qwen 3.5 397B, Gemma 4 30B, MiniMax 2.7). If available, eliminates API rate limits and external dependencies. If not, continue with NIM key rotation (15 keys).

### Week 3-4: Command Center (SRC Port)
Port `/Users/stevenjunop/src-command` analytics dashboard:
- Campaign-scoped KPI cards (spend, applications, CPA, conversion rate, ROAS)
- Channel mix breakdowns per campaign
- RevBrain budget recommendations
- Export generation + shareable report links
- ROAS framework from `/Users/stevenjunop/Oneformadata/roas_framework.md`

ROAS formula (recruitment-specific):
```
RPP = Contract Value / Required Participants
Net RPP = RPP - Variable Cost Per Participant
CPA = Ad Spend / Completions
Effective CPA = Ad Spend / (Completions x Fulfillment Rate)
ROAS = (Completions x FR x Net RPP) / Ad Spend
Breakeven CPA = Net RPP x Fulfillment Rate
```

### Week 4: Stage 4 Template Polish
- Refine HTML creative templates for agency-quality output
- Fix remaining Stage 4 parsing issues (#4 country code mismatch, #5 budget strings, #6 double-encoded JSON)
- Add 10+ new template variations
- VQA quality gate tuning

### Week 4-5: Organic Content Extension
- Social posts (LinkedIn, Instagram, Twitter) — Stage 3 extension
- Flyers and posters — Stage 4 extension
- Email sequences — new generation flow
- Job posting copy — per-locale adaptation

### Week 5: SVP Pitch Preparation
- 3-5 real campaigns run end-to-end with results
- Time savings analysis (3-5 days → 30 minutes)
- Cost analysis (agency cost vs $0 NIM)
- Live demo of full pipeline + Command Center
- VYRA integration pitch deck

---

## Dependencies & Blockers

| Item | Owner | Status | Impact | Priority |
|---|---|---|---|---|
| `go.oneforma.com` CNAME | IT Admin | Requested | Branded short links | P2 |
| `onetake.oneforma.com` CNAME | IT Admin | Requested | Production domain (replaces nova.oneforma.com) | P1 |
| Azure Container Registry credentials | Michael's team | Needed | CI/CD auto-deploy | P1 |
| Microsoft Graph API app registration | Michael/IT | Needed | Unlocks Teams + Outlook + SharePoint + AD | P1 |
| OpenAI API key | Steven | Planned | Direct image gen ($0.006/image, 37x savings) | P2 |
| Azure AD SSO (Clerk SAML) | IT Admin | Not started | Internal team login | P1 |
| Teams webhook (prod URL) | IT Admin | Not started | Prod notifications | P1 |
| Kling API credits | Steven | In progress | Stage 5 at scale | P2 |
| Neon DB password rotation | Steven | Pending | Old creds in git history | P1 |
| Michael Azure deliverables | Michael | Delivered April 24 | Dockerfile, env manifest, blob adapter, schema | P1 |
| Company GPU access | Michael | Asked April 22 | Self-hosted models | P2 |
| GA4 property access | Poola/IT | Required | AudienceIQ Phase 3 live data | P2 |
| Recruiter pilot volunteers | Jenn | Not started | Need 1-2 by Week 3 | P1 |
| Ad platform API accounts | Steven/IT | Required | AudienceIQ Phase 5 + GraphRAG backfill | P3 |
| Reddit API app | Steven | Can do today | Seed 152 interests via API | P3 |
| TikTok advertiser account | Centific | No account | Backfill 706 TikTok interests | P3 |

---

## Specs & Plans Inventory (April 24, 2026)

### Active/Recent Specs (Last 2 Weeks)

| Date | Spec | Status | LOC Impact |
|---|---|---|---|
| Apr 23 | GraphRAG Platform Interest Routing | **Shipped** | +1,054 graph nodes, router, 6 seed files |
| Apr 23 | Unified Campaign Workspace | **Shipped** | +4 components, workspace refactor, country jobs |
| Apr 23 | AudienceIQ Design (Phase 1-3) | **Shipped** | +9 widgets, 10 tables, drift engine, health scorer |
| Apr 22 | Country Quotas & Demographics | Spec complete | CountryQuotaTable component, intake wizard |
| Apr 22 | Multi-Country Architecture | Documented | Architecture reference doc |
| Apr 16 | CI/Docker Design | **Shipped** | Dockerfile, GitHub Actions |
| Apr 16 | Security Hardening | **Shipped** | 17 commits |

### All Plans (45 total)

**April 23, 2026:**
- `graphrag-plan1-data-layer.md` — 8 tasks (COMPLETE)
- `graphrag-plan2-router-integration.md` — 7 tasks (COMPLETE)
- `audienceiq-phase1-crm.md` — CRM sync + identity stitching (COMPLETE)
- `audienceiq-phase2-drift.md` — Drift engine + health scoring (COMPLETE)
- `audienceiq-phase3-ga4.md` — GA4 + GSC integration (COMPLETE)
- `unified-workspace-plan1-schema.md` — 5 tasks (COMPLETE)
- `unified-workspace-plan2-pipeline.md` — 8 tasks (COMPLETE)
- `unified-workspace-plan3-frontend.md` — 7 tasks (COMPLETE)
- `country-quotas-demographics.md` — 11 tasks (READY)

**April 12-16, 2026:**
- CI/Docker, security hardening, designer portal, agency view, pipeline alignment

**April 3-11, 2026:**
- Stage 4 composition engine, creative quality, media strategy, recruiter library, WordPress auto-publish

**March 27-31, 2026:**
- Core pipeline, campaign strategy, frontend portals, parallel worker system

---

## Known Issues

### Media Strategy Parsing (6 issues, 3 fixed)

| # | Issue | Status |
|---|---|---|
| 1 | Interests structure mismatch | **Fixed** (GraphRAG router) |
| 2 | Missing channel mix | **Fixed** (MediaStrategyEditor null safety) |
| 3 | Missing campaigns array | **Fixed** (flattenAdSets guard) |
| 4 | Country code mismatch | **Fixed** (normalize_country() in country_job_creator) |
| 5 | Budget fields as strings | **Fixed** (_sanitize_strategy_budgets() strips $, coerces to float) |
| 6 | Double-encoded JSON | **Fixed** (_ensure_list() for TEXT[] columns) |

### Other Open Issues
- Magic link migration needed (from security hardening)
- Media Strategy + actor data surfacing issue (undiagnosed)
- Stage 2 regeneration persona_key fix needed

---

## Timeline to SVP Pitch (Day 30 = May 5)

```
Day 18 (Apr 24) — SHIPPED
  ├── GPT Image 2 live ($0.225/image, configurable quality)
  ├── ROAS formula unification (calculator + budget recs + API + 21 tests)
  ├── Country Quotas & Demographics (intake wizard + pipeline + extraction)
  ├── All 6 parsing issues fixed
  ├── Michael deliverables shipped (Dockerfile, env manifest, blob adapter, schema)
  ├── CI green (635 tests, 5 gates)
  ├── README + roadmap updated to OneTake
  └── Email sent to Michael with 6 questions

Day 19 (Apr 25) — TODAY
  ├── Server-side GTM for Meta Pixel — SHIPPED
  ├── Designer view country support (in progress)
  ├── Agency view country support
  └── Recruiter view country support

Day 21-23 (Apr 28-30)
  ├── Azure deployment (Michael's team provisions resources)
  ├── CI/CD pipeline to Azure Container Registry
  ├── Microsoft Graph API setup (Teams, Outlook, SharePoint, AD)
  ├── Command Center dashboard port
  └── onetake.oneforma.com DNS

Day 24-26 (May 1-3)
  ├── OpenAI direct API transition ($0.006/image)
  ├── Real campaign testing (3-5 campaigns E2E)
  ├── Recruiter pilot testing
  └── Stage 4 template refinement

Day 27-30 (May 4-5)
  ├── Results compilation
  ├── Demo preparation
  └── SVP pitch (Day 30)

Day 30+ (Post-pitch)
  ├── AudienceIQ Phase 4 (HIE behavioral)
  ├── AudienceIQ Phase 5 (ad platform APIs)
  ├── Organic content extension
  └── VYRA convergence decision
```

---

## Success Metrics

| Metric | Before OneTake | With OneTake | Day 18 Status |
|---|---|---|---|
| Time: JD → creative package | 3-5 days | 30 minutes | Achieved |
| Creatives per campaign | 2-4 | 15-30+ per country | Achieved |
| Cost per campaign | Agency + designer time | ~$0 (NIM free tier) | Achieved |
| Countries per campaign | 1 at a time | 16+ simultaneous | Built (unified workspace) |
| Interest targeting | Manual guesswork | 1,054 real platform interests | Live (GraphRAG) |
| Attribution | Broken (7,600 → 0) | Full UTM → CRM loop | Built (AudienceIQ) |
| Audience intelligence | None | Four-ring drift detection | Shipped |
| Platform interest coverage | 0 platforms | 6 platforms | Live |
| Image generation cost | N/A | $0.04 (Seedream) → $0.225 (GPT Image 2 OpenRouter) → $0.006 (OpenAI direct, planned) | $0.225/image |
| Test coverage | 0 | 614 total (413 TypeScript + 201 Python) | CI green, 5 gates |

---

## Team

| Person | Role | Alignment |
|---|---|---|
| **Steven Junop** | Digital Marketing Manager / Platform Builder | Leading |
| **Jenn** | Steven's manager | Impressed Day 1, collaborating |
| **Michael** | China eng lead | Code reviewed, migration plan approved |
| **Miguel** | Designer | Daily portal testing |
| **Marketing Coordinator** | Stealth ally | Aligned on automation |
| **Stefan** | SVP (target for pitch) | Set 30-day delivery goal |
