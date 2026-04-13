# Organic Carousel Content — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 12 organic carousels per campaign (3 personas × 2 platforms × 2 variations) with recruiter-voice captions, displayed in a platform-authentic preview UI for recruiters, with organic/paid separation in the designer dashboard + gallery + Figma integration.

**Architecture:** Three phases executed sequentially — each produces working software:
1. **Pipeline** (Tasks 1-4): Caption prompt, organic orchestrator calling existing carousel engine, drift validator, schema update
2. **Recruiter UI** (Tasks 5-7): Organic tab with platform sub-tabs and carousel preview cards
3. **Designer UI** (Tasks 8-10): Dashboard organic/paid split, gallery tabs, Figma distribution-aware push

**Tech Stack:** Python 3.13 (worker), NVIDIA NIM Gemma 4 31B (captions), React/Next.js 16 (UI), Neon Postgres (storage), Vercel Blob (slides)

---

## File Structure

| File | Responsibility |
|---|---|
| `worker/prompts/organic_caption_copy.py` | Gemma 4 prompt for recruiter-voice captions (LinkedIn + IG formats). Drift prevention via template variables. |
| `worker/pipeline/organic_caption_validator.py` | Deterministic caption validator — checks compensation, qualifications, work mode claims. |
| `worker/pipeline/stage4_organic_carousel.py` | Orchestrator — calls existing carousel engine with 12-cap guardrail (3 personas × 2 platforms × 2 variations), generates captions, validates, saves as `organic_carousel`. |
| `worker/pipeline/orchestrator.py` | MODIFY — call organic carousel after existing carousel step. |
| `src/lib/db/schema.ts` | MODIFY — add `'organic_carousel'` to asset_type CHECK. |
| `src/components/recruiter/OrganicTab.tsx` | Platform-tabbed organic content view (LinkedIn / Instagram sub-tabs). |
| `src/components/recruiter/CarouselPreviewCard.tsx` | Platform-authentic post mockup (LinkedIn or IG frame) with slides, caption, copy/download buttons. |
| `src/components/recruiter/RecruiterWorkspace.tsx` | MODIFY — add Organic tab alongside existing tabs. |
| `src/components/designer/dashboard/DesignerDashboard.tsx` | MODIFY — split work items by distribution (organic first with pink accent). |
| `src/components/designer/dashboard/WorkItemRow.tsx` | MODIFY — add ORGANIC/PAID badge pill. |
| `src/components/designer/gallery/DesignerGallery.tsx` | MODIFY — add top-level Organic/Paid tabs. |
| `src/components/designer/figma/PushToFigmaButton.tsx` | MODIFY — add "Push All Organic" / "Push All Paid" options. |

---

## Phase 1: Pipeline (Tasks 1-4)

### Task 1: Organic Caption Prompt

Gemma 4 generates recruiter-voice captions. Template variables for hard facts — compensation, qualifications, work mode are NEVER rewritten.

**Files:**
- Create: `worker/prompts/organic_caption_copy.py`

- [ ] **Step 1: Create the prompt**

