"""Image editing via Gemini 3.1 Flash Image Preview (Google AI Studio).

Used as the retry/cleanup step when Seedream-generated images fail VQA
due to watermarks, text overlays, Chinese characters, or other artifacts.

Gemini excels at in-place editing (artifact removal) while preserving
the overall scene. Character consistency may drift slightly — acceptable
for recruitment ads where exact face-lock isn't required on retries.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.1-flash-image-preview"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# Default edit prompt for VQA retry cleanup
DEFAULT_CLEANUP_PROMPT = (
    "Edit this photo: Remove ALL text overlays, watermarks, brand logos, "
    "Chinese characters, stock photo IDs, hashtags, gibberish text on clothing "
    "or accessories, and any social media UI elements. "
    "Keep the person, pose, background, and clothing the same. "
    "Output only the cleaned photo."
)


async def edit_image_gemini(
    image_bytes: bytes,
    edit_prompt: str | None = None,
    mime_type: str = "image/jpeg",
) -> bytes:
    """Edit an image using Gemini 3.1 Flash Image Preview.

    Parameters
    ----------
    image_bytes:
        Source image bytes (JPEG or PNG).
    edit_prompt:
        What to change. Defaults to artifact/watermark removal.
    mime_type:
        MIME type of the input image.

    Returns
    -------
    bytes
        Edited image bytes (PNG).

    Raises
    ------
    ValueError
        If Gemini returns no image or the API key is missing.
    RuntimeError
        If the API call fails.
    """
    api_key = GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    prompt = edit_prompt or DEFAULT_CLEANUP_PROMPT
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": b64}},
            ]
        }],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
        },
    }

    url = f"{GEMINI_ENDPOINT}?key={api_key}"

    logger.info("Gemini Edit: %s (%d bytes input)", prompt[:60], len(image_bytes))

    # Use urllib (sync) wrapped in asyncio — Gemini doesn't need async client
    import asyncio
    loop = asyncio.get_event_loop()

    def _call():
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            resp = urllib.request.urlopen(req, timeout=180)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:300]
            raise RuntimeError(f"Gemini API error {e.code}: {body}")

    data = await loop.run_in_executor(None, _call)

    # Extract image from response
    candidates = data.get("candidates", [])
    if not candidates:
        feedback = data.get("promptFeedback", {})
        raise ValueError(f"Gemini returned no candidates. Feedback: {feedback}")

    parts = candidates[0].get("content", {}).get("parts", [])
    for part in parts:
        if "inlineData" in part:
            img_data = base64.b64decode(part["inlineData"]["data"])
            logger.info("Gemini Edit complete: %d bytes output", len(img_data))
            return img_data
        elif "text" in part:
            logger.info("Gemini text response: %s", part["text"][:200])

    raise ValueError("Gemini returned no image in response")
