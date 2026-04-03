"""Image editing via Flux.2 Pro on OpenRouter.

Used as the retry/cleanup step when Seedream-generated images fail VQA.
Flux.2 Pro excels at in-place editing with strong character preservation —
removes watermarks, text overlays, and artifacts while keeping the person
and scene nearly identical.

Cost: $0.03 per edit via OpenRouter.
"""
from __future__ import annotations

import base64
import json
import logging

import httpx

from config import OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

FLUX_EDIT_MODEL = "black-forest-labs/flux.2-pro"

DEFAULT_CLEANUP_PROMPT = (
    "Remove all text overlays, watermarks, captions, logos, Chinese characters, "
    "stock photo IDs, hashtags, and any gibberish text on clothing or accessories. "
    "Keep the person, pose, clothing, and background exactly the same. "
    "Output a clean photo."
)


async def edit_image_flux(
    image_bytes: bytes,
    edit_prompt: str | None = None,
    mime_type: str = "image/jpeg",
) -> bytes:
    """Edit an image using Flux.2 Pro via OpenRouter.

    Parameters
    ----------
    image_bytes:
        Source image bytes (JPEG or PNG). Will be sent as base64 data URI.
    edit_prompt:
        What to change. Defaults to watermark/text removal.
    mime_type:
        MIME type of the input image.

    Returns
    -------
    bytes
        Edited image bytes.
    """
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not configured")

    prompt = edit_prompt or DEFAULT_CLEANUP_PROMPT
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": FLUX_EDIT_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
            ],
        }],
    }

    logger.info("Flux.2 Pro Edit: %s (%d bytes input)", prompt[:60], len(image_bytes))

    async with httpx.AsyncClient(timeout=httpx.Timeout(
        connect=30.0, read=300.0, write=30.0, pool=30.0
    )) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    msg = data.get("choices", [{}])[0].get("message", {})
    images = msg.get("images", [])

    if not images:
        # Check content for inline image
        content = msg.get("content", "")
        if content and "base64" in str(content)[:100]:
            if "data:image" in content:
                b64_part = content.split(",", 1)[-1]
                result = base64.b64decode(b64_part)
                logger.info("Flux.2 Pro Edit complete (content field): %d bytes", len(result))
                return result
        raise ValueError(f"Flux.2 Pro returned no images. Content: {str(content)[:200]}")

    img0 = images[0]

    # Handle OpenAI vision format: {type: image_url, image_url: {url: "data:..."}}
    if isinstance(img0, dict):
        url_data = img0.get("image_url", {})
        if isinstance(url_data, dict):
            url = url_data.get("url", "")
        else:
            url = str(url_data)

        if url.startswith("data:image"):
            b64_part = url.split(",", 1)[1]
            result = base64.b64decode(b64_part)
            logger.info("Flux.2 Pro Edit complete (data URI): %d bytes", len(result))
            return result
        elif url.startswith("http"):
            async with httpx.AsyncClient(timeout=60) as dl:
                img_resp = await dl.get(url)
                img_resp.raise_for_status()
                result = img_resp.content
                logger.info("Flux.2 Pro Edit complete (URL): %d bytes", len(result))
                return result

        # Direct base64 format
        if "b64_json" in img0:
            result = base64.b64decode(img0["b64_json"])
            logger.info("Flux.2 Pro Edit complete (b64_json): %d bytes", len(result))
            return result

    # Raw base64 string
    if isinstance(img0, str):
        if img0.startswith("data:image"):
            b64_part = img0.split(",", 1)[-1]
            return base64.b64decode(b64_part)
        elif img0.startswith("http"):
            async with httpx.AsyncClient(timeout=60) as dl:
                img_resp = await dl.get(img0)
                return img_resp.content
        else:
            return base64.b64decode(img0)

    raise ValueError(f"Unexpected image format from Flux.2 Pro: {type(img0)}")
