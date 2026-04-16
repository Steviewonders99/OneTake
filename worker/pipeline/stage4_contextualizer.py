"""Stage 4 Phase 0: Task Contextualizer.

Generates a device mockup PNG showing what the contributor's task looks like.
This mockup is composited into creatives by GLM-5 for maximum context.

Flow:
  1. Load task preview HTML template for the campaign's task_type
  2. Fill placeholders from brief + form_data
  3. Render to PNG via Playwright (phone screen dimensions)
  4. Composite into device frame (phone SVG → PNG)
  5. Upload to Vercel Blob
  6. Return blob_url for use as composition artifact
"""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Task preview templates directory
PREVIEW_TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "scripts", "artifacts", "task-previews",
)

# Template file mapping
TASK_TYPE_TEMPLATES: dict[str, str] = {
    "annotation": "annotation_preview.html",
    "audio_annotation": "annotation_preview.html",
    "image_annotation": "annotation_preview.html",
    "text_labeling": "annotation_preview.html",
    "data_collection": "data_collection_preview.html",
    "judging": "judging_preview.html",
    "transcription": "transcription_preview.html",
    "translation": "translation_preview.html",
}

# Screen dimensions for rendering (matches device frame screen area)
SCREEN_WIDTH = 256
SCREEN_HEIGHT = 480


def _load_template(task_type: str) -> str | None:
    """Load the HTML template for a task type."""
    template_name = TASK_TYPE_TEMPLATES.get(task_type)
    if not template_name:
        logger.info("No task preview template for type '%s'", task_type)
        return None

    template_path = os.path.join(PREVIEW_TEMPLATES_DIR, template_name)
    if not os.path.exists(template_path):
        logger.warning("Template file not found: %s", template_path)
        return None

    with open(template_path) as f:
        return f.read()


def _fill_template(html: str, brief: dict, form_data: dict) -> str:
    """Replace placeholders in template with campaign-specific content."""
    title = brief.get("title", form_data.get("title", "Review Task"))
    task_desc = form_data.get("task_description", "")
    comp_rate = form_data.get("compensation_rate", "12.50")

    # Build sample content from brief context
    sample = task_desc[:80] if task_desc else "Review and classify the content below"

    replacements = {
        "{task_title}": str(title)[:40],
        "{task_description}": str(task_desc)[:100],
        "{sample_content}": sample,
        "{progress_count}": "47 of 200",
        "{earnings_amount}": f"${comp_rate}",
        "{language}": ", ".join(brief.get("target_languages", ["English"])[:2]),
    }

    for key, value in replacements.items():
        html = html.replace(key, value)

    return html


async def generate_task_contextualizer(
    task_type: str,
    brief: dict[str, Any],
    form_data: dict[str, Any],
) -> str | None:
    """Generate a device mockup PNG with campaign-specific task screenshot.

    Returns blob_url of the composed device mockup, or None on failure.
    """
    from ai.compositor import render_to_png
    from blob_uploader import upload_to_blob

    # 1. Load template
    template = _load_template(task_type)
    if not template:
        return None

    # 2. Fill with campaign data
    filled_html = _fill_template(template, brief, form_data)

    # 3. Wrap in a full HTML page for rendering
    full_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background: transparent; }}
</style></head><body>{filled_html}</body></html>"""

    try:
        # 4. Render to PNG at screen dimensions
        screenshot = await render_to_png(full_html, SCREEN_WIDTH, SCREEN_HEIGHT)

        # 5. Composite into device frame using PIL
        device_png = _composite_into_device(screenshot)
        if not device_png:
            # Fallback: just use the raw screenshot
            device_png = screenshot

        # 6. Upload to Blob
        uid = os.urandom(4).hex()
        filename = f"device_mockup_{task_type}_{uid}.png"
        blob_url = await upload_to_blob(
            device_png, filename,
            folder="task-contextualizers",
            content_type="image/png",
        )

        logger.info(
            "Task contextualizer generated: type=%s, size=%dKB, url=%s",
            task_type, len(device_png) // 1024, blob_url[:60],
        )
        return blob_url

    except Exception as e:
        logger.error("Task contextualizer failed: %s", e)
        return None


def _composite_into_device(screenshot_png: bytes) -> bytes | None:
    """Composite a screenshot PNG into the phone device frame.

    Uses Pillow to paste the screenshot into the transparent screen area
    of the device frame SVG (pre-rendered to PNG).
    """
    try:
        import io

        from PIL import Image

        # Load screenshot
        screenshot = Image.open(io.BytesIO(screenshot_png)).convert("RGBA")

        # Create device frame (simple approach: dark rounded rect + screenshot)
        # Device dimensions: 280x560, screen at offset (12, 40) size (256, 480)
        device = Image.new("RGBA", (280, 560), (0, 0, 0, 0))

        # Draw phone body (dark rounded rectangle)
        from PIL import ImageDraw
        body = Image.new("RGBA", (280, 560), (0, 0, 0, 0))
        draw = ImageDraw.Draw(body)
        draw.rounded_rectangle([0, 0, 279, 559], radius=36, fill=(26, 26, 26, 255))

        # Draw screen bezel
        draw.rounded_rectangle([8, 8, 271, 551], radius=28, fill=(42, 42, 42, 255))

        # Draw notch
        draw.rounded_rectangle([90, 8, 189, 32], radius=12, fill=(26, 26, 26, 255))

        # Draw home indicator
        draw.rounded_rectangle([100, 540, 179, 544], radius=2, fill=(85, 85, 85, 255))

        device = body

        # Resize screenshot to fit screen area
        screenshot_resized = screenshot.resize((256, 480), Image.LANCZOS)

        # Paste screenshot into screen area
        device.paste(screenshot_resized, (12, 40))

        # Export
        buf = io.BytesIO()
        device.save(buf, format="PNG")
        return buf.getvalue()

    except ImportError:
        logger.warning("Pillow not installed — returning raw screenshot")
        return None
    except Exception as e:
        logger.warning("Device frame composition failed: %s — returning raw screenshot", e)
        return None
