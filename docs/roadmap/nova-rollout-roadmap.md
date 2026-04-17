# Nova — Rollout Roadmap

**Date:** 2026-04-17 (updated)
**Author:** Steven Junop
**Status:** Active — shared with China engineering team (Michael)

---

## Current State (Day 12)

Nova is a working 6-stage autonomous creative operations pipeline deployed at nova-intake.vercel.app. 80K LOC, 5-gate CI pipeline, production Dockerfile, shared with international engineering team.

### What's Built & Deployed
- 6-stage pipeline: Intelligence → Images → Copy → Composition → Video → Landing Pages
- 4 portals: Recruiter (intake + library), Marketing Manager (command center), Designer (gallery + edit suite), Agency (magic link)
- 3-stage approval flow with Teams + Outlook notifications
- Inline-editable media strategy with autosave
- UTM tracked link builder with per-locale destination URLs
- Designer edit suite (Flux 2 retouching, graphic overlay, Figma integration)
- 5-step intake wizard with AI pre-fill from RFP/JD + locale links Excel upload
- WordPress auto-publish with ACF repeater (per-locale apply links) + Yoast SEO meta
- WordPress taxonomy tagging (job_type + job_tag)
- 17-commit security hardening (auth, IDOR, XSS, secrets, CSP)
- GitHub Actions CI (build, lint, test, Python lint, Docker build — all green)
- Multi-arch Dockerfile (Azure VM + Apple Silicon)
- 851-line bilingual README (EN/CN) with Mermaid diagrams
- Public GitHub repo: github.com/Steviewonders99/OneTake
- China engineering team (Michael) engaged — discussing deployment architecture
- Deployed to Vercel + Neon Postgres, zero build errors

### What's NOT Built Yet
- Organic content (social posts, flyers, posters)
- Email + job posting copy generation (Stage 3 extension)
- SharePoint folder automation
- Microsoft SSO (Clerk SAML configured but not connected to Azure AD)
- Analytics/conversion tracking on landing pages
- Branded short link domain (`go.oneforma.com` — waiting on IT for CNAME)
- Stage 2 regeneration for existing campaigns (persona_key fix needs re-run)

---

## Requirements Status

### 1. WordPress Job Description Auto-Publish — SHIPPED

**Status:** Complete (April 17, 2026)

- Stage 0 (before persona generation): AI structures JD → publishes to WordPress as `job` CPT
- ACF `apply_job` repeater populated with per-locale links from Excel upload
- Yoast SEO meta description auto-generated via excerpt
- Job type + job tag taxonomies auto-tagged
- Published URL stored in `campaign_landing_pages.job_posting_url`
- Recruiter can build UTM tracked links immediately (no approval gate)

### 2. Organic Content Generation (Social Posts, Flyers, Posters) — PLANNED

**What:** Generate organic social posts, printable flyers, and posters per persona per campaign.

**How:**
- Extend Stage 3 (Copy): add organic post copy generation (LinkedIn posts, Facebook posts, Twitter/X threads)
- Extend Stage 4 (Composition): add print-ready formats (A4 flyer, A3 poster, social post cards)
- New asset types: `organic_post`, `flyer`, `poster`

**Effort:** ~3-4 days

### 3. Auto UTM Linking to WordPress — SHIPPED

**Status:** Complete (April 17, 2026)

- WordPress publish → URL captured → stored in campaign_landing_pages
- Recruiter Link Builder shows job posting URL as destination option
- Locale-specific links from Excel upload also available as destinations
- Tracked links work immediately (ungated from approval workflow)
- Short link redirect at `/r/[slug]` with click tracking

### 4. Stage 4 HTML Template Tuning — IN PROGRESS

**Status:** Active (April 17, 2026)

**What:** Redesigning and expanding the HTML composition templates that GLM-5 uses to generate platform-ready creatives. Current templates produce functional output but need enterprise-grade polish — better layout diversity, typography hierarchy, and visual impact.

**Scope:**
- New HTML/CSS template variants for key formats (feed, story, carousel)
- Improved text hierarchy and spacing
- Better integration with design artifacts (blobs, gradients, badges)
- Template-specific brand constraints per format
- Testing against the 8-category grading matrix to ensure B+ minimum output

### 5. Stage 6 Landing Page Template Design — IN PROGRESS

**Status:** Active (April 17, 2026)

**What:** Designing and testing multiple landing page template concepts for per-persona recruitment pages served via `/lp/[slug]`. Current LP generation produces functional pages but needs stronger conversion design and visual variety.

**Scope:**
- Multiple LP layout concepts (hero variants, testimonial sections, FAQ blocks)
- Mobile-responsive designs
- Per-persona visual adaptation (tone, imagery, copy weight)
- CTA placement optimization
- Template selection logic based on persona type and campaign context

### 6. Email + Job Posting Copy Generation — PLANNED

**What:** Extend Stage 3 to generate cold outreach email sequences and job posting copy variants alongside ad copy.

**How:**
- Add email/job posting as output types inside Stage 3
- Same persona/channel/language matrix, more formats
- No new pipeline stage needed

**Effort:** ~1-2 days

