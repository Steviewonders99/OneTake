"""Async HTML-to-PNG renderer using Playwright headless Chromium.

Usage::

    from compositor.render_png import render_html_to_png

    png_bytes = await render_html_to_png(html_string, width=1080, height=1080)

Remote images are pre-fetched and embedded as base64 data URIs so that
Playwright can render in ``file://`` mode without network requests.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import tempfile
from typing import Optional

import httpx
from playwright.async_api import Browser, async_playwright

logger = logging.getLogger(__name__)

# Cache fetched images for the duration of the process
_image_cache: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Shared browser instance — one Chromium per process, guarded by asyncio Lock
# ---------------------------------------------------------------------------
_browser: Optional[Browser] = None
_browser_lock = asyncio.Lock()
_playwright_ctx = None


async def _get_browser() -> Browser:
    """Return (or launch) the shared headless Chromium instance."""
    global _browser, _playwright_ctx
    async with _browser_lock:
        if _browser is None or not _browser.is_connected():
            _playwright_ctx = await async_playwright().start()
            _browser = await _playwright_ctx.chromium.launch(headless=True)
        return _browser


async def _inline_remote_images(html: str) -> str:
    """Replace remote ``src="https://..."`` URLs with base64 data URIs.

    Fetches each unique URL once (cached for the process lifetime) and
    embeds the image data directly in the HTML so Playwright renders
    correctly in ``file://`` mode.
    """
    url_pattern = re.compile(r'src="(https?://[^"]+)"')
    urls = set(url_pattern.findall(html))

    if not urls:
        return html

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for url in urls:
            if url in _image_cache:
                html = html.replace(f'src="{url}"', f'src="{_image_cache[url]}"')
                continue
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                ct = resp.headers.get("content-type", "image/png").split(";")[0]
                b64 = base64.b64encode(resp.content).decode("ascii")
                data_uri = f"data:{ct};base64,{b64}"
                _image_cache[url] = data_uri
                html = html.replace(f'src="{url}"', f'src="{data_uri}"')
                logger.debug("Inlined image: %s (%d KB)", url[:60], len(resp.content) // 1024)
            except Exception as exc:
                logger.warning("Failed to fetch image %s: %s", url[:80], exc)

    return html


async def render_html_to_png(
    html: str,
    width: int = 1080,
    height: int = 1080,
) -> bytes:
    """Render an HTML string to PNG bytes via headless Chromium.

    Remote images in ``src="https://..."`` are automatically pre-fetched
    and embedded as base64 data URIs before rendering.

    Parameters
    ----------
    html:
        Complete HTML document (``<!DOCTYPE html>`` through ``</html>``).
    width:
        Viewport width in pixels.
    height:
        Viewport height in pixels.

    Returns
    -------
    bytes
        Raw PNG image data.
    """
    # Pre-fetch remote images → base64 data URIs
    html = await _inline_remote_images(html)

    browser = await _get_browser()

    # Write HTML to a temp file so Playwright can navigate to it
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".html")
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            f.write(html)

        page = await browser.new_page(viewport={"width": width, "height": height})
        try:
            await page.goto(f"file://{tmp_path}")
            await page.wait_for_load_state("domcontentloaded")

            png_bytes: bytes = await page.screenshot(
                type="png",
                full_page=False,
            )
            return png_bytes
        finally:
            await page.close()
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def close_browser() -> None:
    """Shut down the shared browser (call at worker exit)."""
    global _browser, _playwright_ctx
    async with _browser_lock:
        if _browser is not None:
            await _browser.close()
            _browser = None
        if _playwright_ctx is not None:
            await _playwright_ctx.stop()
            _playwright_ctx = None
