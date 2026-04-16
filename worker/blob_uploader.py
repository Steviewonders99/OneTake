"""Upload images to Vercel Blob via REST API."""
from __future__ import annotations

import logging

import httpx
from config import VERCEL_BLOB_TOKEN

logger = logging.getLogger(__name__)


async def upload_to_blob(
    file_bytes: bytes,
    filename: str,
    folder: str = "generated",
    content_type: str = "image/png",
) -> str:
    """Upload a file to Vercel Blob and return the public URL.

    Parameters
    ----------
    file_bytes:
        Raw bytes of the file to upload.
    filename:
        Target filename inside the folder (e.g. ``"hero_1080x1080.png"``).
    folder:
        Virtual folder prefix (e.g. ``"generated"``).
    content_type:
        MIME type for the upload. Defaults to ``image/png``.

    Returns
    -------
    str
        The public URL of the uploaded blob.
    """
    path = f"{folder}/{filename}"

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.put(
            f"https://blob.vercel-storage.com/{path}",
            content=file_bytes,
            headers={
                "Authorization": f"Bearer {VERCEL_BLOB_TOKEN}",
                "x-api-version": "7",
                "Content-Type": content_type,
            },
        )
        response.raise_for_status()
        data = response.json()
        url: str = data["url"]
        logger.info("Uploaded %s -> %s", path, url)
        return url
