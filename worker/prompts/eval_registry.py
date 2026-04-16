"""Evaluation Registry — unified access to all evaluation rubrics.

All evaluators follow the same pattern:
1. Build prompt with full rubric + context
2. Call LLM (Qwen3.5-9B in no-think mode for structured JSON)
3. Parse response and calculate weighted score
4. Apply hard gates (min dimension scores)
5. Determine verdict: accept | revise | reject
6. Return structured result with per-dimension feedback

Usage
-----
    from prompts.eval_registry import evaluate, EVALUATORS

    # Run a brief evaluation
    result = await evaluate(
        "brief",
        context={
            "brief": brief_data,
            "request": request,
            "personas": personas,
            "cultural_research": cultural_research,
        },
        llm_fn=generate_text,
    )

    if result["verdict"] == "accept":
        proceed()
    elif result["verdict"] == "revise":
        retry_with(result["improvement_suggestions"])
    else:
        reject_and_notify(result["hard_gate_failures"])
"""
from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from prompts.eval_brief import (
    BRIEF_EVAL_DIMENSIONS,
    build_brief_eval_prompt,
    score_brief,
)
from prompts.eval_brief import (
    EVAL_SYSTEM_PROMPT as BRIEF_EVAL_SYSTEM,
)
from prompts.eval_image_realism import (
    EVAL_SYSTEM_PROMPT as IMAGE_EVAL_SYSTEM,
)
from prompts.eval_image_realism import (
    IMAGE_REALISM_DIMENSIONS,
    build_image_realism_prompt,
    score_image_realism,
)
from prompts.eval_video_script import (
    EVAL_SYSTEM_PROMPT as SCRIPT_EVAL_SYSTEM,
)
from prompts.eval_video_script import (
    SCRIPT_EVAL_DIMENSIONS,
    build_script_eval_prompt,
    score_script,
)

logger = logging.getLogger(__name__)

# =========================================================================
# Evaluator Registry
# =========================================================================

EVALUATORS: dict[str, dict[str, Any]] = {
    "brief": {
        "build_prompt": build_brief_eval_prompt,
        "scorer": score_brief,
        "dimensions": BRIEF_EVAL_DIMENSIONS,
        "system_prompt": BRIEF_EVAL_SYSTEM,
        "context_keys": ["brief", "request", "personas", "cultural_research"],
        "description": (
            "Evaluates creative briefs for RFP traceability, persona specificity, "
            "cultural integration, brand fit, psychology depth, channel evidence, "
            "ethical compliance, and actionability."
        ),
    },
    "image_realism": {
        "build_prompt": build_image_realism_prompt,
        "scorer": score_image_realism,
        "dimensions": IMAGE_REALISM_DIMENSIONS,
        "system_prompt": IMAGE_EVAL_SYSTEM,
        "context_keys": ["actor_data", "image_description"],
        "description": (
            "Strict 10-dimension realism evaluation for AI-generated images. "
            "Checks skin texture, hair, facial asymmetry, lighting, fabric, "
            "background, pose, camera artifacts, objects, and anatomy."
        ),
    },
    "video_script": {
        "build_prompt": build_script_eval_prompt,
        "scorer": score_script,
        "dimensions": SCRIPT_EVAL_DIMENSIONS,
        "system_prompt": SCRIPT_EVAL_SYSTEM,
        "context_keys": ["script", "persona", "platform", "language"],
        "description": (
            "Neurogen-style 8-dimension script evaluation. Checks hook strength, "
            "pacing, persona resonance, benefit clarity, CTA effectiveness, "
            "visual directability, platform nativeness, and safety compliance."
        ),
    },
}


# =========================================================================
# JSON parsing utility
# =========================================================================

