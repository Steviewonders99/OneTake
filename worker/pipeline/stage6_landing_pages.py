"""Stage 6: Landing Page Generation — Per-Persona.

For each persona × language:
1. Extract hard facts from intake data (template variables — NEVER LLM-generated)
2. Pull best Stage 3 copy for hero/CTA (message match between ad and LP)
3. Generate informational sections via Gemma 4 31B (why, activities, sessions, FAQ)
   with full persona psychology + cultural research + job requirements
4. Render HTML via Jinja2 template with all variables injected
5. Validate drift — deterministic cross-check of every hard fact
6. Upload HTML to Vercel Blob
7. Save as landing_page asset in generated_assets

The copy is grounded in:
  - Job requirements from intake form (task_description, qualifications, engagement_model)
  - Derived requirements from Stage 1 (task_steps, equipment, time_estimate)
  - Persona psychology (motivations, pain_points, objections, trigger_words)
  - Cultural research (region-specific gig perception, trust builders, platform reality)
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from ai.local_llm import generate_copy
from blob_uploader import upload_to_blob
from neon_client import _get_pool, get_assets, save_asset
from prompts.landing_page_copy import LP_COPY_SYSTEM_PROMPT, build_lp_copy_prompt
from prompts.project_context import build_project_context
from templates.lp_renderer import render_landing_page, select_template

from pipeline.lp_drift_validator import LANG_CODES, validate_landing_page
from pipeline.stage3_copy import derive_languages_from_regions

logger = logging.getLogger(__name__)


async def run_stage6(context: dict) -> dict:
    """Generate per-persona landing pages with culturally-grounded copy."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    form_data: dict = context.get("form_data", {})
    personas: list[dict] = context.get("personas", brief.get("personas", []))
    cultural_research: dict = context.get("cultural_research", {})
    regions: list[str] = context.get("target_regions", [])
    target_languages: list[str] = context.get("target_languages", [])
    request_title: str = context.get(
        "request_title",
        form_data.get("title", brief.get("title", "Campaign")),
    )

    if not personas:
        logger.warning("Stage 6: No personas found — skipping LP generation")
        return {"landing_page_count": 0}

    # Derive language list (same logic as Stage 3)
    languages = derive_languages_from_regions(regions, target_languages)

    # Load prior stage assets
    copy_assets = await get_assets(request_id, asset_type="copy")
    composed_assets = await get_assets(request_id, asset_type="composed_creative")
    base_images = await get_assets(request_id, asset_type="base_image")

    logger.info(
        "Stage 6 inputs: %d personas, %d languages, %d copy assets, %d composed, %d base images",
        len(personas), len(languages), len(copy_assets), len(composed_assets), len(base_images),
    )

    # Load apply URL from campaign_landing_pages
    apply_url = await _get_apply_url(request_id)

    # Campaign slug for LP URLs
    slug_base = _slugify(request_title)

    lp_count = 0

    for persona in personas:
        persona_name = persona.get(
            "persona_name",
            persona.get("name", persona.get("archetype_key", "candidate")),
        )
        persona_key = persona.get("archetype_key", persona_name)
        persona_region = persona.get("region", regions[0] if regions else "")

        for language in languages:
            logger.info("═" * 60)
            logger.info("Generating LP: %s × %s", persona_name, language)
            logger.info("═" * 60)

            # ── 1. Hard facts — injected as template vars, NEVER LLM-generated ──
            hard_facts = _build_hard_facts(
                form_data=form_data,
                request_title=request_title,
                persona_region=persona_region,
                apply_url=apply_url,
                language=language,
            )

            # ── 2. Best Stage 3 copy for hero/CTA message match ──
            hero_copy = _extract_best_copy(copy_assets, persona_key, language)
            logger.info(
                "Hero copy: h1=%s, cta=%s",
                hero_copy.get("hero_h1", "")[:40],
                hero_copy.get("cta_text", ""),
            )

            # ── 3. Image URLs ──
            image_urls = _extract_images(composed_assets, base_images, persona_key)

            # ── 4. Generate informational copy via Gemma 4 ──
            project_ctx = build_project_context(
                request={
                    "title": request_title,
                    "task_type": form_data.get("task_type", ""),
                    "target_regions": regions,
                    "target_languages": target_languages,
                    "work_mode": form_data.get("work_mode", "remote"),
                },
                brief=brief,
                persona=persona,
                cultural_research=cultural_research,
            )

            copy_prompt = build_lp_copy_prompt(
                persona=persona,
                brief=brief,
                form_data=form_data,
                cultural_research=cultural_research,
                project_context=project_ctx,
                language=language,
            )

            logger.info("Calling Gemma 4 for LP copy (%d char prompt)...", len(copy_prompt))
            raw_copy = await generate_copy(
                LP_COPY_SYSTEM_PROMPT,
                copy_prompt,
                skill_stage="landing_page",
                max_tokens=4096,
                temperature=0.7,
            )
            generated_copy = _parse_json(raw_copy)

            # Validate we got required sections
            if not generated_copy.get("why_cards"):
                logger.warning("Missing why_cards — retrying with explicit instruction")
                raw_copy = await generate_copy(
                    LP_COPY_SYSTEM_PROMPT,
                    copy_prompt + "\n\nIMPORTANT: You MUST include why_cards, activities, session_details, and faq. Output valid JSON.",
                    skill_stage="landing_page",
                    max_tokens=4096,
                    temperature=0.6,
                )
                generated_copy = _parse_json(raw_copy)

            logger.info(
                "Generated copy: %d why_cards, %d activities, %d sessions, %d faq",
                len(generated_copy.get("why_cards", [])),
                len(generated_copy.get("activities", [])),
                len(generated_copy.get("session_details", [])),
                len(generated_copy.get("faq", [])),
            )

            # ── 5. Select template and render ──
            template_key = select_template(
                form_data.get("task_type", ""),
                persona,
            )

            html = render_landing_page(
                template_key=template_key,
                hard_facts=hard_facts,
                generated_copy=generated_copy,
                hero_copy=hero_copy,
                image_urls=image_urls,
            )

            logger.info("Rendered HTML: %d chars", len(html))

            # ── 6. Drift validation ──
            passed, drift_issues = validate_landing_page(html, hard_facts)

            if not passed:
                logger.warning(
                    "LP DRIFT VALIDATION FAILED for %s/%s: %s",
                    persona_name, language, drift_issues,
                )
                await save_asset(request_id, {
                    "asset_type": "landing_page",
                    "platform": "landing_page",
                    "format": "html",
                    "language": language,
                    "blob_url": "",
                    "stage": 6,
                    "evaluation_passed": False,
                    "evaluation_data": {"drift_issues": drift_issues},
                    "metadata": {
                        "persona_key": persona_key,
                        "persona_name": persona_name,
                        "template": template_key,
                    },
                })
                continue

            # ── 7. Upload to Vercel Blob ──
            filename = f"{slug_base}--{_slugify(persona_key)}_{language}.html"
            blob_url = await upload_to_blob(
                html.encode("utf-8"),
                filename,
                folder="landing_pages",
                content_type="text/html",
            )

            # ── 8. Save asset ──
            await save_asset(request_id, {
                "asset_type": "landing_page",
                "platform": "landing_page",
                "format": "html",
                "language": language,
                "blob_url": blob_url,
                "stage": 6,
                "evaluation_passed": True,
                "evaluation_score": 1.0,
                "metadata": {
                    "persona_key": persona_key,
                    "persona_name": persona_name,
                    "template": template_key,
                    "slug": f"{slug_base}--{_slugify(persona_key)}",
                    "generated_copy_keys": list(generated_copy.keys()),
                },
            })

            lp_count += 1
            logger.info(
                "✓ LP saved: %s/%s → %s",
                persona_name, language, blob_url,
            )

    logger.info("Stage 6 complete: %d landing pages generated", lp_count)
    return {"landing_page_count": lp_count}


