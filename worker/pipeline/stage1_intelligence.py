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
import os

from ai.local_llm import generate_text
from neon_client import get_intake_request, save_brief, save_actor, save_campaign_strategy, update_actor_targeting
from pipeline.persona_validation import (
    Stage1PersonaValidationError,
    validate_personas,
)
from prompts.cultural_research import (
    apply_research_to_personas,
    build_research_summary,
    research_all_regions,
)
from prompts.eval_registry import evaluate as run_evaluator
from prompts.persona_engine import (
    PERSONA_SYSTEM_PROMPT,
    build_persona_prompt,
)
from prompts.recruitment_brief import (
    BRIEF_SYSTEM_PROMPT,
    build_brief_prompt,
    build_design_direction_prompt,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


def _infer_demographic(form_data: dict, request: dict) -> str:
    """Infer target demographic from task type, qualifications, and location when not provided."""
    task_type = request.get("task_type", "")
    quals = request.get("qualifications_required", "") or ""
    location = request.get("location_scope", "") or ""

    # Professional/credentialed signals
    pro_signals = ["licensed", "certified", "degree", "experience", "professional", "nurse", "doctor", "engineer"]
    if any(s in quals.lower() for s in pro_signals):
        return "working professionals 28-55"

    # Student/university signals
    student_signals = ["student", "university", "college", "campus", "intern"]
    if any(s in quals.lower() for s in student_signals) or any(s in location.lower() for s in student_signals):
        return "university students 18-25"

    # Task-type based defaults
    type_demographics = {
        "transcription": "young professionals 22-40",
        "translation": "bilingual professionals 25-45",
        "annotation": "tech-savvy adults 20-35",
        "judging": "diverse adults 25-55",
        "data_collection": "general population 18-45",
    }
    if task_type in type_demographics:
        return type_demographics[task_type]

    return "adults 18-45"
PASS_THRESHOLD = 0.85

# Max retries for persona validation. Configurable via env for tuning.
# Total attempts = MAX_PERSONA_RETRIES + 1 (initial attempt + retries).
MAX_PERSONA_RETRIES = int(os.getenv("STAGE1_PERSONA_MAX_RETRIES", "2"))


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
                demographic=form_data.get("demographic") or _infer_demographic(form_data, request),
                task_type=task_type,
                intake_row=request,  # enables context-aware dimension filtering + work_tier_context
            )
            logger.info("Cultural research complete: %s", list(cultural_research.keys()))
    else:
        logger.info("Step 1: No target regions — skipping cultural research.")

    # ==================================================================
    # STEP 2: GENERATE PERSONAS (WHO are we talking to?)
    # Dynamic LLM-generated personas constrained by derived_requirements
    # (Task 18/19 — replaces the legacy 8-archetype system). The brief
    # is generated BEFORE personas so that persona_constraints are
    # available; for the first pass we run a lightweight derivation
    # pre-step inside the brief prompt. Until Task 21 wires in the
    # full validation retry loop, we read persona_constraints from a
    # pre-brief extraction pass or fall back to empty constraints.
    # ==================================================================
    logger.info("Step 2: Generating personas (LLM-powered, dynamic)...")
    personas = await _generate_personas_dynamic(
        request=request,
        cultural_research=cultural_research,
        persona_constraints={},  # Task 21 will populate from a pre-brief derivation
    )

    if cultural_research and personas:
        personas = apply_research_to_personas(personas, cultural_research)
        logger.info("Personas enriched with cultural research.")

    logger.info(
        "3 personas: %s",
        [p.get("name") or p.get("persona_name") or p.get("archetype", "?") for p in personas],
    )

    # ==================================================================
    # STEP 2b: SAVE ACTOR STUBS + TARGETING PROFILES TO NEON
    # Create a minimal actor record for each persona so we can persist
    # the targeting_profile now (stage2 will enrich with images later).
    # ==================================================================
    for persona in personas:
        targeting = persona.get("targeting_profile", {})
        persona_label = (
            persona.get("name")
            or persona.get("persona_name")
            or persona.get("matched_tier")
            or persona.get("archetype", "Contributor")
        )
        try:
            actor_id = await save_actor(request_id, {
                "name": persona_label,
                "face_lock": {"matched_tier": persona.get("matched_tier", "")},
                "prompt_seed": "",
                "outfit_variations": {},
                "signature_accessory": "",
                "backdrops": [],
            })
            persona["actor_id"] = actor_id
            if targeting:
                await update_actor_targeting(actor_id, targeting)
                logger.info(
                    "Saved targeting_profile for persona '%s' (pool=%s, cpl=%s, weight=%d%%)",
                    persona_label,
                    targeting.get("estimated_pool_size", "?"),
                    targeting.get("expected_cpl_tier", "?"),
                    targeting.get("budget_weight_pct", 0),
                )
        except Exception as exc:
            logger.warning("Could not save actor stub / targeting for '%s': %s", persona_label, exc)

    # ==================================================================
    # STEP 3b: CAMPAIGN STRATEGY ENGINE (budget cascade + strategy per country)
    # Generate media-buying strategy per country: budget allocation,
    # campaign structure, ad set splits, split test variable.
    # Uses generate-then-evaluate loop with feedback (max 3 retries).
    # ==================================================================
    from prompts.campaign_strategy import (
        calculate_budget_cascade,
        generate_campaign_strategy,
    )
    from ai.campaign_evaluator import evaluate_campaign_strategy as eval_strategy
    from ai.campaign_evaluator import MAX_RETRIES as STRATEGY_MAX_RETRIES
    from ai.campaign_evaluator import PASS_THRESHOLD as STRATEGY_THRESHOLD

    monthly_budget = form_data.get("monthly_budget")

    # Get channel strategy from personas or defaults
    channel_strategy = []
    for p in personas:
        channel_strategy.extend(p.get("best_channels", []))
    channel_strategy = list(set(channel_strategy)) or ["ig_feed", "facebook_feed"]

    # Build country list with opportunity scores from cultural research
    countries_data = []
    for region in target_regions:
        research = cultural_research.get(region, {})
        # Derive opportunity score from research richness
        opp_score = min(1.0, 0.3 + len(json.dumps(research, default=str)) / 10000)
        countries_data.append({"country": region, "market_opportunity_score": round(opp_score, 2)})

    # Calculate budget cascade
    budget_data = calculate_budget_cascade(
        total_monthly=monthly_budget,
        countries=countries_data,
        personas=personas,
    )
    logger.info(
        "Budget cascade: mode=%s, countries=%d, deferred=%d, flags=%d",
        budget_data["budget_mode"],
        len(budget_data["country_allocations"]),
        len(budget_data["deferred_markets"]),
        len(budget_data["flags"]),
    )

    # Generate strategy per active country
    all_strategies = {}
    for region in target_regions:
        country_alloc = budget_data["country_allocations"].get(region, {})
        if not country_alloc and budget_data["budget_mode"] == "fixed":
            logger.info("Skipping deferred market: %s", region)
            continue

        country_budget_for_llm = {
            "budget_mode": budget_data["budget_mode"],
            "total_monthly": monthly_budget,
            "country_monthly": country_alloc.get("monthly") if isinstance(country_alloc, dict) else None,
            "persona_allocations": country_alloc.get("persona_allocations", {}) if isinstance(country_alloc, dict) else {},
        }

        # Generate + evaluate with feedback loop
        feedback = []
        best_strategy = {}
        best_score = 0.0

        for attempt in range(STRATEGY_MAX_RETRIES):
            strategy = await generate_campaign_strategy(
                country=region,
                personas=personas,
                cultural_research=cultural_research.get(region, {}),
                channel_strategy=channel_strategy,
                budget_data=country_budget_for_llm,
                task_type=task_type,
                task_description=form_data.get("task_description") or form_data.get("description", ""),
                feedback=feedback if feedback else None,
            )

            if not strategy:
                logger.warning("Empty strategy for %s (attempt %d)", region, attempt + 1)
                continue

            eval_result = eval_strategy(
                strategy=strategy,
                personas=personas,
                channel_strategy=channel_strategy,
                budget_mode=budget_data["budget_mode"],
            )

            score = eval_result["overall_score"]
            logger.info(
                "Strategy eval for %s: %.2f (%s, attempt %d/%d)",
                region, score, "PASS" if eval_result["passed"] else "FAIL",
                attempt + 1, STRATEGY_MAX_RETRIES,
            )

            if score > best_score:
                best_score = score
                best_strategy = strategy
                best_strategy["_evaluation"] = eval_result

            if eval_result["passed"]:
                break

            feedback = eval_result["issues"]

        # Save to Neon
        if best_strategy:
            await save_campaign_strategy(request_id, {
                "country": region,
                "tier": best_strategy.get("tier", 1),
                "monthly_budget": country_alloc.get("monthly") if isinstance(country_alloc, dict) else None,
                "budget_mode": budget_data["budget_mode"],
                "strategy_data": best_strategy,
                "evaluation_score": best_score,
                "evaluation_data": best_strategy.get("_evaluation"),
                "evaluation_passed": best_score >= STRATEGY_THRESHOLD,
            })
            all_strategies[region] = best_strategy
            logger.info("Saved campaign strategy for %s (score=%.2f)", region, best_score)

    context["campaign_strategies"] = all_strategies
    context["budget_data"] = budget_data
    logger.info("Campaign strategy generation complete: %d country strategies", len(all_strategies))

    # ==================================================================
    # STEP 3: GENERATE BRIEF FROM PERSONAS (messaging built ON their psychology)
    # The brief is NOT generic — it's built specifically for these
    # 3 personas, their pain points, motivations, psychology hooks,
    # cultural context, and channel preferences.
    # ==================================================================
    logger.info("Step 3: Generating persona-driven creative brief...")

    # Build persona + research context that feeds into the brief prompt
    persona_context = _build_persona_brief_context(personas)
    if cultural_research:
        persona_context += "\n\n" + build_research_summary(cultural_research)

    brief_prompt = build_brief_prompt(request, persona_context=persona_context)

    # Inject marketing skills into system prompt for 397B model
    from prompts.marketing_skills import get_skills_for_stage
    skills_context = get_skills_for_stage("brief")
    enhanced_system = BRIEF_SYSTEM_PROMPT
    if skills_context:
        enhanced_system = f"{BRIEF_SYSTEM_PROMPT}\n\n{skills_context}"

    brief_text = await generate_text(enhanced_system, brief_prompt, thinking=True)
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
        brief_text = await generate_text(enhanced_system, brief_prompt, thinking=True)
        brief_data = _parse_json(brief_text)

    # Inject personas + research into brief for downstream stages
    brief_data["personas"] = personas
    brief_data["cultural_research"] = cultural_research

    # Add budget + strategy data to the brief
    if budget_data:
        brief_data["budget_data"] = budget_data
    if all_strategies:
        brief_data["campaign_strategies_summary"] = {
            region: {
                "tier": s.get("tier"),
                "ad_set_count": sum(len(c.get("ad_sets", [])) for c in s.get("campaigns", [])),
                "split_test_variable": s.get("split_test", {}).get("variable"),
            }
            for region, s in all_strategies.items()
        }

    # ==================================================================
    # STEP 5: DESIGN DIRECTION (visual world for THESE personas)
    # The design direction is informed by who the personas are,
    # where they live, what their homes/cafes look like, and
    # what cultural considerations affect visual choices.
    # ==================================================================
    logger.info("Step 5: Generating persona-driven design direction...")
    design_prompt = build_design_direction_prompt(brief_data, request)
    design_prompt += "\n\n" + persona_context
    design_text = await generate_text(enhanced_system, design_prompt, thinking=False, max_tokens=4096)
    design_data = _parse_json(design_text)

    # ==================================================================
    # STEP 6: PERSIST TO NEON
    # ==================================================================

    # Extract derived_requirements + pillar values from the brief JSON
    derived = brief_data.get("derived_requirements") or None
    pillar_weighting = (derived or {}).get("pillar_weighting") or {}
    pillar_primary_raw = pillar_weighting.get("primary")
    pillar_secondary_raw = pillar_weighting.get("secondary")

    # ==================================================================
    # STEP 6a: PERSONA VALIDATION RETRY LOOP (Task 21)
    # The brief now carries persona_constraints in derived_requirements.
    # Validate the personas we generated earlier against those constraints.
    # If violations exist, re-run persona generation with the violation
    # list as feedback. Max MAX_PERSONA_RETRIES retries. If still failing
    # after the retries are exhausted, raise Stage1PersonaValidationError
    # to fail the compute_job with a clear error message surfaced in the
    # admin dashboard. The loop MUST run before save_brief is called so
    # the persisted brief always references validated personas.
    # ==================================================================
    persona_constraints: dict = (derived or {}).get("persona_constraints") or {}

    if not persona_constraints:
        logger.info(
            "[stage1] No persona_constraints in derived_requirements — "
            "skipping persona validation retry loop."
        )
    else:
        ok, violations = validate_personas(personas, persona_constraints)
        if ok:
            logger.info(
                "[stage1] persona validation passed on initial generation"
            )
        else:
            logger.warning(
                "[stage1] persona validation failed on initial generation: "
                "%d violations", len(violations),
            )
            for v in violations:
                logger.warning("  - %s", v)

            previous_violations: list[str] = violations
            for attempt in range(1, MAX_PERSONA_RETRIES + 1):
                logger.info(
                    "[stage1] persona retry attempt %d/%d with %d violation hints",
                    attempt, MAX_PERSONA_RETRIES, len(previous_violations),
                )
                personas = await _generate_personas_dynamic(
                    request=request,
                    cultural_research=cultural_research,
                    persona_constraints=persona_constraints,
                    brief_messaging=brief_data.get("messaging_strategy") or {},
                    previous_violations=previous_violations,
                )

                # Re-apply cultural research enrichment on the fresh personas
                if cultural_research and personas:
                    personas = apply_research_to_personas(personas, cultural_research)

                ok, violations = validate_personas(personas, persona_constraints)
                if ok:
                    logger.info(
                        "[stage1] persona validation passed on retry %d", attempt
                    )
                    break

                logger.warning(
                    "[stage1] persona validation failed on retry %d: %d violations",
                    attempt, len(violations),
                )
                for v in violations:
                    logger.warning("  - %s", v)

                if attempt >= MAX_PERSONA_RETRIES:
                    raise Stage1PersonaValidationError(
                        f"Persona validation failed after {MAX_PERSONA_RETRIES + 1} attempts. "
                        f"Violations: {'; '.join(violations)}"
                    )

                previous_violations = violations

            # Regenerated personas replace the ones embedded in the brief.
            # Downstream stages read brief_data["personas"], so keep them
            # in sync with the validated set.
            brief_data["personas"] = personas

    # Validate pillar values (defense in depth — DB CHECK constraint is primary)
    VALID_PILLARS = {"earn", "grow", "shape"}
    pillar_primary = (
        pillar_primary_raw.lower()
        if isinstance(pillar_primary_raw, str) and pillar_primary_raw.lower() in VALID_PILLARS
        else None
    )
    if pillar_primary_raw and not pillar_primary:
        logger.warning(
            "[stage1] Invalid pillar_primary from LLM: %r, storing as NULL",
            pillar_primary_raw,
        )

    pillar_secondary = (
        pillar_secondary_raw.lower()
        if isinstance(pillar_secondary_raw, str) and pillar_secondary_raw.lower() in VALID_PILLARS
        else None
    )
    if pillar_secondary_raw and not pillar_secondary:
        logger.warning(
            "[stage1] Invalid pillar_secondary from LLM: %r, storing as NULL",
            pillar_secondary_raw,
        )

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
        pillar_primary=pillar_primary,
        pillar_secondary=pillar_secondary,
        derived_requirements=derived,
    )

    logger.info("Stage 1 complete: brief + %d personas + cultural research saved.", len(personas))

    return {
        "brief": brief_data,
        "design_direction": design_data,
        "personas": personas,
        "cultural_research": cultural_research,
        "campaign_strategies": all_strategies,
        "budget_data": budget_data,
        "target_languages": target_languages,
        "target_regions": target_regions,
        "form_data": form_data,
    }


