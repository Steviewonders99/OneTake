# Pipeline Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Stage 3 & 4 drift by implementing layered context system (base knowledge + diamond persona mini brief), Phase 1 graphic copy generation (Gemma 4, per-language, 25% text limit), and Stage 3 enrichment (emotional tone, psychology hooks, campaign tier).

**Architecture:** 3 new Python modules (design_base_knowledge, project_context, stage4_graphic_copy) + modifications to 5 existing files. Phase 1 generates persona-aware graphic copy in target language via Gemma 4 NIM. Phase 2 compositor receives Phase 1 output + project context instead of raw Stage 3 copy. Stage 3 gets emotional tone + psychology hooks injected into variation prompts.

**Tech Stack:** Python 3.13, Gemma 4 31B-IT via NVIDIA NIM, httpx async, existing Neon/Blob infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-12-pipeline-alignment-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `worker/prompts/design_base_knowledge.py` | Layer 1: consolidated 2K-token base knowledge (psychology + brand) |
| `worker/prompts/project_context.py` | Layer 2: `build_project_context()` — diamond persona mini brief builder |
| `worker/pipeline/stage4_graphic_copy.py` | Phase 1: Gemma 4 graphic overlay copy generation (per-language) |

### Modified Files
| File | Changes |
|---|---|
| `worker/prompts/compositor_prompt.py` | Add project context section, filter artifact catalog, template recs, 25% text rule |
| `worker/pipeline/stage4_compose_v3.py` | Wire Phase 1 before Phase 2, build project context, pass to compositor |
| `worker/prompts/recruitment_copy.py` | Inject emotional tone + visual direction into `build_variation_prompts()` |
| `worker/pipeline/stage3_copy.py` | Extract visual_direction + emotional_tone from brief, pass to prompt builder |
| `worker/ai/creative_vqa.py` | Add universal 25% text overlay check (not just WeChat) |

---

## Task 1: Design Base Knowledge (Layer 1)

**Files:**
- Create: `worker/prompts/design_base_knowledge.py`

- [ ] **Step 1: Create the base knowledge module**

This is the single source of truth for design psychology — ~2K tokens, replaces 12K scattered across multiple files. Imported by Phase 1 and Phase 2.

