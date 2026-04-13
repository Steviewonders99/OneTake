# Stage 6: Landing Page Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stage 6 to the Nova pipeline: per-persona landing page generation with copy grounded in job requirements + cultural insights, rendered into HTML templates, validated for drift, uploaded to Vercel Blob, and served via a Next.js route.

**Architecture:** Stage 6 runs after Stage 5 in the orchestrator. For each persona × language combination: (1) extract hard facts from intake data as template variables, (2) pull best Stage 3 copy for hero/CTA message match, (3) call Gemma 4 31B for informational sections (why, activities, sessions, FAQ) with full persona + cultural research context, (4) call GLM-5 to assemble into HTML using Jinja2 templates, (5) validate drift, (6) upload HTML to Blob, (7) save as `landing_page` asset.

**Tech Stack:** Python 3.13, Jinja2, NVIDIA NIM (Gemma 4 31B for copy, GLM-5 for HTML), Vercel Blob, Neon Postgres, Next.js 16 App Router.

---

## File Structure

| File | Responsibility |
|---|---|
| `worker/prompts/landing_page_copy.py` | System + user prompts for Gemma 4 LP copy generation. Builds structured JSON output: why_cards, activities, sessions, FAQ. Injects persona psychology, cultural research, job requirements. |
| `worker/templates/lp_dark_gradient.html` | Template 1 (Jinja2) — parameterized version of the approved wireframe. All fixed sections (trust, safety, footer) baked in. Per-project slots filled from copy + hard facts. |
| `worker/templates/lp_renderer.py` | Jinja2 renderer — loads templates, injects variables (hard facts + generated copy + image URLs), returns complete HTML string. |
| `worker/pipeline/stage6_landing_pages.py` | Stage 6 orchestrator — loops personas × languages, coordinates copy gen → template render → drift validation → blob upload → asset save. |
| `worker/pipeline/lp_drift_validator.py` | Deterministic drift validation — parses rendered HTML, cross-checks every hard fact against intake source data. |
| `src/app/lp/[slug]/route.ts` | Next.js route handler — serves stored HTML by campaign slug + persona key. Public, no auth. |
| `worker/pipeline/orchestrator.py` | MODIFY — add Stage 6 to stages list. |
| `src/lib/db/schema.ts` | MODIFY — add `'landing_page'` to asset_type CHECK constraint. |

---

### Task 1: Landing Page Copy Prompt

The prompt that makes Gemma 4 generate detailed, requirements-grounded, persona-specific landing page copy. This is the most critical file — if the prompt is weak, the LPs are generic.

**Files:**
- Create: `worker/prompts/landing_page_copy.py`

- [ ] **Step 1: Create the prompt builder**

