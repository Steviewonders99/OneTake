# Organic-First Pipeline with Paid Upgrade Routing

**Date:** 2026-05-05
**Status:** Design approved
**Author:** Steven Junop + Claude

---

## Summary

Split the pipeline into two modes: **organic** (default for all intake requests) and **paid** (upgrade triggered by lead recruiter on existing organic campaigns). Organic produces job posts, social graphics, flyers, and captions. Paid extends with media strategy, ad creatives, video, and landing pages — reusing the full organic foundation (research, personas, actors, copy).

---

## Architecture

### Core Principle

Organic is the baseline. Paid is always an extension, never standalone. By the time paid is requested, the campaign has:
- Cultural research per country/locale
- Generated personas
- Actor identity cards with face_lock + hero images
- Approved organic copy and graphics

This foundation makes paid materials higher quality with zero redundant work.

### Pipeline Modes

| Mode | Trigger | Stages Run | Who Can Trigger |
|---|---|---|---|
| `organic` | Any recruiter submits intake form | 1 (no media strategy), 2, 3 (organic), 4 (organic) | Any recruiter |
| `full` | Lead recruiter clicks "Request Paid Media" | Media strategy + 3 (paid) + 4 (paid) + 5 + 6 | Lead recruiter or admin |

---

## Data Model Changes

### `intake_requests` table

```sql
ALTER TABLE intake_requests
  ADD COLUMN pipeline_mode TEXT NOT NULL DEFAULT 'organic'
    CHECK (pipeline_mode IN ('organic', 'full')),
  ADD COLUMN paid_requested_by TEXT,
  ADD COLUMN paid_requested_at TIMESTAMPTZ;
```

### `compute_jobs` table

```sql
-- Add 'generate_paid' to job_type CHECK constraint
ALTER TABLE compute_jobs
  DROP CONSTRAINT compute_jobs_job_type_check,
  ADD CONSTRAINT compute_jobs_job_type_check
    CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from', 'generate_paid'));
```

### `generated_assets` table — new asset_type values

```sql
-- Expand asset_type CHECK to include organic deliverables
ALTER TABLE generated_assets
  DROP CONSTRAINT generated_assets_asset_type_check,
  ADD CONSTRAINT generated_assets_asset_type_check
    CHECK (asset_type IN (
      'base_image',
      'composed_creative',
      'carousel_panel',
      'landing_page',
      'organic_carousel',
      'copy',
      'video',
      'wp_job_post',
      'job_portal_copy',
      'flyer',
      'flyer_copy',
      'social_caption',
      'social_graphic'
    ));
```

### `user_roles` table — new role

```sql
-- Add 'lead_recruiter' to role CHECK constraint
ALTER TABLE user_roles
  DROP CONSTRAINT user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('admin', 'recruiter', 'lead_recruiter', 'designer', 'viewer'));
```

**Lead recruiter permissions:** Everything a recruiter can do + "Request Paid Media" action on organic campaigns.

---

## Intake Wizard Changes

### Removed from organic wizard
- Budget calculator / ROAS section
- Media strategy fields (platform selection, ad spend, targeting)
- Any paid-specific language or framing

### Retained in organic wizard
- StepStart (file extraction / skip)
- StepTaskMode (task type + work mode)
- StepDetails (title, volume, languages, regions, country quotas for participant counts + contract revenue)
- StepRequirements (qualifications, engagement, technical)
- StepReview (final review)

**Country quotas stay** — needed for persona scaling AND auto-budget calculation when paid is eventually requested. Framed as "project scope" not "budget planning."

**Tracked links per locale stay** — needed for QR codes on flyers and social post CTAs.

**Form submission:** POST /api/intake always sets `pipeline_mode = 'organic'`. No user-facing toggle.

---

## Organic Pipeline Stages (Default)

All micro-stages run at full depth within each parent stage.

### Stage 1: Strategic Intelligence (organic)
- Mini brief generation
- Cultural research per country/locale
- Persona generation (dynamic, LLM-driven)
- Creative direction / visual direction
- Pillar classification (EARN/GROW/SHAPE)
- **SKIP:** Media strategy (no platform targeting, budget allocation, ad sets)