### 5. Branded Short Link Domain — PENDING IT

**What:** Replace `nova-intake.vercel.app/r/...` with `go.oneforma.com/r/...` for professional tracked links.

**Requires:** IT to add CNAME record: `go` → `cname.vercel-dns.com`

**After DNS:** `vercel domains add go.oneforma.com` + update `NEXT_PUBLIC_APP_URL`

---

### 4. VYRA Visualize Integration — Full SRC Command Center

**What:** Port the full SRC Command Center (VYRA's analytics control plane) into Nova. Gives the marketing manager real-time campaign performance visibility — KPI dashboards, channel breakdowns, RevBrain AI recommendations, funnel visualization, exports, and share links.

**Source:** Already built as standalone at `/Users/stevenjunop/src-command` — ~4,000 LOC across 3 apps (Next.js frontend, FastAPI API, async worker). Self-contained monorepo.

**What it provides:**
- **KPI Dashboard** — spend, revenue, conversions, ROAS, CTR, CPA per campaign/brand
- **Channel Rollups** — performance breakdown per channel (Meta, LinkedIn, TikTok, Google)
- **RevBrain** — materialized truth engine with multi-model attribution (platform-reported vs attributed vs MMM)
- **Recommendations** — per-channel action packets (budget shifts, pauses, scale signals) with projected revenue lift
- **Granular Funnel** — campaign → ad group → ad → creative → landing page drilldown
- **Exports** — PDF/CSV reports for leadership presentations
- **Share Links** — public tokens for sharing dashboards without auth
- **Audience IQ** — audience health monitoring and suggestions

**Integration approach:**
- Port SRC Command Center API routes into Nova's Next.js API (or run as sidecar)
- Data source: Nova's `tracked_links` clicks + GA4 API + ad platform APIs (Meta, LinkedIn, Google Ads)
- Frontend: embed dashboard components in the Marketing Manager view
- RevBrain worker runs alongside the existing Nova pipeline worker

**Dependencies:**
- GA4 property access (Google Analytics MCP or API key)
- Ad platform API credentials (Meta Marketing API, LinkedIn Campaign Manager API, Google Ads API)
- UTM tracking data flowing from Nova's tracked_links table

**Effort:** ~2 weeks (port is mostly wiring — code already exists)

**Priority:** Phase 2 — after core pipeline is validated with real campaigns

---

## Roadmap — Five Tracks

### Track 1: Pipeline Upgrades (Engineering — Steven + Claude)

| Week | Milestone | Details |
|---|---|---|
| **Week 2 (Days 9-12)** | WP auto-publish | Wire WordPress MCP into Stage 1. Per-location page generation. URL capture + storage. |
| **Week 2** | LP template swap | Replace dark gradient wireframe with polished production template |
| **Week 2** | Auto UTM linking | WP publish → auto-create tracked links → notify recruiter |
| **Week 3 (Days 13-17)** | Organic content - Copy | Extend Stage 3 with organic post copy (LinkedIn, Facebook, X). Different tone from paid. |
| **Week 3** | Organic content - Design | Extend Stage 4 with flyer (A4), poster (A3), social card formats |
| **Week 3** | Video pipeline | Kling credits loaded, Stage 5 tested on real campaigns |
| **Week 4 (Days 18-22)** | Polish + bug fixes | 3-5 real campaigns end-to-end. Fix whatever breaks. |

### Track 2: Microsoft Integrations (Engineering + IT)

| Integration | What | Requirements | Priority |
|---|---|---|---|
| **Azure AD SSO** | Clerk SAML → Centific Azure AD | IT admin to create enterprise app registration, provide SAML metadata URL, configure user provisioning | P1 — blocks internal rollout |
| **Teams Webhooks** | Already built | Need production webhook URL from IT for the marketing channel | P1 — working with test URL |
| **Outlook Notifications** | Already built | Need SMTP credentials or Microsoft Graph API app registration for sending from @centific.com | P1 — working with test |
| **SharePoint Automation** | Auto-create folders per campaign, save approved assets + docs | Need SharePoint site URL, Graph API permissions (Sites.ReadWrite.All), folder structure agreement | P2 — nice to have for launch |
| **OneDrive/SharePoint Asset Sync** | Push approved creatives to shared drive | Same Graph API permissions as SharePoint | P3 — future |

**Action items for IT:**
1. Create Azure AD enterprise application for Nova (SAML SSO)
2. Provide Teams incoming webhook URL for marketing channel
3. Grant Microsoft Graph API permissions for Outlook send + SharePoint write
4. Confirm SharePoint site structure for campaign folders

### Track 5: VYRA Visualize — Campaign Analytics (Engineering — Steven)

| Week | Milestone | Details |
|---|---|---|
| **Week 4-5** | Port SRC Command Center API | Adapt FastAPI routes for Nova's data model. Connect to tracked_links + GA4. |
| **Week 5** | KPI Dashboard UI | Embed KPI cards + channel rollups in Marketing Manager view |
| **Week 5** | RevBrain integration | Wire RevBrain worker for campaign-level recommendations |
| **Week 6** | Granular Funnel | Campaign → ad → creative → LP drilldown visualization |
| **Week 6** | Exports + Share Links | PDF/CSV reports for Adam pitch, public share tokens |

**Blocked by:** Real campaign data flowing through UTM tracked links (needs 1-2 weeks of live campaigns first)

### Track 3: Team Enablement (Steven + Jenn + Miguel)

| Week | Who | What |
|---|---|---|
| **Week 2** | Miguel (Designer) | Daily use of designer portal on real campaigns. Feedback loop on gallery, edit tools, Figma workflow. |
| **Week 2** | Steven + Jenn | Run 2-3 real campaigns through full pipeline. Document pain points. |
| **Week 3** | Recruiter team (1-2 pilots) | Supervised intake wizard walkthrough. Fill real JD. Review output. |
| **Week 3** | Steven | Record Loom walkthrough video of each portal (recruiter, marketing, designer, agency) |
| **Week 4** | Full recruiter team | Training session: intake wizard + creative library + link builder |
| **Week 4** | Agency contact | First real magic link handoff. Gather feedback. |

### Track 4: Adam (SVP Engineering) Pitch Preparation

**Goal:** Present Nova as proof that VYRA's autonomous marketing platform works in production. Position for broader Centific/OneForma adoption.

| When | What | Supporting Material |
|---|---|---|
| **End of Week 3** | Informal demo to Jenn + PM | Live pipeline run, show all 4 portals, real campaign output |
| **End of Week 4** | Prepare Adam deck | Results from 3-5 real campaigns, time savings metrics, quality comparison (before/after), cost analysis (NIM free tier vs agency hours) |
| **Week 5** | Schedule Adam meeting | 30-min demo: problem → solution → results → what's next (VYRA full platform) |

**Adam pitch deck outline:**
1. **The Problem** — Recruitment marketing is a 3-5 day panic workflow. Recruiters scramble, designers are bottlenecked, agencies wait.
2. **The Solution** — Nova: JD in → full campaign package out in 30 minutes. AI-generated, human-refined, agency-ready.
3. **Live Demo** — Run a real JD through the pipeline live. Show all portals.
4. **Results** — X campaigns completed, Y hours saved, Z cost reduction
5. **Campaign Analytics** — Show VYRA Visualize integration: real-time KPI dashboards, channel performance, RevBrain recommendations, funnel visualization — all from production campaign data.
6. **The Bigger Picture** — This is VYRA. Nova is one vertical (recruitment). The platform generalizes to any marketing workflow at Centific. Visualize is already built — it just needs data.
7. **Ask** — Resources to scale: dedicated Kling/video API budget, Azure AD SSO integration, GA4 + ad platform API access, 2 more recruitment teams onboarded.

---

## Dependencies & Blockers

| Blocker | Owner | Status | Impact |
|---|---|---|---|
| go.oneforma.com CNAME | IT Admin | REQUESTED | Branded short links — cosmetic, not blocking |
| Azure AD SSO config | IT Admin | NOT STARTED | Blocks internal team access — currently using Clerk dev keys |
| Teams webhook (prod) | IT Admin | NOT STARTED | Currently using test webhook |
| Kling API credits | Steven | IN PROGRESS | Blocks Stage 5 video at scale |
| WordPress credentials | Steven/Jenn | DONE | WP REST API working, ACF + taxonomies verified |
| China eng deployment decision | Michael | IN PROGRESS | Standalone vs OneForma 2.0 integration |
| Neon DB password rotation | Steven | PENDING | Old creds in git history — rotate ASAP |
| Recruiter pilot volunteers | Jenn | NOT STARTED | Need 1-2 recruiters for Week 3 pilot |
| Agency contact for test handoff | Jenn/Steven | NOT STARTED | Need agency email for magic link test |
| SharePoint site + permissions | IT Admin | NOT STARTED | P2 — not blocking launch |

---

## Success Metrics (for Adam pitch)

| Metric | Before Nova | With Nova | How to Measure |
|---|---|---|---|
| Time: JD to campaign package | 3-5 business days | 30 minutes + review time | Timestamp diff: intake submit → final approval |
| Creatives per campaign | 2-4 generic designs | 15-30+ per-persona designs | Asset count in generated_assets |
| Cost per campaign | Agency hours + designer time | NIM free tier + Vercel (~$0) | Infrastructure cost tracking |
| Recruiter time spent | 4-8 hours coordinating | 15 min intake + 10 min link building | User session tracking |
| Campaign coverage | 1-2 channels | 4-6 channels per persona | Strategy data |
| Landing pages | None (just job posting link) | Per-persona, culturally-adapted LPs | Landing page asset count |

---

## Next Immediate Actions

1. **Steven:** Start Track 1 Week 2 — WP auto-publish integration (tomorrow)
2. **Jenn:** Identify 1-2 recruiter pilot volunteers for Week 3
3. **Jenn:** Schedule PM roadmap review (this week)
4. **Steven:** Send IT the MS integration requirements list (this week)
5. **Steven + Jenn:** Pick 2-3 real JDs for end-to-end testing (this week)
6. **Miguel:** Start daily designer portal testing on next campaign (this week)
