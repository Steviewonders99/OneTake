"""Campaign Strategy — budget cascade, ad set optimization, platform translation.

Takes personas (with targeting_profiles) + cultural research + budget and produces
a full Tier 1 media plan per country with ad sets, budget allocation, split tests,
and kill/scale rules.

Budget cascade: RFP → countries → personas → ad sets
Rules:
- $10/day minimum per ad set (auto-reduce if below)
- $1,800/mo minimum per country (auto-cut if below)
- No budget = ratio mode (percentages only)
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

MIN_DAILY_PER_AD_SET = 10
MIN_MONTHLY_PER_COUNTRY = 1800
KILL_THRESHOLD_MULTIPLIER = 1.5
MAX_AD_SETS_PER_PERSONA = 5
MIN_AD_SETS_PER_PERSONA = 2


def calculate_budget_cascade(
    *,
    total_monthly: float | None,
    countries: list[dict],
    personas: list[dict],
) -> dict[str, Any]:
    """Calculate the full budget cascade from RFP to ad sets.

    Parameters
    ----------
    total_monthly : float | None
        Monthly budget from RFP. None = ratio mode.
    countries : list[dict]
        Each dict has: country, market_opportunity_score (0-1).
    personas : list[dict]
        Each dict has: archetype_key, targeting_profile.budget_weight_pct.

    Returns
    -------
    dict with budget_mode, country_allocations, persona_allocations, flags, deferred_markets
    """
    if not total_monthly or total_monthly <= 0:
        return _calculate_ratio_mode(countries, personas)
    return _calculate_fixed_mode(total_monthly, countries, personas)


def _calculate_fixed_mode(
    total_monthly: float,
    countries: list[dict],
    personas: list[dict],
) -> dict:
    result = {
        "budget_mode": "fixed",
        "total_monthly": total_monthly,
        "country_allocations": {},
        "deferred_markets": [],
        "flags": [],
    }

    ranked = sorted(countries, key=lambda c: c.get("market_opportunity_score", 0.5), reverse=True)
    total_score = sum(c.get("market_opportunity_score", 0.5) for c in ranked)
    if total_score == 0:
        total_score = 1

    active_countries = []
    for country_data in ranked:
        country = country_data["country"]
        weight = country_data.get("market_opportunity_score", 0.5) / total_score
        allocation = total_monthly * weight

        if allocation < MIN_MONTHLY_PER_COUNTRY:
            result["deferred_markets"].append({
                "country": country,
                "would_need": MIN_MONTHLY_PER_COUNTRY,
                "allocated": round(allocation, 2),
                "reactivation_budget": round(MIN_MONTHLY_PER_COUNTRY * len(ranked) / max(weight, 0.01), 2),
                "reason": f"${allocation:.0f}/mo below ${MIN_MONTHLY_PER_COUNTRY} minimum",
            })
            result["flags"].append(f"Deferred {country}: ${allocation:.0f}/mo insufficient (need ${MIN_MONTHLY_PER_COUNTRY})")
        else:
            active_countries.append({"country": country, "weight": weight, "monthly": allocation})

    if not active_countries and ranked:
        max_countries = max(1, int(total_monthly / MIN_MONTHLY_PER_COUNTRY))
        active_countries = [
            {"country": c["country"], "weight": 1.0 / max_countries, "monthly": total_monthly / max_countries}
            for c in ranked[:max_countries]
        ]
        result["deferred_markets"] = [d for d in result["deferred_markets"] if d["country"] not in {a["country"] for a in active_countries}]
        result["flags"].append(f"Auto-consolidated to {max_countries} countries (budget too thin for all {len(ranked)})")

    active_total_weight = sum(c["weight"] for c in active_countries)
    if active_total_weight == 0:
        active_total_weight = 1
    for c in active_countries:
        c["monthly"] = total_monthly * (c["weight"] / active_total_weight)
        c["daily"] = round(c["monthly"] / 30, 2)
        c["persona_allocations"] = _allocate_personas(c["monthly"], personas)
        result["country_allocations"][c["country"]] = c

    return result


def _allocate_personas(country_monthly: float, personas: list[dict]) -> dict[str, dict]:
    allocations = {}
    for persona in personas:
        key = persona.get("archetype_key", "unknown")
        tp = persona.get("targeting_profile", {})
        weight_pct = tp.get("budget_weight_pct", 100 // max(len(personas), 1))
        persona_monthly = country_monthly * (weight_pct / 100)
        persona_daily = persona_monthly / 30

        ideal_ad_sets = MAX_AD_SETS_PER_PERSONA
        per_ad_set_daily = persona_daily / ideal_ad_sets
        flags = []

        if per_ad_set_daily < MIN_DAILY_PER_AD_SET:
            for n in range(ideal_ad_sets, MIN_AD_SETS_PER_PERSONA - 1, -1):
                if persona_daily / n >= MIN_DAILY_PER_AD_SET:
                    ideal_ad_sets = n
                    per_ad_set_daily = persona_daily / n
                    break
            else:
                ideal_ad_sets = MIN_AD_SETS_PER_PERSONA
                per_ad_set_daily = persona_daily / MIN_AD_SETS_PER_PERSONA
                if per_ad_set_daily < MIN_DAILY_PER_AD_SET:
                    flags.append(f"Underfunded: ${per_ad_set_daily:.2f}/day per ad set (need ${MIN_DAILY_PER_AD_SET}). Recommend increasing budget or excluding persona.")

        kill_threshold = round(per_ad_set_daily * KILL_THRESHOLD_MULTIPLIER, 2)
        allocations[key] = {
            "weight_pct": weight_pct,
            "monthly": round(persona_monthly, 2),
            "daily": round(persona_daily, 2),
            "ad_set_count": ideal_ad_sets,
            "per_ad_set_daily": round(per_ad_set_daily, 2),
            "kill_threshold": kill_threshold,
            "flags": flags,
        }
    return allocations


def _calculate_ratio_mode(countries: list[dict], personas: list[dict]) -> dict:
    ranked = sorted(countries, key=lambda c: c.get("market_opportunity_score", 0.5), reverse=True)
    total_score = sum(c.get("market_opportunity_score", 0.5) for c in ranked)
    if total_score == 0:
        total_score = 1

    country_ratios = {}
    for c in ranked:
        weight = c.get("market_opportunity_score", 0.5) / total_score
        country_ratios[c["country"]] = {
            "weight_pct": round(weight * 100, 1),
            "persona_ratios": {
                p.get("archetype_key", "unknown"): p.get("targeting_profile", {}).get("budget_weight_pct", 33)
                for p in personas
            },
            "recommended_ad_sets": "3-5 depending on budget",
        }

    return {
        "budget_mode": "ratio",
        "total_monthly": None,
        "country_allocations": country_ratios,
        "deferred_markets": [],
        "flags": ["No budget specified — output is ratios only. Plug in your monthly budget and multiply."],
    }


PLATFORM_TARGETING_MAP = {
    "meta": {"label": "Meta (Facebook/Instagram)", "hyper": "Interest targeting", "hot": "Stacked interests", "broad": "Broad demographics", "lla": "Lookalike audiences", "retargeting": "Pixel visitors"},
    "tiktok": {"label": "TikTok", "hyper": "Interest targeting", "hot": "Behavior + interest combo", "broad": "Broad age/geo", "lla": "Custom audience lookalike", "retargeting": "Pixel/engagement retarget"},
    "linkedin": {"label": "LinkedIn", "hyper": "Job title + skill targeting", "hot": "Industry + seniority", "broad": "Company size + function", "lla": "Matched audience lookalike", "retargeting": "Website/engagement retarget"},
    "youtube": {"label": "YouTube", "hyper": "In-market + affinity audiences", "hot": "Custom intent audiences", "broad": "Demographics", "lla": "Similar audiences", "retargeting": "Remarketing lists"},
    "x": {"label": "X (Twitter)", "hyper": "Keyword + follower lookalike", "hot": "Conversation topics", "broad": "Interest categories", "lla": "Tailored audience lookalike", "retargeting": "Website tag retarget"},
    "snapchat": {"label": "Snapchat", "hyper": "Snap Lifestyle Categories", "hot": "Stacked interests", "broad": "Demographics + geo", "lla": "Snap Audience Match lookalike", "retargeting": "Pixel/engagement retarget"},
    "pinterest": {"label": "Pinterest", "hyper": "Interest + keyword targeting", "hot": "Actalike targeting", "broad": "Broad interests", "lla": "Actalike audiences", "retargeting": "Engagement retarget"},
    "wechat": {"label": "WeChat", "hyper": "Interest + behavior tags", "hot": "Stacked tags", "broad": "Demographics", "lla": "Mini Program lookalike", "retargeting": "Official Account followers"},
}


def translate_targeting_for_platform(targeting_profile: dict, platform: str) -> dict[str, Any]:
    """Translate universal targeting profile to platform-specific parameters."""
    platform_family = "meta"
    if "tiktok" in platform: platform_family = "tiktok"
    elif "linkedin" in platform: platform_family = "linkedin"
    elif "youtube" in platform: platform_family = "youtube"
    elif "twitter" in platform or platform == "x": platform_family = "x"
    elif "snap" in platform: platform_family = "snapchat"
    elif "pinterest" in platform: platform_family = "pinterest"
    elif "wechat" in platform: platform_family = "wechat"

    pmap = PLATFORM_TARGETING_MAP.get(platform_family, PLATFORM_TARGETING_MAP["meta"])
    interests = targeting_profile.get("interests", {})
    demographics = targeting_profile.get("demographics", {})

    return {
        "platform": platform,
        "platform_family": platform_family,
        "platform_label": pmap["label"],
        "targeting_method": {
            "hyper": {"method": pmap["hyper"], "values": interests.get("hyper", [])},
            "hot": {"method": pmap["hot"], "values": interests.get("hot", [])},
            "broad": {"method": pmap["broad"], "values": interests.get("broad", [])},
        },
        "demographics": {
            "age_min": demographics.get("age_min", 18),
            "age_max": demographics.get("age_max", 65),
            "gender": demographics.get("gender", "all"),
        },
        "tier_2_method": pmap["lla"],
        "retargeting_method": pmap["retargeting"],
    }


# ── Strategy Generation (LLM) ─────────────────────────────────────

STRATEGY_SYSTEM_PROMPT = """You are an elite media buyer designing a Tier 1 campaign for OneForma recruitment.