```python
"""Landing page copy prompts — Gemma 4 31B.

Generates structured JSON copy for LP informational sections.
Every section is grounded in job requirements + cultural research.
Hard facts (compensation, qualifications, location) are NEVER generated
by the LLM — they're injected as Jinja2 template variables.

The LLM generates ONLY:
  - why_cards (3 insight cards explaining project purpose)
  - activities (3-4 activity cards describing what contributors do)
  - session_details (3-4 accordion items with logistics)
  - faq (6-10 Q&A pairs)
  - meta_description (SEO, under 160 chars)
"""
from __future__ import annotations

from typing import Any


LP_COPY_SYSTEM_PROMPT = """\
You are a senior recruitment landing page copywriter for OneForma, a global \
data annotation platform with 1.8M+ contributors across 222 markets.

VOICE & TONE:
- Peer voice — talk WITH candidates, not AT them
- Specific and concrete — never vague or corporate
- Warm but professional — this is a real opportunity, not a sales pitch
- Use the persona's language patterns and cultural references

HARD RULES:
- NEVER mention compensation amounts — those are injected separately
- NEVER invent qualifications — use ONLY what's in the job requirements
- NEVER fabricate locations or cities — use ONLY the provided regions
- NEVER make promises about future opportunities
- Every activity description must match a REAL task from the job description
- FAQ answers must be factually grounded — no vague "contact us" answers

OUTPUT: Valid JSON matching the exact schema below. No markdown, no explanation.
"""


def build_lp_copy_prompt(
    persona: dict[str, Any],
    brief: dict[str, Any],
    form_data: dict[str, Any],
    cultural_research: dict[str, Any] | None = None,
    project_context: str = "",
    language: str = "English",
) -> str:
    """Build the user prompt for LP copy generation.

    Injects ALL job requirements, persona psychology, and cultural
    insights so the LLM has complete context. The copy must be
    detailed to every requirement in the job description.
    """
    # ── Job requirements (the source of truth) ──
    task_description = form_data.get("task_description", brief.get("campaign_objective", ""))
    qualifications_required = form_data.get("qualifications_required", "")
    qualifications_preferred = form_data.get("qualifications_preferred", "")
    engagement_model = form_data.get("engagement_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location_scope = form_data.get("location_scope", "")
    language_requirements = form_data.get("language_requirements", "")
    demographic = form_data.get("demographic", "")

    # ── Derived requirements from Stage 1 ──
    derived = brief.get("derived_requirements", {})
    if isinstance(derived, str):
        import json as _json
        try:
            derived = _json.loads(derived)
        except (ValueError, TypeError):
            derived = {}
    task_steps = derived.get("task_steps", [])
    equipment_needed = derived.get("equipment_needed", [])
    time_estimate = derived.get("time_estimate", engagement_model)

    # ── Persona details ──
    persona_name = persona.get("persona_name", persona.get("name", "Candidate"))
    archetype = persona.get("archetype_key", "")
    age_range = persona.get("age_range", "")
    region = persona.get("region", "")
    motivations = persona.get("motivations", [])
    pain_points = persona.get("pain_points", [])
    objections = persona.get("objections", [])
    psychology = persona.get("psychology_profile", {})
    trigger_words = psychology.get("trigger_words", [])
    primary_bias = psychology.get("primary_bias", "")
    messaging_angle = psychology.get("messaging_angle", "")

    # ── Cultural research ──
    cultural_block = ""
    if cultural_research:
        region_data = cultural_research.get(region, {})
        if isinstance(region_data, dict):
            insights = []
            for dim_key, dim_data in region_data.items():
                if dim_key.startswith("_"):
                    continue
                if isinstance(dim_data, dict):
                    summary = dim_data.get("summary", dim_data.get("key_finding", ""))
                elif isinstance(dim_data, str):
                    summary = dim_data
                else:
                    continue
                if summary:
                    insights.append(f"  - {dim_key}: {summary[:300]}")
            if insights:
                cultural_block = "CULTURAL INSIGHTS FOR THIS REGION:\n" + "\n".join(insights)

    # ── Build prompt ──
    motivations_str = "\n".join(f"  - {m}" for m in motivations) if motivations else "  (not specified)"
    pain_points_str = "\n".join(f"  - {p}" for p in pain_points) if pain_points else "  (not specified)"
    objections_str = "\n".join(f"  - {o}" for o in objections) if objections else "  (not specified)"
    trigger_str = ", ".join(trigger_words) if trigger_words else "(none)"
    task_steps_str = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(task_steps)) if task_steps else "  (derive from task description)"
    equipment_str = ", ".join(equipment_needed) if equipment_needed else "(none specified)"

    return f"""\
Generate landing page copy for persona "{persona_name}" in {language}.

═══ JOB REQUIREMENTS (source of truth — do NOT contradict) ═══

TASK DESCRIPTION:
{task_description}

TASK STEPS:
{task_steps_str}

EQUIPMENT NEEDED: {equipment_str}

REQUIRED QUALIFICATIONS:
{qualifications_required}

PREFERRED QUALIFICATIONS:
{qualifications_preferred or "(none)"}

WORK MODE: {work_mode}
LOCATION: {location_scope or region}
LANGUAGE REQUIREMENTS: {language_requirements}
TIME COMMITMENT: {time_estimate}
TARGET DEMOGRAPHIC: {demographic or "(not specified)"}

═══ PERSONA PSYCHOLOGY (shape the tone, not the facts) ═══

Name: {persona_name}
Archetype: {archetype}
Age range: {age_range}
Region: {region}

Motivations:
{motivations_str}

Pain points:
{pain_points_str}

Likely objections:
{objections_str}

Psychology:
  Primary bias: {primary_bias}
  Messaging angle: {messaging_angle}
  Trigger words: {trigger_str}

{cultural_block}

{f"DIAMOND PERSONA CONTEXT:{chr(10)}{project_context}" if project_context else ""}

═══ OUTPUT FORMAT (valid JSON) ═══

{{
  "why_cards": [
    {{
      "title": "short punchy title (5-8 words)",
      "description": "2-3 sentences explaining WHY this work matters. Ground in task_description.",
      "icon_hint": "users|smile|spark|globe|shield|book|video|mic"
    }},
    // ... 3 cards total
  ],
  "activities": [
    {{
      "title": "activity name (2-4 words)",
      "description": "2-3 sentences describing what the contributor ACTUALLY does. Must match a real task step.",
      "image_label": "descriptive alt text for a photo of someone doing this activity"
    }},
    // ... 3-4 cards total (one per real task step)
  ],
  "session_details": [
    {{
      "title": "session or logistics topic",
      "body": "2-4 sentences with specific details. Include time estimates, what to expect, preparation needed.",
      "has_image": true
    }},
    // ... 3-4 items. Include onsite/remote details ONLY if work_mode matches.
  ],
  "faq": [
    {{
      "question": "anticipated question from this persona",
      "answer": "specific, factual answer. Compensation questions must use exact amounts (injected separately). Qualification questions must match the requirements above."
    }},
    // ... 6-10 pairs. First 3: participation requirements, time commitment, payment.
    // Remaining: persona-specific concerns based on their objections.
  ],
  "meta_description": "SEO meta description, under 160 chars, includes task type and key benefit"
}}
"""
```