# ---------------------------------------------------------------------------
# Persona generation helpers (dynamic, LLM-driven — Task 18/19)
# ---------------------------------------------------------------------------

async def _generate_personas_dynamic(
    request: dict,
    cultural_research: dict,
    persona_constraints: dict,
    brief_messaging: dict | None = None,
    previous_violations: list[str] | None = None,
) -> list[dict]:
    """Run the dynamic persona generation LLM call.

    Uses prompts.persona_engine.build_persona_prompt to construct the
    prompt from persona_constraints + cultural_research, then parses
    the JSON {"personas": [...]} response. When invoked from the Stage 1
    validation retry loop, ``previous_violations`` is injected into the
    prompt as feedback so the LLM can correct constraint violations.
    """
    prompt = build_persona_prompt(
        request=request,
        cultural_research=cultural_research,
        persona_constraints=persona_constraints,
        brief_messaging=brief_messaging,
        previous_violations=previous_violations,
    )

    try:
        result = await generate_text(
            PERSONA_SYSTEM_PROMPT,
            prompt,
            thinking=True,
            max_tokens=8192,
            temperature=0.7,
        )
    except Exception as exc:
        logger.warning("Dynamic persona generation failed: %s — returning empty list", exc)
        return []

    parsed = _parse_json(result)
    personas = parsed.get("personas") if isinstance(parsed, dict) else None
    if not isinstance(personas, list):
        logger.warning("Persona LLM output missing 'personas' array — got keys: %s",
                       list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__)
        return []

    # Ensure every persona has a persona_name field for downstream consumers
    for p in personas:
        if isinstance(p, dict) and "persona_name" not in p:
            p["persona_name"] = p.get("name") or p.get("archetype", "Contributor")

    logger.info("Dynamic persona LLM returned %d personas", len(personas))
    return personas[:3]


