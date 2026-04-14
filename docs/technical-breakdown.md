# Centric Intake Technical Breakdown

This document describes the current platform architecture, major workflows, generation pipeline, data model, integration points, and operational responsibilities for engineering review.

## Executive Summary

Centric Intake is a full-stack recruitment campaign workflow platform. It captures recruiter requests, turns them into structured campaign briefs, runs a staged AI creative-generation pipeline, supports marketing-manager review, enables designer collaboration, unlocks recruiter-ready assets, and packages campaigns for external agency handoff.

The core architecture separates the web application from the heavy compute pipeline:

| Layer | Responsibility |
| --- | --- |
| Next.js app | UI, API routes, authentication, review flows, handoffs, exports, tracking. |
| Neon Postgres | Source of truth for requests, jobs, assets, approvals, roles, links, and handoff data. |
| Vercel Blob | Storage for generated assets, uploads, exports, and creative outputs. |
| Python worker | Long-running AI generation, rendering, evaluation, and write-back to Neon. |
| External AI/model providers | Text generation, image generation, visual QA, creative design, and video generation. |

## Primary User Roles

| Role | Main Responsibilities |
| --- | --- |
| Recruiter | Submit intake requests, monitor progress, download approved assets, create tracked links. |
| Admin / Marketing Manager | Review campaign strategy and creatives, approve packages, request changes, manage handoff. |
| Designer | Review campaign context, download kits, leave notes, upload refined/final deliverables. |
| Agency | Receive packaged campaign strategy, creative assets, and ZIP exports. |
| Worker | Claim generation jobs and run the staged AI pipeline. |

## High-Level System Flow

```text
Recruiter/Admin submits intake
  -> Next.js API validates request
  -> intake_requests row is created
  -> compute_jobs row is created
  -> Python worker claims job
  -> staged generation writes back to Neon and Blob
  -> request moves to marketing review
  -> admin approves or requests changes
  -> approved package unlocks designer, recruiter, and agency handoffs
```

Mermaid source files for this workflow live in `docs/workflow/`.

## Application Architecture

### Web App

The Next.js app lives under `src/`.

Important areas:

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Main dashboard. Admins get the campaign command center; recruiters get card-based request views. |
| `src/app/intake/new/page.tsx` | New request intake form with manual, upload, and pasted-brief entry modes. |
| `src/app/intake/[id]/page.tsx` | Full campaign detail and review workspace. |
| `src/app/designer/page.tsx` | Authenticated designer campaign portal. |
| `src/app/designer/[id]/page.tsx` | Magic-link designer workspace. |
| `src/app/agency/[id]/page.tsx` | Agency-facing package view. |
| `src/app/r/[slug]/route.ts` | Short-link redirect and click tracking. |
| `src/app/api/*` | Backend API routes for intake, generation, approvals, exports, tracked links, designer uploads, and notifications. |

### Shared Libraries

| Path | Purpose |
| --- | --- |
| `src/lib/db.ts` | Neon database client. |
| `src/lib/db/schema.ts` | Database bootstrap and table creation. |
| `src/lib/db/*.ts` | Table-specific database helpers. |
| `src/lib/permissions.ts` | Role lookup and access helpers. |
| `src/lib/export.ts` | ZIP export packaging. |
| `src/lib/tracked-links/*` | UTM and short-link helpers. |
| `src/lib/blob.ts` | Vercel Blob upload helpers. |
| `src/lib/notifications/*` | Teams, Slack, and Outlook notification helpers. |

### Worker

The worker lives under `worker/`.

Important areas:

| Path | Purpose |
| --- | --- |
| `worker/main.py` | Polling worker entrypoint. Claims compute jobs and runs pipeline. |
| `worker/supervisor.py` | Multi-worker process supervisor. |
| `worker/neon_client.py` | Async Neon client used by the worker. |
| `worker/pipeline/orchestrator.py` | Stage orchestration and status transitions. |
| `worker/pipeline/stage1_intelligence.py` | Strategic intelligence, personas, brief, design direction. |
| `worker/pipeline/stage2_images.py` | Actor card generation and image generation. |
| `worker/pipeline/stage3_copy.py` | Persona-targeted copy generation. |
| `worker/pipeline/stage4_compose_v2.py` | Creative composition, rendering, VQA, and asset persistence. |
| `worker/pipeline/stage5_video.py` | Optional UGC-style video generation. |
| `worker/ai/*` | Model clients, renderers, VQA, editing, video, and utility integrations. |
| `worker/prompts/*` | Prompt systems, evaluators, campaign strategy, brand rules, and content format logic. |

