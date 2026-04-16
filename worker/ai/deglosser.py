"""AI Deglosser — Post-processing pipeline to remove the AI gloss.

Runs AFTER Seedream image generation, BEFORE VQA evaluation.
Adds the BAREST hint of imperfection — like a high-quality iPhone photo,
NOT a vintage film look. If someone has to zoom in 300% to see the grain,
that's correct.

All processing uses Pillow + NumPy — zero paid APIs, runs locally.

Pipeline:
1. Desaturate barely (AI images are slightly over-saturated)
2. Add micro grain (~0.4% intensity — invisible at 100% zoom)
3. Add skin texture micro-bumps (near-imperceptible displacement)
4. Add chromatic aberration (1px max — barely visible edge fringing)
5. Add lens vignette (very subtle corner darkening)
6. Add color temperature shift (near-zero — breaks mathematical perfection)
7. Compress + recompress (high-quality JPEG to break pixel-perfect smoothness)
8. Add subtle sharpening on texture areas (pores, fabric)
"""
from __future__ import annotations

import io
import logging

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)


def degloss(
    image_bytes: bytes,
    intensity: str = "medium",
    seed: int | None = None,
) -> bytes:
    """Apply the full deglosser pipeline to an image.

    Parameters
    ----------
    image_bytes:
        Raw PNG bytes from Seedream.
    intensity:
        "light" (subtle, for already-good images),
        "medium" (standard — recommended),
        "heavy" (maximum roughness, for images that look very AI).
    seed:
        Random seed for reproducible grain patterns.

    Returns
    -------
    bytes
        Processed PNG bytes ready for VQA and upload.
    """
    if seed is not None:
        np.random.seed(seed)

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original_size = img.size

    # Intensity presets — ULTRA SUBTLE (high-quality iPhone photo, not vintage film)
    # Grain at 0.4% intensity — must zoom 300% to see it.
    # Color shifts near-zero — no visible tinting.
    # Chromatic aberration 1px max — barely visible edge fringing.
    presets = {
        "light": {
            "desaturate": 0.97,
            "grain_strength": 1,
            "vignette_strength": 0.03,
            "chroma_shift": 0,
            "jpeg_quality": 95,
            "warmth_shift": 1,
            "sharpen_passes": 0,
            "micro_contrast": 1.01,
        },
        "medium": {
            "desaturate": 0.96,
            "grain_strength": 1,
            "vignette_strength": 0.04,
            "chroma_shift": 1,
            "jpeg_quality": 93,
            "warmth_shift": 1,
            "sharpen_passes": 0,
            "micro_contrast": 1.02,
        },
        "heavy": {
            "desaturate": 0.95,
            "grain_strength": 1,
            "vignette_strength": 0.05,
            "chroma_shift": 1,
            "jpeg_quality": 90,
            "warmth_shift": 1,
            "sharpen_passes": 1,
            "micro_contrast": 1.03,
        },
    }
    p = presets.get(intensity, presets["medium"])

    logger.info("Deglosser: applying %s intensity pipeline", intensity)

    # ------------------------------------------------------------------
    # 1. DESATURATE (AI images are over-saturated)
    # ------------------------------------------------------------------
    img = ImageEnhance.Color(img).enhance(p["desaturate"])

    # ------------------------------------------------------------------
    # 2. MICRO-CONTRAST BOOST (makes textures pop — skin pores, fabric)
    # ------------------------------------------------------------------
    img = ImageEnhance.Contrast(img).enhance(p["micro_contrast"])

    # ------------------------------------------------------------------
    # 3. FILM GRAIN (sensor noise — NOT uniform, varies by luminance)
    # Real sensor noise is stronger in shadows, weaker in highlights.
    # ------------------------------------------------------------------
    img = _add_film_grain(img, strength=p["grain_strength"])

    # ------------------------------------------------------------------
    # 4. SKIN TEXTURE / SURFACE ROUGHNESS
    # Adds micro-bump displacement that simulates pores and fabric weave.
    # Uses high-pass filter to find flat/smooth areas and roughen them.
    # ------------------------------------------------------------------
    img = _add_surface_roughness(img)

    # ------------------------------------------------------------------
    # 5. CHROMATIC ABERRATION (color fringing at edges — real lens defect)
    # Shifts R and B channels slightly in opposite directions.
    # ------------------------------------------------------------------
    if p["chroma_shift"] > 0:
        img = _add_chromatic_aberration(img, shift=p["chroma_shift"])

    # ------------------------------------------------------------------
    # 6. LENS VIGNETTE (corner darkening — every real lens has this)
    # ------------------------------------------------------------------
    if p["vignette_strength"] > 0:
        img = _add_vignette(img, strength=p["vignette_strength"])

    # ------------------------------------------------------------------
    # 7. COLOR TEMPERATURE MICRO-SHIFT
    # Real photos have slight warm/cool variations from mixed lighting.
    # Adds a subtle warm or cool tint (randomized).
    # ------------------------------------------------------------------
    if p["warmth_shift"] > 0:
        img = _shift_color_temperature(img, shift=p["warmth_shift"])

    # ------------------------------------------------------------------
    # 8. JPEG COMPRESSION + RE-EXPANSION
    # Real phone photos are compressed. This adds subtle blocking artifacts
    # and removes the "too-perfect" pixel-level smoothness of AI output.
    # ------------------------------------------------------------------
    img = _jpeg_roundtrip(img, quality=p["jpeg_quality"])

    # ------------------------------------------------------------------
    # 9. SELECTIVE SHARPENING (texture areas only)
    # Sharpens high-detail areas (skin, fabric, hair) without affecting
    # smooth areas (backgrounds, bokeh). Opposite of AI smoothing.
    # ------------------------------------------------------------------
    for _ in range(p["sharpen_passes"]):
        img = _selective_sharpen(img)

    # Ensure size unchanged
    if img.size != original_size:
        img = img.resize(original_size, Image.Resampling.LANCZOS)

    # Export as PNG
    output = io.BytesIO()
    img.save(output, format="PNG", optimize=True)
    return output.getvalue()


