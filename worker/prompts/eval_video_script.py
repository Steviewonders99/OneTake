"""Video Script Pre-Gate Evaluator — Neurogen-style dimensional scoring.

Evaluates video scripts BEFORE they go to Kling 3.0 video generation.
A bad script wastes $0.16 per Kling generation, so this gate must be tight.

Scoring: 0-10 per dimension (weighted)
Hard gates: MIN_ACCEPT = 8.0 overall, ALL dimensions >= 7
Safety gate: "safe" | "minor_issues_fixable" | "unsafe" -> unsafe = reject
Verdict: accept | revise | reject

Adapted from Neurogen's TikTok story script evaluator with recruitment-specific dimensions.
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# =========================================================================
# 8 DIMENSIONS (weighted, Neurogen-inspired)
# =========================================================================

SCRIPT_EVAL_DIMENSIONS: dict[str, dict[str, Any]] = {
    "hook_strength": {
        "weight": 0.20,  # Highest weight — hook is EVERYTHING in short-form
        "min_score": 7,
        "description": "Do the first 1-2 seconds grab attention and stop the scroll?",
        "scoring_guide": {
            "0-3": "Weak/generic opener: 'Are you looking for work?' — immediate scroll-past. "
                   "No pattern interrupt. No curiosity gap. No emotional trigger. The viewer "
                   "has zero reason to stay. Could be any ad for anything.",
            "4-5": "Mildly interesting but would not stop a thumb mid-scroll. The hook is "
                   "topical but predictable — 'Want to earn money from home?' is better than "
                   "nothing but every ad says this. No specific detail that creates intrigue.",
            "6-7": "Decent hook but predictable — you can guess where it is going. Has one "
                   "interesting element (a number, a question, a contrast) but the format is "
                   "familiar. Would make someone slow their scroll but not stop it.",
            "8-9": "Strong pattern interrupt. You would pause your scroll to see what happens "
                   "next. Uses a specific, unexpected detail ('I made $340 labeling cat photos'). "
                   "Creates a genuine curiosity gap. Feels native to the platform.",
            "10": "Irresistible. The kind of hook people save and share. 'Wait, WHAT?' energy. "
                  "Combines surprise, specificity, and relatability. The viewer MUST know what "
                  "happens next. Would work even with sound off (visual hook + text overlay).",
        },
    },
    "pacing": {
        "weight": 0.15,
        "min_score": 7,
        "description": "Does it move fast enough for short-form? No dead air, no filler?",
        "scoring_guide": {
            "0-3": "Sluggish. Long pauses. Filler phrases ('um', 'so basically', 'anyway'). "
                   "Viewer is bored by second 3. Scenes last too long without new information. "
                   "Could cut 50% of the script with no loss.",
            "4-5": "Some momentum but has at least one 'dead' moment where attention drops. "
                   "The transition from problem to solution is slow. One scene overstays its "
                   "welcome. Filler phrases still present ('you know what I mean').",
            "6-7": "Decent flow but could be tightened — 1-2 sentences could be cut without "
                   "losing meaning. Transitions between sections are functional but not "
                   "seamless. No dead air but no breathless energy either.",
            "8-9": "Every second earns its place. Quick cuts, no filler, constant forward "
                   "motion. Each scene introduces new information or emotion. Transitions "
                   "are snappy. The script feels shorter than it actually is.",
            "10": "Breathless pace. Viewer does not have time to look away. TikTok-native "
                  "rhythm where every beat lands. Information density is high but never "
                  "confusing. Natural speech patterns that move fast without feeling rushed. "
                  "The 15-second version feels like 8 seconds.",
        },
    },
    "persona_resonance": {
        "weight": 0.15,
        "min_score": 7,
        "description": "Would the target persona feel 'this is about ME'?",
        "scoring_guide": {
            "0-3": "Generic message that could be for anyone, anywhere, any age. No persona-"
                   "specific language, no referenced daily routine, no cultural markers. "
                   "'Earn money online' with no soul.",
            "4-5": "Mentions the audience broadly ('students', 'freelancers') but does not "
                   "speak their language or address their specific pain. Could swap the "
                   "persona label and the script would still work — a sign it is generic.",
            "6-7": "Touches on persona pain points but does not nail the specificity. Says "
                   "'flexible schedule' for a student but does not mention 'between classes' "
                   "or 'dorm room'. Close but not personal enough to trigger recognition.",
            "8-9": "Uses persona's trigger words, references their daily life, speaks their "
                   "language (including dialect/slang if applicable). A student would think "
                   "'they know my life'. A parent would think 'finally, someone gets it'.",
            "10": "The target persona would screenshot this and send it to their friend saying "
                  "'this is SO me'. Every detail — the setting, the language, the pain point, "
                  "the aspiration — is calibrated to a single persona type. Feels like UGC "
                  "FROM someone in their demographic.",
        },
    },
    "benefit_clarity": {
        "weight": 0.15,
        "min_score": 7,
        "description": "Is the core benefit (earn money, flexible, use skills) crystal clear?",
        "scoring_guide": {
            "0-3": "No clear benefit stated. The script is all hook and no substance. Viewer "
                   "finishes watching and cannot answer 'what is in it for me?'. Vague promises "
                   "with no specifics.",
            "4-5": "Benefit mentioned but buried or vague. 'Earn money' without a number. "
                   "'Flexible' without explaining what that means in practice. The benefit "
                   "competes with too many other messages for attention.",
            "6-7": "Core benefit is stated clearly once but not reinforced. The specific "
                   "number or detail is present but could be more prominent. A second viewing "
                   "would help — it should land on the first.",
            "8-9": "Core benefit hits immediately and gets reinforced. Specific: '$15-25/hour', "
                   "'work from your phone', 'choose your own hours'. The viewer knows exactly "
                   "what they gain and can explain it to someone else.",
            "10": "Benefit is so clear it becomes the viral element. The number, the flexibility, "
                  "the skill-use — whichever benefit leads — is impossible to miss and is "
                  "reinforced through dialogue + text overlay + visual. Triple-redundancy on "
                  "the core promise.",
        },
    },
    "cta_effectiveness": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Is the call-to-action specific, urgent, and low-friction?",
        "scoring_guide": {
            "0-3": "No CTA at all, or a weak generic CTA like 'check it out'. No urgency, "
                   "no specificity, no URL/link/direction. The viewer has interest but nowhere "
                   "to go.",
            "4-5": "CTA exists but is vague ('sign up now') or creates friction ('go to our "
                   "website and look for the join page'). Missing urgency or missing "
                   "specificity. One but not both.",
            "6-7": "Decent CTA with action verb and direction ('tap the link to start earning'). "
                   "Has either urgency OR low-friction but not both. Could be stronger with a "
                   "time-bound element or social proof nudge.",
            "8-9": "Specific, urgent, and low-friction: 'Link in bio — spots are filling up "
                   "this week'. Action verb + direction + urgency + social proof. The viewer "
                   "knows exactly what to do and feels compelled to do it NOW.",
            "10": "CTA is a mini-hook in itself. Creates FOMO ('only 50 spots left for your "
                  "region'), removes objections ('takes 2 minutes to sign up, no resume needed'), "
                  "and makes the action feel inevitable. The kind of CTA where you tap before "
                  "you consciously decide to.",
        },
    },
    "visual_directability": {
        "weight": 0.10,
        "min_score": 6,
        "description": "Can Kling 3.0 actually produce this? Are camera directions achievable?",
        "scoring_guide": {
            "0-3": "Script describes impossible shots or requires real-world footage that AI "
                   "cannot generate: crowd scenes, specific brand logos, text-heavy screens, "
                   "complex multi-person interactions. Would fail in Kling immediately.",
            "4-5": "Most shots are feasible but 1-2 would confuse Kling: complex hand "
                   "gestures, specific screen content, rapid scene changes that require "
                   "impossible consistency. Needs significant rework.",
            "6-7": "All shots use Kling vocabulary but some transitions may be tricky. "
                   "Camera directions are valid but some scenes are ambitious (orbit shots, "
                   "complex tracking). A Kling expert would say 'possible but risky'.",
            "8-9": "Every shot is clearly achievable by Kling with the reference system. "
                   "Camera directions use standard vocabulary (static, push_in, close_up). "
                   "Scene changes are clean cuts. No complex multi-person scenes. "
                   "Duration per shot is within Kling's sweet spot (2-5 seconds).",
            "10": "A Kling power user would say 'this prompt is perfect, generate it'. "
                  "Each scene is a single clear action with one camera movement. Reference "
                  "character is the sole focus. No text that Kling would butcher. Shot "
                  "durations match Kling's strengths. Transitions are all hard cuts.",
        },
    },
    "platform_nativeness": {
        "weight": 0.10,
        "min_score": 6,
        "description": "Does this FEEL like native content for the target platform?",
        "scoring_guide": {
            "0-3": "Corporate ad energy. Clearly a brand trying to advertise on a platform "
                   "they do not understand. Wrong aspect ratio implied, wrong tone, wrong "
                   "format. Would get scrolled past and maybe reported.",
            "4-5": "Somewhat platform-appropriate but still feels like an ad. The format is "
                   "correct (vertical, short) but the energy is wrong — too polished, too "
                   "scripted, too branded. Users would identify it as an ad instantly.",
            "6-7": "Good platform awareness — correct format, appropriate length, relevant "
                   "tone. But missing the small details that make content feel native: no "
                   "trending audio reference, no platform-specific lingo, no format subversion.",
            "8-9": "Feels like it belongs on the platform. Uses platform conventions (POV "
                   "format for TikTok, talking head for Reels, professional tone for LinkedIn). "
                   "Would blend into the feed. Viewers might not realize it is an ad for the "
                   "first 3 seconds.",
            "10": "A platform creator would watch this and think 'that is one of us, not a "
                  "brand'. Uses current platform trends without being try-hard. The format, "
                  "pacing, language, and energy all match what is performing well RIGHT NOW "
                  "on the target platform.",
        },
    },
    "safety_compliance": {
        "weight": 0.05,
        "min_score": 8,  # Safety is a hard gate
        "description": "Is the content safe for all platforms? No policy violations, misleading claims, or sensitive content?",
        "scoring_guide": {
            "0-3": "Contains policy violations: misleading income claims ('guaranteed $1000/week'), "
                   "discriminatory language, or content that would be flagged by platform moderation. "
                   "Immediate platform ban risk.",
            "4-5": "Borderline claims that could trigger ad review: vague earnings promises without "
                   "disclaimers, slightly pushy urgency tactics, or language that could be "
                   "interpreted as MLM/scam-adjacent.",
            "6-7": "Generally safe but missing disclaimers or softeners. Income mentions lack "
                   "'results vary' qualifiers. Urgency language is aggressive but not deceptive. "
                   "Would pass most platform reviews but might get flagged on strict ones.",
            "8-9": "Clean compliance. Income claims are realistic and qualified ('earn up to $X/hr, "
                   "varies by task'). No deceptive urgency. No discriminatory exclusions. Would "
                   "pass Meta, TikTok, and Google ad review without issues.",
            "10": "Compliance gold standard. Every claim is substantiated or qualified. Inclusive "
                  "language throughout. No dark patterns. Transparent about what the opportunity "
                  "is and is not. A platform trust & safety reviewer would approve in seconds.",
        },
    },
}

# =========================================================================
# Neurogen-style thresholds
# =========================================================================

MIN_ACCEPT_SCORE = 8.0
MIN_DIM_SCORE = 7
SAFETY_STATUSES = ["safe", "minor_issues_fixable", "unsafe"]

# Verdict logic:
# accept:  overall >= 8.0 AND all dims >= 7 AND safety != "unsafe"
# revise:  overall >= 6.0 OR any dim 5-6 OR safety == "minor_issues_fixable"
# reject:  overall < 6.0 OR any dim < 5 OR safety == "unsafe"

# =========================================================================
# Prompt builder
# =========================================================================

EVAL_SYSTEM_PROMPT = (
    "You are a TikTok creative director and ad compliance reviewer evaluating "
    "short-form video scripts for OneForma recruitment ads. You score with the "
    "precision of a Neurogen-style evaluator: every dimension matters, and the "
    "overall score determines whether $0.16 of Kling credits gets spent.\n\n"
    "You are especially critical of hooks (most scripts have weak hooks) and "
    "visual directability (most scripts describe shots that AI cannot generate).\n\n"
    "You return ONLY valid JSON. No markdown. No commentary outside the JSON."
)


def build_script_eval_prompt(
    script: dict,
    persona: dict,
    platform: str,
    language: str,
) -> str:
    """Build the full evaluation prompt with scoring rubric.

    Parameters
    ----------
    script:
        The generated video script dict (hook, problem, solution, scenes, etc.).
    persona:
        The target persona dict this script was written for.
    platform:
        Target platform (tiktok, instagram_reels, youtube_shorts, etc.).
    language:
        Language the script is written in.
    """
    # Build dimension rubric
    rubric_lines: list[str] = []
    for dim_key, dim in SCRIPT_EVAL_DIMENSIONS.items():
        rubric_lines.append(
            f"\n### {dim_key.upper()} (weight={dim['weight']}, min={dim['min_score']})"
        )
        rubric_lines.append(f"Question: {dim['description']}")
        for band, desc in dim.get("scoring_guide", {}).items():
            rubric_lines.append(f"  {band}: {desc}")
    rubric_block = "\n".join(rubric_lines)

    # Persona context for resonance checking
    psychology = persona.get("psychology_profile", {})
    persona_block = f"""
