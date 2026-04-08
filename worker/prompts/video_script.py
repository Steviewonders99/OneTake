"""Video script generator — hook->problem->solution->value_prop->CTA.

Each script follows the attention-first format for short-form video:
- Hook (0-3s): Stop-scroll opener, face-to-camera or bold statement
- Problem (3-6s): Relatable pain point for the target persona
- Solution (6-10s): How OneForma solves it
- Value Prop (10-13s): Key differentiator
- CTA (13-15s): Clear action with urgency

Scripts are persona-driven — each persona gets a different script
with different hooks, pain points, and psychology.
"""
from __future__ import annotations

import json
from typing import Any

VIDEO_SCRIPT_SYSTEM = """You are a short-form video scriptwriter for OneForma recruitment ads.
You write scripts that feel like REAL influencer/UGC creator content, NOT corporate ads.

═══════════════════════════════════════════════
15-SECOND STORY ARC (Neurogen Framework)
═══════════════════════════════════════════════

Every 15-second video follows this EXACT tension curve:

BEAT 1 — HOOK (0-2s): STOP THE SCROLL
  Pattern interrupt. Something unexpected. A bold claim, a surprising question,
  direct eye contact with intensity. The viewer must think "wait, what?"
  Camera: EXTREME close-up, face fills frame.

BEAT 2 — TENSION (2-5s): BUILD THE GAP
  Create a gap between where the viewer is and where they want to be.
  This is the "problem" or "what if" moment. Build emotional investment.
  Camera: Medium shot, animated gestures, slight push-in.

BEAT 3 — PAYOFF (5-10s): DELIVER VALUE
  Close the gap. Reveal the solution, the opportunity, the earnings.
  This is where the persona's specific pain point gets addressed.
  The energy LIFTS here — the person becomes visibly excited.
  Camera: Varied angles — low angle (empowerment), over-shoulder, wide.

BEAT 4 — CTA + BRAND (10-15s): CONVERT
  NOT just "link in bio." The CTA must create URGENCY or FOMO.
  End with the brand moment — OneForma name, clear next step.
  This beat must feel like a CONCLUSION, not a trailing off.
  Camera: Close-up, direct eye contact, confident energy.

═══════════════════════════════════════════════
PERFORMANCE DIRECTION
═══════════════════════════════════════════════

NATURAL, NOT EXAGGERATED:
- Expressions should feel like a real person sharing exciting news with a friend
- NOT theatrical, NOT over-the-top surprise faces, NOT AI-performed
- Think: "casual confidence" not "infomercial energy"
- Subtle smile > fake shock face. Real excitement > forced enthusiasm.
- The acting direction should say things like: "genuine smile", "natural lean in",
  "relaxed but engaged", "eyes light up naturally"
- NEVER: "jaw drops", "exaggerated surprise", "screams with excitement"

BRAND/CTA FINISH (CRITICAL):
- The last 3-5 seconds MUST include a clear brand moment and call to action
- Name drop "OneForma" explicitly in the script dialogue
- CTA must be SPECIFIC: "Search OneForma, sign up in 2 minutes" not just "check it out"
- Add urgency: "spots filling up", "limited in your region", "I started earning this week"
- The video should end on the STRONGEST frame — not trailing off

═══════════════════════════════════════════════
STYLE + RULES
═══════════════════════════════════════════════

- Influencer talking directly to camera with natural energy
- Rapid cuts between camera angles every 2-4 seconds
- Vary: extreme close-up, medium, wide, low angle, over-shoulder
- Speak in first person as the character/contributor
- Total duration: exactly 12-15 seconds
- Include (parenthetical direction) for SUBTLE emotions and actions
- Mark [CAMERA: direction] for each scene change

SCREEN RULES:
- Laptops, phones CAN appear as scene props (screen angled away, closed, or out of focus)
- NO readable screen content — no UI, no text, no fake apps
- Instead of "shows earnings on phone" → "eyes light up, genuine celebratory reaction"
- The PERSON is always the visual focus, not any device

SCENE SETTINGS (vary across shots for visual interest):
- KITCHEN: Modern, clean kitchen background. Person in casual tee, talking naturally. Warm lighting.
- CAR: Selfie angle from driver/passenger seat. Urgent energy, "I just found out" vibe. HANDHELD SHAKE.
- DESK: Sitting at desk/table, sweater or smart-casual. Hand gestures. Lamp or accent lighting.
- OUTDOOR/WALKING: Moving through street or park. Camera follows. HANDHELD SHAKE for realism.
- COUCH/HOME: Relaxed setting, comfortable clothes. Intimate, confessional tone.
- CAFE: Coffee shop background, natural light. Social, approachable energy.

The script should specify which SETTING each beat happens in. Variety across beats keeps it engaging.
Car and walking scenes MUST specify handheld camera for authentic UGC feel.
"""