## Database Model

The database is centered around `intake_requests`.

| Table | Purpose |
| --- | --- |
| `intake_requests` | Campaign request metadata, status, form data, job requirements, campaign slug. |
| `attachments` | Uploaded files and extracted RFP text/data. |
| `creative_briefs` | Generated brief, research, design direction, content languages, derived requirements. |
| `actor_profiles` | Persona-linked actor identity, face lock, prompt seed, outfits, backdrops. |
| `generated_assets` | Base images, composed creatives, carousels, copy, video, metadata, scores, Blob URLs. |
| `approvals` | Approval decisions, approver, notes, and change requests. |
| `compute_jobs` | Queue table for worker jobs and stage regeneration. |
| `pipeline_runs` | Stage telemetry and structured run records. |
| `campaign_strategies` | Country and budget-specific media strategy outputs. |
| `campaign_landing_pages` | Job posting, landing page, and ADA form URLs for handoff. |
| `tracked_links` | Recruiter-generated short links with UTM metadata and click counts. |
| `designer_uploads` | Designer-uploaded replacement or final assets. |
| `designer_notes` | Designer comments attached to generated assets. |
| `magic_links` | Time-limited external access tokens for designer and agency views. |
| `notifications` | In-app notification events. |
| `notification_deliveries` | Outbound delivery logs for external channels. |
| `user_roles` | Clerk user role mapping. |
| `task_type_schemas` | Dynamic intake form definitions. |
| `schema_versions` | Version history for intake schemas. |
| `option_registries` | Shared option lists for forms and dropdowns. |

## Request Status Lifecycle

| Status | Meaning |
| --- | --- |
| `draft` | Initial or returned-for-changes state. |
| `generating` | Compute job queued or in progress. |
| `review` | Generation completed and marketing review is required. |
| `approved` | Marketing approved the package for downstream use. |
| `sent` | Final package has been delivered or handed off. |
| `rejected` | Request was rejected. |
| `split` | Parent campaign was split into child campaigns. |

## Intake Workflow

1. User opens `src/app/intake/new/page.tsx`.
2. User selects a task type from active schemas.
3. User fills the form manually, uploads an RFP, or pastes client brief text.
4. Extraction routes can prefill fields using AI.
5. `POST /api/intake` validates top-level request fields and schema-specific form data.
6. Job requirement fields are promoted into first-class `intake_requests` columns.
7. A campaign slug is generated from the title.
8. Request is saved.
9. A `compute_jobs` row is created.
10. Request status moves to `generating`.

## Generation Pipeline

The worker claims pending jobs and runs the stage orchestrator.

### Stage 1: Strategic Intelligence

Inputs:

- Intake request
- Target regions
- Target languages
- Form data
- Task type

Responsibilities:

- Run cultural research per target region.
- Generate target personas.
- Save initial actor stubs and targeting metadata.
- Generate campaign strategies and budget allocation.
- Generate the creative brief.
- Evaluate the brief with a quality rubric.
- Generate design direction.
- Persist the brief and strategy outputs.

Outputs:

- `creative_briefs.brief_data`
- `creative_briefs.design_direction`
- `creative_briefs.derived_requirements`
- `campaign_strategies`
- Persona objects embedded into brief data
- Cultural research embedded into brief data

Feeds Stage 2:

- Personas
- Regions
- Languages
- Design direction
- Derived requirements

### Stage 2: Character-Driven Image Generation

Inputs:

- Personas
- Design direction
- Regions
- Languages

Responsibilities:

- Generate actor identity cards.
- Create multiple actors per persona.
- Generate validated seed images.
- Generate scene, outfit, and backdrop variations.
- Run visual QA.
- Upload approved images to Blob.
- Save actor and image assets to Neon.

