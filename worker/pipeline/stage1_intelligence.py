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
    brief_text = await generate_text(BRIEF_SYSTEM_PROMPT, brief_prompt)
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
        feedback = eval_result.get("improvement_suggestions", [])
        brief_prompt = build_brief_prompt(request, feedback=feedback, persona_context=persona_context)
        brief_text = await generate_text(BRIEF_SYSTEM_PROMPT, brief_prompt)
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
    design_text = await generate_text(BRIEF_SYSTEM_PROMPT, design_prompt)
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
    """Parse JSON from LLM output, handling markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Strip opening fence line
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        # Strip closing fence
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse JSON from LLM output; wrapping in raw_text.")
        return {"raw_text": text}
