"""Background removal for actor images using rembg (local, free).

Removes backgrounds to create transparent PNG cutouts of actors.
These cutouts enable graphic design compositions where characters
'pop out' of card borders, overlap with design elements, etc.
"""
from __future__ import annotations

import io
import logging
from PIL import Image

logger = logging.getLogger(__name__)


async def remove_background(image_bytes: bytes) -> bytes:
    """Remove background from an image, returning a transparent PNG.

    Uses rembg with U2-Net model (runs locally, no API).
    First run downloads the model (~170MB), subsequent runs are fast.
    """
    import asyncio
    from rembg import remove

    def _remove():
        input_img = Image.open(io.BytesIO(image_bytes))
        output_img = remove(input_img)  # Returns RGBA with transparent background

        buf = io.BytesIO()
        output_img.save(buf, format="PNG")
        return buf.getvalue()

    return await asyncio.to_thread(_remove)


async def create_cutout_with_shadow(
    image_bytes: bytes,
    shadow_offset: tuple[int, int] = (8, 8),
    shadow_blur: int = 15,
    shadow_opacity: float = 0.3,
) -> bytes:
    """Remove background and add a natural drop shadow.

    Creates a 'floating' cutout effect perfect for graphic overlays.
    """
    import asyncio
    from rembg import remove
    import numpy as np

    def _process():
        input_img = Image.open(io.BytesIO(image_bytes))
        cutout = remove(input_img)  # RGBA

        # Create shadow from alpha channel
        alpha = cutout.split()[3]  # Get alpha channel

        # Create blurred shadow alpha
        shadow_alpha = alpha.copy()
        shadow_alpha = shadow_alpha.filter(
            __import__('PIL.ImageFilter', fromlist=['GaussianBlur']).GaussianBlur(shadow_blur)
        )

        # Apply opacity to shadow
        shadow_data = np.array(shadow_alpha).astype(float) * shadow_opacity
        shadow_alpha = Image.fromarray(shadow_data.astype(np.uint8))

        # Create shadow image (black with computed alpha)
        shadow_paste = Image.new("RGBA", cutout.size, (0, 0, 0, 255))
        shadow_paste.putalpha(shadow_alpha)

        # Build canvas with room for shadow offset
        canvas = Image.new(
            "RGBA",
            (
                cutout.width + abs(shadow_offset[0]) * 2,
                cutout.height + abs(shadow_offset[1]) * 2,
            ),
            (0, 0, 0, 0),
        )

        # Paste shadow first (behind)
        canvas.paste(
            shadow_paste,
            (
                shadow_offset[0] + abs(shadow_offset[0]),
                shadow_offset[1] + abs(shadow_offset[1]),
            ),
            shadow_paste,
        )

        # Paste cutout on top
        canvas.paste(
            cutout,
            (abs(shadow_offset[0]), abs(shadow_offset[1])),
            cutout,
        )

        buf = io.BytesIO()
        canvas.save(buf, format="PNG")
        return buf.getvalue()

    return await asyncio.to_thread(_process)
