"""Manual trigger: Generate a Kling 3.0 video for Camila with sound ON.

1. Load Camila's actor profile + top reference images
2. Load brief context
3. Gemma 3 writes the video script (peer voice, persona-targeted)
4. Kling 3.0 generates video with sound=on + character references
5. Upload to Vercel Blob
"""
import asyncio
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")
logger = logging.getLogger("camila_video")

ACTOR_ID = "6050be9a-02bc-4340-bf8c-52846e09e4d5"
REQUEST_ID = "fd318779-45f2-45bb-b0ff-5420c5c10260"


async def main():
    import uuid

    from ai.kling_client import generate_video
    from ai.local_llm import generate_copy
    from blob_uploader import upload_to_blob
    from neon_client import _get_pool, save_asset

    pool = await _get_pool()

    # ── 1. Load Camila's data ──
    logger.info("Loading Camila's actor profile...")
    actor_row = await pool.fetchrow(
        "SELECT * FROM actor_profiles WHERE id = $1", ACTOR_ID
    )
    if not actor_row:
        logger.error("Actor not found: %s", ACTOR_ID)
        return

    actor = dict(actor_row)
    face_lock = json.loads(actor["face_lock"]) if isinstance(actor["face_lock"], str) else actor["face_lock"]
    actor["face_lock"] = face_lock
    logger.info("Actor: %s (age: %s)", actor["name"], face_lock.get("age_range", "?"))

    # ── 2. Load reference images (top scored) ──
    logger.info("Loading reference images...")
    images = await pool.fetch(
        """SELECT blob_url FROM generated_assets
           WHERE actor_id = $1 AND asset_type = 'base_image' AND blob_url IS NOT NULL
           ORDER BY evaluation_score DESC NULLS LAST LIMIT 3""",
        ACTOR_ID,
    )
    reference_urls = [img["blob_url"] for img in images if img["blob_url"]]
    logger.info("Reference images: %d", len(reference_urls))
    for url in reference_urls:
        logger.info("  %s", url[:80])

    # ── 3. Load brief ──
    brief_row = await pool.fetchrow(
        "SELECT brief_data FROM creative_briefs WHERE request_id = $1 LIMIT 1",
        REQUEST_ID,
    )
    brief = {}
    if brief_row:
        brief = json.loads(brief_row["brief_data"]) if isinstance(brief_row["brief_data"], str) else brief_row["brief_data"]
    logger.info("Brief loaded: %s", str(brief.get("campaign_objective", ""))[:100])

    # ── 4. Generate script with Gemma 3 (peer voice) ──
    logger.info("Generating video script with Gemma 3...")

    script_system = f"""You are a UGC video director creating a 10-second vertical video ad for OneForma.

The video stars Camila — a {face_lock.get('age_range', '32-36')} year old woman from Brazil with {face_lock.get('hair', 'dark curly hair')}, {face_lock.get('eye_color', 'hazel')} eyes, and {face_lock.get('skin_tone_hex', 'warm')} skin tone.

The video is a selfie-style talking head where Camila speaks directly to camera — like a TikTok or Instagram Reel.

SOUND IS ON — Kling will generate synchronized audio + lip movement from your script.

Write the script as if Camila is recording a casual, authentic video telling her friends about OneForma."""

    brief_context = json.dumps({
        "objective": brief.get("campaign_objective", "Recruit contributors in Brazil"),
        "task_type": brief.get("task_type", "audio data collection"),
        "value_props": brief.get("value_props", brief.get("messaging_strategy", {}).get("value_propositions", [])),
    }, default=str, indent=2)

    script_prompt = f"""Write a 10-second video script for Camila (OneForma contributor from Brazil).

CAMPAIGN CONTEXT:
{brief_context}

FORMAT — Return ONLY valid JSON:
{{
  "hook": "The opening 2-second hook (what stops the scroll)",
  "script_text": "The full spoken dialogue — casual Brazilian Portuguese, ~25-30 words max for 10 seconds",
  "script_text_english": "English translation of the dialogue",
  "camera_direction": "Camera movement and framing notes for Kling",
  "visual_description": "What Camila is doing visually — expressions, gestures, setting",
  "target_platform": "tiktok",
  "estimated_duration_s": 10,
  "kling_prompt": "A single detailed prompt for Kling 3.0 combining camera + subject + action + environment + lighting. This is what Kling will use to generate the video. Include: close-up selfie angle, warm natural lighting, Camila speaking to camera with expressive gestures, authentic Brazilian home/cafe setting. End with 'Natural ambient sound, warm tone.' to activate sound generation."
}}

The kling_prompt is the MOST IMPORTANT field — it must be specific enough for Kling to generate a realistic talking head video with sound.
Include the phrase "speaking to camera" and "natural ambient sound" in the kling_prompt to ensure lip sync and audio generation."""

    script_text = await generate_copy(script_system, script_prompt)

    # Parse script
    script = _parse_json(script_text)
    if "raw_text" in script:
        logger.error("Failed to parse script JSON. Raw:\n%s", script_text[:500])
        return

    logger.info("Script generated:")
    logger.info("  Hook: %s", script.get("hook", "?"))
    logger.info("  Dialogue: %s", script.get("script_text", "?"))
    logger.info("  English: %s", script.get("script_text_english", "?"))
    logger.info("  Kling prompt: %s", script.get("kling_prompt", "?")[:200])

    # ── 5. Generate video with Kling 3.0 (sound ON) ──
    kling_prompt = script.get("kling_prompt", "")
    if not kling_prompt:
        kling_prompt = (
            f"Close-up selfie angle, young Brazilian woman ({face_lock.get('hair', 'dark curly hair')}, "
            f"{face_lock.get('eye_color', 'hazel eyes')}), speaking excitedly to camera, "
            f"warm natural lighting, authentic home setting, gesturing with hands, "
            f"genuine smile, TikTok style. Natural ambient sound, warm conversational tone."
        )

    logger.info("Calling Kling 3.0 with sound=on...")
    logger.info("  Prompt: %s", kling_prompt[:200])
    logger.info("  References: %d images", len(reference_urls))

    try:
        # Use image-to-video with the best reference as start frame
        start_frame = reference_urls[0] if reference_urls else None
        additional_refs = reference_urls[1:3] if len(reference_urls) > 1 else None

        video_bytes = await generate_video(
            prompt=kling_prompt,
            start_frame=start_frame,
            references=additional_refs,
            duration_s=10,
            resolution="1080p",
            aspect_ratio="9:16",
        )
        logger.info("Video generated: %d bytes (%.1f MB)", len(video_bytes), len(video_bytes) / 1024 / 1024)
    except Exception as e:
        logger.error("Kling generation failed: %s", e)
        logger.info("Retrying with text-to-video only (no image reference)...")
        try:
            video_bytes = await generate_video(
                prompt=kling_prompt,
                duration_s=10,
                resolution="1080p",
                aspect_ratio="9:16",
            )
            logger.info("Text-to-video succeeded: %d bytes", len(video_bytes))
        except Exception as e2:
            logger.error("Text-to-video also failed: %s", e2)
            return

    # ── 6. Upload to Vercel Blob ──
    filename = f"video_camila_{uuid.uuid4().hex[:8]}.mp4"
    logger.info("Uploading to Vercel Blob: %s", filename)
    blob_url = await upload_to_blob(
        video_bytes,
        filename,
        folder=f"requests/{REQUEST_ID}/videos",
        content_type="video/mp4",
    )
    logger.info("Uploaded: %s", blob_url)

    # ── 7. Save asset to Neon ──
    await save_asset(REQUEST_ID, {
        "asset_type": "video",
        "platform": "tiktok",
        "format": "1080x1920",
        "language": "pt-BR",
        "blob_url": blob_url,
        "metadata": {
            "actor_id": ACTOR_ID,
            "actor_name": "Camila",
            "script": script,
            "kling_prompt": kling_prompt,
            "reference_count": len(reference_urls),
            "sound": "on",
            "duration_s": 10,
        },
        "stage": 5,
    })
    logger.info("Asset saved to Neon. DONE!")
    logger.info("Watch at: %s", blob_url)


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output."""
    if not text:
        return {"raw_text": ""}
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
                    parsed = json.loads(cleaned[start:i+1])
                    if isinstance(parsed, dict) and len(parsed) > 1:
                        last = parsed
                except json.JSONDecodeError:
                    pass
                start = -1
    return last or {"raw_text": text}


if __name__ == "__main__":
    asyncio.run(main())
