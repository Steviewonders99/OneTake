"""Image Realism Evaluator — strict human flawlessness scoring.

This evaluator has ONE job: determine if a generated image could pass
as a REAL photograph taken by a real person with a real phone.

Scoring: 0-10 per dimension
Hard gates: MIN_ACCEPT = 8.5 overall (STRICT), MIN_DIM = 7 per dimension
Verdict: accept | revise | reject
Any "AI tell-tale" detection = automatic reject (score 0 on that dimension)
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# =========================================================================
# 10 DIMENSIONS — matching the 10 realism anchors
# =========================================================================

IMAGE_REALISM_DIMENSIONS: dict[str, dict[str, Any]] = {
    "skin_texture": {
        "weight": 0.15,
        "min_score": 7,
        "description": "Does the skin look like real human skin photographed with a phone camera?",
        "auto_reject_triggers": [
            "plastic skin", "airbrushed", "porcelain", "no visible pores",
            "waxy", "doll-like skin", "beauty filter", "overly smooth",
            "glossy skin", "uniform skin color", "no imperfections",
        ],
        "scoring_guide": {
            "0-3": "Plastic/waxy skin, no pores visible, AI-obvious smooth texture. "
                   "Skin looks like a mannequin or Barbie doll. Uniform color with no "
                   "variation across face zones.",
            "4-5": "Some texture but clearly too smooth for a real photo. Pores may be "
                   "hinted at but not individually visible. Under-eye area is suspiciously "
                   "smooth. No T-zone oiliness or natural color variation.",
            "6-7": "Decent texture but missing micro-details: no visible T-zone oiliness, "
                   "under-eye shadows are too clean, no tiny blemishes or follicles. "
                   "Passes at a glance but fails close inspection.",
            "8-9": "Natural skin with visible pores on nose/forehead, slight imperfections "
                   "(small blemish, uneven tone), realistic under-eye shadows, T-zone has "
                   "slight sheen. Skin varies in texture across face.",
            "10": "Dermatologist-level realism: individual pores on nose visible, follicle "
                  "dots on chin/cheeks, natural color variation (slightly redder nose, "
                  "different tone near jawline), under-eye shadows with vascular hints, "
                  "micro-bumps on forehead.",
        },
    },
    "hair_realism": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Does the hair look like real hair, not AI-rendered strands?",
        "auto_reject_triggers": [
            "helmet hair", "perfectly uniform strands", "no flyaways",
            "plastic-looking", "hair merging with background", "floating hair",
            "unnaturally thick strands", "hair clipping through objects",
            "painted-on hair texture",
        ],
        "scoring_guide": {
            "0-3": "Obvious AI hair: uniform strand width, no flyaways, helmet-like "
                   "solid mass. May have impossible geometry — strands passing through "
                   "each other or merging with the background.",
            "4-5": "Hair exists but too perfect — salon-fresh, every strand in place, "
                   "no baby hairs at temples. Uniform color from root to tip. No "
                   "evidence of natural texture (curl pattern too regular).",
            "6-7": "Some natural movement but missing baby hairs and light-catching "
                   "flyaways. Hair texture is mostly right but transition at hairline "
                   "is too clean. No stray hairs on forehead or near ears.",
            "8-9": "Natural hair with flyaways catching backlight, slight frizz at "
                   "crown, baby hairs at temples visible. Light interacts differently "
                   "with different strand groups. Hairline has natural irregularity.",
            "10": "You could count individual strands. Baby hairs catching backlight "
                  "near temples. Visible texture difference between freshly washed areas "
                  "and natural oil buildup. Slight tangles or flyaways that defy gravity "
                  "correctly. Real curl/wave pattern with natural variation.",
        },
    },
    "facial_asymmetry": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Does the face show natural human asymmetry? Real faces are NEVER perfectly symmetrical.",
        "auto_reject_triggers": [
            "perfectly symmetrical", "mirror-image halves", "uncanny valley",
            "identical left and right side", "geometrically perfect features",
            "CGI face", "video game character face",
        ],
        "scoring_guide": {
            "0-3": "Face is obviously symmetrical — if you mirror one half, it would "
                   "match perfectly. Uncanny valley effect. Features feel placed by a "
                   "3D modeler, not grown by biology.",
            "4-5": "Some asymmetry exists but feels artificial — like a symmetrical "
                   "face with a slight Photoshop warp. Eyes are still too evenly placed. "
                   "Smile is too even on both sides.",
            "6-7": "Noticeable asymmetry in some features but others are still too "
                   "perfect. For example, mouth is naturally asymmetrical but eyes "
                   "and brows are mirror-matched.",
            "8-9": "Natural human asymmetry: one eye slightly higher or smaller, "
                   "one eyebrow with a different arch, slightly uneven smile, nose "
                   "tip leans slightly to one side. The kind of asymmetry you would "
                   "never notice unless measuring.",
            "10": "Every feature has subtle natural asymmetry. One nostril slightly "
                  "larger, one ear sits slightly different, hairline not perfectly "
                  "even, jaw angle differs left-to-right. A forensic examiner would "
                  "confirm this is a real human face.",
        },
    },
    "lighting_imperfections": {
        "weight": 0.10,
        "min_score": 6,
        "description": "Does the lighting have real-world imperfections? Mixed color temperatures, hard shadows, lens effects?",
        "auto_reject_triggers": [
            "uniform lighting", "no shadows", "studio-lit appearance",
            "flat lighting everywhere", "impossible light direction",
            "light source contradiction", "ambient occlusion only",
            "no color temperature variation",
        ],
        "scoring_guide": {
            "0-3": "Uniform, flat lighting with no shadows or color temperature "
                   "variation. Looks like an AI render with ambient occlusion only. "
                   "No visible light source directionality.",
            "4-5": "Some directional lighting but too clean — shadows are soft and "
                   "uniform. Single color temperature across entire frame. No mixed "
                   "warm/cool sources.",
            "6-7": "Decent lighting with visible shadow direction, but missing the "
                   "messy reality of mixed sources. Shadows are too soft everywhere. "
                   "No hard shadow edges from nearby objects.",
            "8-9": "Mixed color temperatures visible (warm lamp + cool window). Hard "
                   "shadows from nearby objects coexist with soft ambient fill. Slight "
                   "color cast variation across the frame. Light wraps around face "
                   "naturally with chin shadow.",
            "10": "Professional photographer would say 'unedited'. Mixed warm/cool "
                  "sources create color cast shifts across the frame. Hard shadow "
                  "under chin from overhead. Soft fill from a window. Slight lens "
                  "flare or specular highlight on skin. Shadow color is not pure "
                  "black but tinted by environment bounce.",
        },
    },
    "fabric_texture": {
        "weight": 0.08,
        "min_score": 6,
        "description": "Do clothes look like real fabric with texture, wrinkles, and wear?",
        "auto_reject_triggers": [
            "smooth fabric", "no wrinkles", "CG clothing", "painted-on clothes",
            "fabric phasing through body", "impossible drape", "no fabric weave",
            "plastic-looking cloth",
        ],
        "scoring_guide": {
            "0-3": "Clothing looks painted on or made of smooth plastic. No wrinkles, "
                   "no fabric weave visible, no wear. May have impossible draping or "
                   "fabric phasing through body parts.",
            "4-5": "Some fabric shape but too clean — freshly pressed, no wrinkles at "
                   "elbows or waist bends. Fabric texture is uniform. No pilling, no "
                   "wear marks, no lint.",
            "6-7": "Wrinkles present at major joints but fabric weave is not individually "
                   "visible. Missing micro-details like slight pilling on cotton, seam "
                   "stress, or tag visibility at neckline.",
            "8-9": "Visible fabric weave (you can tell cotton from polyester). Natural "
                   "wrinkles at elbows, waist, and where body weight presses. Slight "
                   "pilling on worn areas. Seams visible. Fabric catches light differently "
                   "at different angles.",
            "10": "A tailor would approve. Fabric weight is evident (heavy denim vs light "
                  "cotton). Thread direction visible. Wear patterns match garment age. "
                  "Lint or pet hair visible. Tag at neckline creates slight bump.",
        },
    },
    "background_authenticity": {
        "weight": 0.10,
        "min_score": 7,
        "description": "Does the background look like a real physical space, not an AI-generated set?",
        "auto_reject_triggers": [
            "smooth gradient background", "AI blur", "floating objects",
            "impossible geometry", "repeating patterns", "melting surfaces",
            "objects fading into nothing", "seamless studio background",
            "pristine showroom", "no imperfections on any surface",
        ],
        "scoring_guide": {
            "0-3": "Smooth gradient or generic AI blur behind the subject. No real "
                   "objects. Background may have impossible geometry, repeating "
                   "textures, or objects that fade into nothing.",
            "4-5": "Some background elements but too clean — like a furniture showroom "
                   "or 3D render. Surfaces are perfectly smooth. No dust, no scuffs, "
                   "no lived-in evidence.",
            "6-7": "Recognizable real-world setting (desk, kitchen, cafe) but missing "
                   "the chaos of real life. Too tidy. Surfaces are too uniform. Light "
                   "switches and outlets missing from walls.",
            "8-9": "Authentic lived-in space: scuffs on walls, dust visible on surfaces, "
                   "real clutter (charger cable, pen, water bottle). Wall has paint "
                   "texture/imperfections. Floor has visible grain or grout. Different "
                   "objects at different focal distances.",
            "10": "A location scout would say 'that is a real apartment'. Walls have nail "
                  "holes, paint brush strokes, light switch plates. Furniture shows age. "
                  "Multiple personal items visible (sticky notes, half-drunk cup, phone "
                  "charger). Window shows real overexposed exterior. Dust motes in light beam.",
        },
    },
    "body_pose_naturalism": {
        "weight": 0.08,
        "min_score": 6,
        "description": "Is the body pose natural and relaxed, not stiff, stock-photo, or AI-rigid?",
        "auto_reject_triggers": [
            "stock photo pose", "T-pose", "arms crossed corporate",
            "unnatural hand position", "rigid mannequin posture",
            "floating limbs", "impossible joint angle",
            "weight distribution violation", "both feet flat military stance",
        ],
        "scoring_guide": {
            "0-3": "Stiff mannequin pose. Arms at unnatural angles. Weight distributed "
                   "evenly on both feet (real people shift weight). May have impossible "
                   "joint rotations or floating limbs.",
            "4-5": "Recognizable human pose but too posed — stock photo energy. Weight "
                   "is too centered. Arms are in a 'chosen' position rather than a "
                   "'fallen' position. No micro-movements implied.",
            "6-7": "Decent posture but missing the small asymmetries of real rest: slight "
                   "lean, one shoulder higher, head tilt. Hands are positioned but not "
                   "fully relaxed (fingers too extended or too curled).",
            "8-9": "Natural resting pose: weight shifted to one side, slight lean, one "
                   "hand relaxed with naturally curled fingers, head tilted slightly. "
                   "Implies the person was caught mid-action, not posed.",
            "10": "Candid energy. The person looks like they were photographed without "
                  "knowing. Asymmetric weight, mid-gesture, real muscle tension in face "
                  "and hands. The kind of photo where someone says 'delete that one, I "
                  "was not ready'.",
        },
    },
    "camera_artifacts": {
        "weight": 0.08,
        "min_score": 6,
        "description": "Does the image have real camera artifacts? (grain, vignette, chromatic aberration, slight noise)",
        "auto_reject_triggers": [
            "pixel-perfect image", "no noise at all", "impossible sharpness edge-to-edge",
            "no lens distortion", "HDR tonemapping artifacts",
        ],
        "scoring_guide": {
            "0-3": "Zero camera artifacts. Pixel-perfect rendering. Every edge is equally "
                   "sharp from center to corner. No grain, no noise, no vignette. Looks "
                   "like a computer render, not a photograph.",
            "4-5": "Minimal artifacts — perhaps some noise but uniform and artificial. "
                   "No chromatic aberration at high-contrast edges. Depth of field is "
                   "too uniform (either all sharp or all blurred, no transition zone).",
            "6-7": "Some camera-like qualities: noise in shadows, slight vignette. But "
                   "missing the character of a specific lens. Bokeh is too smooth. "
                   "No chromatic aberration.",
            "8-9": "Believable phone camera artifacts: visible grain in shadows, slight "
                   "vignetting at corners, mild chromatic aberration at high-contrast "
                   "edges, natural depth-of-field falloff. Bokeh has slight irregularity.",
            "10": "A camera reviewer would identify this as 'iPhone 15 Pro main sensor'. "
                  "Sensor noise pattern matches real hardware. Slight purple fringing at "
                  "bright edges. Natural vignette. Bokeh has the characteristic shape of "
                  "a real aperture. EXIF data would be believable.",
        },
    },
    "environmental_objects": {
        "weight": 0.08,
        "min_score": 6,
        "description": "Are there real-world objects in the scene? (charger, cup, notebook, pen)",
        "auto_reject_triggers": [
            "empty/clean environment", "minimalist studio", "no personal items",
            "floating objects", "objects with no shadows", "impossibly clean desk",
            "no cables or wires visible",
        ],
        "scoring_guide": {
            "0-3": "Empty or minimalist environment with no personal objects. The space "
                   "looks like an empty 3D scene. No clutter, no personal items, no "
                   "evidence that a human uses this space.",
            "4-5": "One or two objects present but they feel 'placed' — a perfect coffee "
                   "cup, a pristine notebook. No wear on any item. Objects lack shadows "
                   "or have incorrect shadow directions.",
            "6-7": "Several objects visible and appropriately placed. Some show signs of "
                   "use. But the arrangement is too deliberate — like a styled Instagram "
                   "flat lay rather than real desk chaos.",
            "8-9": "Multiple personal objects with signs of real use: bent notebook corner, "
                   "pen with chew marks, phone with case, charger cable with natural drape. "
                   "Objects are arranged with the casual disorder of real life. Each casts "
                   "its own shadow.",
            "10": "A detective could reconstruct the person's day from the objects. Half-drunk "
                  "coffee with lipstick mark. Sticky notes with scribbles. Phone face-down. "
                  "Crumbs near the keyboard. Multiple cables in slight tangles. A water "
                  "bottle with condensation. Pen cap separate from pen.",
        },
    },
    "anatomical_correctness": {
        "weight": 0.13,
        "min_score": 8,  # HIGHEST threshold — extra fingers/limbs = instant reject
        "description": "Are all body parts anatomically correct? Hands, fingers, joints, limbs?",
        "auto_reject_triggers": [
            "extra fingers", "six fingers", "missing fingers", "deformed hands",
            "extra limbs", "merged body parts", "floating appendage",
            "impossible thumb position", "fused fingers", "too many joints",
            "fingers of different lengths on same hand", "backwards thumb",
            "extra knuckle", "hand bigger than head", "wrist at impossible angle",
            "elbow bending wrong direction", "shoulder socket violation",
        ],
        "scoring_guide": {
            "0-3": "Obvious anatomical errors: extra digits (6+ fingers), deformed limbs, "
                   "impossible joint angles, merged/fused body parts. Hands are a dead "
                   "giveaway of AI generation.",
            "4-5": "Hands look slightly off but not immediately obvious: fingers are the "
                   "wrong relative lengths, thumb placement is odd, nails are inconsistent. "
                   "Wrists may be too thin or too wide.",
            "6-7": "Anatomy correct but stiff — mannequin-like joint positions. Hands have "
                   "correct finger count but joints are too straight. Fingers do not show "
                   "natural curl at rest. Wrist lacks visible tendons.",
            "8-9": "Natural anatomy with realistic joint positions and hand poses. Correct "
                   "finger count, proportions, and nail shapes. Knuckle wrinkles visible. "
                   "Joints bend at natural angles. Visible tendons when hand is tensed.",
            "10": "An anatomy professor would approve. Every finger has the right number of "
                  "joints bending in the right direction. Thumb opposes correctly. Nails have "
                  "natural shape with slight cuticle visible. Tendons and veins visible on "
                  "back of hand. Finger pads have realistic volume.",
        },
    },
}

# =========================================================================
# Thresholds
# =========================================================================

MIN_ACCEPT_SCORE = 8.5  # Higher than other evaluators — images represent the brand
MIN_DIM_SCORE = 7
ANATOMICAL_MIN = 8  # Extra fingers = campaign killer

# =========================================================================
# Prompt builder
# =========================================================================

EVAL_SYSTEM_PROMPT = (
    "You are a forensic image analyst specializing in detecting AI-generated "
    "images. You have been trained on thousands of real and AI-generated photos. "
    "Your job is to determine if an image could pass as a REAL photograph taken "
    "by a real person with a real phone.\n\n"
    "You are extremely strict. Most AI images fail your test. A score of 8+ means "
    "you genuinely cannot tell it is AI-generated. A score of 5 means obvious AI.\n\n"
    "You return ONLY valid JSON. No markdown. No commentary outside the JSON."
)


def build_image_realism_prompt(
    actor_data: dict,
    image_description: str | None = None,
) -> str:
    """Build the VQA evaluation prompt with the full 10-dimension rubric.

    Parameters
    ----------
    actor_data:
        The actor identity card (face_lock, prompt_seed, etc.) for
        cross-referencing expected appearance.
    image_description:
        Optional text description of what the image should contain.
        When using a VLM, the image is passed as a visual input alongside
        this text prompt.
    """
    # Build dimension rubric
    rubric_lines: list[str] = []
    for dim_key, dim in IMAGE_REALISM_DIMENSIONS.items():
        rubric_lines.append(
            f"\n### {dim_key.upper()} (weight={dim['weight']}, min={dim['min_score']})"
        )
        rubric_lines.append(f"Question: {dim['description']}")

        # Auto-reject triggers
        triggers = dim.get("auto_reject_triggers", [])
        if triggers:
            rubric_lines.append(f"AUTO-REJECT if any of these detected: {', '.join(triggers)}")

        # Scoring guide
        for band, desc in dim.get("scoring_guide", {}).items():
            rubric_lines.append(f"  {band}: {desc}")

    rubric_block = "\n".join(rubric_lines)

    # Actor identity for cross-reference
    face_lock = actor_data.get("face_lock", {})
    actor_block = f"""
