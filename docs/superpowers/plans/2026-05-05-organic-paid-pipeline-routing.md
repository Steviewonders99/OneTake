# Organic-First Pipeline with Paid Upgrade Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the pipeline into organic (default) and paid (upgrade by lead recruiter), adding new organic deliverables (WP posts, job portal copy, flyers with QR codes, social graphics + captions) while preserving all existing paid pipeline functionality.

**Architecture:** Add `pipeline_mode` to `intake_requests`, new `generate_paid` job_type, new organic-specific Stage 3 + Stage 4 variants in the worker, new `request-paid` API route gated by `lead_recruiter` role. Frontend surfaces organic materials in a new campaign workspace section.

**Tech Stack:** Next.js (TypeScript), Python (async worker), PostgreSQL (Neon/Azure PG), qrcode Python library for QR generation.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/db/schema.ts` | DB schema + constraints | Modify (add columns, expand CHECKs) |
| `src/lib/types.ts` | TypeScript types | Modify (add `lead_recruiter` to UserRole) |
| `src/lib/permissions.ts` | Role-based access | Modify (add `canRequestPaid()`) |
| `src/lib/db/user-roles.ts` | Role provisioning | Modify (update auto-provision default) |
| `src/app/api/intake/route.ts` | Intake submission | Modify (set `pipeline_mode='organic'`) |
| `src/app/api/intake/[id]/request-paid/route.ts` | Paid upgrade endpoint | Create |
| `src/components/intake/IntakeWizard.tsx` | Intake form | Modify (remove budget fields) |
| `worker/pipeline/orchestrator.py` | Job routing | Modify (add organic/paid routing) |
| `worker/pipeline/stage1_intelligence.py` | Stage 1 | Modify (skip media strategy for organic) |
| `worker/pipeline/stage3_organic_copy.py` | Organic copy gen | Create |
| `worker/pipeline/stage4_organic_compose.py` | Organic compositions | Create |
| `worker/utils/qr_generator.py` | QR code with UTM | Create |
| `src/components/campaign/OrganicMaterials.tsx` | Frontend section | Create |
| `worker/requirements-docker.txt` | Python deps | Modify (add `qrcode[pil]`) |

---

### Task 1: Schema Migration — Add pipeline_mode, Expand Constraints

**Files:**
- Modify: `src/lib/db/schema.ts:60-107` (intake_requests), `:173-193` (generated_assets), `:331-349` (compute_jobs), `:370-383` (user_roles)

- [ ] **Step 1: Add pipeline_mode + paid columns to intake_requests**

In `src/lib/db/schema.ts`, after the `figma_sync` ALTER (line 104-107), add:

```typescript
  // Pipeline mode: organic (default) or full (after paid upgrade)
  await sql`
    ALTER TABLE intake_requests
      ADD COLUMN IF NOT EXISTS pipeline_mode TEXT NOT NULL DEFAULT 'organic',
      ADD COLUMN IF NOT EXISTS paid_requested_by TEXT,
      ADD COLUMN IF NOT EXISTS paid_requested_at TIMESTAMPTZ
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE intake_requests
        ADD CONSTRAINT intake_requests_pipeline_mode_check
        CHECK (pipeline_mode IN ('organic', 'full'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
```

- [ ] **Step 2: Expand generated_assets asset_type CHECK**

Replace line 178 in the CREATE TABLE (this is idempotent — only applies on fresh installs). Then add migration for existing DBs:

```typescript
  // Expand asset_type for organic deliverables
  await sql`
    ALTER TABLE generated_assets DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check
  `;
  await sql`
    ALTER TABLE generated_assets ADD CONSTRAINT generated_assets_asset_type_check
      CHECK (asset_type IN (
        'base_image', 'composed_creative', 'carousel_panel', 'landing_page',
        'organic_carousel', 'copy', 'video',
        'wp_job_post', 'job_portal_copy', 'flyer', 'flyer_copy',
        'social_caption', 'social_graphic'
      ))
  `;
```

- [ ] **Step 3: Expand compute_jobs job_type CHECK**

```typescript
  // Add generate_paid job type
  await sql`
    ALTER TABLE compute_jobs DROP CONSTRAINT IF EXISTS compute_jobs_job_type_check
  `;
  await sql`
    ALTER TABLE compute_jobs ADD CONSTRAINT compute_jobs_job_type_check
      CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from', 'generate_paid'))
  `;
```

- [ ] **Step 4: Expand user_roles role CHECK**

```typescript
  // Add lead_recruiter role
  await sql`
    ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check
  `;
  await sql`
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
      CHECK (role IN ('admin', 'recruiter', 'lead_recruiter', 'designer', 'viewer'))
  `;
```

- [ ] **Step 5: Update TypeScript types**

In `src/lib/types.ts`, line 428:

```typescript
export type UserRole = 'admin' | 'recruiter' | 'lead_recruiter' | 'designer' | 'viewer';
```

- [ ] **Step 6: Run the app to verify migrations apply cleanly**