# =========================================================================
# INDIVIDUAL PROCESSING STAGES
# =========================================================================

def _add_film_grain(img: Image.Image, strength: int = 1) -> Image.Image:
    """Add luminance-aware film grain (stronger in shadows, weaker in highlights).

    At strength=1, grain is ~0.4% intensity — invisible without zooming to 300%.
    """
    arr = np.array(img, dtype=np.float32)

    # Generate base noise
    noise = np.random.normal(0, strength, arr.shape).astype(np.float32)

    # Luminance-aware: stronger noise in darker areas
    luminance = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    # Scale noise: 1.5x in shadows (lum<80), 0.5x in highlights (lum>200)
    shadow_boost = np.clip(1.5 - (luminance / 200.0), 0.4, 1.6)
    for c in range(3):
        noise[:, :, c] *= shadow_boost

    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _add_surface_roughness(img: Image.Image) -> Image.Image:
    """Add micro-bump texture that simulates skin pores and fabric weave.

    Uses a high-pass technique: find smooth areas (the AI gloss) and
    add subtle noise specifically to those areas.
    """
    arr = np.array(img, dtype=np.float32)

    # Create a blurred version (this IS the AI gloss — too smooth)
    blurred = img.filter(ImageFilter.GaussianBlur(radius=2))
    blurred_arr = np.array(blurred, dtype=np.float32)

    # High-pass: difference between original and blurred = existing detail
    detail = np.abs(arr - blurred_arr)
    detail_magnitude = np.mean(detail, axis=2)

    # Smoothness mask: areas with LOW detail = flat/glossy = need roughness
    smooth_mask = np.clip(1.0 - (detail_magnitude / 30.0), 0, 1)

    # Generate micro-bump noise (barely visible — must zoom 300% to see)
    micro_noise = np.random.normal(0, 1.5, arr.shape).astype(np.float32)

    # Apply noise only to smooth areas (skin, walls, flat surfaces)
    for c in range(3):
        micro_noise[:, :, c] *= smooth_mask

    arr = np.clip(arr + micro_noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _add_chromatic_aberration(img: Image.Image, shift: int = 1) -> Image.Image:
    """Add chromatic aberration — shift R and B channels 1px max (barely visible edge fringing)."""
    arr = np.array(img)
    h, w = arr.shape[:2]

    # Create output with shifted channels
    result = arr.copy()

    # Shift red channel slightly right/down
    result[shift:, shift:, 0] = arr[:-shift, :-shift, 0]

    # Shift blue channel slightly left/up
    result[:-shift, :-shift, 2] = arr[shift:, shift:, 2]

    # Only apply at edges (center should be clean — real lens behavior)
    # Create radial mask: 0 at center, 1 at corners
    y_grid, x_grid = np.mgrid[0:h, 0:w]
    center_y, center_x = h / 2, w / 2
    dist = np.sqrt((y_grid - center_y) ** 2 + (x_grid - center_x) ** 2)
    max_dist = np.sqrt(center_y ** 2 + center_x ** 2)
    edge_mask = np.clip(dist / max_dist - 0.3, 0, 1)  # Start at 30% from center
    edge_mask = edge_mask[:, :, np.newaxis]

    # Blend: original at center, shifted at edges
    blended = (arr * (1 - edge_mask) + result * edge_mask).astype(np.uint8)
    return Image.fromarray(blended)


def _add_vignette(img: Image.Image, strength: float = 0.04) -> Image.Image:
    """Add lens vignette — very subtle corner darkening (barely perceptible)."""
    arr = np.array(img, dtype=np.float32)
    h, w = arr.shape[:2]

    # Radial gradient: 1.0 at center, darker at edges
    y_grid, x_grid = np.mgrid[0:h, 0:w]
    center_y, center_x = h / 2, w / 2
    dist = np.sqrt((y_grid - center_y) ** 2 + (x_grid - center_x) ** 2)
    max_dist = np.sqrt(center_y ** 2 + center_x ** 2)

    # Vignette curve: smooth falloff
    vignette = 1.0 - strength * (dist / max_dist) ** 2
    vignette = np.clip(vignette, 1.0 - strength, 1.0)
    vignette = vignette[:, :, np.newaxis]

    arr = np.clip(arr * vignette, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _shift_color_temperature(img: Image.Image, shift: int = 1) -> Image.Image:
    """Add near-zero color temperature variation (warm or cool micro-tint).

    At shift=1, this is a ~0.4% channel adjustment — completely imperceptible
    to the naked eye but breaks the mathematically-perfect AI color balance.
    """
    arr = np.array(img, dtype=np.int16)

    # Random warm/cool direction
    warm = np.random.choice([True, False])

    if warm:
        # Warm: boost red/yellow, reduce blue
        arr[:, :, 0] = np.clip(arr[:, :, 0] + shift, 0, 255)      # R up
        arr[:, :, 1] = np.clip(arr[:, :, 1] + shift // 2, 0, 255)  # G slight up
        arr[:, :, 2] = np.clip(arr[:, :, 2] - shift, 0, 255)       # B down
    else:
        # Cool: boost blue, reduce red
        arr[:, :, 0] = np.clip(arr[:, :, 0] - shift, 0, 255)       # R down
        arr[:, :, 2] = np.clip(arr[:, :, 2] + shift, 0, 255)       # B up

    return Image.fromarray(arr.astype(np.uint8))


def _jpeg_roundtrip(img: Image.Image, quality: int = 93) -> Image.Image:
    """Compress to JPEG and re-expand to add subtle compression artifacts.

    At quality=93, artifacts are imperceptible — just enough to break
    the pixel-perfect smoothness of AI output.
    """
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def _selective_sharpen(img: Image.Image) -> Image.Image:
    """Sharpen high-detail areas (skin texture, fabric, hair) only.

    Uses an unsharp mask weighted by a detail/edge map so smooth
    background areas (bokeh, walls) stay smooth while textured
    areas get crisper.
    """
    # Unsharp mask
    blurred = img.filter(ImageFilter.GaussianBlur(radius=1))
    arr = np.array(img, dtype=np.float32)
    blurred_arr = np.array(blurred, dtype=np.float32)

    # Detail map: high-frequency content
    detail = np.abs(arr - blurred_arr)
    detail_mag = np.mean(detail, axis=2)

    # Sharpening mask: only where there IS detail (textures)
    sharpen_mask = np.clip(detail_mag / 20.0, 0, 1)
    sharpen_mask = sharpen_mask[:, :, np.newaxis]

    # Apply sharpening: original + (original - blur) * mask * amount
    sharpened = arr + (arr - blurred_arr) * sharpen_mask * 0.5
    sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

    return Image.fromarray(sharpened)