```python
"""Layer 1: Design Base Knowledge — consolidated psychology + brand.

~2K tokens. Injected into Stage 4 Phase 1 (graphic copy) and Phase 2 (composition).
Replaces scattered CONVERSION_SCIENCE + DESIGN_PSYCHOLOGY from creative_overlay.py.
"""

# ── Persona Archetypes (principles, not rules) ──────────────────────

PERSONA_ARCHETYPES = """
TWO BASE PERSONA ARCHETYPES (adapt creatively to each project's specifics):

GIG WORKER ARCHETYPE:
  Who: Flexible workers, freelancers, students, side-hustlers. Age 18-35 typically.
  What stops their scroll: Specific earnings ($60/hr, R$280/dia), low barrier to entry,
    flexibility proof, social proof (contributor count), concrete task description.
  Design energy: Dynamic, bold, numbers-forward, badge-rich, modern feel.
  Headline style: Question + specific number. "Speak Portuguese? Earn $12/hr."
  CTA: Action-oriented, low-friction. "Apply in 2 Minutes →"
  Psychology: social_proof + effort_minimization + concrete_specificity.
  Visual: Floating badges, avatar-stack prominent, stat callouts, bright CTA contrast.

PROFESSIONAL ARCHETYPE:
  Who: Licensed/credentialed workers, medical professionals, engineers, specialists. Age 28-55.
  What stops their scroll: Identity affirmation, research impact, peer credibility,
    institutional trust signals, extension of existing expertise.
  Design energy: Clean, editorial, portrait-dominant, generous whitespace, authority.
  Headline style: Declarative, expertise-affirming. "Your Clinical Expertise Advances AI."
  CTA: Credibility-first, no urgency. "Learn More" or "Join Our Research Team"
  Psychology: identity_appeal + authority + loss_aversion.
  Visual: Large portrait, serif headlines, minimal decoration, muted palette, trust badges.
"""

# ── Core Conversion Science (always true) ────────────────────────────

CONVERSION_SCIENCE = """
CONVERSION SCIENCE (7 rules — apply to EVERY creative):

1. ONE LARGE FACE (50-55% canvas height). Fusiform face area = instant attention.
   NOT multiple small faces. Object-fit: cover, zoom to face.

2. SPLIT LAYOUT (50-55% photo | 45-50% text zone). Z-pattern eye flow.
   Alternate photo left/right across variations for visual diversity.

3. SPECIFIC NUMBERS IN LOCAL CURRENCY. "$60/hr" not "competitive pay."
   R$280/dia for Brazil, €15/Stunde for Germany. Denomination effect + anchoring.

4. QUESTION HEADLINES or SPECIFIC CLAIMS. Self-referencing effect.
   "[Skill]? [Earn $X/hr]" or "[Number] [experts] already [doing thing]."
   Max 7 words on the graphic. Every word must earn its place.

5. TRIPLE BARRIER REMOVAL. What + How paid + What you DON'T need.
   "Review AI translations from home. Weekly pay. No experience needed."

6. AVATAR-STACK SOCIAL PROOF. 3-4 overlapping circles + "+50K contributors."
   Bandwagon effect. 50K is the optimal anchor — large but believable.

7. FRICTION-REDUCING CTA. "Apply in 2 Minutes →" not "Start Earning."
   Time anchor + arrow = action. Pill-shaped, high contrast.
"""

# ── Design Psychology (9 principles) ─────────────────────────────────

DESIGN_PSYCHOLOGY = """
DESIGN PSYCHOLOGY (9 principles — guide your layout decisions):

1. VON RESTORFF (Isolation): ONE visually unique element — the CTA gets pink/purple gradient.
2. F/Z-PATTERN: Headline top-left → photo center → CTA bottom-center.
3. GESTALT PROXIMITY: Headline + sub: 8-12px gap. CTA: 24-40px gap above.
4. HICK'S LAW: ONE headline, ONE sub (optional), ONE CTA. Maximum.
5. COLOR PSYCHOLOGY: Purple = authority/ambition. Pink = energy/action. White = trust.
6. DEPTH LAYERING: 3+ layers (background → semi-transparent overlay → text) = depth illusion.
7. SERIAL POSITION: People remember FIRST (headline) + LAST (CTA). Sub goes in middle.
8. WHITESPACE AS DESIGN: 20-30% empty canvas. Breathing room = trust.
9. AESTHETIC-USABILITY: Smooth radii + subtle shadows + consistent spacing = perceived quality.
"""

# ── OneForma Brand Constants ─────────────────────────────────────────

BRAND_CONSTRAINTS = """
ONEFORMA BRAND (violations auto-fail VQA):
- Colors: deep purple #3D1059→#6B21A8, hot pink CTA #E91E8C. NO gold, NO yellow, NO orange.
- Typography: system fonts (-apple-system, system-ui, "Segoe UI", Roboto). Georgia for serif headlines.
- CTA: pill buttons (border-radius: 9999px), gradient or filled, white uppercase text.
- Photo: ONE LARGE FACE (50-55% canvas height). Not multiple small faces.
- Whitespace: 20-30% intentional blank space.
- Social proof: avatar-stack MANDATORY (3-4 circles + "+50K contributors").
- Blob shapes: NEVER >15% of canvas area. They are accents, not features.
- Text overlay: MUST be under 25% of canvas area. Keep it SHORT.
"""

# ── Template Recommendations by Persona Type ─────────────────────────

TEMPLATE_RECS = {
    "gig": [
        "conversion_split",
        "dark_purple_split",
        "stat_callout",
        "contained_card",
        "conversion_split_reverse",
        "hero_polish",
    ],
    "professional": [
        "editorial_serif_hero",
        "split_zone",
        "photo_minimal",
        "fullbleed_testimonial",
        "editorial_magazine",
        "wavy_mask_split",
    ],
}


def get_base_knowledge() -> str:
    """Return the full base knowledge block (~2K tokens)."""
    return f"""{PERSONA_ARCHETYPES}

{CONVERSION_SCIENCE}

{DESIGN_PSYCHOLOGY}

{BRAND_CONSTRAINTS}"""


def get_template_recs(persona_type: str) -> list[str]:
    """Return recommended template keys for a persona type (gig or professional)."""
    return TEMPLATE_RECS.get(persona_type, TEMPLATE_RECS["gig"])


def classify_persona_type(persona: dict) -> str:
    """Classify a persona as 'gig' or 'professional' based on signals."""
    quals = (persona.get("archetype", "") + " " + persona.get("matched_tier", "")).lower()
    pro_signals = ["licensed", "certified", "degree", "professional", "nurse", "doctor",
                   "engineer", "specialist", "credential", "resident", "researcher",
                   "clinical", "physician", "therapist", "pharmacist"]
    if any(s in quals for s in pro_signals):
        return "professional"
    return "gig"
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/prompts/design_base_knowledge.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/design_base_knowledge.py
git commit -m "feat(pipeline): add design_base_knowledge — Layer 1 consolidated psychology + brand (2K tokens)"
```

