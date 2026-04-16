"""Marketing Brief Evaluator — brand voice auditor for OneForma briefs.

Every brief must demonstrate:
1. Direct traceability to the RFP requirements
2. Persona-specific messaging (not generic)
3. Cultural intelligence integration
4. OneForma BRAND VOICE compliance (tagline, 4 tone rules, no banned words)
5. Ethical positioning for sensitive topics
6. Actionable channel strategy with evidence
7. Pillar clarity (Earn / Grow / Shape angles surfaced for downstream copy)

Scoring: 0-10 per dimension (Neurogen pattern)
Hard gates: MIN_ACCEPT = 8.0 overall, MIN_DIM = 7 per dimension
Verdict: accept | revise | reject

Brand voice auditor: any brief containing a word from WORDS_TO_AVOID receives
an automatic 0 on brand_voice_compliance, which triggers a hard-gate failure.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from brand import (
    WORDS_TO_AVOID,
    build_brand_voice_block,
)

logger = logging.getLogger(__name__)

# =========================================================================
# 8 DIMENSIONS (weighted)
# =========================================================================

BRIEF_EVAL_DIMENSIONS: dict[str, dict[str, Any]] = {
    "rfp_traceability": {
        "weight": 0.18,
        "min_score": 7,
        "description": "Can every value prop be traced back to a specific RFP requirement, framed as expertise the contributor brings (not as a task for hire)?",
        "scoring_guide": {
            "0-3": "Brief reads like a generic template — no connection to the actual RFP",
            "4-5": "Some RFP requirements addressed but major gaps (missing task type, wrong skills)",
            "6-7": "Most RFP requirements reflected but loose connections — 'we could do better'",
            "8-9": "Every value prop maps to a specific RFP requirement and is framed expertise-first",
            "10": "Perfect 1:1 mapping. Each requirement is reframed as expertise OneForma is recruiting for",
        },
    },
    "persona_specificity": {
        "weight": 0.13,
        "min_score": 7,
        "description": "Are the 3 personas specific enough to drive creative decisions, and is each persona positioned as an EXPERT (linguistic, professional, lived, or cultural) rather than as a generic, interchangeable audience segment?",
        "scoring_guide": {
            "0-3": "Generic audience description ('young adults interested in tech')",
            "4-5": "Some persona detail but interchangeable — could be anyone",
            "6-7": "Personas have names and basic detail but expertise framing is missing or weak",
            "8-9": "Each persona has a distinct expertise type, pain points, and platform preferences",
            "10": "Reading the persona, you could picture EXACTLY who this expert is and why their expertise matters",
        },
    },
    "cultural_integration": {
        "weight": 0.13,
        "min_score": 6,
        "description": "Does the brief incorporate real cultural research findings (dialect, platform reality, economic framing) without resorting to stereotypes or 'every walk of life' generic language?",
        "scoring_guide": {
            "0-3": "No cultural awareness — could be for any country",
            "4-5": "Mentions the region but no specific cultural insights",
            "6-7": "Includes some cultural data (platforms, economic context) but surface-level",
            "8-9": "Deep cultural integration: dialect, platform reality, economic framing, sensitivities",
            "10": "Someone from the target region would say 'yes, this understands my world'",
        },
    },
    "brand_voice_compliance": {
        "weight": 0.18,
        "min_score": 7,
        "description": (
            "Check if the brief uses the new brand voice: tagline alignment "
            "('OneForma is the AI platform that sees the expert in everyone'), "
            "expertise-first framing (NOT money-first or task-first), the 4 tone "
            "rules (Expertise First, Human First, Purposeful, Specific), locked "
            "CTAs (CTA_PRIMARY 'Put your expertise to work' or CTA_SECONDARY 'Find "
            "a project that knows your worth'), and avoidance of banned words. "
            "AUTOMATIC 0 if any banned word appears in output."
        ),
        "scoring_guide": {
            "0-3": "Banned word detected, OR job-board / 'we are hiring' language, OR money-first hook",
            "4-5": "No banned words but tone is generic — could belong to any platform",
            "6-7": "Voice is recognizable but breaks one of the 4 tone rules in places",
            "8-9": "Voice nails tagline, all 4 tone rules, locked CTAs, expertise-first throughout",
            "10": "A brand strategist would say 'this IS the OneForma voice — every line earns its place'",
        },
    },
    "pillar_clarity": {
        "weight": 0.10,
        "min_score": 6,
        "description": (
            "Does the brief clearly surface 3 angles (Earn / Grow / Shape) the "
            "downstream copy can use, or is the brief pillar-ambiguous? Each pillar "
            "should be identifiable: Earn = predictable pay + flexibility; Grow = "
            "skill-building + portfolio; Shape = expertise contribution + collaborator status."
        ),
        "scoring_guide": {
            "0-3": "No pillar structure — brief is monolithic, downstream copy can't pick an angle",
            "4-5": "One pillar mentioned but the other two are missing or muddled",
            "6-7": "All 3 pillars present but uneven — one is much weaker than the others",
            "8-9": "Each pillar (Earn / Grow / Shape) has a distinct hook and proof points",
            "10": "Downstream copywriter could write 3 separate ad variations from this brief without ambiguity",
        },
    },
    "channel_evidence": {
        "weight": 0.10,
        "min_score": 6,
        "description": "Is the channel strategy backed by real data (not assumptions), with platform choices that match where target experts actually spend time?",
        "scoring_guide": {
            "0-3": "Generic channel list ('LinkedIn, Facebook') — no region-specific data",
            "4-5": "Channels match the region broadly but no demographic breakdown",
            "6-7": "Channels backed by platform usage data but missing age-specific detail",
            "8-9": "Channels cite specific data: 'WhatsApp 96% for 18-25 in Morocco'",
            "10": "Every channel recommendation has a source/data point, including ad cost estimates",
        },
    },
    "ethical_compliance": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Are sensitive topics (children, medical, moderation, biometrics) handled with positive repositioning, expertise framing, and trust signals — never with raw mechanistic language?",
        "scoring_guide": {
            "0-3": "Sensitive topic present but not addressed — raw/inappropriate framing",
            "4-5": "Sensitivity acknowledged but repositioning is weak",
            "6-7": "Positive framing applied but some avoid-phrases still present",
            "8-9": "Full ethical repositioning: positive framing, trust signals, no avoid-phrases",
            "10": "A compliance officer would approve. Pharma-ad-level positive repositioning",
        },
    },
    "actionability": {
        "weight": 0.08,
        "min_score": 7,
        "description": "Could a creative team execute from this brief without asking questions? Are visual direction, copy angles, and pillar selection unambiguous?",
        "scoring_guide": {
            "0-3": "Vague directions — 'make it engaging' with no specifics",
            "4-5": "Some direction but major gaps in visual/copy/format guidance",
            "6-7": "Clear enough to start but would need clarification on specifics",
            "8-9": "A designer could open Figma and start working immediately",
            "10": "Every creative decision is pre-made. Zero ambiguity. Just execute.",
        },
    },
}

# =========================================================================
# Thresholds
# =========================================================================

MIN_ACCEPT_SCORE = 8.0
MIN_DIM_SCORE = 7
SAFETY_GATE = True  # Must pass ethical compliance

# =========================================================================
# Sensitive topic detection keywords (from ethical_positioning.py categories)
# AND brand voice scrubbing patterns (banned brand words, leaked end-customer
# / enterprise client names, old brand framing)
# =========================================================================

_SENSITIVE_KEYWORDS = [
    # Sensitive subject matter (ethical compliance gate)
    "children", "kids", "minor", "child safety", "COPPA", "under 18",
    "pediatric", "medical", "health", "patient", "clinical", "diagnostic",
    "X-ray", "pathology", "HIPAA", "moderation", "harmful content", "toxic",
    "abuse", "graphic", "NSFW", "violence", "hate speech", "biometric",
    "facial recognition", "fingerprint", "voice print", "iris", "face detection",
    "military", "defense", "weapons", "drone", "surveillance", "intelligence",
    "personal photos", "selfies", "voice recording", "handwriting sample",
    # Specific end-customer names that must NEVER appear in any brief
    # (deny-list — surface as a hard signal for the auditor)
    "openai", "anthropic", "google ai",
    # Specific enterprise client names that must NEVER appear in any brief
    "microsoft", "fedex", "lowe's", "lowes", "allstate", "sony",
    # Banned brand words (mirror of WORDS_TO_AVOID — surface as a signal so the
    # evaluator notices and forces brand_voice_compliance to 0)
    "resource", "crowd", "crowdworker", "crowdsource",
    "side hustle", "side-hustle", "microtask", "annotator alone",
    "BPO", "outsourcing", "vendor",
    # Old brand framing (phase-1 voice migration scrub list)
    "data annotation company", "gig worker",
]


def _has_sensitive_topic(request: dict) -> bool:
    """Check if the request touches any sensitive category."""
    searchable_parts: list[str] = []
    for key in ("title", "task_type", "task_description"):
        val = request.get(key)
        if val and isinstance(val, str):
            searchable_parts.append(val)
    form_data = request.get("form_data")
    if isinstance(form_data, dict):
        for val in form_data.values():
            if isinstance(val, str):
                searchable_parts.append(val)
    elif isinstance(form_data, str):
        searchable_parts.append(form_data)

    blob = " ".join(searchable_parts).lower()
    return any(kw.lower() in blob for kw in _SENSITIVE_KEYWORDS)


# =========================================================================
# Prompt builder
# =========================================================================

EVAL_SYSTEM_PROMPT = (
    "You are a brand voice evaluator for OneForma, the AI platform that sees "
    "the expert in everyone. You audit recruitment marketing briefs for both "
    "creative quality AND brand voice compliance, with brutal honesty across "
    "8 dimensions.\n\n"
    "Your scores must be calibrated: an 8 is genuinely excellent work, not "
    "'good enough'. A 5 is mediocre. A 3 is unacceptable. The "
    "brand_voice_compliance dimension is an AUTOMATIC 0 if any banned word "
    "appears in the brief — no exceptions, no partial credit.\n\n"
    f"{build_brand_voice_block()}\n\n"
    "You return ONLY valid JSON. No markdown. No commentary outside the JSON."
)


def build_brief_eval_prompt(
    brief: dict,
    request: dict,
    personas: list[dict] | None = None,
    cultural_research: dict | None = None,
) -> str:
    """Build the evaluation prompt with the full rubric.

    Parameters
    ----------
    brief:
        The generated creative brief dict.
    request:
        The original intake request dict (for traceability checking).
    personas:
        The 3 personas generated for this campaign (for persona_specificity).
    cultural_research:
        Cultural research findings per region (for cultural_integration).
    """
    # Build the dimension rubric block
    rubric_lines: list[str] = []
    for dim_key, dim in BRIEF_EVAL_DIMENSIONS.items():
        rubric_lines.append(f"\n### {dim_key.upper()} (weight={dim['weight']}, min={dim['min_score']})")
        rubric_lines.append(f"Question: {dim['description']}")
        for band, desc in dim["scoring_guide"].items():
            rubric_lines.append(f"  {band}: {desc}")
    rubric_block = "\n".join(rubric_lines)

    # Build persona context if provided
    persona_block = ""
    if personas:
        persona_summaries = []
        for i, p in enumerate(personas, 1):
            persona_summaries.append(
                f"  Persona {i}: {p.get('archetype_key', '?')} "
                f"({p.get('persona_name', '?')}), "
                f"age {p.get('age_range', '?')}, "
                f"pain points: {p.get('pain_points', [])}, "
                f"motivations: {p.get('motivations', [])}, "
                f"psychology: {p.get('psychology_profile', {}).get('primary_bias', '?')}"
            )
        persona_block = (
            "\n\nTARGET PERSONAS (the brief MUST serve all 3):\n"
            + "\n".join(persona_summaries)
        )

    # Build cultural research context if provided
    cultural_block = ""
    if cultural_research:
        cultural_block = (
            "\n\nCULTURAL RESEARCH FINDINGS (the brief must integrate these):\n"
            + json.dumps(cultural_research, indent=2, ensure_ascii=False, default=str)[:3000]
        )

    # Detect sensitive topics for ethical compliance scoring context
    sensitive_note = ""
    if _has_sensitive_topic(request):
        sensitive_note = (
            "\n\nSENSITIVE TOPIC DETECTED: This campaign touches sensitive "
            "subject matter. The ethical_compliance dimension is a HARD GATE. "
            "Check that the brief uses positive repositioning, avoids raw "
            "mechanistic framing, and includes trust signals."
        )

    form_data = request.get("form_data", {})
    task_description = (
        form_data.get("task_description", "")
        if isinstance(form_data, dict)
        else str(form_data)
    )

    banned_words_csv = ", ".join(WORDS_TO_AVOID)

    return f"""Evaluate this recruitment marketing brief for OneForma against the RFP, personas, and brand voice rules.