### Stage 2: Image Generation (organic)
- Actor identity cards
- Face lock
- Hero seed images
- Outfit/backdrop variations per locale
- VQA validation
- **Identical to current pipeline** — images feed flyers + social graphics

### Stage 3: Organic Copy Generation

Per-persona x per-locale x per-language:

| Deliverable | Description | asset_type |
|---|---|---|
| WordPress job post | Full post body (title, intro, requirements, benefits, CTA) ready for WP auto-publish | `wp_job_post` |
| Job portal copy | Platform-adapted versions for Indeed, LinkedIn Jobs, Glassdoor, local portals | `job_portal_copy` |
| Flyer copy | Headline, subhead, body, CTA — concise for print layout | `flyer_copy` |
| Social captions | Per-platform captions (LinkedIn, IG, Facebook, Twitter/X) with hashtags | `social_caption` |

Copy uses persona voice, cultural research, brand guidelines, and pillar messaging. Different output formats than ad hooks/CTAs.

### Stage 4: Organic Composition

| Deliverable | Description | asset_type |
|---|---|---|
| Social graphics | Organic post images per platform (LinkedIn, IG feed, IG story, Facebook) — actor hero images + copy overlay | `social_graphic` |
| Flyers | Print-ready layered HTML composition with actor image, copy, and QR code | `flyer` |

**Flyer composition:**
- Generated through same Stage 4 engine (GLM-5 HTML composition)
- Saved as layered `design_artifacts` (same structure as carousel panels)
- Designer portal picks them up for editing on workboard
- Exportable to Figma via existing integration
- **NOT flat images** — full layered compositions

**QR Code generation:**
- Generated per-locale
- Destination priority: Aidaform URL (if exists for campaign) → job posting page URL
- Must include UTM parameters: `utm_source=flyer&utm_medium=print&utm_campaign={slug}&utm_content={locale}`
- Routed through tracked link system (`go.oneforma.com/r/xxxxx`) for attribution

**Tracked links per locale:**
- Created for each country/locale in the campaign
- UTM params attached based on material type (flyer, social, wp_post)
- Feed into AudienceIQ attribution

### Stages 5 & 6: SKIPPED for organic

---

## Paid Upgrade Flow

### Trigger
Lead recruiter clicks "Request Paid Media" button on a campaign in `review` or `approved` status.

### Permission Gate
```typescript
requireRole('lead_recruiter') || requireRole('admin')
```
Regular recruiters do not see this button.

### Flow

**Step 1 — Auto-calculate budget:**
- Pull `volume_needed` and contract revenue from country_quotas
- Apply ROAS formula: `RPP = Contract Value / Required Participants`
- Calculate `Breakeven CPA = Net RPP x Fulfillment Rate`
- Suggest total budget = `CPA target x volume_needed` per country

**Step 2 — Lead recruiter confirms:**
- Light confirmation modal (not a wizard):
  - Auto-calculated budget (editable)
  - Platform checkboxes: Meta, LinkedIn, TikTok, Google (default all checked)
  - Date range (optional)
- One click: "Generate Paid Materials"

**Step 3 — Backend (POST /api/intake/[id]/request-paid):**
- Verify caller has `lead_recruiter` or `admin` role
- Update intake_request: `pipeline_mode = 'full'`, `paid_requested_by`, `paid_requested_at`
- Store budget + platform selections in `form_data` (or new JSONB column)
- Create compute_job: `job_type = 'generate_paid'`, same `request_id`

**Step 4 — Worker processes `generate_paid`:**
- Load existing: brief_data, actor_profiles, organic assets (copy + graphics)
- Run paid-only stages:
  - **Media strategy generation** — platform targeting, audience segments, ad sets (uses existing research + personas)
  - **Stage 3 extension:** Ad copy (hooks, value props, CTAs per platform) — informed by organic copy
  - **Stage 4 extension:** Paid carousel panels / static ad creatives
  - **Stage 5:** Video generation (Kling)
  - **Stage 6:** Landing page generation
