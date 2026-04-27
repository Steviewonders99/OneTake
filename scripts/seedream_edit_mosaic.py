"""Seedream 4.5 Edit — make Mosaic family image hyper-realistic.

Strategy: Try Seedream 4.5 via OpenRouter (vision + generation),
then fall back to Flux.2 Pro edit if needed.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import sys
from typing import Optional

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

API_KEY = os.environ.get(
    "OPENROUTER_API_KEY",
    "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",
)

INPUT_PATH = "/Users/stevenjunop/Downloads/Gemini_Generated_Image_6ohiol6ohiol6ohi.png"
OUTPUT_DIR = "/Users/stevenjunop/Downloads"

EDIT_PROMPT = (
    "Make every person in this image hyper-realistic and photographic. "
    "Enhance skin texture with natural pores, subtle imperfections, and micro-details. "
    "Add realistic subsurface scattering and natural skin tones. "
    "Sharpen facial features — eyes should have realistic iris detail, catchlights, and natural eyelashes. "
    "Hair should have individual strand detail with natural shine and volume. "
    "Clothing should have realistic fabric texture, natural wrinkles and folds. "
    "Hands and fingers must be anatomically correct with natural proportions. "
    "Children's faces should look naturally proportioned with authentic expressions. "
    "Add subtle depth of field — sharp focus on faces, gentle falloff on background. "
    "Maintain warm golden-hour lighting but make it behave like real light — "
    "natural shadow gradients, ambient occlusion under chin and arms, "
    "soft rim light on hair edges. "
    "The overall image should be indistinguishable from a professional editorial photograph "
    "shot on a Sony A7R V with an 85mm f/1.4 lens. "
    "Keep the exact same composition, poses, clothing, and scene layout — "
    "only enhance realism of people and lighting."
)


def extract_image_from_response(data: dict) -> bytes:
    """Extract image bytes from an OpenRouter chat/completions response."""
    msg = data.get("choices", [{}])[0].get("message", {})
    images = msg.get("images", [])

    if not images:
        content = msg.get("content", "")
        if content and "base64" in str(content)[:200]:
            if "data:image" in content:
                b64_part = content.split(",", 1)[-1]
                return base64.b64decode(b64_part)
        raise ValueError(f"No images in response. Content: {str(content)[:300]}")

    img0 = images[0]

    if isinstance(img0, dict):
        # OpenAI vision format
        url_data = img0.get("image_url", {})
        if isinstance(url_data, dict):
            url = url_data.get("url", "")
        else:
            url = str(url_data)

        if not url:
            url = img0.get("url", "")

        if url.startswith("data:image"):
            b64_part = url.split(",", 1)[1]
            return base64.b64decode(b64_part)

        if "b64_json" in img0:
            return base64.b64decode(img0["b64_json"])

    if isinstance(img0, str):
        if img0.startswith("data:image"):
            return base64.b64decode(img0.split(",", 1)[-1])
        elif img0.startswith("http"):
            # Will handle URL download in caller
            raise ValueError(f"URL_DOWNLOAD:{img0}")
        else:
            return base64.b64decode(img0)

    raise ValueError(f"Unexpected format: {type(img0)}")


async def try_model(client: httpx.AsyncClient, model: str, b64_uri: str, label: str) -> bytes | None:
    """Try editing with a specific model via OpenRouter."""
    logger.info("Trying %s (%s)...", model, label)
    try:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": EDIT_PROMPT},
                        {"type": "image_url", "image_url": {"url": b64_uri}},
                    ],
                }],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("%s response keys: %s", label, list(data.keys()))

        try:
            result = extract_image_from_response(data)
            logger.info("%s SUCCESS: %d bytes", label, len(result))
            return result
        except ValueError as e:
            err_str = str(e)
            if err_str.startswith("URL_DOWNLOAD:"):
                url = err_str.split(":", 1)[1]
                img_resp = await client.get(url)
                img_resp.raise_for_status()
                logger.info("%s SUCCESS (URL download): %d bytes", label, len(img_resp.content))
                return img_resp.content
            logger.warning("%s extraction failed: %s", label, e)
            # Log full response for debugging
            msg = data.get("choices", [{}])[0].get("message", {})
            logger.info("%s message keys: %s", label, list(msg.keys()))
            if "content" in msg:
                logger.info("%s content preview: %s", label, str(msg["content"])[:200])
            return None

    except httpx.HTTPStatusError as e:
        logger.warning("%s HTTP error: %s", label, e.response.status_code)
        try:
            logger.warning("%s error body: %s", label, e.response.text[:500])
        except Exception:
            pass
        return None
    except Exception as e:
        logger.warning("%s error: %s", label, e)
        return None


async def main():
    logger.info("Reading source image: %s", INPUT_PATH)
    with open(INPUT_PATH, "rb") as f:
        image_bytes = f.read()
    logger.info("Source: %d bytes (%.1f MB)", len(image_bytes), len(image_bytes) / 1e6)

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    b64_uri = f"data:image/png;base64,{b64}"

    models = [
        ("bytedance-seed/seedream-4.5", "Seedream 4.5"),
        ("black-forest-labs/flux.2-pro", "Flux.2 Pro"),
    ]

    async with httpx.AsyncClient(timeout=httpx.Timeout(
        connect=30.0, read=300.0, write=30.0, pool=30.0
    )) as client:
        for model_id, label in models:
            result = await try_model(client, model_id, b64_uri, label)
            if result:
                output_path = os.path.join(
                    OUTPUT_DIR,
                    f"mosaic_{label.lower().replace(' ', '_').replace('.', '')}_hyperreal.png"
                )
                with open(output_path, "wb") as f:
                    f.write(result)
                logger.info("Saved: %s (%d bytes)", output_path, len(result))
                return

    logger.error("All models failed. No output generated.")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
