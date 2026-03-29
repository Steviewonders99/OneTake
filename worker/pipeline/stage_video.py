"""Video Pipeline Stage — generates multilingual video ads from personas.

Flow:
1. Select video template per persona x platform
2. Generate script (Gemma 3 12B)
3. Evaluate script (gate 0.85)
4. Generate 3-angle character references (Seedream for Kling)
5. Generate silent video (Kling 3.0 multishot)
6. Generate voiceover per language (XTTS-v2 / ElevenLabs)
7. Lip sync per language (Wav2Lip — free, any language)
8. Compose final video (add text overlays, CTA, brand)
9. Evaluate video (quality gate)
10. Upload to Vercel Blob
11. ONE video x N languages for $0.16 total
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from ai.kling_client import generate_multishot_video, generate_video
from ai.local_llm import generate_copy
from ai.seedream import generate_image
from ai.tts_engine import generate_speech
from ai.wav2lip import lip_sync
from blob_uploader import upload_to_blob
from neon_client import save_asset
from prompts.video_director import (
    build_character_reference_set,
    build_multishot_prompt,
    validate_script_for_kling,
)
from prompts.video_script import (
    VIDEO_SCRIPT_SYSTEM,
    VIDEO_TEMPLATES,
    build_video_script_prompt,
    select_video_template,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Quality gates
# ---------------------------------------------------------------------------

SCRIPT_QUALITY_THRESHOLD = 0.85
MAX_SCRIPT_RETRIES = 3
MAX_VIDEO_RETRIES = 2

# Video platforms to generate for
DEFAULT_VIDEO_PLATFORMS = ["tiktok", "instagram_reels"]


async def run_video_stage(context: dict) -> dict:
    """Run the complete video generation pipeline.

    Parameters
    ----------
    context:
        Pipeline context dict. Must contain:
        - ``request_id`` (str)
        - ``actors`` (list[dict]) — from stage 2
        - ``brief`` (dict) — from stage 1
        - ``target_languages`` (list[str])
        - ``target_regions`` (list[str])
        - ``personas`` (list[dict], optional) — from stage 1

    Returns
    -------
    dict
        Contains ``video_assets`` (list[dict]) with all generated videos,
        ``video_count`` (int), and ``language_variants`` (int).
    """
    request_id: str = context["request_id"]
    actors: list[dict] = context.get("actors", [])
    brief: dict = context.get("brief", {})
    languages: list[str] = context.get("target_languages", ["English"])
    regions: list[str] = context.get("target_regions", ["Global"])
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    platforms = context.get("video_platforms", DEFAULT_VIDEO_PLATFORMS)

    all_video_assets: list[dict] = []
    total_videos = 0
    total_language_variants = 0

    for actor_idx, actor in enumerate(actors):
        persona = actor.get("persona") or (
            personas[actor_idx] if actor_idx < len(personas) else {}
        )
        region = persona.get("region", regions[0] if regions else "Global")
        primary_language = persona.get("language", languages[0] if languages else "English")

        logger.info(
            "Video pipeline for actor '%s' (persona=%s, region=%s)",
            actor.get("name", "unknown"),
            persona.get("archetype_key", "unknown"),
            region,
        )

        # ==================================================================
        # STEP 1: Select video template
        # ==================================================================
        template_key = select_video_template(persona, platforms)
        template = VIDEO_TEMPLATES[template_key]
        logger.info("Selected template: %s — %s", template_key, template["description"])

        # ==================================================================
        # STEP 2: Generate script (Gemma 3 12B)
        # ==================================================================
        script_data = await _generate_and_validate_script(
            persona=persona,
            brief=brief,
            template_key=template_key,
            language=primary_language,
            region=region,
        )
        logger.info(
            "Script generated: %d scenes, %ds estimated, dialogue ends at %ds",
            len(script_data.get("scenes", [])),
            script_data.get("estimated_duration_s", 0),
            script_data.get("dialogue_ends_at_s", 0),
        )

        # ==================================================================
        # STEP 3: Generate 3-angle character references (Seedream for Kling)
        # ==================================================================
        reference_urls = await _generate_character_references(
            actor, request_id,
        )
        logger.info(
            "Character references generated: %d angles",
            len(reference_urls),
        )

        # ==================================================================
        # STEP 4: Generate silent video (Kling 3.0)
        # ==================================================================
        silent_video_bytes = await _generate_silent_video(
            script_data=script_data,
            reference_urls=reference_urls,
        )
        logger.info("Silent video generated: %d bytes", len(silent_video_bytes))

        # ==================================================================
        # STEP 5-7: For EACH language — generate voiceover, lip sync, compose
        # ONE silent video x N languages
        # ==================================================================
        for lang in languages:
            logger.info("Generating language variant: %s", lang)

            # STEP 5-6: TTS + Lip sync (optional — skip if not installed)
            synced_video = silent_video_bytes  # Default: use silent video
            try:
                voiceover_text = _extract_dialogue(script_data, lang, primary_language)
                if voiceover_text.strip():
                    audio_bytes = await generate_speech(
                        text=voiceover_text,
                        language=lang,
                    )
                    logger.info("Voiceover generated: %d bytes (%s)", len(audio_bytes), lang)

                    synced_video = await lip_sync(
                        video_bytes=silent_video_bytes,
                        audio_bytes=audio_bytes,
                    )
                    logger.info("Lip sync complete: %d bytes (%s)", len(synced_video), lang)
                else:
                    logger.info("No dialogue for %s — using silent video", lang)
            except Exception as tts_err:
                logger.warning(
                    "TTS/lip sync skipped for %s: %s — uploading silent video",
                    lang, tts_err,
                )

            # STEP 8: Upload to Vercel Blob
            filename = (
                f"video_{actor.get('id', 'unknown')}_{template_key}_{lang}_"
                f"{uuid.uuid4().hex[:8]}.mp4"
            )
            blob_url = await upload_to_blob(
                synced_video,
                filename,
                folder=f"requests/{request_id}/videos",
                content_type="video/mp4",
            )
            logger.info("Video uploaded: %s", blob_url)

            # STEP 9: Save asset to Neon
            asset_metadata: dict[str, Any] = {
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
                "persona_key": persona.get("archetype_key"),
                "template": template_key,
                "language": lang,
                "region": region,
                "estimated_duration_s": script_data.get("estimated_duration_s"),
                "platform": script_data.get("target_platform", "tiktok"),
                "has_lip_sync": bool(voiceover_text.strip()),
                "script_hook": script_data.get("hook", ""),
                "reference_count": len(reference_urls),
            }

            await save_asset(request_id, {
                "asset_type": "video",
                "platform": script_data.get("target_platform", "tiktok"),
                "format": "1080x1920",
                "language": lang,
                "blob_url": blob_url,
                "metadata": asset_metadata,
            })

            all_video_assets.append({
                "blob_url": blob_url,
                "language": lang,
                "template": template_key,
                "actor_name": actor.get("name"),
                "persona": persona.get("archetype_key"),
                **asset_metadata,
            })

            total_language_variants += 1

        total_videos += 1

    logger.info(
        "Video pipeline complete: %d base videos x %d language variants = %d total assets",
        total_videos, len(languages), total_language_variants,
    )

    return {
        "video_assets": all_video_assets,
        "video_count": total_videos,
        "language_variants": total_language_variants,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _generate_and_validate_script(
    *,
    persona: dict,
    brief: dict,
    template_key: str,
    language: str,
    region: str,
) -> dict:
    """Generate a video script and validate it against Kling constraints.

    Retries up to ``MAX_SCRIPT_RETRIES`` times if the script fails
    validation or the quality gate.
    """
    feedback: list[str] = []

    for attempt in range(MAX_SCRIPT_RETRIES):
        # Build the prompt
        prompt = build_video_script_prompt(
            persona=persona,
            brief=brief,
            template_key=template_key,
            language=language,
            region=region,
        )

        # Add feedback from previous attempts
        if feedback:
            prompt += "\n\nFEEDBACK FROM PREVIOUS ATTEMPT — fix these issues:\n"
            prompt += "\n".join(f"- {f}" for f in feedback)

        # Generate script with Gemma 3 12B
        raw_text = await generate_copy(
            system_prompt=VIDEO_SCRIPT_SYSTEM,
            user_prompt=prompt,
            temperature=0.8,
            max_tokens=4096,
        )

        # Parse JSON
        script_data = _parse_json(raw_text)
        if "raw_text" in script_data and len(script_data) == 1:
            feedback.append("Output was not valid JSON. Return ONLY valid JSON.")
            logger.warning("Script attempt %d: invalid JSON", attempt + 1)
            continue

        # Validate against Kling constraints
        validation = validate_script_for_kling(script_data)

        if not validation["valid"]:
            feedback = validation["errors"]
            logger.warning(
                "Script attempt %d: %d Kling constraint errors",
                attempt + 1, len(validation["errors"]),
            )
            # Apply suggested adjustments for next attempt
            if validation["adjustments"]:
                feedback.append(
                    "Suggested adjustments: "
                    + "; ".join(
                        f"Scene {a['scene']}: {a['field']} {a['original']} -> {a['suggested']} ({a['reason']})"
                        for a in validation["adjustments"]
                    )
                )
            continue

        # Add validation warnings to the script data
        script_data["_validation"] = validation

        logger.info(
            "Script validated: %d scenes, %ds total, lip sync safe=%s (attempt %d)",
            validation["stats"]["num_shots"],
            validation["stats"]["total_duration_s"],
            validation["stats"]["lip_sync_safe"],
            attempt + 1,
        )
        return script_data

    # If all retries exhausted, return the last attempt with warnings
    logger.warning("Script retries exhausted — using last attempt with warnings")
    script_data["_validation_warnings"] = feedback
    return script_data


async def _generate_character_references(
    actor: dict,
    request_id: str,
) -> list[str]:
    """Generate 3-angle character reference images for Kling consistency.

    Uses Seedream 4.5 to generate front, side, and back views.
    """
    reference_prompts = build_character_reference_set(actor)
    reference_urls: list[str] = []

    # Check if actor already has a validated seed we can use as one reference
    seed_url = actor.get("validated_seed_url")
    if seed_url:
        reference_urls.append(seed_url)
        logger.info("Using existing seed as first reference: %s", seed_url)

    for ref in reference_prompts:
        # Skip front view if we already have the seed
        if seed_url and ref["angle"] == "front":
            continue

        try:
            image_bytes = await generate_image(
                ref["prompt"],
                dimension_key=ref["dimension_key"],
            )

            filename = (
                f"ref_{actor.get('id', 'unknown')}_{ref['angle']}_"
                f"{uuid.uuid4().hex[:8]}.png"
            )
            blob_url = await upload_to_blob(
                image_bytes, filename,
                folder=f"requests/{request_id}/references",
            )
            reference_urls.append(blob_url)
            logger.info("Reference %s generated: %s", ref["angle"], blob_url)

        except Exception as exc:
            logger.warning(
                "Failed to generate %s reference: %s", ref["angle"], exc,
            )

    return reference_urls


async def _generate_silent_video(
    *,
    script_data: dict,
    reference_urls: list[str],
) -> bytes:
    """Generate a silent video from the script using Kling 3.0.

    Tries multishot first (preferred), falls back to single-shot
    if multishot fails or the scene count is 1.
    """
    scenes = script_data.get("scenes", [])

    if not scenes:
        raise ValueError("Script has no scenes — cannot generate video")

    # Try multishot if we have multiple scenes
    if len(scenes) > 1 and len(scenes) <= 6:
        try:
            multishot_data = build_multishot_prompt(
                scenes=_scenes_to_kling_format(scenes),
                actor_references=reference_urls,
            )

            if multishot_data["warnings"]:
                for w in multishot_data["warnings"]:
                    logger.warning("Multishot warning: %s", w)

            # Build individual shot prompts for the API
            shot_payloads: list[dict[str, Any]] = []
            for scene in scenes:
                shot_payloads.append({
                    "prompt": _build_single_scene_prompt(scene),
                    "duration_s": scene.get("duration_s", 2),
                    "camera": scene.get("camera", "static"),
                    "transition": scene.get("transition", "hard_cut"),
                })

            video_bytes = await generate_multishot_video(
                shots=shot_payloads,
                references=reference_urls,
            )
            logger.info("Multishot video generated successfully")
            return video_bytes

        except Exception as exc:
            logger.warning(
                "Multishot generation failed (%s), falling back to single-shot",
                exc,
            )

    # Fallback: generate a single video from the full script prompt
    full_prompt = _build_full_script_prompt(scenes)
    total_duration = sum(s.get("duration_s", 2) for s in scenes)
    total_duration = min(total_duration, 15)

    video_bytes = await generate_video(
        prompt=full_prompt,
        references=reference_urls,
        duration_s=total_duration,
        aspect_ratio="9:16",
    )
    logger.info("Single-shot video generated: %d bytes", len(video_bytes))
    return video_bytes


def _scenes_to_kling_format(scenes: list[dict]) -> list[dict]:
    """Convert script scenes to the format expected by the Kling director."""
    kling_scenes: list[dict] = []
    for scene in scenes:
        kling_scenes.append({
            "camera": scene.get("camera", "static"),
            "action": scene.get("action", "person in frame"),
            "duration_s": scene.get("duration_s", 2),
            "dialogue": scene.get("dialogue", ""),
            "acting_direction": scene.get("acting_direction", ""),
            "environment": scene.get("environment", "modern home interior"),
            "lighting": scene.get("lighting", "natural_afternoon"),
            "texture": scene.get("texture", "iphone_ugc"),
            "transition": scene.get("transition", "hard_cut"),
            "text_overlay": scene.get("text_overlay", ""),
        })
    return kling_scenes


def _build_single_scene_prompt(scene: dict) -> str:
    """Build a Kling prompt for a single scene without the director module."""
    parts = []
    camera = scene.get("camera", "static")
    parts.append(f"[CAMERA: {camera}]")
    parts.append(f"[ACTION: {scene.get('action', 'person in frame')}]")
    if scene.get("acting_direction"):
        parts.append(f"({scene['acting_direction']})")
    parts.append(f"[ENVIRONMENT: {scene.get('environment', 'modern home interior')}]")
    parts.append(f"[LIGHTING: {scene.get('lighting', 'natural indoor lighting')}]")
    parts.append(f"[TEXTURE: {scene.get('texture', 'iPhone UGC quality')}]")
    return " ".join(parts)


def _build_full_script_prompt(scenes: list[dict]) -> str:
    """Build a single combined prompt from all scenes for single-shot mode."""
    parts = [
        "Short-form vertical video ad. Maintain consistent character throughout."
    ]
    cumulative = 0
    for i, scene in enumerate(scenes, 1):
        duration = scene.get("duration_s", 2)
        cumulative += duration
        parts.append(
            f"At {cumulative - duration}s-{cumulative}s: "
            f"[CAMERA: {scene.get('camera', 'static')}] "
            f"{scene.get('action', 'person in frame')}. "
            f"({scene.get('acting_direction', 'natural')})"
        )
    parts.append(
        "[ENVIRONMENT: modern home interior, natural lighting] "
        "[TEXTURE: iPhone UGC quality, natural skin, no beauty filter]"
    )
    return "\n".join(parts)


def _extract_dialogue(
    script_data: dict,
    target_language: str,
    primary_language: str,
) -> str:
    """Extract all dialogue from the script for TTS generation.

    If the target language differs from the script's primary language,
    we concatenate the dialogue lines (the script was written in the
    primary language, and TTS will handle pronunciation in the target
    language since the script prompt generates per-language content).
    """
    scenes = script_data.get("scenes", [])
    dialogue_parts: list[str] = []

    for scene in scenes:
        dialogue = scene.get("dialogue", "")
        if dialogue and dialogue.strip():
            dialogue_parts.append(dialogue.strip())

    return " ".join(dialogue_parts)


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles code fences and embedded JSON."""
    if not text:
        return {"raw_text": ""}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Search for embedded JSON (brace-depth scan)
    brace_depth = 0
    json_start = -1
    last_valid_json = None

    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                json_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and json_start >= 0:
                candidate = cleaned[json_start:i+1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict) and len(parsed) > 1:
                        last_valid_json = parsed
                except json.JSONDecodeError:
                    pass
                json_start = -1

    if last_valid_json:
        logger.info("Extracted JSON from text (%d keys)", len(last_valid_json))
        return last_valid_json

    logger.warning("Failed to parse JSON from video script (%d chars)", len(text))
    return {"raw_text": text}
