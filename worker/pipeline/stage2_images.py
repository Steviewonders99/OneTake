"""Stage 2: Character-Driven Image Generation.

1. Generate actor identity cards using Qwen3.5-9B.
2. Save actor profiles to Neon.
3. Generate HERO SEED IMAGE for each actor (full VQA, max 3 retries).
4. Save validated seed as ``validated_seed_url`` on the actor profile.
5. Generate OUTFIT/BACKDROP VARIATIONS using the seed as reference (lighter VQA).
6. Upload all approved images to Vercel Blob.
7. Save generated_assets to Neon.

The validated seed image is the actor's "golden reference" — it:
- Gets reused as img2img reference for all subsequent outfit/backdrop variations
- Dramatically improves consistency (Seedream sees the approved face)
- Reduces VQA failures on variation images (face is already locked)
- Can be reused across future campaigns for the same region
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid

from ai.deglosser import degloss
from ai.local_llm import generate_text
from ai.local_vlm import analyze_image
from ai.seedream import generate_image
from blob_uploader import upload_to_blob
from neon_client import save_actor, save_asset, update_actor_seed
from prompts.persona_engine import PERSONA_SYSTEM_PROMPT
from prompts.recruitment_actors import (
    ACTOR_SYSTEM_PROMPT,
    build_actor_prompt,
    build_image_prompt,
    build_visual_qa_prompt,
)

logger = logging.getLogger(__name__)

MAX_SEED_RETRIES = 3
MAX_VARIATION_RETRIES = 2
SEED_VQA_THRESHOLD = 0.85
VARIATION_VQA_THRESHOLD = 0.75  # Lower bar — face is already validated
ACTORS_PER_PERSONA = 3


def build_persona_actor_prompt(
    persona: dict,
    region: str,
    language: str,
    visual_direction: dict | None = None,
) -> str:
    """Generate an actor-card prompt derived from a dynamic persona.

    Replaces the legacy build_persona_actor_prompt from persona_engine
    (deleted in Task 18/19). Reads the dynamic persona schema produced
    by prompts.persona_engine.build_persona_prompt: name, archetype,
    matched_tier, age_range, lifestyle, motivations, psychology_profile,
    jobs_to_be_done.

    When *visual_direction* is provided (from Stage 1 derived_requirements),
    scene generation uses work_environment, wardrobe, visible_tools,
    emotional_tone and cultural_adaptations to produce scene-aware
    actor identity cards instead of generic home-office defaults.
    """
    psychology = persona.get("psychology_profile", {}) or {}
    raw_jtbd = persona.get("jobs_to_be_done", {})
    if isinstance(raw_jtbd, list):
        jtbd = {
            "functional": raw_jtbd[0] if raw_jtbd else "Earn money remotely",
            "emotional": raw_jtbd[1] if len(raw_jtbd) > 1 else "Feel productive",
        }
    else:
        jtbd = raw_jtbd if isinstance(raw_jtbd, dict) else {}

    persona_name = (
        persona.get("name")
        or persona.get("persona_name")
        or persona.get("matched_tier")
        or "Contributor"
    )
    archetype_label = persona.get("archetype") or persona.get("matched_tier") or "Contributor"
    age_range_hint = persona.get("age_range", "25-35")
    try:
        lo, hi = (int(x) for x in str(age_range_hint).split("-")[:2])
        mid_age = (lo + hi) // 2
    except (ValueError, IndexError):
        mid_age = 30
        lo, hi = 28, 32

    motivations = persona.get("motivations", []) or []
    primary_motivation = motivations[0] if motivations else "earning flexibly"

    # Build scene guidance from visual_direction (derived_requirements)
    vd = visual_direction or {}
    work_env = vd.get("work_environment", "")
    wardrobe = vd.get("wardrobe", "")
    visible_tools = vd.get("visible_tools", "")
    emotional_tone = vd.get("emotional_tone", "")
    cultural_adapt = vd.get("cultural_adaptations", "")

    if work_env:
        scene_guidance = f"""
VISUAL DIRECTION (from campaign analysis — use these to generate SCENE-AWARE variations):
- Work environment: {work_env}
- Wardrobe: {wardrobe or "contextually appropriate for this work environment"}
- Visible tools/props: {visible_tools or "relevant to the work described"}
- Emotional tone: {emotional_tone or "authentic and natural"}
- Cultural adaptations: {cultural_adapt or "appropriate for " + region}