def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles thinking, code fences, embedded JSON.

    Same robust extractor as stage1: tries direct parse, strips fences,
    then searches for the LARGEST valid JSON object in the text.
    """
    if not text:
        return {"raw_text": "", "dimensions": {}}

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

    # Search for the LARGEST valid JSON object in the text
    # (handles reasoning text with JSON embedded at the end)
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
                candidate = cleaned[json_start:i + 1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and len(candidate) > best_size:
                        best_json = parsed
                        best_size = len(candidate)
                except json.JSONDecodeError:
                    pass
                json_start = -1

    if best_json:
        logger.info("Extracted JSON from text (%d keys, %d chars)", len(best_json), best_size)
        return best_json

    logger.warning("Failed to parse JSON from evaluation response (%d chars)", len(text))
    return {"raw_text": text, "dimensions": {}}


# =========================================================================
# Unified evaluation function
# =========================================================================

# Type alias for the LLM function signature
LLMFunction = Callable[..., Awaitable[str]]


async def evaluate(
    evaluator_key: str,
    context: dict[str, Any],
    llm_fn: LLMFunction,
    *,
    temperature: float = 0.2,
    max_tokens: int = 8192,
    thinking: bool = False,  # Evals need JSON output, not reasoning. Think=True exhausts tokens on 9B.
) -> dict[str, Any]:
    """Run any evaluator by key. Returns standardized result.

    Parameters
    ----------
    evaluator_key:
        One of: "brief", "image_realism", "video_script".
    context:
        Dict of arguments to pass to the evaluator's build_prompt function.
        Keys must match the evaluator's ``context_keys``.
    llm_fn:
        Async function matching the signature of ``ai.local_llm.generate_text``:
        ``async def llm_fn(system_prompt, user_prompt, **kwargs) -> str``
    temperature:
        LLM temperature for evaluation (default 0.2 for consistency).
    max_tokens:
        Maximum tokens for the evaluation response.
    thinking:
        Whether to use extended thinking mode (default False — evaluations
        should be structured JSON, not chain-of-thought).

    Returns
    -------
    dict
        Standardized result with keys:
        - ``verdict``: "accept" | "revise" | "reject"
        - ``overall_score``: float 0-1 (legacy compatible)
        - ``weighted_score``: float 0-10
        - ``dimension_scores``: per-dimension breakdown
        - ``hard_gate_failures``: list of failing gates
        - ``improvement_suggestions``: actionable feedback for retry
        - ``evaluator``: which evaluator was used
        - ``raw_response``: the parsed LLM response dict

    Raises
    ------
    KeyError
        If ``evaluator_key`` is not in the registry.
    ValueError
        If required context keys are missing.
    """
    if evaluator_key not in EVALUATORS:
        raise KeyError(
            f"Unknown evaluator '{evaluator_key}'. "
            f"Available: {list(EVALUATORS.keys())}"
        )

    evaluator = EVALUATORS[evaluator_key]
    build_prompt = evaluator["build_prompt"]
    scorer = evaluator["scorer"]
    system_prompt = evaluator["system_prompt"]
    required_keys = evaluator["context_keys"]

    # Validate context
    missing = [k for k in required_keys if k not in context]
    # Allow optional keys (only error on keys that are always required)
    # For brief: brief and request are required; personas and cultural_research are optional
    # For image_realism: actor_data is required; image_description is optional
    # For video_script: script, persona, platform, language are all required
    _always_required = {
        "brief": ["brief", "request"],
        "image_realism": ["actor_data"],
        "video_script": ["script", "persona", "platform", "language"],
    }
    truly_missing = [
        k for k in _always_required.get(evaluator_key, required_keys)
        if k not in context
    ]
    if truly_missing:
        raise ValueError(
            f"Evaluator '{evaluator_key}' requires context keys: {truly_missing}"
        )

    # Build the evaluation prompt
    # Filter context to only the keys this evaluator accepts
    prompt_kwargs = {k: context[k] for k in required_keys if k in context}
    eval_prompt = build_prompt(**prompt_kwargs)

    logger.info(
        "Running %s evaluator (prompt length: %d chars)",
        evaluator_key,
        len(eval_prompt),
    )

    # Append strict JSON output rules to system prompt
    json_rules = (
        "\n\nOUTPUT FORMAT — STRICT:\n"
        "You MUST output a single valid JSON object.\n"
        "No markdown code fences. No commentary before or after the JSON.\n"
        "No trailing commas. No single quotes. No unquoted keys.\n"
        "The JSON must be complete and parseable by Python json.loads().\n"
        "Start with { and end with }. Nothing else after the JSON.\n"
        "Include a 'feedback' key with specific, actionable feedback for EACH dimension.\n"
        "Include an 'improvement_suggestions' key listing exactly what to change to score higher."
    )

    # Call LLM
    raw_text = await llm_fn(
        system_prompt + json_rules,
        eval_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        thinking=thinking,
    )

    # Parse response
    eval_data = _parse_json(raw_text)

    # Handle parse failure
    if "raw_text" in eval_data and "dimensions" not in eval_data:
        logger.error(
            "Evaluation for %s returned unparseable response", evaluator_key,
        )
        return {
            "verdict": "revise",
            "overall_score": 0.0,
            "weighted_score": 0.0,
            "dimension_scores": {},
            "hard_gate_failures": ["LLM response could not be parsed as JSON"],
            "improvement_suggestions": ["Evaluation failed — retry"],
            "evaluator": evaluator_key,
            "raw_response": eval_data,
            "parse_error": True,
        }

    # Score the response
    # The brief scorer takes an optional second arg (request) for sensitive topic detection
    if evaluator_key == "brief":
        result = scorer(eval_data, request=context.get("request"))
    else:
        result = scorer(eval_data)

    # Attach metadata
    result["evaluator"] = evaluator_key
    result["raw_response"] = eval_data
    result["parse_error"] = False

    logger.info(
        "%s evaluation: verdict=%s, score=%.2f, gates_failed=%d",
        evaluator_key,
        result["verdict"],
        result["weighted_score"],
        len(result.get("hard_gate_failures", [])),
    )

    return result


# =========================================================================
# Convenience accessors
# =========================================================================

def get_evaluator_info(evaluator_key: str) -> dict[str, Any]:
    """Get metadata about an evaluator without running it.

    Returns dimensions, thresholds, and description.
    """
    if evaluator_key not in EVALUATORS:
        raise KeyError(f"Unknown evaluator: {evaluator_key}")

    evaluator = EVALUATORS[evaluator_key]
    dims = evaluator["dimensions"]

    # Calculate total weight to verify it sums to 1.0
    total_weight = sum(d["weight"] for d in dims.values())

    return {
        "evaluator": evaluator_key,
        "description": evaluator["description"],
        "dimension_count": len(dims),
        "dimensions": {
            k: {
                "weight": v["weight"],
                "min_score": v["min_score"],
                "description": v["description"],
            }
            for k, v in dims.items()
        },
        "total_weight": round(total_weight, 3),
        "context_keys": evaluator["context_keys"],
    }


def list_evaluators() -> list[dict[str, Any]]:
    """List all available evaluators with summary info."""
    return [
        {
            "key": key,
            "description": ev["description"],
            "dimension_count": len(ev["dimensions"]),
        }
        for key, ev in EVALUATORS.items()
    ]
