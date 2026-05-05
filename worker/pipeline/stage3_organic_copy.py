"""Stage 3 Organic: Generate copy for WP posts, job portals, flyers, and social captions.

Produces 4 asset types per persona × locale:
- wp_job_post: Full WordPress job post body
- job_portal_copy: Platform-adapted copy for Indeed, LinkedIn Jobs, Glassdoor
- flyer_copy: Concise headline + body for print flyers
- social_caption: Per-platform captions (LinkedIn, IG, Facebook, Twitter/X)
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ai.nim_client import generate_text
from neon_client import save_generated_asset, get_intake_request

logger = logging.getLogger(__name__)

# Job portal platforms to generate copy for
JOB_PORTALS = ["indeed", "linkedin_jobs", "glassdoor"]

# Social platforms for captions
SOCIAL_PLATFORMS = ["linkedin", "instagram", "facebook", "twitter"]

ORGANIC_COPY_SYSTEM = """You are an expert recruitment copywriter for OneForma, a global data annotation and AI training platform.
You write authentic, specific job postings and social content that speaks directly to the candidate persona.
Never use generic corporate language. Always include specific details about the work, requirements, and what makes this opportunity unique.
Use the cultural research and persona psychology to adapt tone and framing per locale."""


async def run_stage3_organic(context: dict) -> dict:
    """Generate organic copy assets: WP posts, portal copy, flyer copy, social captions."""
    request_id: str = context["request_id"]
    request = await get_intake_request(request_id)
    personas = context.get("personas", [])
    cultural_research = context.get("cultural_research", {})
    brief = context.get("brief", {})
    country = context.get("country", "")
    form_data = context.get("form_data", request.get("form_data", {}))

    target_regions = context.get("target_regions", request.get("target_regions", []))
    if country:
        target_regions = [country]

    copy_count = 0

    for persona in personas:
        persona_name = persona.get("label", persona.get("name", "Unknown"))
        persona_key = persona.get("key", persona_name.lower().replace(" ", "_"))

        for region in target_regions:
            region_research = cultural_research.get(region, {})
            language = _get_language_for_region(region)

            # 1. WordPress Job Post
            wp_copy = await _generate_wp_post(
                request, persona, region_research, brief, language, region
            )
            if wp_copy:
                await save_generated_asset(
                    request_id=request_id,
                    asset_type="wp_job_post",
                    platform="wordpress",
                    format="text",
                    language=language,
                    country=region,
                    content=wp_copy,
                    copy_data={"persona_key": persona_key, "persona_name": persona_name},
                    stage=3,
                )
                copy_count += 1

            # 2. Job Portal Copy (per portal)
            for portal in JOB_PORTALS:
                portal_copy = await _generate_portal_copy(
                    request, persona, region_research, brief, language, region, portal
                )
                if portal_copy:
                    await save_generated_asset(
                        request_id=request_id,
                        asset_type="job_portal_copy",
                        platform=portal,
                        format="text",
                        language=language,
                        country=region,
                        content=portal_copy,
                        copy_data={"persona_key": persona_key, "persona_name": persona_name, "portal": portal},
                        stage=3,
                    )
                    copy_count += 1

            # 3. Flyer Copy
            flyer_copy = await _generate_flyer_copy(
                request, persona, region_research, brief, language, region
            )
            if flyer_copy:
                await save_generated_asset(
                    request_id=request_id,
                    asset_type="flyer_copy",
                    platform="print",
                    format="text",
                    language=language,
                    country=region,
                    content=flyer_copy,
                    copy_data={"persona_key": persona_key, "persona_name": persona_name},
                    stage=3,
                )
                copy_count += 1

            # 4. Social Captions (per platform)
            for social_platform in SOCIAL_PLATFORMS:
                caption = await _generate_social_caption(
                    request, persona, region_research, brief, language, region, social_platform
                )
                if caption:
                    await save_generated_asset(
                        request_id=request_id,
                        asset_type="social_caption",
                        platform=social_platform,
                        format="text",
                        language=language,
                        country=region,
                        content=caption,
                        copy_data={"persona_key": persona_key, "persona_name": persona_name, "platform": social_platform},
                        stage=3,
                    )
                    copy_count += 1

    logger.info("Stage 3 Organic complete: %d copy assets generated", copy_count)
    return {"copy_count": copy_count}


async def _generate_wp_post(
    request: dict, persona: dict, research: dict, brief: dict, language: str, region: str
) -> dict | None:
    """Generate a full WordPress job post."""
    prompt = f"""Write a complete job posting for WordPress.

JOB TITLE: {request.get('title', 'Untitled')}
PERSONA: {persona.get('label', '')} — {persona.get('psychology', {}).get('core_motivation', '')}
REGION: {region}
LANGUAGE: {language}
CULTURAL CONTEXT: {json.dumps(research.get('communication_style', {}), default=str)[:500]}
BRIEF: {brief.get('campaign_objective', '')}

REQUIREMENTS FROM JOB:
- Qualifications: {request.get('qualifications_required', 'Not specified')}
- Location: {request.get('location_scope', 'Remote')}
- Engagement: {request.get('engagement_model', 'Flexible')}