---

## Task 2: Project Context Builder (Layer 2 — Diamond Mini Brief)

**Files:**
- Create: `worker/prompts/project_context.py`

- [ ] **Step 1: Create the diamond-level project context builder**

```python
"""Layer 2: Project Context Builder — diamond-level persona mini brief.

Extracts rich Stage 1 data into a focused ~1K token brief per persona.
This is the MOST IMPORTANT piece in the pipeline — if this is weak,
everything downstream is generic. If this is diamond, every creative
feels like it was made by an agency that spent 2 weeks researching.
"""
from __future__ import annotations

from typing import Any


def build_project_context(
    request: dict[str, Any],
    brief: dict[str, Any],
    persona: dict[str, Any],
    cultural_research: dict[str, Any] | None = None,
    strategy: dict[str, Any] | None = None,
    stage3_copy: dict[str, Any] | None = None,
) -> str:
    """Build diamond-level persona mini brief from Stage 1 data.

    Every field is pulled from actual Stage 1 output — no generic
    placeholders, no hardcoded assumptions.
    """
    # ── Campaign context ──────────────────────────────────────────
    title = request.get("title", "Untitled Campaign")
    task_type = request.get("task_type", "unknown")
    regions = request.get("target_regions", [])
    languages = request.get("target_languages", [])
    work_mode = request.get("form_data", {}).get("work_mode", "remote")

    # Narrative angle from brief
    target_audience = brief.get("target_audience", {})
    if isinstance(target_audience, dict):
        narrative = target_audience.get("narrative_angle", "")
    else:
        narrative = ""

    # ── Persona details ───────────────────────────────────────────
    name = persona.get("persona_name", persona.get("name", "Unknown"))
    archetype = persona.get("archetype", "")
    matched_tier = persona.get("matched_tier", "")
    age_range = persona.get("age_range", "")
    region = persona.get("region", regions[0] if regions else "")
    lifestyle = persona.get("lifestyle", "")
    motivations = persona.get("motivations", [])
    pain_points = persona.get("pain_points", [])
    objections = persona.get("objections", [])
    digital_habitat = persona.get("digital_habitat", [])
    best_channels = persona.get("best_channels", [])

    # Psychology
    psychology = persona.get("psychology_profile", {})
    primary_bias = psychology.get("primary_bias", "")
    secondary_bias = psychology.get("secondary_bias", "")
    messaging_angle = psychology.get("messaging_angle", "")
    trigger_words = psychology.get("trigger_words", [])

    # Jobs to be done
    jtbd = persona.get("jobs_to_be_done", {})
    jtbd_functional = jtbd.get("functional", "") if isinstance(jtbd, dict) else ""
    jtbd_emotional = jtbd.get("emotional", "") if isinstance(jtbd, dict) else ""
    jtbd_social = jtbd.get("social", "") if isinstance(jtbd, dict) else ""

    # ── Visual direction ──────────────────────────────────────────
    derived = brief.get("derived_requirements", {})
    if isinstance(derived, str):
        import json
        try:
            derived = json.loads(derived)
        except (ValueError, TypeError):
            derived = {}
    vis = derived.get("visual_direction", {}) if isinstance(derived, dict) else {}
    emotional_tone = vis.get("emotional_tone", "")
    work_environment = vis.get("work_environment", "")
    wardrobe = vis.get("wardrobe", "")
    visible_tools = vis.get("visible_tools", "")
    cultural_adaptations = vis.get("cultural_adaptations", "")

    # ── Cultural research ─────────────────────────────────────────
    cultural_block = ""
    if cultural_research and isinstance(cultural_research, dict):
        region_data = cultural_research.get(region, {})
        if isinstance(region_data, dict):
            lang_nuance = _extract_insight(region_data, "language_nuance")
            gig_perception = _extract_insight(region_data, "gig_work_perception")
            trust = _extract_insight(region_data, "data_annotation_trust", "trust_builders")
            platforms = _extract_insight(region_data, "platform_reality", "top_platforms_ranked")
            if any([lang_nuance, gig_perception, trust, platforms]):
                cultural_block = f"""
CULTURAL CONTEXT ({region}):
  Language nuance: {lang_nuance}
  Gig perception: {gig_perception}
  Trust builders: {trust}
  Platform reality: {platforms}"""

    # ── Campaign strategy ─────────────────────────────────────────
    strategy_block = ""
    pillar_weighting = derived.get("pillar_weighting", {}) if isinstance(derived, dict) else {}
    if pillar_weighting:
        primary_pillar = pillar_weighting.get("primary", "earn")
        secondary_pillar = pillar_weighting.get("secondary", "grow")
        strategy_block = f"\nCAMPAIGN STRATEGY:\n  Primary pillar: {primary_pillar}\n  Secondary pillar: {secondary_pillar}"
    if strategy and isinstance(strategy, dict):
        tier = strategy.get("tier", "")
        split_test = strategy.get("split_test_variable", "")
        if tier:
            strategy_block += f"\n  Tier: {tier}"
        if split_test:
            strategy_block += f"\n  Split test: {split_test}"

    # ── Stage 3 copy reference ────────────────────────────────────
    copy_block = ""
    if stage3_copy and isinstance(stage3_copy, dict):
        s3_primary = stage3_copy.get("primary_text", stage3_copy.get("caption", ""))
        s3_headline = stage3_copy.get("headline", "")
        s3_lang = stage3_copy.get("language", "en")
        if s3_primary or s3_headline:
            copy_block = f"""
STAGE 3 AD COPY (your overlay text must COMPLEMENT this — same message, different format):
  Primary: {s3_primary[:300] if s3_primary else 'N/A'}
  Headline: {s3_headline}
  Language: {s3_lang}"""

    # ── Assemble the diamond mini brief ───────────────────────────
    mots = "\n    ".join(f"- {m}" for m in motivations[:4]) if motivations else "Not specified"
    pains = "\n    ".join(f"- {p}" for p in pain_points[:4]) if pain_points else "Not specified"
    objs = "\n    ".join(f"- {o}" for o in objections[:3]) if objections else "Not specified"
    triggers = ", ".join(trigger_words[:8]) if trigger_words else "Not specified"
    habitat = ", ".join(digital_habitat[:4]) if digital_habitat else "Not specified"
    channels = ", ".join(best_channels[:5]) if best_channels else "Not specified"

    return f"""═══ CAMPAIGN CONTEXT ═══
Campaign: {title} — {task_type}
Regions: {', '.join(regions[:5]) if regions else 'Global'} | Languages: {', '.join(languages[:3]) if languages else 'English'}
Work mode: {work_mode}
{f'Narrative angle: {narrative}' if narrative else ''}

═══ PERSONA MINI BRIEF: {name} ═══

WHO THEY ARE:
  Archetype: {archetype}
  {f'Matched tier: {matched_tier}' if matched_tier else ''}
  Age: {age_range} | Region: {region}
  {f'Lifestyle: {lifestyle}' if lifestyle else ''}

WHAT DRIVES THEM:
  Motivations:
    {mots}
  Pain points:
    {pains}
  Objections:
    {objs}
  {f'Jobs to be done:' if jtbd_functional else ''}
  {f'  Functional: {jtbd_functional}' if jtbd_functional else ''}
  {f'  Emotional: {jtbd_emotional}' if jtbd_emotional else ''}
  {f'  Social: {jtbd_social}' if jtbd_social else ''}

HOW TO REACH THEM:
  Psychology: {primary_bias} (primary){f' + {secondary_bias} (secondary)' if secondary_bias else ''}
  {f'Messaging angle: {messaging_angle}' if messaging_angle else ''}
  Trigger words: {triggers}
  Digital habitat: {habitat}
  Best channels: {channels}

HOW THEY SHOULD FEEL:
  {f'Emotional tone: {emotional_tone}' if emotional_tone else ''}
  {f'Visual environment: {work_environment}' if work_environment else ''}
  {f'Wardrobe cues: {wardrobe}' if wardrobe else ''}
  {f'Props/tools: {visible_tools}' if visible_tools else ''}
  {f'Cultural adaptations: {cultural_adaptations}' if cultural_adaptations else ''}
{cultural_block}
{strategy_block}
{copy_block}""".strip()


def _extract_insight(
    region_data: dict,
    dimension_key: str,
    sub_key: str | None = None,
) -> str:
    """Extract a single insight string from cultural research data."""
    dim = region_data.get(dimension_key, {})
    if isinstance(dim, str):
        return dim[:200]
    if isinstance(dim, dict):
        if sub_key and sub_key in dim:
            val = dim[sub_key]
            return val[:200] if isinstance(val, str) else str(val)[:200]
        # Try common summary keys
        for key in ("summary", "key_finding", "sentiment", "perception"):
            if key in dim:
                return str(dim[key])[:200]
    return ""
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/prompts/project_context.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/project_context.py
git commit -m "feat(pipeline): add project_context builder — diamond-level persona mini brief from Stage 1 data"
```

