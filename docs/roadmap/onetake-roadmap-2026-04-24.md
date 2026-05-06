# OneTake Platform Roadmap — Updated May 6, 2026

> Day 31 of deployment. 850+ commits. ~108K LOC. **Domains live. Normalization layer shipped. Demo Friday May 9.**

---

## Executive Summary

OneTake is a fully autonomous recruitment marketing platform that takes a job description and produces localized creative packages across 16+ countries in under 2 hours. This roadmap tracks the **6-week rollout** from Day 1 (April 6) through the Friday demo (May 9, Day 34).

**Day 31 status:** `onetake.oneforma.com` DNS **LIVE** (CNAME locked in Cloudflare). `pro.oneforma.com` CNAME live, TXT verification pending IT. Data normalization layer shipped — Meta Ads, Reddit Ads, Brevo sync clients + orchestrator route + `normalizeToDaily()` pipeline ready for real credentials. Extraction speed 3x faster (Kimi K2.5 primary, 30s timeout). Intake wizard sizing standardized + OnForma-branded loader with fun facts + progress timeline. **Friday demo (May 9) is the target — everything this week serves that.**

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

### Day 23 Ships (April 29): Azure Infrastructure Provisioned
- **Azure resource group provisioned by IT** — ACR, Container App, Log Analytics, Container Apps Environment, SSL cert
- **Custom domain live:** `onetake.oneforma.com` with SSL certificate and CORS (`*.oneforma.com`, `*.centific.com`)
- **Worker image pushed to ACR** — `novacert.azurecr.io/onetake-worker:latest` + `:1b0c28d` (linux/amd64)
- **GitHub Actions CI/CD wired to ACR** — `ACR_USERNAME`/`ACR_PASSWORD` secrets set, auto-push on merge to main
- **App Registration active** — `azc-sp-onetake-dev-deployment` (client ID: `53dce4f5-8c80-4ed8-be44-625ea0966d22`)
- **Full IT spec + follow-up email sent** — env manifest, networking, database specs, Container App config

### Day 24 Ships (April 30): WORKER LIVE ON AZURE
- **PostgreSQL 17.9 delivered by IT** — `onetake-pg-west01.postgres.database.azure.com`, connected, all features verified
- **Schema migration complete** — 31 tables, 76 indexes, 0 errors. Exact replica of Neon schema on Azure PG
- **Firewall self-managed** — dev IP (73.1.31.109) added via `az` CLI
- **Container App configured** — 4 secrets (DATABASE_URL, OPENROUTER_API_KEY, NVIDIA_NIM_API_KEY, BLOB_READ_WRITE_TOKEN) + 3 plain env vars (APP_URL, WORKER_ID, POLL_INTERVAL_SECONDS)
- **Image swapped** — nginx test container replaced with `novacert.azurecr.io/onetake-worker:latest`
- **Resources bumped** — 2 vCPU / 4 GiB (up from 0.5 / 1 GiB)
- **Worker running** — PID 1, polling every 30s, NIM inference mode, connection pool created
- **Docker image fixed** — added `numpy` to `requirements-docker.txt` (deglosser dependency), rebuilt + pushed
- **Admin user seeded** — `steven.junop@centific.com` = admin on Azure PG
- **Graph API permissions discovered already admin-consented** — `User.Read.All`, `Group.Read.All`, `Mail.Send`, `Files.ReadWrite.All`, `Sites.Selected`, `Team.ReadBasic.All` — all live
- **App Registration owner access confirmed** — Steven, Michael, Pengfei are owners. Can modify redirect URIs, generate secrets
- **Clerk OAuth redirect URI added** — `https://allowing-hedgehog-42.clerk.accounts.dev/v1/oauth_callback` on app registration
- **Clerk client secret generated** — ready to configure in Clerk dashboard
- **Domain restriction shipped** — `isAllowedDomain()` gates auto-provisioning + `requireRole()` + `getAuthContext()`. Defaults to `centific.com,oneforma.com`. Env var configurable.
- **`onetake.oneforma.com` added to Vercel** — pending DNS verification (TXT + CNAME records sent to IT)
- **IT reply email drafted** — PG17 ack, Graph API correction (dropped `ChannelMessage.Send`), OAuth instead of SAML, DNS records for Vercel
- **IT helpdesk SAML ticket drafted** — step-by-step Enterprise Application setup guide for Azure AD admin