Run: `npm run dev` — hit any page to trigger `ensureSchema()`. Check server logs for errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts src/lib/types.ts
git commit -m "feat: add pipeline_mode, organic asset types, lead_recruiter role to schema"
```

---

### Task 2: Permissions — Lead Recruiter Role + canRequestPaid()

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `src/lib/db/user-roles.ts`

- [ ] **Step 1: Add canRequestPaid() to permissions.ts**

Add after `canEditRequest()` (after line 56):

```typescript
export function canRequestPaid(authCtx: AuthContext): boolean {
  return authCtx.role === 'admin' || authCtx.role === 'lead_recruiter';
}
```

- [ ] **Step 2: Update canAccessRequest for lead_recruiter**

In `canAccessRequest()`, add lead_recruiter handling (they can see all requests, like admin):

```typescript
export function canAccessRequest(
  authCtx: AuthContext,
  requestCreatedBy: string | null
): boolean {
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'lead_recruiter') return true;
  if (authCtx.role === 'recruiter') {
    return requestCreatedBy === authCtx.userId;
  }
  if (authCtx.role === 'viewer') return true;
  return false;
}
```

- [ ] **Step 3: Update getNavForRole for lead_recruiter**

Add a case for `lead_recruiter` in the switch (before the `recruiter` case):

```typescript
    case 'lead_recruiter':
      return {
        sections: [
          {
            title: 'Pipeline',
            links: [
              ...base,
              { href: '/intake/new', label: 'New Request', icon: 'PlusCircle' },
            ],
          },
        ],
      };
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: add lead_recruiter permissions and canRequestPaid()"
```

---

### Task 3: Request Paid API Route

**Files:**
- Create: `src/app/api/intake/[id]/request-paid/route.ts`

- [ ] **Step 1: Create the request-paid route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, canRequestPaid } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { createComputeJob } from '@/lib/db/compute-jobs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canRequestPaid(authCtx)) {
    return NextResponse.json({ error: 'Only lead recruiters can request paid media' }, { status: 403 });
  }

  const { id } = await params;
  const sql = getDb();

  // Verify request exists and is in valid state for paid upgrade
  const rows = await sql`
    SELECT id, status, pipeline_mode, title FROM intake_requests WHERE id = ${id}
  `;
  const intakeRequest = rows[0];
  if (!intakeRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (!['review', 'approved'].includes(intakeRequest.status)) {
    return NextResponse.json(
      { error: 'Campaign must be in review or approved status to request paid media' },
      { status: 400 }
    );
  }
  if (intakeRequest.pipeline_mode === 'full') {
    return NextResponse.json(
      { error: 'Paid media already requested for this campaign' },
      { status: 400 }
    );
  }

  // Parse body for optional paid config (budget, platforms)
  const body = await request.json().catch(() => ({}));
  const paidConfig = {
    budget: body.budget ?? null,
    platforms: body.platforms ?? ['meta', 'linkedin', 'tiktok', 'google'],
    date_range: body.date_range ?? null,
  };

  // Update request to full mode
  await sql`
    UPDATE intake_requests
    SET pipeline_mode = 'full',
        paid_requested_by = ${authCtx.userId},
        paid_requested_at = NOW(),
        status = 'generating',
        form_data = form_data || ${JSON.stringify({ paid_config: paidConfig })}::jsonb
    WHERE id = ${id}
  `;

  // Create compute job for paid pipeline
  const job = await createComputeJob({
    request_id: id,
    job_type: 'generate_paid',
    feedback_data: paidConfig,
  });

  return NextResponse.json({
    success: true,
    job_id: job.id,
    message: 'Paid media generation started',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/intake/[id]/request-paid/route.ts
git commit -m "feat: add request-paid API route with lead_recruiter gate"
```

---

### Task 4: Intake Wizard — Set pipeline_mode, Remove Budget Fields

**Files:**
- Modify: `src/components/intake/IntakeWizard.tsx`
- Modify: `src/app/api/intake/route.ts`

- [ ] **Step 1: Set pipeline_mode in API route**

In `src/app/api/intake/route.ts`, in the INSERT statement (around line 132), add `pipeline_mode` to the columns:

Find the INSERT INTO intake_requests statement and add the column. The value is always `'organic'`:

```sql
pipeline_mode = 'organic'
```

Add `pipeline_mode` to the INSERT column list and value `'organic'` to the VALUES.

- [ ] **Step 2: Remove budget/ROAS fields from intake wizard (if any)**

Check `src/components/intake/StepDetails.tsx` for any budget, ROAS, or media strategy fields. Remove them from the organic flow. Country quotas (volume_needed, contract revenue per locale) STAY — they're framed as "project scope."

- [ ] **Step 3: Verify form submission still works**

Run: `npm run dev`, navigate to `/intake/new`, complete the wizard. Verify the POST succeeds and `pipeline_mode = 'organic'` is set in the database.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/intake/route.ts src/components/intake/
git commit -m "feat: set pipeline_mode=organic on intake submission, remove budget fields"
```

---

### Task 5: Worker Orchestrator — Organic/Paid Routing

**Files:**
- Modify: `worker/pipeline/orchestrator.py`

- [ ] **Step 1: Add organic pipeline routing**

In `orchestrator.py`, after the existing job_type routing blocks (after line 113), add routing for `generate_paid`. Also modify the stages list to conditionally exclude stages 5+6 for organic:

```python
    # ── Paid upgrade: run paid-only stages on existing organic campaign ──
    if job_type == "generate_paid":
        from neon_client import get_intake_request as _get_request
        request = await _get_request(request_id)
        feedback_data = job.get("feedback_data", {})
        if isinstance(feedback_data, str):
            import json as _json
            feedback_data = _json.loads(feedback_data)
        context["paid_config"] = feedback_data
        context["form_data"] = request.get("form_data", {})
        context["target_regions"] = request.get("target_regions", [])

        # Paid stages only — organic foundation already exists
        stages = [
            (1, "Media Strategy Generation", _run_media_strategy),
            (3, "Paid Copy Generation", run_stage3),
            (4, "Paid Layout Composition", _run_stage4_routed),
            (5, "Video Generation", run_video_stage),
            (6, "Landing Page Generation", run_stage6),
        ]
        logger.info("Running PAID pipeline upgrade for request %s", request_id)
```

- [ ] **Step 2: Add organic stage routing for generate/generate_country**

After the stages list definition (line 76), add a check for pipeline_mode to swap stages 3+4 to organic variants and skip 5+6:

```python
    # ── Organic pipeline: use organic Stage 3 + 4, skip 5 + 6 ──
    if job_type in ("generate", "generate_country") and job_type != "generate_paid":
        from neon_client import get_intake_request as _get_request_mode
        _req_mode = await _get_request_mode(request_id)
        if _req_mode.get("pipeline_mode", "organic") == "organic":
            from pipeline.stage3_organic_copy import run_stage3_organic
            from pipeline.stage4_organic_compose import run_stage4_organic
            stages = [
                (1, "Strategic Intelligence", run_stage1),
                (2, "Character-Driven Image Generation", run_stage2),
                (3, "Organic Copy Generation", run_stage3_organic),
                (4, "Organic Composition", run_stage4_organic),
            ]
            logger.info("Running ORGANIC pipeline for request %s", request_id)
```

- [ ] **Step 3: Add _run_media_strategy helper**

Above `run_pipeline()`, add:

```python
async def _run_media_strategy(context: dict) -> dict:
    """Run only the media strategy portion of Stage 1 for paid upgrades."""
    from pipeline.stage1_intelligence import run_campaign_strategy_standalone
    return await run_campaign_strategy_standalone(context)
```

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/orchestrator.py
git commit -m "feat: add organic/paid pipeline routing in orchestrator"
```

---

### Task 6: Stage 1 — Skip Media Strategy for Organic

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Add pipeline_mode check around media strategy block**

In `stage1_intelligence.py`, wrap the STEP 3b campaign strategy section (lines 227-377) in a conditional:

