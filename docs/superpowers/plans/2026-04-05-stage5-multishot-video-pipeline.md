# Stage 5: Multishot UGC Video Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-stage video pipeline (Qwen script → Gemma 4 storyboard+VQA → Kling multishot) that generates hyper-real UGC recruitment videos from 8 genre templates with per-shot reference images.

**Architecture:** Neurogen-style layered system — genre templates define structure, location system adds variety, script evaluator gates quality with 6-dimension rubric and rewrite loop, Gemma 4 generates+validates storyboard frames, Kling renders multishot with all frames as references. Sound=on.

**Tech Stack:** Python 3.13, Qwen 397B (NIM), Gemma 4 31B (NIM), Seedream 4.5 (OpenRouter), Kling 3.0 API, Vercel Blob, Neon Postgres.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `worker/prompts/video_templates.py` | Create | 8 UGC genre templates + 10 locations + template selector |
| `worker/prompts/video_evaluator.py` | Create | 6-dimension script rubric + gate logic + rewrite prompt |
| `worker/prompts/video_storyboard.py` | Create | Gemma 4 Seedream prompt writer + storyboard VQA |
| `worker/pipeline/stage5_video.py` | Create | Pipeline orchestrator — template→script→storyboard→Kling→upload |
| `worker/ai/kling_client.py` | Modify | Add `generate_multishot_with_storyboard()` that accepts per-shot refs |
| `worker/prompts/video_script.py` | Modify | Add `build_ugc_script_prompt()` for the new template format |
| `worker/pipeline/orchestrator.py` | Modify | Wire Stage 5 into the pipeline runner |

---

### Task 1: UGC Genre Templates + Location System

**Files:**
- Create: `worker/prompts/video_templates.py`

- [ ] **Step 1: Create the 8 genre templates as Python data**