```python
"""Organic caption copy — Gemma 4 31B.

Generates recruiter-voice captions for LinkedIn and Instagram organic posts.
This is a RECRUITER posting on their personal account — first person,
peer-to-peer, warm but professional.

Hard facts (compensation, qualifications, location) are injected as
template variables and must appear EXACTLY as provided.
"""
from __future__ import annotations

from typing import Any


ORGANIC_CAPTION_SYSTEM_PROMPT = """\
You are writing a social media post for a recruiter at OneForma. \
The recruiter is posting on their PERSONAL LinkedIn or Instagram account \
about a job opportunity. This is NOT a corporate brand post.

VOICE:
- First person: "We're looking for...", "I'm hiring...", "My team needs..."
- Peer-to-peer: talking to potential candidates as equals
- Casual-professional: warm, credible, human
- Enthusiastic but not fake — real recruiter energy

HARD RULES:
- Use the EXACT compensation amount provided — never rephrase or round
- List ONLY qualifications from the provided list — never invent requirements
- State the EXACT work mode — never say "remote" if it's onsite
- NEVER promise: "guaranteed income", "career growth", "life-changing opportunity"
- NEVER use corporate buzzwords: "leverage", "synergy", "paradigm"

OUTPUT: Plain text caption only. No JSON, no markdown.
"""


def build_linkedin_caption_prompt(
    form_data: dict[str, Any],
    persona: dict[str, Any],
    brief: dict[str, Any],
    variation: int,
    stage3_headline: str = "",
) -> str:
    """Build LinkedIn caption prompt for recruiter voice."""
    title = form_data.get("title", brief.get("title", ""))
    compensation = form_data.get("compensation_rate", "")
    comp_model = form_data.get("compensation_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location = form_data.get("location_scope", "Worldwide")
    quals = form_data.get("qualifications_required", "")
    engagement = form_data.get("engagement_model", "Flexible")

    comp_display = f"${compensation}" if compensation else ""
    if comp_model:
        comp_display += f" ({comp_model})"

    angle = "lead benefit and opportunity" if variation == 1 else "social proof and impact"

    return f"""\
Write a LinkedIn post for a recruiter sharing this job opportunity.
Angle: {angle}

JOB: {title}
COMPENSATION: {comp_display or "(mention 'competitive pay')"}
WORK MODE: {work_mode}
LOCATION: {location}
TIME: {engagement}
KEY REQUIREMENTS: {quals[:300] or "(flexible)"}
{f"HOOK INSPIRATION: {stage3_headline}" if stage3_headline else ""}

LINKEDIN FORMAT:
- 3-5 sentences, professional storytelling
- Open with a hook — who you're looking for
- Mention: {work_mode}, {comp_display or "pay details"}, flexibility
- Close with: "Tag someone who'd be a great fit!" or "DM me if interested"
- Add: "Link in comments 👇" (NOT in post body)
- NO hashtags (LinkedIn algorithm penalizes them in 2026)
- Keep under 200 words
"""


def build_ig_caption_prompt(
    form_data: dict[str, Any],
    persona: dict[str, Any],
    brief: dict[str, Any],
    variation: int,
    stage3_headline: str = "",
) -> str:
    """Build Instagram caption prompt for recruiter voice."""
    title = form_data.get("title", brief.get("title", ""))
    compensation = form_data.get("compensation_rate", "")
    comp_model = form_data.get("compensation_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location = form_data.get("location_scope", "Worldwide")
    quals = form_data.get("qualifications_required", "")

    comp_display = f"${compensation}" if compensation else ""
    if comp_model:
        comp_display += f" ({comp_model})"

    angle = "opportunity excitement" if variation == 1 else "community and impact"

    return f"""\
Write an Instagram caption for a recruiter posting about this job.
Angle: {angle}

JOB: {title}
COMPENSATION: {comp_display or "competitive"}
WORK MODE: {work_mode}
LOCATION: {location}
KEY REQUIREMENTS: {quals[:200] or "(flexible)"}
{f"HOOK INSPIRATION: {stage3_headline}" if stage3_headline else ""}

INSTAGRAM FORMAT:
- 2-3 punchy lines with emoji
- Key details: role, pay, work mode
- "Swipe for details →" (it's a carousel post)
- "Link in bio ✨" as CTA
- 5-8 relevant hashtags at the end (eg #NowHiring #RemoteWork #AIJobs)
- Keep under 100 words (before hashtags)
"""
```

- [ ] **Step 2: Verify it loads**

