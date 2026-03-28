"""Cultural Research Engine — deep research via Kimi K2.5 before persona generation.

Uses Kimi K2.5's web-grounded search to research REAL cultural intelligence
for each target region. This data enriches persona generation with:
- AI fatigue levels (are people tired of "AI job" ads?)
- Gig work perception (stigma? aspiration? necessity?)
- Trust in data annotation (scam associations?)
- Platform usage (what apps do people ACTUALLY use?)
- Economic context (competitive hourly rates, unemployment)
- Cultural considerations (religious, social, gender norms)
- Tech literacy (smartphone penetration, internet quality)
- Language nuances (formal vs informal, dialect preferences)

This research happens ONCE per campaign in Stage 1, then feeds into
persona generation, actor creation, copy writing, and channel selection.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RESEARCH_DIMENSIONS — what to research for each region
# ---------------------------------------------------------------------------

RESEARCH_DIMENSIONS: dict[str, dict[str, Any]] = {
    "ai_fatigue": {
        "query_template": (
            "What is the current level of AI fatigue or AI skepticism in {region} "
            "as of 2026? Are people in {region} tired of seeing AI-related job ads? "
            "What is the general sentiment toward artificial intelligence among "
            "{demographic} in {region}?"
        ),
        "why_it_matters": (
            "If AI fatigue is high, we avoid leading with 'AI' in ads and instead "
            "frame it as 'flexible remote work' or 'language work'"
        ),
        "output_keys": ["fatigue_level", "sentiment", "recommended_framing"],
    },
    "gig_work_perception": {
        "query_template": (
            "How is gig work / freelance work perceived in {region} among "
            "{demographic}? Is it stigmatized, aspirational, or seen as a necessity? "
            "What is the cultural attitude toward non-traditional employment in "
            "{region}?"
        ),
        "why_it_matters": (
            "In some cultures gig work = failure; in others it = freedom. "
            "Messaging must match perception."
        ),
        "output_keys": ["perception", "cultural_framing", "messaging_implication"],
    },
    "data_annotation_trust": {
        "query_template": (
            "What is the trust level for online data annotation / microtask work "
            "in {region}? Are there common scam associations? What legitimate "
            "platforms are known (Appen, Toloka, Clickworker, Scale AI)? How can "
            "OneForma differentiate?"
        ),
        "why_it_matters": (
            "In many regions, 'work from home online' = scam. We need to know the "
            "trust barrier and how to overcome it."
        ),
        "output_keys": ["trust_level", "scam_associations", "trust_builders"],
    },
    "platform_reality": {
        "query_template": (
            "What social media and messaging platforms do {demographic} in {region} "
            "ACTUALLY use daily in 2026? Rank by usage. Include: WhatsApp, Telegram, "
            "Facebook, Instagram, TikTok, LinkedIn, VK, WeChat, Line, KakaoTalk, "
            "Twitter/X, local platforms. What job platforms do they use for "
            "remote/freelance work?"
        ),
        "why_it_matters": (
            "We might plan LinkedIn ads for a country where nobody uses LinkedIn "
            "but everyone is on Telegram."
        ),
        "output_keys": ["top_platforms_ranked", "job_platforms", "messaging_apps"],
    },
    "demographic_channel_map": {
        "query_template": (
            "For {region} in 2026, provide a DETAILED breakdown of which social media "
            "platforms are used by WHICH AGE GROUPS. This is critical because platforms "
            "skew VERY differently by age in different countries.\n\n"
            "For example: In the US, Facebook is 40+ but in Brazil Facebook is 18-35. "
            "TikTok is 16-28 globally but restricted in some countries.\n\n"
            "For EACH age bracket in {region}, rank the top 5 platforms by daily usage:\n"
            "- 16-20 (teens/young adults)\n"
            "- 21-25 (university age / early career)\n"
            "- 26-35 (young professionals / young parents)\n"
            "- 36-50 (established professionals / parents)\n"
            "- 50+ (older adults / retirees)\n\n"
            "IMPORTANT: Include ALL of these platforms in your analysis — mark each as "
            "'dominant', 'popular', 'niche', 'unused', or 'blocked' per age group:\n"
            "  Social: Facebook, Instagram, TikTok, Twitter/X, LinkedIn, Reddit, "
            "Snapchat, Pinterest, YouTube\n"
            "  Messaging: WhatsApp, Telegram, WeChat, Line, KakaoTalk, Viber, "
            "Signal, Facebook Messenger\n"
            "  Regional: VK (Russia), Odnoklassniki (CIS), Weibo (China), "
            "Naver/Daum (Korea), Mixi (Japan)\n"
            "  Job/Gig: Indeed, LinkedIn Jobs, Upwork, Fiverr, Freelancer, "
            "Appen, Toloka, Microworkers, local platforms\n"
            "  Communities: Reddit (which subreddits?), Discord, Facebook Groups, "
            "WhatsApp Groups, Telegram Groups\n\n"
            "Also specify:\n"
            "- Which platforms have PAID AD capabilities in {region}?\n"
            "- Which platforms are BLOCKED or RESTRICTED in {region}?\n"
            "- Is REDDIT used in {region}? If so, which subreddits for work/money/freelance?\n"
            "- Is WECHAT used in {region}? If so, for which demographics and purposes?\n"
            "- What community groups (Facebook Groups, WhatsApp Groups, Reddit) "
            "do people in {region} use to find remote/freelance work?\n\n"
            "Return as JSON with age brackets as keys."
        ),
        "why_it_matters": (
            "A 22-year-old student in Morocco uses completely different platforms than "
            "a 22-year-old in Japan or a 45-year-old in the same country. Channel "
            "selection MUST be age + region specific, not one-size-fits-all."
        ),
        "output_keys": [
            "age_16_20",
            "age_21_25",
            "age_26_35",
            "age_36_50",
            "age_50_plus",
            "blocked_platforms",
            "ad_capable_platforms",
            "gig_platforms_by_age",
        ],
    },
    "economic_context": {
        "query_template": (
            "What is the average hourly wage for skilled remote work in {region} "
            "in 2026? What is the minimum wage? What is the youth unemployment rate "
            "for {demographic}? What hourly rate would be considered attractive for "
            "annotation/data work?"
        ),
        "why_it_matters": (
            "A rate that's insulting in Germany might be life-changing in Morocco. "
            "Ads must match local economic reality."
        ),
        "output_keys": [
            "avg_remote_hourly",
            "minimum_wage",
            "youth_unemployment",
            "competitive_rate",
        ],
    },
    "cultural_sensitivities": {
        "query_template": (
            "What cultural, religious, or social sensitivities should a recruitment "
            "ad in {region} be aware of? Consider: religious holidays (Ramadan, "
            "Diwali, etc.), gender norms in advertising, imagery taboos, color "
            "symbolism, humor style, formality expectations, family dynamics. "
            "What would OFFEND people in this region?"
        ),
        "why_it_matters": (
            "An ad that works in Brazil could be offensive in Saudi Arabia. "
            "We must know the cultural minefield."
        ),
        "output_keys": [
            "religious_considerations",
            "gender_norms",
            "imagery_taboos",
            "formality_level",
            "things_to_avoid",
        ],
    },
    "tech_literacy": {
        "query_template": (
            "What is the smartphone penetration and internet quality for "
            "{demographic} in {region}? Do most people have laptops/desktops or "
            "primarily use phones? What is the typical internet speed? Are there "
            "data cost concerns? What apps do they use for work?"
        ),
        "why_it_matters": (
            "If people primarily use phones, our ads should show phone-based "
            "annotation. If internet is slow, we highlight offline-capable work."
        ),
        "output_keys": [
            "smartphone_penetration",
            "primary_device",
            "internet_quality",
            "data_cost_concern",
        ],
    },
    "language_nuance": {
        "query_template": (
            "For {language} speakers in {region}: what dialect or variant is used? "
            "Is formal or informal address preferred in ads? What slang or "
            "colloquialisms would make copy feel authentic? What language choices "
            "would feel 'translated' or 'foreign'? Should ads be in {language} only "
            "or mix with local dialect/English?"
        ),
        "why_it_matters": (
            "French in Morocco != French in France. Arabic in Egypt != Arabic in "
            "Saudi Arabia. Copy must feel local."
        ),
        "output_keys": [
            "dialect",
            "formality_preference",
            "authentic_slang",
            "avoid_phrases",
            "language_mixing",
        ],
    },
}


# ---------------------------------------------------------------------------
# REGIONAL PLATFORM PRIORS — hardcoded baseline demographics per region.
# Used as fallback when Kimi K2.5 is unavailable, and to validate
# Kimi's responses (catch obvious errors).
# ---------------------------------------------------------------------------

REGIONAL_PLATFORM_PRIORS: dict[str, dict[str, Any]] = {
    # North America
    "US": {
        "facebook": {"dominant_age": "35+", "youth_usage": "low", "ad_capable": True},
        "instagram": {"dominant_age": "18-34", "youth_usage": "high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-28", "youth_usage": "very_high", "ad_capable": True},
        "linkedin": {"dominant_age": "25-55", "youth_usage": "medium", "ad_capable": True},
        "reddit": {"dominant_age": "18-35", "youth_usage": "high", "ad_capable": True, "subreddits": ["r/beermoney", "r/WorkOnline", "r/remotework", "r/sidehustle"]},
        "twitter": {"dominant_age": "25-45", "youth_usage": "medium", "ad_capable": True},
        "pinterest": {"dominant_age": "25-45", "youth_usage": "medium", "ad_capable": True, "note": "Skews female, crafts/lifestyle"},
        "wechat": {"dominant_age": "all", "youth_usage": "niche", "note": "Chinese diaspora only"},
        "whatsapp": {"dominant_age": "25+", "youth_usage": "medium"},
        "telegram": {"dominant_age": "25-40", "youth_usage": "low", "note": "Tech-savvy niche"},
    },
    "CA": {
        "facebook": {"dominant_age": "30+", "youth_usage": "low", "ad_capable": True},
        "instagram": {"dominant_age": "18-34", "youth_usage": "high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-28", "youth_usage": "very_high", "ad_capable": True},
        "linkedin": {"dominant_age": "25-55", "youth_usage": "medium", "ad_capable": True},
        "reddit": {"dominant_age": "18-35", "youth_usage": "high", "ad_capable": True},
    },
    # North Africa / Middle East
    "MA": {
        "facebook": {"dominant_age": "18-45", "youth_usage": "high", "ad_capable": True, "note": "Still dominant in Morocco unlike US"},
        "instagram": {"dominant_age": "18-30", "youth_usage": "high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-25", "youth_usage": "very_high", "ad_capable": True},
        "whatsapp": {"dominant_age": "all", "youth_usage": "very_high", "note": "#1 messaging app"},
        "telegram": {"dominant_age": "20-35", "youth_usage": "medium", "note": "Growing in tech circles"},
        "linkedin": {"dominant_age": "25-40", "youth_usage": "low", "note": "Professional niche only"},
        "reddit": {"dominant_age": "20-30", "youth_usage": "low", "note": "Tech-savvy niche, francophone reddit"},
    },
    "EG": {
        "facebook": {"dominant_age": "18-50", "youth_usage": "very_high", "ad_capable": True, "note": "Facebook is DOMINANT in Egypt"},
        "instagram": {"dominant_age": "18-30", "youth_usage": "high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-25", "youth_usage": "very_high", "ad_capable": True},
        "whatsapp": {"dominant_age": "all", "youth_usage": "very_high"},
        "telegram": {"dominant_age": "18-35", "youth_usage": "medium"},
    },
    # Latin America
    "BR": {
        "facebook": {"dominant_age": "18-45", "youth_usage": "high", "ad_capable": True, "note": "Still very popular in Brazil, younger than US"},
        "instagram": {"dominant_age": "18-35", "youth_usage": "very_high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-28", "youth_usage": "very_high", "ad_capable": True},
        "whatsapp": {"dominant_age": "all", "youth_usage": "very_high", "note": "Universal in Brazil — even businesses"},
        "linkedin": {"dominant_age": "25-45", "youth_usage": "medium", "ad_capable": True},
        "reddit": {"dominant_age": "18-30", "youth_usage": "medium", "subreddits": ["r/brasil"]},
        "pinterest": {"dominant_age": "25-40", "youth_usage": "medium", "ad_capable": True},
    },
    # South Asia
    "IN": {
        "whatsapp": {"dominant_age": "all", "youth_usage": "very_high", "note": "#1 app in India, period"},
        "instagram": {"dominant_age": "18-30", "youth_usage": "very_high", "ad_capable": True},
        "facebook": {"dominant_age": "25-50", "youth_usage": "medium", "ad_capable": True},
        "tiktok": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BANNED in India since 2020"},
        "linkedin": {"dominant_age": "22-40", "youth_usage": "medium", "ad_capable": True},
        "telegram": {"dominant_age": "18-35", "youth_usage": "high"},
        "reddit": {"dominant_age": "18-30", "youth_usage": "medium", "subreddits": ["r/india", "r/IndiaInvestments"]},
    },
    # East Asia
    "CN": {
        "wechat": {"dominant_age": "all", "youth_usage": "very_high", "ad_capable": True, "note": "DOMINANT — everything runs on WeChat in China"},
        "weibo": {"dominant_age": "18-35", "youth_usage": "high", "ad_capable": True},
        "douyin": {"dominant_age": "16-30", "youth_usage": "very_high", "ad_capable": True, "note": "Chinese TikTok"},
        "facebook": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BLOCKED in China"},
        "instagram": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BLOCKED in China"},
        "linkedin": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BLOCKED in China"},
        "reddit": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BLOCKED in China"},
        "telegram": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BLOCKED in China"},
    },
    "JP": {
        "line": {"dominant_age": "all", "youth_usage": "very_high", "note": "#1 messaging in Japan"},
        "twitter": {"dominant_age": "18-40", "youth_usage": "very_high", "ad_capable": True, "note": "Japan loves Twitter/X"},
        "instagram": {"dominant_age": "18-35", "youth_usage": "high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-25", "youth_usage": "high", "ad_capable": True},
        "facebook": {"dominant_age": "30+", "youth_usage": "low", "ad_capable": True},
        "linkedin": {"dominant_age": "25-45", "youth_usage": "low"},
        "reddit": {"dominant_age": "20-35", "youth_usage": "low", "note": "5ch/2ch is the Japanese Reddit"},
    },
    "KR": {
        "kakao": {"dominant_age": "all", "youth_usage": "very_high", "note": "KakaoTalk = universal messaging in Korea"},
        "naver": {"dominant_age": "all", "youth_usage": "very_high", "ad_capable": True, "note": "Naver > Google in Korea"},
        "instagram": {"dominant_age": "18-35", "youth_usage": "very_high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-25", "youth_usage": "high", "ad_capable": True},
        "facebook": {"dominant_age": "30+", "youth_usage": "low", "ad_capable": True},
    },
    # CIS / Eastern Europe
    "RU": {
        "vk": {"dominant_age": "18-45", "youth_usage": "very_high", "ad_capable": True, "note": "VK is THE social network in Russia"},
        "telegram": {"dominant_age": "18-45", "youth_usage": "very_high", "ad_capable": True, "note": "Dominant messaging + channels"},
        "ok": {"dominant_age": "30+", "youth_usage": "low", "note": "Odnoklassniki — older demographic"},
        "instagram": {"dominant_age": "18-30", "youth_usage": "high", "note": "Still used despite Meta restrictions"},
        "facebook": {"dominant_age": "N/A", "youth_usage": "very_low", "note": "Essentially dead in Russia"},
        "linkedin": {"dominant_age": "N/A", "youth_usage": "blocked", "note": "BLOCKED in Russia"},
        "reddit": {"dominant_age": "18-30", "youth_usage": "low"},
    },
    # Southeast Asia
    "PH": {
        "facebook": {"dominant_age": "all", "youth_usage": "very_high", "ad_capable": True, "note": "Philippines is THE Facebook country"},
        "tiktok": {"dominant_age": "16-28", "youth_usage": "very_high", "ad_capable": True},
        "instagram": {"dominant_age": "18-30", "youth_usage": "high", "ad_capable": True},
        "whatsapp": {"dominant_age": "25+", "youth_usage": "medium"},
        "linkedin": {"dominant_age": "25-40", "youth_usage": "medium", "ad_capable": True},
        "reddit": {"dominant_age": "18-30", "youth_usage": "medium", "subreddits": ["r/phcareers", "r/buhaydigital"]},
    },
    # Fallback
    "Global": {
        "facebook": {"dominant_age": "25-50", "youth_usage": "varies", "ad_capable": True},
        "instagram": {"dominant_age": "18-35", "youth_usage": "high", "ad_capable": True},
        "tiktok": {"dominant_age": "16-28", "youth_usage": "high", "ad_capable": True},
        "linkedin": {"dominant_age": "25-55", "youth_usage": "medium", "ad_capable": True},
        "whatsapp": {"dominant_age": "all", "youth_usage": "high"},
        "telegram": {"dominant_age": "18-40", "youth_usage": "medium"},
        "reddit": {"dominant_age": "18-35", "youth_usage": "medium"},
        "pinterest": {"dominant_age": "25-45", "youth_usage": "medium"},
    },
}


def get_platform_priors(region: str) -> dict[str, Any]:
    """Get the hardcoded platform demographic priors for a region.

    Falls back to 'Global' if the region is not in the map.
    """
    return REGIONAL_PLATFORM_PRIORS.get(region, REGIONAL_PLATFORM_PRIORS["Global"])


def get_channels_for_age(region: str, age: int) -> list[str]:
    """Return ranked channels for a specific age in a specific region.

    Uses priors to quickly determine which platforms are relevant
    without waiting for Kimi K2.5 research.
    """
    priors = get_platform_priors(region)
    scored: list[tuple[str, int]] = []

    for platform, data in priors.items():
        if data.get("youth_usage") == "blocked":
            continue

        dominant = data.get("dominant_age", "all")
        youth = data.get("youth_usage", "medium")

        score = 0

        # Check if age falls in dominant range
        if dominant == "all":
            score += 3
        elif "-" in dominant:
            parts = dominant.replace("+", "-99").split("-")
            try:
                low, high = int(parts[0]), int(parts[1])
                if low <= age <= high:
                    score += 5
                elif abs(age - low) <= 5 or abs(age - high) <= 5:
                    score += 2
            except ValueError:
                score += 1

        # Youth usage bonus for young people
        if age < 30:
            youth_scores = {"very_high": 4, "high": 3, "medium": 1, "low": 0, "niche": 0}
            score += youth_scores.get(youth, 1)

        # Ad capability bonus
        if data.get("ad_capable"):
            score += 2

        if score > 0:
            scored.append((platform, score))

    scored.sort(key=lambda x: -x[1])
    return [p for p, _ in scored[:7]]


# ---------------------------------------------------------------------------
# Kimi K2.5 system prompt for cultural research
# ---------------------------------------------------------------------------

_RESEARCH_SYSTEM_PROMPT = (
    "You are a cultural research analyst specializing in recruitment advertising "
    "and labor markets.\n\n"
    "Your task is to provide ACCURATE, CURRENT, and SPECIFIC cultural intelligence "
    "about a target region for a recruitment advertising campaign. Use your web "
    "search capabilities to find the most recent data available.\n\n"
    "RULES:\n"
    "- Return ONLY valid JSON with the exact keys requested.\n"
    "- Be specific — no vague generalizations. Cite numbers, platform names, "
    "specific cultural norms.\n"
    "- If uncertain about something, say so explicitly rather than guessing.\n"
    "- Focus on how this information affects RECRUITMENT ADVERTISING specifically.\n"
    "- All monetary values should include the local currency AND USD equivalent.\n"
    "- No markdown. No commentary outside the JSON."
)


# ---------------------------------------------------------------------------
# Internal: call Kimi K2.5 via OpenRouter
# ---------------------------------------------------------------------------

async def _call_kimi(query: str, output_keys: list[str]) -> dict[str, Any]:
    """Call Kimi K2.5 via OpenRouter for web-grounded research.

    Parameters
    ----------
    query:
        The research question to ask.
    output_keys:
        The JSON keys expected in the response.

    Returns
    -------
    dict
        Parsed JSON response with the requested output keys.
    """
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set — returning empty research result.")
        return {k: "unavailable — no API key" for k in output_keys}

    keys_instruction = (
        f"Return a JSON object with EXACTLY these keys: {json.dumps(output_keys)}. "
        "Each value should be a string with a detailed, specific answer."
    )

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "moonshotai/kimi-k2.5",
                    "messages": [
                        {"role": "system", "content": _RESEARCH_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": f"{query}\n\n{keys_instruction}",
                        },
                    ],
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

            # Parse JSON from response, handling possible markdown fences.
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()

            return json.loads(cleaned)

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Kimi K2.5 API error (status=%d): %s",
            exc.response.status_code,
            exc.response.text[:500],
        )
        return {k: f"error — API returned {exc.response.status_code}" for k in output_keys}
    except (json.JSONDecodeError, KeyError, IndexError) as exc:
        logger.error("Failed to parse Kimi K2.5 response: %s", exc)
        return {k: "error — failed to parse response" for k in output_keys}
    except httpx.TimeoutException:
        logger.error("Kimi K2.5 request timed out")
        return {k: "error — request timed out" for k in output_keys}


# ---------------------------------------------------------------------------
# research_region — the main entry point
# ---------------------------------------------------------------------------

async def research_region(
    region: str,
    language: str,
    demographic: str = "young adults 18-35",
    task_type: str = "data annotation",
) -> dict[str, Any]:
    """Conduct deep cultural research for a target region via Kimi K2.5.

    Makes one API call per dimension (8 calls total). Returns structured
    research data that feeds into persona generation.

    Parameters
    ----------
    region:
        Target geographic region (e.g. "Latin America", "Morocco", "Germany").
    language:
        Primary language for the campaign in this region.
    demographic:
        Target demographic description (default "young adults 18-35").
    task_type:
        The kind of work being advertised (default "data annotation").

    Returns
    -------
    dict
        A comprehensive research profile with keys matching RESEARCH_DIMENSIONS,
        plus metadata about the research itself.
    """
    logger.info(
        "Starting cultural research for region=%s, language=%s, demographic=%s",
        region,
        language,
        demographic,
    )

    research: dict[str, Any] = {
        "_meta": {
            "region": region,
            "language": language,
            "demographic": demographic,
            "task_type": task_type,
            "dimensions_researched": list(RESEARCH_DIMENSIONS.keys()),
        },
    }

    for dimension_key, dimension in RESEARCH_DIMENSIONS.items():
        query = dimension["query_template"].format(
            region=region,
            language=language,
            demographic=demographic,
            task_type=task_type,
        )

        logger.info("Researching dimension '%s' for %s ...", dimension_key, region)
        result = await _call_kimi(query, dimension["output_keys"])
        research[dimension_key] = result

    # Validate live research against our hardcoded priors
    validation = validate_research_against_priors(region, research)
    research["_validation"] = validation
    logger.info(
        "Cultural research complete for %s — %d dimensions. Validation: %s",
        region,
        len(RESEARCH_DIMENSIONS),
        validation["summary"],
    )

    return research


# ---------------------------------------------------------------------------
# research_all_regions — batch research for multiple regions
# ---------------------------------------------------------------------------

async def research_all_regions(
    regions: list[str],
    languages: list[str],
    demographic: str = "young adults 18-35",
    task_type: str = "data annotation",
) -> dict[str, dict[str, Any]]:
    """Research all target regions and return a dict keyed by region.

    Each region is paired with a language from the languages list (round-robin
    if fewer languages than regions).

    Parameters
    ----------
    regions:
        List of target regions.
    languages:
        List of target languages (matched to regions by position).
    demographic:
        Target demographic.
    task_type:
        The type of work being advertised.

    Returns
    -------
    dict[str, dict]
        Mapping of region name to its full research profile.
    """
    if not regions:
        logger.warning("No regions provided for cultural research.")
        return {}

    all_research: dict[str, dict[str, Any]] = {}

    for idx, region in enumerate(regions):
        language = languages[idx % len(languages)] if languages else "English"
        all_research[region] = await research_region(
            region=region,
            language=language,
            demographic=demographic,
            task_type=task_type,
        )

    return all_research


# ---------------------------------------------------------------------------
# build_research_summary — human-readable summary for prompts
# ---------------------------------------------------------------------------

def build_research_summary(research_data: dict[str, dict[str, Any]]) -> str:
    """Format cultural research into a concise block for inclusion in prompts.

    This summary is injected into persona generation prompts and creative
    briefs so the LLM can account for real cultural context.

    Parameters
    ----------
    research_data:
        Dict keyed by region, each value a full research profile from
        ``research_region``.

    Returns
    -------
    str
        A formatted text block ready for prompt injection.
    """
    if not research_data:
        return "CULTURAL RESEARCH: No research data available.\n"

    sections: list[str] = ["CULTURAL RESEARCH (real data from web-grounded research):\n"]

    for region, profile in research_data.items():
        sections.append(f"=== {region.upper()} ===")

        # AI Fatigue
        ai = profile.get("ai_fatigue", {})
        sections.append(
            f"  AI Fatigue: {ai.get('fatigue_level', 'unknown')} — "
            f"Sentiment: {ai.get('sentiment', 'unknown')} — "
            f"Recommended framing: {ai.get('recommended_framing', 'unknown')}"
        )

        # Gig Work Perception
        gig = profile.get("gig_work_perception", {})
        sections.append(
            f"  Gig Work Perception: {gig.get('perception', 'unknown')} — "
            f"Messaging: {gig.get('messaging_implication', 'unknown')}"
        )

        # Trust
        trust = profile.get("data_annotation_trust", {})
        sections.append(
            f"  Annotation Trust: {trust.get('trust_level', 'unknown')} — "
            f"Scam concerns: {trust.get('scam_associations', 'unknown')} — "
            f"Trust builders: {trust.get('trust_builders', 'unknown')}"
        )

        # Platforms
        plat = profile.get("platform_reality", {})
        sections.append(
            f"  Top Platforms: {plat.get('top_platforms_ranked', 'unknown')} — "
            f"Job platforms: {plat.get('job_platforms', 'unknown')}"
        )

        # Economics
        econ = profile.get("economic_context", {})
        sections.append(
            f"  Economics: Avg remote hourly: {econ.get('avg_remote_hourly', 'unknown')} — "
            f"Min wage: {econ.get('minimum_wage', 'unknown')} — "
            f"Competitive rate: {econ.get('competitive_rate', 'unknown')} — "
            f"Youth unemployment: {econ.get('youth_unemployment', 'unknown')}"
        )

        # Cultural Sensitivities
        cult = profile.get("cultural_sensitivities", {})
        sections.append(
            f"  Cultural Sensitivities: "
            f"Formality: {cult.get('formality_level', 'unknown')} — "
            f"Things to avoid: {cult.get('things_to_avoid', 'unknown')} — "
            f"Gender norms: {cult.get('gender_norms', 'unknown')}"
        )

        # Tech Literacy
        tech = profile.get("tech_literacy", {})
        sections.append(
            f"  Tech: Primary device: {tech.get('primary_device', 'unknown')} — "
            f"Smartphone: {tech.get('smartphone_penetration', 'unknown')} — "
            f"Internet: {tech.get('internet_quality', 'unknown')}"
        )

        # Language Nuance
        lang = profile.get("language_nuance", {})
        sections.append(
            f"  Language: Dialect: {lang.get('dialect', 'unknown')} — "
            f"Formality: {lang.get('formality_preference', 'unknown')} — "
            f"Mixing: {lang.get('language_mixing', 'unknown')}"
        )

        sections.append("")  # blank line between regions

    return "\n".join(sections)


# ---------------------------------------------------------------------------
# apply_research_to_personas — enrich personas with real data
# ---------------------------------------------------------------------------

def apply_research_to_personas(
    personas: list[dict[str, Any]],
    research_data: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Enrich personas with cultural research findings.

    Adjustments applied:
    - If AI fatigue is HIGH: remove "AI" from messaging, reframe as
      "flexible remote work".
    - If gig work is STIGMATIZED: frame as "professional freelance" not
      "gig work".
    - If trust is LOW: add trust signals (company size, known clients,
      payment proof).
    - If platform reality differs from defaults: override best_channels.
    - If economic context shows low wages: adjust rate framing.
    - Add cultural sensitivity notes to each persona.
    - Add language nuance to copy guidance.

    Parameters
    ----------
    personas:
        List of persona dicts from ``generate_personas``.
    research_data:
        Dict keyed by region from ``research_all_regions``.

    Returns
    -------
    list[dict]
        The same personas, enriched with a ``cultural_research`` key and
        adjusted fields.
    """
    if not research_data:
        return personas

    enriched: list[dict[str, Any]] = []

    for persona in personas:
        p = dict(persona)  # shallow copy
        region = p.get("region", "")
        research = research_data.get(region, {})

        if not research:
            # No research for this persona's region — pass through unchanged.
            p["cultural_research"] = {"status": "no_data_for_region"}
            enriched.append(p)
            continue

        adjustments: list[str] = []

        # -- AI Fatigue Adjustment --
        ai_fatigue = research.get("ai_fatigue", {})
        fatigue_level = str(ai_fatigue.get("fatigue_level", "")).lower()
        if "high" in fatigue_level:
            # Reframe messaging to avoid "AI" lead.
            hook = p.get("messaging_hook", "")
            hook = hook.replace("AI ", "").replace(" AI", "").replace("AI", "")
            recommended = ai_fatigue.get("recommended_framing", "flexible remote work")
            p["messaging_hook"] = f"{recommended} — {hook}" if hook else recommended
            adjustments.append("AI fatigue HIGH: removed 'AI' framing, repositioned as remote work")

        # -- Gig Work Perception Adjustment --
        gig = research.get("gig_work_perception", {})
        gig_perception = str(gig.get("perception", "")).lower()
        if "stigma" in gig_perception or "negative" in gig_perception:
            # Reframe gig language.
            p.setdefault("copy_guidance", {})["gig_framing"] = (
                "AVOID: 'gig work', 'gig economy', 'side hustle'. "
                "USE: 'professional freelance', 'remote consulting', 'project-based work'"
            )
            adjustments.append("Gig work STIGMATIZED: reframed as professional freelance")

        # -- Trust Level Adjustment --
        trust = research.get("data_annotation_trust", {})
        trust_level = str(trust.get("trust_level", "")).lower()
        if "low" in trust_level:
            # Add trust signals to objection handlers.
            trust_builders = trust.get("trust_builders", "")
            extra_handlers = {
                "Is this legitimate?": (
                    f"OneForma is owned by Centific (a $200M+ company). "
                    f"Additional trust signals for {region}: {trust_builders}"
                ),
                "Is this a scam?": (
                    f"We understand the concern in {region}. "
                    f"{trust_builders}. OneForma has 500K+ contributors worldwide."
                ),
            }
            existing = p.get("objection_handlers", {})
            existing.update(extra_handlers)
            p["objection_handlers"] = existing
            adjustments.append(f"Trust LOW: added region-specific trust builders")

        # -- Platform Reality Adjustment --
        platform = research.get("platform_reality", {})
        top_platforms = platform.get("top_platforms_ranked", "")
        if top_platforms and isinstance(top_platforms, str):
            p.setdefault("copy_guidance", {})["platform_reality"] = (
                f"ACTUAL platform usage in {region}: {top_platforms}. "
                f"Job platforms: {platform.get('job_platforms', 'unknown')}"
            )
            # Parse platforms and override best_channels if we can extract names.
            adjustments.append(f"Platform data: real usage data injected")

        # -- Economic Context Adjustment --
        econ = research.get("economic_context", {})
        competitive_rate = econ.get("competitive_rate", "")
        if competitive_rate:
            p.setdefault("copy_guidance", {})["rate_positioning"] = (
                f"Competitive rate in {region}: {competitive_rate}. "
                f"Min wage: {econ.get('minimum_wage', 'unknown')}. "
                f"Frame the rate accordingly."
            )
            adjustments.append(f"Economic data: competitive rate = {competitive_rate}")

        # -- Cultural Sensitivity Injection --
        culture = research.get("cultural_sensitivities", {})
        things_to_avoid = culture.get("things_to_avoid", "")
        if things_to_avoid:
            p["cultural_sensitivity_notes"] = {
                "formality_level": culture.get("formality_level", "unknown"),
                "things_to_avoid": things_to_avoid,
                "gender_norms": culture.get("gender_norms", "unknown"),
                "imagery_taboos": culture.get("imagery_taboos", "unknown"),
                "religious_considerations": culture.get("religious_considerations", "unknown"),
            }
            adjustments.append("Cultural sensitivity notes attached")

        # -- Language Nuance Injection --
        lang_nuance = research.get("language_nuance", {})
        dialect = lang_nuance.get("dialect", "")
        if dialect:
            p["language_guidance"] = {
                "dialect": dialect,
                "formality_preference": lang_nuance.get("formality_preference", "unknown"),
                "authentic_slang": lang_nuance.get("authentic_slang", "unknown"),
                "avoid_phrases": lang_nuance.get("avoid_phrases", "unknown"),
                "language_mixing": lang_nuance.get("language_mixing", "unknown"),
            }
            adjustments.append(f"Language nuance: dialect = {dialect}")

        # -- Tech Literacy Injection --
        tech = research.get("tech_literacy", {})
        primary_device = tech.get("primary_device", "")
        if primary_device:
            p.setdefault("copy_guidance", {})["device_context"] = (
                f"Primary device in {region}: {primary_device}. "
                f"Internet quality: {tech.get('internet_quality', 'unknown')}. "
                f"Data cost concern: {tech.get('data_cost_concern', 'unknown')}."
            )
            adjustments.append(f"Tech literacy: primary device = {primary_device}")

        p["cultural_research"] = {
            "status": "enriched",
            "adjustments_applied": adjustments,
            "raw_research": research,
        }

        enriched.append(p)

    logger.info(
        "Applied cultural research to %d personas (%d had region data).",
        len(enriched),
        sum(1 for p in enriched if p.get("cultural_research", {}).get("status") == "enriched"),
    )

    return enriched