### Day 30 Ships (May 5): Organic-First Pipeline + Asset Edit Hub (22 commits)

**Organic-First Pipeline with Paid Upgrade — 12 commits:**
- **Pipeline mode routing** — `pipeline_mode` column on `intake_requests` (organic/full). Orchestrator swaps stages based on mode.
- **Organic Stage 3** — `stage3_organic_copy.py`: WP job posts, Indeed/LinkedIn Jobs/Glassdoor copy, flyer copy, social captions per persona × locale
- **Organic Stage 4** — `stage4_organic_compose.py`: social graphics (LinkedIn, IG, Facebook) + print flyers with QR codes via GLM-5 HTML composition
- **QR code generator** — `worker/utils/qr_generator.py`: QR → Aidaform (with UTM), fallback to job posting. Tracked links per locale.
- **Stage 1 organic mode** — Skips media strategy generation for organic. `run_campaign_strategy_standalone()` for paid upgrades.
- **Lead recruiter role** — New `lead_recruiter` role in DB + permissions. Can view all campaigns + request paid upgrade.
- **Request Paid API** — `POST /api/intake/[id]/request-paid`: auto-calculate budget from RPP formula, create `generate_paid` job
- **Frontend** — `OrganicMaterials.tsx` (4 tabs: Job Posts, Social, Flyers, Tracked Links), `PipelineModeBadge`, "Request Paid Media" button (lead_recruiter/admin only)
- **Paid sections hidden** — Media Strategy, Paid Creatives, Videos pills hidden until paid upgrade

**Asset Edit Hub — 9 commits:**
- **Edit classifier** — `edit-classifier.ts`: keyword routing → copy_update / link_update / locale_add / targeted_edit
- **Edit executor** — `edit-executor.ts`: Gemma 3 27B copy revision, link/QR update, batch rollback (original_value snapshots)
- **Edit API** — `POST /api/intake/[id]/edit`: multipart (Excel upload), edit lock, classification, execution, Teams notification, 207 partial success
- **Rollback API** — `POST /api/intake/[id]/edit/rollback`: revert all assets by batch_id
- **Excel parser** — `excel-parser.ts`: parse locale Excel (country, url, label) for locale_add
- **EditMode frontend** — `EditMode.tsx`: "Edit Campaign" toggle, asset checkboxes, instruction bar, Excel upload, Apply button, Undo with rollback
- **Bulletproofing** — Edit lock (5 min expiry), max 50 assets/batch, 2000 char instruction limit, asset ownership verification, concurrent edit prevention

**Azure Admin + IT (earlier Day 29-30):**
- **Azure PG full admin confirmed** — `sqladm` has `azure_pg_admin` role, self-service migrations
- **Azure Function named** — `onetake-fn-west01` submitted to IT
- **Entra ID application** — Custom app, no user assignment required
- **DNS request finalized** — 3 Cloudflare records for Vercel subdomains

### Infrastructure & Security
- 17-commit security hardening (auth bypass, IDOR, XSS, secrets, CSP)
- GitHub Actions CI: build, lint, test, Python lint, Docker build + ACR push
- Multi-arch Dockerfile (Azure Container Apps + Apple Silicon)
- WordPress auto-publish with Yoast SEO
- UTM tracked link builder with click tracking
- Teams + Outlook webhook notifications

---

## What's Planned (Not Yet Shipped)

### CI/CD to Azure Container Registry (SHIPPED — April 29)
GitHub Actions auto-deploy — every green push to main builds Docker image and pushes to `novacert.azurecr.io/onetake-worker`. ACR credentials set as GitHub secrets. First image pushed manually April 29.

### onetake.oneforma.com Custom Domain (SHIPPED — April 29)
IT provisioned `onetake.oneforma.com` with SSL certificate on Azure Container Apps. CORS configured for `*.oneforma.com` and `*.centific.com`. Live and verified.

### Microsoft Integrations (PERMISSIONS GRANTED — April 30)
All Graph API permissions already admin-consented on app registration `azc-sp-onetake-dev-deployment`:
- **SharePoint** — `Sites.Selected` granted (need IT to grant access to specific OneForma18 site). Auto-create per-campaign folders.
- **MS Teams** — Using webhooks (working). `Team.ReadBasic.All` granted. Dropped `ChannelMessage.Send` (RSC permission, not needed — webhooks are simpler).
- **Outlook** — `Mail.Send` granted (application-level). Waiting on shared mailbox from IT (`noreply@oneforma.com`).
- **Azure AD / Entra ID** — `User.Read.All` + `Group.Read.All` granted. User/group lookup ready.