Run: `cd worker && python3.13 -c "from prompts.organic_caption_copy import ORGANIC_CAPTION_SYSTEM_PROMPT, build_linkedin_caption_prompt, build_ig_caption_prompt; print('OK:', len(ORGANIC_CAPTION_SYSTEM_PROMPT), 'chars')"`
Expected: `OK: <number> chars`

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/organic_caption_copy.py
git commit -m "feat(organic): add recruiter-voice caption prompts for LinkedIn + IG"
```

---

### Task 2: Caption Drift Validator

Deterministic checks on generated captions — catches compensation drift, qualification invention, work mode confusion.

**Files:**
- Create: `worker/pipeline/organic_caption_validator.py`

- [ ] **Step 1: Create the validator**

```python
"""Organic caption drift validator — deterministic, no LLM.

Scans generated recruiter captions for factual drift:
1. Dollar amounts must match source compensation
2. Work mode claims must match source
3. No forbidden promises (guaranteed income, career growth)

Returns (passed: bool, issues: list[str]).
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

FORBIDDEN_PHRASES = [
    "guaranteed income",
    "guaranteed pay",
    "career growth",
    "life-changing",
    "get rich",
    "unlimited earning",
    "no experience needed",
    "no skills required",
    "anyone can do",
]


def validate_caption(
    caption: str,
    hard_facts: dict[str, Any],
) -> tuple[bool, list[str]]:
    """Validate a recruiter caption against source data.

    Parameters
    ----------
    caption : str
        The generated caption text.
    hard_facts : dict
        Source data with compensation_amount, work_mode, qualifications_required.

    Returns
    -------
    tuple[bool, list[str]]
        (passed, issues)
    """
    issues: list[str] = []
    caption_lower = caption.lower()

    # ── 1. Compensation check ──
    compensation = str(hard_facts.get("compensation_amount", "")).strip()
    if compensation and compensation != "$":
        comp_clean = compensation.replace("$", "").replace(",", "").strip()
        if comp_clean:
            dollar_pattern = re.compile(r"\$[\d,]+(?:\.\d{2})?")
            found = dollar_pattern.findall(caption)
            for amount in found:
                amount_clean = amount.replace("$", "").replace(",", "").strip()
                if amount_clean and amount_clean != comp_clean:
                    issues.append(
                        f"Compensation drift: caption says '{amount}' but source is '{compensation}'"
                    )

    # ── 2. Work mode check ──
    work_mode = str(hard_facts.get("work_mode", "")).lower()
    if work_mode == "remote":
        onsite_signals = ["come to our office", "in-person required", "onsite only", "must be local"]
        for signal in onsite_signals:
            if signal in caption_lower:
                issues.append(f"Work mode drift: caption says '{signal}' but work_mode is 'remote'")
    elif work_mode == "onsite":
        remote_signals = ["work from home", "work from anywhere", "fully remote", "100% remote"]
        for signal in remote_signals:
            if signal in caption_lower:
                issues.append(f"Work mode drift: caption says '{signal}' but work_mode is 'onsite'")

    # ── 3. Forbidden promises ──
    for phrase in FORBIDDEN_PHRASES:
        if phrase in caption_lower:
            issues.append(f"Forbidden promise: caption contains '{phrase}'")

    passed = len(issues) == 0
    if passed:
        logger.info("Caption drift validation PASSED")
    else:
        logger.warning("Caption drift validation FAILED: %s", issues)

    return passed, issues
```

- [ ] **Step 2: Test the validator**

Run: `cd worker && python3.13 -c "
from pipeline.organic_caption_validator import validate_caption

# Should pass
p1, i1 = validate_caption('We are hiring! \$15/hr remote.', {'compensation_amount': '\$15', 'work_mode': 'remote'})
assert p1, f'Should pass: {i1}'

# Should fail — wrong amount
p2, i2 = validate_caption('Earn \$25/hr from home!', {'compensation_amount': '\$15', 'work_mode': 'remote'})
assert not p2, 'Should fail on compensation'

# Should fail — forbidden promise
p3, i3 = validate_caption('Guaranteed income working from home!', {'compensation_amount': '', 'work_mode': 'remote'})
assert not p3, 'Should fail on forbidden promise'

print('All 3 validator tests passed')
"`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/organic_caption_validator.py
git commit -m "feat(organic): add deterministic caption drift validator"
```

---

### Task 3: Organic Carousel Orchestrator

Calls existing carousel engine with 12-cap guardrail. Generates captions. Validates. Saves as `organic_carousel`.

**Files:**
- Create: `worker/pipeline/stage4_organic_carousel.py`

- [ ] **Step 1: Create the orchestrator**

```python
"""Organic carousel orchestrator — 12 carousels per campaign.

Guardrail: 3 personas × 2 platforms (LinkedIn + IG) × 2 variations = 12 max.
Reuses the existing carousel engine for slide generation.
Generates recruiter-voice captions via Gemma 4 31B.
Validates captions for drift before saving.

Saves as asset_type='organic_carousel' — separate from paid carousel_panel.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ai.local_llm import generate_copy
from neon_client import get_assets, save_asset
from pipeline.organic_caption_validator import validate_caption
from pipeline.stage4_carousel import _generate_carousel, CAROUSEL_PLATFORMS
from ai.compositor import PLATFORM_SPECS
from prompts.organic_caption_copy import (
    ORGANIC_CAPTION_SYSTEM_PROMPT,
    build_linkedin_caption_prompt,
    build_ig_caption_prompt,
)