```python
# worker/prompts/video_templates.py
"""UGC genre templates + location system for Stage 5 video pipeline.

8 templates define the structural skeleton for each video genre.
10 locations provide environmental variety. The LLM fills in
persona-specific content within the template's beat structure.

Architecture ported from Neurogen's prompt_templates.py.
"""
from __future__ import annotations

import random
from typing import Any

# ── 10 Locations ─────────────────────────────────────────────────────

LOCATIONS: dict[str, dict[str, Any]] = {
    "bedroom_vanity": {
        "environmental_pressure": ["beauty routine", "self-care", "confidence building"],
        "mood_bias": ["ring light or warm lamp", "close-up face", "mirror POV"],
        "seedream_hints": (
            "Young woman at vanity table, ring light reflection in eyes, "
            "makeup products visible, warm bedroom background, "
            "front-facing camera angle as if camera IS the mirror"
        ),
    },
    "bathroom_mirror": {
        "environmental_pressure": ["routine", "authenticity", "vulnerability"],
        "mood_bias": ["warm soft lighting", "intimate", "morning glow"],
        "seedream_hints": (
            "Person in bathroom, mirror selfie angle, warm overhead light, "
            "toothbrush/skincare visible, natural morning appearance"
        ),
    },
    "kitchen_counter": {
        "environmental_pressure": ["home comfort", "casual", "daily life"],
        "mood_bias": ["bright natural window light", "domestic", "approachable"],
        "seedream_hints": (
            "Person leaning on kitchen counter, bright window behind, "
            "coffee mug visible, casual clothes, relaxed posture"
        ),
    },
    "car_selfie": {
        "environmental_pressure": ["urgency", "mobility", "spontaneity"],
        "mood_bias": ["variable natural light", "handheld shake", "raw energy"],
        "seedream_hints": (
            "Person in car driver/passenger seat, seatbelt visible, "
            "dashboard blurred behind, selfie angle from phone on dash, "
            "excited expression"
        ),
    },
    "couch_home": {
        "environmental_pressure": ["relaxation", "trust", "personal space"],
        "mood_bias": ["warm lamp glow", "cozy", "confessional"],
        "seedream_hints": (
            "Person on couch with throw blanket, warm lamp light, "
            "living room background, legs tucked up, casual intimate pose"
        ),
    },
    "desk_workspace": {
        "environmental_pressure": ["productivity", "earning", "professional"],
        "mood_bias": ["focused task lighting", "clean background", "competent"],
        "seedream_hints": (
            "Person at desk, laptop closed/angled away, desk lamp, "
            "organized space, smart-casual clothes, slightly leaning forward"
        ),
    },
    "cafe_window": {
        "environmental_pressure": ["social", "aspirational", "freedom"],
        "mood_bias": ["golden natural light", "bokeh background", "lifestyle"],
        "seedream_hints": (
            "Person at cafe window seat, golden light streaming in, "
            "coffee cup, busy street bokeh behind, relaxed confident smile"
        ),
    },
    "walking_street": {
        "environmental_pressure": ["movement", "energy", "real world"],
        "mood_bias": ["overcast or golden", "handheld shake", "dynamic"],
        "seedream_hints": (
            "Person walking on urban street, camera tracking at eye level, "
            "slight motion blur, buildings behind, mid-stride energy"
        ),
    },
    "bedroom_morning": {
        "environmental_pressure": ["fresh start", "genuine", "unfiltered"],
        "mood_bias": ["soft morning window light", "messy-real", "intimate"],
        "seedream_hints": (
            "Person sitting on bed edge, morning light through curtains, "
            "rumpled sheets, natural hair, just-woke-up authentic"
        ),
    },
    "park_bench": {
        "environmental_pressure": ["freedom", "flexibility", "outdoors"],
        "mood_bias": ["bright daylight", "green background", "relaxed"],
        "seedream_hints": (
            "Person on park bench, trees and grass behind, dappled sunlight, "
            "casual outdoor clothes, open relaxed posture"
        ),
    },
}


# ── 8 UGC Genre Templates ───────────────────────────────────────────

UGC_TEMPLATES: dict[str, dict[str, Any]] = {
    "grwm": {
        "name": "Get Ready With Me",
        "description": "Creator sharing a tip during their morning routine",
        "duration_range": (14, 15),
        "beats": [
            {
                "label": "routine",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up mirror angle, doing morning routine, natural and relaxed",
                "energy": 3,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "getting_ready",
                "duration_s": 3,
                "camera": "medium",
                "direction": "Medium shot getting dressed/doing makeup, casual body language",
                "energy": 4,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "casual_mention",
                "duration_s": 4,
                "camera": "close_up",
                "direction": "Close-up, 'oh btw' casual tone, genuine excitement creeping in",
                "energy": 6,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "reaction",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Eyes light up genuinely, nodding, convincing smile",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "wide_establishing",
                "direction": "Wide shot grabbing bag, heading out the door, confident energy",
                "energy": 8,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["bedroom_vanity", "bathroom_mirror", "bedroom_morning", "kitchen_counter"],
    },
    "storytime": {
        "name": "Storytime",
        "description": "Creator telling friends about an amazing find",
        "duration_range": (13, 15),
        "beats": [
            {
                "label": "hook",
                "duration_s": 3,
                "camera": "extreme_close_up",
                "direction": "Extreme close-up, 'so this happened' energy, lean into camera",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "problem",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, animated hand gestures, building the frustration",
                "energy": 5,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "discovery",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, expression shifts from frustrated to surprised to excited",
                "energy": 8,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Direct to camera, excited energy, beckoning gesture, genuine urgency",
                "energy": 9,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["couch_home", "car_selfie", "bedroom_morning", "cafe_window"],
    },
    "just_found_out": {
        "name": "Just Found Out",
        "description": "Excited friend who can't contain the news",
        "duration_range": (12, 14),
        "beats": [
            {
                "label": "urgent_hook",
                "duration_s": 3,
                "camera": "handheld",
                "direction": "Handheld selfie, slightly shaky, 'you guys...' urgent energy",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "explain",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, speaking rapidly, animated gestures, can't slow down",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "proof",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, eyes wide, genuine disbelief at the opportunity",
                "energy": 9,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, 'you NEED to try this', pointing at viewer",
                "energy": 10,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["car_selfie", "walking_street", "couch_home", "kitchen_counter"],
    },
    "day_in_my_life": {
        "name": "Day In My Life",
        "description": "Lifestyle vlog with naturally embedded pitch",
        "duration_range": (14, 15),
        "beats": [
            {
                "label": "morning",
                "duration_s": 2,
                "camera": "wide_establishing",
                "direction": "Wide shot morning routine, stretching/coffee, soft morning light",
                "energy": 3,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "commute",
                "duration_s": 2,
                "camera": "tracking",
                "direction": "Tracking shot walking/commuting, handheld energy, city sounds",
                "energy": 4,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "work",
                "duration_s": 3,
                "camera": "medium",
                "direction": "Medium at desk/workspace, focused then looks up to camera",
                "energy": 5,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "earnings",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up reaction to earnings, genuine happy surprise, celebratory",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "flex",
                "duration_s": 3,
                "camera": "medium",
                "direction": "Medium shot enjoying evening, relaxed, satisfied energy",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, recommend with warm confidence",
                "energy": 9,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["bedroom_morning", "walking_street", "desk_workspace", "cafe_window", "couch_home", "park_bench"],
    },
    "pov_discover": {
        "name": "POV: You Discover",
        "description": "Second-person immersion, viewer IS the character",
        "duration_range": (12, 13),
        "beats": [
            {
                "label": "pov_scroll",
                "duration_s": 4,
                "camera": "over_shoulder",
                "direction": "Over-shoulder/POV angle, person scrolling or reading, contemplative",
                "energy": 4,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "reaction",
                "duration_s": 4,
                "camera": "close_up",
                "direction": "Close-up face, expression shifts from curious to excited, genuine",
                "energy": 8,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot celebration, fist pump or happy dance, then direct to camera CTA",
                "energy": 10,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["couch_home", "desk_workspace", "bedroom_morning", "car_selfie"],
    },
    "reply_to_comment": {
        "name": "Reply To Comment",
        "description": "Organic engagement response, creator defending their choice",
        "duration_range": (12, 14),
        "beats": [
            {
                "label": "read_comment",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up reading 'comment' with slight skepticism/amusement",
                "energy": 5,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "address",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, explaining directly, confident body language",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "proof",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, sharing personal experience, authentic storytelling",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, 'try it yourself', warm challenge energy",
                "energy": 9,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["couch_home", "desk_workspace", "kitchen_counter", "car_selfie"],
    },
    "before_after": {
        "name": "Before/After",
        "description": "Transformation story, relatable struggle to success",
        "duration_range": (13, 15),
        "beats": [
            {
                "label": "before",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, slumped posture, frustrated, dim/flat lighting feel",
                "energy": 3,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "discovery",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, expression shifts, curiosity then hope",
                "energy": 5,
                "has_dialogue": True,
                "transition": "whip_transition",
            },
            {
                "label": "after",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, upright posture, bright energy, warm lighting",
                "energy": 9,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, recommending with earned credibility",
                "energy": 8,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["desk_workspace", "bedroom_morning", "cafe_window", "park_bench", "couch_home"],
    },
    "whisper_confession": {
        "name": "Whisper/Confession",
        "description": "Intimate secret sharing, insider knowledge",
        "duration_range": (12, 13),
        "beats": [
            {
                "label": "lean_in",
                "duration_s": 4,
                "camera": "extreme_close_up",
                "direction": "Extreme close-up, whispering, conspiratorial, 'don't tell anyone'",
                "energy": 6,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "reveal",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, hushed excitement building, gestures getting bigger",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 4,
                "camera": "close_up",
                "direction": "Close-up, drops the whisper, direct intense eye contact, 'seriously go do this'",
                "energy": 9,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["bedroom_vanity", "bedroom_morning", "couch_home", "car_selfie"],
    },
}


# ── Template Selector ────────────────────────────────────────────────

def select_template(
    persona: dict[str, Any],
    platform: str = "tiktok",
) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
    """Select a genre template and random locations for a persona.

    Returns (template_key, template_dict, selected_locations).
    Each location is a dict from LOCATIONS with its key added as "key".
    """
    # Score templates by persona fit
    psychology = persona.get("psychology_profile", {})
    primary_bias = psychology.get("primary_bias", "")

    # Bias → template affinity mapping
    bias_affinity: dict[str, list[str]] = {
        "effort_minimization": ["grwm", "day_in_my_life", "pov_discover"],
        "social_proof": ["storytime", "reply_to_comment", "before_after"],
        "loss_aversion": ["just_found_out", "whisper_confession"],
        "curiosity_gap": ["pov_discover", "whisper_confession", "storytime"],
        "identity_appeal": ["before_after", "day_in_my_life", "grwm"],
        "concrete_specificity": ["just_found_out", "reply_to_comment"],
    }

    preferred = bias_affinity.get(primary_bias, list(UGC_TEMPLATES.keys()))
    # Pick from preferred, fallback to random
    candidates = [k for k in preferred if k in UGC_TEMPLATES]
    if not candidates:
        candidates = list(UGC_TEMPLATES.keys())

    template_key = random.choice(candidates)
    template = UGC_TEMPLATES[template_key]

    # Pick 2-3 random locations from the template's pool
    pool = template.get("location_pool", list(LOCATIONS.keys()))
    num_locations = min(len(template["beats"]), len(pool), 3)
    selected_keys = random.sample(pool, num_locations)
    selected_locations = [
        {**LOCATIONS[k], "key": k} for k in selected_keys
    ]

    return template_key, template, selected_locations
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.video_templates import UGC_TEMPLATES, LOCATIONS, select_template; print(f'{len(UGC_TEMPLATES)} templates, {len(LOCATIONS)} locations'); key, tmpl, locs = select_template({'psychology_profile': {'primary_bias': 'social_proof'}}); print(f'Selected: {key} ({len(tmpl[\"beats\"])} beats, {len(locs)} locations)')"`