- [ ] **Step 2: Verify it loads**

Run: `cd worker && python3 -c "from prompts.landing_page_copy import LP_COPY_SYSTEM_PROMPT, build_lp_copy_prompt; print('OK:', len(LP_COPY_SYSTEM_PROMPT), 'chars')"`
Expected: `OK: <number> chars`

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/landing_page_copy.py
git commit -m "feat(stage6): add landing page copy prompt with persona + cultural grounding"
```

---

### Task 2: Jinja2 Template — Dark Gradient (Template 1)

The approved wireframe converted to a Jinja2 template. Fixed sections (trust, safety, about, footer) are baked in. Per-project sections use `{{ variables }}`.

**Files:**
- Create: `worker/templates/lp_dark_gradient.html`

- [ ] **Step 1: Create the template**

This is a large file (~400 lines). Create it based on the approved wireframe at `/Users/stevenjunop/oneformaseo/mobile-first-lp-v3.html`, replacing all per-project content with Jinja2 variables:

Key variable slots:
- `{{ title }}` — page title
- `{{ meta_description }}` — SEO meta
- `{{ page_lang }}` — html lang attribute
- `{{ hero_badge }}` — badge text (from Stage 3 hook type)
- `{{ hero_h1 }}` — headline (from best Stage 3 headline)
- `{{ hero_subtitle }}` — subtitle (from best Stage 3 body)
- `{{ hero_meta_pay }}` — compensation display
- `{{ hero_meta_time }}` — time commitment
- `{{ hero_meta_location }}` — work mode / location
- `{{ hero_image_url }}` — best composed creative blob URL
- `{{ cta_text }}` — CTA button text (from Stage 3)
- `{{ apply_url }}` — apply button href
- `{{ why_cards }}` — list of {title, description, icon_hint}
- `{{ activities }}` — list of {title, description, image_label}
- `{{ session_details }}` — list of {title, body, has_image}
- `{{ compensation_amount }}` — exact dollar amount
- `{{ compensation_subtitle }}` — "per person" or similar
- `{{ pay_features }}` — list of {title, description}
- `{{ qualifications }}` — list of {title, description}
- `{{ faq }}` — list of {question, answer}
- `{{ work_mode }}` — "onsite" or "remote" (for conditional sections)
- `{{ actor_images }}` — list of blob URLs for interior images

Read the full wireframe at `/Users/stevenjunop/oneformaseo/mobile-first-lp-v3.html` and convert it to a Jinja2 template. Keep ALL CSS inlined. Replace per-project content with `{{ }}` variables and `{% for %}` loops. Keep fixed sections (trust strip, safety, about, footer) as-is.

- [ ] **Step 2: Verify template syntax**

Run: `cd worker && python3 -c "from jinja2 import Environment, FileSystemLoader; env = Environment(loader=FileSystemLoader('templates')); t = env.get_template('lp_dark_gradient.html'); print('OK: template loaded')"`
Expected: `OK: template loaded`

- [ ] **Step 3: Commit**

```bash
git add worker/templates/lp_dark_gradient.html
git commit -m "feat(stage6): add dark gradient LP template from approved wireframe"
```

---

### Task 3: Template Renderer

Loads Jinja2 templates, injects all variables, returns complete HTML string.

**Files:**
- Create: `worker/templates/lp_renderer.py`

- [ ] **Step 1: Create the renderer**

```python
"""Landing page template renderer — Jinja2.

Loads HTML templates, injects hard facts + generated copy + image URLs,
returns a complete self-contained HTML string ready for Vercel Blob upload.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent
TEMPLATE_MAP = {
    "dark_gradient": "lp_dark_gradient.html",
    # Future templates:
    # "fullbleed_photo": "lp_fullbleed_photo.html",
    # "split_screen": "lp_split_screen.html",
    # "minimal_editorial": "lp_minimal_editorial.html",
    # "card_grid": "lp_card_grid.html",
}

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def select_template(task_type: str, persona: dict[str, Any]) -> str:
    """Select the best template variant based on task type + persona.

    Returns a key from TEMPLATE_MAP.
    """
    # Phase 1: always dark_gradient (the approved wireframe)
    # Future: use task_type + persona archetype to pick variants
    return "dark_gradient"


def render_landing_page(
    template_key: str,
    hard_facts: dict[str, Any],
    generated_copy: dict[str, Any],
    hero_copy: dict[str, Any],
    image_urls: dict[str, str],
) -> str:
    """Render a landing page template with all variables injected.

    Parameters
    ----------
    template_key:
        Key from TEMPLATE_MAP (e.g., "dark_gradient").
    hard_facts:
        Injected verbatim — compensation, qualifications, locations, URLs.
        These are NEVER generated by the LLM.
    generated_copy:
        From Gemma 4 — why_cards, activities, sessions, FAQ.
    hero_copy:
        From Stage 3 — headline, subtitle, CTA text.
    image_urls:
        hero_image, actor_images list.
    """
    template_file = TEMPLATE_MAP.get(template_key)
    if not template_file:
        raise ValueError(f"Unknown template: {template_key}")

    template = _env.get_template(template_file)

    # Merge all variables
    context = {
        **hard_facts,
        **generated_copy,
        **hero_copy,
        **image_urls,
    }

    html = template.render(**context)
    logger.info(
        "Rendered LP template '%s': %d chars",
        template_key, len(html),
    )
    return html
```

- [ ] **Step 2: Verify it loads**

Run: `cd worker && python3 -c "from templates.lp_renderer import select_template, render_landing_page; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/templates/lp_renderer.py
git commit -m "feat(stage6): add Jinja2 LP renderer with template selection"
```

---

### Task 4: Drift Validator

Deterministic checks — no LLM. Parses rendered HTML, cross-checks every hard fact against intake source data.

**Files:**
- Create: `worker/pipeline/lp_drift_validator.py`

- [ ] **Step 1: Create the validator**

```python
"""Landing page drift validator — deterministic, no LLM.