logger = logging.getLogger(__name__)

# Only these platforms for organic v1
ORGANIC_PLATFORMS = ["linkedin_carousel", "ig_carousel"]
VARIATIONS_PER_PERSONA = 2
MAX_CAROUSELS = 12


async def run_organic_carousels(context: dict) -> dict:
    """Generate organic carousels with recruiter-voice captions.

    Returns dict with organic_carousel_count.
    """
    request_id = context["request_id"]
    actors = context.get("actors", [])
    brief = context.get("brief", {})
    personas = context.get("personas", brief.get("personas", []))
    form_data = context.get("form_data", {})

    if not personas:
        logger.warning("No personas — skipping organic carousel generation")
        return {"organic_carousel_count": 0}

    # Load Stage 3 copy for hook inspiration
    copy_assets = await get_assets(request_id, asset_type="copy")

    # Build hard facts for drift validation
    compensation = form_data.get("compensation_rate", "")
    hard_facts = {
        "compensation_amount": f"${compensation}" if compensation else "",
        "work_mode": form_data.get("work_mode", "remote"),
    }

    carousel_count = 0

    for persona in personas:
        persona_name = persona.get("persona_name", persona.get("name", "candidate"))
        persona_key = persona.get("archetype_key", persona_name)

        # Get best Stage 3 headline for this persona (hook inspiration)
        best_headline = _get_best_headline(copy_assets, persona_key)

        for platform_key in ORGANIC_PLATFORMS:
            config = CAROUSEL_PLATFORMS.get(platform_key)
            spec = PLATFORM_SPECS.get(platform_key)
            if not config or not spec:
                continue

            for variation in range(1, VARIATIONS_PER_PERSONA + 1):
                if carousel_count >= MAX_CAROUSELS:
                    logger.info("Hit max carousel cap (%d) — stopping", MAX_CAROUSELS)
                    return {"organic_carousel_count": carousel_count}

                logger.info(
                    "Organic carousel: %s × %s × V%d",
                    persona_name, platform_key, variation,
                )

                # ── 1. Generate slides via existing carousel engine ──
                try:
                    slides = await _generate_carousel(
                        platform_key=platform_key,
                        config=config,
                        spec=spec,
                        actors=actors,
                        brief=brief,
                        personas=[persona],  # Single persona per carousel
                        request_id=request_id,
                    )
                except Exception as exc:
                    logger.error(
                        "Carousel slide generation failed for %s/%s/V%d: %s",
                        persona_name, platform_key, variation, exc,
                    )
                    continue

                if not slides:
                    logger.warning("No slides generated for %s/%s/V%d", persona_name, platform_key, variation)
                    continue

                slide_urls = [s.get("blob_url", "") for s in slides if s.get("blob_url")]

                # ── 2. Generate recruiter-voice caption ──
                if "linkedin" in platform_key:
                    caption_prompt = build_linkedin_caption_prompt(
                        form_data=form_data,
                        persona=persona,
                        brief=brief,
                        variation=variation,
                        stage3_headline=best_headline,
                    )
                else:
                    caption_prompt = build_ig_caption_prompt(
                        form_data=form_data,
                        persona=persona,
                        brief=brief,
                        variation=variation,
                        stage3_headline=best_headline,
                    )

                caption = await generate_copy(
                    ORGANIC_CAPTION_SYSTEM_PROMPT,
                    caption_prompt,
                    skill_stage="organic",
                    max_tokens=512,
                    temperature=0.8,
                )
                caption = caption.strip()

                # ── 3. Validate caption for drift ──
                passed, drift_issues = validate_caption(caption, hard_facts)

                if not passed:
                    logger.warning(
                        "Caption drift for %s/%s/V%d: %s — regenerating",
                        persona_name, platform_key, variation, drift_issues,
                    )
                    # One retry with explicit correction
                    caption = await generate_copy(
                        ORGANIC_CAPTION_SYSTEM_PROMPT,
                        caption_prompt + f"\n\nCRITICAL FIX: {'; '.join(drift_issues)}. Correct these issues.",
                        skill_stage="organic",
                        max_tokens=512,
                        temperature=0.6,
                    )
                    caption = caption.strip()
                    passed, drift_issues = validate_caption(caption, hard_facts)

                # ── 4. Save as organic_carousel asset ──
                await save_asset(request_id, {
                    "asset_type": "organic_carousel",
                    "platform": platform_key.replace("_carousel", ""),
                    "format": "carousel",
                    "language": "English",
                    "blob_url": slide_urls[0] if slide_urls else "",
                    "stage": 4,
                    "evaluation_passed": passed,
                    "evaluation_score": 1.0 if passed else 0.5,
                    "evaluation_data": {"drift_issues": drift_issues} if not passed else {},
                    "metadata": {
                        "persona_key": persona_key,
                        "persona_name": persona_name,
                        "distribution": "organic",
                        "variation": variation,
                        "caption": caption,
                        "slide_count": len(slide_urls),
                        "slide_urls": slide_urls,
                        "hook_angle": "primary_pillar" if variation == 1 else "secondary_pillar",
                        "platform": platform_key,
                    },
                })

                carousel_count += 1
                logger.info(
                    "✓ Organic carousel saved: %s/%s/V%d — %d slides, caption %s",
                    persona_name, platform_key, variation,
                    len(slide_urls), "PASSED" if passed else "DRIFT",
                )

    logger.info("Organic carousel generation complete: %d carousels", carousel_count)
    return {"organic_carousel_count": carousel_count}


