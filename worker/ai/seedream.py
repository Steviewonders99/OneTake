"""Image generation via OpenRouter API.

Routes to Seedream 4.5 or other image models through OpenRouter's unified API.
Generates photorealistic hero images for recruitment creatives.
"""
import base64
import logging

import httpx

from config import OPENROUTER_API_KEY, IMAGE_MODEL

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
    """Generate an image via OpenRouter and return raw PNG bytes.

    Parameters
    ----------
    prompt:
        The text-to-image prompt. Should include realism anchors.
    dimension_key:
        A key into ``DIMENSIONS`` (e.g. ``"square"``, ``"landscape"``).
    negative_prompt:
        Optional negative prompt for things to avoid in the image.

    Returns
    -------
    bytes
        Raw image bytes (PNG).
    """
    width, height = DIMENSIONS.get(dimension_key, (1080, 1080))

    default_negative = (
        "cartoon, anime, illustration, 3d render, painting, watermark, "
        "text overlay, blurry, distorted hands, extra fingers, "
        "corporate stock photo, stiff pose, oversaturated"
    )
    neg = negative_prompt or default_negative

    # Build the prompt with dimension hints and negative prompt
    full_prompt = f"{prompt}\n\nImage dimensions: {width}x{height}px.\nAvoid: {neg}"

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/images/generations",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": IMAGE_MODEL,
                "prompt": full_prompt,
                "n": 1,
                "size": f"{width}x{height}",
            },
        )
        response.raise_for_status()
        data = response.json()

        image_entry = data["data"][0]

        # Handle URL-based response
        if "url" in image_entry and image_entry["url"]:
            img_resp = await client.get(image_entry["url"])
            img_resp.raise_for_status()
            return img_resp.content

        # Handle base64 response
        if "b64_json" in image_entry and image_entry["b64_json"]:
            return base64.b64decode(image_entry["b64_json"])

        raise ValueError("Image response contained neither url nor b64_json.")