### Clerk Authentication (OAUTH READY — April 30)
Pivoted from SAML ($50/mo Clerk Pro) to **Microsoft OAuth** (free Clerk tier):
- App registration redirect URI added: `https://allowing-hedgehog-42.clerk.accounts.dev/v1/oauth_callback`
- Client secret generated, ready to configure in Clerk dashboard
- Sign-in audience: Single tenant (Centific/OneForma only)
- Domain restriction enforced at app level: `isAllowedDomain()` in `user-roles.ts` + `permissions.ts` + `auth.ts`
- Defaults to `centific.com,oneforma.com`, configurable via `ALLOWED_EMAIL_DOMAINS` env var
- SAML helpdesk ticket also drafted as future upgrade path if needed

### OpenAI Direct API Transition
Move from OpenRouter ($0.225/image) to OpenAI API direct ($0.006/image) for GPT Image 2. **37x cost reduction**, same quality. Needs: OpenAI API key setup.

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

### Azure Migration (COMPLETE — April 30)
Michael (China engineering lead) completed code review April 22. Pengfei and IT provisioned full infrastructure April 28-29. Worker went live April 30.

| Component | Current | Target | Status |
|---|---|---|---|
| Frontend (Next.js) | Vercel | Vercel (no change) | **No change needed** |
| Python Worker | Local MLX poller | Azure Container Apps | **LIVE** — polling every 30s, 2 vCPU / 4 GiB |
| Database | Neon Postgres 17.8 | Azure Postgres Flexible 17 | **LIVE** — PG 17.9, 31 tables, 76 indexes migrated |
| File Storage | Vercel Blob | Azure Blob | Dual-provider adapter ready in `blob.ts` (using Vercel Blob for now) |
| Auth | Clerk | Clerk + Microsoft OAuth | **READY** — OAuth credentials generated, configure in Clerk dashboard |
| Domain | nova-intake.vercel.app | onetake.oneforma.com | **Pending DNS** — added to Vercel, TXT + CNAME records sent to IT |
| CI/CD | Manual | GitHub Actions → ACR | **LIVE** — auto-push on merge to main |
| Container App | — | onetake-py-worker | **LIVE** — revision 5, running onetake-worker:latest |
| Log Analytics | — | onetake-logworkspace | **Provisioned** |

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

### Week 3-4: LLM Provider Routing + Recruiter Edit Hub (NEW — April 27)
Dual-provider routing: new campaign requests go through **OpenRouter** (paid, no rate limit, ~$2.88/country LLM cost, 3-4 min pipeline). Edit requests go through **NIM** (free, 40 RPM is plenty for single-asset tweaks).

**Edit Hub** — lightweight inline editing in the Recruiter View for approved campaigns:
- **Edit copy** — change headline/body on one creative (1 GLM-5 call → re-render)
- **Edit locale** — re-render asset for a different language (1 Gemma copy + 1 GLM-5 composition)
- **Edit CTA** — update CTA text/URL across a set of creatives
- **Edit image** — swap actor/backdrop on one image (1 image gen + 1 VQA)
- **Edit layout** — change template/platform format on one composition

Recruiter selects asset → picks what to change → types new value → submits → done in 5-10 seconds. All edits routed through NIM (free). No pipeline re-run needed.

