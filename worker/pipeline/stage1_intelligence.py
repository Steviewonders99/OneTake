"""Stage 1: Strategic Intelligence (Persona-First Architecture).

The brief, messaging, psychology, and positioning are all DERIVED FROM
the personas and cultural research — not the other way around.

Pipeline order:
1. Load intake request from Neon.
2. Cultural research per region via Kimi K2.5 (understand the PEOPLE first).
3. Generate 3 target personas (informed by cultural research).
4. Generate creative brief FROM personas + research (messaging built ON their psychology).
5. Evaluate brief with 8-dimension rubric (Neurogen-style gate).
6. Generate design direction (visual world for THESE personas).
7. Save to Neon creative_briefs table.
"""
from __future__ import annotations

import json
import logging

from ai.local_llm import generate_text
from neon_client import get_intake_request, save_brief
from prompts.cultural_research import (
    apply_research_to_personas,
    build_research_summary,
    research_all_regions,
)
from prompts.eval_registry import evaluate as run_evaluator
from prompts.persona_engine import (
    build_persona_brief_prompt,
    generate_personas,
)
from prompts.recruitment_brief import (
    BRIEF_SYSTEM_PROMPT,
    build_brief_prompt,
    build_design_direction_prompt,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
PASS_THRESHOLD = 0.85


async def run_stage1(context: dict) -> dict:
    """Run Strategic Intelligence stage — persona-first architecture.

    The brief, psychology, and positioning are all DERIVED FROM the
    personas and cultural research. We understand the people before
    we write a single word of messaging.
    """
    request_id: str = context["request_id"]
    request = await get_intake_request(request_id)
    context["request_title"] = request.get("title", "Untitled")

    target_regions: list[str] = request.get("target_regions", [])
    target_languages: list[str] = request.get("target_languages", [])
    form_data: dict = request.get("form_data", {})
    task_type: str = request.get("task_type", "data annotation")

    # ==================================================================
    # STEP 1: CULTURAL RESEARCH (understand the people FIRST)
    # Kimi K2.5 researches 8 dimensions per region: AI fatigue, gig work
    # perception, trust level, platform reality, economic context,
    # cultural sensitivities, tech literacy, language nuance.
    # ==================================================================
    cultural_research: dict = {}
    if target_regions:
        # Check for cached research first (saves ~8min of Kimi K2.5 API calls)
        from prompts.cultural_research import get_platform_priors
        cached = _load_cached_research(target_regions)
        if cached:
            cultural_research = cached
            logger.info("Step 1: Using CACHED cultural research for %s", list(cached.keys()))
        else:
            logger.info("Step 1: Cultural research for %d regions ...", len(target_regions))
            cultural_research = await research_all_regions(
                regions=target_regions,
                languages=target_languages,
                demographic=form_data.get("demographic", "young adults 18-35"),
                task_type=task_type,
            )
            logger.info("Cultural research complete: %s", list(cultural_research.keys()))
    else:
        logger.info("Step 1: No target regions — skipping cultural research.")

    # ==================================================================
    # STEP 2: GENERATE PERSONAS (WHO are we talking to?)
    # 3 personas selected from 8 archetypes, scored against task
    # requirements, then enriched with cultural research findings.
    # These personas are the FOUNDATION for everything else.
    # ==================================================================
    logger.info("Step 2: Generating personas...")
    personas = generate_personas(request)

    if cultural_research:
        personas = apply_research_to_personas(personas, cultural_research)
        logger.info("Personas enriched with cultural research.")

    logger.info(
        "3 personas: %s",
        [f"{p['archetype_key']} ({p.get('persona_name', '?')})" for p in personas],
    )

    # ==================================================================
    # STEP 3: GENERATE BRIEF FROM PERSONAS (messaging built ON their psychology)
    # The brief is NOT generic — it's built specifically for these
    # 3 personas, their pain points, motivations, psychology hooks,
    # cultural context, and channel preferences.
    # ==================================================================
    logger.info("Step 3: Generating persona-driven creative brief...")

    # Build persona + research context that feeds into the brief prompt
    persona_context = build_persona_brief_prompt(personas, {})
    if cultural_research:
        persona_context += "\n\n" + build_research_summary(cultural_research)

    brief_prompt = build_brief_prompt(request, persona_context=persona_context)
    # THINKING MODE — let Qwen reason over the rich persona + cultural data.
    # The <think>...</think> tags are parsed by the server manager — JSON
    # comes AFTER </think> in the output.
    brief_text = await generate_text(BRIEF_SYSTEM_PROMPT, brief_prompt, thinking=True)
    brief_data = _parse_json(brief_text)

    # ==================================================================
    # STEP 4: EVALUATE BRIEF (8-dimension Neurogen-style rubric)
    # Replaces the thin 5-dimension eval with a production-grade
    # rubric: rfp_traceability, persona_specificity, cultural_integration,
    # oneforma_brand_fit, psychology_depth, channel_evidence,
    # ethical_compliance, actionability.
    # Verdicts: accept (>= 8.0), revise (retry), reject (hard fail).
    # ==================================================================
    logger.info("Step 4: Evaluating brief (8-dimension rubric)...")
    score = 0.0
    eval_data: dict = {}
    for attempt in range(MAX_RETRIES):
        eval_result = await run_evaluator(
            "brief",
            context={
                "brief": brief_data,
                "request": request,
                "personas": personas,
                "cultural_research": cultural_research,
            },
            llm_fn=generate_text,
        )
        eval_data = eval_result.get("raw_response", {})
        # Use normalized 0-1 score for backward compatibility with PASS_THRESHOLD
        score = float(eval_result.get("overall_score", 0))
        verdict = eval_result.get("verdict", "revise")

        if verdict == "accept" or score >= PASS_THRESHOLD:
            logger.info(
                "Brief passed (verdict=%s, score=%.2f, weighted=%.1f/10, attempt=%d)",
                verdict, score, eval_result.get("weighted_score", 0), attempt + 1,
            )
            break

        if verdict == "reject":
            logger.warning(
                "Brief REJECTED: %s (attempt %d)",
                eval_result.get("hard_gate_failures", []),
                attempt + 1,
            )

        logger.info(
            "Brief %s (score=%.2f, weighted=%.1f/10) — retrying with feedback...",
            verdict, score, eval_result.get("weighted_score", 0),
        )
        # Build rich feedback from per-dimension scores + suggestions
        feedback = eval_result.get("improvement_suggestions", [])
        dim_scores = eval_result.get("dimension_scores", {})
        gate_failures = eval_result.get("hard_gate_failures", [])

        # Add specific dimension feedback so Qwen knows what to fix
        if dim_scores:
            for dim_name, dim_data in dim_scores.items():
                if isinstance(dim_data, dict):
                    s = dim_data.get("score", 0)
                    fb = dim_data.get("feedback", "")
                    if s < 7 and fb:
                        feedback.append(f"[{dim_name} scored {s}/10]: {fb}")

        if gate_failures:
            feedback.append(f"HARD GATE FAILURES: {'; '.join(gate_failures)}")

        logger.info("Retrying with %d feedback items", len(feedback))
        brief_prompt = build_brief_prompt(request, feedback=feedback, persona_context=persona_context)
        brief_text = await generate_text(BRIEF_SYSTEM_PROMPT, brief_prompt, thinking=True)
        brief_data = _parse_json(brief_text)

    # Inject personas + research into brief for downstream stages
    brief_data["personas"] = personas
    brief_data["cultural_research"] = cultural_research

    # ==================================================================
    # STEP 5: DESIGN DIRECTION (visual world for THESE personas)
    # The design direction is informed by who the personas are,
    # where they live, what their homes/cafes look like, and
    # what cultural considerations affect visual choices.
    # ==================================================================
    logger.info("Step 5: Generating persona-driven design direction...")
    design_prompt = build_design_direction_prompt(brief_data, request)
    design_prompt += "\n\n" + persona_context
    design_text = await generate_text(BRIEF_SYSTEM_PROMPT, design_prompt, thinking=True)
    design_data = _parse_json(design_text)

    # ==================================================================
    # STEP 6: PERSIST TO NEON
    # ==================================================================
    await save_brief(
        request_id,
        {
            "brief_data": brief_data,
            "design_direction": design_data,
            "evaluation_score": score,
            "evaluation_data": eval_data,
            "evaluation_result": eval_result,
            "personas": personas,
            "cultural_research": cultural_research,
            "content_languages": target_languages,
        },
    )

    logger.info("Stage 1 complete: brief + %d personas + cultural research saved.", len(personas))

    return {
        "brief": brief_data,
        "design_direction": design_data,
        "personas": personas,
        "cultural_research": cultural_research,
        "target_languages": target_languages,
        "target_regions": target_regions,
        "form_data": form_data,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles thinking mode, code fences, embedded JSON.

    Qwen3.5-9B often puts the JSON inside reasoning text. This parser:
    1. Tries direct parse
    2. Strips markdown fences
    3. Searches for the LAST JSON object in the text (often at the end of reasoning)
    """
    if not text:
        return {"raw_text": ""}

    cleaned = text.strip()

    # Strip markdown fences
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object embedded in text (reasoning mode)
    # Search for the LAST { ... } block that's valid JSON
    import re
    # Find all potential JSON blocks (starting with { ending with })
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
        logger.info("Extracted JSON from reasoning text (%d keys)", len(last_valid_json))
        return last_valid_json

    logger.warning("Failed to parse JSON from LLM output (%d chars); wrapping in raw_text.", len(text))
    return {"raw_text": text}


# ---------------------------------------------------------------------------
# Cached cultural research (from previous Kimi K2.5 runs)
# Saves ~8 minutes of API calls per run. Research doesn't change daily.
# ---------------------------------------------------------------------------

_CACHED_RESEARCH: dict[str, dict] = {
    "MA": {
        "_meta": {"region": "MA", "language": "ar", "demographic": "young adults 18-35", "task_type": "audio_annotation"},
        "ai_fatigue": {"fatigue_level": "low", "sentiment": "curious but cautious — AI seen as opportunity not threat in Morocco", "recommended_framing": "Frame as AI opportunity. 'Help build AI' resonates. Avoid dystopian/replacement language."},
        "gig_work_perception": {"perception": "growing acceptance, especially among urban youth", "cultural_framing": "Modern flexible work, not failure. Remote work = aspirational.", "messaging_implication": "Position as professional remote work, not 'gig'. Mention flexibility and autonomy."},
        "data_annotation_trust": {"trust_level": "medium — online work still associated with scams for many", "scam_associations": "Common concerns about unpaid work, fake platforms. Need strong trust signals.", "trust_builders": "Mention Centific parent company ($200M+), OpenAI/Google clients, payment proof, 500K+ contributors worldwide."},
        "platform_reality": {"top_platforms_ranked": "WhatsApp (96%), TikTok (76%), Instagram (73%), YouTube (64%), Facebook (52% declining)", "job_platforms": "Emploi.ma, LinkedIn, Facebook Groups ('Offres d'emploi Casablanca')", "messaging_apps": "WhatsApp (#1 universal), Telegram (growing in tech circles)"},
        "demographic_channel_map": {
            "age_16_20": "TikTok (85% daily, 2.5hr/day), Instagram (80%), YouTube, Snapchat",
            "age_21_25": "Instagram (90%), TikTok (75%), WhatsApp, LinkedIn emerging",
            "age_26_35": "WhatsApp (99%), LinkedIn (55%), Facebook, Instagram",
            "age_36_50": "WhatsApp (95%), Facebook (70%), YouTube, LinkedIn",
            "age_50_plus": "WhatsApp (90%), Facebook (55%), YouTube",
            "blocked_platforms": "None currently blocked in Morocco",
            "ad_capable_platforms": "Meta (Facebook/Instagram) full self-serve, TikTok Ads launched Morocco, LinkedIn Ads available, Google Ads",
            "gig_platforms_by_age": "16-20: Facebook Groups, Instagram DM. 21-25: LinkedIn, Upwork. 26+: LinkedIn, professional networks.",
        },
        "economic_context": {"avg_remote_hourly": "3-5 USD for general remote work", "minimum_wage": "~1.50 USD/hr (2,970 MAD/month)", "youth_unemployment": "32% for 15-24 age group", "competitive_rate": "8-12 USD/hr would be very attractive (3-4x average)"},
        "cultural_sensitivities": {"religious_considerations": "Ramadan: mention flexible scheduling, avoid imagery of eating/drinking during daylight. Friday prayer time respected.", "gender_norms": "Women working from home is culturally preferred and aspirational. Show both men and women in ads.", "imagery_taboos": "Avoid alcohol, revealing clothing, pork references. Conservative imagery in rural areas.", "formality_level": "Semi-formal French for professional ads, Darija for social/casual. Mix is natural.", "things_to_avoid": "Don't imply the work is mindless. Respect the skill involved. Avoid stereotyping Morocco."},
        "tech_literacy": {"smartphone_penetration": "85% smartphone penetration", "primary_device": "Smartphone for most, laptop for professionals and students", "internet_quality": "4G in cities (Casablanca, Rabat, Marrakech), slower in rural. Data costs ~10 MAD/GB ($1).", "data_cost_concern": "Moderate — mention WiFi-compatible work, avoid heavy-download requirements."},
        "language_nuance": {"dialect": "Moroccan Darija (Arabic dialect) + Standard French. Most educated youth are bilingual.", "formality_preference": "Semi-formal French for LinkedIn/professional. Darija/French mix for Facebook/Instagram. Pure Darija for WhatsApp.", "authentic_slang": "khdma (work), flous (money), khdem (working), bezaf (a lot)", "avoid_phrases": "Metropolitan French slang sounds foreign. Don't use Egyptian Arabic.", "language_mixing": "French/Darija code-switching is natural and authentic. Using ONLY French sounds corporate."},
    },
}


def _load_cached_research(regions: list[str]) -> dict | None:
    """Load cached cultural research for the given regions.

    Returns the cached data if ALL requested regions have cached research.
    Returns None if any region is missing (triggers live research).
    """
    result: dict = {}
    for region in regions:
        if region in _CACHED_RESEARCH:
            result[region] = _CACHED_RESEARCH[region]
        else:
            logger.info("No cached research for %s — will need live research.", region)
            return None
    return result