Output JSON with these fields:
{{
  "title": "Job post title (compelling, not generic)",
  "intro": "Opening paragraph (2-3 sentences, hooks the persona)",
  "what_youll_do": "Description of the work (3-5 bullet points)",
  "requirements": "What we're looking for (3-5 bullet points)",
  "benefits": "Why join (3-4 bullet points, speak to persona motivations)",
  "cta": "Call to action (1 sentence, specific next step)",
  "meta_description": "SEO meta description (under 160 chars)"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("WP post generation failed for %s/%s: %s", persona.get("label"), region, e)
        return None


async def _generate_portal_copy(
    request: dict, persona: dict, research: dict, brief: dict,
    language: str, region: str, portal: str
) -> dict | None:
    """Generate job portal-specific copy (Indeed, LinkedIn Jobs, Glassdoor)."""
    char_limits = {"indeed": 4000, "linkedin_jobs": 2000, "glassdoor": 3000}
    limit = char_limits.get(portal, 3000)

    prompt = f"""Write a job posting optimized for {portal.replace('_', ' ').title()}.

JOB: {request.get('title', 'Untitled')}
PERSONA TARGET: {persona.get('label', '')}
REGION: {region} | LANGUAGE: {language}
CHARACTER LIMIT: {limit} chars
PLATFORM STYLE: {"Concise, keyword-rich" if portal == "indeed" else "Professional, detailed" if portal == "linkedin_jobs" else "Transparent, culture-focused"}

REQUIREMENTS: {request.get('qualifications_required', '')}
ENGAGEMENT: {request.get('engagement_model', 'Flexible')}

Output JSON:
{{
  "title": "Platform-optimized title",
  "body": "Full posting body (within char limit)",
  "keywords": ["relevant", "search", "keywords"],
  "salary_text": "Compensation description (if applicable)"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("Portal copy failed for %s/%s/%s: %s", portal, persona.get("label"), region, e)
        return None


async def _generate_flyer_copy(
    request: dict, persona: dict, research: dict, brief: dict, language: str, region: str
) -> dict | None:
    """Generate concise flyer copy (headline + body + CTA for print layout)."""
    prompt = f"""Write flyer copy for a recruitment flyer. Must be CONCISE — this is print.

JOB: {request.get('title', 'Untitled')}
PERSONA: {persona.get('label', '')} — motivated by: {persona.get('psychology', {}).get('core_motivation', '')}
REGION: {region} | LANGUAGE: {language}
CULTURAL TONE: {research.get('communication_style', {}).get('tone', 'professional')}

Output JSON:
{{
  "headline": "Bold headline (max 8 words)",
  "subheadline": "Supporting line (max 15 words)",
  "body": "Key info (2-3 short bullet points or sentences, max 50 words total)",
  "cta": "Action phrase (max 5 words, e.g., 'Scan to Apply Now')",
  "qr_label": "Text below QR code (e.g., 'Scan for details')"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("Flyer copy failed for %s/%s: %s", persona.get("label"), region, e)
        return None


async def _generate_social_caption(
    request: dict, persona: dict, research: dict, brief: dict,
    language: str, region: str, platform: str
) -> dict | None:
    """Generate a social media caption for a specific platform."""
    platform_guidance = {
        "linkedin": "Professional but human. 1-3 short paragraphs. Emojis sparingly. End with a question or CTA. Include 3-5 hashtags.",
        "instagram": "Casual, visual-first language. Short punchy sentences. Include 10-15 hashtags at the end. Use relevant emojis.",
        "facebook": "Conversational, community-oriented. Medium length. 1-2 hashtags max. Include a clear CTA.",
        "twitter": "Under 280 chars. Punchy, direct. 1-2 hashtags. Include link placeholder [LINK].",
    }

    prompt = f"""Write a social media caption for {platform.title()}.

JOB: {request.get('title', 'Untitled')}
PERSONA TARGET: {persona.get('label', '')}
REGION: {region} | LANGUAGE: {language}
PLATFORM STYLE: {platform_guidance.get(platform, 'Professional and engaging')}
BRAND VOICE: OneForma — global, inclusive, opportunity-focused

Output JSON:
{{
  "caption": "The full caption text",
  "hashtags": ["hashtag1", "hashtag2"],
  "cta_type": "link_in_bio|swipe_up|comment|dm"
}}"""

    try:
        result = await generate_text(ORGANIC_COPY_SYSTEM, prompt)
        return json.loads(_extract_json(result))
    except Exception as e:
        logger.warning("Social caption failed for %s/%s/%s: %s", platform, persona.get("label"), region, e)
        return None


def _get_language_for_region(region: str) -> str:
    """Map region/country to primary professional language."""
    REGION_LANGUAGES = {
        "BR": "pt", "MX": "es", "ES": "es", "AR": "es", "CO": "es",
        "JP": "ja", "KR": "ko", "CN": "zh", "TW": "zh",
        "DE": "de", "FR": "fr", "IT": "it", "NL": "nl",
        "SA": "ar", "AE": "ar", "EG": "ar",
        "IN": "en", "PH": "en", "NG": "en", "KE": "en",
        "TR": "tr", "PL": "pl", "RU": "ru", "UA": "uk",
        "TH": "th", "VN": "vi", "ID": "id", "MY": "ms",
    }
    return REGION_LANGUAGES.get(region.upper(), "en")


def _extract_json(text: str) -> str:
    """Extract JSON from LLM response (handles markdown fences)."""
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()