**Spec target:** Late April / early May. Implementation after SVP pitch prep.

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
| DNS: `onetake.oneforma.com` → Vercel | IT (Cloudflare) | **LIVE May 6** — CNAME locked, DNS propagated | Unified frontend domain | DONE |
| DNS: `pro.oneforma.com` → Vercel | IT (Cloudflare) | **CNAME live, TXT pending** — `vc-domain-verify=pro.oneforma.com,31524e3ba6945d18ead8` sent to IT | Branded tracked links | P1 |
| Azure Function `onetake-fn-west01` | IT | **Requested May 5** — name submitted | Serverless compute for scheduled tasks | P1 |
| Entra ID custom app (no user assignment) | IT | **Requested May 5** | Azure AD integration for function auth | P1 |
| Azure PG admin password — set strong password | Steven | **URGENT** — currently weak test value | Security: Container App secret must be updated | P0 |
| Configure Clerk Microsoft OAuth | Steven | **Ready** — credentials in hand | "Sign in with Microsoft" button | P1 |
| SharePoint site-specific access grant | IT | **Requested Apr 30** | `Sites.Selected` needs per-site grant | P1 |
| Shared mailbox for Outlook | IT | **Asked Apr 29** | Automated email delivery (`Mail.Send` already consented) | P1 |
| OpenAI API key | Steven | Planned | Direct image gen ($0.006/image, 37x savings) | P2 |
| Kling API credits | Steven | In progress | Stage 5 at scale | P2 |
| Neon DB password rotation | Steven | Pending | Old creds in git history | P1 |
| Company GPU access | Michael | Asked April 22 | Self-hosted models | P2 |
| GA4 property access | Poola/IT | Required | AudienceIQ Phase 3 live data | P2 |
| Recruiter pilot volunteers | Jenn | Not started | Need 1-2 by beta launch | P1 |
| Meta Ads API credentials | Steven | **Ready May 6** | Wave 1 platform sync → normalized_daily_metrics | P1 |
| Reddit Ads API credentials | Steven | **Ready May 6** | Wave 1 platform sync (NEW — not in original stubs) | P1 |
| Brevo API credentials | Steven | **Ready May 6** | Wave 1 email campaign metrics | P1 |
| Google Ads API credentials | Steven | **Ready May 11** | Wave 2 platform sync | P1 |
| TikTok Ads API credentials | Steven | **Ready May 11** | Wave 2 platform sync | P1 |
| Frontend `db.ts` swap for Azure | Steven | Planned | Replace `@neondatabase/serverless` with `pg` when frontend points to Azure PG | P2 |

### Resolved (since last update)
| Item | Resolved | Notes |
|---|---|---|
| `onetake.oneforma.com` DNS | **May 6** | CNAME + TXT propagated, locked in Cloudflare |
| Data normalization layer | **May 6** | 8 commits: Meta + Reddit + Brevo clients, normalizeToDaily(), sync orchestrator, reddit_ads_cache + brevo_campaign_metrics tables |
| Intake wizard sizing | **May 6** | All steps standardized to same container (maxWidth 1600, uniform padding) |
| Extraction speed | **May 6** | Kimi K2.5 primary (was Gemma 4 31B), max_tokens 2048 (was 8192), 30s timeout (was 90s) |
| Extraction loader rebrand | **May 6** | OnForma gradient, fun facts, progress timeline (replaced Nova/purple) |
| `go.oneforma.com` → `pro.oneforma.com` | **May 6** | `go` was in use, all references updated to `pro` |
| Azure PG full admin access verified | **May 5** | `sqladm` + `azure_pg_admin` role. Self-service migrations. |
| Azure PG connectivity from dev machine | **May 5** | Port 5432 reachable, firewall rule `StevenDev` active |
| Azure PostgreSQL 17 Flexible Server | **Apr 30** | PG 17.9 delivered, connected, schema migrated (31 tables, 76 indexes) |
| Container App env vars (8 required) | **Apr 30** | 4 secrets + 3 plain vars set via `az containerapp` |
| Swap nginx → onetake-worker image | **Apr 30** | Worker LIVE, polling every 30s, 2 vCPU / 4 GiB |
| Graph API permissions (admin consent) | **Apr 30** | Already consented: User.Read.All, Group.Read.All, Mail.Send, Files.ReadWrite.All, Sites.Selected, Team.ReadBasic.All |
| Clerk auth credentials | **Apr 30** | OAuth redirect URI added, client secret generated. Steven is app registration owner. |
| Domain restriction (security) | **Apr 30** | `isAllowedDomain()` belt & suspenders — auto-provision gated + requireRole check |
| Docker numpy fix | **Apr 30** | Added numpy to requirements-docker.txt, rebuilt + pushed |
| `onetake.oneforma.com` domain | **Apr 29** | Live with SSL + CORS on Azure Container Apps |
| Azure Container Registry credentials | **Apr 29** | ACR_USERNAME/ACR_PASSWORD set in GitHub secrets |
| Azure resource group provisioning | **Apr 29** | ACR + Container App + Log Analytics + Environment |
| App Registration (Graph API) | **Apr 29** | `azc-sp-onetake-dev-deployment` created by IT |
| Michael Azure deliverables | **Apr 24** | Dockerfile, env manifest, blob adapter, schema |
| All 6 media strategy parsing issues | **Apr 24** | Fixed: interests, channel mix, campaigns, country codes, budgets, JSON |

