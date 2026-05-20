"""Image generation — OpenAI direct (primary) or OpenRouter (fallback).

Uses OpenAI Images API when OPENAI_API_KEY is set ($0.006/image at low quality).
Falls back to OpenRouter chat/completions if no OpenAI key.
Provider is selected via IMAGE_MODEL env var.
Quality (low/medium/high) controlled via IMAGE_QUALITY env var.
"""
from __future__ import annotations

import base64
import logging
import os

import httpx
from config import IMAGE_MODEL, IMAGE_QUALITY, OPENAI_API_KEY, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

DIMENSIONS: dict[str, tuple[int, int]] = {
    "square": (1080, 1080),
    "feed_portrait": (1080, 1350),
    "landscape": (1200, 628),
    "portrait": (1080, 1920),
    "linkedin": (1200, 627),
    "telegram": (1280, 720),
    "twitter": (1200, 675),
    "indeed": (1200, 628),
    "facebook": (1080, 1080),
    "google_display": (1200, 628),
    "tiktok": (1080, 1920),
}


async def generate_image(
    prompt: str,
    dimension_key: str = "square",
    negative_prompt: str = "",
) -> bytes:
    """Generate an image via Seedream 4.5 on OpenRouter.

    Uses /api/v1/chat/completions — Seedream returns image in
    message.images[] field (base64 or URL).

    Parameters
    ----------
    prompt:
        The text-to-image prompt. Should include realism anchors.
    dimension_key:
        A key into ``DIMENSIONS`` (e.g. ``"square"``, ``"landscape"``).
    negative_prompt:
        Optional negative prompt for things to avoid.

    Returns
    -------
    bytes
        Raw image bytes (PNG/JPEG).
    """
    width, height = DIMENSIONS.get(dimension_key, (1080, 1080))

    default_negative = (
        "cartoon, anime, illustration, 3d render, painting, watermark, "
        "text overlay, blurry, distorted hands, extra fingers, "
        "corporate stock photo, stiff pose, oversaturated, "
        "scars, cuts, wounds, bruises, scratches on face, scabs, acne, "
        "blemishes, skin defects, forehead marks, forehead cuts, forehead scars, "
        "cheek scars, skin lesions, stitches, bandages, band-aid on face, "
        "unwashed, disheveled, stained clothes, dirty clothes, greasy hair, "
        "dirty fingernails, grime on skin, sweat stains, "
        "dirty room, messy room, cracked walls, peeling paint, trash, debris, "
        "slum, poverty, rundown, dilapidated, broken furniture, "
        "dusty surfaces, grime, stained surfaces, scuff marks, drip stains, "
        "swimming pool, mansion, luxury car, yacht, penthouse, "
        "hex code on screen, debug text, placeholder text, gibberish text on device, "
        "fake money, fake currency, fake UI, fake app screenshot"
    )
    neg = negative_prompt or default_negative

    full_prompt = (
        f"{prompt}\n\n"
        f"Image dimensions: {width}x{height}px.\n"
        f"Avoid: {neg}"
    )

    # ── OpenRouter primary (gpt-5.4-image-2 via OpenRouter) ──
    if OPENROUTER_API_KEY:
        return await _generate_via_openrouter(full_prompt, width, height)

    raise ValueError("No image generation API key configured (OPENROUTER_API_KEY)")


async def _generate_via_openai(prompt: str, width: int, height: int) -> bytes:
    """Generate image via OpenAI Images API directly."""
    # Map dimensions to OpenAI supported sizes
    size = _openai_size(width, height)

    logger.info(
        "Generating image via OpenAI direct (%s, quality=%s, prompt=%d chars)...",
        size, IMAGE_QUALITY, len(prompt),
    )

    async with httpx.AsyncClient(timeout=httpx.Timeout(
        connect=30.0, read=120.0, write=30.0, pool=30.0
    )) as client:
        resp = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": IMAGE_MODEL,
                "prompt": prompt,
                "n": 1,
                "size": size,
                "quality": IMAGE_QUALITY,
                "output_format": "png",
            },
        )
        resp.raise_for_status()
        data = resp.json()

        images = data.get("data", [])
        if not images:
            raise ValueError("No images returned from OpenAI API")

        img = images[0]

        # OpenAI returns b64_json or url
        if img.get("b64_json"):
            img_bytes = base64.b64decode(img["b64_json"])
            logger.info("OpenAI image decoded: %d bytes", len(img_bytes))
            return img_bytes

        if img.get("url"):
            img_resp = await client.get(img["url"])
            img_resp.raise_for_status()
            logger.info("OpenAI image downloaded: %d bytes", len(img_resp.content))
            return img_resp.content

        raise ValueError(f"Unexpected OpenAI response format: {list(img.keys())}")


def _openai_size(width: int, height: int) -> str:
    """Map arbitrary dimensions to nearest OpenAI supported size."""
    ratio = width / height
    if ratio > 1.3:
        return "1536x1024"  # landscape
    elif ratio < 0.7:
        return "1024x1536"  # portrait
    else:
        return "1024x1024"  # square