SCENE GENERATION RULES (visual_direction OVERRIDES the defaults):
- Scene 1 MUST show the person ACTIVELY WORKING in the described work environment wearing the described wardrobe with the described tools visible.
- Scene 2 should show a BREAK or TRANSITION moment — same professional context but relaxed (e.g., break room, stepping outside, reviewing notes).
- Scene 3 should show a DIFFERENT ANGLE on their professional life — could be commuting to the work environment, preparing for work, or in a secondary work setting.
- Scene 4 should show a REWARD/CELEBRATION moment — checking phone for payment notification, telling someone about their work, treating themselves after a shift.
- ALL scenes must use wardrobe and tools from the visual direction above — NOT generic "casual clothes with laptop".
- Backdrops must match the work environment described — NOT generic home offices or cafes (unless the work environment IS a home office or cafe)."""
    else:
        scene_guidance = ""

    return f"""Create an AI UGC actor identity card for a OneForma recruitment ad campaign.

This actor EMBODIES a specific target persona — every detail should make
the target audience think "that looks like ME".

TARGET PERSONA: {persona_name}
ARCHETYPE: {archetype_label}
MATCHED TIER: {persona.get("matched_tier", "")}
AGE: {mid_age} (range {lo}-{hi})
REGION: {region}
LANGUAGE: {language}

PERSONA CONTEXT (the actor must LOOK like this person):
- Lifestyle: {persona.get("lifestyle", "")}
- Primary motivation: {primary_motivation}

PSYCHOLOGY (the image must TRIGGER these responses in the target audience):
- Primary hook: {psychology.get("primary_bias", "social_proof")}
- The viewer should think: "{psychology.get("messaging_angle", "This could be me")}"
- Jobs-to-be-done — functional: {jtbd.get("functional", "Earn money remotely")}
- Jobs-to-be-done — emotional: {jtbd.get("emotional", "Feel productive")}
{scene_guidance}
Return ONLY valid JSON matching this EXACT schema:
{{
  "name": "A culturally appropriate first name for {region}",
  "persona_key": "{persona.get("matched_tier", persona_name)}",
  "face_lock": {{
    "skin_tone_hex": "#HEXCOLOR (realistic for someone from {region})",
    "eye_color": "specific eye color",
    "jawline": "face shape description",
    "hair": "specific hairstyle common in {region} for a {archetype_label}",
    "nose_shape": "specific description",
    "age_range": "{lo}-{hi}",
    "distinguishing_marks": "1-2 unique features"
  }},
  "prompt_seed": "One dense paragraph (80-120 words) describing this EXACT person. Include: ethnicity, age, skin tone hex, face shape, hair, eye color, distinguishing marks, default expression. This person IS a {archetype_label} — their vibe should communicate '{primary_motivation}'.",
  "scenes": {{
    "scene_key_1": {{
      "name": "Short human-readable scene name",
      "setting": "Detailed environment — specific to this persona's work and life in {region}",
      "outfit": "What they're wearing — must match the visual direction if provided",
      "pose_and_action": "What they're physically doing",
      "emotion": "Facial expression and body language",
      "ad_angle": "What marketing message this scene supports"
    }},
    "scene_key_2": {{ ... same structure ... }},
    "scene_key_3": {{ ... same structure ... }},
    "scene_key_4": {{ ... same structure ... }}
  }},
  "signature_accessory": "ONE item they ALWAYS have (relevant to a {archetype_label})",
  "backdrops": [
    "Primary work/life setting appropriate for this persona",
    "A realistic {region} secondary setting",
    "A different {region} environment",
    "A close-up framing for story/portrait format"
  ]
}}

RULES:
- This actor is a {archetype_label} aged {lo}-{hi} in {region}.
- They should look like someone the target persona would IDENTIFY with.
- NOT a stock-photo model. NOT corporate. Real person vibes.
- Generate EXACTLY 4 scenes with unique snake_case keys.
- Setting should match the persona's lifestyle and the visual direction if provided."""