- Save all new `generated_assets` with paid-specific asset_types

**Step 5 — Status flow:**
- Request status → `'generating'` while paid stages run
- On complete → back to `'review'` for approval
- Same approval workflow — additional paid assets to review

---

## Frontend Surfacing

### Dashboard
- Campaign cards show badge: `organic` (default) or `organic + paid` (after upgrade)
- Filters: "All", "Organic Only", "Paid Active", "Pending Paid Approval"
- Lead recruiter sees "Request Paid Media" button on completed organic campaigns
- Regular recruiters: button hidden

### Campaign Workspace — Section Pills

| Section | Organic mode | Full mode (after paid) |
|---|---|---|
| Brief | Show | Show |
| Personas | Show | Show |
| Cultural Research | Show | Show |
| **Organic Materials** | Show | Show |
| Media Strategy | Hidden | Show |
| Paid Creatives | Hidden | Show |
| Channel Mix | Hidden | Show |
| Videos | Hidden | Show |

### New "Organic Materials" Section

Organized by deliverable type:

- **Job Posts** tab — WP post preview + job portal copy variants (Indeed, LinkedIn Jobs, etc.)
- **Social** tab — graphic previews (layered compositions) + captions per platform
- **Flyers** tab — flyer previews (layered compositions) with QR code visible, download button
- **Tracked Links** tab — per-locale links with UTM params, copy-to-clipboard

### Approval Flow (unchanged logic)
- Steven reviews organic materials → approves → recruiter can distribute
- When paid generates later, status returns to `review` → Steven approves paid assets
- Export/ZIP includes both organic + paid assets when both exist

### Recruiter View (approved campaigns)
- Creative library shows organic assets (social graphics, flyers) alongside paid when available
- Flyer download: print-ready output with embedded QR code
- Social captions: one-click copy per platform

### Designer Portal
- Flyers appear on workboard as layered compositions (same as carousel panels)
- Editable via existing edit system
- Exportable to Figma via existing integration

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Organic is always first, paid is upgrade | Builds foundation → higher quality paid output, no redundant work |
| No budget/ROAS in organic wizard | Zero friction for recruiters, budget only relevant for paid |
| Country quotas stay in organic form | Needed for persona scaling + auto-budget calculation later |
| All 5 organic deliverables generate by default | Free (NIM), fast, better to have extras than miss one |
| Flyers are layered HTML compositions | Same design system as all other graphics, Figma-exportable |
| QR code → Aidaform (with UTM), fallback to job posting | Attribution-first, configurable destination |
| Lead recruiter role gates paid | Prevents premature ad spend, ensures organic is validated first |
| Paid reuses existing assets as context | Zero redundant generation, organic informs paid |
| Tracked links per locale in organic | Required for QR codes and social CTAs, feeds AudienceIQ |

---

## Files Impacted (Estimated)

| Area | Files |
|---|---|
| Schema / migrations | `src/lib/db/schema.ts`, migration SQL |
| Intake API | `src/app/api/intake/route.ts` |
| New API route | `src/app/api/intake/[id]/request-paid/route.ts` |
| Intake wizard | `src/components/intake/IntakeWizard.tsx`, `StepDetails.tsx` |
| Permissions | `src/lib/permissions.ts`, `src/lib/db/user-roles.ts` |
| Worker orchestrator | `worker/pipeline/orchestrator.py` |
| Stage 1 | `worker/pipeline/stage1_intelligence.py` (skip media strategy for organic) |
| Stage 3 (new) | `worker/pipeline/stage3_organic_copy.py` (new file) |
| Stage 4 (new) | `worker/pipeline/stage4_organic_compose.py` (new file) |
| QR code generation | `worker/utils/qr_generator.py` (new file) |
| Frontend workspace | `src/components/campaign/OrganicMaterials.tsx` (new) |
| Dashboard | `src/components/dashboard/CampaignCard.tsx` |
| Designer portal | Update artifact type handling for flyers |