def _get_best_headline(copy_assets: list[dict], persona_key: str) -> str:
    """Get the best-scoring Stage 3 headline for hook inspiration."""
    best_score = -1.0
    best_headline = ""
    for asset in copy_assets:
        meta = asset.get("content") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (ValueError, TypeError):
                continue
        if meta.get("persona_key") != persona_key:
            continue
        score = float(meta.get("eval_score", asset.get("evaluation_score", 0)) or 0)
        if score > best_score:
            best_score = score
            copy_data = meta.get("copy_data", {})
            if isinstance(copy_data, str):
                try:
                    copy_data = json.loads(copy_data)
                except (ValueError, TypeError):
                    copy_data = {}
            best_headline = copy_data.get("headline", copy_data.get("hook", ""))
    return best_headline
```

- [ ] **Step 2: Verify it loads**

Run: `cd worker && python3.13 -c "from pipeline.stage4_organic_carousel import run_organic_carousels; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage4_organic_carousel.py
git commit -m "feat(organic): add carousel orchestrator — 12-cap, caption gen, drift validation"
```

---

### Task 4: Wire into Pipeline + Schema Update

**Files:**
- Modify: `worker/pipeline/orchestrator.py`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add import to orchestrator**

In `worker/pipeline/orchestrator.py`, add after the Stage 6 import:

```python
from pipeline.stage4_organic_carousel import run_organic_carousels
```

- [ ] **Step 2: Add organic carousel call after Stage 4**

In the orchestrator's stage execution loop, after the existing `run_carousel_stage` call or at the end of Stage 4, add organic carousel generation. Find where `run_stage4` or `run_carousel_stage` is called and add after it:

```python
# After Stage 4 carousel step, generate organic carousels
if stage_num == 4:
    logger.info("Generating organic carousels...")
    organic_result = await run_organic_carousels(context)
    context.update(organic_result)
```

Alternatively, add it as a sub-step within the Stage 4 block or as a standalone entry in the stages list:

```python
stages = [
    (1, "Strategic Intelligence", run_stage1),
    (2, "Character-Driven Image Generation", run_stage2),
    (3, "Copy Generation", run_stage3),
    (4, "Layout Composition", run_stage4),
    # Organic carousels run as part of Stage 4 output
    (5, "Video Generation", run_video_stage),
    (6, "Landing Page Generation", run_stage6),
]
```

The cleanest approach: call `run_organic_carousels(context)` at the end of `run_stage4` in `stage4_compose_v3.py`, since it's logically part of Stage 4 composition output.

- [ ] **Step 3: Update schema**

In `src/lib/db/schema.ts`, update the asset_type CHECK:

```sql
-- Current:
CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page'))
-- New:
CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page', 'organic_carousel'))
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty 2>&1 | head -5`
Run: `cd worker && python3.13 -c "from pipeline.orchestrator import run_pipeline; print('OK')"`

- [ ] **Step 5: Commit**

```bash
git add worker/pipeline/orchestrator.py worker/pipeline/stage4_compose_v3.py src/lib/db/schema.ts
git commit -m "feat(organic): wire organic carousels into Stage 4 + add asset_type to schema"
```

---

## Phase 2: Recruiter UI (Tasks 5-7)

### Task 5: CarouselPreviewCard Component

Platform-authentic post mockup with real branding, swipeable slides, caption, copy/download buttons.

**Files:**
- Create: `src/components/recruiter/CarouselPreviewCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Copy, Download, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset } from "@/lib/types";