---

## Task 3: Phase 1 — Graphic Copy Generation

**Files:**
- Create: `worker/pipeline/stage4_graphic_copy.py`

- [ ] **Step 1: Create Phase 1 graphic copy generator**

```python
"""Stage 4 Phase 1: Graphic Overlay Copy Generation.

Generates persona-aware, language-correct overlay text (headline, sub, CTA)
using Gemma 4 31B-IT via NVIDIA NIM. Complements Stage 3 ad copy.

Key constraints:
  - Text in target language (persona-specific — pt-BR for Brazil, de for Germany)
  - Total text under 25% of canvas area
  - Must COMPLEMENT (not duplicate) Stage 3 ad copy
  - Design intent output guides Phase 2 composition
"""
from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GEMMA4_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))

# Language code → display name for prompt clarity
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English", "pt": "Portuguese", "pt-BR": "Brazilian Portuguese",
    "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
    "ar": "Arabic", "ja": "Japanese", "ko": "Korean", "zh": "Mandarin Chinese",
    "hi": "Hindi", "id": "Indonesian", "th": "Thai", "vi": "Vietnamese",
    "tr": "Turkish", "pl": "Polish", "ro": "Romanian", "nl": "Dutch",
    "ru": "Russian", "uk": "Ukrainian", "sv": "Swedish", "da": "Danish",
    "fi": "Finnish", "no": "Norwegian", "el": "Greek", "he": "Hebrew",
    "tl": "Filipino",
}


def _compute_text_budget(width: int, height: int) -> dict[str, int]:
    """Compute text budget for 25% overlay limit."""
    canvas_pixels = width * height
    max_text_pixels = int(canvas_pixels * 0.25)
    # Rough: each char ~20px wide × ~40px tall at typical overlay sizes
    max_chars = max_text_pixels // (20 * 40)
    return {
        "canvas_pixels": canvas_pixels,
        "max_text_pixels": max_text_pixels,
        "max_chars": max(max_chars, 30),  # floor at 30 chars minimum
    }


async def generate_graphic_copy(
    base_knowledge: str,
    project_context: str,
    language: str,
    platform: str,
    platform_spec: dict[str, Any],
) -> dict[str, str]:
    """Generate graphic overlay copy via Gemma 4 on NIM.

    Returns dict with overlay_headline, overlay_sub, overlay_cta, design_intent.
    Falls back to safe defaults on failure.
    """
    if not GEMMA4_KEY:
        logger.warning("No Gemma 4 key — returning default graphic copy")
        return _default_copy(language)

    lang_name = LANGUAGE_NAMES.get(language, language)
    budget = _compute_text_budget(platform_spec["width"], platform_spec["height"])

    prompt = f"""{base_knowledge}

{project_context}

═══ TASK: GENERATE GRAPHIC OVERLAY TEXT ═══

Platform: {platform} ({platform_spec['width']}x{platform_spec['height']})

LANGUAGE: Write ALL overlay text in {lang_name} ({language}).
Use natural, local phrasing — not translated-from-English.

TEXT BUDGET (25% canvas limit):
  Canvas: {platform_spec['width']}x{platform_spec['height']} = {budget['canvas_pixels']:,} pixels
  Max text area: {budget['max_text_pixels']:,} pixels (~{budget['max_chars']} characters total)
  Keep it SHORT. Every word must earn its place.

RULES:
- The overlay text goes ON the image — it must stop the scroll in <1 second.
- It must COMPLEMENT (not duplicate) the Stage 3 ad copy shown above.
- Headline: 3-7 words MAX. Scroll-stopping. In {lang_name}.
- Subheadline: 1 short supporting line. In {lang_name}. Can be omitted if headline is strong enough.
- CTA: 2-4 words. Button text. In {lang_name}.
- Design intent: 1 sentence in ENGLISH explaining your creative angle for Phase 2.

Return ONLY valid JSON:
{{
  "overlay_headline": "3-7 words in {lang_name}",
  "overlay_sub": "1 short line in {lang_name} (or empty string if not needed)",
  "overlay_cta": "2-4 words in {lang_name}",
  "design_intent": "1 sentence in English: why this angle works for this persona",
  "language": "{language}"
}}"""

    try:
        payload = {
            "model": GEMMA4_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 512,
            "temperature": 0.7,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GEMMA4_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"].get("content", "")
        result = _parse_json(content)

        if result and "overlay_headline" in result:
            result.setdefault("language", language)
            logger.info(
                "Phase 1 graphic copy: headline='%s' lang=%s",
                result["overlay_headline"][:50], language,
            )
            return result

        logger.warning("Phase 1: could not parse Gemma 4 response — using defaults")
        return _default_copy(language)

    except Exception as e:
        logger.error("Phase 1 graphic copy failed: %s — using defaults", e)
        return _default_copy(language)


def _parse_json(text: str) -> dict | None:
    """Parse JSON from LLM response with fallbacks."""
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Brace-matching fallback
    start = cleaned.find("{")
    if start == -1:
        return None

    depth = 0
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _default_copy(language: str) -> dict[str, str]:
    """Safe fallback copy when Gemma 4 fails."""
    defaults: dict[str, dict[str, str]] = {
        "pt": {"overlay_headline": "Comece a Ganhar Hoje", "overlay_sub": "Trabalhe de qualquer lugar", "overlay_cta": "Inscreva-se"},
        "pt-BR": {"overlay_headline": "Comece a Ganhar Hoje", "overlay_sub": "Trabalhe de qualquer lugar", "overlay_cta": "Inscreva-se"},
        "es": {"overlay_headline": "Empieza a Ganar Hoy", "overlay_sub": "Trabaja desde cualquier lugar", "overlay_cta": "Únete Ahora"},
        "fr": {"overlay_headline": "Commencez à Gagner", "overlay_sub": "Travaillez de n'importe où", "overlay_cta": "Postulez"},
        "de": {"overlay_headline": "Jetzt Geld Verdienen", "overlay_sub": "Arbeiten Sie von überall", "overlay_cta": "Jetzt Bewerben"},
        "ar": {"overlay_headline": "ابدأ الكسب اليوم", "overlay_sub": "اعمل من أي مكان", "overlay_cta": "سجّل الآن"},
    }
    fallback = defaults.get(language, {
        "overlay_headline": "Start Earning Today",
        "overlay_sub": "Work from anywhere",
        "overlay_cta": "Apply Now",
    })
    return {**fallback, "design_intent": "Default fallback — Gemma 4 unavailable", "language": language}
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/pipeline/stage4_graphic_copy.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage4_graphic_copy.py
git commit -m "feat(pipeline): add Phase 1 graphic copy generation — Gemma 4, per-language, 25% text budget"
```

