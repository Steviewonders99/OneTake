"""Kling 3.0 Director Controls — camera language, multishot prompting, reference management.

Based on the Kling Master guide: the prompting formula is
[CAMERA] + [SUBJECT] + [ACTION] + [ENVIRONMENT] + [LIGHTING] + [TEXTURE] + [AUDIO]

Key rules:
- Lip sync breaks after 10 seconds — front-load ALL dialogue before 10s
- 2-3 max references for consistency (more = glitching)
- Provide 3 angles (front, side, back) for character consistency
- Start/End frames give most control (image-to-video)
- Multishot: up to 6 shots in 15 seconds, NOT available with both start AND end frame
- Movement carries across shots (leaning forward end of shot 1 -> remembered in shot 2)
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Camera vocabulary that Kling 3.0 understands
# ---------------------------------------------------------------------------

CAMERA_MOVES: dict[str, str] = {
    "static": "locked camera, no movement",
    "push_in": "slow push in towards subject",
    "pull_back": "slow pull back from subject, revealing environment",
    "tracking": "medium tracking shot following subject",
    "orbit_360": "deliberate 360 degree orbit around subject",
    "pan_left": "smooth pan left revealing scene",
    "pan_right": "smooth pan right revealing scene",
    "tilt_up": "camera tilts up from ground to subject face",
    "tilt_down": "camera tilts down from face to hands/device",
    "handheld": "subtle handheld shake, documentary feel",
    "dolly_zoom": "dolly zoom creating vertigo effect",
    "whip_pan": "fast whip pan to new subject/angle",
    "crane_up": "crane shot rising above subject",
    "low_angle": "dramatic low angle framing, looking up at subject",
    "high_angle": "overhead/high angle looking down at subject",
    "over_shoulder": "over the shoulder close-up",
    "two_shot": "wide two shot of two people",
    "close_up": "tight close-up on face",
    "extreme_close_up": "extreme close-up on eyes/hands/device screen",
    "wide_establishing": "wide establishing shot showing full environment",
}

# ---------------------------------------------------------------------------
# Scene transition vocabulary
# ---------------------------------------------------------------------------

TRANSITIONS: dict[str, str] = {
    "hard_cut": "hard cut",
    "match_cut": "match cut on action",
    "smash_cut": "smash cut (abrupt contrast)",
    "whip_transition": "whip pan transition to next scene",
    "fade": "fade transition",
    "continuous": "one continuous take, no cut",
}

# ---------------------------------------------------------------------------
# Lighting presets for different moods
# ---------------------------------------------------------------------------

LIGHTING_PRESETS: dict[str, str] = {
    "natural_morning": "warm golden hour morning light, soft shadows, window light streaming in",
    "natural_afternoon": "bright natural daylight, even illumination, minimal shadows",
    "golden_hour": "warm golden sunset light, long shadows, orange-amber tones",
    "indoor_warm": "warm indoor lighting, table lamp glow, cozy ambient light",
    "indoor_cool": "cool fluorescent office lighting, even and flat",
    "cafe_ambient": "soft warm cafe lighting, hanging pendant lights, bokeh glow from windows",
    "ring_light": "front-facing ring light, catchlights in eyes, even face illumination, slight shadow behind",
    "dramatic_side": "strong side lighting, half the face illuminated, cinematic contrast",
    "overcast_soft": "overcast sky diffused light, no harsh shadows, soft and even",
    "neon_night": "colorful neon reflections, urban night lighting, blue and pink tones",
}

# ---------------------------------------------------------------------------
# Texture / film look presets
# ---------------------------------------------------------------------------

TEXTURE_PRESETS: dict[str, str] = {
    "iphone_ugc": "iPhone 15 Pro quality, slight lens flare, natural skin texture, no beauty filter",
    "cinematic": "anamorphic lens, film grain, shallow depth of field, cinematic color grade",
    "documentary": "handheld documentary feel, slight motion blur, raw and authentic",
    "clean_corporate": "clean sharp 4K, professional color grade, slight vignette",
    "vintage_film": "Super 8 film look, warm tones, heavy grain, light leaks",
    "tiktok_native": "vertical smartphone capture, native TikTok look, bright and punchy colors",
}

# ---------------------------------------------------------------------------
# Kling-specific constraints
# ---------------------------------------------------------------------------

KLING_CONSTRAINTS: dict[str, int | float] = {
    "max_duration_s": 15,
    "max_shots": 6,
    "max_references": 7,
    "recommended_references": 3,  # 2-3 for best consistency
    "lip_sync_safe_s": 10,  # Lip sync breaks after 10s
    "min_shot_duration_s": 2,
    "character_angles_needed": 3,  # front, side, back
}


def build_kling_prompt(
    scene: dict,
    actor_references: list[str],
    environment_reference: str | None = None,
) -> str:
    """Build a Kling 3.0 prompt for a single scene.

    Follows the Kling formula:
    [CAMERA] + [SUBJECT] + [ACTION] + [ENVIRONMENT] + [LIGHTING] + [TEXTURE]

    Parameters
    ----------
    scene:
        A scene dict containing at minimum: ``camera``, ``action``,
        ``duration_s``, and optionally ``dialogue``, ``text_overlay``,
        ``lighting``, ``texture``, ``environment``, ``acting_direction``.
    actor_references:
        List of reference image URLs/paths (max 3 recommended).
    environment_reference:
        Optional environment/background reference image.

    Returns
    -------
    str
        A formatted prompt string for the Kling 3.0 API.
    """
    camera_key = scene.get("camera", "static")
    camera_desc = CAMERA_MOVES.get(camera_key, CAMERA_MOVES["static"])

    action = scene.get("action", "person looking at camera")
    acting_direction = scene.get("acting_direction", "")
    dialogue = scene.get("dialogue", "")
    environment = scene.get("environment", "modern home interior, clean and bright")
    lighting = scene.get("lighting", "natural_afternoon")
    texture = scene.get("texture", "iphone_ugc")

    # Auto-add handheld camera shake for high-intensity/mobile scenes
    # Makes it feel like real UGC filmed on a phone (car, walking, outdoor)
    high_intensity_keywords = ["car", "walking", "running", "street", "outdoor", "moving", "rushing", "commuting"]
    env_lower = environment.lower() + " " + action.lower()
    if any(kw in env_lower for kw in high_intensity_keywords):
        camera_desc += ", subtle handheld shake from phone movement, slight motion blur"
        texture = "iphone_ugc"  # Force UGC texture for mobile scenes

    # Resolve lighting and texture from presets
    lighting_desc = LIGHTING_PRESETS.get(lighting, lighting)
    texture_desc = TEXTURE_PRESETS.get(texture, texture)

    # Build subject description from references
    ref_count = min(len(actor_references), KLING_CONSTRAINTS["recommended_references"])
    subject_note = ""
    if ref_count > 0:
        subject_note = "[SUBJECT matches reference character — maintain consistent face, hair, build across all shots]"

    # Build the Kling prompt in the correct formula order
    parts: list[str] = []

    # CAMERA
    parts.append(f"[CAMERA: {camera_desc}]")

    # SUBJECT + ACTION
    if subject_note:
        parts.append(subject_note)
    if acting_direction:
        parts.append(f"[ACTION: {action} — ({acting_direction})]")
    else:
        parts.append(f"[ACTION: {action}]")

    # DIALOGUE (only if within lip sync safe zone — caller must verify)
    if dialogue:
        parts.append(f'[DIALOGUE: "{dialogue}"]')

    # ENVIRONMENT
    if environment_reference:
        parts.append(f"[ENVIRONMENT: {environment} — matches environment reference]")
    else:
        parts.append(f"[ENVIRONMENT: {environment}]")

    # LIGHTING
    parts.append(f"[LIGHTING: {lighting_desc}]")

    # TEXTURE
    parts.append(f"[TEXTURE: {texture_desc}]")

    return "\n".join(parts)


def build_multishot_prompt(
    scenes: list[dict],
    actor_references: list[str],
    environment_reference: str | None = None,
) -> dict[str, Any]:
    """Build a Kling 3.0 multishot prompt for up to 6 scenes in 15 seconds.

    Validates all constraints before building the prompt. Movement carries
    across shots automatically (Kling remembers body position from previous shot).

    Parameters
    ----------
    scenes:
        List of scene dicts (max 6). Each must have ``camera``, ``action``,
        ``duration_s``, and optionally ``dialogue``, ``label``, etc.
    actor_references:
        Reference image URLs (max 3 recommended for consistency).
    environment_reference:
        Optional environment reference image URL.

    Returns
    -------
    dict
        Contains ``prompt`` (str), ``shots`` (list), ``total_duration_s`` (int),
        ``reference_urls`` (list), ``warnings`` (list).

    Raises
    ------
    ValueError
        If scenes violate Kling constraints (too many shots, too long, etc.).
    """
    warnings: list[str] = []

    # Validate constraints
    if len(scenes) > KLING_CONSTRAINTS["max_shots"]:
        raise ValueError(
            f"Kling multishot supports max {KLING_CONSTRAINTS['max_shots']} shots, "
            f"got {len(scenes)}"
        )

    total_duration = sum(s.get("duration_s", 2) for s in scenes)
    if total_duration > KLING_CONSTRAINTS["max_duration_s"]:
        raise ValueError(
            f"Total duration {total_duration}s exceeds Kling max "
            f"{KLING_CONSTRAINTS['max_duration_s']}s"
        )

    # Check each shot meets minimum duration
    for i, scene in enumerate(scenes):
        dur = scene.get("duration_s", 2)
        if dur < KLING_CONSTRAINTS["min_shot_duration_s"]:
            raise ValueError(
                f"Shot {i + 1} is {dur}s — minimum is "
                f"{KLING_CONSTRAINTS['min_shot_duration_s']}s"
            )

    # Check lip sync constraint: all dialogue must end before 10s mark
    cumulative_s = 0
    for i, scene in enumerate(scenes):
        cumulative_s += scene.get("duration_s", 2)
        if scene.get("dialogue") and cumulative_s > KLING_CONSTRAINTS["lip_sync_safe_s"]:
            warnings.append(
                f"Shot {i + 1} has dialogue at {cumulative_s}s — lip sync may "
                f"break after {KLING_CONSTRAINTS['lip_sync_safe_s']}s. Consider "
                f"moving dialogue earlier or using text overlay instead."
            )

    # Trim references to recommended count
    trimmed_refs = actor_references[:KLING_CONSTRAINTS["recommended_references"]]
    if len(actor_references) > KLING_CONSTRAINTS["recommended_references"]:
        warnings.append(
            f"Reduced references from {len(actor_references)} to "
            f"{KLING_CONSTRAINTS['recommended_references']} for consistency. "
            f"More references = more glitching."
        )

    # Build the multishot prompt
    prompt_parts: list[str] = []

    # Global header
    prompt_parts.append(
        "MULTISHOT VIDEO — Maintain character consistency across all shots. "
        "Movement and body position carry from one shot to the next."
    )
    prompt_parts.append("")

    # Reference instructions
    if trimmed_refs:
        prompt_parts.append(
            f"CHARACTER REFERENCE: Use the {len(trimmed_refs)} provided reference "
            f"image(s) for face, hair, and body consistency. The character must "
            f"look like the SAME person in every shot."
        )
        prompt_parts.append("")

    if environment_reference:
        prompt_parts.append(
            "ENVIRONMENT REFERENCE: Use the provided environment image as the "
            "base setting. Maintain visual continuity across all shots."
        )
        prompt_parts.append("")

    # Build each shot
    shot_data: list[dict[str, Any]] = []
    cumulative_s = 0
    previous_end_action = ""

    for i, scene in enumerate(scenes):
        shot_num = i + 1
        duration = scene.get("duration_s", 2)
        cumulative_s += duration

        # Build individual shot prompt
        shot_prompt = build_kling_prompt(scene, trimmed_refs, environment_reference)

        # Add continuity note from previous shot
        continuity_note = ""
        if previous_end_action:
            continuity_note = (
                f"[CONTINUITY: Character enters this shot from previous position — "
                f"{previous_end_action}]"
            )

        # Determine transition from previous shot
        transition = scene.get("transition", "hard_cut")
        transition_desc = TRANSITIONS.get(transition, TRANSITIONS["hard_cut"])

        # Build the shot block
        shot_block_parts = [
            f"--- SHOT {shot_num} ({duration}s | {cumulative_s - duration}s-{cumulative_s}s) ---",
        ]
        if i > 0:
            shot_block_parts.append(f"[TRANSITION: {transition_desc}]")
        if continuity_note:
            shot_block_parts.append(continuity_note)
        shot_block_parts.append(shot_prompt)

        prompt_parts.append("\n".join(shot_block_parts))
        prompt_parts.append("")

        # Track for continuity
        previous_end_action = scene.get("acting_direction", scene.get("action", ""))

        shot_data.append({
            "shot_num": shot_num,
            "duration_s": duration,
            "start_s": cumulative_s - duration,
            "end_s": cumulative_s,
            "camera": scene.get("camera", "static"),
            "has_dialogue": bool(scene.get("dialogue")),
            "transition": transition_desc if i > 0 else "none",
        })

    full_prompt = "\n".join(prompt_parts)

    # Collect reference URLs
    reference_urls = list(trimmed_refs)
    if environment_reference:
        reference_urls.append(environment_reference)

    return {
        "prompt": full_prompt,
        "shots": shot_data,
        "total_duration_s": total_duration,
        "reference_urls": reference_urls,
        "warnings": warnings,
    }


def build_character_reference_set(actor_data: dict) -> list[dict[str, str]]:
    """Generate 3-angle character reference set for Kling consistency.

    Returns prompts for generating front, side, and back views of the actor
    using Seedream 4.5, which then serve as Kling references.

    Parameters
    ----------
    actor_data:
        The actor identity dict containing ``face_lock``, ``prompt_seed``,
        ``signature_accessory``, and optional ``outfit_variations``.

    Returns
    -------
    list[dict]
        Three dicts, each with ``angle`` (str), ``prompt`` (str), and
        ``dimension_key`` (str) for Seedream generation.
    """
    face_lock = actor_data.get("face_lock", {})
    name = actor_data.get("name", "contributor")
    prompt_seed = actor_data.get("prompt_seed", "")
    accessory = actor_data.get("signature_accessory", "")

    # Build the base character description from the face lock
    face_parts: list[str] = []
    if face_lock.get("ethnicity"):
        face_parts.append(face_lock["ethnicity"])
    if face_lock.get("age_apparent"):
        face_parts.append(f"approximately {face_lock['age_apparent']} years old")
    if face_lock.get("face_shape"):
        face_parts.append(f"{face_lock['face_shape']} face shape")
    if face_lock.get("hair"):
        face_parts.append(face_lock["hair"])
    if face_lock.get("distinguishing_features"):
        features = face_lock["distinguishing_features"]
        if isinstance(features, list):
            face_parts.append(", ".join(features))
        else:
            face_parts.append(str(features))

    face_description = ", ".join(face_parts) if face_parts else prompt_seed

    # Get outfit — default to at_home_working
    outfits = actor_data.get("outfit_variations", {})
    outfit_desc = outfits.get(
        "at_home_working",
        outfits.get(next(iter(outfits), ""), "casual comfortable clothing"),
    )
    if isinstance(outfit_desc, dict):
        outfit_desc = outfit_desc.get("description", "casual comfortable clothing")

    accessory_note = f", wearing {accessory}" if accessory else ""

    # Build prompts for three angles
    base_prompt = (
        f"Photorealistic portrait of {face_description}, "
        f"wearing {outfit_desc}{accessory_note}. "
        f"Plain neutral gray studio background. "
        f"Professional reference photo, sharp focus, even studio lighting, "
        f"no shadows on background. "
        f"Natural skin texture, no beauty filter, no AI gloss."
    )

    angles = [
        {
            "angle": "front",
            "prompt": (
                f"{base_prompt} "
                f"FRONT VIEW — facing camera directly, straight on, neutral expression "
                f"with slight natural smile, both ears visible, shoulders square to camera."
            ),
            "dimension_key": "square",
        },
        {
            "angle": "side",
            "prompt": (
                f"{base_prompt} "
                f"THREE-QUARTER SIDE VIEW — turned 45 degrees to the right, "
                f"one ear visible, jawline defined, natural relaxed posture, "
                f"looking slightly toward camera."
            ),
            "dimension_key": "square",
        },
        {
            "angle": "back",
            "prompt": (
                f"{base_prompt} "
                f"BACK THREE-QUARTER VIEW — turned approximately 135 degrees away "
                f"from camera, back of head and one ear visible, slight head turn "
                f"showing jawline profile, hair texture visible, shoulders relaxed."
            ),
            "dimension_key": "square",
        },
    ]

    return angles


def build_character_grid_prompts(actor_data: dict) -> list[dict[str, str]]:
    """Generate 9-angle character reference prompts for a Higgsfield-style grid.

    Returns 9 Seedream prompts that, when generated and stitched into a 3x3 grid,
    give Kling 3.0 maximum character consistency from a SINGLE reference image.

    Grid layout:
    [front_face    ] [3/4_right     ] [side_right    ]
    [close_up_face ] [eye_detail    ] [full_body_front]
    [3/4_left      ] [back_view     ] [full_body_back ]
    """
    face_lock = actor_data.get("face_lock", {})
    prompt_seed = actor_data.get("prompt_seed", "")
    accessory = actor_data.get("signature_accessory", "")

    # Build face description
    face_parts = []
    for key in ["skin_tone_hex", "eye_color", "jawline", "hair", "nose_shape", "distinguishing_marks", "age_range"]:
        val = face_lock.get(key, "")
        if val:
            face_parts.append(str(val))
    face_desc = ", ".join(face_parts) if face_parts else prompt_seed

    outfits = actor_data.get("outfit_variations", {})
    outfit = outfits.get("at_home_working", next(iter(outfits.values()), "casual clothes")) if outfits else "casual clothes"
    if isinstance(outfit, dict):
        outfit = outfit.get("description", "casual clothes")
    acc = f", wearing {accessory}" if accessory else ""

    base = (
        f"Photorealistic portrait of a person: {face_desc}, "
        f"wearing {outfit}{acc}. "
        f"Plain neutral gray studio background. "
        f"Professional reference photo, sharp focus, even studio lighting. "
        f"Natural skin texture, visible pores, no beauty filter."
    )

    return [
        {"angle": "front_face", "prompt": f"{base} FRONT VIEW — facing camera directly, neutral expression, both ears visible, shoulders square.", "row": 0, "col": 0},
        {"angle": "3q_right", "prompt": f"{base} THREE-QUARTER RIGHT — turned 45° right, jawline visible, one ear showing, relaxed.", "row": 0, "col": 1},
        {"angle": "side_right", "prompt": f"{base} RIGHT PROFILE — turned 90° right, full side profile, ear visible, nose bridge defined.", "row": 0, "col": 2},
        {"angle": "close_up", "prompt": f"{base} EXTREME CLOSE-UP — face fills entire frame, eyes sharp, skin pores visible, slight smile.", "row": 1, "col": 0},
        {"angle": "eye_detail", "prompt": f"{base} CLOSE-UP EYES — upper face only, eyes and eyebrows in sharp focus, natural eye color.", "row": 1, "col": 1},
        {"angle": "full_front", "prompt": f"{base} FULL BODY FRONT — head to toe, standing relaxed, arms at sides, centered in frame.", "row": 1, "col": 2},
        {"angle": "3q_left", "prompt": f"{base} THREE-QUARTER LEFT — turned 45° left, opposite jawline visible, natural posture.", "row": 2, "col": 0},
        {"angle": "back_view", "prompt": f"{base} BACK VIEW — turned 180° away, back of head and shoulders, hair texture visible.", "row": 2, "col": 1},
        {"angle": "full_back", "prompt": f"{base} FULL BODY BACK — head to toe from behind, standing, posture and build visible.", "row": 2, "col": 2},
    ]


async def generate_character_grid(
    actor_data: dict,
    request_id: str,
) -> str:
    """Generate a 3x3 character reference grid image.

    1. Generates 9 angle images via Seedream
    2. Stitches into a 3x3 grid using Pillow
    3. Uploads to Vercel Blob
    4. Returns the grid image URL

    This single grid image is used as Kling's reference for maximum
    character consistency — same concept as Higgsfield's character sheets.
    """
    import io
    import uuid

    from ai.deglosser import degloss
    from ai.seedream import generate_image
    from blob_uploader import upload_to_blob
    from PIL import Image

    angle_prompts = build_character_grid_prompts(actor_data)

    # Generate all 9 angles with anti-AI deglosser applied
    cell_size = 512  # Each cell in the grid
    grid = Image.new("RGB", (cell_size * 3, cell_size * 3), (128, 128, 128))

    for angle_data in angle_prompts:
        try:
            raw_bytes = await generate_image(
                angle_data["prompt"],
                dimension_key="square",
            )
            # Apply anti-AI deglosser — Kling references must look real
            img_bytes = degloss(raw_bytes, intensity="medium")
            img = Image.open(io.BytesIO(img_bytes)).resize(
                (cell_size, cell_size), Image.Resampling.LANCZOS
            )
            x = angle_data["col"] * cell_size
            y = angle_data["row"] * cell_size
            grid.paste(img, (x, y))
            logger.info("Grid angle '%s' generated", angle_data["angle"])
        except Exception as e:
            logger.warning("Grid angle '%s' failed: %s — using gray placeholder", angle_data["angle"], e)

    # Export grid as PNG
    buf = io.BytesIO()
    grid.save(buf, format="PNG")
    grid_bytes = buf.getvalue()

    # Upload to Blob
    actor_id = str(actor_data.get("id", "unknown"))
    filename = f"char_grid_{actor_id}_{uuid.uuid4().hex[:8]}.png"
    grid_url = await upload_to_blob(
        grid_bytes, filename,
        folder=f"requests/{request_id}/grids",
    )
    logger.info(
        "Character grid generated: 9 angles, %dKB, url=%s",
        len(grid_bytes) // 1024, grid_url[:60],
    )
    return grid_url


def validate_script_for_kling(script: dict) -> dict[str, Any]:
    """Validate a video script against Kling constraints.

    Checks:
    - Total duration <= 15s
    - All dialogue scenes before 10s mark
    - Max 6 shots
    - Each shot >= 2s
    - Camera directions use Kling vocabulary

    Parameters
    ----------
    script:
        A parsed video script dict with ``scenes`` and
        ``estimated_duration_s``.

    Returns
    -------
    dict
        Contains ``valid`` (bool), ``errors`` (list[str]),
        ``warnings`` (list[str]), ``adjustments`` (list[dict]).
        ``adjustments`` contains suggested fixes for invalid scripts.
    """
    errors: list[str] = []
    warnings: list[str] = []
    adjustments: list[dict[str, Any]] = []

    scenes = script.get("scenes", [])
    estimated_duration = script.get("estimated_duration_s", 0)

    # Check total duration
    total_from_scenes = sum(s.get("duration_s", 0) for s in scenes)
    effective_duration = total_from_scenes or estimated_duration

    if effective_duration > KLING_CONSTRAINTS["max_duration_s"]:
        errors.append(
            f"Total duration {effective_duration}s exceeds max "
            f"{KLING_CONSTRAINTS['max_duration_s']}s"
        )
        # Suggest proportional trimming
        scale_factor = KLING_CONSTRAINTS["max_duration_s"] / effective_duration
        for i, scene in enumerate(scenes):
            original = scene.get("duration_s", 2)
            adjusted = max(KLING_CONSTRAINTS["min_shot_duration_s"], round(original * scale_factor))
            if adjusted != original:
                adjustments.append({
                    "scene": i + 1,
                    "field": "duration_s",
                    "original": original,
                    "suggested": adjusted,
                    "reason": "Proportionally trimmed to fit 15s limit",
                })

    # Check number of shots
    if len(scenes) > KLING_CONSTRAINTS["max_shots"]:
        errors.append(
            f"{len(scenes)} shots exceeds max {KLING_CONSTRAINTS['max_shots']}. "
            f"Merge similar scenes or remove the weakest shot."
        )

    # Check minimum shot duration and camera vocabulary
    cumulative_s = 0
    last_dialogue_s = 0

    for i, scene in enumerate(scenes):
        duration = scene.get("duration_s", 0)
        cumulative_s += duration

        # Minimum duration check
        if duration < KLING_CONSTRAINTS["min_shot_duration_s"]:
            errors.append(
                f"Scene {i + 1} is {duration}s — minimum is "
                f"{KLING_CONSTRAINTS['min_shot_duration_s']}s"
            )
            adjustments.append({
                "scene": i + 1,
                "field": "duration_s",
                "original": duration,
                "suggested": KLING_CONSTRAINTS["min_shot_duration_s"],
                "reason": "Below minimum shot duration",
            })

        # Camera vocabulary check
        camera = scene.get("camera", "")
        if camera and camera not in CAMERA_MOVES:
            warnings.append(
                f"Scene {i + 1} uses camera '{camera}' which is not in Kling "
                f"vocabulary. Closest match: {_find_closest_camera(camera)}"
            )

        # Lip sync timing check
        dialogue = scene.get("dialogue", "")
        if dialogue and dialogue.strip():
            last_dialogue_s = cumulative_s
            if cumulative_s > KLING_CONSTRAINTS["lip_sync_safe_s"]:
                errors.append(
                    f"Scene {i + 1} has dialogue ending at {cumulative_s}s — "
                    f"lip sync breaks after {KLING_CONSTRAINTS['lip_sync_safe_s']}s. "
                    f"Move dialogue to an earlier scene or replace with text overlay."
                )
                adjustments.append({
                    "scene": i + 1,
                    "field": "dialogue",
                    "original": dialogue,
                    "suggested": "",
                    "reason": "Move to text_overlay — lip sync unsafe at this timecode",
                    "alternative_field": "text_overlay",
                    "alternative_value": dialogue[:40],
                })

    # Check dialogue_ends_at_s field if present
    declared_dialogue_end = script.get("dialogue_ends_at_s", 0)
    if declared_dialogue_end > KLING_CONSTRAINTS["lip_sync_safe_s"]:
        warnings.append(
            f"Script declares dialogue ending at {declared_dialogue_end}s — "
            f"lip sync is only reliable up to {KLING_CONSTRAINTS['lip_sync_safe_s']}s"
        )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "adjustments": adjustments,
        "stats": {
            "total_duration_s": effective_duration,
            "num_shots": len(scenes),
            "last_dialogue_s": last_dialogue_s,
            "lip_sync_safe": last_dialogue_s <= KLING_CONSTRAINTS["lip_sync_safe_s"],
        },
    }


def _find_closest_camera(camera_key: str) -> str:
    """Find the closest matching Kling camera move for an unrecognized key."""
    key_lower = camera_key.lower().replace("-", "_").replace(" ", "_")

    # Direct match after normalisation
    if key_lower in CAMERA_MOVES:
        return key_lower

    # Substring match
    for known_key in CAMERA_MOVES:
        if key_lower in known_key or known_key in key_lower:
            return known_key

    # Keyword-based fallback
    keyword_map = {
        "zoom": "push_in",
        "dolly": "push_in",
        "pull": "pull_back",
        "track": "tracking",
        "orbit": "orbit_360",
        "pan": "pan_left",
        "tilt": "tilt_up",
        "shake": "handheld",
        "whip": "whip_pan",
        "crane": "crane_up",
        "low": "low_angle",
        "high": "high_angle",
        "shoulder": "over_shoulder",
        "closeup": "close_up",
        "macro": "extreme_close_up",
        "wide": "wide_establishing",
        "establish": "wide_establishing",
    }
    for keyword, match in keyword_map.items():
        if keyword in key_lower:
            return match

    return "static"