---

## Specs & Plans Inventory (April 29, 2026)

### Active/Recent Specs (Last 2 Weeks)

| Date | Spec | Status | LOC Impact |
|---|---|---|---|
| May 5 | Organic-First Pipeline + Paid Upgrade | **Shipped** | 12 commits, pipeline_mode routing, organic Stage 3+4, QR codes, lead_recruiter role |
| May 5 | Asset Edit Hub | **Shipped** | 9 commits, edit classifier/executor, batch rollback, EditMode frontend |
| May 5 | Data Normalization Layer | **Shipped** | 8 commits: Meta + Reddit + Brevo sync clients, normalizeToDaily(), orchestrator |
| Apr 29 | Azure Deployment + IT Integration | **Shipped** | ACR push, CI/CD secrets, env manifest, IT spec doc |
| Apr 29 | Container App Configuration Spec | **Shipped** | `docs/it-response-azure-container-app.md` |
| Apr 25 | Server-Side GTM for Meta Pixel | **Shipped** | Conversion tracking live |
| Apr 23 | GraphRAG Platform Interest Routing | **Shipped** | +1,054 graph nodes, router, 6 seed files |
| Apr 23 | Unified Campaign Workspace | **Shipped** | +4 components, workspace refactor, country jobs |
| Apr 23 | AudienceIQ Design (Phase 1-3) | **Shipped** | +9 widgets, 10 tables, drift engine, health scorer |
| Apr 22 | Country Quotas & Demographics | Spec complete | CountryQuotaTable component, intake wizard |
| Apr 22 | Multi-Country Architecture | Documented | Architecture reference doc |
| Apr 16 | CI/Docker Design | **Shipped** | Dockerfile, GitHub Actions, ACR push |
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

## Timeline to Beta Launch & SVP Pitch (Day 30 = May 5)

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

Day 19 (Apr 25) — SHIPPED
  ├── Server-side GTM for Meta Pixel
  ├── Designer view country support
  ├── Agency view country support
  └── Recruiter view country support

Day 23 (Apr 29) — SHIPPED: Azure Infrastructure
  ├── IT provisioned full Azure resource group (ACR, Container App, Log Analytics)
  ├── onetake.oneforma.com LIVE with SSL + CORS
  ├── Worker Docker image built + pushed to novacert.azurecr.io
  ├── GitHub Actions CI/CD → ACR auto-deploy configured
  ├── Azure CLI authenticated (steven.junop@centific.com)
  ├── Full IT spec + follow-up email sent
  └── 832 tests passing (413 TS + 419 Python)

Day 24 (Apr 30) — SHIPPED ★ WORKER LIVE ON AZURE
  ├── PostgreSQL 17.9 delivered by IT — connected + verified
  ├── Schema migrated: 31 tables, 76 indexes, 0 errors
  ├── Container App: 4 secrets + 3 env vars set
  ├── Image swapped: nginx → onetake-worker:latest (2 vCPU / 4 GiB)
  ├── Worker LIVE — polling Azure PG every 30s
  ├── Docker fixed (numpy for deglosser) — rebuilt + pushed
  ├── Admin user seeded on Azure PG
  ├── Graph API permissions discovered already admin-consented (6 permissions)
  ├── App registration: owner access, OAuth redirect URI added, client secret generated
  ├── Domain restriction shipped (belt & suspenders: isAllowedDomain())
  ├── onetake.oneforma.com added to Vercel — DNS verification sent to IT
  ├── IT reply email drafted (PG17 ack, Graph API correction, OAuth pivot, DNS)
  └── IT helpdesk SAML ticket drafted (future upgrade path)

Day 25-28 (May 1-4) — BETA PREP
  ├── Configure Clerk Microsoft OAuth in dashboard
  ├── End-to-end test: intake form → Azure worker → pipeline → creatives
  ├── OpenAI direct API transition ($0.006/image)
  ├── LLM provider routing (OpenRouter for gen, NIM for edits)
  ├── Real campaign testing (3-5 campaigns E2E on Azure)
  ├── Stage 4 template refinement
  ├── Recruiter pilot testing with Jenn
  └── Results compilation