TARGET PERSONA (the script must resonate with THIS person):
- Archetype: {persona.get("archetype_key", "?")} ({persona.get("archetype", "?")})
- Age range: {persona.get("age_range", "?")}
- Lifestyle: {persona.get("lifestyle", "?")}
- Pain points: {persona.get("pain_points", [])}
- Motivations: {persona.get("motivations", [])}
- Psychology: primary_bias={psychology.get("primary_bias", "?")}, trigger_words={psychology.get("trigger_words", [])}
- Objections: {persona.get("objections", [])}
"""

    # Extract key script elements for display
    scenes_display = ""
    scenes = script.get("scenes", [])
    if scenes:
        scene_lines = []
        for s in scenes:
            scene_lines.append(
                f"  Scene {s.get('scene_num', '?')}: [{s.get('camera', '?')}] "
                f"({s.get('duration_s', '?')}s) {s.get('action', '')} "
                f"| dialogue: \"{s.get('dialogue', '')}\" "
                f"| overlay: \"{s.get('text_overlay', '')}\""
            )
        scenes_display = "\n".join(scene_lines)

    return f"""Evaluate this video script BEFORE it goes to Kling 3.0 generation.
Every generation costs $0.16 — a bad script wastes money. Be strict.

=== SCRIPT TO EVALUATE ===
Hook: {script.get("hook", "?")}
Problem: {script.get("problem", "?")}
Solution: {script.get("solution", "?")}
Value prop: {script.get("value_prop", "?")}
CTA: {script.get("cta", "?")}
Estimated duration: {script.get("estimated_duration_s", "?")}s
Target platform: {platform}
Language: {language}
Dialogue ends at: {script.get("dialogue_ends_at_s", "?")}s (Kling lip-sync constraint: must be <= 10s)

