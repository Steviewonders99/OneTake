"""Async HTML-to-PNG renderer using Playwright headless Chromium.

Usage::

    from compositor.render_png import render_html_to_png

    png_bytes = await render_html_to_png(html_string, width=1080, height=1080)
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from typing import Optional

from playwright.async_api import Browser, async_playwright

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


async def render_html_to_png(
    html: str,
    width: int = 1080,
    height: int = 1080,
) -> bytes:
    """Render an HTML string to PNG bytes via headless Chromium.

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