=== ORIGINAL RFP / INTAKE REQUEST ===
Title: {request.get("title", "?")}
Task type: {request.get("task_type", "?")}
Target regions: {request.get("target_regions", [])}
Target languages: {request.get("target_languages", [])}
Volume needed: {request.get("volume_needed", "?")} contributors
Task details: {task_description}
{persona_block}
{cultural_block}
{sensitive_note}

=== GENERATED BRIEF TO EVALUATE ===
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

=== SCORING RUBRIC (score 0-10 per dimension) ===
{rubric_block}

=== HARD GATES ===
- Overall weighted score must be >= {MIN_ACCEPT_SCORE} to accept
- Every dimension must score >= its min_score (see above)
- If a sensitive topic is detected, ethical_compliance < 7 = REJECT (not just revise)
- BRAND VOICE GATE: If ANY of these banned words appears anywhere in the brief
  output, brand_voice_compliance is AUTOMATICALLY 0 and the verdict is REJECT.
  Banned words: {banned_words_csv}

=== INSTRUCTIONS ===
1. Score each dimension 0-10 using the scoring guide above.
2. Provide specific feedback per dimension (what worked, what failed, what to fix).
3. List concrete improvement suggestions if verdict is not "accept".
4. For rfp_traceability: check that each value prop maps to a specific RFP requirement, framed expertise-first.
5. For persona_specificity: check that personas are positioned as experts (linguistic, professional, lived, or cultural).
6. For cultural_integration: check for real cultural data, not generic regional references.
7. For brand_voice_compliance: scan the entire brief for banned words first. If found, score = 0. Otherwise, audit tagline alignment, the 4 tone rules (Expertise First, Human First, Purposeful, Specific), and locked CTA usage.
8. For pillar_clarity: check that the brief clearly identifies Earn / Grow / Shape angles a downstream copywriter could pick from.
9. For ethical_compliance: if sensitive topics exist, check positive framing and avoid-phrases.