---

## Task 4: Update Compositor Prompt (Phase 2)

**Files:**
- Modify: `worker/prompts/compositor_prompt.py`

- [ ] **Step 1: Read the current file**

Read `worker/prompts/compositor_prompt.py` in full.

- [ ] **Step 2: Add project context section + artifact filtering + 25% text rule**

Three changes:

**Change 1:** Add a new `_section_project_context()` function after `_section_archetype()`:

```python
def _section_project_context(project_context: str, design_intent: str) -> str:
    """Build project context section with persona mini brief + design intent."""
    return f"""PROJECT CONTEXT (understand WHO this creative is for and WHY):

{project_context}

DESIGN INTENT (from copy strategist — design to support this angle):
{design_intent}

Use this context to make CREATIVE design decisions:
- Choose artifacts that match the persona's psychology type
- Adjust visual weight based on emotional tone
- A clinical professional should FEEL different from a gig worker
- Let the persona's trigger words and motivations guide your aesthetic choices"""
```

**Change 2:** Add artifact filtering function:

```python
def filter_catalog(catalog: list[dict], pillar: str, platform: str) -> list[dict]:
    """Filter artifact catalog by pillar and format affinity."""
    filtered = []
    for a in catalog:
        pillar_match = not a.get("pillar_affinity") or pillar in a["pillar_affinity"]
        format_match = not a.get("format_affinity") or platform in a["format_affinity"]
        if pillar_match and format_match:
            filtered.append(a)
    # Always include at least the full catalog if filtering is too aggressive
    return filtered if len(filtered) >= 4 else catalog
```

