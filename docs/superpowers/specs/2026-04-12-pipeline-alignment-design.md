# Pipeline Alignment — Stage 3 & 4 Context Injection + Phase 1 Graphic Copy

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved

## Problem

Stage 1 generates rich, nuanced data (personas with psychology profiles, cultural research, visual direction, campaign strategy tiers). By the time it reaches Stages 3 & 4, most of this data is dropped or flattened. Clinical dermatology studies get the same casual gig-worker aesthetic. Regional cultural norms are ignored in composition. Campaign tier pillar splits don't match creative volume.

## Solution

Three changes:
1. **Layered context system** replacing 12K tokens of scattered psychology prompt injection with focused 2K base knowledge + 1K per-project context
2. **Stage 4 Phase 1: Graphic Copy Generation** — new step generating persona-aware, language-correct overlay text (headline, sub, CTA) that complements Stage 3 ad copy
3. **Stage 3 enrichment** — inject emotional tone, psychology hooks, and campaign tier into copy generation

## Architecture

```
Stage 1 (Brief, Personas, Research, Strategy)
  ↓
Stage 2 (Actor Images — already uses visual_direction ✓)
  ↓
Stage 3 (Ad Copy + Organic Social — ENRICHED with emotional tone, psychology, tier)
  ↓
Stage 4 Phase 1 (Graphic Copy — per-persona, per-language, complements Stage 3)
  ↓
Stage 4 Phase 2 (Visual Composition — receives Phase 1 output + project context)
  ↓
VQA Gate (includes 25% text overlay check + person visibility)
```

## Layered Context System

### Layer 1: Base Knowledge (~2K tokens)
**File:** `worker/prompts/design_base_knowledge.py`

Single source of truth. Injected into Phase 1 and Phase 2. Contains:

**2 persona archetypes as PRINCIPLES (not rules):**
- **Gig Worker** — responds to: earnings specificity, flexibility proof, effort minimization, social proof (contributor count). Design energy: dynamic, bold, numbers-forward, badge-rich. Headline style: question + specific number. CTA: action-oriented, low-friction.
- **Professional** — responds to: identity appeal, authority, credibility signals, impact framing. Design energy: clean, editorial, portrait-dominant, generous whitespace. Headline style: declarative, expertise-affirming. CTA: credibility-first, no urgency.