You receive: personas (with targeting profiles), cultural research, channel strategy, and budget data.
You output: a complete Tier 1 media plan with campaigns, ad sets, targeting, budget, split test, and rules.

FRAMEWORK (from proven MBA Lead Gen Strategy):
- Tier 1 = Interest-only cold traffic. NO lookalikes. NO retargeting.
- 2 campaigns (A/B split test) — test ONE variable (creative treatment OR copy angle)
- Per campaign: 2-5 ad sets depending on budget
  - Ad Sets 1-3: Hyper-targeted (1 specific interest each)
  - Ad Set 4: Hot interests (2-3 stacked)
  - Ad Set 5: Broad interests (3-5 wider interests)
- Budget split evenly across ad sets within a persona
- Kill threshold: 1.5x daily ad set budget with no leads → pause
- Scale rule: CPA below target after 10 leads → increase 20% every 3 days
- Progression: after 250 tracked leads → add Tier 2 (1% Lead LLA + retargeting)

RULES:
1. Every interest must be SPECIFIC to the task type and region — never generic
2. Demographics must match the persona exactly (age, education, occupation)
3. Placements must match the channel strategy (only platforms in the brief)
4. Kill threshold is ALWAYS 1.5x daily ad set budget — calculate it
5. Split test must change EXACTLY one variable between Campaign A and B
6. Ad set names must be descriptive: "[Targeting Type] — [Interest Description]"
7. creative_assignment_rule maps persona + hook_type + treatment to each ad set