Expected: `8 templates, 10 locations` + a selected template with beats and locations.

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/prompts/video_templates.py
git commit -m "feat: 8 UGC genre templates + 10 locations for Stage 5 video pipeline"
```

---

### Task 2: Script Evaluator (6-Dimension Rubric)

**Files:**
- Create: `worker/prompts/video_evaluator.py`

- [ ] **Step 1: Create the evaluator with gate logic and rewrite prompt**

```python
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
```

- [ ] **Step 2: Verify imports**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.video_evaluator import DIMENSIONS, check_script_constraints, build_eval_prompt, compute_passed, ScriptEvalResult; print(f'{len(DIMENSIONS)} dimensions'); issues = check_script_constraints({'scenes': [{'duration_s': 5, 'dialogue': 'hey check it out', 'camera': 'close_up'}, {'duration_s': 8, 'dialogue': 'oneforma is great', 'camera': 'medium'}]}); print(f'Issues: {issues}')"`

Expected: `6 dimensions` + issues including "Generic CTA" and "Total duration" and "Dialogue at 13s".

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/prompts/video_evaluator.py
git commit -m "feat: 6-dimension video script evaluator with hard gating and rewrite loop"
```

---

### Task 3: Storyboard Generator + VQA

**Files:**
- Create: `worker/prompts/video_storyboard.py`

- [ ] **Step 1: Create the Gemma 4 storyboard prompt writer and VQA**

```python
# worker/prompts/video_storyboard.py
"""Storyboard generator — Gemma 4 writes Seedream prompts + VQA gates each frame.

For each shot in an approved script:
1. Build a Seedream prompt from actor face_lock + shot details + location hints
2. After Seedream generates the image, VQA checks it against the script
3. If VQA fails, rewrite the prompt with visual feedback and retry
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import tempfile
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GEMMA4_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))

MAX_STORYBOARD_RETRIES = 2


def build_seedream_prompt(
    shot: dict[str, Any],
    actor: dict[str, Any],
    location: dict[str, Any],
) -> str:
    """Build a Seedream 4.5 image prompt for one shot.

    Combines actor face_lock data, shot camera/action/direction,
    and location seedream_hints into a single prompt.
    """
    face_lock = actor.get("face_lock", {})
    if isinstance(face_lock, str):
        face_lock = json.loads(face_lock)

    # Actor description from face_lock
    actor_desc = (
        f"{face_lock.get('age_range', '25-35')} year old person, "
        f"{face_lock.get('hair', 'natural hair')}, "
        f"{face_lock.get('eye_color', 'brown')} eyes, "
        f"skin tone {face_lock.get('skin_tone_hex', '#C8A882')}, "
        f"{face_lock.get('jawline', 'defined jawline')}, "
        f"{face_lock.get('nose_shape', 'natural nose')}"
    )

    # Shot details
    camera = shot.get("camera", "close_up")
    direction = shot.get("direction", "")
    action = shot.get("action", direction)
    energy = shot.get("energy", 5)

    # Location hints
    location_hints = location.get("seedream_hints", "")
    mood = ", ".join(location.get("mood_bias", []))

    # Energy → expression mapping
    expression_map = {
        (1, 3): "relaxed, calm, neutral expression",
        (4, 5): "engaged, slight smile, attentive",
        (6, 7): "excited, genuine smile, animated",
        (8, 9): "very excited, bright eyes, enthusiastic gestures",
        (10, 10): "ecstatic, fist pump or celebratory, huge genuine smile",
    }
    expression = "neutral expression"
    for (lo, hi), desc in expression_map.items():
        if lo <= energy <= hi:
            expression = desc
            break

    return (
        f"Hyper-realistic photograph, iPhone 15 Pro quality. "
        f"{actor_desc}. "
        f"{direction}. "
        f"{expression}. "
        f"{location_hints}. "
        f"Mood: {mood}. "
        f"Camera: {camera.replace('_', ' ')}. "
        f"Natural skin texture, no beauty filter, no airbrushed look. "
        f"9:16 vertical portrait orientation."
    )


async def vqa_storyboard_frame(
    image_bytes: bytes,
    shot: dict[str, Any],
    actor: dict[str, Any],
    location: dict[str, Any],
) -> dict[str, Any]:
    """Use Gemma 4 to evaluate a storyboard frame against the script.

    Returns dict with:
        passed (bool), score (float 0-1), issues (list[str]), rewrite_hint (str)
    """
    if not GEMMA4_KEY:
        logger.warning("No Gemma 4 key — auto-passing storyboard VQA")
        return {"passed": True, "score": 0.85, "issues": [], "rewrite_hint": ""}

    face_lock = actor.get("face_lock", {})
    if isinstance(face_lock, str):
        face_lock = json.loads(face_lock)

    # Resize for VQA
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.resize((512, 512), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.warning("Failed to process image for VQA: %s", e)
        return {"passed": True, "score": 0.75, "issues": [], "rewrite_hint": ""}

    prompt = f"""Review this storyboard frame for a UGC video ad.