async def _generate_via_openrouter(prompt: str, width: int, height: int) -> bytes:
    """Generate image via OpenRouter (fallback)."""
    logger.info(
        "Generating image via OpenRouter (%dx%d, prompt=%d chars)...",
        width, height, len(prompt),
    )

    async with httpx.AsyncClient(timeout=httpx.Timeout(
        connect=30.0, read=300.0, write=30.0, pool=30.0
    )) as client:
        resp = None
        for attempt in range(2):
            try:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": IMAGE_MODEL,
                        "messages": [
                            {"role": "user", "content": prompt},
                        ],
                        **({"quality": IMAGE_QUALITY} if "gpt" in IMAGE_MODEL or "openai" in IMAGE_MODEL else {}),
                    },
                )
                resp.raise_for_status()
                break
            except httpx.ReadTimeout:
                if attempt == 0:
                    logger.warning("OpenRouter read timeout — retrying...")
                    continue
                raise
        data = resp.json()

        msg = data.get("choices", [{}])[0].get("message", {})
        images = msg.get("images", [])

        if not images:
            content = msg.get("content", "")
            if content and "base64" in str(content):
                if "data:image" in content:
                    b64_part = content.split(",", 1)[-1] if "," in content else content
                    return base64.b64decode(b64_part)
            raise ValueError(f"No images in OpenRouter response. Keys: {list(msg.keys())}")

        img = images[0]

        if isinstance(img, dict):
            if img.get("type") == "image_url" and "image_url" in img:
                image_url_data = img["image_url"]
                url = image_url_data.get("url", "") if isinstance(image_url_data, dict) else str(image_url_data)
                if url.startswith("data:image"):
                    return base64.b64decode(url.split(",", 1)[-1])
                elif url.startswith("http"):
                    img_resp = await client.get(url)
                    img_resp.raise_for_status()
                    return img_resp.content
            if img.get("url"):
                url = img["url"]
                if url.startswith("data:image"):
                    return base64.b64decode(url.split(",", 1)[-1])
                img_resp = await client.get(url)
                img_resp.raise_for_status()
                return img_resp.content
            if img.get("b64_json"):
                return base64.b64decode(img["b64_json"])

        if isinstance(img, str):
            if img.startswith("http"):
                img_resp = await client.get(img)
                img_resp.raise_for_status()
                return img_resp.content
            elif img.startswith("data:image"):
                return base64.b64decode(img.split(",", 1)[-1])
            else:
                return base64.b64decode(img)

        raise ValueError(f"Unexpected image format: {type(img)}")


async def edit_image(
    image_bytes: bytes,
    edit_prompt: str,
    image_url: str | None = None,
) -> bytes:
    """Edit an existing image using Seedream 4.5 Edit via AtlasCloud API.

    Sends the image + edit instruction to Seedream Edit which modifies
    the image in-place (remove watermarks, fix artifacts, adjust style, etc.).
    Much faster and cheaper than full regeneration.

    Parameters
    ----------
    image_bytes:
        The source image bytes to edit.
    edit_prompt:
        What to change (e.g. "Remove the watermark text and Chinese characters").
    image_url:
        Optional blob URL for the image. If not provided, sends base64.

    Returns
    -------
    bytes
        Edited image bytes.
    """
    from config import OPENROUTER_API_KEY

    # AtlasCloud API (same key as OpenRouter in our setup)
    api_key = os.environ.get("ATLASCLOUD_API_KEY", OPENROUTER_API_KEY)

    # If we have a URL, use it directly. Otherwise encode as base64 data URI.
    if image_url:
        image_input = image_url
    else:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        image_input = f"data:image/png;base64,{b64}"

    logger.info("Seedream Edit: %s (image=%d bytes)", edit_prompt[:80], len(image_bytes))

    async with httpx.AsyncClient(timeout=httpx.Timeout(
        connect=30.0, read=300.0, write=30.0, pool=30.0
    )) as client:
        resp = await client.post(
            "https://api.atlascloud.ai/api/v1/model/generateImage",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "bytedance/seedream-v4.5/edit",
                "prompt": edit_prompt,
                "images": [image_input],
                "size": "2048*2048",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    # Handle async response (poll for completion)
    if data.get("status") in ("processing", "created"):
        prediction_id = data.get("id")
        logger.info("Seedream Edit async — polling prediction %s...", prediction_id)
        import asyncio
        for poll in range(30):  # Max 5 minutes
            await asyncio.sleep(10)
            async with httpx.AsyncClient(timeout=60) as client:
                poll_resp = await client.get(
                    f"https://api.atlascloud.ai/api/v1/model/prediction/{prediction_id}",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                poll_data = poll_resp.json()
                if poll_data.get("status") == "succeeded":
                    data = poll_data
                    break
                elif poll_data.get("status") == "failed":
                    raise ValueError(f"Seedream Edit failed: {poll_data.get('error', 'unknown')}")
        else:
            raise TimeoutError("Seedream Edit timed out after 5 minutes")

    # Extract output URL
    output_url = None
    outputs = data.get("outputs") or data.get("output") or []
    if isinstance(outputs, list) and outputs:
        output_url = outputs[0]
    elif isinstance(outputs, str):
        output_url = outputs

    if not output_url:
        raise ValueError(f"No output from Seedream Edit. Response keys: {list(data.keys())}")

    # Download the edited image
    async with httpx.AsyncClient(timeout=60) as client:
        img_resp = await client.get(output_url)
        img_resp.raise_for_status()
        edited_bytes = img_resp.content

    logger.info("Seedream Edit complete: %d bytes", len(edited_bytes))
    return edited_bytes