# ---------------------------------------------------------------------------
# 8 video script templates (maps to VYRA's 15, adapted for recruitment)
# ---------------------------------------------------------------------------

VIDEO_TEMPLATES: dict[str, dict[str, Any]] = {
    "ugc_talking_head": {
        "description": "Influencer-style talking head with rapid angle cuts",
        "structure": "Hook (extreme close-up) -> Problem -> Solution -> Celebration -> CTA",
        "best_for": [],
        "platforms": ["tiktok", "instagram_reels", "youtube_shorts"],
        "duration_range": (12, 15),
        "scene_blueprint": [
            {"label": "hook", "duration_s": 2, "camera": "close_up", "direction": "Extreme close-up, eyes wide, lean into camera with energy"},
            {"label": "problem", "duration_s": 3, "camera": "medium", "direction": "Cut to medium shot, animated hand gestures, frustrated expression"},
            {"label": "solution", "duration_s": 3, "camera": "low_angle", "direction": "Low angle looking up, confident smile, pointing at camera"},
            {"label": "value_prop", "duration_s": 3, "camera": "over_shoulder", "direction": "Over shoulder wide shot, celebrating with fist pump, happy expression"},
            {"label": "cta", "duration_s": 2, "camera": "close_up", "direction": "Snap back to close-up, direct eye contact, beckoning gesture"},
        ],
    },
    "pov_reveal": {
        "description": "POV: person discovers an amazing opportunity and shares it",
        "structure": "Surprise hook -> Reaction -> Explain -> Energy build -> CTA",
        "best_for": [],
        "platforms": ["tiktok", "instagram_reels"],
        "duration_range": (10, 15),
        "scene_blueprint": [
            {"label": "hook", "duration_s": 2, "camera": "extreme_close_up", "direction": "Eyes go wide, mouth drops open in surprise, looking slightly off camera"},
            {"label": "discovery", "duration_s": 2, "camera": "medium", "direction": "Cut to medium shot, person turns to camera with excited energy"},
            {"label": "reaction", "duration_s": 2, "camera": "low_angle", "direction": "Low angle, person gesturing enthusiastically, 'you won't believe this'"},
            {"label": "explanation", "duration_s": 4, "camera": "close_up", "direction": "Close-up talking to camera, explaining the opportunity with hand gestures"},
            {"label": "cta", "duration_s": 2, "camera": "push_in", "direction": "Push in close, direct eye contact, beckoning gesture"},
        ],
    },
    "earnings_reveal": {
        "description": "Person celebrates earnings and explains how they did it",
        "structure": "Celebration -> Reaction -> 'Here's how' -> Steps -> CTA",
        "best_for": [],
        "platforms": ["tiktok", "instagram_reels", "facebook_reels"],
        "duration_range": (12, 15),
        "scene_blueprint": [
            {"label": "hook", "duration_s": 2, "camera": "close_up", "direction": "Face lights up with genuine excitement, fist pump or happy dance"},
            {"label": "reaction", "duration_s": 2, "camera": "medium", "direction": "Cut to medium shot, person doing celebratory gesture, big smile"},
            {"label": "how_intro", "duration_s": 2, "camera": "over_shoulder", "direction": "Over shoulder shot at desk, lean forward conspiratorially, 'Here is how'"},
            {"label": "explanation", "duration_s": 4, "camera": "tracking", "direction": "Walking through the house, explaining casually"},
            {"label": "cta", "duration_s": 2, "camera": "push_in", "direction": "Back to face, push in, direct CTA"},
        ],
    },
    "day_in_the_life": {
        "description": "A day as a OneForma contributor",
        "structure": "Morning routine -> Open laptop -> Work montage -> Earnings -> Life",
        "best_for": [],
        "platforms": ["tiktok", "instagram_reels", "youtube_shorts"],
        "duration_range": (20, 45),
        "scene_blueprint": [
            {"label": "morning", "duration_s": 3, "camera": "wide_establishing", "direction": "Morning light, getting coffee or tea"},
            {"label": "setup", "duration_s": 2, "camera": "overhead", "direction": "Overhead shot of opening laptop at table"},
            {"label": "working", "duration_s": 3, "camera": "over_shoulder", "direction": "Over shoulder, annotating on screen"},
            {"label": "earnings", "duration_s": 2, "camera": "extreme_close_up", "direction": "Close up of earnings dashboard"},
            {"label": "life_after", "duration_s": 3, "camera": "tracking", "direction": "Close laptop, enjoy life — go outside or play with kids"},
            {"label": "cta", "duration_s": 2, "camera": "close_up", "direction": "Look at camera, text overlay with CTA"},
        ],
    },
    "before_after": {
        "description": "Before: struggling. After: earning from home",
        "structure": "Before (sad) -> Discovery -> After (happy, earning) -> CTA",
        "best_for": [],
        "platforms": ["tiktok", "instagram_reels", "facebook_reels"],
        "duration_range": (12, 20),
        "scene_blueprint": [
            {"label": "before", "duration_s": 3, "camera": "handheld", "direction": "Stressed face, looking at bills or job rejections"},
            {"label": "discovery", "duration_s": 2, "camera": "close_up", "direction": "Phone notification or friend message about OneForma"},
            {"label": "transition", "duration_s": 2, "camera": "whip_pan", "direction": "Whip transition to bright, happy scene"},
            {"label": "after", "duration_s": 3, "camera": "tracking", "direction": "Working from home, relaxed, smiling"},
            {"label": "cta", "duration_s": 2, "camera": "push_in", "direction": "Text overlay, push in to face for CTA"},
        ],
    },
    "stat_counter": {
        "description": "Animated statistics about OneForma",
        "structure": "Bold stat -> Context -> More stats -> CTA",
        "best_for": [],
        "platforms": ["linkedin", "youtube_shorts"],
        "duration_range": (10, 15),
        "scene_blueprint": [
            {"label": "big_stat", "duration_s": 3, "camera": "static", "direction": "Bold number animates in, dark background"},
            {"label": "context", "duration_s": 3, "camera": "static", "direction": "Text explains the stat, contributor face fades in"},
            {"label": "more_stats", "duration_s": 3, "camera": "static", "direction": "Additional stats stack in"},
            {"label": "cta", "duration_s": 3, "camera": "push_in", "direction": "CTA button animates in"},
        ],
    },
    "testimonial_quote": {
        "description": "Contributor testimonial with text overlay",
        "structure": "Quote text -> Person appears -> Elaborates -> CTA",
        "best_for": [],
        "platforms": ["facebook", "linkedin", "instagram"],
        "duration_range": (15, 30),
        "scene_blueprint": [
            {"label": "quote_text", "duration_s": 3, "camera": "static", "direction": "Quote appears as text on soft background"},
            {"label": "person_reveal", "duration_s": 3, "camera": "pull_back", "direction": "Camera pulls back to reveal the person speaking"},
            {"label": "elaboration", "duration_s": 4, "camera": "close_up", "direction": "Close up as they elaborate on the quote"},
            {"label": "cta", "duration_s": 2, "camera": "static", "direction": "Text overlay with CTA, person smiles"},
        ],
    },
    "how_it_works": {
        "description": "3-step explainer: sign up, choose tasks, earn",
        "structure": "Hook question -> Step 1 -> Step 2 -> Step 3 -> CTA",
        "best_for": [],
        "platforms": ["tiktok", "instagram_reels", "youtube_shorts", "facebook"],
        "duration_range": (15, 30),
        "scene_blueprint": [
            {"label": "hook_question", "duration_s": 2, "camera": "close_up", "direction": "Direct eye contact, asks a question"},
            {"label": "step_1", "duration_s": 3, "camera": "over_shoulder", "direction": "Person sitting at desk, typing confidently, laptop visible but screen away from camera"},
            {"label": "step_2", "duration_s": 3, "camera": "medium", "direction": "Person gestures explaining, counting on fingers, engaged expression"},
            {"label": "step_3", "duration_s": 3, "camera": "extreme_close_up", "direction": "Show earnings or payment confirmation"},
            {"label": "cta", "duration_s": 2, "camera": "pull_back", "direction": "Pull back, arms out, 'that is it' energy, CTA overlay"},
        ],
    },
}

