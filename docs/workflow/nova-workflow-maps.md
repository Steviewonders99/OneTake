# Nova — Complete Workflow Maps

**Date:** 2026-04-13
**Author:** Steven Junop + Claude

Six perspectives on the same system: Recruiter, Marketing Manager, Designer, Agency, and Full System Pipeline. All workflows include the Stage 6 Landing Page Engine.

---

## 1. Recruiter Workflow

What the recruiter sees and does — from intake submission to candidate link sharing.

```mermaid
flowchart TD
    A[📋 Recruiter gets job description / RFP]
    A --> B{Intake Wizard}
    B -->|Step 1| B1[Upload RFP or Paste Text]
    B -->|Step 1 alt| B1a[Skip — manual entry]
    B1 --> B2[AI extracts fields via Gemma 4]
    B1a --> B3
    B2 --> B3[Step 2: Select Task Type + Work Mode]
    B3 --> B4[Step 3: Project Details — title, volume, regions, languages, budget]
    B4 --> B5[Step 4: Requirements — qualifications, engagement model, AIDA form]
    B5 --> B6[Step 5: Review & Submit]
    B6 --> C[🚀 Request Submitted — status: draft]

    C --> D[Pipeline auto-triggers — status: generating]
    D --> E[⏳ Recruiter waits — sees progress on dashboard]
    E --> F[📣 Teams + Outlook Notification: Creatives Ready]

    F --> G[Recruiter opens Creative Library]
    G --> H[Views composed creatives per channel]
    G --> I[Sticky Link Builder panel]
    I --> I1[Select base URL — landing page or job posting]
    I1 --> I2[Auto-generates UTM tracked short link]
    I2 --> I3[Copy link → share with candidates]

    G --> LP[🟠 Views generated landing pages per persona]
    LP --> LP1[Copy /lp/ URL for ad campaigns]

    G --> J[Download individual creatives]
```

**Access:** `/intake/[id]` (authenticated), `/r/[slug]` (redirect)
**Cannot see:** Strategy details, raw assets, pipeline stages, designer tools

---

## 2. Marketing Manager Workflow

Command center — review, edit strategy, approve, and hand off to agency.

```mermaid
flowchart TD
    A[📥 Request arrives on Dashboard — status: review]
    A --> B[Open Campaign Detail Page /intake/id]

    B --> C[Campaign Workspace — MiniTabs]
    C --> C1[📊 Campaign Brief tab]
    C1 --> C1a[Review messaging strategy]
    C1 --> C1b[Review channel allocation]
    C1 --> C1c[Review value propositions]

    C --> C2[📈 Media Strategy tab — EDITABLE]
    C2 --> C2a[Edit channel mix percentages — auto-rebalance]
    C2 --> C2b[Edit ad set daily budgets — click to edit]
    C2 --> C2c[Edit targeting interests — add/remove per tier]
    C2 --> C2d[Change split test variables — dropdown]
    C2 --> C2e[Change campaign objectives — dropdown]
    C2a & C2b & C2c & C2d & C2e --> SAVE[💾 Autosave — 800ms debounce PATCH]

    C --> C3[🌍 Regional Intelligence tab]

    B --> D[Personas & Creatives section]
    D --> D1[Review composed creatives per persona]
    D --> D2[Edit ad copy — inline with autosave]
    D --> D3[View HTML creative editor]

    B --> LP[🟠 Landing Pages Card]
    LP --> LP1[Enter Job Posting URL]
    LP --> LP2[Enter Landing Page URL]
    LP --> LP3[Enter AIDA Form URL]
    LP --> LP4[View generated /lp/ URLs per persona]

    B --> E{Marketing Approval Gate}
    E -->|Approve| F[Status → review — awaiting designer]
    E -->|Request changes| G[Trigger regeneration — full or per-stage]
    G --> A

    F --> H[⏳ Designer works on creatives]
    H --> I[Designer submits finals]
    I --> J{Final Approval Gate}
    J -->|Approve| K[Status → sent]
    K --> L[🔗 Agency magic link auto-generated]
    L --> M[📣 Teams + Outlook Notification to agency]
```