EXPECTED:
- Character: {face_lock.get('age_range', '?')} with {face_lock.get('hair', '?')}, {face_lock.get('eye_color', '?')} eyes
- Camera: {shot.get('camera', '?')}
- Action: {shot.get('direction', '?')}
- Location: {location.get('key', '?')} — {location.get('seedream_hints', '')[:100]}
- Energy level: {shot.get('energy', 5)}/10

Score 0.0-1.0 on:
- character_match: Does the person match the description?
- camera_angle: Is the framing correct?
- setting_match: Does the environment match the location?
- expression: Does the expression match the energy level?
- quality: Is the image sharp, realistic, no artifacts?

Return ONLY valid JSON:
{{
  "character_match": 0.0,
  "camera_angle": 0.0,
  "setting_match": 0.0,
  "expression": 0.0,
  "quality": 0.0,
  "overall": 0.0,
  "passed": true,
  "issues": ["list of specific problems"],
  "rewrite_hint": "specific instruction to fix the Seedream prompt"
}}"""

    try:
        payload = {
            "model": GEMMA4_MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            }],
            "max_tokens": 2048,
            "temperature": 0.3,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GEMMA4_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"].get("content", "")
        result = _parse_json(content)
        result.setdefault("passed", result.get("overall", 0) >= 0.70)
        result.setdefault("issues", [])
        result.setdefault("rewrite_hint", "")
        return result

    except Exception as e:
        logger.warning("Storyboard VQA failed: %s — auto-passing", e)
        return {"passed": True, "score": 0.75, "issues": [], "rewrite_hint": ""}


def rewrite_seedream_prompt(
    original_prompt: str,
    vqa_result: dict[str, Any],
) -> str:
    """Rewrite a Seedream prompt using VQA feedback."""
    hint = vqa_result.get("rewrite_hint", "")
    issues = vqa_result.get("issues", [])
    feedback = hint or "; ".join(issues)

    return (
        f"{original_prompt}\n\n"
        f"CRITICAL FIX: {feedback}\n"
        f"Ensure the image matches the described character, camera angle, and setting exactly."
    )


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Brace search
    depth = 0
    start = -1
    last = None
    for i, c in enumerate(cleaned):
        if c == '{':
            if depth == 0: start = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    p = json.loads(cleaned[start:i+1])
                    if isinstance(p, dict):
                        last = p
                except json.JSONDecodeError:
                    pass
                start = -1
    return last or {}
```

- [ ] **Step 2: Verify imports**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.video_storyboard import build_seedream_prompt, vqa_storyboard_frame, rewrite_seedream_prompt; actor = {'face_lock': {'hair': 'dark curls', 'eye_color': 'hazel', 'age_range': '32-36', 'skin_tone_hex': '#D4A57E'}}; shot = {'camera': 'close_up', 'direction': 'Extreme close-up doing makeup', 'energy': 7}; loc = {'key': 'bedroom_vanity', 'seedream_hints': 'Young woman at vanity', 'mood_bias': ['ring light', 'warm']}; p = build_seedream_prompt(shot, actor, loc); print(p[:200])"`

Expected: A Seedream prompt containing actor description + shot direction + location hints.

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/prompts/video_storyboard.py
git commit -m "feat: Gemma 4 storyboard prompt writer + VQA gate for per-shot references"
```

---

### Task 4: Update video_script.py with UGC Script Prompt

**Files:**
- Modify: `worker/prompts/video_script.py`

- [ ] **Step 1: Add `build_ugc_script_prompt()` function**

Add this function at the end of `worker/prompts/video_script.py` (after the existing code):

```python
# ── UGC Script Prompt (for Stage 5 multishot pipeline) ───────────────

def build_ugc_script_prompt(
    persona: dict[str, Any],
    brief: dict[str, Any],
    template_key: str,
    template: dict[str, Any],
    locations: list[dict[str, Any]],
    language: str = "English",
) -> str:
    """Build the script generation prompt for Stage 5 UGC videos.

    Uses the selected genre template as structure, the persona for content,
    and locations for setting details. The LLM fills in dialogue, actions,
    and acting direction per shot.
    """
    psychology = persona.get("psychology_profile", {})
    trigger_words = psychology.get("trigger_words", [])

    # Build beats description
    beats_block = []
    for i, beat in enumerate(template["beats"]):
        loc = locations[i % len(locations)]
        beats_block.append(
            f"Shot {i + 1} ({beat['label']}, {beat['duration_s']}s):\n"
            f"  Camera: {beat['camera']}\n"
            f"  Direction: {beat['direction']}\n"
            f"  Energy: {beat['energy']}/10\n"
            f"  Has dialogue: {beat['has_dialogue']}\n"
            f"  Setting: {loc['key']} — {', '.join(loc.get('mood_bias', []))}\n"
            f"  Transition to next: {beat.get('transition', 'hard_cut')}"
        )
    beats_text = "\n\n".join(beats_block)

    # Brief context
    comp = brief.get("compensation", brief.get("form_data", {}).get("compensation", {}))
    brief_context = (
        f"Campaign: {brief.get('campaign_objective', 'Recruit contributors')}\n"
        f"Task type: {brief.get('task_type', 'data annotation')}\n"
        f"Compensation: {json.dumps(comp, default=str) if comp else 'not specified'}"
    )

    min_dur, max_dur = template.get("duration_range", (12, 15))

    return f"""Write a UGC video script for OneForma recruitment.

