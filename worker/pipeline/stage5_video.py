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
from prompts.video_director import CAMERA_MOVES, LIGHTING_PRESETS, TEXTURE_PRESETS
from prompts.video_evaluator import (
    MAX_RETRIES,
    ScriptEvalResult,
    build_eval_prompt,
    build_rewrite_prompt,
    check_script_constraints,
    compute_passed,
)
from prompts.video_script import VIDEO_SCRIPT_SYSTEM, build_ugc_script_prompt
from prompts.video_storyboard import (
    MAX_STORYBOARD_RETRIES,
    build_seedream_prompt,
    rewrite_seedream_prompt,
    vqa_storyboard_frame,
)
from prompts.video_templates import select_template

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
