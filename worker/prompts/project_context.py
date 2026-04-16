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
  {'Jobs to be done:' if jtbd_functional else ''}
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