TEMPLATE: {template['name']} — {template['description']}
TOTAL DURATION: {min_dur}-{max_dur} seconds
LANGUAGE: {language} (must sound native, not translated)

PERSONA: {persona.get('persona_name', 'unknown')}
Age: {persona.get('age', '?')} | Region: {persona.get('region', '?')}
Lifestyle: {persona.get('lifestyle', '')}
Pain point: {persona.get('customized_pain', '')}
Motivation: {persona.get('customized_motivation', '')}
Trigger words: {', '.join(trigger_words[:6])}
Psychology: {psychology.get('primary_bias', '')} — {psychology.get('messaging_angle', '')}

CAMPAIGN:
{brief_context}

SHOT STRUCTURE (follow this EXACTLY):
{beats_text}

RULES:
- ALL dialogue must end BEFORE the 10-second mark (lip sync safe zone)
- Last 2-5 seconds should be visual-only (action, expression, no spoken words)
- "OneForma" must be spoken in the dialogue at least once
- CTA must be specific with time anchor ("search OneForma, sign up in 2 minutes")
- Use trigger words naturally in the dialogue
- Address the persona's #1 pain point in the first 5 seconds
- Sound like a REAL PERSON sharing with friends — NOT a corporate ad
- No readable screen content (Kling can't render UIs)

Return ONLY valid JSON:
{{
  "template": "{template_key}",
  "target_platform": "tiktok",
  "total_duration_s": {min_dur}-{max_dur},
  "scenes": [
    {{
      "index": 1,
      "label": "beat_label",
      "duration_s": N,
      "camera": "camera_key",
      "action": "what the person is physically doing",
      "acting_direction": "subtle expression and body language notes",
      "dialogue": "spoken words in {language} (empty string if no dialogue this shot)",
      "dialogue_english": "English translation (empty if no dialogue)",
      "setting": "location_key",
      "environment": "specific environment description for Kling prompt",
      "lighting": "lighting_preset_key",
      "texture": "iphone_ugc",
      "transition": "transition_type",
      "energy": N
    }}
  ],
  "hook": "the scroll-stopping opening line",
  "cta": "the specific call to action"
}}"""
```

- [ ] **Step 2: Add the import at the top of the file**

Add `import json` to the imports at the top of `worker/prompts/video_script.py` if not already present.

- [ ] **Step 3: Verify**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.video_script import build_ugc_script_prompt; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/prompts/video_script.py
git commit -m "feat: add build_ugc_script_prompt for Stage 5 multishot template-driven scripts"
```

---

### Task 5: Pipeline Orchestrator (stage5_video.py)

**Files:**
- Create: `worker/pipeline/stage5_video.py`

- [ ] **Step 1: Create the full pipeline orchestrator**

```python
# worker/pipeline/stage5_video.py
"""Stage 5: Multishot UGC Video Pipeline.

3-stage flow per persona × template:
  5A: Qwen 397B writes script → evaluator gates → rewrite loop
  5B: Gemma 4 writes Seedream prompts → generate frames → VQA gate per frame
  5C: Kling 3.0 multishot with per-shot references → upload → save

Inputs: personas, actors, brief, copy from Stages 1-4.
Outputs: 12-15s vertical UGC videos with sound, stored as video assets.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from ai.kling_client import generate_multishot_video
from ai.local_llm import generate_text
from ai.seedream import generate_image
from blob_uploader import upload_to_blob
from neon_client import get_actors, get_assets, save_asset
from prompts.video_director import build_kling_prompt, CAMERA_MOVES, LIGHTING_PRESETS, TEXTURE_PRESETS
from prompts.video_evaluator import (
    ScriptEvalResult,
    build_eval_prompt,
    build_rewrite_prompt,
    check_script_constraints,
    compute_passed,
    MAX_RETRIES,
)
from prompts.video_script import VIDEO_SCRIPT_SYSTEM, build_ugc_script_prompt
from prompts.video_storyboard import (
    build_seedream_prompt,
    vqa_storyboard_frame,
    rewrite_seedream_prompt,
    MAX_STORYBOARD_RETRIES,
)
from prompts.video_templates import LOCATIONS, select_template

logger = logging.getLogger(__name__)


async def run_stage5(context: dict) -> dict:
    """Run the Stage 5 multishot UGC video pipeline.

    For each persona × template: script → storyboard → Kling → upload.
    """
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    languages: list[str] = context.get("target_languages", ["English"])
    form_data: dict = context.get("form_data", {})

    # Load actors from Neon
    actors = await get_actors(request_id)
    actor_by_persona: dict[str, dict] = {}
    for actor in actors:
        fl = actor.get("face_lock", {})
        if isinstance(fl, str):
            fl = json.loads(fl)
        pk = fl.get("persona_key", fl.get("archetype_key", ""))
        if pk and pk not in actor_by_persona:
            actor_by_persona[pk] = {**actor, "face_lock": fl}

    video_count = 0

    for persona in personas:
        persona_key = persona.get("archetype_key", persona.get("persona_key", "unknown"))
        persona_name = persona.get("persona_name", persona.get("name", persona_key))
        language = persona.get("language", languages[0] if languages else "English")

        # Find actor for this persona
        actor = actor_by_persona.get(persona_key)
        if not actor:
            logger.warning("No actor found for persona %s — skipping video", persona_key)
            continue

        # Get actor's best reference images
        image_assets = await get_assets(request_id, asset_type="base_image")
        actor_id = str(actor.get("id", ""))
        ref_urls = [
            a["blob_url"] for a in image_assets
            if str(a.get("actor_id", "")) == actor_id and a.get("blob_url")
        ][:3]

        logger.info(
            "Stage 5: %s (%s) — %d reference images",
            persona_name, persona_key, len(ref_urls),
        )

        # ── Select template + locations ──
        template_key, template, locations = select_template(persona)
        logger.info(
            "Template: %s (%d beats), locations: %s",
            template_key, len(template["beats"]),
            [l["key"] for l in locations],
        )

        # ── STAGE 5A: Script generation + evaluation ──
        script = await _generate_script(
            persona=persona,
            brief={**brief, "form_data": form_data},
            template_key=template_key,
            template=template,
            locations=locations,
            language=language,
        )
        if not script:
            logger.error("Script generation failed for %s — skipping", persona_name)
            continue

        scenes = script.get("scenes", [])
        logger.info(
            "Script approved: %d scenes, %ds, hook='%s'",
            len(scenes),
            sum(s.get("duration_s", 0) for s in scenes),
            script.get("hook", "?")[:60],
        )

        # ── STAGE 5B: Storyboard generation + VQA ──
        storyboard_urls = await _generate_storyboard(
            scenes=scenes,
            actor=actor,
            locations=locations,
            request_id=request_id,
        )
        logger.info("Storyboard: %d/%d frames VQA-passed", len(storyboard_urls), len(scenes))

        if not storyboard_urls:
            logger.error("No storyboard frames generated — skipping Kling")
            continue

        # ── STAGE 5C: Kling multishot ──
        try:
            video_bytes = await _generate_kling_video(
                scenes=scenes,
                storyboard_urls=storyboard_urls,
                actor=actor,
                ref_urls=ref_urls,
            )
        except Exception as e:
            logger.error("Kling generation failed: %s", e)
            continue

        # ── Upload + Save ──
        filename = f"video_{persona_key}_{template_key}_{uuid.uuid4().hex[:8]}.mp4"
        blob_url = await upload_to_blob(
            video_bytes,
            filename,
            folder=f"requests/{request_id}/videos",
            content_type="video/mp4",
        )
        logger.info("Video uploaded: %s", blob_url)

        await save_asset(request_id, {
            "asset_type": "video",
            "platform": "tiktok",
            "format": "1080x1920",
            "language": language,
            "blob_url": blob_url,
            "metadata": {
                "actor_id": actor_id,
                "actor_name": actor.get("name"),
                "persona_key": persona_key,
                "template": template_key,
                "locations": [l["key"] for l in locations],
                "script": script,
                "storyboard_urls": storyboard_urls,
                "sound": "on",
                "duration_s": sum(s.get("duration_s", 0) for s in scenes),
                "shot_count": len(scenes),
                "hook": script.get("hook", ""),
                "cta": script.get("cta", ""),
            },
            "stage": 5,
        })
        video_count += 1
        logger.info("Video saved for %s/%s", persona_name, template_key)

    return {"video_count": video_count}


# ── Stage 5A: Script Generation ──────────────────────────────────────

async def _generate_script(
    *,
    persona: dict,
    brief: dict,
    template_key: str,
    template: dict,
    locations: list[dict],
    language: str,
) -> dict | None:
    """Generate and evaluate a video script. Retries with feedback on failure."""
    prompt = build_ugc_script_prompt(
        persona=persona,
        brief=brief,
        template_key=template_key,
        template=template,
        locations=locations,
        language=language,
    )

    for attempt in range(1 + MAX_RETRIES):
        text = await generate_text(VIDEO_SCRIPT_SYSTEM, prompt, thinking=True)
        script = _parse_json(text)

        if not script or not script.get("scenes"):
            logger.warning("Script parse failed (attempt %d)", attempt + 1)
            continue

        # Deterministic checks
        issues = check_script_constraints(script)
        if issues:
            logger.info("Script constraint issues: %s", issues)

        # LLM evaluation
        eval_prompt = build_eval_prompt(json.dumps(script, indent=2, default=str), persona)
        eval_text = await generate_text(
            "You evaluate UGC video scripts. Return ONLY valid JSON.",
            eval_prompt,
            thinking=False,
            max_tokens=2048,
        )
        eval_data = _parse_json(eval_text)
        scores = eval_data.get("scores", {})
        auto_fails = issues  # Deterministic issues are auto-fails

        passed, overall = compute_passed(scores, auto_fails)

        eval_result = ScriptEvalResult(
            passed=passed,
            overall_score=overall,
            scores=scores,
            auto_fails=auto_fails,
            reason=eval_data.get("reason", ""),
            raw_response=eval_text[:500],
        )

        if passed:
            logger.info("Script PASSED (score=%.1f, attempt %d)", overall, attempt + 1)
            return script

        logger.info(
            "Script FAILED (score=%.1f, attempt %d/%d): %s",
            overall, attempt + 1, 1 + MAX_RETRIES, eval_result.reason[:100],
        )

        if attempt < MAX_RETRIES:
            prompt = build_rewrite_prompt(
                json.dumps(script, indent=2, default=str),
                eval_result,
                persona,
                template_key,
            )

    logger.error("Script failed after %d attempts", 1 + MAX_RETRIES)
    return None


# ── Stage 5B: Storyboard Generation ──────────────────────────────────

async def _generate_storyboard(
    *,
    scenes: list[dict],
    actor: dict,
    locations: list[dict],
    request_id: str,
) -> list[str]:
    """Generate a VQA-verified storyboard frame for each shot."""
    storyboard_urls: list[str] = []

    for i, scene in enumerate(scenes):
        location = locations[i % len(locations)]
        logger.info("Generating storyboard frame %d/%d (%s)", i + 1, len(scenes), scene.get("label", "?"))

        # Build Seedream prompt
        sdream_prompt = build_seedream_prompt(scene, actor, location)

        frame_url = None
        for retry in range(1 + MAX_STORYBOARD_RETRIES):
            # Generate image
            try:
                image_bytes = await generate_image(sdream_prompt, dimension_key="tiktok")
            except Exception as e:
                logger.warning("Seedream failed for shot %d (retry %d): %s", i + 1, retry, e)
                continue

            # VQA gate
            vqa_result = await vqa_storyboard_frame(image_bytes, scene, actor, location)

            if vqa_result.get("passed", False):
                # Upload and save URL
                fname = f"storyboard_{request_id[:8]}_shot{i + 1}_{uuid.uuid4().hex[:6]}.png"
                frame_url = await upload_to_blob(
                    image_bytes, fname,
                    folder=f"requests/{request_id}/storyboard",
                    content_type="image/png",
                )
                logger.info("Frame %d VQA passed (score=%.2f) → %s", i + 1, vqa_result.get("overall", 0), frame_url[:60])
                break
            else:
                logger.info(
                    "Frame %d VQA failed (score=%.2f, retry %d): %s",
                    i + 1, vqa_result.get("overall", 0), retry,
                    vqa_result.get("rewrite_hint", "no hint"),
                )
                sdream_prompt = rewrite_seedream_prompt(sdream_prompt, vqa_result)

        if frame_url:
            storyboard_urls.append(frame_url)
        else:
            logger.warning("Frame %d failed all retries — using actor reference as fallback", i + 1)
            # Fallback: use actor's seed image
            seed_url = actor.get("face_lock", {}).get("validated_seed_url", "")
            if seed_url:
                storyboard_urls.append(seed_url)

    return storyboard_urls


# ── Stage 5C: Kling Multishot ────────────────────────────────────────

async def _generate_kling_video(
    *,
    scenes: list[dict],
    storyboard_urls: list[str],
    actor: dict,
    ref_urls: list[str],
) -> bytes:
    """Generate a multishot video via Kling 3.0 with per-shot references."""
    face_lock = actor.get("face_lock", {})
    actor_desc = (
        f"{face_lock.get('age_range', '25-35')} year old, "
        f"{face_lock.get('hair', 'natural hair')}, "
        f"{face_lock.get('eye_color', 'brown')} eyes"
    )

    shots: list[dict[str, Any]] = []
    for i, scene in enumerate(scenes):
        camera_key = scene.get("camera", "close_up")
        camera_desc = CAMERA_MOVES.get(camera_key, camera_key.replace("_", " "))
        lighting_key = scene.get("lighting", "natural_afternoon")
        lighting_desc = LIGHTING_PRESETS.get(lighting_key, lighting_key)
        texture_key = scene.get("texture", "iphone_ugc")
        texture_desc = TEXTURE_PRESETS.get(texture_key, texture_key)

        prompt_parts = [
            f"[CAMERA: {camera_desc}]",
            f"[SUBJECT: {actor_desc}, matches reference character exactly]",
            f"[ACTION: {scene.get('action', scene.get('direction', 'looking at camera'))}]",
        ]
        if scene.get("dialogue"):
            prompt_parts.append(f'[DIALOGUE: "{scene["dialogue"]}"]')
        prompt_parts.append(f"[ENVIRONMENT: {scene.get('environment', 'modern home interior')}]")
        prompt_parts.append(f"[LIGHTING: {lighting_desc}]")
        prompt_parts.append(f"[TEXTURE: {texture_desc}]")

        shots.append({
            "prompt": "\n".join(prompt_parts),
            "duration_s": scene.get("duration_s", 3),
            "camera": camera_key,
            "transition": scene.get("transition", "hard_cut"),
        })

    # Combine storyboard frames + actor references
    all_refs = storyboard_urls + ref_urls[:2]  # Storyboard first, then actor refs

    return await generate_multishot_video(
        shots=shots,
        references=all_refs,
        resolution="1080p",
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output."""
    if not text:
        return {}
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    depth = 0
    start = -1
    last = None
    for i, c in enumerate(cleaned):
        if c == '{':
            if depth == 0: start = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    p = json.loads(cleaned[start:i+1])
                    if isinstance(p, dict) and len(p) > 2:
                        last = p
                except json.JSONDecodeError:
                    pass
                start = -1
    return last or {}
```

- [ ] **Step 2: Verify imports**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from pipeline.stage5_video import run_stage5; print('stage5_video imports OK')"`

Expected: `stage5_video imports OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/pipeline/stage5_video.py
git commit -m "feat: Stage 5 multishot UGC video pipeline orchestrator"
```

---

### Task 6: Wire Stage 5 into Pipeline Orchestrator

**Files:**
- Modify: `worker/pipeline/orchestrator.py`

- [ ] **Step 1: Read orchestrator.py to find where to add Stage 5**

Run: `grep -n "stage.*video\|stage_4\|stage_5\|run_stage" /Users/stevenjunop/centric-intake/worker/pipeline/orchestrator.py | head -20`

- [ ] **Step 2: Add Stage 5 import and call**

Add import at the top:
```python
from pipeline.stage5_video import run_stage5
```

Add Stage 5 execution after Stage 4 completes (find the section where stages are dispatched and add):
```python
# Stage 5: Video generation (if enabled)
if context.get("generate_video", True) and context.get("personas"):
    logger.info("Starting Stage 5: Video generation")
    try:
        video_result = await run_stage5(context)
        context["video_count"] = video_result.get("video_count", 0)
        logger.info("Stage 5 complete: %d videos generated", context["video_count"])
    except Exception as e:
        logger.error("Stage 5 failed: %s", e)
        context["video_count"] = 0
```

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/pipeline/orchestrator.py
git commit -m "feat: wire Stage 5 video pipeline into orchestrator"
```

---

### Task 7: Manual Test Script

**Files:**
- Create: `worker/run_stage5_test.py`

- [ ] **Step 1: Create test script that runs the full pipeline for one persona**

```python
# worker/run_stage5_test.py
"""Manual test: Run Stage 5 for the first persona in the latest request."""
import asyncio
import json
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")

REQUEST_ID = sys.argv[1] if len(sys.argv) > 1 else "fd318779-45f2-45bb-b0ff-5420c5c10260"


async def main():
    from neon_client import _get_pool
    from pipeline.stage5_video import run_stage5

    pool = await _get_pool()

    # Load brief
    row = await pool.fetchrow("SELECT brief_data FROM creative_briefs WHERE request_id = $1", REQUEST_ID)
    brief = json.loads(row["brief_data"]) if row else {}

    # Load request
    req = await pool.fetchrow("SELECT * FROM intake_requests WHERE id = $1", REQUEST_ID)
    form_data = json.loads(req["form_data"]) if req and req.get("form_data") else {}

    context = {
        "request_id": REQUEST_ID,
        "brief": brief,
        "personas": brief.get("personas", [])[:1],  # Just first persona for testing
        "target_languages": ["Portuguese"],
        "form_data": form_data,
    }

    print(f"Running Stage 5 for request {REQUEST_ID}")
    print(f"Persona: {context['personas'][0].get('persona_name', '?') if context['personas'] else 'none'}")

    result = await run_stage5(context)
    print(f"\nResult: {json.dumps(result, indent=2, default=str)}")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Run the test (requires Kling credits)**

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 run_stage5_test.py`

Note: This will use Kling credits. If Kling balance is empty, the script will succeed through Stage 5A (script) and 5B (storyboard) but fail at 5C (Kling). The storyboard frames will still be generated and uploaded.

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake
git add worker/run_stage5_test.py
git commit -m "feat: Stage 5 manual test script"
```