Full script:
{script.get("full_script", "(not provided)")}

Scene breakdown:
{scenes_display}
{persona_block}

=== SCORING RUBRIC (score 0-10 per dimension) ===
{rubric_block}

=== HARD GATES ===
- Overall weighted score must be >= {MIN_ACCEPT_SCORE} to accept
- Every dimension must score >= {MIN_DIM_SCORE}
- safety_compliance must score >= 8 (hard gate)
- If dialogue_ends_at_s > 10, visual_directability gets a 2-point penalty (Kling constraint)

=== SAFETY ASSESSMENT ===
In addition to the safety_compliance dimension score, provide an overall safety
status: "safe", "minor_issues_fixable", or "unsafe".
- safe: No issues, passes all platform ad reviews
- minor_issues_fixable: Small wording tweaks needed (e.g., add "results vary" to income claim)
- unsafe: Contains policy violations, misleading claims, or discriminatory content

=== INSTRUCTIONS ===
1. Score each dimension 0-10 using the scoring guide.
2. For hook_strength: read ONLY the first line — would you stop scrolling?
3. For pacing: read the full script aloud in your head — any dead moments?
4. For persona_resonance: compare the script language to the persona's trigger words and pain points.
5. For visual_directability: evaluate each scene — can Kling actually produce it?
6. For safety_compliance: check income claims, urgency language, and platform policies.
7. If dialogue_ends_at_s > 10, deduct 2 points from visual_directability.

