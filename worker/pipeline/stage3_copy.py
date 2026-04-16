"""Stage 3: Copy Generation — Persona-Targeted.

1. Load brief + personas + channel research from context.
2. For each persona × channel × language, generate tailored copy via Gemma 3 27B.
3. Evaluate copy against persona fit (trigger words, pain points, specificity).
4. Save copy data as generated_assets to Neon.

Key difference from v1: copy is generated PER PERSONA, not per channel.
Each persona gets copy that speaks directly to their psychology, pain points,
and motivations — not generic "OneForma is hiring" language.
"""
from __future__ import annotations

import json
import logging

from ai.local_llm import generate_copy
from neon_client import save_asset
from prompts.project_context import build_project_context
from prompts.recruitment_copy import (
    COPY_SYSTEM_PROMPT,
    build_copy_prompt,
    build_variation_prompts,
)

# ── Region → Language mapping ─────────────────────────────────────────
# Used when target_languages is empty but target_regions is populated.

REGION_LANGUAGE_MAP: dict[str, str] = {
    "BR": "Portuguese", "MX": "Spanish", "CO": "Spanish", "AR": "Spanish",
    "CL": "Spanish", "PE": "Spanish", "JP": "Japanese", "KR": "Korean",
    "CN": "Mandarin Chinese", "TW": "Traditional Chinese", "DE": "German",
    "FR": "French", "IT": "Italian", "PT": "Portuguese", "MA": "French",
    "EG": "Arabic", "SA": "Arabic", "AE": "Arabic", "IN": "Hindi",
    "ID": "Indonesian", "PH": "Filipino", "TH": "Thai", "VN": "Vietnamese",
    "TR": "Turkish", "PL": "Polish", "RO": "Romanian", "UA": "Ukrainian",
    "RU": "Russian", "FI": "Finnish", "SE": "Swedish", "NO": "Norwegian",
    "DK": "Danish", "NL": "Dutch", "BE": "Dutch", "GR": "Greek",
    "IL": "Hebrew", "NG": "English", "KE": "English", "ZA": "English",
    "US": "English", "GB": "English", "CA": "English", "AU": "English",
    "NZ": "English",
}


def derive_languages_from_regions(
    regions: list[str],
    target_languages: list[str],
) -> list[str]:
    """Derive target languages from regions when target_languages is empty.

    If target_languages is provided (non-empty), returns it as-is.
    Otherwise, maps each region to its primary professional language,
    deduplicating while preserving order.
    """
    if target_languages:
        return target_languages
    if not regions:
        return ["English"]

    languages: list[str] = []
    seen: set[str] = set()
    for region in regions:
        lang = REGION_LANGUAGE_MAP.get(region.upper(), "English")
        if lang not in seen:
            languages.append(lang)
            seen.add(lang)
    return languages or ["English"]


logger = logging.getLogger(__name__)

MAX_RETRIES = 2
PASS_THRESHOLD = 0.85

# Channels we generate copy for.
DEFAULT_CHANNELS = [
    "linkedin_feed",
    "facebook_feed",
    "telegram_card",
    "indeed_banner",
    "google_display",
]

# ── Copy quality benchmarks ──────────────────────────────────────────

CONVERT_WORDS = {
    "$", "R$", "/hr", "/mo", "/task", "pix", "paypal", "paid weekly",
    "paid every friday", "no experience", "apply in", "first task",
    "your phone", "from home", "from anywhere", "join", "contributors",
    "2 minutes", "24 hours", "review ai",
}

ANTI_PATTERNS = {
    "we are hiring", "position available", "competitive salary",
    "great benefits", "flexible hours", "secure payments", "secure platform",
    "human review", "skip the commute", "extra income", "powered by centific",
    "learn more", "click here", "start earning",
}

# ── Pillar embodiment signals ─────────────────────────────────────────
# Used to verify that copy actually embodies the intended brand pillar.

PILLAR_SIGNALS: dict[str, set[str]] = {
    "earn": {"earn", "paid", "payout", "income", "compensation", "money", "financial", "twice-monthly", "payoneer", "paypal"},
    "grow": {"grow", "career", "skill", "learn", "portfolio", "credential", "experience", "develop", "advance", "build"},
    "shape": {"expert", "expertise", "judgment", "shape", "influence", "recognition", "respected", "valued", "contribute", "impact"},
}