**Access:** `/intake/[id]` (admin role)
**Editable:** Media strategy (budgets, interests, split tests, objectives), ad copy, landing page URLs

---

## 3. Designer Workflow

Miguel's full toolkit — gallery review, editing, Figma integration, and handoff.

```mermaid
flowchart TD
    A[🔐 Designer signs in — /designer/sign-in]
    A --> B[Designer Dashboard — workboard view]
    B --> B1[Status groups: Needs Attention / In Progress / Completed]
    B --> B2[Campaign cards with priority, VQA scores, progress bars]
    B --> B3[🌓 Dark/Light theme toggle]

    B2 --> C[Open Campaign → Designer Gallery]
    C --> C1[Persona tabs with context cards — psychology, demographics]
    C --> C2[Version accordions V1—V5 with format grid]
    C --> C3[Format cards — true aspect ratio, VQA score overlay]
    C --> C4[🔍 Lightbox — fullscreen preview, keyboard nav]
    C --> C5[📋 Design Notes — curated metadata per creative]

    C3 --> D{Select Edit Mode}

    D -->|Amber Layer| E[Quick Edit — Flux 2 Inpainting]
    E --> E1[Mask Canvas — brush to select area]
    E --> E2[Quick actions: fix face, remove object, change bg]
    E --> E3[Before/After comparison]
    E --> E4[Save → replaces asset]

    D -->|Green Layer| F[Graphic Editor — Live Overlay]
    F --> F1[Edit overlay text — headline, CTA, body]
    F --> F2[Style controls — font, size, color, position]
    F --> F3[Live preview on canvas]
    F --> F4[Save → updates HTML overlay]

    D -->|Regenerate| G[Regenerate Modal — Seedream 4.5]
    G --> G1[Select what to change — checkboxes]
    G --> G2[Submit → triggers Stage 2/4 regen]

    C --> H[Figma Integration]
    H --> H1[📦 Export to Figma — ZIP SVGs + auto-open file]
    H --> H2[⬆️ Push to Figma — 3 levels]
    H2 --> H2a[Push entire campaign]
    H2 --> H2b[Push single persona]
    H2 --> H2c[Push single version]
    H --> H3[🔗 Figma Connect — token + URL validation]
    H --> H4[🔄 Figma Sync Status — polling for changes]

    C --> LP[🟠 Landing Pages — enter URLs]
    LP --> LP1[Job Posting URL]
    LP --> LP2[Landing Page URL]
    LP --> LP3[AIDA Form URL]

    C --> I[✅ Submit Finals]
    I --> J[Designer approval recorded]
    J --> K[Status → approved — awaiting final sign-off]
```

**Access:** `/designer` portal (designer role), `/designer/[id]` per campaign
**Tools:** Quick Edit (Flux 2), Graphic Editor (overlay), Regenerate (Seedream), Figma (export/push/sync)

---

## 4. Paid Media Agency Workflow

What the agency receives via magic link — strategy, creatives, targeting, and downloads.

```mermaid
flowchart TD
    A[📧 Agency receives magic link via Teams + Outlook email]
    A --> B[Opens /agency/id?token=... — no login required]

    B --> C[Agency Portal — 2 tabs]

    C --> D[Tab 1: Overview & Strategy]
    D --> D1[Campaign title, slug, status badge]
    D --> D2[Persona cards — demographics, targeting, psychology]
    D --> D3[Channel mix visualization — stacked bars]
    D --> D4[Budget allocation per channel]

    C --> E[Tab 2: Channels & Ad Sets]
    E --> E1[Per-channel accordion sections]
    E1 --> E2[Ad set cards with full targeting]
    E2 --> E2a[Interests — hyper/hot/broad tiers]
    E2 --> E2b[Demographics — age range, gender, location]
    E2 --> E2c[Placements — feed, story, reels]
    E2 --> E2d[Kill rules + scale rules]
    E1 --> E3[Creative thumbnails per ad set]
    E1 --> E4[Ad copy per creative — headline, body, CTA]
    E1 --> E5[UTM tracked links per creative]

    E1 --> LP[🟠 Landing page URLs per persona]
    LP --> LP1[/lp/campaign--persona links for ad destinations]

    C --> F[📥 Download All — ZIP of all creatives]
    C --> G[📥 Download individual creative]

    B --> H[⏰ Package expires in 7 days]
```