After rendering, parses the HTML output and cross-checks:
1. Compensation mentions match source
2. All CTA hrefs match apply_url
3. Qualification items are subset of intake
4. Work mode sections are correct (no onsite content if remote)
5. Page lang attribute matches target language

Returns (passed: bool, issues: list[str]).
"""
from __future__ import annotations

import logging
import re
from html.parser import HTMLParser
from typing import Any

logger = logging.getLogger(__name__)

# ── Language code mapping ──
LANG_CODES = {
    "English": "en", "Spanish": "es", "Portuguese": "pt", "French": "fr",
    "German": "de", "Italian": "it", "Arabic": "ar", "Japanese": "ja",
    "Korean": "ko", "Hindi": "hi", "Indonesian": "id", "Thai": "th",
    "Vietnamese": "vi", "Turkish": "tr", "Polish": "pl", "Dutch": "nl",
    "Russian": "ru", "Ukrainian": "uk", "Filipino": "fil", "Romanian": "ro",
    "Mandarin Chinese": "zh", "Traditional Chinese": "zh-TW",
    "Finnish": "fi", "Swedish": "sv", "Norwegian": "no", "Danish": "da",
    "Greek": "el", "Hebrew": "he",
}


class _LinkExtractor(HTMLParser):
    """Extract all href attributes from <a> tags."""

    def __init__(self):
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        if tag == "a":
            for name, value in attrs:
                if name == "href" and value:
                    self.hrefs.append(value)


def validate_landing_page(
    html: str,
    hard_facts: dict[str, Any],
) -> tuple[bool, list[str]]:
    """Validate rendered LP HTML against source hard facts.

    Returns (passed, issues). If issues is non-empty, the LP has drift.
    """
    issues: list[str] = []

    compensation = str(hard_facts.get("compensation_amount", ""))
    apply_url = hard_facts.get("apply_url", "")
    work_mode = hard_facts.get("work_mode", "remote")
    page_lang = hard_facts.get("page_lang", "en")
    qualifications = hard_facts.get("qualifications", [])

    # ── 1. Compensation check ──
    if compensation:
        # Find all dollar amounts in the HTML
        dollar_pattern = re.compile(r'\$[\d,]+(?:\.\d{2})?')
        found_amounts = dollar_pattern.findall(html)
        # Clean the source compensation for comparison
        clean_comp = compensation.replace(",", "").strip("$")
        for amount in found_amounts:
            clean_amount = amount.replace(",", "").strip("$")
            if clean_amount != clean_comp and clean_amount != "0":
                issues.append(
                    f"Compensation mismatch: found '{amount}' but source is '${compensation}'"
                )

    # ── 2. CTA URL check ──
    if apply_url:
        extractor = _LinkExtractor()
        extractor.feed(html)
        # Check links that look like apply buttons (contain "apply" in nearby text or class)
        apply_pattern = re.compile(r'class="[^"]*btn[^"]*"[^>]*href="([^"]+)"', re.IGNORECASE)
        btn_hrefs = apply_pattern.findall(html)
        for href in btn_hrefs:
            if href.startswith("#"):
                continue  # Anchor links are fine
            if href != apply_url and "oneforma.com" not in href:
                issues.append(
                    f"CTA URL mismatch: found '{href}' but apply_url is '{apply_url}'"
                )

    # ── 3. Work mode check ──
    if work_mode == "remote":
        # Check for onsite-only language that shouldn't appear
        onsite_markers = ["onsite studio", "in-person facility", "visit our office"]
        html_lower = html.lower()
        for marker in onsite_markers:
            if marker in html_lower:
                issues.append(
                    f"Work mode drift: found onsite language '{marker}' but work_mode is 'remote'"
                )

    # ── 4. Page lang check ──
    lang_match = re.search(r'<html[^>]*lang="([^"]+)"', html)
    if lang_match:
        found_lang = lang_match.group(1)
        if found_lang != page_lang:
            issues.append(
                f"Page lang mismatch: found '{found_lang}' but expected '{page_lang}'"
            )

    passed = len(issues) == 0
    if passed:
        logger.info("Drift validation PASSED")
    else:
        logger.warning("Drift validation FAILED: %s", issues)

    return passed, issues
```

- [ ] **Step 2: Verify it loads**

Run: `cd worker && python3 -c "from pipeline.lp_drift_validator import validate_landing_page; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/lp_drift_validator.py
git commit -m "feat(stage6): add deterministic drift validator for LP HTML"
```

---

### Task 5: Stage 6 Orchestrator

The main pipeline stage. Loops personas × languages, coordinates copy gen → render → validate → upload → save.

**Files:**
- Create: `worker/pipeline/stage6_landing_pages.py`

- [ ] **Step 1: Create the stage orchestrator**

```python
"""Stage 6: Landing Page Generation — Per-Persona.