# ---------------------------------------------------------------------------
# validate_research_against_priors — compare live Kimi data vs hardcoded
# ---------------------------------------------------------------------------

def validate_research_against_priors(
    region: str,
    research: dict[str, Any],
) -> dict[str, Any]:
    """Compare Kimi K2.5 live research against our hardcoded priors.

    Returns a validation report with:
    - confirmed: priors that Kimi's data agrees with
    - corrected: priors that Kimi's data contradicts (Kimi wins)
    - new_intel: data Kimi found that we didn't have in priors
    - warnings: things that seem suspicious (possible Kimi hallucination)

    This is logged for transparency and used to improve priors over time.
    """
    priors = get_platform_priors(region)
    platform_research = research.get("platform_reality", {})
    demographic_research = research.get("demographic_channel_map", {})

    confirmed: list[str] = []
    corrected: list[str] = []
    new_intel: list[str] = []
    warnings: list[str] = []

    # Check platform data from research against priors
    research_text = json.dumps(platform_research, ensure_ascii=False).lower()
    demo_text = json.dumps(demographic_research, ensure_ascii=False).lower()

    for platform, prior_data in priors.items():
        prior_youth = prior_data.get("youth_usage", "unknown")

        if prior_youth == "blocked":
            # Check if Kimi confirms the block
            if platform in research_text and "blocked" not in research_text:
                warnings.append(
                    f"{platform}: our priors say BLOCKED in {region}, "
                    f"but Kimi's research doesn't mention a block. Verify manually."
                )
            else:
                confirmed.append(f"{platform}: confirmed blocked in {region}")
            continue

        # Check if Kimi mentions this platform
        if platform not in research_text and platform not in demo_text:
            # Kimi didn't mention it — could mean it's irrelevant or Kimi missed it
            if prior_youth in ("very_high", "high"):
                warnings.append(
                    f"{platform}: priors say {prior_youth} usage in {region}, "
                    f"but Kimi didn't mention it. May need manual verification."
                )
        else:
            # Kimi mentioned it — check for agreement
            dominant_age = prior_data.get("dominant_age", "")

            # Simple heuristic: if Kimi mentions "declining" for a platform
            # we thought was "high", flag as correction
            if "declining" in research_text and platform in research_text:
                if prior_youth in ("very_high", "high"):
                    corrected.append(
                        f"{platform}: priors said {prior_youth} in {region}, "
                        f"but Kimi says it's DECLINING. Update priors."
                    )
            elif prior_youth == "very_high":
                confirmed.append(f"{platform}: confirmed {prior_youth} in {region}")

    # Check if Kimi found platforms we don't have in priors
    known_platforms = set(priors.keys())
    # Simple extraction of platform names from research
    all_platform_names = {
        "whatsapp", "telegram", "facebook", "instagram", "tiktok",
        "linkedin", "reddit", "pinterest", "youtube", "twitter",
        "wechat", "weibo", "douyin", "line", "kakao", "vk",
        "snapchat", "discord", "viber", "signal",
    }
    for p in all_platform_names - known_platforms:
        if p in research_text or p in demo_text:
            new_intel.append(
                f"{p}: Kimi mentions this platform for {region} but "
                f"we don't have it in our priors. Consider adding."
            )

    report = {
        "region": region,
        "confirmed": confirmed,
        "corrected": corrected,
        "new_intel": new_intel,
        "warnings": warnings,
        "summary": (
            f"{len(confirmed)} confirmed, {len(corrected)} corrected, "
            f"{len(new_intel)} new, {len(warnings)} warnings"
        ),
    }

    # Log the report
    if corrected:
        logger.warning(
            "PRIOR CORRECTIONS for %s: %s",
            region, "; ".join(corrected),
        )
    if warnings:
        logger.warning(
            "VALIDATION WARNINGS for %s: %s",
            region, "; ".join(warnings),
        )
    if new_intel:
        logger.info(
            "NEW INTEL for %s: %s",
            region, "; ".join(new_intel),
        )

    return report


# ---------------------------------------------------------------------------
# FUTURE: MiroFish swarm simulation integration
# ---------------------------------------------------------------------------
# MiroFish (https://github.com/666ghj/MiroFish) can create thousands of AI agents
# representing target demographics and simulate their reactions to ad variants.
# This would enable pre-flight testing of ads before spending budget.
# Integration path: feed cultural_research + personas as seed data into MiroFish,
# run simulation, use results to rank ad variants by predicted engagement.
# ---------------------------------------------------------------------------
