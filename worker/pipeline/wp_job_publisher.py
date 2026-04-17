"""WordPress job auto-publisher — Step 0 of Stage 1.

When a recruiter submits an intake form, this module:
1. Structures the JD via Qwen 3.5 (AI formats, hard facts injected verbatim)
2. Publishes to WordPress as a 'job' custom post type
3. Sets Job Types + Job Tags taxonomies
4. Sets CPT meta fields (Apply Job repeater with per-language rows)
5. Captures the live URL → upserts campaign_landing_pages.job_posting_url
6. Auto-creates UTM tracked links for the recruiter

Non-fatal: if WP publish fails, the pipeline continues without it.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from ai.local_llm import generate_text
from neon_client import _get_pool, upsert_campaign_landing_page
from prompts.job_description_copy import JD_SYSTEM_PROMPT, build_jd_content_prompt

logger = logging.getLogger(__name__)

# ── Taxonomy mappings ─────────────────────────────────────────────────

TASK_TYPE_TO_JOB_TYPE: dict[str, str] = {
    "annotation": "Annotation",
    "data_collection": "Data Collection",
    "transcription": "Transcription",
    "translation": "Translation",
    "judging": "Judging",
    "llm_prompt_authoring": "LLM Prompt Authoring",
    "audio_speech": "Data Collection",
    "video": "Data Collection",
    "survey": "Data Collection",
}

COMPENSATION_TO_TAG: dict[str, str] = {
    "per_hour": "Fixed Rate Per Hour",
    "per_asset": "Fixed Rate Per Approved Asset",
    "per_completion": "Fixed Rate Upon Completion",
    "per_word": "Fixed Rate Per Source Word",
    "hourly": "Fixed Rate Per Hour",
    "per_task": "Fixed Rate Upon Completion",
    "fixed": "Fixed Rate Upon Completion",
}

REGION_DISPLAY: dict[str, str] = {
    "US": "US", "GB": "UK", "CA": "Canada", "AU": "Australia",
    "BR": "Brazil", "MX": "Mexico", "DE": "Germany", "FR": "France",
    "JP": "Japan", "KR": "South Korea", "IN": "India", "SG": "Singapore",
    "PH": "Philippines", "ID": "Indonesia", "MA": "Morocco",
    "EG": "Egypt", "SA": "Saudi Arabia", "AE": "UAE", "NG": "Nigeria",
    "ZA": "South Africa", "TR": "Turkey", "PL": "Poland", "NL": "Netherlands",
    "TW": "Taiwan", "TH": "Thailand", "VN": "Vietnam", "CO": "Colombia",
    "AR": "Argentina", "CL": "Chile", "PE": "Peru", "RO": "Romania",
    "UA": "Ukraine", "RU": "Russia", "FI": "Finland", "SE": "Sweden",
    "NO": "Norway", "DK": "Denmark", "GR": "Greece", "IL": "Israel",
    "KE": "Kenya", "NZ": "New Zealand", "BE": "Belgium",
}


async def publish_job_to_wordpress(
    request_id: str,
    request: dict[str, Any],
    form_data: dict[str, Any],
    target_languages: list[str],
    target_regions: list[str],
) -> dict[str, Any]:
    """Publish JD to WordPress and return the live URL.

    Returns dict with 'wp_url', 'wp_post_id', and 'tracked_links'.
    Non-fatal — returns empty results on failure so the pipeline continues.
    """
    title = request.get("title", form_data.get("title", "Untitled"))
    task_type = request.get("task_type", "data_collection")

    # ── 1. Structure JD content via Qwen 3.5 ──────────────────────────
    logger.info("Structuring JD content for WP: %s", title)
    jd_prompt = build_jd_content_prompt(form_data, request)

    raw_response = await generate_text(
        JD_SYSTEM_PROMPT,
        jd_prompt,
        thinking=False,
        max_tokens=2048,
        temperature=0.5,
    )
    jd_data = _parse_json(raw_response)

    # Assemble HTML content from structured sections
    html_sections = [
        jd_data.get("description_html", ""),
        jd_data.get("purpose_html", ""),
        jd_data.get("requirements_html", ""),
    ]
    if jd_data.get("preferred_html"):
        html_sections.append(jd_data["preferred_html"])
    html_sections.append(jd_data.get("compensation_html", ""))
    html_sections.append(jd_data.get("details_html", ""))

    content = "\n\n".join(s for s in html_sections if s)

    if not content.strip():
        logger.warning("JD content generation returned empty — using raw task_description")
        content = f"<h2>Description:</h2><p>{form_data.get('task_description', '')}</p>"

    # ── 2. Build taxonomy terms ───────────────────────────────────────
    job_type = TASK_TYPE_TO_JOB_TYPE.get(task_type, "Data Collection")

    comp_model = form_data.get("compensation_model", "")
    job_tags: list[str] = []
    if comp_model:
        tag = COMPENSATION_TO_TAG.get(comp_model.lower().replace(" ", "_"))
        if tag:
            job_tags.append(tag)

    if not target_regions or len(target_regions) > 10:
        job_tags.append("Worldwide")
    else:
        for region in target_regions:
            display = REGION_DISPLAY.get(region, region)
            job_tags.append(display)

    # ── 3. Build CPT meta — Apply Job repeater ────────────────────────
    apply_url = await _get_apply_url(request_id)

    languages = target_languages if target_languages else ["English"]
    apply_rows = [
        {"language": lang, "apply_url": apply_url}
        for lang in languages
    ]

    apply_title = (
        f"This role is available in {languages[0]}"
        if len(languages) == 1
        else "This role is available in multiple languages"
    )

    meta = {
        "apply_job_title": apply_title,
        "apply_job_description": "Select the one most relevant to you.",
        "apply_job": apply_rows,
    }

    # ── 4. Publish to WordPress ───────────────────────────────────────
    slug = _slugify(title)

    from config import WP_PUBLISH_STATUS, WP_SITE_URL
    if not WP_SITE_URL:
        logger.warning("WP_SITE_URL not set — skipping WordPress publish")
        return {"wp_url": "", "wp_post_id": None}

    publish_status = WP_PUBLISH_STATUS or "draft"
    logger.info("WP publish status: %s", publish_status)

    try:
        from wp_rest_client import WordPressClient

        async with WordPressClient() as wp:
            result = await wp.create_job_post(
                title=title,
                content=content,
                status=publish_status,
                slug=slug,
                meta=meta,
                job_types=[job_type],
                job_tags=job_tags,
            )

        wp_url = result.get("link") or result.get("url", "")
        wp_preview_url = result.get("preview_url", "")
        wp_post_id = result.get("id")
        wp_status = result.get("status", publish_status)

        # For drafts, store the preview URL so recruiters can see it immediately
        # For published, store the clean permalink
        effective_url = wp_url if wp_status == "publish" else (wp_preview_url or wp_url)
        logger.info(
            "WP job %s: %s → %s (preview: %s)",
            wp_status, title, wp_url, wp_preview_url,
        )

    except Exception as exc:
        logger.error("WordPress publish failed (non-fatal): %s", exc, exc_info=True)
        return {"wp_url": "", "wp_post_id": None}

    # ── 5. Upsert campaign_landing_pages.job_posting_url ──────────────
    if effective_url:
        await upsert_campaign_landing_page(request_id, "job_posting_url", effective_url)
        logger.info("Stored job_posting_url: %s", effective_url)

    # ── 6. UTM tracked links ────────────────────────────────────────────
    # NOTE: Tracked links are created by recruiters via the frontend
    # (/api/tracked-links POST) which handles slug generation, UTM params,
    # and all NOT NULL constraints correctly. The worker only needs to
    # ensure campaign_landing_pages has the job_posting_url so the
    # frontend readiness gate passes.

    return {
        "wp_url": wp_url,
        "wp_preview_url": wp_preview_url,
        "wp_effective_url": effective_url,
        "wp_post_id": wp_post_id,
        "wp_status": wp_status,
    }


# ── Private helpers ───────────────────────────────────────────────────


async def _get_apply_url(request_id: str) -> str:
    """Fetch existing apply URL from campaign_landing_pages."""
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
    except Exception:
        pass
    return "#apply"


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:80]


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output — handles code fences."""
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
        logger.warning("Failed to parse JD JSON (%d chars)", len(cleaned))
        return {}