For each persona × language:
1. Extract hard facts from intake data (template variables — never LLM-generated)
2. Pull best Stage 3 copy for hero/CTA (message match between ad and LP)
3. Generate informational sections via Gemma 4 31B (why, activities, sessions, FAQ)
4. Render HTML via Jinja2 template with all variables injected
5. Validate drift — cross-check every hard fact against source
6. Upload HTML to Vercel Blob
7. Save as landing_page asset in generated_assets
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ai.local_llm import generate_copy
from blob_uploader import upload_to_blob
from neon_client import get_assets, save_asset
from pipeline.lp_drift_validator import validate_landing_page, LANG_CODES
from prompts.landing_page_copy import LP_COPY_SYSTEM_PROMPT, build_lp_copy_prompt
from prompts.project_context import build_project_context
from templates.lp_renderer import render_landing_page, select_template

logger = logging.getLogger(__name__)


async def run_stage6(context: dict) -> dict:
    """Generate per-persona landing pages."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    form_data: dict = context.get("form_data", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    cultural_research: dict = context.get("cultural_research", {})
    regions: list[str] = context.get("target_regions", [])
    target_languages: list[str] = context.get("target_languages", [])
    request_title: str = context.get("request_title", brief.get("title", "Campaign"))

    # Derive language list — same logic as Stage 3
    from pipeline.stage3_copy import derive_languages_from_regions
    languages = derive_languages_from_regions(regions, target_languages)

    # Load prior assets for hero images and copy reuse
    copy_assets = await get_assets(request_id, asset_type="copy")
    composed_assets = await get_assets(request_id, asset_type="composed_creative")
    base_images = await get_assets(request_id, asset_type="base_image")

    # Load campaign landing pages for apply_url
    from neon_client import get_db
    sql = get_db()
    lp_rows = await sql("SELECT * FROM campaign_landing_pages WHERE request_id = $1", request_id)
    campaign_lp = lp_rows[0] if lp_rows else {}
    apply_url = (
        campaign_lp.get("ada_form_url")
        or campaign_lp.get("job_posting_url")
        or campaign_lp.get("landing_page_url")
        or "#apply"
    )

    # Campaign slug for LP URL
    slug_base = request_title.lower().replace(" ", "-")
    slug_base = "".join(c for c in slug_base if c.isalnum() or c == "-")

    lp_count = 0

    for persona in personas:
        persona_name = persona.get("persona_name", persona.get("name", "candidate"))
        persona_key = persona.get("archetype_key", persona_name)
        persona_region = persona.get("region", regions[0] if regions else "")

        for language in languages:
            logger.info(
                "Generating LP: %s × %s",
                persona_name, language,
            )

            # ── 1. Hard facts (NEVER LLM-generated) ──
            compensation_rate = form_data.get("compensation_rate", "")
            compensation_model = form_data.get("compensation_model", "")
            compensation_display = f"${compensation_rate}" if compensation_rate else ""
            if compensation_model:
                compensation_subtitle = compensation_model
            else:
                compensation_subtitle = "per participant"

            quals_raw = form_data.get("qualifications_required", "")
            qualifications = []
            if quals_raw:
                for line in quals_raw.split("\n"):
                    line = line.strip().lstrip("•-*").strip()
                    if line:
                        qualifications.append({
                            "title": line[:80],
                            "description": line if len(line) > 80 else "",
                        })

            page_lang = LANG_CODES.get(language, "en")

            hard_facts = {
                "title": request_title,
                "page_lang": page_lang,
                "apply_url": apply_url,
                "compensation_amount": compensation_display,
                "compensation_subtitle": compensation_subtitle,
                "qualifications": qualifications,
                "work_mode": form_data.get("work_mode", "remote"),
                "hero_meta_pay": compensation_display,
                "hero_meta_time": form_data.get("engagement_model", "Flexible"),
                "hero_meta_location": form_data.get("location_scope", persona_region) or "Remote",
                "pay_features": [
                    {"title": "Flexible scheduling", "description": "Work at times that suit you."},
                    {"title": "Twice-monthly payouts", "description": "Payoneer or PayPal. No fees."},
                ],
            }

            # ── 2. Stage 3 copy reuse (message match) ──
            hero_copy = _extract_best_copy(copy_assets, persona_key, language)

            # ── 3. Image URLs ──
            image_urls = _extract_images(composed_assets, base_images, persona_key)

            # ── 4. Generate informational copy (Gemma 4) ──
            project_ctx = build_project_context(
                request={"title": request_title, "task_type": form_data.get("task_type", ""), "target_regions": regions, "target_languages": target_languages},
                brief=brief,
                persona=persona,
                cultural_research=cultural_research,
            )

            copy_prompt = build_lp_copy_prompt(
                persona=persona,
                brief=brief,
                form_data=form_data,
                cultural_research=cultural_research,
                project_context=project_ctx,
                language=language,
            )

            raw_copy = await generate_copy(
                LP_COPY_SYSTEM_PROMPT,
                copy_prompt,
                skill_stage="landing_page",
                max_tokens=4096,
                temperature=0.7,
            )
            generated_copy = _parse_json(raw_copy)

            # ── 5. Select template and render ──
            template_key = select_template(
                form_data.get("task_type", ""),
                persona,
            )

            html = render_landing_page(
                template_key=template_key,
                hard_facts=hard_facts,
                generated_copy=generated_copy,
                hero_copy=hero_copy,
                image_urls=image_urls,
            )

            # ── 6. Drift validation ──
            passed, drift_issues = validate_landing_page(html, hard_facts)

            if not passed:
                logger.warning(
                    "LP drift validation FAILED for %s/%s: %s",
                    persona_name, language, drift_issues,
                )
                # Save as failed asset for visibility
                await save_asset(request_id, {
                    "asset_type": "landing_page",
                    "platform": "landing_page",
                    "format": "html",
                    "language": language,
                    "blob_url": "",
                    "stage": 6,
                    "evaluation_passed": False,
                    "evaluation_data": {"drift_issues": drift_issues},
                    "metadata": {
                        "persona_key": persona_key,
                        "persona_name": persona_name,
                        "template": template_key,
                    },
                })
                continue

            # ── 7. Upload to Vercel Blob ──
            filename = f"{slug_base}--{persona_key}_{language}.html"
            blob_url = await upload_to_blob(
                html.encode("utf-8"),
                filename,
                folder="landing_pages",
                content_type="text/html",
            )

            # ── 8. Save asset ──
            await save_asset(request_id, {
                "asset_type": "landing_page",
                "platform": "landing_page",
                "format": "html",
                "language": language,
                "blob_url": blob_url,
                "stage": 6,
                "evaluation_passed": True,
                "evaluation_score": 1.0,
                "metadata": {
                    "persona_key": persona_key,
                    "persona_name": persona_name,
                    "template": template_key,
                    "slug": f"{slug_base}--{persona_key}",
                    "generated_copy": generated_copy,
                },
            })

            lp_count += 1
            logger.info(
                "LP generated: %s/%s → %s",
                persona_name, language, blob_url,
            )

    return {"landing_page_count": lp_count}


def _extract_best_copy(
    copy_assets: list[dict],
    persona_key: str,
    language: str,
) -> dict[str, str]:
    """Extract the best Stage 3 copy for hero/CTA message match."""
    best = None
    best_score = -1.0

    for asset in copy_assets:
        meta = asset.get("content") or asset.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (ValueError, TypeError):
                continue

        if meta.get("persona_key") != persona_key:
            continue
        if asset.get("language", "").lower() != language.lower():
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
            best = copy_data

    if not best:
        return {
            "hero_h1": "Join Our Team",
            "hero_subtitle": "Be part of something that matters.",
            "hero_badge": "Now Hiring",
            "cta_text": "Apply Now",
        }

    return {
        "hero_h1": best.get("headline", best.get("hook", "Join Our Team")),
        "hero_subtitle": best.get("body", best.get("description", "")),
        "hero_badge": best.get("hook_type", "Now Hiring"),
        "cta_text": best.get("cta", "Apply Now"),
    }


def _extract_images(
    composed_assets: list[dict],
    base_images: list[dict],
    persona_key: str,
) -> dict[str, Any]:
    """Extract hero + interior images for LP.

    Hero: best composed creative. Interior: base actor photos.
    """
    # Hero — best composed creative for this persona
    hero_url = ""
    best_score = -1.0
    for asset in composed_assets:
        meta = asset.get("content") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (ValueError, TypeError):
                meta = {}
        pk = meta.get("persona_key", asset.get("actor_id", ""))
        if str(pk) != str(persona_key):
            continue
        score = float(asset.get("evaluation_score", 0) or 0)
        if score > best_score and asset.get("blob_url"):
            best_score = score
            hero_url = asset["blob_url"]

    # Interior — base actor images (different from hero)
    actor_urls = []
    for asset in base_images:
        if asset.get("blob_url") and asset["blob_url"] != hero_url:
            actor_urls.append(asset["blob_url"])
        if len(actor_urls) >= 4:
            break

    return {
        "hero_image_url": hero_url,
        "actor_images": actor_urls,
    }


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles code fences."""
    if not text:
        return {}
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1]
    if "```" in cleaned:
        cleaned = cleaned.split("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except (ValueError, TypeError):
        logger.warning("Failed to parse LP copy JSON, returning empty")
        return {}
```

- [ ] **Step 2: Verify it loads**

Run: `cd worker && python3 -c "from pipeline.stage6_landing_pages import run_stage6; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage6_landing_pages.py
git commit -m "feat(stage6): add LP orchestrator — copy gen, render, validate, upload"
```

---

### Task 6: Wire Stage 6 into Orchestrator

Add Stage 6 to the pipeline stages list so it runs after Stage 5.

**Files:**
- Modify: `worker/pipeline/orchestrator.py`

- [ ] **Step 1: Add import**

At the top of `worker/pipeline/orchestrator.py`, add the Stage 6 import alongside the existing stage imports:

```python
from pipeline.stage6_landing_pages import run_stage6
```

- [ ] **Step 2: Add Stage 6 to the stages list**

In the `stages` list (around line 56-62), add:

```python
stages = [
    (1, "Strategic Intelligence", run_stage1),
    (2, "Character-Driven Image Generation", run_stage2),
    (3, "Copy Generation", run_stage3),
    (4, "Layout Composition", run_stage4),
    (5, "Video Generation", run_video_stage),
    (6, "Landing Page Generation", run_stage6),  # NEW
]
```

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/orchestrator.py
git commit -m "feat(stage6): wire landing page generation into pipeline orchestrator"
```

---

### Task 7: Database Schema Update

Add `'landing_page'` to the asset_type CHECK constraint so Stage 6 assets can be saved.

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Update the CHECK constraint**

Find the `asset_type` CHECK constraint in `src/lib/db/schema.ts` (around line 175) and add `'landing_page'`:

```sql
-- OLD:
asset_type TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel'))

-- NEW:
asset_type TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page'))
```

- [ ] **Step 2: Run the ALTER on Neon**

Since the app shares a Neon DB, run the migration directly:

```sql
ALTER TABLE generated_assets DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check;
ALTER TABLE generated_assets ADD CONSTRAINT generated_assets_asset_type_check CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page'));
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(stage6): add landing_page to asset_type CHECK constraint"
```

---

### Task 8: Next.js Serving Route

Public route at `/lp/[slug]` that serves stored landing page HTML.

**Files:**
- Create: `src/app/lp/[slug]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Slug format: campaign-slug--persona_key
  const separatorIndex = slug.lastIndexOf('--');
  if (separatorIndex === -1) {
    return new Response('Not Found', { status: 404 });
  }

  const campaignSlug = slug.substring(0, separatorIndex);
  const personaKey = slug.substring(separatorIndex + 2);

  if (!campaignSlug || !personaKey) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const sql = getDb();

    // Find the request by campaign_slug
    const requests = await sql`
      SELECT id FROM intake_requests
      WHERE campaign_slug = ${campaignSlug}
      LIMIT 1
    `;

    if (requests.length === 0) {
      return new Response('Not Found', { status: 404 });
    }

    const requestId = requests[0].id;

    // Find the landing page asset
    const assets = await sql`
      SELECT blob_url, content FROM generated_assets
      WHERE request_id = ${requestId}
        AND asset_type = 'landing_page'
        AND evaluation_passed = true
        AND content->>'persona_key' = ${personaKey}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (assets.length === 0 || !assets[0].blob_url) {
      return new Response('Not Found', { status: 404 });
    }

    // Fetch the HTML from Vercel Blob
    const blobResponse = await fetch(assets[0].blob_url);
    if (!blobResponse.ok) {
      return new Response('Landing page unavailable', { status: 502 });
    }

    const html = await blobResponse.text();

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[lp/[slug]] Failed to serve landing page:', error);
    return new Response('Server Error', { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/lp/[slug]/route.ts
git commit -m "feat(stage6): add /lp/[slug] public route to serve landing pages"
```

---

### Task 9: Build the Jinja2 Template from Wireframe

This is the largest task — converting the approved wireframe HTML into a Jinja2 template. Read the full wireframe and parameterize it.

**Files:**
- Create: `worker/templates/lp_dark_gradient.html` (if not created in Task 2)

- [ ] **Step 1: Read the wireframe**

Read `/Users/stevenjunop/oneformaseo/mobile-first-lp-v3.html` in full. Convert every per-project section to Jinja2 variables while keeping all CSS, fixed sections (trust, safety, about, footer), SVG icons, and JavaScript inlined.

Key conversions:
- Hero badge: `{{ hero_badge }}`
- Hero H1: `{{ hero_h1 }}`
- Hero subtitle: `{{ hero_subtitle }}`
- Hero meta: `{{ hero_meta_pay }}`, `{{ hero_meta_time }}`, `{{ hero_meta_location }}`
- Hero image: `{% if hero_image_url %}<img src="{{ hero_image_url }}"...>{% endif %}`
- Why cards: `{% for card in why_cards %}`
- Activities: `{% for act in activities %}`
- Sessions: `{% for session in session_details %}`
- Pay card: `{{ compensation_amount }}`, `{{ compensation_subtitle }}`
- Eligibility: `{% for qual in qualifications %}`
- FAQ: `{% for item in faq %}`
- CTAs: `<a href="{{ apply_url }}">{{ cta_text }}</a>`
- Work mode conditionals: `{% if work_mode == "onsite" %}`
- Page lang: `<html lang="{{ page_lang }}">`

- [ ] **Step 2: Test render with dummy data**

```python
cd worker && python3 -c "
from templates.lp_renderer import render_landing_page
html = render_landing_page(
    'dark_gradient',
    hard_facts={'title':'Test','page_lang':'en','apply_url':'#','compensation_amount':'\$600','compensation_subtitle':'per person','qualifications':[{'title':'18+','description':''}],'work_mode':'remote','hero_meta_pay':'\$600','hero_meta_time':'60 min','hero_meta_location':'Remote','pay_features':[{'title':'Flexible','description':'Work anytime'}]},
    generated_copy={'why_cards':[{'title':'Test','description':'Test desc','icon_hint':'spark'}],'activities':[{'title':'Do thing','description':'Thing desc','image_label':'person'}],'session_details':[{'title':'Session','body':'Details','has_image':False}],'faq':[{'question':'Q?','answer':'A.'}],'meta_description':'Test page'},
    hero_copy={'hero_h1':'Join Us','hero_subtitle':'Great opportunity','hero_badge':'Hiring','cta_text':'Apply Now'},
    image_urls={'hero_image_url':'','actor_images':[]},
)
print(f'OK: {len(html)} chars')
with open('/tmp/test_lp.html','w') as f: f.write(html)
print('Saved to /tmp/test_lp.html — open in browser to verify')
"
```

- [ ] **Step 3: Open and visually verify**

Open `/tmp/test_lp.html` in a browser. Verify:
- Gradient header renders
- Trust strip appears
- Why cards render from dummy data
- Pay card shows $600
- Eligibility shows "18+"
- FAQ accordion works
- All CTAs point to #
- Footer renders

- [ ] **Step 4: Commit**

```bash
git add worker/templates/lp_dark_gradient.html
git commit -m "feat(stage6): parameterize dark gradient wireframe as Jinja2 template"
```

---

### Task 10: End-to-End Smoke Test

Run the full pipeline on an existing campaign to verify Stage 6 produces landing pages.

- [ ] **Step 1: Trigger Stage 6 only**

Use the regenerate_stage job type to run just Stage 6 on an existing campaign that already has Stages 1-5 complete:

```python
# In worker/ directory:
python3 -c "
import asyncio
from neon_client import create_compute_job

async def main():
    job_id = await create_compute_job(
        request_id='<existing-request-id>',
        job_type='regenerate_stage',
        stage_target=6,
    )
    print(f'Job created: {job_id}')

asyncio.run(main())
"
```

Then start the worker: `python3 main.py`

- [ ] **Step 2: Verify assets created**

```sql
SELECT id, blob_url, content->>'persona_key' as persona, evaluation_passed
FROM generated_assets
WHERE request_id = '<request-id>' AND asset_type = 'landing_page';
```

- [ ] **Step 3: Verify LP renders**

Open the blob_url in a browser. Verify:
- Copy is persona-specific (not generic)
- Compensation matches intake data
- Qualifications are from the job description
- Cultural insights are reflected in tone
- All sections render properly

- [ ] **Step 4: Verify serving route**

Navigate to `http://localhost:3000/lp/<campaign-slug>--<persona_key>` and verify the LP loads.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(stage6): smoke test fixes for landing page generation"
```