# ── Private helpers ───────────────────────────────────────────────────


def _build_hard_facts(
    form_data: dict[str, Any],
    request_title: str,
    persona_region: str,
    apply_url: str,
    language: str,
) -> dict[str, Any]:
    """Build the hard facts dict — values injected verbatim into template."""
    compensation_rate = form_data.get("compensation_rate", "")
    compensation_model = form_data.get("compensation_model", "")

    compensation_display = f"${compensation_rate}" if compensation_rate else ""
    compensation_subtitle = compensation_model if compensation_model else "per participant"

    # Parse qualifications into structured list
    quals_raw = form_data.get("qualifications_required", "")
    qualifications: list[dict[str, str]] = []
    if quals_raw:
        for line in quals_raw.split("\n"):
            line = line.strip().lstrip("•-*").strip()
            if line:
                qualifications.append({
                    "title": line[:100],
                    "description": line[100:] if len(line) > 100 else "",
                })

    page_lang = LANG_CODES.get(language, "en")

    return {
        "title": request_title,
        "page_lang": page_lang,
        "apply_url": apply_url,
        "compensation_amount": compensation_display,
        "compensation_subtitle": compensation_subtitle,
        "qualifications": qualifications,
        "work_mode": form_data.get("work_mode", "remote"),
        "hero_meta_pay": compensation_display or "Competitive",
        "hero_meta_time": form_data.get("engagement_model", "Flexible schedule"),
        "hero_meta_location": form_data.get("location_scope", persona_region) or "Remote",
        "pay_features": [
            {"title": "Flexible scheduling", "description": "Work at times that suit you. Most finish in one session."},
            {"title": "Twice-monthly payouts", "description": "Payoneer or PayPal. No fees, no minimums."},
        ],
    }