Return ONLY valid JSON:
{{
  "dimensions": {{
    "hook_strength": {{"score": 0, "feedback": "..."}},
    "pacing": {{"score": 0, "feedback": "..."}},
    "persona_resonance": {{"score": 0, "feedback": "..."}},
    "benefit_clarity": {{"score": 0, "feedback": "..."}},
    "cta_effectiveness": {{"score": 0, "feedback": "..."}},
    "visual_directability": {{"score": 0, "feedback": "..."}},
    "platform_nativeness": {{"score": 0, "feedback": "..."}},
    "safety_compliance": {{"score": 0, "feedback": "..."}}
  }},
  "safety_status": "safe | minor_issues_fixable | unsafe",
  "safety_issues": ["List specific safety issues, or empty if none"],
  "strongest_element": "Which dimension is the script's best quality?",
  "weakest_element": "Which dimension needs the most work?",
  "rewrite_suggestions": ["Specific, actionable rewrite suggestions"]
}}"""


# =========================================================================
# Scoring engine
# =========================================================================

def score_script(eval_response: dict) -> dict[str, Any]:
    """Calculate weighted score, apply hard gates, determine verdict.

    Parameters
    ----------
    eval_response:
        Parsed JSON from the LLM evaluation.

    Returns
    -------
    dict
        Standardized result with verdict, scores, and feedback.
    """
    dimensions = eval_response.get("dimensions", {})
    safety_status = eval_response.get("safety_status", "safe")
    safety_issues = eval_response.get("safety_issues", [])
    strongest = eval_response.get("strongest_element", "")
    weakest = eval_response.get("weakest_element", "")
    rewrite_suggestions = eval_response.get("rewrite_suggestions", [])

    # Normalize safety status
    if safety_status not in SAFETY_STATUSES:
        safety_status = "minor_issues_fixable"

    # Calculate weighted score
    weighted_score = 0.0
    dimension_scores: dict[str, dict[str, Any]] = {}
    hard_gate_failures: list[str] = []
    feedback_per_dimension: dict[str, str] = {}

    for dim_key, dim_config in SCRIPT_EVAL_DIMENSIONS.items():
        dim_data = dimensions.get(dim_key, {})
        raw_score = dim_data.get("score", 0)
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

    # Determine verdict using Neurogen-style logic
    safety_score = dimensions.get("safety_compliance", {}).get("score", 0)

    if safety_status == "unsafe" or safety_score < 5:
        verdict = "reject"
        hard_gate_failures.insert(
            0,
            f"SAFETY GATE: status='{safety_status}', score={safety_score}",
        )
    elif weighted_score < 6.0 or any(
        dimension_scores[k]["score"] < 5 for k in SCRIPT_EVAL_DIMENSIONS
    ):
        # Any dimension below 5 = reject (too broken to revise)
        verdict = "reject"
    elif weighted_score >= MIN_ACCEPT_SCORE and not hard_gate_failures:
        verdict = "accept"
    else:
        # Scores between 6.0-8.0, or some dimensions below min but >= 5
        verdict = "revise"

    # Build retry feedback for the generation loop
    retry_feedback: list[str] = []
    if verdict != "accept":
        # Dimension-specific feedback for failing dimensions
        for dim_key in SCRIPT_EVAL_DIMENSIONS:
            ds = dimension_scores.get(dim_key, {})
            if not ds.get("passed", True):
                fb = feedback_per_dimension.get(dim_key, "")
                retry_feedback.append(
                    f"[{dim_key}] Score {ds.get('score', 0)}/{ds.get('min_required', 7)}: {fb}"
                )
        # Add rewrite suggestions
        retry_feedback.extend(rewrite_suggestions)
        # Add safety issues if present
        if safety_issues:
            retry_feedback.extend(
                f"[SAFETY] {issue}" for issue in safety_issues
            )

    # Legacy compatibility: overall_score on 0-1 scale
    overall_score_normalized = round(weighted_score / 10.0, 3)

    # Cost tracking: how much Kling credit this saves/wastes
    kling_cost_per_gen = 0.16

    return {
        "verdict": verdict,
        "overall_score": overall_score_normalized,
        "weighted_score": weighted_score,
        "dimension_scores": dimension_scores,
        "hard_gate_failures": hard_gate_failures,
        "safety_status": safety_status,
        "safety_issues": safety_issues,
        "strongest_element": strongest,
        "weakest_element": weakest,
        "improvement_suggestions": retry_feedback if verdict != "accept" else [],
        "feedback_per_dimension": feedback_per_dimension,
        "cost_saved_if_rejected": kling_cost_per_gen if verdict == "reject" else 0.0,
    }
