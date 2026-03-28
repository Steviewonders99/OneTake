"""Marketing Brief Evaluator — strict relevance to RFP + OneForma positioning.

Every brief must demonstrate:
1. Direct traceability to the RFP requirements
2. Persona-specific messaging (not generic)
3. Cultural intelligence integration
4. OneForma brand voice compliance
5. Ethical positioning for sensitive topics
6. Actionable channel strategy with evidence

Scoring: 0-10 per dimension (Neurogen pattern)
Hard gates: MIN_ACCEPT = 8.0 overall, MIN_DIM = 7 per dimension
Verdict: accept | revise | reject
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# =========================================================================
# 8 DIMENSIONS (weighted)
# =========================================================================

BRIEF_EVAL_DIMENSIONS: dict[str, dict[str, Any]] = {
    "rfp_traceability": {
        "weight": 0.20,
        "min_score": 7,
        "description": "Can every value prop be traced back to a specific RFP requirement?",
        "scoring_guide": {
            "0-3": "Brief reads like a generic template — no connection to the actual RFP",
            "4-5": "Some RFP requirements addressed but major gaps (missing task type, wrong skills)",
            "6-7": "Most RFP requirements reflected but loose connections — 'we could do better'",
            "8-9": "Every value prop maps to a specific RFP requirement with clear logic",
            "10": "Perfect 1:1 mapping. Reading the brief, you could reconstruct the RFP",
        },
    },
    "persona_specificity": {
        "weight": 0.15,
        "min_score": 7,
        "description": "Are the 3 personas specific enough to drive creative decisions?",
        "scoring_guide": {
            "0-3": "Generic audience description ('young adults interested in tech')",
            "4-5": "Some persona detail but interchangeable — could be anyone",
            "6-7": "Personas have names and basic psychology but lack cultural depth",
            "8-9": "Each persona has distinct psychology hooks, pain points, and platform preferences",
            "10": "Reading the persona, you could picture EXACTLY who this person is and what makes them click",
        },
    },
    "cultural_integration": {
        "weight": 0.15,
        "min_score": 6,
        "description": "Does the brief incorporate real cultural research findings?",
        "scoring_guide": {
            "0-3": "No cultural awareness — could be for any country",
            "4-5": "Mentions the region but no specific cultural insights",
            "6-7": "Includes some cultural data (platforms, economic context) but surface-level",
            "8-9": "Deep cultural integration: dialect, platform reality, economic framing, sensitivities",
            "10": "Someone from the target region would say 'yes, this understands my world'",
        },
    },
    "oneforma_brand_fit": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Does the messaging match OneForma's brand voice?",
        "scoring_guide": {
            "0-3": "Corporate tone, 'we are hiring' language, job board aesthetic",
            "4-5": "Mildly friendly but still reads like a corporate careers page",
            "6-7": "Opportunity-focused but missing the 'friend telling you about a gig' warmth",
            "8-9": "Nails the OneForma voice: friendly, inviting, contributor-benefit-first",
            "10": "You'd think a real OneForma contributor wrote this to recruit their friends",
        },
    },
    "psychology_depth": {
        "weight": 0.10,
        "min_score": 6,
        "description": "Are marketing psychology hooks well-chosen and applied per persona?",
        "scoring_guide": {
            "0-3": "No psychological targeting — same generic message for everyone",
            "4-5": "Mentions a bias type but doesn't apply it to messaging",
            "6-7": "Each persona has a psychology hook but application is surface-level",
            "8-9": "Psychology hooks drive specific copy angles per persona (e.g., loss aversion for parents)",
            "10": "A behavioral scientist would approve every hook-to-message mapping",
        },
    },
    "channel_evidence": {
        "weight": 0.10,
        "min_score": 6,
        "description": "Is the channel strategy backed by real data (not assumptions)?",
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
        "description": "Are sensitive topics (children, medical, moderation) handled correctly?",
        "scoring_guide": {
            "0-3": "Sensitive topic present but not addressed — raw/inappropriate framing",
            "4-5": "Sensitivity acknowledged but repositioning is weak",
            "6-7": "Positive framing applied but some avoid-phrases still present",
            "8-9": "Full ethical repositioning: positive framing, trust signals, no avoid-phrases",
            "10": "A compliance officer would approve. Pharma-ad-level positive repositioning",
        },
    },
    "actionability": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Could a creative team execute from this brief without asking questions?",
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
# =========================================================================

_SENSITIVE_KEYWORDS = [
    "children", "kids", "minor", "child safety", "COPPA", "under 18",
    "pediatric", "medical", "health", "patient", "clinical", "diagnostic",
    "X-ray", "pathology", "HIPAA", "moderation", "harmful content", "toxic",
    "abuse", "graphic", "NSFW", "violence", "hate speech", "biometric",
    "facial recognition", "fingerprint", "voice print", "iris", "face detection",
    "military", "defense", "weapons", "drone", "surveillance", "intelligence",
    "personal photos", "selfies", "voice recording", "handwriting sample",
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
    "You are a senior creative strategist evaluating recruitment marketing "
    "briefs for OneForma. You score with brutal honesty across 8 dimensions. "
    "Your scores must be calibrated: an 8 is genuinely excellent work, not "
    "'good enough'. A 5 is mediocre. A 3 is unacceptable.\n\n"
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
            + json.dumps(cultural_research, indent=2, ensure_ascii=False)[:3000]
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

    return f"""Evaluate this recruitment marketing brief for OneForma against the RFP and personas.

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
{json.dumps(brief, indent=2, ensure_ascii=False)}

=== SCORING RUBRIC (score 0-10 per dimension) ===
{rubric_block}

=== HARD GATES ===
- Overall weighted score must be >= {MIN_ACCEPT_SCORE} to accept
- Every dimension must score >= its min_score (see above)
- If a sensitive topic is detected, ethical_compliance < 7 = REJECT (not just revise)

=== INSTRUCTIONS ===
1. Score each dimension 0-10 using the scoring guide above.
2. Provide specific feedback per dimension (what worked, what failed, what to fix).
3. List concrete improvement suggestions if verdict is not "accept".
4. For rfp_traceability: check that each value prop maps to a specific RFP requirement.
5. For persona_specificity: check that personas drive creative decisions, not just decorate.
6. For cultural_integration: check for real cultural data, not generic regional references.
7. For ethical_compliance: if sensitive topics exist, check positive framing and avoid-phrases.

Return ONLY valid JSON:
{{
  "dimensions": {{
    "rfp_traceability": {{"score": 0, "feedback": "..."}},
    "persona_specificity": {{"score": 0, "feedback": "..."}},
    "cultural_integration": {{"score": 0, "feedback": "..."}},
    "oneforma_brand_fit": {{"score": 0, "feedback": "..."}},
    "psychology_depth": {{"score": 0, "feedback": "..."}},
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