Return ONLY valid JSON:
{{
  "dimensions": {{
    "rfp_traceability": {{"score": 0, "feedback": "..."}},
    "persona_specificity": {{"score": 0, "feedback": "..."}},
    "cultural_integration": {{"score": 0, "feedback": "..."}},
    "brand_voice_compliance": {{"score": 0, "feedback": "..."}},
    "pillar_clarity": {{"score": 0, "feedback": "..."}},
    "channel_evidence": {{"score": 0, "feedback": "..."}},
    "ethical_compliance": {{"score": 0, "feedback": "..."}},
    "actionability": {{"score": 0, "feedback": "..."}}
  }},
  "improvement_suggestions": ["...", "..."],
  "evaluator_notes": "Brief summary of overall quality and most critical gap"
}}"""


# =========================================================================
# Scoring engine
# =========================================================================

def score_brief(
    eval_response: dict,
    request: dict | None = None,
) -> dict[str, Any]:
    """Calculate weighted score, check hard gates, determine verdict.

    Parameters
    ----------
    eval_response:
        Parsed JSON from the LLM evaluation. Must have a ``dimensions`` dict
        where each key maps to ``{"score": int, "feedback": str}``.
    request:
        Original intake request (used for sensitive topic detection).

    Returns
    -------
    dict
        Standardized result with keys: ``verdict``, ``overall_score``,
        ``weighted_score``, ``dimension_scores``, ``hard_gate_failures``,
        ``improvement_suggestions``, ``feedback_per_dimension``.
    """
    dimensions = eval_response.get("dimensions", {})
    improvement_suggestions = eval_response.get("improvement_suggestions", [])
    evaluator_notes = eval_response.get("evaluator_notes", "")

    # Calculate weighted score
    weighted_score = 0.0
    dimension_scores: dict[str, dict[str, Any]] = {}
    hard_gate_failures: list[str] = []
    feedback_per_dimension: dict[str, str] = {}

    for dim_key, dim_config in BRIEF_EVAL_DIMENSIONS.items():
        dim_data = dimensions.get(dim_key, {})
        raw_score = dim_data.get("score", 0)
        # Clamp to 0-10
        score = max(0, min(10, int(raw_score)))
        feedback = dim_data.get("feedback", "")

        weighted_contribution = score * dim_config["weight"]
        weighted_score += weighted_contribution

        dimension_scores[dim_key] = {
            "score": score,
            "weight": dim_config["weight"],
            "weighted_contribution": round(weighted_contribution, 3),
            "min_required": dim_config["min_score"],
            "passed": score >= dim_config["min_score"],
        }
        feedback_per_dimension[dim_key] = feedback

        # Check hard gate
        if score < dim_config["min_score"]:
            hard_gate_failures.append(
                f"{dim_key}: scored {score}, minimum required {dim_config['min_score']}"
            )

    weighted_score = round(weighted_score, 2)

    # Determine verdict
    has_sensitive_topic = _has_sensitive_topic(request) if request else False
    ethical_score = dimensions.get("ethical_compliance", {}).get("score", 10)

    if has_sensitive_topic and ethical_score < 7:
        # Hard reject on ethical compliance for sensitive topics
        verdict = "reject"
        hard_gate_failures.insert(
            0,
            f"SAFETY GATE: ethical_compliance={ethical_score} on sensitive topic (requires >= 7)",
        )
    elif weighted_score >= MIN_ACCEPT_SCORE and not hard_gate_failures:
        verdict = "accept"
    elif weighted_score < 5.0 or any(
        dimensions.get(k, {}).get("score", 0) < 4
        for k in BRIEF_EVAL_DIMENSIONS
    ):
        verdict = "reject"
    else:
        verdict = "revise"

    # Build feedback list for retry loop (used by stage1)
    retry_feedback: list[str] = []
    if verdict != "accept":
        # Add dimension-specific feedback for failing dimensions
        for dim_key in BRIEF_EVAL_DIMENSIONS:
            ds = dimension_scores.get(dim_key, {})
            if not ds.get("passed", True):
                fb = feedback_per_dimension.get(dim_key, "")
                retry_feedback.append(
                    f"[{dim_key}] Score {ds.get('score', 0)}/{ds.get('min_required', 7)}: {fb}"
                )
        # Add general improvement suggestions
        retry_feedback.extend(improvement_suggestions)

    # Legacy compatibility: produce an overall_score on 0-1 scale for stage1
    overall_score_normalized = round(weighted_score / 10.0, 3)

    return {
        "verdict": verdict,
        "overall_score": overall_score_normalized,
        "weighted_score": weighted_score,
        "dimension_scores": dimension_scores,
        "hard_gate_failures": hard_gate_failures,
        "improvement_suggestions": retry_feedback if verdict != "accept" else [],
        "feedback_per_dimension": feedback_per_dimension,
        "evaluator_notes": evaluator_notes,
        "sensitive_topic_detected": has_sensitive_topic,
    }
