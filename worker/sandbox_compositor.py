#!/usr/bin/env python3
"""Compositor Sandbox — test one composition at a time against multiple models.

Usage:
  python3.13 sandbox_compositor.py
  python3.13 sandbox_compositor.py --model "z-ai/glm-5.1"
  python3.13 sandbox_compositor.py --model "minimax/minimax-m2.7"
  python3.13 sandbox_compositor.py --model "nim"  (uses NIM GLM-5)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Add worker to path
sys.path.insert(0, str(Path(__file__).parent))

import httpx
from ai.compositor import PLATFORM_SPECS
from config import NVIDIA_NIM_BASE_URL, NVIDIA_NIM_DESIGN_MODEL
from nim_key_pool import get_nim_key
from prompts.compositor_prompt import (
    _section_reference_code,
    build_compositor_prompt,
    filter_catalog,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ── Test data ─────────────────────────────────────────────────────────

TEST_ACTOR = {
    "name": "Sophie Tremblay",
    "photo_url": "https://nek6dllf79zuiibo.public.blob.vercel-storage.com/requests/11c02668-7934-40f7-b611-72d80f96efba/actor_6af86b06-b3e1-4fc1-9e2f-4c272a898c6d_scene_4_reward_celebration_3e9c3677-kdCK7dj1cqioG0KpFwKeHqHpIHsltT.avif",
    "cutout_url": "",
}

TEST_COPY = {
    "headline": "Speak English? Earn $20 CAD/hr.",
    "subheadline": "Record short selfie videos from home",
    "cta": "Apply Now",
    "overlay_headline": "Earn $20/hr",
    "overlay_sub": "Selfie videos • Remote",
    "overlay_cta": "Apply Now",
    "language": "en",
}

TEST_PLATFORMS = [
    ("ig_feed", "Instagram Feed 1080x1080"),
    ("ig_story", "Instagram Story 1080x1920"),
    ("linkedin_feed", "LinkedIn Feed 1200x627"),
    ("facebook_feed", "Facebook Feed 1200x628"),
]

OPENROUTER_MODELS = [
    ("z-ai/glm-5.1", "GLM-5.1 (paid)"),
    ("z-ai/glm-5", "GLM-5 (paid)"),
    ("minimax/minimax-m2.7", "MiniMax M2.7 (paid)"),
    ("moonshotai/kimi-k2.5", "Kimi K2.5 (paid)"),
    ("minimax/minimax-m2.5:free", "MiniMax M2.5 (free)"),
    ("z-ai/glm-4.5-air:free", "GLM-4.5-air (free)"),
]


async def get_catalog() -> list[dict]:
    """Load artifact catalog from Neon."""
    from neon_client import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM design_artifacts WHERE is_active = true ORDER BY category"
        )
    return [dict(r) for r in rows]


async def call_openrouter(model_id: str, prompt: str) -> tuple[str, dict]:
    """Call OpenRouter and return (content, usage)."""
    key = os.environ.get("OPENROUTER_API_KEY", "")
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model_id,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 16384,
            },
        )
        if resp.status_code != 200:
            return f"ERROR {resp.status_code}: {resp.text[:200]}", {}
        data = resp.json()
        content = data["choices"][0]["message"]["content"] or ""
        usage = data.get("usage", {})
        finish = data["choices"][0].get("finish_reason", "?")
        return content, {"usage": usage, "finish": finish}


async def call_nim(prompt: str) -> tuple[str, dict]:
    """Call NIM GLM-5 and return (content, usage)."""
    key = get_nim_key()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{NVIDIA_NIM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": NVIDIA_NIM_DESIGN_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 4096,
            },
        )
        if resp.status_code != 200:
            return f"ERROR {resp.status_code}: {resp.text[:200]}", {}
        data = resp.json()
        content = data["choices"][0]["message"]["content"] or ""
        usage = data.get("usage", {})
        return content, {"usage": usage}


def clean_html(raw: str) -> str:
    """Strip markdown fences and extract HTML."""
    if not raw:
        return ""
    s = raw.strip()
    if "```html" in s:
        s = s.split("```html", 1)[1]
    if "```json" in s:
        s = s.split("```json", 1)[1]
    if "```" in s:
        s = s.split("```", 1)[0]
    s = s.strip()

    # If JSON, extract html field
    if s.startswith("{"):
        try:
            d = json.loads(s)
            return d.get("html", s)
        except json.JSONDecodeError:
            pass

    return s


async def run_sandbox():
    model_filter = None
    if len(sys.argv) > 2 and sys.argv[1] == "--model":
        model_filter = sys.argv[2]

    logger.info("=" * 60)
    logger.info("COMPOSITOR SANDBOX — Testing models with real prompt")
    logger.info("=" * 60)

    # Load catalog
    catalog = await get_catalog()
    logger.info(f"Artifact catalog: {len(catalog)} items")

    platform_key, platform_label = TEST_PLATFORMS[0]  # IG feed for test
    spec = PLATFORM_SPECS[platform_key]
    filtered = filter_catalog(catalog, "earn", platform_key)

    # Build the REAL compositor prompt
    prompt = build_compositor_prompt(
        catalog=filtered,
        archetype="floating_props",
        platform=platform_key,
        platform_spec=spec,
        pillar="earn",
        actor=TEST_ACTOR,
        copy=TEST_COPY,
        visual_direction={},
        project_context="Persona: Sophie Tremblay, 28, French-Canadian. Motivated by flexible income. Pain point: vague job descriptions.",
        design_intent="Warm, inviting, earn-focused. Lead with compensation.",
    )

    # Check reference code injection
    ref_code = _section_reference_code()
    ref_len = len(ref_code) if ref_code else 0

    logger.info(f"\nPrompt: {len(prompt)} chars (~{len(prompt)//4} tokens)")
    logger.info(f"  Reference code section: {ref_len} chars (~{ref_len//4} tokens)")
    logger.info(f"  Prompt WITHOUT references: {len(prompt) - ref_len} chars")
    logger.info(f"Platform: {platform_label} ({spec['width']}x{spec['height']})")
    logger.info("Archetype: floating_props")
    logger.info(f"Artifacts in filtered catalog: {len(filtered)}")
    logger.info("")

    # Save prompt for inspection
    Path("/tmp/sandbox_prompt.txt").write_text(prompt)
    logger.info("Prompt saved to /tmp/sandbox_prompt.txt")
    if ref_code:
        Path("/tmp/sandbox_references_only.txt").write_text(ref_code)
        logger.info("References saved to /tmp/sandbox_references_only.txt")
    logger.info("")

    # ── Test models ───────────────────────────────────────────────
    results = []

    if model_filter == "nim":
        models_to_test = [("nim", "NIM GLM-5")]
    elif model_filter:
        models_to_test = [(model_filter, model_filter)]
    else:
        models_to_test = OPENROUTER_MODELS[:3]  # Top 3 paid models

    for model_id, model_label in models_to_test:
        logger.info(f"{'─' * 40}")
        logger.info(f"Testing: {model_label}")

        if model_id == "nim":
            content, meta = await call_nim(prompt)
        else:
            content, meta = await call_openrouter(model_id, prompt)

        if content.startswith("ERROR"):
            logger.info(f"  FAILED: {content}")
            results.append({"model": model_label, "status": "FAILED", "error": content})
            continue

        html = clean_html(content)
        has_html = "<div" in html.lower() or "<html" in html.lower() or "<!doctype" in html.lower()
        has_img = "<img" in html.lower()
        has_cta = "apply" in html.lower()
        has_json = content.strip().startswith("{")

        logger.info(f"  Raw content: {len(content)} chars")
        logger.info(f"  Cleaned HTML: {len(html)} chars")
        logger.info(f"  Format: {'JSON' if has_json else 'Raw HTML'}")
        logger.info(f"  Has HTML tags: {has_html}")
        logger.info(f"  Has <img>: {has_img}")
        logger.info(f"  Has CTA: {has_cta}")
        logger.info(f"  Usage: {meta.get('usage', {})}")
        logger.info(f"  Finish: {meta.get('finish', '?')}")

        # Save output
        out_name = model_label.replace(" ", "_").replace("/", "_").replace("(", "").replace(")", "")
        out_path = f"/tmp/sandbox_{out_name}.html"
        Path(out_path).write_text(html if html else content)
        logger.info(f"  Saved: {out_path}")

        results.append({
            "model": model_label,
            "status": "OK" if has_html else "NO_HTML",
            "raw_chars": len(content),
            "html_chars": len(html),
            "format": "JSON" if has_json else "HTML",
            "has_img": has_img,
            "has_cta": has_cta,
            "file": out_path,
        })

        await asyncio.sleep(2)  # Be gentle

    # ── Summary ───────────────────────────────────────────────────
    logger.info(f"\n{'=' * 60}")
    logger.info("RESULTS SUMMARY")
    logger.info(f"{'=' * 60}")
    for r in results:
        status = "✓" if r["status"] == "OK" else "✗"
        logger.info(f"  {status} {r['model']:30s} {r.get('html_chars', 0):>6} chars  {r.get('format', '?'):>5}  img={r.get('has_img', '?')}  cta={r.get('has_cta', '?')}")

    # Open all HTML files
    for r in results:
        if r["status"] == "OK" and r.get("file"):
            subprocess.run(["open", r["file"]], check=False)


if __name__ == "__main__":
    asyncio.run(run_sandbox())