Day 29-30 (May 4-5) — ORGANIC PIPELINE + EDIT HUB + INFRA ★★
  ├── ORGANIC-FIRST PIPELINE (12 commits)
  │   ├── pipeline_mode routing (organic default, full after paid upgrade)
  │   ├── Organic Stage 3: WP posts, portal copy, flyer copy, social captions
  │   ├── Organic Stage 4: social graphics + flyers with QR codes (Aidaform + UTM)
  │   ├── QR generator utility (tracked URLs per locale)
  │   ├── Stage 1 skips media strategy for organic
  │   ├── Lead recruiter role + canRequestPaid() permission
  │   ├── Request Paid API + auto-budget from RPP formula
  │   └── Frontend: OrganicMaterials tabs, PipelineModeBadge, Request Paid button
  │
  ├── ASSET EDIT HUB (9 commits)
  │   ├── Edit classifier (keyword routing → 4 action types)
  │   ├── Edit executor (Gemma copy revision, link/QR update, batch rollback)
  │   ├── Edit API (multipart, edit lock, Teams notification)
  │   ├── Rollback API (revert by batch_id)
  │   ├── Excel parser (locale additions)
  │   ├── EditMode frontend (checkboxes, instruction bar, undo)
  │   └── Bulletproofing (lock, rate limits, ownership verification)
  │
  ├── AZURE INFRASTRUCTURE
  │   ├── PG full admin access confirmed (self-service migrations)
  │   ├── Azure Function onetake-fn-west01 submitted
  │   ├── Entra ID custom app (no user assignment)
  │   └── DNS request finalized (3 Cloudflare records)
  │
  └── 22 commits, 0 new TypeScript errors

Day 30 (May 5) — DATA NORMALIZATION LAYER ★
  ├── Both databases migrated (Neon + Azure PG — 31 tables, 76 indexes, 142 CHECKs)
  ├── 21/21 prod tests passed (constraints, pipeline modes, edit flow, rollback, lock)
  ├── Ad platform integration timeline set:
  │   ├── May 6 (Day 31): Meta Ads + Reddit Ads + Brevo (email) — credentials live
  │   ├── May 11 (Day 36): Google Ads + TikTok Ads — credentials arriving Monday
  │   └── Normalization layer: all platforms → normalized_daily_metrics → ROAS calculations
  └── Normalization spec + implementation in progress

Day 31 (May 6) — NORMALIZATION + DOMAINS + POLISH ★★
  ├── DATA NORMALIZATION LAYER (8 commits)
  │   ├── reddit_ads_cache + brevo_campaign_metrics tables
  │   ├── Meta Ads client completed (real Marketing API v21 call)
  │   ├── Reddit Ads client created (full sync + normalize)
  │   ├── Brevo email client created (separate brevo_campaign_metrics table)
  │   ├── normalizeToDaily() helper (cache → normalized_daily_metrics with UTM matching)
  │   ├── Sync orchestrator: POST /api/platforms/sync
  │   ├── DailyMetricRow + PlatformNormalizeResult types
  │   └── .env.example updated (Reddit + Brevo vars)
  │
  ├── DOMAINS
  │   ├── onetake.oneforma.com — DNS propagated (CNAME + TXT verified)
  │   ├── pro.oneforma.com — CNAME live, TXT verification sent to IT
  │   └── go.oneforma.com → pro.oneforma.com (go was in use)
  │
  ├── INTAKE WIZARD POLISH
  │   ├── Standardized step container sizing (all steps same maxWidth + padding)
  │   ├── OnForma-branded extraction loader (replaced off-brand Nova/purple)
  │   ├── 14 rotating recruiter fun facts during extraction
  │   ├── 4-step animated progress timeline (document → requirements → regions → fields)
  │   └── Extraction 3x faster (Kimi K2.5 primary, max_tokens 8192→2048, timeout 90s→30s)
  │
  └── Waiting on: pro.oneforma.com TXT record from IT, ad platform credentials

Day 32-33 (May 7-8) — DEMO PREP
  ├── Feed REAL data to Azure PG via platform sync
  ├── ROAS calculations go live with real spend/conversions
  ├── End-to-end organic pipeline test on Azure worker
  ├── pro.oneforma.com verification (when IT adds TXT)
  ├── Deploy to production (Vercel + update Azure Container App)
  └── Dry-run demo walkthrough