def select_video_template(
    persona: dict,
    platforms: list[str],
) -> str:
    """Select the best video template for the target platforms.

    With dynamic personas (Task 18/19) there are no hardcoded archetype
    affinities, so scoring is now driven by platform overlap + duration
    preference only. Ties broken by template order (first declared wins).

    Parameters
    ----------
    persona:
        A persona dict. Currently unused in scoring but kept in the
        signature so callers don't need to change.
    platforms:
        Target video platforms (e.g. ``["tiktok", "instagram_reels"]``).

    Returns
    -------
    str
        The key of the best matching template from ``VIDEO_TEMPLATES``.
    """
    del persona  # reserved for future persona-aware scoring

    best_key = "ugc_talking_head"  # safe default
    best_score = -1

    for tpl_key, tpl in VIDEO_TEMPLATES.items():
        score = 0

        # Platform overlap
        for plat in platforms:
            # Normalise platform names (e.g. "tiktok_feed" -> "tiktok")
            plat_base = plat.split("_")[0]
            if any(plat_base in tp for tp in tpl["platforms"]):
                score += 2

        # Duration preference — shorter is better for TikTok/Reels
        min_dur, max_dur = tpl["duration_range"]
        if any("tiktok" in p or "reels" in p for p in platforms):
            if max_dur <= 20:
                score += 1
        elif any("youtube" in p or "linkedin" in p for p in platforms):
            if max_dur >= 25:
                score += 1

        if score > best_score:
            best_score = score
            best_key = tpl_key

    return best_key


