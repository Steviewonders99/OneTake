#!/usr/bin/env python3
"""Render a reference-layout manifest locally for visual inspection.

Usage:
  cd worker
  python3 sandbox_reference_layout.py --image /path/to/base.png

Outputs:
  /tmp/reference_layout/oneforma_pet_frame.html
  /tmp/reference_layout/oneforma_pet_frame.png
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import mimetypes
from pathlib import Path

from compositor.reference_renderer import render_reference_html
from compositor.reference_schema import ReferenceCreativeManifest
from compositor.render_png import render_html_to_png


ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "templates" / "reference_layouts" / "oneforma_pet_frame.json"
OUT_DIR = Path("/tmp/reference_layout")


def _to_data_uri(path: Path) -> str:
    content_type = mimetypes.guess_type(str(path))[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True, help="Base image to place into the reference layout")
    parser.add_argument("--manifest", type=Path, default=FIXTURE, help="Reference manifest JSON")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = ReferenceCreativeManifest.from_dict(json.loads(args.manifest.read_text()))
    html = render_reference_html(
        manifest,
        replacements={"base_photo": _to_data_uri(args.image)},
        editable=True,
    )
    png = await render_html_to_png(html, manifest.canvas.width, manifest.canvas.height)

    html_path = OUT_DIR / f"{manifest.name}.html"
    png_path = OUT_DIR / f"{manifest.name}.png"
    html_path.write_text(html, encoding="utf-8")
    png_path.write_bytes(png)
    print(html_path)
    print(png_path)


if __name__ == "__main__":
    asyncio.run(main())