**Core conversion science (7 rules — always true):**
1. ONE LARGE FACE > many small (50-55% canvas, fusiform face area)
2. Split layout default (50-55% photo, Z-pattern flow)
3. Specific numbers in local currency (denomination effect)
4. Question headlines or specific claims (self-referencing effect)
5. Triple barrier removal (what + how paid + what you DON'T need)
6. Avatar-stack social proof (3-4 circles + count, bandwagon effect)
7. Friction-reducing CTA ("Apply in 2 Min →", time anchor)

**Design psychology essentials (9 principles):**
Von Restorff, F/Z-pattern, Gestalt proximity, Hick's Law, color psychology, depth layering, serial position, whitespace as design, aesthetic-usability

**OneForma brand constraints:**
Colors (purple #3D1059→#6B21A8, pink CTA #E91E8C), system fonts + Georgia serif, pill CTAs, no gold/yellow/orange

### Layer 2: Project Context (~1K tokens, computed per campaign)
**Function:** `build_project_context()` in `worker/prompts/project_context.py`

Extracts and formats Stage 1 data into a focused brief:

```python
def build_project_context(
    request: dict,
    brief: dict,
    persona: dict,
    cultural_research: dict | None,
    strategy: dict | None,
    stage3_copy: dict | None,
) -> str:
```

Output format:
```
PROJECT CONTEXT:
Campaign: {title} — {task_type}
Regions: {regions} | Languages: {languages}
Work mode: {onsite/remote} | Budget tier: {tier}

PERSONA: {name} — {archetype description}
Demographics: {age_range}, {region}, {occupation}
Psychology: {primary_bias} (primary), {secondary_bias} (secondary)
Trigger words: {trigger_words}
Emotional tone: {emotional_tone}
Motivations: {motivations}
Pain points: {pain_points}

CULTURAL CONTEXT ({region}):
{top 3 cultural research insights — language nuance, platform reality, gig perception}

VISUAL DIRECTION:
Work environment: {work_environment}
Wardrobe: {wardrobe}
Visible tools: {visible_tools}
Emotional tone: {emotional_tone}
Cultural adaptations: {cultural_adaptations}

CAMPAIGN STRATEGY:
Pillar split: {earn}% Earn / {grow}% Grow / {shape}% Shape
Split test: {split_test_variable}

STAGE 3 AD COPY (complement this — same message, different format):
Primary: {stage3_primary_text}
Headline: {stage3_headline}
Language: {language}
```

### Layer 3: Per-Composition Inputs
Existing data: actor photo URL, platform spec, pillar, available artifacts.
Flows into Phase 1, NOT directly to Phase 2.

## Stage 4 Phase 1: Graphic Copy Generation

**File:** `worker/pipeline/stage4_graphic_copy.py`

**Model:** Gemma 4 (via NVIDIA NIM) — same model as VQA, good at understanding visual context

**Input:**
- Layer 1 (base knowledge)
- Layer 2 (project context — includes Stage 3 copy to complement)
- Target language (from `copy.language` — e.g., "pt-BR" for Brazil, "de" for Germany, "fr" for Morocco)
- Platform spec (dimensions, for text budget calculation)

**Prompt:**
```
{Layer 1 — base knowledge}

{Layer 2 — project context with Stage 3 copy}

TASK: Generate graphic overlay text for a {platform} creative in {language_name}.

The overlay text goes ON the image — it must stop the scroll in <1 second.
It must COMPLEMENT (not duplicate) the Stage 3 ad copy shown above.

LANGUAGE: Write ALL overlay text in {language_name} ({language_code}).
This creative targets {region} — use natural, local phrasing.

TEXT BUDGET: The graphic text must occupy LESS THAN 25% of the canvas area.
Canvas: {width}x{height} = {total_pixels} pixels.
Max text area: {max_text_pixels} pixels (~{max_chars} characters total across all fields).
Keep it SHORT. Every word must earn its place.

Return ONLY valid JSON:
{
  "overlay_headline": "3-7 words, scroll-stopping, in {language_name}",
  "overlay_sub": "1 short line supporting the headline, in {language_name}",
  "overlay_cta": "2-4 word CTA button text, in {language_name}",
  "design_intent": "1 sentence in English explaining WHY you chose this angle for this persona"
}
```

**Output:** `overlay_headline`, `overlay_sub`, `overlay_cta`, `design_intent` — all in the target language except `design_intent` (English, for compositor context).

**Text budget calculation:**
```python
canvas_pixels = spec["width"] * spec["height"]
max_text_pixels = canvas_pixels * 0.25
# Rough: each char ~20px wide × ~40px tall at typical overlay sizes
max_chars = int(max_text_pixels / (20 * 40))
```

## Stage 4 Phase 2: Composition (Modified)

**Changes to `worker/prompts/compositor_prompt.py`:**

### New prompt section: Project Context + Design Intent
Added between archetype constraints and creative inputs:

```python
def _section_project_context(project_context: str, design_intent: str) -> str:
    return f"""PROJECT CONTEXT (understand WHO this creative is for and WHY):
{project_context}

DESIGN INTENT (from copy strategist — design to support this angle):
{design_intent}

Use this context to make CREATIVE design decisions:
- Choose artifacts that match the persona's psychology type
- Adjust visual weight based on emotional tone
- The design should FEEL different for a clinical professional vs a gig worker
"""
```

### Filtered artifact catalog
Instead of injecting all 14 artifacts, filter by pillar_affinity and format_affinity:

```python
def _filter_catalog(catalog: list, pillar: str, platform: str) -> list:
    return [a for a in catalog if
        (not a.get("pillar_affinity") or pillar in a["pillar_affinity"]) and
        (not a.get("format_affinity") or platform in a["format_affinity"])]
```

### Template recommendations
Based on persona type (gig vs professional), include 3-4 relevant HTML reference templates instead of none:

```python
PERSONA_TEMPLATES = {
    "gig": ["conversion_split", "dark_purple_split", "stat_callout", "contained_card"],
    "professional": ["editorial_serif_hero", "split_zone", "photo_minimal", "fullbleed_testimonial"],
}
```

### Modified compositor prompt (7 sections, was 6):
1. Role (unchanged)
2. Filtered artifact catalog (was all 14, now ~6-8 matching)
3. Archetype constraints (unchanged)
4. **NEW: Project context + design intent**
5. Creative inputs (platform, actor, **Phase 1 copy** not Stage 3 copy, **template recommendations**)
6. Brand rules (trimmed — core constraints from Layer 1)
7. Output format (unchanged)

### 25% text overlay enforcement
Added to brand rules section:
```
- TEXT OVERLAY: Must occupy LESS THAN 25% of canvas area. This is a HARD LIMIT.
  The overlay text has been pre-optimized for length — do NOT add extra text.
  Headline: {overlay_headline}
  Sub: {overlay_sub}
  CTA: {overlay_cta}
  Do NOT modify this text. Design around it.
```

## Stage 3 Enrichment

**Changes to `worker/pipeline/stage3_copy.py`:**

Extract and pass to prompt builder:
1. `emotional_tone` from `brief.derived_requirements.visual_direction.emotional_tone`
2. `psychology_hooks` from `brief.target_audience.psychology_hooks_by_persona`
3. `campaign_tier_pillar_split` from `brief.campaign_strategies_summary` — adjusts how many copy variations per pillar (Tier 2 with 60% Earn → 60% of copy is Earn-pillar)

**Changes to `worker/prompts/recruitment_copy.py`:**

In `build_variation_prompts()`, inject:
- Emotional tone into the tone guidance: "Write with {emotional_tone} energy — this persona is a {persona_type}"
- Psychology hooks: "This persona responds to {primary_bias}. Lead with {messaging_angle}. Use trigger words: {trigger_words}"

## VQA Updates

**25% text overlay check** — add to Phase 1 deterministic checks in `creative_vqa.py`:

```python
# Universal 25% text overlay limit (not just WeChat)
headline = design.get("overlay_headline", "")
sub = design.get("overlay_sub", "")
cta = design.get("overlay_cta", "")
total_chars = len(headline) + len(sub) + len(cta)
est_text_pixels = total_chars * 20 * 40
canvas_pixels = spec.get("width", 1080) * spec.get("height", 1080)
est_pct = (est_text_pixels / canvas_pixels) * 100
checks["text_overlay_under_25pct"] = est_pct <= 25
if est_pct > 25:
    issues.append(f"Text overlay ~{est_pct:.0f}% exceeds 25% limit — shorten headline or subheadline")
```

## Pipeline Flow (Updated `_compose_one()`)

```python
async def _compose_one(...):
    spec = PLATFORM_SPECS[platform]

    # 1. Get Stage 3 copy for this pillar/platform
    stage3_copy = _get_copy_for_pillar_platform(copy_lookup, pillar, platform)

    # 2. Build project context (Layer 2)
    project_ctx = build_project_context(
        request=brief, persona=persona_for_actor,
        cultural_research=cultural_research,
        strategy=strategy, stage3_copy=stage3_copy,
    )

    # 3. Phase 1: Generate graphic copy (Gemma 4)
    graphic_copy = await generate_graphic_copy(
        base_knowledge=DESIGN_BASE_KNOWLEDGE,
        project_context=project_ctx,
        language=stage3_copy.get("language", "en"),
        platform=platform, platform_spec=spec,
    )

    # 4. Filter artifacts by pillar + platform
    filtered_catalog = _filter_catalog(catalog, pillar, platform)

    # 5. Select archetype
    archetype = select_archetype(pillar, visual_direction, platform)

    # 6. Build compositor prompt (Phase 2) with project context + Phase 1 copy
    prompt = build_compositor_prompt(
        catalog=filtered_catalog,
        archetype=archetype,
        platform=platform, platform_spec=spec,
        pillar=pillar, actor=actor,
        copy=graphic_copy,  # Phase 1 output, NOT Stage 3
        visual_direction=visual_direction,
        project_context=project_ctx,
        design_intent=graphic_copy.get("design_intent", ""),
        template_recommendations=get_template_recs(persona_type),
    )

    # 7. Call GLM-5 → render → VQA → save (existing flow)
    ...
```

## Files Summary

| File | Action | What |
|---|---|---|
| `worker/prompts/design_base_knowledge.py` | CREATE | Layer 1 — consolidated 2K token base knowledge |
| `worker/prompts/project_context.py` | CREATE | `build_project_context()` — Layer 2 builder |
| `worker/pipeline/stage4_graphic_copy.py` | CREATE | Phase 1 — Gemma 4 graphic copy generation |
| `worker/prompts/compositor_prompt.py` | MODIFY | Add project context section, filter artifacts, template recs, 25% text rule |
| `worker/pipeline/stage4_compose_v3.py` | MODIFY | Wire Phase 1 before Phase 2, pass project context |
| `worker/prompts/recruitment_copy.py` | MODIFY | Inject emotional tone + psychology hooks |
| `worker/pipeline/stage3_copy.py` | MODIFY | Extract visual_direction + campaign tier |
| `worker/ai/creative_vqa.py` | MODIFY | Add universal 25% text overlay check |

**Total:** 3 new files, 5 modified files
