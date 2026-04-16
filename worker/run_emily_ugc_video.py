"""Generate a full 12-second UGC video of Emily explaining OneForma via Sedeo 2.0.

Uses Gemma 27B to write an authentic UGC script, then sends Emily's best base
image to Sedeo 2.0 (full quality, sound on) for image-to-video generation.
"""
import asyncio
import json
import logging
import sys
import uuid

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")
logger = logging.getLogger("emily_ugc")

ACTOR_ID = "3f5fdf24-8b4c-4c28-ae86-eb202078f653"
REQUEST_ID = "54be6d4c-8db1-4b6e-9566-7ac2da2b4ab9"


async def main():
    sys.path.insert(0, ".")
    import httpx
    from ai.local_llm import generate_copy
    from ai.sedeo_client import generate_video_from_image
    from blob_uploader import upload_to_blob
    from neon_client import _get_pool, save_asset

    pool = await _get_pool()

    # ── 1. Load Emily ──
    actor_row = await pool.fetchrow("SELECT * FROM actor_profiles WHERE id = $1", ACTOR_ID)
    if not actor_row:
        logger.error("Emily not found")
        return
    actor = dict(actor_row)
    fl = json.loads(actor["face_lock"]) if isinstance(actor["face_lock"], str) else actor["face_lock"]
    logger.info("Actor: %s | persona=%s | age=%s",
                actor["name"], fl.get("persona_key"), fl.get("age_range"))

    # ── 2. Best base image ──
    imgs = await pool.fetch(
        """SELECT blob_url, evaluation_score, content FROM generated_assets
           WHERE actor_id = $1 AND asset_type = 'base_image' AND blob_url IS NOT NULL
           ORDER BY evaluation_score DESC NULLS LAST LIMIT 3""",
        ACTOR_ID,
    )
    if not imgs:
        logger.error("No base images")
        return
    first_frame_url = imgs[0]["blob_url"]
    reference_urls = [img["blob_url"] for img in imgs[1:]]
    logger.info("First frame: %s (score %s)", first_frame_url[:80], imgs[0]["evaluation_score"])
    logger.info("References: %d", len(reference_urls))

    # ── 3. Brief context ──
    brief_row = await pool.fetchrow(
        "SELECT brief_data FROM creative_briefs WHERE request_id = $1 LIMIT 1", REQUEST_ID
    )
    brief = {}
    if brief_row:
        brief = json.loads(brief_row["brief_data"]) if isinstance(brief_row["brief_data"], str) else brief_row["brief_data"]

    persona_name = fl.get("persona_name", "pre-med undergraduate")
    age_range = fl.get("age_range", "19-23")
    hair = fl.get("hair", "dark brown wavy hair in a claw clip")

    # ── 4. Gemma generates the FULL UGC script ──
    logger.info("Calling Gemma 27B to write a real UGC script...")

    system = f"""You are a UGC content director writing a 12-second authentic vertical video script.

The talent is Emily — a {age_range} year old American pre-med undergraduate. {hair}, hazel eyes.
She's recording a casual phone-selfie video about OneForma — a platform that pays her to contribute health-related conversation data for AI training.

WHAT IS ONEFORMA: A global data annotation platform that recruits contributors for AI training tasks (audio recordings, conversations, image labeling, medical data collection). Pays per task. Flexible. Remote.

EMILY'S PERSONA: Pre-med student. Loves the intersection of healthcare + AI. Uses OneForma to earn money during study breaks while contributing to medical AI research.

REAL UGC FEEL: Authentic, conversational, slightly imperfect — not polished marketing speak. She's talking like she's telling a friend in her dorm room. Slight ums, casual phrases, real enthusiasm. Like a TikTok storytime."""

    user_prompt = """Write a 12-second authentic UGC script for Emily explaining OneForma.

The video is ONE continuous shot — she speaks to her phone camera the whole time.
Sedeo 2.0 will generate synchronized lip-sync audio from your script.

Return ONLY valid JSON:
{
  "hook_2s": "The first 2 seconds — what stops the scroll. Must be a question or shocking statement.",
  "full_dialogue": "The COMPLETE 12-second spoken script (~30-35 words). Casual, conversational English. Natural speech patterns. Emily explaining what OneForma is and why she loves it. Include the word 'OneForma' once. End with a soft CTA like 'check it out' or 'link in bio'.",
  "visual_action": "What Emily is doing visually during the 12 seconds — facial expressions, hand gestures, head movements, micro-actions. Be specific: 'leans toward camera at 3s, smiles wide at 7s, raises eyebrows at 10s'",
  "setting": "Where she is — a cozy dorm room with soft warm lamp light, textbooks visible behind her",
  "full_sedeo_prompt": "ONE detailed prompt for Sedeo 2.0 (max 500 chars) combining: subject + speaking action + dialogue intent + camera framing + lighting + setting + audio direction. MUST include 'speaks directly to camera with natural lip movement, synchronized audio, casual vlog tone, authentic UGC style'. End with the actual dialogue in quotes for audio sync."
}

Make it feel REAL. Like she just opened her phone and started recording."""

    script_text = await generate_copy(system, user_prompt)
    script = _parse_json(script_text)

    if not script.get("full_dialogue") or not script.get("full_sedeo_prompt"):
        logger.error("Script generation failed. Raw output:\n%s", script_text[:1000])
        return

    logger.info("=" * 70)
    logger.info("HOOK: %s", script.get("hook_2s"))
    logger.info("DIALOGUE: %s", script.get("full_dialogue"))
    logger.info("VISUAL: %s", script.get("visual_action"))
    logger.info("SETTING: %s", script.get("setting"))
    logger.info("SEDEO PROMPT: %s", script.get("full_sedeo_prompt")[:300])
    logger.info("=" * 70)

    # ── 5. Send to Sedeo 2.0 (FULL quality, 12s, sound on) ──
    logger.info("Submitting to Sedeo 2.0 (12s, 720p 9:16, audio ON)...")
    result = await generate_video_from_image(
        first_frame_url=first_frame_url,
        prompt=script["full_sedeo_prompt"],
        reference_images=None,  # Skip refs to keep payload small
        duration=12,
        ratio="9:16",
        resolution="720p",
        generate_audio=True,
        use_fast=False,
    )

    video_url = result.get("video_url")
    if not video_url:
        logger.error("Sedeo returned no video URL: %s", result)
        return

    logger.info("Sedeo video URL: %s", video_url)
    logger.info("Duration: %s | Resolution: %s | Tokens: %s",
                result.get("duration"), result.get("resolution"), result.get("tokens"))

    # ── 6. Download and upload to Vercel Blob ──
    logger.info("Downloading video from Sedeo...")
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        video_bytes = resp.content
    logger.info("Downloaded %.1f MB", len(video_bytes) / 1024 / 1024)

    filename = f"video_emily_ugc_{uuid.uuid4().hex[:8]}.mp4"
    blob_url = await upload_to_blob(
        video_bytes,
        filename,
        folder=f"requests/{REQUEST_ID}/videos",
        content_type="video/mp4",
    )
    logger.info("Uploaded to Vercel Blob: %s", blob_url)

    # ── 7. Save to Neon ──
    await save_asset(REQUEST_ID, {
        "asset_type": "video",
        "platform": "tiktok",
        "format": "1080x1920",
        "language": "en-US",
        "blob_url": blob_url,
        "actor_id": ACTOR_ID,
        "content": {
            "actor_name": "Emily",
            "persona_key": fl.get("persona_key"),
            "script": script,
            "sedeo_video_url": video_url,
            "sedeo_task_id": result.get("task_id"),
            "sound": "on",
            "duration_s": result.get("duration", 12),
            "resolution": result.get("resolution", "720p"),
        },
        "stage": 5,
    })

    logger.info("=" * 70)
    logger.info("DONE!")
    logger.info("Watch: %s", blob_url)
    logger.info("Sedeo temp URL (24h): %s", video_url)
    logger.info("=" * 70)


def _parse_json(text: str) -> dict:
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
    # Brace search — find LARGEST valid object
    best = None
    best_size = 0
    for i, c in enumerate(cleaned):
        if c == '{':
            depth = 0
            for j in range(i, len(cleaned)):
                if cleaned[j] == '{':
                    depth += 1
                elif cleaned[j] == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            parsed = json.loads(cleaned[i:j+1])
                            if isinstance(parsed, dict) and len(parsed) > best_size:
                                best = parsed
                                best_size = len(parsed)
                        except json.JSONDecodeError:
                            pass
                        break
    return best or {}


if __name__ == "__main__":
    asyncio.run(main())
