# worker/prompts/video_evaluator.py
"""Video script evaluator — 6-dimension rubric with hard gating.

Ported from Neurogen's script_evaluator.py architecture.
Hard gating independent of LLM self-assessment, rewrite loop on failure.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# ── Thresholds ───────────────────────────────────────────────────────

MIN_OVERALL_SCORE = 8.0
MAX_RETRIES = 2

DIMENSIONS: dict[str, dict[str, Any]] = {
    "scroll_stop_hook": {
        "weight": 0.20,
        "min_score": 7,
        "description": "Does the first 2s stop scrolling? Pattern interrupt? Bold claim? Face-to-camera intensity?",
    },
    "energy_arc": {
        "weight": 0.15,
        "min_score": 7,
        "description": "Does energy build across beats? Feels like one continuous thought? Not flat or disconnected?",
    },
    "pain_point_resonance": {
        "weight": 0.20,
        "min_score": 7,
        "description": "Does it hit a real nerve for THIS persona? Visceral problem, not generic?",
    },
    "cta_urgency": {
        "weight": 0.15,
        "min_score": 7,
        "description": "OneForma name drop? Specific CTA? Reason to act NOW? Strong ending frame?",
    },
    "persona_authenticity": {
        "weight": 0.20,
        "min_score": 7,
        "description": "Does dialogue sound like THIS person? Trigger words used? Local language native? Right tone for age/region?",
    },
    "filmability": {
        "weight": 0.10,
        "min_score": 8,
        "description": "Can Kling generate this? No screen content, <=6 shots, dialogue before 10s, physically filmable actions, 12-15s total?",
    },
}

# ── Auto-fail patterns ───────────────────────────────────────────────

AUTO_FAIL_PATTERNS = [
    "check it out",
    "link in bio",
    "learn more",
    "flexible hours",
    "extra income",
]

GENERIC_CTA_PATTERNS = ["check it out", "link in bio", "learn more", "click here"]


# ── Result ───────────────────────────────────────────────────────────

@dataclass
class ScriptEvalResult:
    passed: bool
    overall_score: float
    scores: dict[str, int] = field(default_factory=dict)
    auto_fails: list[str] = field(default_factory=list)
    reason: str = ""
    raw_response: str = ""


# ── Deterministic pre-check ──────────────────────────────────────────

def check_script_constraints(script: dict[str, Any]) -> list[str]:
    """Fast deterministic checks before LLM evaluation."""
    issues: list[str] = []

    scenes = script.get("scenes", script.get("shots", []))
    if not scenes:
        issues.append("No scenes/shots in script")
        return issues

    # Shot count
    if len(scenes) > 6:
        issues.append(f"Too many shots ({len(scenes)}) — max 6 for Kling multishot")

    # Duration
    total_s = sum(s.get("duration_s", 0) for s in scenes)
    if total_s < 12:
        issues.append(f"Total duration {total_s}s — minimum 12s")
    if total_s > 15:
        issues.append(f"Total duration {total_s}s — maximum 15s")

    # Dialogue after 10s
    cumulative = 0
    for s in scenes:
        cumulative += s.get("duration_s", 0)
        if s.get("dialogue") and cumulative > 10:
            issues.append(f"Dialogue at {cumulative}s — lip sync breaks after 10s")
            break

    # OneForma mention
    all_dialogue = " ".join(s.get("dialogue", "") for s in scenes).lower()
    if "oneforma" not in all_dialogue:
        issues.append("No 'OneForma' mentioned in dialogue — brand must be named")

    # Generic CTA check
    for pattern in GENERIC_CTA_PATTERNS:
        if pattern in all_dialogue:
            issues.append(f"Generic CTA detected: '{pattern}' — needs specific action + time anchor")

    # Anti-patterns
    for pattern in AUTO_FAIL_PATTERNS:
        if pattern in all_dialogue:
            issues.append(f"Auto-fail: '{pattern}' — generic gig language")

    # Camera direction
    for i, s in enumerate(scenes):
        if not s.get("camera"):
            issues.append(f"Shot {i + 1} missing camera direction")

    # Screen content
    screen_words = ["screen", "ui", "interface", "dashboard", "app screenshot"]
    for word in screen_words:
        if word in all_dialogue or any(word in s.get("action", "").lower() for s in scenes):
            issues.append(f"Screen content reference detected ('{word}') — Kling can't render UIs")

    return issues


# ── LLM evaluation prompt ────────────────────────────────────────────

def build_eval_prompt(script_json: str, persona: dict[str, Any]) -> str:
    """Build the LLM evaluation prompt for a video script."""
    dim_block = "\n".join(
        f"- {name} ({d['weight']:.0%} weight, min {d['min_score']}): {d['description']}"
        for name, d in DIMENSIONS.items()
    )

    persona_name = persona.get("persona_name", persona.get("name", "unknown"))
    trigger_words = persona.get("psychology_profile", {}).get("trigger_words", [])

    return f"""Evaluate this UGC video script for quality. Score each dimension 0-10.

PERSONA this script targets: {persona_name}
Trigger words that should appear: {', '.join(trigger_words[:6])}
Pain point to address: {persona.get('customized_pain', '')}

DIMENSIONS:
{dim_block}

SCRIPT:
{script_json}

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "scores": {{
    "scroll_stop_hook": 0,
    "energy_arc": 0,
    "pain_point_resonance": 0,
    "cta_urgency": 0,
    "persona_authenticity": 0,
    "filmability": 0
  }},
  "reason": "brief explanation of weakest dimensions"
}}

Gate rules:
- overall_score >= {MIN_OVERALL_SCORE} AND all dimensions >= their minimums → "accept"
- Otherwise describe what must improve"""


# ── Hard gating (independent of LLM verdict) ────────────────────────

def compute_passed(scores: dict[str, int], auto_fails: list[str]) -> tuple[bool, float]:
    """Compute pass/fail independent of what the LLM says."""
    if auto_fails:
        return False, 0.0

    overall = sum(
        scores.get(dim, 0) * DIMENSIONS[dim]["weight"]
        for dim in DIMENSIONS
    )

    if overall < MIN_OVERALL_SCORE:
        return False, overall

    for dim, cfg in DIMENSIONS.items():
        if scores.get(dim, 0) < cfg["min_score"]:
            return False, overall

    return True, overall


# ── Rewrite prompt ───────────────────────────────────────────────────

def build_rewrite_prompt(
    script_json: str,
    eval_result: ScriptEvalResult,
    persona: dict[str, Any],
    template_key: str,
) -> str:
    """Build a rewrite prompt using the evaluation feedback."""
    eval_summary = json.dumps({
        "overall_score": eval_result.overall_score,
        "scores": eval_result.scores,
        "auto_fails": eval_result.auto_fails,
        "reason": eval_result.reason,
    }, indent=2)

    return f"""Rewrite this UGC video script to fix the quality issues.

EVALUATION FEEDBACK:
{eval_summary}

PERSONA: {persona.get('persona_name', 'unknown')}
TEMPLATE: {template_key}
TRIGGER WORDS: {', '.join(persona.get('psychology_profile', {}).get('trigger_words', [])[:6])}

ORIGINAL SCRIPT:
{script_json}

RULES:
- Keep the same template structure and shot count
- Keep approximately the same total duration (12-15s)
- Fix EVERY issue listed in the evaluation
- ALL dialogue must end before the 10-second mark
- "OneForma" must appear in the dialogue
- CTA must be specific with a time anchor (not "check it out")
- Output ONLY the improved JSON script — no explanation"""