Outputs:

- `actor_profiles`
- `generated_assets` with base image assets
- Validated seed image URLs
- VQA scores and metadata

Feeds Stage 3 and Stage 4:

- Actor identity data
- Base images
- Validated visual identity

### Stage 3: Copy Generation

Inputs:

- Brief
- Personas
- Design direction
- Regions
- Languages
- Channel strategy

Responsibilities:

- Generate persona-targeted copy by platform and language.
- Generate multiple psychology-angle variants.
- Evaluate copy quality.
- Retry underperforming copy.
- Save copy as generated assets.

Outputs:

- Platform copy variants
- Persona copy metadata
- Evaluation scores and issue metadata

Feeds Stage 4:

- Approved copy sets
- Persona and platform-specific messaging

### Stage 4: Layout Composition

Inputs:

- Actors
- Base images
- Copy assets
- Brief
- Design direction
- Platform specs

Responsibilities:

- Group actors by persona.
- Resolve platform/channel targets.
- Generate overlay copy sets.
- Generate HTML/CSS creative layouts.
- Render final PNGs through Playwright.
- Run creative VQA.
- Retry failed or low-scoring creative designs.
- Upload final renders and overlay renders.
- Save composed creatives.
- Generate carousel assets where applicable.

Outputs:

- `composed_creative` assets
- `carousel_panel` assets
- Overlay URLs
- Final creative PNG URLs
- Creative evaluation metadata

Feeds Stage 5:

- Final creative direction
- Messaging context
- Actor/image context

### Stage 5: Video Generation

Inputs:

- Personas
- Actors
- Brief
- Stage 2 images
- Stage 3/4 messaging context

Responsibilities:

- Generate short-form UGC scripts.
- Evaluate and rewrite scripts.
- Generate storyboard frames.
- Run VQA on storyboard frames.
- Generate multishot video.
- Upload video assets.
- Save video metadata.

Outputs:

- Short-form campaign video assets
- Script and storyboard metadata
- Video Blob URLs

## Marketing Review Workflow

Marketing managers use the admin command center to review:

- Campaign status
- Campaign slug
- Strategic brief
- Cultural research
- Personas
- Media strategy
- Actor profiles
- Base images
- Composed creatives
- Landing page handoff URLs

Primary actions:

- Approve request
- Request changes
- Retry generation
- Delete or refine assets
- Edit landing page handoff URLs
- Send campaign to agency
- Export ZIP packages

## Designer Workflow

Designers can access campaigns through:

- Authenticated designer dashboard
- Magic-link designer portal

Designer capabilities:

- View campaign context.
- Review brief and generated assets.
- Download character assets, raw assets, composed creatives, and brand kit exports.
- Leave notes on assets.
- Upload replacement or final files.
- Submit finals.
- Edit shared landing page handoff URLs.

## Recruiter Workflow

Recruiter experience is intentionally separated into pre-approval and post-approval states.

Pre-approval:

- Recruiter sees campaign status.
- Recruiter sees progress and high-level overview.
- Recruiter does not manage generated assets.

Post-approval:

- Approved creative library is unlocked.
- Recruiter can browse assets by channel.
- Recruiter can download approved assets.
- Recruiter can create tracked links.
- Recruiter can monitor clicks and performance by channel/platform.

Tracked-link creation requires:

- Approved or sent campaign.
- Campaign slug.
- At least one landing page URL.
- Source and platform metadata.
- Recruiter-specific tracking tag.

## Agency Workflow

Agency handoff uses a public package view backed by magic-link access.

Agency package includes:

- Campaign title and task type.
- Regions and languages.
- Strategy and budget data.
- Persona-grouped creative packages.
- Platform-ready assets.
- Download-all ZIP export.

## API Surface

### Intake

| Route | Purpose |
| --- | --- |
| `GET /api/intake` | List accessible intake requests. |
| `POST /api/intake` | Create request and auto-queue generation. |
| `GET /api/intake/[id]` | Fetch request details. |
| `PATCH /api/intake/[id]` | Update request metadata or status. |
| `DELETE /api/intake/[id]` | Delete request. |
| `GET /api/intake/[id]/progress` | Fetch progressive generated state. |
| `GET /api/intake/[id]/landing-pages` | Fetch shared handoff URLs. |
| `PATCH /api/intake/[id]/landing-pages` | Update shared handoff URLs. |
| `PATCH /api/intake/[id]/campaign-slug` | Update campaign tracking slug. |

