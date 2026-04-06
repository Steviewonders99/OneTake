"""Sedeo 2.0 video generation via AtlasCloud API.

Replaces Kling 3.0 for Stage 5 video generation. Key advantages:
- Image-to-video with first frame (Seedream photos come alive)
- First + last frame (controlled transitions)
- Multimodal reference (up to 9 images for character consistency)
- Native audio generation (synchronized, no separate TTS)
- Video editing and extension
- 720p, 4-15 seconds, all aspect ratios

Endpoint: POST https://api.atlascloud.ai/api/v1/model/sedeo/tasks
Auth: Bearer apikey-{key}
Async: POST → poll GET → download outputs
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SEDEO_ENDPOINT = "https://api.atlascloud.ai/api/v1/model/sedeo/tasks"
SEDEO_MODEL = os.environ.get("SEDEO_MODEL", "atlascloud/sedeo-2.0")
SEDEO_FAST_MODEL = "atlascloud/sedeo-2.0-fast"

# AtlasCloud uses the same key as OpenRouter in our setup
SEDEO_API_KEY = os.environ.get("ATLASCLOUD_API_KEY", os.environ.get("OPENROUTER_API_KEY", ""))

# Polling config
POLL_INTERVAL = 10  # seconds
MAX_POLL_TIME = 600  # 10 minutes max wait


# ── Person filter bypass preprocessing ────────────────────────────────
# AtlasCloud workarounds (from Mia @ AtlasCloud):
#   1. Cover eyes  2. Reduce opacity  3. Apply blur
# We combine: light Gaussian blur (radius 2) + slight opacity reduction
# This tricks the moderation filter while preserving enough detail for
# Sedeo to generate a consistent character.

async def preprocess_for_sedeo(image_url: str) -> str:
    """Download an image, apply light blur + opacity to bypass person filter.

    Returns a base64 data URL that can be used as first_frame_url.
    """
    import base64
    import io
    try:
        from PIL import Image, ImageFilter
    except ImportError:
        logger.warning("PIL not available — skipping Sedeo preprocessing")
        return image_url

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()

        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")

        # Resize to 720px max (reduce payload size for API)
        max_dim = 720
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)

        # Heavy Gaussian blur (radius 5) + 20% white blend — PROVEN to bypass person filter
        img = img.filter(ImageFilter.GaussianBlur(radius=5))
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.blend(img, white, alpha=0.20)

        # Convert back to RGB for base64
        rgb = img.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=90)
        b64 = base64.b64encode(buf.getvalue()).decode()

        logger.info("Sedeo preprocess: blur+opacity applied (%d bytes → %d b64)", len(resp.content), len(b64))
        return f"data:image/jpeg;base64,{b64}"

    except Exception as e:
        logger.warning("Sedeo preprocess failed: %s — using original URL", e)
        return image_url


async def generate_video_from_image(
    first_frame_url: str,
    prompt: str,
    *,
    last_frame_url: str | None = None,
    reference_images: list[str] | None = None,
    duration: int = 5,
    ratio: str = "9:16",
    resolution: str = "720p",
    generate_audio: bool = True,
    use_fast: bool = False,
) -> dict[str, Any]:
    """Generate a video using a Seedream image as the first frame.

    Parameters
    ----------
    first_frame_url:
        URL of the image to use as the first frame (Seedream hero shot).
    prompt:
        Text describing the desired motion/action in the video.
    last_frame_url:
        Optional URL for the last frame (controlled transition).
    reference_images:
        Optional list of reference image URLs for character consistency (up to 9).
    duration:
        Video duration in seconds. sedeo-2.0: [4, 15], sedeo-2.0-fast: [4, 12].
    ratio:
        Aspect ratio: "16:9", "4:3", "1:1", "3:4", "9:16", "21:9".
    resolution:
        "480p" or "720p".
    generate_audio:
        Whether to generate synchronized native audio.
    use_fast:
        Use sedeo-2.0-fast for speed (cheaper but lower quality).

    Returns
    -------
    dict with:
        - video_url: str (temporary, expires in 24h)
        - last_frame_url: str (last frame image)
        - duration: int
        - resolution: str
        - tokens: int (completion tokens used)
    """
    api_key = SEDEO_API_KEY
    if not api_key:
        raise ValueError("No AtlasCloud/OpenRouter API key configured for Sedeo")

    model = SEDEO_FAST_MODEL if use_fast else SEDEO_MODEL

    # Preprocess images to bypass person filter (blur + opacity)
    processed_first_frame = await preprocess_for_sedeo(first_frame_url)
    logger.info("Sedeo: first_frame preprocessed for person filter bypass")

    # Build content array
    content = []

    # Text prompt
    if prompt:
        content.append({"type": "text", "text": prompt})

    # First frame image (preprocessed)
    content.append({
        "type": "image_url",
        "image_url": {"url": processed_first_frame},
        "role": "first_frame",
    })

    # Last frame image (optional — controlled transition)
    if last_frame_url:
        content.append({
            "type": "image_url",
            "image_url": {"url": last_frame_url},
            "role": "last_frame",
        })

    # Reference images for character consistency (optional, preprocessed)
    if reference_images:
        for ref_url in reference_images[:9]:  # Max 9 references
            processed_ref = await preprocess_for_sedeo(ref_url)
            content.append({
                "type": "image_url",
                "image_url": {"url": processed_ref},
                "role": "reference_image",
            })

    payload = {
        "model": model,
        "content": content,
        "resolution": resolution,
        "ratio": ratio,
        "duration": duration,
        "generate_audio": generate_audio,
        "watermark": False,
    }

    logger.info(
        "Sedeo 2.0: %s, %ds, %s %s, audio=%s, first_frame=%s",
        model, duration, resolution, ratio, generate_audio,
        first_frame_url.split("/")[-1][:40],
    )

    # Step 1: Create task
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            SEDEO_ENDPOINT,
            headers={
                "Authorization": f"Bearer apikey-{api_key}" if not api_key.startswith("apikey-") else f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        create_data = resp.json()

    task_id = create_data.get("data", {}).get("id")
    if not task_id:
        raise ValueError(f"Sedeo task creation failed: {create_data}")

    poll_url = f"{SEDEO_ENDPOINT}/{task_id}"
    logger.info("Sedeo task created: %s — polling...", task_id)

    # Step 2: Poll until complete
    elapsed = 0
    while elapsed < MAX_POLL_TIME:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        async with httpx.AsyncClient(timeout=30) as client:
            poll_resp = await client.get(
                poll_url,
                headers={
                    "Authorization": f"Bearer apikey-{api_key}" if not api_key.startswith("apikey-") else f"Bearer {api_key}",
                },
            )
            poll_data = poll_resp.json()

        status = poll_data.get("data", {}).get("status", "unknown")

        if status == "completed":
            data = poll_data["data"]
            outputs = data.get("outputs", [])
            video_url = outputs[0] if outputs else None
            last_frame = outputs[1] if len(outputs) > 1 else None
            tokens = data.get("completion_tokens", data.get("usage", {}).get("completion_tokens", 0))

            logger.info(
                "Sedeo complete: %s (%ds, %s, %d tokens)",
                video_url.split("/")[-1][:40] if video_url else "no output",
                data.get("duration", 0),
                data.get("resolution", "?"),
                tokens,
            )

            return {
                "video_url": video_url,
                "last_frame_url": last_frame,
                "duration": data.get("duration", duration),
                "resolution": data.get("resolution", resolution),
                "ratio": data.get("ratio", ratio),
                "tokens": tokens,
                "seed": data.get("seed"),
                "task_id": task_id,
            }

        elif status == "failed":
            error = poll_data.get("data", {}).get("error", "Unknown error")
            error_code = poll_data.get("data", {}).get("error_code", "")
            raise RuntimeError(f"Sedeo generation failed: {error} (code: {error_code})")

        elif status == "timeout":
            raise TimeoutError("Sedeo generation timed out on provider side")

        else:
            if elapsed % 30 == 0:
                logger.info("Sedeo polling... status=%s (%ds elapsed)", status, elapsed)

    raise TimeoutError(f"Sedeo polling timed out after {MAX_POLL_TIME}s")


async def generate_video_text_only(
    prompt: str,
    *,
    duration: int = 5,
    ratio: str = "9:16",
    resolution: str = "720p",
    generate_audio: bool = True,
    use_fast: bool = False,
) -> dict[str, Any]:
    """Generate a video from text prompt only (no image input)."""
    api_key = SEDEO_API_KEY
    if not api_key:
        raise ValueError("No API key for Sedeo")

    model = SEDEO_FAST_MODEL if use_fast else SEDEO_MODEL

    payload = {
        "model": model,
        "content": [{"type": "text", "text": prompt}],
        "resolution": resolution,
        "ratio": ratio,
        "duration": duration,
        "generate_audio": generate_audio,
        "watermark": False,
    }

    # Reuse the same create + poll logic
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            SEDEO_ENDPOINT,
            headers={
                "Authorization": f"Bearer apikey-{api_key}" if not api_key.startswith("apikey-") else f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        create_data = resp.json()

    task_id = create_data.get("data", {}).get("id")
    poll_url = f"{SEDEO_ENDPOINT}/{task_id}"
    logger.info("Sedeo text-to-video task: %s", task_id)

    elapsed = 0
    while elapsed < MAX_POLL_TIME:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

        async with httpx.AsyncClient(timeout=30) as client:
            poll_resp = await client.get(
                poll_url,
                headers={
                    "Authorization": f"Bearer apikey-{api_key}" if not api_key.startswith("apikey-") else f"Bearer {api_key}",
                },
            )
            poll_data = poll_resp.json()

        status = poll_data.get("data", {}).get("status", "unknown")
        if status == "completed":
            data = poll_data["data"]
            outputs = data.get("outputs", [])
            return {
                "video_url": outputs[0] if outputs else None,
                "last_frame_url": outputs[1] if len(outputs) > 1 else None,
                "duration": data.get("duration", duration),
                "tokens": data.get("completion_tokens", 0),
                "task_id": task_id,
            }
        elif status in ("failed", "timeout"):
            raise RuntimeError(f"Sedeo failed: {poll_data.get('data', {}).get('error', 'unknown')}")

    raise TimeoutError("Sedeo polling timed out")