def build_video_script_prompt(
    persona: dict,
    brief: dict,
    template_key: str,
    language: str,
    region: str,
) -> str:
    """Build the prompt for Gemma 3 12B to write a video script.

    The prompt includes persona psychology hooks, pain points, trigger words,
    and Kling-compatible camera directions for each scene.

    Parameters
    ----------
    persona:
        The full persona dict (from persona engine).
    brief:
        The creative brief dict.
    template_key:
        Key from ``VIDEO_TEMPLATES``.
    language:
        Target language for the script (e.g. ``"Portuguese"``).
    region:
        Target region (e.g. ``"Brazil"``).

    Returns
    -------
    str
        The fully formatted user prompt for the LLM.
    """
    template = VIDEO_TEMPLATES[template_key]
    psychology = persona.get("psychology_profile", {})

    # Build scene-by-scene instruction from the template blueprint
    scene_instructions = []
    cumulative_s = 0
    for idx, scene in enumerate(template["scene_blueprint"], 1):
        cumulative_s += scene["duration_s"]
        scene_instructions.append(
            f"Scene {idx} — {scene['label'].upper()} "
            f"({scene['duration_s']}s, cumulative {cumulative_s}s)\n"
            f"  [CAMERA: {scene['camera']}] {scene['direction']}"
        )
    scene_block = "\n".join(scene_instructions)

    # Psychology fields come from the dynamic persona's psychology_profile
    trigger_words = ", ".join(psychology.get("trigger_words", []))
    primary_bias = psychology.get("primary_bias", "social_proof")
    secondary_bias = psychology.get("secondary_bias", "effort_minimization")
    messaging_angle = psychology.get("messaging_angle", "")

    # Pain points from the persona itself
    persona_pain_points = persona.get("pain_points", [])
    pain_points_str = "\n".join(f"  - {p}" for p in persona_pain_points)

    # Motivations
    motivations = persona.get("motivations", [])
    motivations_str = "\n".join(f"  - {m}" for m in motivations)

    # Objections to pre-empt
    objections = persona.get("objections", [])
    objections_str = "\n".join(f"  - {o}" for o in objections)

    min_dur, max_dur = template["duration_range"]

    archetype_label = (
        persona.get("archetype")
        or persona.get("matched_tier")
        or persona.get("persona_name")
        or "Contributor"
    )

    return f"""Write a video script for a OneForma recruitment ad.

TARGET PERSONA: {archetype_label}
Age range: {persona.get("age_range", "20-35")}
Lifestyle: {persona.get("lifestyle", "")}
Region: {region}
Language: {language} (write ALL dialogue and text overlays in {language})

PERSONA PSYCHOLOGY:
Primary bias: {primary_bias} — lean into this in the hook
Secondary bias: {secondary_bias} — reinforce in the value prop
Messaging angle: {messaging_angle}
Trigger words (weave naturally): {trigger_words}

PAIN POINTS (pick the most relevant for the hook/problem section):
{pain_points_str}

MOTIVATIONS (the "after" state — use in solution/value prop):
{motivations_str}

OBJECTIONS TO PRE-EMPT (address 1-2 subtly in the script):
{objections_str}

VIDEO TEMPLATE: {template_key} — {template["description"]}
Structure: {template["structure"]}
Duration: {min_dur}-{max_dur} seconds total

SCENE-BY-SCENE BREAKDOWN (follow this structure exactly):
{scene_block}

BRIEF CONTEXT:
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

CAMERA DIRECTION VOCABULARY (use these exact terms in [CAMERA:] tags):
static, push_in, pull_back, tracking, orbit_360, pan_left, pan_right,
tilt_up, tilt_down, handheld, dolly_zoom, whip_pan, crane_up,
low_angle, high_angle, over_shoulder, two_shot, close_up,
extreme_close_up, wide_establishing

CRITICAL RULES:
- ALL dialogue MUST be in {language} (native, not translated)
- Total script duration MUST be {min_dur}-{max_dur} seconds
- ALL lip-synced dialogue MUST appear in the first 10 seconds (Kling constraint)
- Include (parenthetical acting direction) for emotions and actions
- Include [CAMERA: direction] for each scene change
- Text overlays should be SHORT (5-8 words max)
- The hook must stop a thumb-scroll in under 2 seconds
- Speak in first person AS the persona character, NOT as a brand
- Do NOT use corporate language — this must feel like real UGC

Return ONLY valid JSON:
{{
  "hook": "<the opening line/action that stops the scroll>",
  "problem": "<the relatable pain point expressed>",
  "solution": "<how OneForma solves this>",
  "value_prop": "<the key differentiator>",
  "cta": "<clear call to action with urgency>",
  "full_script": "<complete script with all dialogue, directions, and overlays>",
  "scenes": [
    {{
      "scene_num": 1,
      "label": "<scene label>",
      "duration_s": <seconds>,
      "camera": "<camera direction from vocabulary>",
      "action": "<what happens visually>",
      "dialogue": "<spoken words in {language} or empty string if no speech>",
      "text_overlay": "<on-screen text or empty string>",
      "acting_direction": "<emotion and physicality>"
    }}
  ],
  "estimated_duration_s": <total seconds>,
  "target_platform": "{template['platforms'][0] if template['platforms'] else 'tiktok'}",
  "dialogue_ends_at_s": <second mark where last dialogue ends — MUST be <= 10>
}}"""


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