def _extract_best_copy(
    copy_assets: list[dict],
    persona_key: str,
    language: str,
) -> dict[str, str]:
    """Extract the best Stage 3 copy for hero/CTA message match."""
    best: dict | None = None
    best_score = -1.0

    for asset in copy_assets:
        meta = asset.get("content") or asset.get("metadata") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (ValueError, TypeError):
                continue

        if meta.get("persona_key") != persona_key:
            continue
        if asset.get("language", "").lower() != language.lower():
            continue

        score = float(meta.get("eval_score", asset.get("evaluation_score", 0)) or 0)
        if score > best_score:
            best_score = score
            copy_data = meta.get("copy_data", {})
            if isinstance(copy_data, str):
                try:
                    copy_data = json.loads(copy_data)
                except (ValueError, TypeError):
                    copy_data = {}
            best = copy_data

    if not best:
        return {
            "hero_h1": "Join Our Global Team",
            "hero_subtitle": "Be part of work that shapes the future of AI.",
            "hero_badge": "Now Hiring",
            "cta_text": "Apply Now",
        }

    return {
        "hero_h1": best.get("headline", best.get("hook", "Join Our Global Team")),
        "hero_subtitle": best.get("body", best.get("description", "")),
        "hero_badge": best.get("hook_type", "Now Hiring"),
        "cta_text": best.get("cta", "Apply Now"),
    }


def _extract_images(
    composed_assets: list[dict],
    base_images: list[dict],
    persona_key: str,
) -> dict[str, Any]:
    """Extract hero (composed creative) + interior (base actor) images."""
    hero_url = ""
    best_score = -1.0

    for asset in composed_assets:
        meta = asset.get("content") or {}
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (ValueError, TypeError):
                meta = {}
        pk = meta.get("persona_key", str(asset.get("actor_id", "")))
        if str(pk) != str(persona_key):
            continue
        score = float(asset.get("evaluation_score", 0) or 0)
        if score > best_score and asset.get("blob_url"):
            best_score = score
            hero_url = asset["blob_url"]

    # Interior images — base actor photos (warm, authentic feel)
    actor_urls = []
    for asset in base_images:
        if asset.get("blob_url") and asset["blob_url"] != hero_url:
            actor_urls.append(asset["blob_url"])
        if len(actor_urls) >= 4:
            break

    return {
        "hero_image_url": hero_url,
        "actor_images": actor_urls,
    }


async def _get_apply_url(request_id: str) -> str:
    """Fetch the apply URL from campaign_landing_pages."""
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT ada_form_url, job_posting_url, landing_page_url "
                "FROM campaign_landing_pages WHERE request_id = $1",
                request_id,
            )
        if row:
            return (
                row.get("ada_form_url")
                or row.get("job_posting_url")
                or row.get("landing_page_url")
                or "#apply"
            )
    except Exception as exc:
        logger.warning("Could not fetch apply URL: %s", exc)
    return "#apply"


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:80]


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles code fences and markdown."""
    if not text:
        return {}
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1]
    if "```" in cleaned:
        cleaned = cleaned.split("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except (ValueError, TypeError):
        logger.warning("Failed to parse LP copy JSON (%d chars), returning empty", len(cleaned))
        return {}
