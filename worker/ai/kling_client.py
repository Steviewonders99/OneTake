"""Kling 3.0 video generation via API.

Supports: text-to-video, image-to-video (start/end frame), multishot, references.
Uses the Kling API directly (klingai.com) with optional OpenRouter fallback.

Kling 3.0 capabilities:
- Text-to-video: generate from text prompt alone
- Image-to-video: use start frame (and optionally end frame) for control
- Multishot: up to 6 shots in 15 seconds, camera and character consistency
- References: up to 7 character/environment refs (2-3 recommended)
- Resolutions: 720p, 1080p
- Aspect ratios: 16:9, 9:16, 1:1
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx
import jwt
from config import KLING_ACCESS_KEY, KLING_MODEL, KLING_SECRET_KEY

logger = logging.getLogger(__name__)

KLING_API_BASE = "https://api.klingai.com/v1"


def _get_kling_token() -> str:
    """Generate a JWT token for Kling API authentication.

    Kling requires JWT signed with the secret key, containing
    the access key as issuer. Token is valid for 30 minutes.
    """
    now = int(time.time())
    payload = {
        "iss": KLING_ACCESS_KEY,
        "exp": now + 1800,  # 30 min
        "nbf": now - 5,
        "iat": now,
    }
    return jwt.encode(payload, KLING_SECRET_KEY, algorithm="HS256")

# Map human-readable aspect ratios to API values
ASPECT_RATIOS: dict[str, str] = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
    "landscape": "16:9",
    "portrait": "9:16",
    "square": "1:1",
}

# Polling configuration for async generation
POLL_INTERVAL_S = 5
MAX_POLL_ATTEMPTS = 120  # 10 minutes max wait


async def generate_video(
    prompt: str,
    start_frame: str | None = None,
    end_frame: str | None = None,
    references: list[str] | None = None,
    duration_s: int = 8,
    resolution: str = "1080p",
    aspect_ratio: str = "9:16",
) -> bytes:
    """Generate a video clip via Kling 3.0.

    Parameters
    ----------
    prompt:
        The text prompt describing the video content. Should follow the
        Kling formula: [CAMERA] + [SUBJECT] + [ACTION] + [ENVIRONMENT] +
        [LIGHTING] + [TEXTURE].
    start_frame:
        Optional URL or base64 of the starting frame image.
        Enables image-to-video mode for stronger control.
    end_frame:
        Optional URL or base64 of the ending frame image.
        Cannot be used together with multishot mode.
    references:
        List of character/environment reference image URLs (max 7, 2-3 recommended).
    duration_s:
        Target video duration in seconds (default 8, max 15).
    resolution:
        Video resolution — ``"720p"`` or ``"1080p"`` (default).
    aspect_ratio:
        Video aspect ratio — ``"16:9"``, ``"9:16"``, ``"1:1"`` (default ``"9:16"``).

    Returns
    -------
    bytes
        Raw video bytes (MP4).
    """
    resolved_ratio = ASPECT_RATIOS.get(aspect_ratio, "9:16")

    # Map resolution to Kling mode
    mode = "pro" if resolution == "1080p" else "std"

    payload: dict[str, Any] = {
        "model_name": KLING_MODEL,
        "prompt": prompt,
        "duration": str(min(duration_s, 15)),
        "mode": mode,
        "aspect_ratio": resolved_ratio,
        "sound": "on",  # Native audio generation
    }

    # Image-to-video mode — use image_list with first_frame/end_frame
    if start_frame:
        image_list = [{"image_url": start_frame, "type": "first_frame"}]
        if end_frame:
            image_list.append({"image_url": end_frame, "type": "end_frame"})
        payload["image_list"] = image_list

    # Character/environment references — use element_list or image_list
    if references:
        ref_images = payload.get("image_list", [])
        for ref_url in references[:7]:
            ref_images.append({"image_url": ref_url})
        payload["image_list"] = ref_images

    logger.info(
        "Kling generate_video: duration=%ds, resolution=%s, ratio=%s, "
        "start_frame=%s, refs=%d",
        duration_s, resolution, resolved_ratio,
        "yes" if start_frame else "no",
        len(references or []),
    )

    # Single-shot uses text2video (omni-video requires multi_shot=true)
    task_id = await _submit_task("videos/text2video", payload)

    # Poll for completion
    result = await _poll_task(task_id, endpoint="videos/text2video")

    # Download the video — Kling V3: data.task_result.videos[0].url
    task_result = result.get("task_result", {})
    videos = task_result.get("videos", [])
    video_url = videos[0].get("url", "") if videos else result.get("video_url", "")
    if not video_url:
        raise ValueError(f"Kling task {task_id} completed but returned no video URL")

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        logger.info("Video downloaded: %d bytes", len(resp.content))
        return resp.content


async def generate_multishot_video(
    shots: list[dict[str, Any]],
    references: list[str] | None = None,
    resolution: str = "1080p",
) -> bytes:
    """Generate a multishot video (up to 6 shots, 15s total).

    Each shot dict should contain:
    - ``prompt`` (str): The shot-level prompt.
    - ``duration_s`` (int): Duration for this shot.
    - ``camera`` (str): Camera movement description.
    - ``transition`` (str, optional): Transition from previous shot.

    Parameters
    ----------
    shots:
        List of shot dicts (max 6). Total duration must be <= 15s.
    references:
        Character/environment reference image URLs.
    resolution:
        Video resolution (default ``"1080p"``).

    Returns
    -------
    bytes
        Raw video bytes (MP4).
    """
    if len(shots) > 6:
        raise ValueError(f"Kling multishot supports max 6 shots, got {len(shots)}")

    total_duration = sum(s.get("duration_s", 2) for s in shots)
    if total_duration > 15:
        raise ValueError(f"Total duration {total_duration}s exceeds 15s limit")

    # Build Kling V3 multishot payload (per API spec)
    multi_prompt = []
    for i, shot in enumerate(shots):
        multi_prompt.append({
            "index": i + 1,
            "prompt": shot.get("prompt", ""),
            "duration": str(shot.get("duration_s", 2)),
        })

    mode = "pro" if resolution == "1080p" else "std"

    payload: dict[str, Any] = {
        "model_name": KLING_MODEL,
        "multi_shot": True,
        "shot_type": "customize",
        "prompt": "",  # Required but empty when multi_shot=true
        "multi_prompt": multi_prompt,
        "duration": str(total_duration),
        "mode": mode,
        "aspect_ratio": "9:16",
        "sound": "on",  # Native audio generation
    }

    # References go in image_list
    if references:
        payload["image_list"] = [{"image_url": ref} for ref in references[:7]]

    logger.info(
        "Kling multishot: %d shots, total %ds, refs=%d",
        len(shots), total_duration, len(references or []),
    )

    task_id = await _submit_task("videos/omni-video", payload)
    result = await _poll_task(task_id, endpoint="videos/omni-video")

    # Kling V3: data.task_result.videos[0].url
    task_result = result.get("task_result", {})
    videos = task_result.get("videos", [])
    video_url = videos[0].get("url", "") if videos else result.get("video_url", "")
    if not video_url:
        raise ValueError(f"Kling multishot task {task_id} completed but returned no video URL")

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(video_url)
        resp.raise_for_status()
        logger.info("Multishot video downloaded: %d bytes", len(resp.content))
        return resp.content


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _submit_task(endpoint: str, payload: dict) -> str:
    """Submit a generation task to the Kling API and return the task ID."""
    url = f"{KLING_API_BASE}/{endpoint}"

    logger.info("Kling API request: POST %s payload_keys=%s", url, list(payload.keys()))

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {_get_kling_token()}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code >= 400:
            logger.error("Kling API error %d: %s", resp.status_code, resp.text[:500])
        resp.raise_for_status()
        data = resp.json()

    # Kling V3 API wraps task info in data.task_id
    task_data = data.get("data", data)
    task_id = task_data.get("task_id", task_data.get("id", ""))
    if not task_id:
        raise ValueError(f"Kling API returned no task_id: {data}")

    logger.info("Kling task submitted: %s (status=%s)", task_id, task_data.get("task_status", "?"))
    return task_id


async def _poll_task(task_id: str, endpoint: str = "videos/text2video") -> dict:
    """Poll a Kling task until completion, failure, or timeout.

    Kling V3 API response format:
    {
        "code": 0,
        "data": {
            "task_id": "...",
            "task_status": "submitted|processing|succeed|failed",
            "task_result": { "videos": [{"url": "...", "duration": "..."}] }
        }
    }
    """
    url = f"{KLING_API_BASE}/{endpoint}/{task_id}"

    for attempt in range(MAX_POLL_ATTEMPTS):
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {_get_kling_token()}"},
            )
            resp.raise_for_status()
            raw = resp.json()

        # Kling V3 wraps everything in "data"
        data = raw.get("data", raw)
        status = data.get("task_status", data.get("status", "unknown"))

        if status in ("succeed", "completed", "succeeded", "done"):
            logger.info("Kling task %s completed after %d polls", task_id, attempt + 1)
            return data

        if status in ("failed", "error", "cancelled"):
            error_msg = data.get("task_status_msg", data.get("error", "Unknown error"))
            raise RuntimeError(f"Kling task {task_id} failed: {error_msg}")

        if status in ("submitted", "pending", "processing", "running", "queued"):
            if attempt % 6 == 0:  # Log every 30s
                logger.info(
                    "Kling task %s: %s (poll %d/%d, ~%ds)",
                    task_id, status, attempt + 1, MAX_POLL_ATTEMPTS,
                    attempt * POLL_INTERVAL_S,
                )
            await asyncio.sleep(POLL_INTERVAL_S)
            continue

        logger.warning("Kling task %s: unexpected status '%s'", task_id, status)
        await asyncio.sleep(POLL_INTERVAL_S)

    raise TimeoutError(
        f"Kling task {task_id} did not complete within "
        f"{MAX_POLL_ATTEMPTS * POLL_INTERVAL_S}s"
    )