```python
    # ==================================================================
    # STEP 3b: CAMPAIGN STRATEGY ENGINE (PAID ONLY)
    # Skip for organic pipeline — no media strategy needed
    # ==================================================================
    pipeline_mode = context.get("pipeline_mode", "organic")
    if pipeline_mode != "organic":
        # ... existing campaign strategy code (lines 233-377) ...
    else:
        logger.info("ORGANIC mode — skipping media strategy generation")
        context["campaign_strategies"] = {}
        context["budget_data"] = {}
```

- [ ] **Step 2: Pass pipeline_mode into context early**

At the top of `run_stage1()`, after loading the request (around line 93), add:

```python
    context["pipeline_mode"] = request.get("pipeline_mode", "organic")
```

- [ ] **Step 3: Add run_campaign_strategy_standalone for paid upgrades**

At the bottom of the file, add a standalone function that can be called by the paid pipeline:

```python
async def run_campaign_strategy_standalone(context: dict) -> dict:
    """Run ONLY the campaign strategy engine for paid upgrades.
    
    Assumes brief, personas, and cultural_research already exist in context
    (loaded from the organic run).
    """
    request_id = context["request_id"]
    request = await get_intake_request(request_id)
    
    # Load existing brief data
    from neon_client import get_brief
    existing_brief = await get_brief(request_id)
    brief_data = existing_brief.get("brief_data", {})
    if isinstance(brief_data, str):
        import json
        brief_data = json.loads(brief_data)
    
    personas = brief_data.get("personas", [])
    cultural_research = brief_data.get("cultural_research", {})
    
    # Run campaign strategy with existing data
    context["personas"] = personas
    context["cultural_research"] = cultural_research
    context["brief"] = brief_data
    context["pipeline_mode"] = "full"
    
    # Execute the strategy engine (reuse existing code path)
    # ... call run_campaign_strategy logic ...
    from ai.campaign_evaluator import MAX_RETRIES as STRATEGY_MAX_RETRIES
    from ai.campaign_evaluator import PASS_THRESHOLD as STRATEGY_THRESHOLD
    from ai.campaign_evaluator import evaluate_campaign_strategy as eval_strategy
    from prompts.campaign_strategy import (
        calculate_budget_cascade,
        generate_campaign_strategy,
    )
    
    # Extract channel strategy from personas
    channel_strategy = {}
    for p in personas:
        for ch in p.get("best_channels", []):
            channel_strategy[ch] = channel_strategy.get(ch, 0) + 1

    target_regions = context.get("target_regions", request.get("target_regions", []))
    countries_data = {r: {"richness": 1.0} for r in target_regions}
    budget_data = calculate_budget_cascade(request, countries_data)
    
    all_strategies = {}
    for region in target_regions:
        strategy = await generate_campaign_strategy(
            request, personas, cultural_research.get(region, {}),
            budget_data, region, channel_strategy
        )
        result = eval_strategy(strategy, request, region)
        if result["passed"]:
            all_strategies[region] = strategy
            from neon_client import save_campaign_strategy
            await save_campaign_strategy(request_id, region, strategy)

    context["campaign_strategies"] = all_strategies
    context["budget_data"] = budget_data
    
    return {"campaign_strategies": all_strategies, "budget_data": budget_data}
```

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "feat: skip media strategy for organic pipeline, add standalone for paid"
```

---

### Task 7: QR Code Generator Utility

**Files:**
- Create: `worker/utils/qr_generator.py`
- Modify: `worker/requirements-docker.txt`

- [ ] **Step 1: Add qrcode dependency**

In `worker/requirements-docker.txt`, add:

```
qrcode[pil]==8.0
```

- [ ] **Step 2: Create QR generator utility**

```python
"""QR code generator with UTM tracking for flyers."""
from __future__ import annotations

import io
import base64
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer


def build_tracked_url(
    base_url: str,
    campaign_slug: str,
    locale: str,
    source: str = "flyer",
    medium: str = "print",
) -> str:
    """Build a URL with UTM parameters for tracking."""
    utm_params = {
        "utm_source": source,
        "utm_medium": medium,
        "utm_campaign": campaign_slug,
        "utm_content": locale,
    }
    parsed = urlparse(base_url)
    existing_params = parse_qs(parsed.query)
    existing_params.update(utm_params)
    new_query = urlencode(existing_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def generate_qr_code(
    url: str,
    size: int = 300,
    border: int = 2,
) -> str:
    """Generate a QR code as a base64-encoded PNG data URI.
    
    Returns a data URI string suitable for embedding in HTML: 
    data:image/png;base64,...
    """
    qr = qrcode.QRCode(
        version=None,  # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
    )
    
    # Resize to target dimensions
    img = img.resize((size, size))

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    b64 = base64.b64encode(buffer.read()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def resolve_qr_destination(form_data: dict, locale: str = "") -> str:
    """Resolve QR code destination: Aidaform first, fallback to job posting.
    
    Priority:
    1. ada_form_url from form_data (if exists)
    2. Locale-specific link from locale_links
    3. Generic job posting URL
    """
    # Priority 1: Aidaform
    ada_form_url = form_data.get("ada_form_url", "")
    if ada_form_url:
        return ada_form_url
    
    # Priority 2: Locale-specific link
    locale_links = form_data.get("locale_links", [])
    if locale_links:
        for link in locale_links:
            if link.get("label", "").lower() == locale.lower():
                return link["url"]
        # Fallback: first locale link
        if locale_links[0].get("url"):
            return locale_links[0]["url"]
    
    # Priority 3: WP job post URL (set by Stage 1)
    wp_url = form_data.get("wp_url", "")
    if wp_url:
        return wp_url
    
    return "https://www.oneforma.com/apply"
```

- [ ] **Step 3: Commit**

```bash
git add worker/utils/qr_generator.py worker/requirements-docker.txt
git commit -m "feat: add QR code generator with UTM tracking for flyers"
```

---

### Task 8: Stage 3 Organic Copy Generation

**Files:**
- Create: `worker/pipeline/stage3_organic_copy.py`

- [ ] **Step 1: Create organic copy generation stage**

```python
"""Stage 3 Organic: Generate copy for WP posts, job portals, flyers, and social captions.

Produces 4 asset types per persona × locale:
- wp_job_post: Full WordPress job post body
- job_portal_copy: Platform-adapted copy for Indeed, LinkedIn Jobs, Glassdoor
- flyer_copy: Concise headline + body for print flyers
- social_caption: Per-platform captions (LinkedIn, IG, Facebook, Twitter/X)
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ai.nim_client import generate_text
from neon_client import save_generated_asset, get_intake_request

logger = logging.getLogger(__name__)

# Job portal platforms to generate copy for
JOB_PORTALS = ["indeed", "linkedin_jobs", "glassdoor"]

# Social platforms for captions
SOCIAL_PLATFORMS = ["linkedin", "instagram", "facebook", "twitter"]

ORGANIC_COPY_SYSTEM = """You are an expert recruitment copywriter for OneForma, a global data annotation and AI training platform.
You write authentic, specific job postings and social content that speaks directly to the candidate persona.
Never use generic corporate language. Always include specific details about the work, requirements, and what makes this opportunity unique.
Use the cultural research and persona psychology to adapt tone and framing per locale."""


async def run_stage3_organic(context: dict) -> dict:
    """Generate organic copy assets: WP posts, portal copy, flyer copy, social captions."""
    request_id: str = context["request_id"]
    request = await get_intake_request(request_id)
    personas = context.get("personas", [])
    cultural_research = context.get("cultural_research", {})
    brief = context.get("brief", {})
    country = context.get("country", "")
    form_data = context.get("form_data", request.get("form_data", {}))
    
    target_regions = context.get("target_regions", request.get("target_regions", []))
    if country:
        target_regions = [country]

    copy_count = 0

    for persona in personas:
        persona_name = persona.get("label", persona.get("name", "Unknown"))
        persona_key = persona.get("key", persona_name.lower().replace(" ", "_"))
        
        for region in target_regions:
            region_research = cultural_research.get(region, {})
            language = _get_language_for_region(region)

            # 1. WordPress Job Post
            wp_copy = await _generate_wp_post(
                request, persona, region_research, brief, language, region
            )
            if wp_copy:
                await save_generated_asset(
                    request_id=request_id,
                    asset_type="wp_job_post",
                    platform="wordpress",
                    format="text",
                    language=language,
                    country=region,
                    content=wp_copy,
                    copy_data={"persona_key": persona_key, "persona_name": persona_name},
                    stage=3,
                )
                copy_count += 1

            # 2. Job Portal Copy (per portal)
            for portal in JOB_PORTALS:
                portal_copy = await _generate_portal_copy(
                    request, persona, region_research, brief, language, region, portal
                )
                if portal_copy:
                    await save_generated_asset(
                        request_id=request_id,
                        asset_type="job_portal_copy",
                        platform=portal,
                        format="text",
                        language=language,
                        country=region,
                        content=portal_copy,
                        copy_data={"persona_key": persona_key, "persona_name": persona_name, "portal": portal},
                        stage=3,
                    )
                    copy_count += 1

            # 3. Flyer Copy
            flyer_copy = await _generate_flyer_copy(
                request, persona, region_research, brief, language, region
            )
            if flyer_copy:
                await save_generated_asset(
                    request_id=request_id,
                    asset_type="flyer_copy",
                    platform="print",
                    format="text",
                    language=language,
                    country=region,
                    content=flyer_copy,
                    copy_data={"persona_key": persona_key, "persona_name": persona_name},
                    stage=3,
                )
                copy_count += 1

            # 4. Social Captions (per platform)
            for social_platform in SOCIAL_PLATFORMS:
                caption = await _generate_social_caption(
                    request, persona, region_research, brief, language, region, social_platform
                )
                if caption:
                    await save_generated_asset(
                        request_id=request_id,
                        asset_type="social_caption",
                        platform=social_platform,
                        format="text",
                        language=language,
                        country=region,
                        content=caption,
                        copy_data={"persona_key": persona_key, "persona_name": persona_name, "platform": social_platform},
                        stage=3,
                    )
                    copy_count += 1

    logger.info("Stage 3 Organic complete: %d copy assets generated", copy_count)
    return {"copy_count": copy_count}


async def _generate_wp_post(
    request: dict, persona: dict, research: dict, brief: dict, language: str, region: str
) -> dict | None:
    """Generate a full WordPress job post."""
    prompt = f"""Write a complete job posting for WordPress.

JOB TITLE: {request.get('title', 'Untitled')}
PERSONA: {persona.get('label', '')} — {persona.get('psychology', {}).get('core_motivation', '')}
REGION: {region}
LANGUAGE: {language}
CULTURAL CONTEXT: {json.dumps(research.get('communication_style', {}), default=str)[:500]}
BRIEF: {brief.get('campaign_objective', '')}

REQUIREMENTS FROM JOB:
- Qualifications: {request.get('qualifications_required', 'Not specified')}
- Location: {request.get('location_scope', 'Remote')}
- Engagement: {request.get('engagement_model', 'Flexible')}

Output JSON with these fields:
{{
  "title": "Job post title (compelling, not generic)",
  "intro": "Opening paragraph (2-3 sentences, hooks the persona)",
  "what_youll_do": "Description of the work (3-5 bullet points)",
  "requirements": "What we're looking for (3-5 bullet points)",
  "benefits": "Why join (3-4 bullet points, speak to persona motivations)",
  "cta": "Call to action (1 sentence, specific next step)",
  "meta_description": "SEO meta description (under 160 chars)"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("WP post generation failed for %s/%s: %s", persona.get("label"), region, e)
        return None


async def _generate_portal_copy(
    request: dict, persona: dict, research: dict, brief: dict,
    language: str, region: str, portal: str
) -> dict | None:
    """Generate job portal-specific copy (Indeed, LinkedIn Jobs, Glassdoor)."""
    char_limits = {"indeed": 4000, "linkedin_jobs": 2000, "glassdoor": 3000}
    limit = char_limits.get(portal, 3000)

    prompt = f"""Write a job posting optimized for {portal.replace('_', ' ').title()}.

JOB: {request.get('title', 'Untitled')}
PERSONA TARGET: {persona.get('label', '')}
REGION: {region} | LANGUAGE: {language}
CHARACTER LIMIT: {limit} chars
PLATFORM STYLE: {"Concise, keyword-rich" if portal == "indeed" else "Professional, detailed" if portal == "linkedin_jobs" else "Transparent, culture-focused"}

REQUIREMENTS: {request.get('qualifications_required', '')}
ENGAGEMENT: {request.get('engagement_model', 'Flexible')}

Output JSON:
{{
  "title": "Platform-optimized title",
  "body": "Full posting body (within char limit)",
  "keywords": ["relevant", "search", "keywords"],
  "salary_text": "Compensation description (if applicable)"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("Portal copy failed for %s/%s/%s: %s", portal, persona.get("label"), region, e)
        return None


async def _generate_flyer_copy(
    request: dict, persona: dict, research: dict, brief: dict, language: str, region: str
) -> dict | None:
    """Generate concise flyer copy (headline + body + CTA for print layout)."""
    prompt = f"""Write flyer copy for a recruitment flyer. Must be CONCISE — this is print.

JOB: {request.get('title', 'Untitled')}
PERSONA: {persona.get('label', '')} — motivated by: {persona.get('psychology', {}).get('core_motivation', '')}
REGION: {region} | LANGUAGE: {language}
CULTURAL TONE: {research.get('communication_style', {}).get('tone', 'professional')}

Output JSON:
{{
  "headline": "Bold headline (max 8 words)",
  "subheadline": "Supporting line (max 15 words)",
  "body": "Key info (2-3 short bullet points or sentences, max 50 words total)",
  "cta": "Action phrase (max 5 words, e.g., 'Scan to Apply Now')",
  "qr_label": "Text below QR code (e.g., 'Scan for details')"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("Flyer copy failed for %s/%s: %s", persona.get("label"), region, e)
        return None


async def _generate_social_caption(
    request: dict, persona: dict, research: dict, brief: dict,
    language: str, region: str, platform: str
) -> dict | None:
    """Generate a social media caption for a specific platform."""
    platform_guidance = {
        "linkedin": "Professional but human. 1-3 short paragraphs. Emojis sparingly. End with a question or CTA. Include 3-5 hashtags.",
        "instagram": "Casual, visual-first language. Short punchy sentences. Include 10-15 hashtags at the end. Use relevant emojis.",
        "facebook": "Conversational, community-oriented. Medium length. 1-2 hashtags max. Include a clear CTA.",
        "twitter": "Under 280 chars. Punchy, direct. 1-2 hashtags. Include link placeholder [LINK].",
    }

    prompt = f"""Write a social media caption for {platform.title()}.

JOB: {request.get('title', 'Untitled')}
PERSONA TARGET: {persona.get('label', '')}
REGION: {region} | LANGUAGE: {language}
PLATFORM STYLE: {platform_guidance.get(platform, 'Professional and engaging')}
BRAND VOICE: OneForma — global, inclusive, opportunity-focused

Output JSON:
{{
  "caption": "The full caption text",
  "hashtags": ["hashtag1", "hashtag2"],
  "cta_type": "link_in_bio|swipe_up|comment|dm"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("Social caption failed for %s/%s/%s: %s", platform, persona.get("label"), region, e)
        return None


def _get_language_for_region(region: str) -> str:
    """Map region/country to primary professional language."""
    REGION_LANGUAGES = {
        "BR": "pt", "MX": "es", "ES": "es", "AR": "es", "CO": "es",
        "JP": "ja", "KR": "ko", "CN": "zh", "TW": "zh",
        "DE": "de", "FR": "fr", "IT": "it", "NL": "nl",
        "SA": "ar", "AE": "ar", "EG": "ar",
        "IN": "en", "PH": "en", "NG": "en", "KE": "en",
        "TR": "tr", "PL": "pl", "RU": "ru", "UA": "uk",
        "TH": "th", "VN": "vi", "ID": "id", "MY": "ms",
    }
    return REGION_LANGUAGES.get(region.upper(), "en")


def _extract_json(text: str) -> str:
    """Extract JSON from LLM response (handles markdown fences)."""
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()
```

- [ ] **Step 2: Commit**

```bash
git add worker/pipeline/stage3_organic_copy.py
git commit -m "feat: add Stage 3 organic copy generation (WP, portals, flyers, social)"
```

---

### Task 9: Stage 4 Organic Composition (Social Graphics + Flyers with QR)

**Files:**
- Create: `worker/pipeline/stage4_organic_compose.py`

- [ ] **Step 1: Create organic composition stage**

```python
"""Stage 4 Organic: Compose social graphics and flyers with QR codes.

Produces layered HTML compositions (same engine as paid carousel panels)
for social media posts and print flyers. Flyers include auto-generated
QR codes linking to Aidaform (with UTM) or job posting page.

All outputs are saved as design_artifacts for designer portal + Figma export.
"""
from __future__ import annotations

import logging
import asyncio
from typing import Any

from ai.nim_client import generate_text
from neon_client import (
    get_actors,
    get_intake_request,
    save_generated_asset,
    get_generated_assets,
)
from config import COMPOSE_CONCURRENCY

logger = logging.getLogger(__name__)

# Platforms for organic social graphics
ORGANIC_SOCIAL_PLATFORMS = [
    {"name": "linkedin_feed", "width": 1200, "height": 627},
    {"name": "ig_feed", "width": 1080, "height": 1080},
    {"name": "ig_story", "width": 1080, "height": 1920},
    {"name": "facebook_feed", "width": 1200, "height": 630},
]

# Flyer format
FLYER_FORMAT = {"name": "flyer_a4", "width": 2480, "height": 3508}  # A4 at 300dpi

COMPOSE_SYSTEM = """You are a senior graphic designer creating layered HTML compositions for recruitment marketing.
Output ONLY valid HTML that uses inline styles. The HTML will be rendered as a static image.
Use modern design principles: strong typography hierarchy, generous whitespace, brand colors.
OneForma brand: gradient accent (blue #0693E3 to purple #9B51E0), dark text on light backgrounds.
All text must be real content from the provided copy — never use placeholder text."""


async def run_stage4_organic(context: dict) -> dict:
    """Generate organic social graphics and flyers with QR codes."""
    request_id: str = context["request_id"]
    request = await get_intake_request(request_id)
    form_data = context.get("form_data", request.get("form_data", {}))
    country = context.get("country", "")
    target_regions = context.get("target_regions", [])
    if country:
        target_regions = [country]

    # Load actors
    actors = context.get("actors", [])
    if not actors:
        actors = await get_actors(request_id)
        context["actors"] = actors

    # Load organic copy assets for this request
    all_assets = await get_generated_assets(request_id)
    social_captions = [a for a in all_assets if a.get("asset_type") == "social_caption"]
    flyer_copies = [a for a in all_assets if a.get("asset_type") == "flyer_copy"]

    # Load design direction
    design_direction = context.get("design_direction", {})
    brief = context.get("brief", {})

    semaphore = asyncio.Semaphore(COMPOSE_CONCURRENCY)
    tasks = []
    asset_count = 0

    # ── Social Graphics ──
    for actor in actors[:3]:  # Max 3 actors
        actor_photo = actor.get("photo_url") or actor.get("blob_url", "")
        for platform_spec in ORGANIC_SOCIAL_PLATFORMS:
            # Find matching caption
            caption_asset = _find_caption(social_captions, platform_spec["name"], country)
            
            tasks.append(_compose_social_graphic(
                semaphore, request_id, actor, platform_spec,
                caption_asset, design_direction, brief, form_data
            ))

    # ── Flyers with QR Code ──
    for actor in actors[:2]:  # Max 2 actors for flyers
        for region in target_regions:
            flyer_copy = _find_flyer_copy(flyer_copies, region)
            
            tasks.append(_compose_flyer(
                semaphore, request_id, actor, flyer_copy,
                design_direction, brief, form_data, region
            ))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    asset_count = sum(1 for r in results if isinstance(r, int) and r > 0)

    logger.info("Stage 4 Organic complete: %d compositions generated", asset_count)
    return {"asset_count": asset_count}


async def _compose_social_graphic(
    semaphore: asyncio.Semaphore,
    request_id: str,
    actor: dict,
    platform_spec: dict,
    caption_asset: dict | None,
    design_direction: dict,
    brief: dict,
    form_data: dict,
) -> int:
    """Compose a single social graphic via GLM-5."""
    async with semaphore:
        platform_name = platform_spec["name"]
        width = platform_spec["width"]
        height = platform_spec["height"]
        
        actor_name = actor.get("persona_label", "Unknown")
        actor_photo = actor.get("photo_url") or actor.get("blob_url", "")
        
        caption_text = ""
        if caption_asset and caption_asset.get("content"):
            content = caption_asset["content"]
            if isinstance(content, str):
                import json
                content = json.loads(content)
            caption_text = content.get("caption", "")

        prompt = f"""Create an HTML composition for an organic social media post.

PLATFORM: {platform_name} ({width}x{height}px)
ACTOR PHOTO URL: {actor_photo}
ACTOR PERSONA: {actor_name}
CAPTION PREVIEW: {caption_text[:200]}
JOB TITLE: {form_data.get('title', brief.get('campaign_objective', 'Join Our Team'))}
DESIGN DIRECTION: {design_direction.get('visual_world', 'Modern, clean, professional')}

Requirements:
- Dimensions: {width}x{height}px (set on root element)
- Include actor photo as a prominent visual element (use img tag with src)
- Overlay key text from the caption (headline or hook only, not full caption)
- OneForma brand gradient accent
- Must be visually complete — no placeholder images or text
- Include subtle OneForma logo text in corner

Output ONLY the HTML (no markdown fences, no explanation)."""

        try:
            from ai.nim_client import generate_text as gen
            html_result = await gen(COMPOSE_SYSTEM, prompt, model="glm5")
            
            # Save as social_graphic asset
            await save_generated_asset(
                request_id=request_id,
                asset_type="social_graphic",
                platform=platform_name,
                format="html",
                language="en",
                country=caption_asset.get("country", "") if caption_asset else "",
                content={"html": html_result, "width": width, "height": height},
                copy_data={"actor_id": actor.get("id"), "persona": actor_name},
                stage=4,
            )
            return 1
        except Exception as e:
            logger.warning("Social graphic failed for %s/%s: %s", actor_name, platform_name, e)
            return 0


async def _compose_flyer(
    semaphore: asyncio.Semaphore,
    request_id: str,
    actor: dict,
    flyer_copy: dict | None,
    design_direction: dict,
    brief: dict,
    form_data: dict,
    region: str,
) -> int:
    """Compose a flyer with QR code via GLM-5."""
    async with semaphore:
        import json
        from utils.qr_generator import generate_qr_code, resolve_qr_destination, build_tracked_url

        actor_name = actor.get("persona_label", "Unknown")
        actor_photo = actor.get("photo_url") or actor.get("blob_url", "")
        campaign_slug = form_data.get("campaign_slug", request_id[:8])
        
        # Generate QR code
        destination = resolve_qr_destination(form_data, region)
        tracked_url = build_tracked_url(destination, campaign_slug, region)
        qr_data_uri = generate_qr_code(tracked_url, size=200)

        # Extract flyer copy
        copy_content = {}
        if flyer_copy and flyer_copy.get("content"):
            copy_content = flyer_copy["content"]
            if isinstance(copy_content, str):
                copy_content = json.loads(copy_content)

        headline = copy_content.get("headline", "Join Our Global Team")
        subheadline = copy_content.get("subheadline", "")
        body = copy_content.get("body", "")
        cta = copy_content.get("cta", "Scan to Apply")
        qr_label = copy_content.get("qr_label", "Scan for details")

        prompt = f"""Create an HTML composition for a print recruitment flyer (A4 size).

DIMENSIONS: 2480x3508px (A4 at 300dpi)
ACTOR PHOTO URL: {actor_photo}
QR CODE IMAGE: {qr_data_uri}

COPY:
- Headline: {headline}
- Subheadline: {subheadline}
- Body: {body}
- CTA: {cta}
- QR Label: {qr_label}

DESIGN DIRECTION: {design_direction.get('visual_world', 'Modern, clean, professional')}

Requirements:
- Root element: 2480x3508px
- Hero section with actor photo (top 40%)
- Copy section in middle (headline large, body readable)
- QR code section at bottom (embed the QR as an img tag with the data URI src)
- Text below QR: "{qr_label}"
- OneForma branding: gradient accent bar, logo text
- Print-ready: high contrast, no thin fonts, clear hierarchy
- MUST include the QR code img element with src="{qr_data_uri}"

Output ONLY the HTML."""

        try:
            from ai.nim_client import generate_text as gen
            html_result = await gen(COMPOSE_SYSTEM, prompt, model="glm5")
            
            await save_generated_asset(
                request_id=request_id,
                asset_type="flyer",
                platform="print",
                format="html",
                language=_get_language_for_region(region),
                country=region,
                content={
                    "html": html_result,
                    "width": 2480,
                    "height": 3508,
                    "qr_url": tracked_url,
                    "qr_destination": destination,
                },
                copy_data={
                    "actor_id": actor.get("id"),
                    "persona": actor_name,
                    "headline": headline,
                    "cta": cta,
                },
                stage=4,
            )
            return 1
        except Exception as e:
            logger.warning("Flyer composition failed for %s/%s: %s", actor_name, region, e)
            return 0


def _find_caption(captions: list, platform_name: str, country: str) -> dict | None:
    """Find a matching social caption asset."""
    # Map composition platform to caption platform
    platform_map = {
        "linkedin_feed": "linkedin",
        "ig_feed": "instagram",
        "ig_story": "instagram",
        "facebook_feed": "facebook",
    }
    target = platform_map.get(platform_name, platform_name)
    
    for c in captions:
        if c.get("platform") == target:
            if not country or c.get("country") == country:
                return c
    # Fallback: any caption for this platform
    for c in captions:
        if c.get("platform") == target:
            return c
    return None


def _find_flyer_copy(copies: list, region: str) -> dict | None:
    """Find flyer copy for a specific region."""
    for c in copies:
        if c.get("country") == region:
            return c
    return copies[0] if copies else None


def _get_language_for_region(region: str) -> str:
    """Map region to language code."""
    REGION_LANGUAGES = {
        "BR": "pt", "MX": "es", "ES": "es", "JP": "ja", "KR": "ko",
        "DE": "de", "FR": "fr", "IN": "en", "PH": "en",
    }
    return REGION_LANGUAGES.get(region.upper(), "en")
```

- [ ] **Step 2: Commit**

```bash
git add worker/pipeline/stage4_organic_compose.py
git commit -m "feat: add Stage 4 organic composition (social graphics + flyers with QR)"
```

---

### Task 10: Frontend — Organic Materials Section

**Files:**
- Create: `src/components/campaign/OrganicMaterials.tsx`

- [ ] **Step 1: Create the Organic Materials component**

```typescript
'use client';

import { useState } from 'react';
import { FileText, Image, Printer, Link2, Copy, Check, Download } from 'lucide-react';

interface Asset {
  id: string;
  asset_type: string;
  platform: string;
  language: string;
  country: string;
  content: Record<string, unknown>;
  copy_data: Record<string, unknown>;
  blob_url?: string;
}

interface OrganicMaterialsProps {
  assets: Asset[];
  requestId: string;
}

const TABS = [
  { key: 'job_posts', label: 'Job Posts', icon: FileText },
  { key: 'social', label: 'Social', icon: Image },
  { key: 'flyers', label: 'Flyers', icon: Printer },
  { key: 'links', label: 'Tracked Links', icon: Link2 },
] as const;

export function OrganicMaterials({ assets, requestId }: OrganicMaterialsProps) {
  const [activeTab, setActiveTab] = useState<string>('job_posts');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const wpPosts = assets.filter(a => a.asset_type === 'wp_job_post');
  const portalCopy = assets.filter(a => a.asset_type === 'job_portal_copy');
  const socialGraphics = assets.filter(a => a.asset_type === 'social_graphic');
  const socialCaptions = assets.filter(a => a.asset_type === 'social_caption');
  const flyers = assets.filter(a => a.asset_type === 'flyer');
  const flyerCopies = assets.filter(a => a.asset_type === 'flyer_copy');

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#E5E5E5] pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#32373C] text-white'
                  : 'text-[#737373] hover:bg-[#F5F5F5]'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'job_posts' && (
        <JobPostsTab wpPosts={wpPosts} portalCopy={portalCopy} onCopy={handleCopy} copiedId={copiedId} />
      )}
      {activeTab === 'social' && (
        <SocialTab graphics={socialGraphics} captions={socialCaptions} onCopy={handleCopy} copiedId={copiedId} />
      )}
      {activeTab === 'flyers' && (
        <FlyersTab flyers={flyers} flyerCopies={flyerCopies} />
      )}
      {activeTab === 'links' && (
        <TrackedLinksTab requestId={requestId} onCopy={handleCopy} copiedId={copiedId} />
      )}
    </div>
  );
}

function JobPostsTab({ wpPosts, portalCopy, onCopy, copiedId }: {
  wpPosts: Asset[]; portalCopy: Asset[];
  onCopy: (text: string, id: string) => void; copiedId: string | null;
}) {
  return (
    <div className="space-y-4">
      {wpPosts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">WordPress Posts</h4>
          <div className="grid gap-3">
            {wpPosts.map(asset => {
              const content = asset.content as Record<string, string>;
              return (
                <div key={asset.id} className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium">{content.title || 'Untitled Post'}</h5>
                    <span className="badge">{asset.country}</span>
                  </div>
                  <p className="text-sm text-[#737373] mb-2">{content.intro}</p>
                  <button
                    onClick={() => onCopy(JSON.stringify(content, null, 2), asset.id)}
                    className="btn-secondary text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === asset.id ? 'Copied' : 'Copy All'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {portalCopy.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">Job Portal Copy</h4>
          <div className="grid gap-3">
            {portalCopy.map(asset => {
              const content = asset.content as Record<string, string>;
              return (
                <div key={asset.id} className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="badge">{asset.platform}</span>
                    <span className="text-xs text-[#737373]">{asset.country}</span>
                  </div>
                  <p className="text-sm text-[#1A1A1A]">{content.title}</p>
                  <button
                    onClick={() => onCopy(content.body || JSON.stringify(content), asset.id)}
                    className="btn-secondary text-xs flex items-center gap-1 mt-2 cursor-pointer"
                  >
                    {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                    Copy
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SocialTab({ graphics, captions, onCopy, copiedId }: {
  graphics: Asset[]; captions: Asset[];
  onCopy: (text: string, id: string) => void; copiedId: string | null;
}) {
  return (
    <div className="space-y-4">
      {graphics.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">Social Graphics</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {graphics.map(asset => {
              const content = asset.content as Record<string, unknown>;
              return (
                <div key={asset.id} className="card p-3">
                  <div className="aspect-square bg-[#F5F5F5] rounded-lg mb-2 overflow-hidden">
                    {content.html && (
                      <iframe
                        srcDoc={content.html as string}
                        className="w-full h-full border-0 pointer-events-none"
                        sandbox=""
                      />
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#737373]">{asset.platform}</span>
                    <span className="badge text-xs">{asset.country}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {captions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#1A1A1A] mb-2">Captions</h4>
          <div className="grid gap-3">
            {captions.map(asset => {
              const content = asset.content as Record<string, string>;
              const caption = content.caption || '';
              return (
                <div key={asset.id} className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="badge">{asset.platform}</span>
                    <span className="text-xs text-[#737373]">{asset.country}</span>
                  </div>
                  <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{caption.slice(0, 200)}{caption.length > 200 ? '...' : ''}</p>
                  <button
                    onClick={() => onCopy(caption, asset.id)}
                    className="btn-secondary text-xs flex items-center gap-1 mt-2 cursor-pointer"
                  >
                    {copiedId === asset.id ? <Check size={12} /> : <Copy size={12} />}
                    Copy Caption
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FlyersTab({ flyers, flyerCopies }: { flyers: Asset[]; flyerCopies: Asset[] }) {
  return (
    <div className="space-y-4">
      {flyers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {flyers.map(asset => {
            const content = asset.content as Record<string, unknown>;
            return (
              <div key={asset.id} className="card p-4">
                <div className="aspect-[3/4] bg-[#F5F5F5] rounded-lg mb-3 overflow-hidden">
                  {content.html && (
                    <iframe
                      srcDoc={content.html as string}
                      className="w-full h-full border-0 pointer-events-none"
                      sandbox=""
                    />
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="badge">{asset.country}</span>
                    <span className="text-xs text-[#737373] ml-2">QR → {(content.qr_destination as string)?.slice(0, 40)}...</span>
                  </div>
                  <button className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-[#737373]">No flyers generated yet.</p>
      )}
    </div>
  );
}

function TrackedLinksTab({ requestId, onCopy, copiedId }: {
  requestId: string;
  onCopy: (text: string, id: string) => void; copiedId: string | null;
}) {
  // This will fetch from /api/tracked-links?request_id=...
  // For now, show placeholder that will be wired up
  return (
    <div className="card p-4">
      <p className="text-sm text-[#737373]">Tracked links per locale will appear here after generation.</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign/OrganicMaterials.tsx
git commit -m "feat: add OrganicMaterials frontend component with tabs"
```

---

### Task 11: Wire Organic Materials into Campaign Workspace

**Files:**
- Modify: Campaign workspace page (find the page that renders section pills)

- [ ] **Step 1: Find and update the campaign workspace**

Locate the campaign detail/workspace page. Add "Organic Materials" to the section pills, conditionally showing it. Import and render `OrganicMaterials` when the organic tab is active.

Filter assets by organic types:
```typescript
const organicAssetTypes = ['wp_job_post', 'job_portal_copy', 'flyer', 'flyer_copy', 'social_caption', 'social_graphic'];
const organicAssets = assets.filter(a => organicAssetTypes.includes(a.asset_type));
```

- [ ] **Step 2: Conditionally hide paid sections based on pipeline_mode**

If `pipeline_mode === 'organic'`, hide: Media Strategy, Paid Creatives, Channel Mix, Videos section pills.

- [ ] **Step 3: Add "Request Paid Media" button for lead_recruiter**

Show a button visible only to `lead_recruiter` or `admin` roles when `pipeline_mode === 'organic'` and status is `'review'` or `'approved'`:

```typescript
{canRequestPaid && pipelineMode === 'organic' && ['review', 'approved'].includes(status) && (
  <button onClick={handleRequestPaid} className="btn-primary flex items-center gap-2 cursor-pointer">
    <TrendingUp size={16} />
    Request Paid Media
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/campaign/ src/app/
git commit -m "feat: wire OrganicMaterials into workspace, add Request Paid button"
```

---

### Task 12: Pipeline Mode Badge + Dashboard Filters

**Files:**
- Modify: `src/components/StatusBadge.tsx` (or create PipelineModeBadge)
- Modify: Dashboard/campaign list component

- [ ] **Step 1: Create PipelineModeBadge component**

Add to `src/components/StatusBadge.tsx` or create alongside:

```typescript
export function PipelineModeBadge({ mode }: { mode: 'organic' | 'full' }) {
  if (mode === 'full') {
    return (
      <span className="badge badge-sent text-xs">organic + paid</span>
    );
  }
  return (
    <span className="badge text-xs">organic</span>
  );
}
```

- [ ] **Step 2: Add badge to campaign cards in dashboard**

In the campaign list component, render `PipelineModeBadge` next to the existing `StatusBadge`.

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat: add pipeline mode badge to campaign cards"
```

---

### Task 13: Integration Test — Full Organic Pipeline

**Files:**
- Test manually via the running app

- [ ] **Step 1: Start dev server and worker**

```bash
npm run dev &
cd worker && python main.py
```

- [ ] **Step 2: Submit a new organic intake request**

Fill out the intake wizard. Verify:
- `pipeline_mode = 'organic'` in the database
- compute_job created with `job_type = 'generate'` or `'generate_country'`
- No media strategy fields in the form

- [ ] **Step 3: Verify worker runs organic pipeline**

Watch worker logs. Confirm:
- Stage 1 runs WITHOUT media strategy (log: "ORGANIC mode — skipping media strategy generation")
- Stage 2 runs normally (actors + images generated)
- Stage 3 runs organic copy (log: "Stage 3 Organic complete: N copy assets generated")
- Stage 4 runs organic compositions (log: "Stage 4 Organic complete: N compositions generated")
- Stages 5 + 6 are NOT run
- Status moves to 'review'

- [ ] **Step 4: Verify assets in database**

Check generated_assets for new types: `wp_job_post`, `job_portal_copy`, `flyer_copy`, `social_caption`, `social_graphic`, `flyer`

- [ ] **Step 5: Verify frontend rendering**

Navigate to the campaign workspace. Confirm:
- "Organic Materials" section pill is visible
- Job Posts tab shows WP post + portal copy
- Social tab shows graphics + captions
- Flyers tab shows flyer compositions with QR codes
- Media Strategy / Paid Creatives / Videos are hidden

- [ ] **Step 6: Commit any fixes discovered during testing**

```bash
git add -A
git commit -m "fix: integration test fixes for organic pipeline"
```

---

### Task 14: Integration Test — Paid Upgrade Flow

- [ ] **Step 1: Assign lead_recruiter role to test user**

```sql
UPDATE user_roles SET role = 'lead_recruiter' WHERE email = 'steven.junop@centific.com';
```

- [ ] **Step 2: Click "Request Paid Media" on the organic campaign**

Verify:
- Modal shows auto-calculated budget
- Platform checkboxes default to all
- Submitting calls POST /api/intake/[id]/request-paid
- Response: 200 with job_id

- [ ] **Step 3: Verify paid pipeline runs**

Watch worker logs:
- `generate_paid` job picked up
- Media strategy generated
- Paid ad copy generated (Stage 3 in paid mode)
- Paid compositions generated (Stage 4 in paid mode)
- Video generation attempted (Stage 5)
- Landing page generated (Stage 6)

- [ ] **Step 4: Verify frontend shows paid sections**

After paid generation completes:
- Pipeline mode badge shows "organic + paid"
- Media Strategy, Paid Creatives, Videos pills now visible
- Organic Materials section still shows organic assets

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes for paid upgrade flow"
```