Day 34 (May 9) — FRIDAY DEMO ★★★
  ├── Live demo with real campaigns + real ROAS data
  ├── Organic pipeline: intake → WP post + social graphics + flyers + QR codes
  ├── Edit hub: recruiter edits copy → instant update → undo
  ├── Dashboard: cross-platform performance (Meta + Reddit + Brevo)
  └── onetake.oneforma.com + pro.oneforma.com branded URLs

Day 36 (May 11) — AD PLATFORM SYNC (Wave 2)
  ├── Google Ads API → google_ads_cache → normalized_daily_metrics
  ├── TikTok Ads API → tiktok_ads_cache → normalized_daily_metrics
  └── Full 5-platform unified performance dashboard

Day 36+ (Post-demo)
  ├── Clerk SAML SSO upgrade (if needed — $50/mo Clerk Pro)
  ├── SharePoint auto-sync (Sites.Selected site grant from IT)
  ├── Outlook automated notifications (waiting on shared mailbox)
  ├── AudienceIQ Phase 4 (HIE behavioral)
  ├── AudienceIQ Phase 5 (ad platform APIs)
  ├── Organic content extension
  └── VYRA convergence decision
```

---

## Success Metrics

| Metric | Before OneTake | With OneTake | Day 24 Status |
|---|---|---|---|
| Time: JD → creative package | 3-5 days | 30 minutes | Achieved |
| Creatives per campaign | 2-4 | 15-30+ per country | Achieved |
| Cost per campaign | Agency + designer time | ~$0 NIM (free) / ~$23 OpenRouter (full speed) | Achieved |
| Countries per campaign | 1 at a time | 16+ simultaneous | Built (unified workspace) |
| Interest targeting | Manual guesswork | 1,054 real platform interests | Live (GraphRAG) |
| Attribution | Broken (7,600 → 0) | Full UTM → CRM loop | Built (AudienceIQ) |
| Audience intelligence | None | Four-ring drift detection | Shipped |
| Platform interest coverage | 0 platforms | 6 platforms | Live |
| Image generation cost | N/A | $0.04 (Seedream) → $0.225 (GPT Image 2 OpenRouter) → $0.006 (OpenAI direct, planned) | $0.225/image |
| Test coverage | 0 | 832 total (413 TypeScript + 419 Python) | CI green, 5 gates |
| Infrastructure | Local laptop | Enterprise Azure (ACR + Container Apps + PG 17.9 + SSL) | **Worker LIVE** — polling Azure PG |
| CI/CD | Manual deploy | GitHub Actions → ACR auto-push on merge | Live |
| Auth | None | Clerk + Microsoft OAuth + domain restriction | Ready (configure in dashboard) |
| Graph API | None | 6 permissions admin-consented | Live |
| Azure DB | None | PG 17.9, 31 tables, 76 indexes | **Full admin — self-service migrations** |
| Pipeline modes | 1 (all-or-nothing) | 2 (organic default → paid upgrade) | **Shipped Day 30** |
| Organic deliverables | 0 | 6 types (WP post, portal copy, flyer, flyer copy, social caption, social graphic) | **Shipped Day 30** |
| Asset editing | Manual re-run | Inline batch edit + rollback (4 action types) | **Shipped Day 30** |
| Ad platform sync | 0 platforms | 3 ready (Meta, Reddit, Brevo) + 2 Wave 2 (Google, TikTok) | **Shipped Day 31** — awaiting credentials |
| Extraction speed | ~90s (Gemma 4 31B) | ~10s (Kimi K2.5) | **3x faster Day 31** |
| Custom domains | nova-intake.vercel.app | onetake.oneforma.com + pro.oneforma.com | **onetake LIVE, pro pending TXT** |
| Commits | 0 | 850+ | Day 31 |
| LOC | 0 | ~108,000 | Day 31 |

---

## Team

| Person | Role | Alignment |
|---|---|---|
| **Steven Junop** | Digital Marketing Manager / Platform Builder | Leading |
| **Jenn** | Steven's manager | Impressed Day 1, collaborating |
| **Michael** | China eng lead | Code reviewed, migration plan approved, Azure architecture designed |
| **Pengfei** | IT / Infrastructure | Provisioned full Azure resource group — unprecedented turnaround |
| **Miguel** | Designer | Daily portal testing |
| **Marketing Coordinator** | Stealth ally | Aligned on automation |
| **Stefan** | SVP (target for pitch) | Set 30-day delivery goal |