EXPECTED ACTOR IDENTITY (for reference only — realism is the primary concern):
- Name: {actor_data.get("name", "unknown")}
- Skin tone: {face_lock.get("skin_tone_hex", "?")}
- Eye color: {face_lock.get("eye_color", "?")}
- Hair: {face_lock.get("hair", "?")}
- Age range: {face_lock.get("age_range", "20-35")}
- Distinguishing marks: {face_lock.get("distinguishing_marks", "none")}
"""

    image_context = ""
    if image_description:
        image_context = f"\nIMAGE DESCRIPTION/CONTEXT:\n{image_description}\n"

    return f"""FORENSIC IMAGE REALISM EVALUATION

You are evaluating whether this image could pass as a REAL photograph taken
by a real person with a real phone (iPhone 15 Pro quality). This is for a
recruitment ad campaign — the image MUST look authentic, not AI-generated.
{actor_block}
{image_context}
=== 10-DIMENSION REALISM RUBRIC ===
{rubric_block}

=== HARD GATES ===
- Overall weighted score must be >= {MIN_ACCEPT_SCORE} to accept (STRICT)
- Every dimension must score >= its min_score
- anatomical_correctness must score >= {ANATOMICAL_MIN} (extra fingers = campaign killer)
- ANY auto-reject trigger detected = that dimension scores 0 automatically

