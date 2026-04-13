# Nova — Rollout Roadmap

**Date:** 2026-04-13
**Author:** Steven Junop
**Status:** Draft — pending PM review with Jenn

---

## Current State (Day 8)

Nova is a working 6-stage autonomous creative operations pipeline deployed at nova-intake.vercel.app. It replaces a 3-5 day panic workflow with a 30-minute automated system.

### What's Built & Deployed
- 6-stage pipeline: Intelligence → Images → Copy → Composition → Video → Landing Pages
- 4 portals: Recruiter (intake + library), Marketing Manager (command center), Designer (gallery + edit suite), Agency (magic link)
- 3-stage approval flow with Teams + Outlook notifications
- Inline-editable media strategy with autosave
- UTM tracked link builder
- Designer edit suite (Flux 2 retouching, graphic overlay, Figma integration)
- 5-step intake wizard with AI pre-fill from RFP/JD
- 209 tests passing, zero TypeScript errors
- Deployed to Vercel + Neon Postgres

### What's NOT Built Yet
- WordPress auto-publish (have WP MCP, not wired)
- Organic content (social posts, flyers, posters)
- Auto UTM linking to WP pages
- SharePoint folder automation
- Microsoft SSO (Clerk SAML configured but not connected to Azure AD)
- Analytics/conversion tracking on landing pages

---

## Three New Requirements

### 1. WordPress Job Description Auto-Publish

**What:** When a recruiter uploads a JD in the intake wizard, Stage 1 automatically creates WordPress job description landing pages — one per location/region required.

**How:**
- Step 1 of Stage 1 (before persona generation): parse JD → extract locations
- For each location: call WordPress MCP to create/publish a page
- Use the LP template system (Jinja2) to generate location-specific HTML
- Return the published WP URLs → store in `campaign_landing_pages`
- These URLs become the base for UTM tracked links immediately

**Dependencies:** WordPress MCP (already functional), WP instance credentials, page template

**Effort:** ~2 days (prompt + WP MCP integration + per-location loop)

### 2. Organic Content Generation (Social Posts, Flyers, Posters)

**What:** In addition to paid ad creatives, generate organic social posts, printable flyers, and posters per persona per campaign.

**How:**
- Extend Stage 3 (Copy): add organic post copy generation (LinkedIn posts, Facebook posts, Twitter/X threads)
- Extend Stage 4 (Composition): add print-ready formats (A4 flyer, A3 poster, social post cards)
- New asset types: `organic_post`, `flyer`, `poster`
- New format dimensions in the composition engine
- Designer reviews these alongside ad creatives in the gallery

**Dependencies:** Print-ready template designs, format dimensions, copy tone adaptation (organic ≠ paid)

**Effort:** ~3-4 days (copy prompts + composition templates + gallery integration)

### 3. Auto UTM Linking to WordPress

**What:** As soon as WordPress job description pages are published, automatically generate UTM tracked links and make them available to recruiters.

**How:**
- After WP publish in Step 1: capture the live URL
- Auto-create tracked links with standard UTM parameters (source=organic, medium=social, campaign=slug)
- Pre-populate the recruiter's Link Builder with these links
- Include links in the Teams + Outlook notification

**Dependencies:** Requirement 1 (WP pages must exist first)

**Effort:** ~1 day (auto-create tracked_links rows + notification update)

---

## Roadmap — Four Tracks

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
5. **The Bigger Picture** — This is VYRA. Nova is one vertical (recruitment). The platform generalizes to any marketing workflow at Centific.
6. **Ask** — Resources to scale: dedicated Kling/video API budget, Azure AD SSO integration, 2 more recruitment teams onboarded.

---

## Dependencies & Blockers

| Blocker | Owner | Status | Impact |
|---|---|---|---|
| Azure AD SSO config | IT Admin | NOT STARTED | Blocks internal team access — currently using Clerk dev keys |
| Teams webhook (prod) | IT Admin | NOT STARTED | Currently using test webhook |
| Kling API credits | Steven | IN PROGRESS | Blocks Stage 5 video at scale |
| WordPress credentials | Steven/Jenn | HAVE (WP MCP works) | Ready for auto-publish |
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