interface CarouselPreviewCardProps {
  asset: GeneratedAsset;
}

// Real platform logos as inline SVGs
const LINKEDIN_LOGO = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const IG_LOGO = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#ig-grad)">
    <defs>
      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#feda75"/>
        <stop offset="25%" stopColor="#fa7e1e"/>
        <stop offset="50%" stopColor="#d62976"/>
        <stop offset="75%" stopColor="#962fbf"/>
        <stop offset="100%" stopColor="#4f5bd5"/>
      </linearGradient>
    </defs>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

export default function CarouselPreviewCard({ asset }: CarouselPreviewCardProps) {
  const content = (asset.content ?? {}) as Record<string, any>;
  const caption: string = content.caption ?? "";
  const slideUrls: string[] = content.slide_urls ?? [];
  const platform: string = content.platform ?? asset.platform ?? "";
  const isLinkedIn = platform.includes("linkedin");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    toast.success("Caption copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    for (const url of slideUrls) {
      if (url) window.open(url, "_blank");
    }
    toast.success(`Downloading ${slideUrls.length} slides...`);
  };

  const nextSlide = () => setCurrentSlide((p) => Math.min(p + 1, slideUrls.length - 1));
  const prevSlide = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #E5E5E5",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        maxWidth: 360,
      }}
    >
      {/* Header — platform branding */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #F5F5F5" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: isLinkedIn ? "#E8F0FE" : "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isLinkedIn ? LINKEDIN_LOGO : IG_LOGO}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A" }}>
            {isLinkedIn ? "Maria Solana" : "maria.recruiter"}
          </div>
          <div style={{ fontSize: 10, color: "#737373" }}>
            {isLinkedIn ? "Recruiter at OneForma · Just now" : "OneForma"}
          </div>
        </div>
      </div>

      {/* Caption — above slides for LinkedIn, below for IG */}
      {isLinkedIn && caption && (
        <div style={{ padding: "10px 14px", fontSize: 12, color: "#334155", lineHeight: 1.5, borderBottom: "1px solid #F5F5F5" }}>
          {caption.slice(0, 280)}{caption.length > 280 ? "..." : ""}
        </div>
      )}

      {/* Slide viewer */}
      <div style={{ position: "relative", aspectRatio: isLinkedIn ? "1" : "4/5", background: "#0a0a0f" }}>
        {slideUrls[currentSlide] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slideUrls[currentSlide]}
            alt={`Slide ${currentSlide + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13 }}>
            No slides
          </div>
        )}

        {/* Nav arrows */}
        {currentSlide > 0 && (
          <button onClick={prevSlide} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeft size={16} color="#1A1A1A" />
          </button>
        )}
        {currentSlide < slideUrls.length - 1 && (
          <button onClick={nextSlide} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronRight size={16} color="#1A1A1A" />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "8px 0" }}>
        {slideUrls.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === currentSlide ? 16 : 6,
              height: 6,
              borderRadius: 3,
              background: i === currentSlide ? (isLinkedIn ? "#0A66C2" : "#E1306C") : "#D4D4D4",
              transition: "width 0.2s, background 0.2s",
            }}
          />
        ))}
      </div>

      {/* IG caption below slides */}
      {!isLinkedIn && caption && (
        <div style={{ padding: "6px 14px 10px", fontSize: 12, color: "#334155", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>maria.recruiter</span>{" "}
          {caption.slice(0, 200)}{caption.length > 200 ? "..." : ""}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #F5F5F5", display: "flex", gap: 8 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 0",
            borderRadius: 8,
            border: "1px solid #E5E5E5",
            background: "#FFFFFF",
            fontSize: 12,
            fontWeight: 600,
            color: "#1A1A1A",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy Caption"}
        </button>
        <button
          onClick={handleDownload}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            background: "#32373C",
            fontSize: 12,
            fontWeight: 600,
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Download size={14} />
          Download Slides
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep CarouselPreview || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/CarouselPreviewCard.tsx
git commit -m "feat(organic): add platform-authentic carousel preview card with real branding"
```

---

### Task 6: OrganicTab Component

Platform sub-tabs (LinkedIn / Instagram) with grid of CarouselPreviewCards.

**Files:**
- Create: `src/components/recruiter/OrganicTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useMemo } from "react";
import CarouselPreviewCard from "./CarouselPreviewCard";
import type { GeneratedAsset } from "@/lib/types";

interface OrganicTabProps {
  assets: GeneratedAsset[];
}

const PLATFORM_TABS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "ig", label: "Instagram" },
] as const;

export default function OrganicTab({ assets }: OrganicTabProps) {
  const [activePlatform, setActivePlatform] = useState<string>("linkedin");

  const organicAssets = useMemo(
    () => assets.filter((a) => a.asset_type === "organic_carousel" && a.evaluation_passed && a.blob_url),
    [assets],
  );

  const filtered = useMemo(
    () => organicAssets.filter((a) => {
      const platform = ((a.content as Record<string, any>)?.platform ?? a.platform ?? "").toLowerCase();
      return platform.includes(activePlatform);
    }),
    [organicAssets, activePlatform],
  );

  if (organicAssets.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#8A8A8E" }}>
          No organic content generated yet. Organic carousels are created automatically when the pipeline runs.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Platform sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #E5E5E5", paddingBottom: 0 }}>
        {PLATFORM_TABS.map((tab) => {
          const count = organicAssets.filter((a) => {
            const p = ((a.content as Record<string, any>)?.platform ?? a.platform ?? "").toLowerCase();
            return p.includes(tab.key);
          }).length;
          const isActive = activePlatform === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActivePlatform(tab.key)}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#1A1A1A" : "#8A8A8E",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #32373C" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Carousel grid */}
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8A8A8E", fontStyle: "italic", padding: "20px 0" }}>
          No {activePlatform === "linkedin" ? "LinkedIn" : "Instagram"} carousels generated yet.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {filtered.map((asset) => (
            <CarouselPreviewCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep OrganicTab || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/OrganicTab.tsx
git commit -m "feat(organic): add OrganicTab with platform sub-tabs and carousel grid"
```

---

### Task 7: Wire OrganicTab into RecruiterWorkspace

**Files:**
- Modify: `src/components/recruiter/RecruiterWorkspace.tsx`

- [ ] **Step 1: Add import**

```tsx
import OrganicTab from "./OrganicTab";
import { Megaphone } from "lucide-react";
```

- [ ] **Step 2: Extend TabKey type**

Change line 20:

```tsx
// OLD:
type TabKey = "creatives" | "dashboard";
// NEW:
type TabKey = "creatives" | "organic" | "dashboard";
```

- [ ] **Step 3: Add Organic tab button**

After the existing "Assets & Creatives" tab button (around line 130), add:

```tsx
<TabButton active={activeTab === "organic"} onClick={() => setActiveTab("organic")} icon={<Megaphone size={14} />} label="Organic" />
```

- [ ] **Step 4: Add Organic tab content**

After the existing `activeTab === "creatives"` block (around line 170), add:

```tsx
{activeTab === "organic" && (
  <OrganicTab assets={assets} />
)}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -5`

- [ ] **Step 6: Commit**

```bash
git add src/components/recruiter/RecruiterWorkspace.tsx
git commit -m "feat(organic): wire OrganicTab into RecruiterWorkspace as third tab"
```

---

## Phase 3: Designer UI (Tasks 8-10)

### Task 8: Designer Dashboard — Organic/Paid Split

**Files:**
- Modify: `src/components/designer/dashboard/DesignerDashboard.tsx`
- Modify: `src/components/designer/dashboard/WorkItemRow.tsx`

- [ ] **Step 1: Add distribution badge to WorkItemRow**

In `WorkItemRow.tsx`, add a badge showing whether the campaign has organic assets. Add a prop `hasOrganic: boolean` and render a pill:

```tsx
{hasOrganic && (
  <span style={{
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 9999,
    background: "rgba(232,75,165,0.1)",
    color: "#E84BA5",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginLeft: 6,
  }}>
    ORGANIC
  </span>
)}
```

- [ ] **Step 2: Split dashboard into Organic/Paid sections**

In `DesignerDashboard.tsx`, split the campaign list into two groups based on whether the campaign has organic_carousel assets. Render organic section first with pink accent bar:

```tsx
{/* Organic section — higher priority */}
{organicCampaigns.length > 0 && (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#E84BA5", marginBottom: 12, paddingLeft: 4 }}>
      Organic — Review Priority
    </div>
    <div style={{ borderLeft: "3px solid #E84BA5", paddingLeft: 12 }}>
      {/* StatusGroup components for organic campaigns */}
    </div>
  </div>
)}

{/* Paid section — standard priority */}
<div>
  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.muted, marginBottom: 12, paddingLeft: 4 }}>
    Paid — Standard
  </div>
  <div style={{ borderLeft: `3px solid ${theme.border}`, paddingLeft: 12 }}>
    {/* StatusGroup components for paid campaigns */}
  </div>
</div>
```

Note: determining "has organic" requires checking if any `organic_carousel` assets exist per campaign. Fetch this from the API or pass as a flag.

- [ ] **Step 3: Commit**

```bash
git add src/components/designer/dashboard/DesignerDashboard.tsx src/components/designer/dashboard/WorkItemRow.tsx
git commit -m "feat(organic): split designer dashboard into organic (pink) + paid sections"
```

---

### Task 9: Designer Gallery — Organic/Paid Tabs

**Files:**
- Modify: `src/components/designer/gallery/DesignerGallery.tsx`

- [ ] **Step 1: Add top-level distribution tabs**

Add a `distributionTab` state (`"organic" | "paid"`) and render tab buttons above the existing persona tabs:

```tsx
const [distributionTab, setDistributionTab] = useState<"organic" | "paid">(
  hasOrganicAssets ? "organic" : "paid"
);

// In render, above persona tabs:
<div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
  {hasOrganicAssets && (
    <button
      onClick={() => setDistributionTab("organic")}
      style={{
        padding: "10px 20px",
        fontSize: 13,
        fontWeight: distributionTab === "organic" ? 700 : 400,
        color: distributionTab === "organic" ? "#E84BA5" : theme.muted,
        background: "none",
        border: "none",
        borderBottom: distributionTab === "organic" ? "2px solid #E84BA5" : "2px solid transparent",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      Organic
    </button>
  )}
  <button
    onClick={() => setDistributionTab("paid")}
    style={{
      padding: "10px 20px",
      fontSize: 13,
      fontWeight: distributionTab === "paid" ? 700 : 400,
      color: distributionTab === "paid" ? theme.fg : theme.muted,
      background: "none",
      border: "none",
      borderBottom: distributionTab === "paid" ? `2px solid ${theme.fg}` : "2px solid transparent",
      cursor: "pointer",
      fontFamily: "inherit",
    }}
  >
    Paid
  </button>
</div>
```

Filter displayed assets based on `distributionTab`:
- `"organic"` → show `organic_carousel` assets
- `"paid"` → show `composed_creative` + `carousel_panel` assets

- [ ] **Step 2: Commit**

```bash
git add src/components/designer/gallery/DesignerGallery.tsx
git commit -m "feat(organic): add Organic/Paid distribution tabs to designer gallery"
```

---

### Task 10: Figma Push — Distribution-Aware

**Files:**
- Modify: `src/components/designer/figma/PushToFigmaButton.tsx`

- [ ] **Step 1: Add organic/paid push options**

In `PushToFigmaButton.tsx`, extend the push level dropdown to include distribution options:

```tsx
// Add to the existing push options:
{ key: "all_organic", label: "Push All Organic", icon: Megaphone },
{ key: "all_paid", label: "Push All Paid", icon: Image },
```

When "Push All Organic" is selected, filter assets to `asset_type === "organic_carousel"` before pushing. When "Push All Paid", filter to `composed_creative` + `carousel_panel`.

The Figma frame naming should include the distribution:
- Organic: `Nova_{Persona}_V{n}_organic_{platform}_{WxH}`
- Paid: existing naming convention (unchanged)

- [ ] **Step 2: Commit**

```bash
git add src/components/designer/figma/PushToFigmaButton.tsx
git commit -m "feat(organic): add Push All Organic / Push All Paid to Figma integration"
```