**Access:** `/agency/[id]?token=...` (magic link, no auth)
**Cannot:** Edit anything. Read-only view + downloads.

---

## 5. Full System Pipeline

Technical flow — all 6 stages, gates, notifications, and data stores.

```mermaid
flowchart TD
    START[👤 Recruiter submits intake form]
    START --> DB1[(intake_requests — status: draft)]
    DB1 --> JOB[compute_job created — type: generate]
    JOB --> WORKER[🔧 Python Worker claims job]

    WORKER --> S1[Stage 1: Strategic Intelligence]
    S1 --> S1a[Kimi K2.5 — RFP analysis]
    S1a --> S1b[Generate: brief, personas, cultural research, design direction]
    S1b --> S1c[Derive requirements from job description]
    S1c --> DB2[(creative_briefs + campaign_strategies)]

    DB2 --> S2[Stage 2: Character-Driven Images]
    S2 --> S2a[Create actor profiles per persona]
    S2a --> S2b[Seedream 4.5 — generate seed images]
    S2b --> S2c{VQA Gate — face quality, artifacts}
    S2c -->|Pass| S2d[Upload to Vercel Blob]
    S2c -->|Fail| S2e[Retry with adjusted prompt — up to 3x]
    S2e --> S2b
    S2d --> DB3[(actor_profiles + generated_assets: base_image)]

    DB3 --> S3[Stage 3: Copy Generation]
    S3 --> S3a[Gemma 4 — per persona × channel × language]
    S3a --> S3b[Headlines, hooks, body, CTAs, descriptions]
    S3b --> S3c[3 pillar variations per persona]
    S3c --> S3d{Copy Quality Gate — brand voice, accuracy}
    S3d -->|Pass| DB4[(generated_assets: copy)]
    S3d -->|Fail| S3e[Retry with feedback]
    S3e --> S3a

    DB4 --> S4[Stage 4: Layout Composition]
    S4 --> S4a[GLM-5 — design HTML compositions]
    S4a --> S4b[Scene-aware actor placement]
    S4b --> S4c[Graphic copy overlay — per language]
    S4c --> S4d[Playwright render → PNG]
    S4d --> S4e{Creative VQA Gate}
    S4e -->|Pass 85%+| S4f[Upload composed creatives to Blob]
    S4e -->|Fail| S4g[Flux 2 edit loop — up to 3 iterations]
    S4g --> S4d
    S4f --> DB5[(generated_assets: composed_creative + carousel_panel)]

    DB5 --> S5[Stage 5: Video Generation]
    S5 --> S5a[Kling 3.0 — 12-15s vertical UGC]
    S5a --> S5b[Multi-shot with lip sync]
    S5b --> DB6[(generated_assets: video)]

    DB6 --> S6[🟠 Stage 6: Landing Page Generation]
    S6 --> S6a[Select template variant per persona]
    S6a --> S6b[Extract hard facts from intake — template variables]
    S6b --> S6c[Pull best Stage 3 copy — hero H1, CTA]
    S6c --> S6d[Gemma 4 — generate why/activities/sessions/FAQ]
    S6d --> S6e[Jinja2 render — full HTML with images]
    S6e --> S6f{Drift Validation Gate}
    S6f -->|All facts match source| S6g[Upload HTML to Vercel Blob]
    S6f -->|Mismatch detected| S6h[Log error, mark failed]
    S6g --> DB7[(generated_assets: landing_page)]

    DB7 --> DONE[All stages complete]
    DONE --> STATUS[(intake_requests → status: review)]
    STATUS --> NOTIFY1[📣 Teams + Outlook Notification: Creatives Ready]

    NOTIFY1 --> MKT{Marketing Manager Review}
    MKT -->|Approve| DESIGN[Designer works on creatives]
    MKT -->|Reject — regen| REGEN[Trigger regeneration]
    REGEN --> WORKER

    DESIGN --> DSUB[Designer submits finals]
    DSUB --> DAPPROVE{Designer Approval}
    DAPPROVE -->|Approve| FINAL{Final Approval — Marketing Manager}

    FINAL -->|Approve| SENT[(status → sent)]
    SENT --> MAGIC[🔗 Generate agency magic link]
    MAGIC --> NOTIFY2[📣 Teams + Outlook Notification to agency]
    MAGIC --> AGENCY[Agency portal opens — /agency/id]

    DB7 --> SERVE[/lp/slug route serves landing pages]
    SERVE --> PUBLIC[Public landing page — no auth]
```