def _score_copy_quality(copy_data: dict, persona: dict | None = None, pillar: str | None = None) -> tuple[float, list[str]]:
    """Score copy against conversion benchmarks and persona fit.

    Returns (score 0-1, list of issues).
    """
    if "raw_text" in copy_data:
        return 0.30, ["Failed to parse JSON — copy is raw text"]

    issues: list[str] = []
    score = 0.60  # Base score for valid JSON

    # Flatten all copy text for analysis
    all_text = " ".join(
        str(v) for v in copy_data.values()
        if isinstance(v, str) and len(str(v)) > 3
    ).lower()

    if not all_text.strip():
        return 0.20, ["Copy is empty or all fields are blank"]

    # Check for conversion words (+0.03 each, max +0.15)
    convert_hits = sum(1 for w in CONVERT_WORDS if w in all_text)
    score += min(convert_hits * 0.03, 0.15)
    if convert_hits == 0:
        issues.append("No specificity — missing dollar amounts, timeframes, or concrete outcomes")

    # Check for anti-patterns (-0.05 each)
    for pattern in ANTI_PATTERNS:
        if pattern in all_text:
            score -= 0.05
            issues.append(f"Anti-pattern detected: '{pattern}' — replace with specific copy")

    # Persona fit scoring (if persona provided)
    if persona:
        trigger_words = persona.get("psychology_profile", {}).get("trigger_words", [])
        pain_points = [persona.get("customized_pain", "")]
        motivation = persona.get("customized_motivation", "")

        # Trigger word hits (+0.03 each, max +0.12)
        trigger_hits = sum(1 for tw in trigger_words if tw.lower() in all_text)
        score += min(trigger_hits * 0.03, 0.12)
        if trigger_hits == 0 and trigger_words:
            issues.append(f"No trigger words used — weave in: {', '.join(trigger_words[:3])}")

        # Pain point addressed (+0.05)
        pain_addressed = any(
            pp.lower().split()[0] in all_text  # Check first word of pain point
            for pp in pain_points if pp and len(pp) > 3
        )
        if pain_addressed:
            score += 0.05
        elif pain_points[0]:
            issues.append(f"Pain point not addressed: '{pain_points[0][:60]}'")

        # Motivation referenced (+0.05)
        if motivation and any(word.lower() in all_text for word in motivation.split()[:3]):
            score += 0.05

    # Pillar embodiment scoring
    if pillar and pillar in PILLAR_SIGNALS:
        target_signals = PILLAR_SIGNALS[pillar]
        target_hits = sum(1 for w in target_signals if w in all_text)
        score += min(target_hits * 0.03, 0.09)

        # Check for pillar confusion — does a non-target pillar dominate?
        max_other_hits = 0
        dominant_other = None
        for other_pillar, other_signals in PILLAR_SIGNALS.items():
            if other_pillar == pillar:
                continue
            other_hits = sum(1 for w in other_signals if w in all_text)
            if other_hits > max_other_hits:
                max_other_hits = other_hits
                dominant_other = other_pillar

        if max_other_hits > target_hits and max_other_hits > 0:
            score -= 0.05
            issues.append(
                f"Pillar confusion: copy reads more like '{dominant_other}' "
                f"than target pillar '{pillar}' ({max_other_hits} vs {target_hits} signal hits)"
            )

    # Cap at 1.0
    score = min(max(score, 0.0), 1.0)
    return score, issues


