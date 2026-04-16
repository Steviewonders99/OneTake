"""Creative evaluation engine -- 7 dimensions adapted for recruitment marketing.

Each dimension has its own threshold. The overall score must also pass
``OVERALL_THRESHOLD`` for the creative to be approved. When the LLM
evaluator cannot be parsed, a deterministic heuristic fallback kicks in.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from prompts.recruitment_evaluation import EVAL_SYSTEM_PROMPT, build_eval_prompt

from ai.local_llm import generate_text

logger = logging.getLogger(__name__)

DIMENSIONS: dict[str, dict[str, Any]] = {
    "employer_brand_fit": {
        "threshold": 0.70,
        "description": "Matches OneForma voice and culture",
    },
    "candidate_hook": {
        "threshold": 0.65,
        "description": "Would a job seeker stop scrolling?",
    },
    "readability": {
        "threshold": 0.70,
        "description": "Clear, concise, scannable text",
    },
    "visual_text_harmony": {
        "threshold": 0.60,
        "description": "Template + style complement copy",
    },
    "application_cta": {
        "threshold": 0.70,
        "description": "Apply/signup action is clear",
    },
    "platform_compliance": {
        "threshold": 0.75,
        "description": "Dimensions/format suit platform",
    },
    "culture_proof": {
        "threshold": 0.50,
        "description": "Feels authentic, not corporate",
    },
}

OVERALL_THRESHOLD = 0.70


async def evaluate_creative(creative_data: dict) -> dict:
    """Evaluate a creative across 7 dimensions.

    Returns
    -------
    dict
        Keys: ``overall_score`` (float), ``passed`` (bool),
        ``dimensions`` (dict), ``improvement_suggestions`` (list[str]).
    """
    prompt = build_eval_prompt(creative_data)
    result_text = await generate_text(EVAL_SYSTEM_PROMPT, prompt, temperature=0.2)

    try:
        cleaned = result_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        scores: dict = json.loads(cleaned.strip())
    except (json.JSONDecodeError, IndexError):
        logger.warning("LLM evaluator returned unparseable output; using heuristic fallback.")
        return _heuristic_evaluate(creative_data)

    dimension_scores: dict = scores.get("dimensions", {})

    if dimension_scores:
        overall = sum(
            d.get("score", 0) for d in dimension_scores.values()
        ) / max(len(dimension_scores), 1)
    else:
        overall = scores.get("overall_score", 0.0)

    passed = overall >= OVERALL_THRESHOLD and all(
        dimension_scores.get(dim, {}).get("score", 0) >= info["threshold"]
        for dim, info in DIMENSIONS.items()
    )

    return {
        "overall_score": overall,
        "passed": passed,
        "dimensions": dimension_scores,
        "improvement_suggestions": scores.get("improvement_suggestions", []),
    }


def _heuristic_evaluate(data: dict) -> dict:
    """Deterministic rule-based fallback when LLM evaluator fails."""
    headline = data.get("headline", "")
    cta = data.get("cta_text", "")
    subheadline = data.get("subheadline", "")

    scores: dict[str, dict[str, Any]] = {}

    # candidate_hook: headline word count between 3-10 is optimal
    word_count = len(headline.split())
    scores["candidate_hook"] = {
        "score": min(1.0, word_count / 8) if word_count <= 10 else 0.6,
        "feedback": f"Headline has {word_count} words.",
    }

    # readability: shorter headlines score higher
    scores["readability"] = {
        "score": 0.85 if len(headline) < 40 else (0.70 if len(headline) < 60 else 0.55),
        "feedback": f"Headline length: {len(headline)} chars.",
    }

    # application_cta: check for action verbs
    action_verbs = {"start", "join", "sign", "earn", "apply", "begin", "get", "register"}
    has_action = any(w in cta.lower().split() for w in action_verbs)
    scores["application_cta"] = {
        "score": 0.90 if has_action else 0.50,
        "feedback": "CTA verb check.",
    }

    # employer_brand_fit
    scores["employer_brand_fit"] = {
        "score": 0.75,
        "feedback": "Default -- manual review recommended.",
    }

    # visual_text_harmony
    total_text = len(headline) + len(subheadline)
    scores["visual_text_harmony"] = {
        "score": 0.80 if total_text < 100 else 0.60,
        "feedback": f"Total text: {total_text} chars.",
    }

    # platform_compliance
    scores["platform_compliance"] = {
        "score": 0.80,
        "feedback": "Default -- dimensions assumed correct from compositor.",
    }

    # culture_proof
    scores["culture_proof"] = {
        "score": 0.65,
        "feedback": "Default -- manual review recommended.",
    }

    overall = sum(d["score"] for d in scores.values()) / len(scores)
    passed = overall >= OVERALL_THRESHOLD and all(
        scores.get(dim, {}).get("score", 0) >= info["threshold"]
        for dim, info in DIMENSIONS.items()
    )

    return {
        "overall_score": round(overall, 3),
        "passed": passed,
        "dimensions": scores,
        "improvement_suggestions": [],
    }