Return ONLY valid JSON matching the campaign_strategy schema.
"""

STRATEGY_USER_PROMPT = """Design a Tier 1 campaign for: {country}

BUDGET DATA:
{budget_json}

PERSONAS (with targeting):
{personas_json}

CHANNEL STRATEGY (only use these platforms):
{channels_json}

CULTURAL RESEARCH SUMMARY:
{research_summary}

TASK TYPE: {task_type}
TASK DESCRIPTION: {task_description}

{budget_instruction}

Return a JSON object with this structure:
{{
  "tier": 1,
  "tier_description": "Interest-only cold traffic",
  "monthly_budget": number or null,
  "budget_mode": "fixed" or "ratio",
  "daily_budget_total": number or null,
  "split_test": {{
    "variable": "creative" or "copy",
    "description": "What differs between Campaign A and B",
    "measurement": "How to measure the winner"
  }},
  "campaigns": [
    {{
      "name": "Campaign name",
      "objective": "lead_generation",
      "optimization": "leads",
      "daily_budget": number or null,
      "ad_sets": [
        {{
          "name": "Descriptive ad set name",
          "persona_key": "archetype_key",
          "targeting_type": "hyper" | "hot" | "broad",
          "interests": ["specific", "interests"],
          "demographics": {{"age_min": int, "age_max": int, "gender": "all"}},
          "placements": ["platform_keys"],
          "daily_budget": number or null,
          "kill_threshold": number or null,
          "kill_rule": "Specific kill rule with number",
          "scale_rule": "Specific scale rule with numbers",
          "creative_assignment_rule": {{
            "persona": "key",
            "hook_types": ["earnings", "curiosity"],
            "treatment": "gradient_overlay" | "split_panel" | "shape_overlay"
          }},
          "creatives_assigned": []
        }}
      ]
    }}
  ],
  "progression_rules": {{
    "next_tier": 2,
    "trigger": "250 tracked leads across all ad sets",
    "adds": ["what Tier 2 adds"],
    "estimated_timeline": "X weeks at current budget"
  }},
  "scaling_rules": {{
    "winning_ad_set": "specific rule",
    "losing_ad_set": "specific rule",
    "winning_creative": "specific rule"
  }},
  "deferred_markets": []
}}
"""


async def generate_campaign_strategy(
    *,
    country: str,
    personas: list[dict],
    cultural_research: dict,
    channel_strategy: list[str],
    budget_data: dict,
    task_type: str,
    task_description: str,
    feedback: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a Tier 1 campaign strategy for one country via LLM."""
    from ai.local_llm import generate_text

    budget_instruction = ""
    if budget_data.get("budget_mode") == "ratio":
        budget_instruction = (
            "No dollar budget specified. Output RATIOS ONLY — percentage allocations, "
            "no dollar amounts. Ad set daily_budget and kill_threshold should be null. "
            "Include recommended_ad_sets as '3-5 depending on budget'."
        )
    else:
        budget_instruction = (
            f"Budget is FIXED at ${budget_data.get('total_monthly', 0):.0f}/mo total. "
            f"This country gets ${budget_data.get('country_monthly', 0):.0f}/mo. "
            f"Calculate exact daily budgets and kill thresholds."
        )

    personas_trimmed = []
    for p in personas:
        tp = p.get("targeting_profile", {})
        personas_trimmed.append({
            "archetype_key": p.get("archetype_key"),
            "age_range": p.get("age_range"),
            "occupation": tp.get("demographics", {}).get("occupation", "unknown"),
            "interests": tp.get("interests", {}),
            "budget_weight_pct": tp.get("budget_weight_pct", 33),
            "estimated_pool_size": tp.get("estimated_pool_size", "medium"),
            "media_consumption": tp.get("psychographics", {}).get("media_consumption", []),
        })

    user_prompt = STRATEGY_USER_PROMPT.format(
        country=country,
        budget_json=json.dumps(budget_data, indent=2, default=str),
        personas_json=json.dumps(personas_trimmed, indent=2, default=str),
        channels_json=json.dumps(channel_strategy, default=str),
        research_summary=json.dumps(cultural_research, default=str)[:2000],
        task_type=task_type,
        task_description=task_description[:500],
        budget_instruction=budget_instruction,
    )

    if feedback:
        user_prompt += (
            "\n\n⚠️ PREVIOUS STRATEGY FAILED EVALUATION. Fix these issues:\n"
            + "\n".join(f"- {f}" for f in feedback)
        )

    # Inject campaign-strategy marketing skill
    from prompts.marketing_skills import get_skills_for_stage
    skills = get_skills_for_stage("strategy")
    system = STRATEGY_SYSTEM_PROMPT
    if skills:
        system = f"{system}\n\n{skills}"
        logger.info("Injected strategy marketing skills (%d chars)", len(skills))

    raw = await generate_text(
        system,
        user_prompt,
        max_tokens=8192,
        temperature=0.4,
    )

    return _parse_strategy_json(raw)


def _parse_strategy_json(text: str) -> dict:
    """Parse campaign strategy JSON from LLM output."""
    if not text:
        return {}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        result = json.loads(cleaned)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    brace_depth = 0
    start = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and start >= 0:
                try:
                    return json.loads(cleaned[start:i + 1])
                except json.JSONDecodeError:
                    pass
                start = -1

    logger.warning("Failed to parse campaign strategy JSON (%d chars)", len(text))
    return {}