def _build_persona_brief_context(personas: list[dict]) -> str:
    """Format dynamic personas into a prompt block for brief generation.

    Replaces the legacy build_persona_brief_prompt helper (deleted with
    the 8-archetype system). Operates on the dynamic persona schema:
    name, archetype, matched_tier, age_range, lifestyle, motivations,
    pain_points, psychology_profile, jobs_to_be_done, best_channels.
    """
    if not personas:
        return "TARGET PERSONAS: (none generated)\n"

    all_channels: set[str] = set()
    all_hooks: set[str] = set()
    persona_blocks: list[str] = []

    for i, p in enumerate(personas, 1):
        channels = p.get("best_channels", []) or []
        psychology = p.get("psychology_profile", {}) or {}
        primary = psychology.get("primary_bias", "")
        secondary = psychology.get("secondary_bias", "")
        all_channels.update(channels)
        if primary:
            all_hooks.add(primary)
        if secondary:
            all_hooks.add(secondary)

        motivations = p.get("motivations", []) or []
        pain_points = p.get("pain_points", []) or []

        block = (
            f"PERSONA {i}: {p.get('name') or p.get('persona_name') or 'Unnamed'}\n"
            f"  Archetype: {p.get('archetype', '')}\n"
            f"  Matched tier: {p.get('matched_tier', '')}\n"
            f"  Age range: {p.get('age_range', '')}\n"
            f"  Lifestyle: {p.get('lifestyle', '')}\n"
            f"  Top motivations: {'; '.join(motivations[:3])}\n"
            f"  Top pain points: {'; '.join(pain_points[:3])}\n"
            f"  Psychology: {primary}{' + ' + secondary if secondary else ''}\n"
            f"  Messaging angle: {psychology.get('messaging_angle', '')}\n"
            f"  Best channels: {', '.join(channels)}\n"
            f"  Jobs-to-be-done: {json.dumps(p.get('jobs_to_be_done', {}), ensure_ascii=False, default=str)}"
        )
        persona_blocks.append(block)

    return (
        "TARGET PERSONAS (these personas MUST inform all messaging decisions):\n\n"
        + "\n\n".join(persona_blocks)
        + "\n\nPERSONA-DRIVEN REQUIREMENTS:\n"
        + "- Each persona's pain points should appear as messaging angles in the brief.\n"
        + "- Each persona's motivations should map to specific value propositions.\n"
        + f"- Channel strategy MUST include: {', '.join(sorted(all_channels)) or '(none specified)'}\n"
        + f"- Psychology hooks to leverage: {', '.join(sorted(all_hooks)) or '(none specified)'}\n"
        + "- Each persona gets their own ad variant — do NOT write generic one-size-fits-all copy.\n"
    )


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

    # Try to find the LARGEST valid JSON object in reasoning text
    # Reasoning mode produces small JSON fragments in thinking + the real answer
    brace_depth = 0
    json_start = -1
    best_json = None
    best_size = 0

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
                    if isinstance(parsed, dict) and len(candidate) > best_size and len(parsed) > 1:
                        best_json = parsed
                        best_size = len(candidate)
                except json.JSONDecodeError:
                    pass
                json_start = -1

    if best_json:
        logger.info("Extracted JSON from reasoning text (%d keys, %d chars)", len(best_json), best_size)
        return best_json

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