**Change 3:** Update `_section_inputs()` to include 25% text rule when Phase 1 copy is provided:

After the existing PERSON POSITIONING block, add:

```python
    # 25% text overlay enforcement
    text_rule = ""
    if copy.get("overlay_headline"):
        text_rule = f"""
TEXT OVERLAY RULE (HARD LIMIT — 25% max):
  The graphic copy has been pre-generated and length-optimized. Do NOT add extra text.
  Headline: {copy.get('overlay_headline', '')}
  Sub: {copy.get('overlay_sub', '')}
  CTA: {copy.get('overlay_cta', '')}
  Design around this text exactly as provided. Do NOT modify it."""
```

Append `text_rule` to the return string.

**Change 4:** Update `build_compositor_prompt()` signature to accept new params:

```python
def build_compositor_prompt(
    catalog: list[dict[str, Any]],
    archetype: str,
    platform: str,
    platform_spec: dict[str, Any],
    pillar: str,
    actor: dict[str, Any],
    copy: dict[str, Any],
    visual_direction: dict[str, Any] | None = None,
    project_context: str = "",
    design_intent: str = "",
) -> str:
```

And insert the project context section between archetype and inputs:

```python
    sections = [
        _section_role(),
        build_artifact_catalog_section(catalog),
        _section_archetype(archetype),
        _section_project_context(project_context, design_intent) if project_context else "",
        _section_inputs(platform, platform_spec, pillar, actor, copy, visual_direction or {}),
        _section_brand_rules(),
        _section_output_format(platform_spec["width"], platform_spec["height"]),
    ]
    return "\n\n---\n\n".join(s for s in sections if s)
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/prompts/compositor_prompt.py').read()); print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add worker/prompts/compositor_prompt.py
git commit -m "feat(pipeline): update compositor prompt — project context, artifact filtering, 25% text rule"
```

