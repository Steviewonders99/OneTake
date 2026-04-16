"""Image generation via Seedream 4.5 on OpenRouter.

Uses the /api/v1/chat/completions endpoint (NOT /images/generations).
Seedream returns images in message.images[] as base64 or URLs.

Cost: $0.04 per image regardless of size.
"""
from __future__ import annotations

import base64
import logging
import os

import httpx
from config import IMAGE_MODEL, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

DIMENSIONS: dict[str, tuple[int, int]] = {
    "square": (1080, 1080),
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
        # Face defect anchors — prevent scars/cuts/blemishes on actors
        "scars, cuts, wounds, bruises, scratches on face, scabs, acne, "
        "blemishes, skin defects, forehead marks, forehead cuts, forehead scars, "
        "cheek scars, skin lesions, stitches, bandages, band-aid on face, "
        # Cleanliness anchors — prevent dirty/disheveled actors
        "unwashed, disheveled, stained clothes, dirty clothes, greasy hair, "
        "dirty fingernails, grime on skin, sweat stains, "
        # Dignity anchors — prevent stereotypical poverty imagery
        "dirty room, messy room, cracked walls, peeling paint, trash, debris, "
        "slum, poverty, rundown, dilapidated, broken furniture, "
        "dusty surfaces, grime, stained surfaces, scuff marks, drip stains, "
        # Prevent nonsensical luxury
        "swimming pool, mansion, luxury car, yacht, penthouse, "
        # Prevent AI screen artifacts
        "hex code on screen, debug text, placeholder text, gibberish text on device, "
        "fake money, fake currency, fake UI, fake app screenshot"
    )
    neg = negative_prompt or default_negative

    full_prompt = (
        f"{prompt}\n\n"
        f"Image dimensions: {width}x{height}px.\n"
        f"Avoid: {neg}"
    )

    logger.info(
        "Generating image via %s (%dx%d, prompt=%d chars)...",
        IMAGE_MODEL, width, height, len(full_prompt),
    )

    # Seedream on OpenRouter uses chat/completions, NOT images/generations
    # Response has message.images[] with base64 or URL entries
    # Timeout needs to be long — image gen can take 30-180+ seconds
    async with httpx.AsyncClient(timeout=httpx.Timeout(
        connect=30.0, read=300.0, write=30.0, pool=30.0
    )) as client:
        # Retry up to 2 times on timeout
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
                            {"role": "user", "content": full_prompt},
                        ],
                    },
                )
                resp.raise_for_status()
                break
            except httpx.ReadTimeout:
                if attempt == 0:
                    logger.warning("Seedream read timeout — retrying...")
                    continue
                raise
        data = resp.json()

        msg = data.get("choices", [{}])[0].get("message", {})
        images = msg.get("images", [])

        if not images:
            # Some models return image in content as base64 data URI
            content = msg.get("content", "")
            if content and "base64" in str(content):
                logger.info("Image found in content field")
                # Extract base64 from data URI if present
                if "data:image" in content:
                    b64_part = content.split(",", 1)[-1] if "," in content else content
                    return base64.b64decode(b64_part)

            raise ValueError(
                f"No images in response. Keys: {list(msg.keys())}. "
                f"Content type: {type(content).__name__}"
            )

        img = images[0]

        # Handle dict formats
        if isinstance(img, dict):
            # OpenAI vision format: {"type": "image_url", "image_url": {"url": "data:..."}}
            if img.get("type") == "image_url" and "image_url" in img:
                image_url_data = img["image_url"]
                if isinstance(image_url_data, dict):
                    url = image_url_data.get("url", "")
                else:
                    url = str(image_url_data)

                if url.startswith("data:image"):
                    # Base64 data URI — extract the base64 part
                    b64_part = url.split(",", 1)[-1] if "," in url else url
                    img_bytes = base64.b64decode(b64_part)
                    logger.info("Image decoded from data URI: %d bytes", len(img_bytes))
                    return img_bytes
                elif url.startswith("http"):
                    img_resp = await client.get(url)
                    img_resp.raise_for_status()
                    logger.info("Image downloaded from URL: %d bytes", len(img_resp.content))
                    return img_resp.content

            # Direct URL format: {"url": "https://..."}
            if img.get("url"):
                url = img["url"]
                if url.startswith("data:image"):
                    b64_part = url.split(",", 1)[-1]
                    return base64.b64decode(b64_part)
                img_resp = await client.get(url)
                img_resp.raise_for_status()
                return img_resp.content

            # Direct base64 format: {"b64_json": "..."}
            if img.get("b64_json"):
                return base64.b64decode(img["b64_json"])

        # Handle raw base64 string
        if isinstance(img, str):
            if img.startswith("http"):
                img_resp = await client.get(img)
                img_resp.raise_for_status()
                return img_resp.content
            elif img.startswith("data:image"):
                b64_part = img.split(",", 1)[-1]
                return base64.b64decode(b64_part)
            else:
                return base64.b64decode(img)

        raise ValueError(f"Unexpected image format: {type(img)}, keys: {list(img.keys()) if isinstance(img, dict) else 'N/A'}")


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