async def run_stage3(context: dict) -> dict:
    """Generate ad copy for every persona × channel × language combination."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})
    regions: list[str] = context.get("target_regions", [])
    languages: list[str] = derive_languages_from_regions(
        regions,
        context.get("target_languages", []),
    )
    form_data: dict = context.get("form_data", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))

    # Extract derived_requirements for pillar weighting (Phase A+B data)
    derived_req = brief.get("derived_requirements", {})
    if isinstance(derived_req, str):
        try:
            derived_req = json.loads(derived_req)
        except (ValueError, TypeError):
            derived_req = {}
    pillar_weighting = derived_req.get("pillar_weighting", {}) if isinstance(derived_req, dict) else {}

    # Extract visual direction for emotional tone injection
    visual_direction = derived_req.get("visual_direction", {}) if isinstance(derived_req, dict) else {}
    emotional_tone = visual_direction.get("emotional_tone", "")

    # Cultural research — region-specific insights for copy adaptation
    cultural_research: dict = context.get("cultural_research", {})

    if pillar_weighting:
        logger.info(
            "Pillar weighting active: primary=%s, secondary=%s",
            pillar_weighting.get("primary"), pillar_weighting.get("secondary"),
        )
    else:
        logger.info("No pillar weighting — generating all 3 pillars (fallback)")

    # Determine channels from design direction or defaults.
    format_matrix: dict = design.get("format_matrix", {})
    channels: list[str] = list(format_matrix.keys()) if format_matrix else DEFAULT_CHANNELS

    copy_count = 0

    # If we have personas, generate 3 psychology-angle variations per persona×channel
    if personas:
        for persona in personas:
            persona_name = persona.get("persona_name", persona.get("name", persona.get("archetype_key", "unknown")))
            persona_key = persona.get("archetype_key", persona_name)
            psychology = persona.get("psychology_profile", {})

            # Use persona's best channels if available, otherwise all channels
            persona_channels = persona.get("best_channels", channels)
            all_channels = list(set(persona_channels + channels))

            # Build cultural context for this persona's region
            persona_region = persona.get("region", regions[0] if regions else "")
            region_research = cultural_research.get(persona_region, {})
            if isinstance(region_research, dict):
                # Format research summary — truncate to avoid token bloat
                research_lines = []
                for dim_key, dim_data in region_research.items():
                    if dim_key.startswith("_"):
                        continue
                    if isinstance(dim_data, dict):
                        summary = dim_data.get("summary", dim_data.get("key_finding", ""))
                    elif isinstance(dim_data, str):
                        summary = dim_data
                    else:
                        continue
                    if summary:
                        research_lines.append(f"- {dim_key}: {summary[:200]}")
                cultural_context = "\n".join(research_lines)[:2000] if research_lines else None
            elif isinstance(region_research, str):
                cultural_context = region_research[:2000]
            else:
                cultural_context = None

            # Build diamond persona mini brief — same context Stage 4 + 6 use
            project_ctx = build_project_context(
                request={"title": context.get("request_title", ""), "task_type": form_data.get("task_type", ""), "target_regions": regions, "target_languages": languages, "work_mode": form_data.get("work_mode", "")},
                brief=brief,
                persona=persona,
                cultural_research=cultural_research,
            )
            logger.info("Diamond brief for %s: %d chars", persona_name, len(project_ctx))

            for channel in all_channels:
                for language in languages:
                    # Build 3 variation prompts — angles derived from persona's own psychology
                    variations = build_variation_prompts(
                        persona=persona,
                        brief=brief,
                        channel=channel,
                        language=language,
                        regions=regions,
                        form_data=form_data,
                        pillar_weighting=pillar_weighting,
                        cultural_context=cultural_context,
                        emotional_tone=emotional_tone,
                        project_context=project_ctx,  # Diamond persona brief
                    )

                    for var in variations:
                        logger.info(
                            "Generating copy: %s × %s × %s [angle: %s]",
                            persona_name, channel, language, var["angle"],
                        )

                        # Peer voice system prompt + angle-specific user prompt
                        copy_text = await generate_copy(
                            var["system"], var["user"], skill_stage="copy",
                        )
                        copy_data = _parse_json(copy_text)

                        # Score against persona fit + conversion benchmarks
                        score, eval_issues = _score_copy_quality(copy_data, persona, pillar=var.get("pillar"))

                        # Retry once if below threshold
                        if score < PASS_THRESHOLD and "raw_text" not in copy_data:
                            logger.info(
                                "Copy score %.2f — retrying [%s/%s/%s/%s]",
                                score, persona_name, channel, language, var["angle"],
                            )
                            feedback_block = "\n".join(f"- {i}" for i in eval_issues)
                            retry_user = (
                                f"{var['user']}\n\n"
                                f"⚠️ PREVIOUS ATTEMPT SCORED {score:.0%}. Fix these issues:\n"
                                f"{feedback_block}\n\n"
                                f"Rewrite the copy addressing EVERY issue above."
                            )
                            copy_text = await generate_copy(
                                var["system"], retry_user, skill_stage="copy",
                            )
                            copy_data = _parse_json(copy_text)
                            score, eval_issues = _score_copy_quality(copy_data, persona, pillar=var.get("pillar"))

                        logger.info(
                            "Copy: %s/%s/%s [%s] score=%.2f",
                            persona_name, channel, language, var["angle"], score,
                        )

                        await save_asset(request_id, {
                            "asset_type": "copy",
                            "platform": channel,
                            "format": "text",
                            "language": language,
                            "blob_url": "",
                            "metadata": {
                                "copy_data": copy_data,
                                "eval_score": score,
                                "eval_issues": eval_issues,
                                "persona_key": persona_key,
                                "persona_name": persona_name,
                                "copy_angle": var["angle"],
                                "psychology_bias": var["bias"],
                                "pillar": var.get("pillar", ""),
                            },
                        })
                        copy_count += 1
    else:
        # Fallback: no personas — generate generic copy per channel
        logger.warning("No personas found — generating generic copy (not recommended)")
        for channel in channels:
            for language in languages:
                logger.info("Generating generic copy for %s / %s", channel, language)

                copy_prompt = build_copy_prompt(
                    brief=brief,
                    channel=channel,
                    language=language,
                    regions=regions,
                    form_data=form_data,
                )
                copy_text = await generate_copy(COPY_SYSTEM_PROMPT, copy_prompt, skill_stage="copy")
                copy_data = _parse_json(copy_text)

                score, eval_issues = _score_copy_quality(copy_data)

                await save_asset(request_id, {
                    "asset_type": "copy",
                    "platform": channel,
                    "format": "text",
                    "language": language,
                    "blob_url": "",
                    "metadata": {
                        "copy_data": copy_data,
                        "eval_score": score,
                        "eval_issues": eval_issues,
                    },
                })
                copy_count += 1

    return {"copy_count": copy_count}


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles code fences and embedded JSON."""
    if not text:
        return {"raw_text": ""}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Search for embedded JSON (brace-depth scan)
    brace_depth = 0
    json_start = -1
    last_valid_json = None

    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                json_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and json_start >= 0:
                candidate = cleaned[json_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and len(parsed) > 1:
                        last_valid_json = parsed
                except json.JSONDecodeError:
                    pass
                json_start = -1

    if last_valid_json:
        logger.info("Extracted JSON from text (%d keys)", len(last_valid_json))
        return last_valid_json

    logger.warning("Failed to parse JSON from copy output (%d chars)", len(text))
    return {"raw_text": text}