---

## Task 5: Wire Phase 1 into Stage 4 Compose

**Files:**
- Modify: `worker/pipeline/stage4_compose_v3.py`

- [ ] **Step 1: Read the current file**

Read `worker/pipeline/stage4_compose_v3.py` in full.

- [ ] **Step 2: Add imports and wire Phase 1 into `_compose_one()`**

Add imports at the top:

```python
from prompts.design_base_knowledge import get_base_knowledge, classify_persona_type, get_template_recs
from prompts.project_context import build_project_context
from prompts.compositor_prompt import filter_catalog
from pipeline.stage4_graphic_copy import generate_graphic_copy
```

In `run_stage4()`, after loading actors and copy, also load cultural research and personas:

```python
    # ── Load cultural research + personas for project context ─────
    cultural_research: dict = context.get("cultural_research", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    strategies: list[dict] = context.get("strategies", [])
```

Add cultural_research, personas, and strategies to the `_compose_one()` call in the tasks list.

In `_compose_one()`, add new parameters and wire Phase 1:

```python
async def _compose_one(
    semaphore, request_id, actor, pillar, platform,
    catalog, copy_lookup, visual_direction, brief,
    user_feedback,
    cultural_research=None, personas=None, strategies=None,  # NEW
):
```

Inside `_compose_one()`, BEFORE the existing prompt building, insert Phase 1:

```python
        # ── NEW: Build project context (Layer 2) ─────────────────────
        # Match actor to persona by name
        actor_name = actor.get("name", "")
        matched_persona = {}
        for p in (personas or []):
            pname = p.get("persona_name", p.get("name", ""))
            if pname and actor_name and (
                pname.lower().startswith(actor_name.split()[0].lower()) or
                actor_name.lower().startswith(pname.split()[0].lower())
            ):
                matched_persona = p
                break
        if not matched_persona and personas:
            matched_persona = personas[0]  # fallback to first persona

        # Resolve strategy for this region
        persona_region = matched_persona.get("region", "")
        matched_strategy = {}
        for s in (strategies or []):
            if isinstance(s, dict) and s.get("country", "").upper() == persona_region.upper():
                matched_strategy = s.get("strategy_data", s)
                break

        project_ctx = build_project_context(
            request=brief,
            brief=brief,
            persona=matched_persona,
            cultural_research=cultural_research,
            strategy=matched_strategy,
            stage3_copy=copy,
        )

        # ── NEW: Phase 1 — Generate graphic copy (Gemma 4) ──────────
        base_knowledge = get_base_knowledge()
        graphic_copy = await generate_graphic_copy(
            base_knowledge=base_knowledge,
            project_context=project_ctx,
            language=copy.get("language", "en"),
            platform=platform,
            platform_spec=spec,
        )

        # ── NEW: Filter artifacts by pillar + platform ───────────────
        filtered_catalog = filter_catalog(catalog, pillar, platform)

        # Select archetype (existing)
        archetype = select_archetype(pillar, visual_direction, platform)

        # Build compositor prompt with Phase 1 output + project context
        prompt = build_compositor_prompt(
            catalog=filtered_catalog,  # was: catalog
            archetype=archetype,
            platform=platform,
            platform_spec=spec,
            pillar=pillar,
            actor=actor,
            copy=graphic_copy,  # was: copy (Stage 3) — now Phase 1 output
            visual_direction=visual_direction,
            project_context=project_ctx,  # NEW
            design_intent=graphic_copy.get("design_intent", ""),  # NEW
        )
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/pipeline/stage4_compose_v3.py').read()); print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage4_compose_v3.py
git commit -m "feat(pipeline): wire Phase 1 graphic copy + project context into Stage 4 composition"
```