=== INSTRUCTIONS ===
1. Examine the image systematically across all 10 dimensions.
2. For each dimension, first check for auto-reject triggers.
3. If ANY auto-reject trigger is detected, that dimension MUST score 0.
4. Score remaining dimensions 0-10 using the scoring guide.
5. Be HARSH. Most AI images should score 4-6. Only exceptional images score 8+.
6. For anatomical_correctness: COUNT THE FINGERS. Check every visible hand.

Return ONLY valid JSON:
{{
  "dimensions": {{
    "skin_texture": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "hair_realism": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "facial_asymmetry": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "lighting_imperfections": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "fabric_texture": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "background_authenticity": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "body_pose_naturalism": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "camera_artifacts": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "environmental_objects": {{"score": 0, "feedback": "...", "auto_reject_triggered": false}},
    "anatomical_correctness": {{"score": 0, "feedback": "...", "auto_reject_triggered": false, "finger_count_left": 5, "finger_count_right": 5}}
  }},
  "ai_telltales_detected": ["List specific AI artifacts found, or empty if none"],
  "strongest_realism_signals": ["List what makes this look most real, or empty"],
  "evaluator_confidence": "high | medium | low (how confident you are in your assessment)"
}}"""


# =========================================================================
# Scoring engine
# =========================================================================

def score_image_realism(eval_response: dict) -> dict[str, Any]:
    """Score with auto-reject triggers. Any AI tell-tale = dimension score 0.

    Parameters
    ----------
    eval_response:
        Parsed JSON from the VLM evaluation.

    Returns
    -------
    dict
        Standardized result with verdict, scores, and feedback.
    """
    dimensions = eval_response.get("dimensions", {})
    ai_telltales = eval_response.get("ai_telltales_detected", [])
    realism_signals = eval_response.get("strongest_realism_signals", [])
    confidence = eval_response.get("evaluator_confidence", "medium")

    # Calculate weighted score with auto-reject enforcement
    weighted_score = 0.0
    dimension_scores: dict[str, dict[str, Any]] = {}
    hard_gate_failures: list[str] = []
    auto_reject_count = 0

    for dim_key, dim_config in IMAGE_REALISM_DIMENSIONS.items():
        dim_data = dimensions.get(dim_key, {})
        raw_score = dim_data.get("score", 0)
        auto_rejected = dim_data.get("auto_reject_triggered", False)
        feedback = dim_data.get("feedback", "")

        # Enforce auto-reject: if triggered, score is 0 regardless
        if auto_rejected:
            score = 0
            auto_reject_count += 1
            feedback = f"[AUTO-REJECT] {feedback}"
        else:
            score = max(0, min(10, int(raw_score)))

        weighted_contribution = score * dim_config["weight"]
        weighted_score += weighted_contribution

        min_required = dim_config["min_score"]
        # Anatomical correctness has a higher minimum
        if dim_key == "anatomical_correctness":
            min_required = ANATOMICAL_MIN

        dimension_scores[dim_key] = {
            "score": score,
            "weight": dim_config["weight"],
            "weighted_contribution": round(weighted_contribution, 3),
            "min_required": min_required,
            "passed": score >= min_required,
            "auto_rejected": auto_rejected,
            "feedback": feedback,
        }

        # Check hard gate
        if score < min_required:
            hard_gate_failures.append(
                f"{dim_key}: scored {score}, minimum required {min_required}"
                + (" [AUTO-REJECT]" if auto_rejected else "")
            )

    weighted_score = round(weighted_score, 2)

    # Special check: anatomical correctness
    anat_score = dimensions.get("anatomical_correctness", {}).get("score", 0)
    anat_rejected = dimensions.get("anatomical_correctness", {}).get("auto_reject_triggered", False)
    if anat_rejected:
        anat_score = 0

    # Determine verdict
    if auto_reject_count > 0 or anat_score < ANATOMICAL_MIN:
        # Any auto-reject trigger or anatomical failure = reject
        verdict = "reject"
        if anat_score < ANATOMICAL_MIN:
            hard_gate_failures.insert(
                0,
                f"ANATOMICAL GATE: score {anat_score} < {ANATOMICAL_MIN} required",
            )
    elif weighted_score >= MIN_ACCEPT_SCORE and not hard_gate_failures:
        verdict = "accept"
    elif weighted_score < 5.0 or any(
        dimension_scores[k]["score"] < 4 for k in IMAGE_REALISM_DIMENSIONS
    ):
        verdict = "reject"
    else:
        verdict = "revise"

    # Build regeneration guidance
    regeneration_hints: list[str] = []
    if verdict != "accept":
        for dim_key in IMAGE_REALISM_DIMENSIONS:
            ds = dimension_scores.get(dim_key, {})
            if not ds.get("passed", True):
                hint = ds.get("feedback", "")
                if ds.get("auto_rejected"):
                    hint = f"CRITICAL: {hint} — auto-reject trigger fired"
                regeneration_hints.append(f"[{dim_key}] {hint}")

    # Legacy compatibility: overall_score on 0-1 scale
    overall_score_normalized = round(weighted_score / 10.0, 3)

    return {
        "verdict": verdict,
        "overall_score": overall_score_normalized,
        "weighted_score": weighted_score,
        "dimension_scores": dimension_scores,
        "hard_gate_failures": hard_gate_failures,
        "auto_reject_count": auto_reject_count,
        "ai_telltales_detected": ai_telltales,
        "strongest_realism_signals": realism_signals,
        "evaluator_confidence": confidence,
        "regeneration_hints": regeneration_hints,
    }