### Generation

| Route | Purpose |
| --- | --- |
| `POST /api/generate/[id]` | Queue full generation. |
| `GET /api/generate/[id]` | Fetch generation jobs. |
| `GET /api/generate/[id]/brief` | Fetch latest brief. |
| `POST /api/generate/[id]/brief` | Queue Stage 1 regeneration. |
| `GET /api/generate/[id]/actors` | Fetch actor profiles. |
| `POST /api/generate/[id]/actors` | Queue Stage 2 regeneration. |
| `GET /api/generate/[id]/images` | Fetch generated assets. |
| `POST /api/generate/[id]/images` | Queue image regeneration. |
| `GET /api/generate/[id]/strategy` | Fetch campaign strategies. |
| `POST /api/generate/[id]/compose` | Queue Stage 4 regeneration. |

### Review and Handoff

| Route | Purpose |
| --- | --- |
| `POST /api/approve/[id]` | Approve campaign and create designer magic link. |
| `POST /api/approve/[id]/changes` | Request changes and return to draft. |
| `GET /api/export/[id]` | Export campaign ZIP package. |
| `GET /api/designer/[id]` | Fetch designer workspace data by token. |
| `POST /api/designer/[id]/upload` | Upload designer file. |
| `GET /api/designer/[id]/notes` | Fetch designer notes. |
| `POST /api/designer/[id]/notes` | Save designer note. |
| `POST /api/designer/[id]/submit-finals` | Submit designer final deliverables. |

### Recruiter Tracking

| Route | Purpose |
| --- | --- |
| `POST /api/tracked-links` | Create recruiter short link. |
| `GET /api/tracked-links` | Fetch tracked links and summary metrics. |
| `GET /r/[slug]` | Redirect short link and increment click count. |

## Storage and Asset Flow

1. Worker generates image, creative, carousel, or video assets.
2. Asset binary is uploaded to Vercel Blob.
3. Blob URL is saved in `generated_assets`.
4. UI reads asset metadata from Neon and renders previews from Blob URLs.
5. Export routes pull approved assets and generate downloadable ZIP packages.

## Notifications

Microsoft Teams is the primary notification channel.

Notification moments:

- Generation complete.
- Generation failed.
- Designer assigned.
- Designer uploaded finals.
- Manual notification routes for Slack, Outlook, and Teams are also present.

## Deployment Model

The app and worker are deployable as separate runtime concerns:

| Component | Deployment Shape |
| --- | --- |
| Web app | Next.js runtime with Clerk, Neon, and Blob environment variables. |
| Worker | Long-running Python process with database, Blob, and model-provider credentials. |
| Database | Neon Postgres or equivalent Postgres-compatible service. |
| Blob storage | Vercel Blob or compatible object storage abstraction. |
| Notifications | Teams webhook or equivalent notification sink. |

## Environment Configuration

Key app variables:

```text
DATABASE_URL
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
BLOB_READ_WRITE_TOKEN
TEAMS_WEBHOOK_URL
OPENROUTER_API_KEY
NVIDIA_NIM_API_KEY
```

Key worker variables:

```text
DATABASE_URL
BLOB_READ_WRITE_TOKEN
APP_URL
NVIDIA_NIM_API_KEY
OPENROUTER_API_KEY
POLL_INTERVAL_SECONDS
COMPOSE_CONCURRENCY
KLING_ACCESS_KEY
KLING_SECRET_KEY
ELEVENLABS_API_KEY
```

## Engineering Handoff Notes

The platform is organized around durable workflow boundaries:

- Intake request creation
- Compute job queue
- Stage-based generation
- Marketing review
- Designer collaboration
- Recruiter activation
- Agency packaging
- Tracking and reporting

These boundaries are the recommended starting point for ongoing engineering hardening, deployment planning, and infrastructure ownership.