---

## Task 6: Enrich Stage 3 Copy

**Files:**
- Modify: `worker/pipeline/stage3_copy.py`
- Modify: `worker/prompts/recruitment_copy.py`

- [ ] **Step 1: Extract visual_direction in Stage 3**

In `worker/pipeline/stage3_copy.py`, inside `run_stage3()`, after extracting `pillar_weighting` (line ~219), add:

```python
    # Extract visual direction for emotional tone injection
    visual_direction = derived_req.get("visual_direction", {}) if isinstance(derived_req, dict) else {}
    emotional_tone = visual_direction.get("emotional_tone", "")
```

Then pass `emotional_tone` to `build_variation_prompts()`:

```python
                    variations = build_variation_prompts(
                        persona=persona,
                        brief=brief,
                        channel=channel,
                        language=language,
                        regions=regions,
                        form_data=form_data,
                        pillar_weighting=pillar_weighting,
                        cultural_context=cultural_context,
                        emotional_tone=emotional_tone,  # NEW
                    )
```

- [ ] **Step 2: Inject emotional tone into copy prompts**

In `worker/prompts/recruitment_copy.py`, update `build_variation_prompts()` signature:

```python
def build_variation_prompts(
    persona: dict,
    brief: dict,
    channel: str,
    language: str,
    regions: list[str] | None = None,
    form_data: dict | None = None,
    pillar_weighting: dict | None = None,
    cultural_context: str | None = None,
    emotional_tone: str = "",  # NEW
) -> list[dict[str, str]]:
```

Inside the function, after the `angle_instruction` string (line ~1407), add an emotional tone block:

```python
        # Emotional tone from visual direction (Stage 1)
        tone_block = ""
        if emotional_tone:
            tone_block = (
                f"\n\nEMOTIONAL TONE (from project visual direction): {emotional_tone}\n"
                f"Write copy that FEELS {emotional_tone}. This persona is a "
                f"{persona.get('archetype', 'contributor')} — adapt your word choice, "
                f"sentence structure, and energy level to match this tone.\n"
            )
```

Then append `tone_block` to the user prompt in the variation dict (between `cultural_block` and the separator):

```python
        variations.append({
            "angle": f"pillar_{pillar_key}",
            "pillar": pillar_key,
            "bias": sub_bias,
            "cta": cta_str,
            "system": system,
            "user": f"""{angle_instruction}
{facts_block}

{persona_block}
{tone_block}
{cultural_block}
---
{base_prompt}""",
        })
```

- [ ] **Step 3: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/pipeline/stage3_copy.py').read()); print('OK')" && python3 -c "import ast; ast.parse(open('worker/prompts/recruitment_copy.py').read()); print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage3_copy.py worker/prompts/recruitment_copy.py
git commit -m "feat(pipeline): enrich Stage 3 copy with emotional tone from visual direction"
```

---

## Task 7: Universal 25% Text Overlay VQA Check

**Files:**
- Modify: `worker/ai/creative_vqa.py`

- [ ] **Step 1: Add universal text overlay check to Phase 1 deterministic checks**

In `worker/ai/creative_vqa.py`, in the `check_deterministic()` function, find the existing WeChat-specific text overlay check (the section starting with `# 10. WeChat 20% text overlay rule`).

Add a UNIVERSAL 25% check BEFORE the WeChat-specific one:

```python
    # 10. Universal 25% text overlay limit
    headline = design.get("overlay_headline", headline)  # prefer Phase 1 overlay if available
    sub_text = design.get("overlay_sub", design.get("subheadline", ""))
    total_overlay_chars = len(headline) + len(sub_text) + len(cta)
    if total_overlay_chars > 0:
        est_overlay_pixels = total_overlay_chars * 20 * 40
        canvas_px = spec.get("width", 1080) * spec.get("height", 1080)
        overlay_pct = (est_overlay_pixels / canvas_px) * 100
        checks["text_overlay_under_25pct"] = overlay_pct <= 25
        if overlay_pct > 25:
            issues.append(
                f"Text overlay ~{overlay_pct:.0f}% exceeds 25% limit — "
                f"total {total_overlay_chars} chars. Shorten headline or remove subheadline."
            )

    # 11. WeChat 20% text overlay rule (stricter, platform-specific)
```

Update the WeChat section comment number from 10 to 11.

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/ai/creative_vqa.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add worker/ai/creative_vqa.py
git commit -m "feat(pipeline): add universal 25% text overlay VQA check — not just WeChat"
```