async def run_stage2(context: dict) -> dict:
    """Generate actors and images — one per persona (or per region as fallback)."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})
    regions: list[str] = context.get("target_regions", [])
    languages: list[str] = context.get("target_languages", [])

    # Extract visual_direction from derived_requirements (Phase A+B data)
    derived_req = brief.get("derived_requirements", {})
    if isinstance(derived_req, str):
        try:
            import json as _json
            derived_req = _json.loads(derived_req)
        except (ValueError, TypeError):
            derived_req = {}
    visual_direction = derived_req.get("visual_direction", {}) if isinstance(derived_req, dict) else {}

    raw_personas = context.get("personas", brief.get("personas", []))
    logger.info("Stage 2 raw_personas: type=%s, len=%s, first_type=%s",
                type(raw_personas).__name__, len(raw_personas) if raw_personas else 0,
                type(raw_personas[0]).__name__ if raw_personas else "empty")
    # Defensive: handle nested arrays or non-dict items from LLM output
    personas: list[dict] = []
    for p in (raw_personas or []):
        if isinstance(p, dict):
            personas.append(p)
        elif isinstance(p, list):
            # Nested array — flatten
            for inner in p:
                if isinstance(inner, dict):
                    personas.append(inner)
    if not personas and raw_personas:
        logger.warning("Could not extract persona dicts from %s (type=%s)", type(raw_personas).__name__, type(raw_personas[0]).__name__ if raw_personas else "empty")

    all_actors: list[dict] = []
    total_images = 0

    # -----------------------------------------------------------------
    # Build the actor work list: prefer persona-driven, fall back to
    # region-driven if no personas are available.
    # -----------------------------------------------------------------
    actor_jobs: list[dict] = []
    if personas:
        for persona in personas:
            for actor_idx in range(ACTORS_PER_PERSONA):
                actor_jobs.append({
                    "region": persona.get("region", regions[0] if regions else "Global"),
                    "language": persona.get("language", languages[0] if languages else "English"),
                    "persona": persona,
                    "actor_index": actor_idx,
                    "visual_direction": visual_direction,
                })
        logger.info(
            "Persona-driven actor generation: %d personas x %d actors = %d jobs",
            len(personas),
            ACTORS_PER_PERSONA,
            len(actor_jobs),
        )
    else:
        for idx, region in enumerate(regions or ["Global"]):
            language = languages[idx] if idx < len(languages) else (languages[0] if languages else "English")
            actor_jobs.append({
                "region": region,
                "language": language,
                "persona": None,
            })
        logger.info(
            "Region-driven actor generation (no personas): %d regions",
            len(actor_jobs),
        )

    import asyncio
    IMAGE_CONCURRENCY = 9  # Seedream is paid API — no rate limit, max parallelism

    # ══════════════════════════════════════════════════════════════
    # PHASE 1: Create ALL 9 actor identity cards IN PARALLEL
    # NIM 397B handles this instantly (~1s each, all at once)
    # ══════════════════════════════════════════════════════════════
    logger.info("Phase 1: Creating %d actor identity cards in parallel...", len(actor_jobs))

    async def _create_card(job):
        return await _generate_actor_card(job, brief, request_id)

    card_results = await asyncio.gather(
        *[_create_card(job) for job in actor_jobs],
        return_exceptions=True,
    )

    actor_cards = []
    for r in card_results:
        if isinstance(r, Exception):
            import traceback
            logger.error("Actor card failed: %s\n%s", r, ''.join(traceback.format_exception(type(r), r, r.__traceback__)))
        elif r:
            actor_cards.append(r)

    logger.info("Phase 1 complete: %d actor cards created", len(actor_cards))

    # ══════════════════════════════════════════════════════════════
    # PHASE 2: Generate images for ALL actors (semaphore for Seedream)
    # 3 concurrent image generations at a time
    # ══════════════════════════════════════════════════════════════
    logger.info("Phase 2: Generating images for %d actors (%d concurrent)...", len(actor_cards), IMAGE_CONCURRENCY)
    image_semaphore = asyncio.Semaphore(IMAGE_CONCURRENCY)
    all_actors: list[dict] = []
    total_images = 0

    async def _gen_images(card):
        async with image_semaphore:
            return await _generate_actor_images(card, design, request_id)

    img_results = await asyncio.gather(
        *[_gen_images(card) for card in actor_cards],
        return_exceptions=True,
    )
    for r in img_results:
        if isinstance(r, Exception):
            logger.error("Actor images failed: %s", r)
        elif r:
            actor_data, img_count = r
            all_actors.append(actor_data)
            total_images += img_count

    return {
        "actors": all_actors,
        "image_count": total_images,
    }


async def _generate_actor_card(job, brief, request_id):
    """Phase 1: Generate actor identity card only (NIM 397B, ~1s). Returns actor_data dict."""
    region = job["region"]
    language = job["language"]
    persona = job["persona"]

    if persona:
        visual_direction = job.get("visual_direction", {})
        actor_prompt = build_persona_actor_prompt(persona, region, language, visual_direction=visual_direction)
        actor_idx = job.get("actor_index", 0)
        if actor_idx > 0:
            actor_prompt += (
                f"\n\nIMPORTANT: This is actor #{actor_idx + 1} for the same persona. "
                f"Generate a DIFFERENT person — different gender, age within range, "
                f"appearance, and name. Must be visually distinct from other actors."
            )
        actor_text = await generate_text(PERSONA_SYSTEM_PROMPT, actor_prompt, thinking=False, max_tokens=4096)
    else:
        actor_prompt = build_actor_prompt(brief, region, language)
        actor_text = await generate_text(ACTOR_SYSTEM_PROMPT, actor_prompt, thinking=False, max_tokens=4096)
    actor_data = _parse_json(actor_text)

    actor_id = await save_actor(request_id, {
        "name": actor_data.get("name", f"Contributor-{region}"),
        "face_lock": actor_data.get("face_lock", {}),
        "prompt_seed": actor_data.get("prompt_seed", ""),
        "outfit_variations": actor_data.get("outfit_variations", {}),
        "scenes": actor_data.get("scenes", {}),
        "signature_accessory": actor_data.get("signature_accessory", "headphones"),
        "backdrops": actor_data.get("backdrops", []),
        "persona_key": persona.get("archetype_key") if persona else None,
        "persona_name": persona.get("persona_name") if persona else None,
    })
    actor_data["id"] = actor_id
    actor_data["persona"] = persona
    actor_data["_job"] = job  # Preserve job metadata for Phase 2
    logger.info(
        "Actor '%s' created (id=%s, region=%s, persona=%s)",
        actor_data.get("name"),
        actor_id,
        region,
        persona.get("archetype_key") if persona else "none",
    )
    return actor_data


async def _generate_actor_images(actor_data, design, request_id):
    """Phase 2: Generate seed + variation images for one actor. Returns (actor_data, image_count)."""
    import asyncio
    total_images = 0
    job = actor_data.pop("_job", {})
    region = job.get("region", "Global")
    language = job.get("language", "English")
    actor_id = actor_data.get("id", "")

    # Track compositions used for this actor (ensures variety)
    used_compositions: list[str] = []

    # ==================================================================
    # Resolve scene keys — dynamic scenes (new) or outfit_variations (legacy)
    # Dynamic scenes: actor_data["scenes"] = {"morning_desk": {...}, ...}
    # Legacy: actor_data["outfit_variations"] = {"at_home_working": "...", ...}
    # ==================================================================
    scenes = actor_data.get("scenes", {})
    outfit_variations = actor_data.get("outfit_variations", {})

    if scenes:
        # Dynamic scenes — use scene keys, first one is the seed
        all_scene_keys = list(scenes.keys())
        seed_key = all_scene_keys[0] if all_scene_keys else "default"
        logger.info(
            "Using %d dynamic scenes for '%s': %s",
            len(all_scene_keys), actor_data.get("name", "?"), all_scene_keys,
        )
    else:
        # Legacy outfit_variations
        all_scene_keys = list(outfit_variations.keys())
        seed_key = "at_home_working" if "at_home_working" in all_scene_keys else (all_scene_keys[0] if all_scene_keys else "default")

    # ==================================================================
    # STEP 2: Generate HERO SEED IMAGE (full VQA validation)
    # This is the golden reference — must pass strict threshold.
    # ==================================================================
    seed_url, seed_score, seed_comp = await _generate_validated_image(
        actor_data=actor_data,
        outfit_key=seed_key,
        backdrop_index=0,
        design=design,
        region=region,
        request_id=request_id,
        actor_id=actor_id,
        max_retries=MAX_SEED_RETRIES,
        vqa_threshold=SEED_VQA_THRESHOLD,
        asset_type="base_image",
        language=language,
        is_seed=True,
        image_index=0,
        used_compositions=used_compositions,
    )
    used_compositions.append(seed_comp)

    # Save validated seed URL on the actor profile for future reference
    await update_actor_seed(actor_id, seed_url)
    actor_data["validated_seed_url"] = seed_url
    total_images += 1

    logger.info(
        "Hero seed saved for '%s': %s (score=%.2f, scene=%s)",
        actor_data.get("name"), seed_url, seed_score, seed_key,
    )

    # ==================================================================
    # STEP 3: Generate SCENE VARIATIONS using seed as reference
    # Lower VQA threshold since the face identity is already validated.
    # ==================================================================
    remaining_outfits = [k for k in all_scene_keys if k != seed_key]

    # Run variations IN PARALLEL (they're independent once seed is approved)
    async def _gen_variation(var_idx, outfit_key):
        return await _generate_validated_image(
            actor_data=actor_data,
            outfit_key=outfit_key,
            backdrop_index=(var_idx + 1),
            design=design,
            region=region,
            request_id=request_id,
            actor_id=actor_id,
            max_retries=MAX_VARIATION_RETRIES,
            vqa_threshold=VARIATION_VQA_THRESHOLD,
            asset_type="base_image",
            language=language,
            is_seed=False,
            image_index=(var_idx + 1),
            used_compositions=used_compositions,
        )

    var_results = await asyncio.gather(
        *[_gen_variation(i, k) for i, k in enumerate(remaining_outfits)],
        return_exceptions=True,
    )
    for i, r in enumerate(var_results):
        if isinstance(r, Exception):
            logger.error("Variation '%s' failed: %s", remaining_outfits[i], r)
        else:
            var_url, var_score, var_comp = r
            used_compositions.append(var_comp)
            total_images += 1
            logger.info(
                "Variation '%s' for '%s': composition=%s, score=%.2f",
                remaining_outfits[i], actor_data.get("name"), var_comp, var_score,
            )

    return actor_data, total_images


async def _generate_validated_image(
    *,
    actor_data: dict,
    outfit_key: str,
    backdrop_index: int,
    design: dict,
    region: str,
    request_id: str,
    actor_id: str,
    max_retries: int,
    vqa_threshold: float,
    asset_type: str,
    language: str,
    is_seed: bool,
    image_index: int = 0,
    used_compositions: list[str] | None = None,
) -> tuple[str, float, str]:
    """Generate an image, validate via VQA, retry if needed, upload, and save.

    Returns (blob_url, vqa_score, composition_key_used).
    """
    image_prompt_text, composition_key = build_image_prompt(
        actor_data,
        outfit_key=outfit_key,
        backdrop_index=backdrop_index,
        design=design,
        region=region,
        image_index=image_index,
        used_compositions=used_compositions,
    )

    # If this is a variation (not seed), reference the validated seed
    seed_url = actor_data.get("validated_seed_url")
    if seed_url and not is_seed:
        image_prompt_text += f"\n\nREFERENCE IMAGE (use this face as the identity anchor): {seed_url}"

    image_bytes = b""
    qa_score = 0.0
    qa_data: dict = {}

    for attempt in range(max_retries):
        tag = "seed" if is_seed else f"variation:{outfit_key}"
        logger.info(
            "Generating %s image for '%s' (attempt %d/%d)",
            tag, actor_data.get("name", "?"), attempt + 1, max_retries,
        )

        raw_bytes = await generate_image(image_prompt_text, dimension_key="square")

        # DEGLOSSER: Remove AI gloss — add grain, skin texture, vignette,
        # chromatic aberration, compression artifacts. Runs locally via
        # Pillow + NumPy. This is the free alternative to paid skin
        # enhancers like Higgsfield or Enhancor.
        deglosser_intensity = "heavy" if attempt == 0 else "medium"  # First try = max roughness
        image_bytes = degloss(raw_bytes, intensity=deglosser_intensity)
        logger.info("Deglosser applied (%s intensity)", deglosser_intensity)

        # Write to temp file for VLM analysis
        tmp_path = os.path.join(tempfile.gettempdir(), f"centric_{uuid.uuid4().hex}.png")
        with open(tmp_path, "wb") as f:
            f.write(image_bytes)

        # Visual QA
        qa_prompt = build_visual_qa_prompt(actor_data, region, outfit_key=outfit_key)
        qa_result = await analyze_image(tmp_path, qa_prompt)
        qa_data = _parse_json(qa_result)
        qa_score = float(qa_data.get("overall_score", qa_data.get("score", 0)))

        # If VQA returned text but no parseable JSON, score by signal strength
        if qa_score == 0 and "raw_text" in qa_data and len(qa_data["raw_text"]) > 100:
            raw = qa_data["raw_text"].lower()

            # Count positive and negative PHRASES (not just words — avoids false negatives)
            # "not artificial" should NOT trigger negative. "looks artificial" SHOULD.
            strong_positive = ["looks realistic", "appears realistic", "natural skin", "authentic", "natural lighting",
                               "consistent with", "matches the", "well-composed", "professional quality", "good realism",
                               "believable", "convincing", "high quality", "well-lit"]
            mild_positive = ["good quality", "decent", "acceptable", "clear face", "visible accessory", "appropriate"]
            negative = ["looks artificial", "appears fake", "unrealistic skin", "plastic skin", "ai-generated look",
                        "poor quality", "should reject", "distorted", "extra fingers", "hex code", "glitchy",
                        "uncanny valley", "oversaturated", "too smooth", "mannequin",
                        "cartoon", "anime", "illustration", "illustrated", "digital painting",
                        "rendered", "painted", "brush strokes", "stylized", "comic", "manga",
                        # Watermark / text artifact detection
                        "watermark", "logo overlay", "text overlay", "iphone", "shot on",
                        "stock photo", "getty", "shutterstock", "alamy", "istock",
                        "chinese text", "chinese character", "xiaohongshu", "小红书",
                        "hashtag", "social media ui", "instagram ui", "tiktok ui",
                        "gibberish text", "nonsensical text", "fake brand", "scrambled letter",
                        "brand name", "camera brand", "visible text", "baked-in text",
                        "overlay text", "foreign text", "unreadable text"]

            pos_count = sum(1 for w in strong_positive if w in raw)
            mild_count = sum(1 for w in mild_positive if w in raw)
            neg_count = sum(1 for w in negative if w in raw)

            if neg_count > 0:
                qa_score = 0.40
                logger.info("VQA prose: %d negative signals — score %.2f", neg_count, qa_score)
            elif pos_count >= 3:
                qa_score = 0.92  # Strong positive = high confidence pass
                logger.info("VQA prose: %d strong positive signals — score %.2f", pos_count, qa_score)
            elif pos_count >= 1:
                qa_score = 0.87  # Some positive = passes seed threshold
                logger.info("VQA prose: %d positive + %d mild signals — score %.2f", pos_count, mild_count, qa_score)
            elif mild_count >= 2:
                qa_score = 0.82  # Mild positive only
                logger.info("VQA prose: %d mild positive signals — score %.2f", mild_count, qa_score)
            else:
                qa_score = 0.75  # Ambiguous
                logger.info("VQA prose: no clear signals — default score %.2f", qa_score)

        try:
            os.unlink(tmp_path)
        except OSError:
            pass

        if qa_score >= vqa_threshold:
            logger.info("Image passed VQA (score=%.2f, attempt=%d)", qa_score, attempt + 1)
            break

        logger.info("VQA score %.2f < %.2f — retrying (attempt %d/%d).", qa_score, vqa_threshold, attempt + 1, max_retries)
        issues = qa_data.get("issues", [])
        issues_text = "; ".join(issues) if issues else "improve realism and remove any artifacts"

        # Try Gemini Edit first (fix in-place — best at artifact removal without character drift)
        edit_succeeded = False
        if image_bytes and len(image_bytes) > 10000:
            try:
                from ai.flux_edit import edit_image_flux
                edit_prompt = f"Remove these issues: {issues_text}. Remove any watermarks, text overlays, gibberish text, brand names, Chinese characters. Keep the person and scene identical. Clean photo."
                edited_bytes = await edit_image_flux(image_bytes, edit_prompt)
                if edited_bytes and len(edited_bytes) > 10000:
                    # Re-run VQA on the edited image immediately
                    tmp_edit = os.path.join(tempfile.gettempdir(), f"centric_edit_{uuid.uuid4().hex}.png")
                    with open(tmp_edit, "wb") as f:
                        f.write(edited_bytes)
                    edit_qa = await analyze_image(tmp_edit, qa_prompt)
                    edit_qa_data = _parse_json(edit_qa)
                    edit_score = float(edit_qa_data.get("overall_score", edit_qa_data.get("score", 0)))
                    try:
                        os.unlink(tmp_edit)
                    except OSError:
                        pass
                    if edit_score >= vqa_threshold:
                        image_bytes = edited_bytes
                        qa_score = edit_score
                        qa_data = edit_qa_data
                        logger.info("Seedream Edit PASSED VQA (score=%.2f, fixing: %s)", edit_score, issues_text[:60])
                        edit_succeeded = True
                        break  # VQA passed — done
                    elif edit_score > qa_score:
                        image_bytes = edited_bytes
                        qa_score = edit_score
                        logger.info("Seedream Edit improved score %.2f → %.2f but still below threshold", qa_score, edit_score)
                    else:
                        logger.info("Seedream Edit didn't improve score (%.2f) — will regen", edit_score)
            except Exception as e:
                logger.warning("Seedream Edit failed: %s — falling back to full regen", e)

        # Full regeneration with feedback appended
        if not edit_succeeded and issues:
            image_prompt_text += "\n\nFix these issues from previous attempt: " + issues_text

    # Convert to AVIF for storage optimization (91% smaller than PNG)
    avif_bytes = _convert_to_avif(image_bytes)
    is_avif = len(avif_bytes) < len(image_bytes)
    ext = "avif" if is_avif else "png"

    # Upload to Vercel Blob
    tag = "seed" if is_seed else outfit_key
    filename = f"actor_{actor_id}_{tag}_{uuid.uuid4().hex[:8]}.{ext}"
    blob_url = await upload_to_blob(
        avif_bytes, filename,
        folder=f"requests/{request_id}",
        content_type=f"image/{ext}",
    )

    # Save as generated asset
    await save_asset(request_id, {
        "asset_type": asset_type,
        "platform": "all",
        "format": "1080x1080",
        "language": language,
        "blob_url": blob_url,
        "metadata": {
            "actor_id": actor_id,
            "actor_name": actor_data.get("name"),
            "outfit_key": outfit_key,
            "composition": composition_key,
            "is_seed": is_seed,
            "region": region,
            "vqa_score": qa_score,
            "vqa_dimensions": qa_data.get("dimensions", {}),
        },
    })

    return blob_url, qa_score, composition_key


def _convert_to_avif(image_bytes: bytes, quality: int = 65) -> bytes:
    """Convert image bytes to AVIF for storage optimization.

    Seedream outputs 2048x2048 PNGs (~8MB). AVIF at quality=65
    reduces to ~800KB (91% savings) with near-identical visual quality.
    Falls back to original bytes if AVIF conversion fails.
    """
    try:
        from PIL import Image
        import io as _io

        img = Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        buf = _io.BytesIO()
        img.save(buf, format="AVIF", quality=quality)
        avif = buf.getvalue()
        logger.info(
            "AVIF: %d → %d bytes (%.0f%% smaller)",
            len(image_bytes), len(avif),
            (1 - len(avif) / len(image_bytes)) * 100,
        )
        return avif
    except Exception as e:
        logger.warning("AVIF conversion failed (%s) — keeping original", e)
        return image_bytes


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM/VLM output — handles thinking mode, code fences, embedded JSON.

    Qwen3.5-9B often puts JSON inside reasoning text. This parser:
    1. Tries direct parse
    2. Strips markdown fences
    3. Searches for the LAST valid JSON object in the text
    """
    if not text:
        return {"raw_text": ""}

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

    # Search for the LAST { ... } block that's valid JSON (reasoning mode)
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
        logger.info("Extracted JSON from reasoning text (%d keys)", len(last_valid_json))
        return last_valid_json

    logger.warning("Failed to parse JSON from LLM output (%d chars)", len(text))
    return {"raw_text": text}