**LLMs used:** Kimi K2.5 (Stage 1), Seedream 4.5 (Stage 2), Gemma 4 (Stage 3, 6), GLM-5 (Stage 4), Flux 2 (Stage 4 edit), Kling 3.0 (Stage 5)
**Quality gates:** VQA (Stage 2, 4), Copy Quality (Stage 3), Drift Validation (Stage 6)
**Notifications:** Microsoft Teams webhooks + Outlook email at pipeline completion and final approval

---

## 6. Team Process — Human Handoff Flow

Who does what, when, and how work moves between the four roles. No system details — just the human collaboration.

```mermaid
flowchart TD
    R1[👤 Recruiter receives JD from hiring team]
    R1 --> R2[📋 Fills intake form — task type, requirements, budget, regions]
    R2 --> R3[🚀 Submits request]

    R3 --> AUTO[⚡ Nova generates everything automatically — ~15-30 min]

    AUTO --> N1[📣 Teams + Outlook: Campaign ready for review]
    N1 --> M1[👔 Marketing Manager reviews generated campaign]
    M1 --> M2[Edits: media strategy, ad copy, budgets, targeting, landing page URLs]

    M2 --> MG{Marketing Manager happy?}
    MG -->|Needs changes| M3[Requests regeneration or edits inline]
    M3 --> AUTO
    MG -->|Approved| N2[📣 Teams + Outlook: Ready for design review]

    N2 --> D1[🎨 Designer opens campaign in gallery]
    D1 --> D2[Reviews all creatives per persona, version, format]
    D2 --> D3[Edits: quick retouch, overlay text, regenerate, Figma export]

    D3 --> DG{Designer satisfied?}
    DG -->|Needs more work| D3
    DG -->|Done| D4[✅ Designer submits finals]

    D4 --> N3[📣 Teams + Outlook: Designer finals submitted]
    N3 --> M4[👔 Marketing Manager final review]
    M4 --> FG{Final approval?}
    FG -->|Needs revision| N2
    FG -->|Approved| M5[✅ Campaign approved]

    M5 --> N4[📣 Teams + Outlook: Your campaign is approved and live]
    N4 --> R4[👤 Recruiter accesses creative library, builds UTM links, shares with candidates]

    M5 --> M6[👔 Marketing Manager generates agency magic link]
    M6 --> N5[📣 Teams + Outlook: Campaign package ready + magic link]
    N5 --> A1[📊 Agency opens portal, downloads creatives, gets targeting + landing page URLs, launches campaigns]
```

**Roles:**
- **Recruiter** — Initiates (intake form) and receives (creative library + tracked links)
- **Marketing Manager** — Reviews, edits strategy, approves twice (after AI + after designer), delivers to agency
- **Designer** — Polishes creatives (retouch, overlay, Figma), submits finals
- **Paid Media Agency** — Receives package via magic link, launches ad campaigns
