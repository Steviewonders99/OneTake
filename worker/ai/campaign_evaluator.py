"""Campaign Strategy Evaluator — 7-dimension quality gate.

Scores a generated campaign strategy against:
1. Targeting specificity (20%)
2. Persona-targeting alignment (15%)
3. Budget math validity (20%)
4. Platform-channel fit (15%)
5. Split test structure (10%)
6. Kill/scale rules present (10%)
7. Tier-appropriate structure (10%)

Pass threshold: 0.80. Feedback loop: up to 3 attempts.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

PASS_THRESHOLD = 0.80
MAX_RETRIES = 3

DIMENSION_WEIGHTS = {
    "targeting_specificity": 0.20,
    "persona_alignment": 0.15,
    "budget_math": 0.20,
    "platform_fit": 0.15,
    "split_test": 0.10,
    "kill_scale_rules": 0.10,
    "tier_structure": 0.10,
}

RATIO_MODE_WEIGHTS = {
    "targeting_specificity": 0.25,
    "persona_alignment": 0.19,
    "budget_math": 0.0,
    "platform_fit": 0.19,
    "split_test": 0.12,
    "kill_scale_rules": 0.12,
    "tier_structure": 0.13,
}


def evaluate_campaign_strategy(
    strategy: dict[str, Any],
    personas: list[dict],
    channel_strategy: list[str],
    budget_mode: str = "fixed",
) -> dict[str, Any]:
    """Evaluate a campaign strategy against 7 dimensions.

    Returns dict with: passed, overall_score, dimensions, issues.
    """
    weights = RATIO_MODE_WEIGHTS if budget_mode == "ratio" else DIMENSION_WEIGHTS
    dimensions = {}
    all_issues = []

    score, issues = _check_targeting_specificity(strategy, personas)
    dimensions["targeting_specificity"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    score, issues = _check_persona_alignment(strategy, personas)
    dimensions["persona_alignment"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    if budget_mode == "fixed":
        score, issues = _check_budget_math(strategy)
        dimensions["budget_math"] = {"score": score, "issues": issues}
        all_issues.extend(issues)
    else:
        dimensions["budget_math"] = {"score": 1.0, "issues": [], "skipped": True}

    score, issues = _check_platform_fit(strategy, personas, channel_strategy)
    dimensions["platform_fit"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    score, issues = _check_split_test(strategy)
    dimensions["split_test"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    score, issues = _check_kill_scale_rules(strategy)
    dimensions["kill_scale_rules"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    score, issues = _check_tier_structure(strategy)
    dimensions["tier_structure"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    overall = sum(dimensions[dim]["score"] * weights[dim] for dim in weights)
    passed = overall >= PASS_THRESHOLD

    logger.info("Campaign strategy eval: score=%.2f (%s) — %d issues", overall, "PASS" if passed else "FAIL", len(all_issues))

    return {
        "passed": passed,
        "overall_score": round(overall, 3),
        "dimensions": dimensions,
        "issues": all_issues,
    }


def _check_targeting_specificity(strategy: dict, personas: list) -> tuple[float, list[str]]:
    issues = []
    generic_terms = {"technology", "internet", "social media", "ai", "computer", "digital", "online", "mobile"}
    campaigns = strategy.get("campaigns", [])
    total_ad_sets = 0
    specific_count = 0

    for campaign in campaigns:
        for ad_set in campaign.get("ad_sets", []):
            total_ad_sets += 1
            interests = ad_set.get("interests", [])
            if not interests:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has no interests")
                continue
            generic_found = [i for i in interests if i.lower() in generic_terms]
            if generic_found:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has generic interests: {generic_found}")
            else:
                specific_count += 1
            if ad_set.get("targeting_type") == "hyper" and len(interests) > 2:
                issues.append(f"Hyper ad set '{ad_set.get('name', '?')}' has {len(interests)} interests (should be 1-2)")

    if total_ad_sets == 0:
        return 0.0, ["No ad sets found in strategy"]
    return round(specific_count / total_ad_sets, 2), issues


def _check_persona_alignment(strategy: dict, personas: list) -> tuple[float, list[str]]:
    issues = []
    persona_map = {p.get("archetype_key", ""): p for p in personas}
    checks_passed = 0
    checks_total = 0

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            persona_key = ad_set.get("persona_key", "")
            persona = persona_map.get(persona_key)
            if not persona:
                continue
            checks_total += 1
            demo = ad_set.get("demographics", {})
            tp = persona.get("targeting_profile", {}).get("demographics", {})
            if tp:
                age_match = (
                    demo.get("age_min", 18) >= tp.get("age_min", 18) - 2 and
                    demo.get("age_max", 65) <= tp.get("age_max", 65) + 2
                )
                if not age_match:
                    issues.append(f"Ad set '{ad_set.get('name', '?')}' age {demo.get('age_min')}-{demo.get('age_max')} doesn't match persona {persona_key} ({tp.get('age_min')}-{tp.get('age_max')})")
                else:
                    checks_passed += 1
            else:
                checks_passed += 1

    if checks_total == 0:
        return 0.5, ["No ad sets with persona_key found"]
    return round(checks_passed / checks_total, 2), issues


def _check_budget_math(strategy: dict) -> tuple[float, list[str]]:
    issues = []
    checks_passed = 0
    checks_total = 0

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            checks_total += 1
            daily = ad_set.get("daily_budget")
            kill = ad_set.get("kill_threshold")
            if daily is not None and daily < 10:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' budget ${daily}/day < $10 minimum")
            elif daily is not None:
                checks_passed += 1
            if daily is not None and kill is not None:
                expected_kill = round(daily * 1.5, 2)
                if abs(kill - expected_kill) > 1:
                    issues.append(f"Ad set '{ad_set.get('name', '?')}' kill threshold ${kill} doesn't match 1.5x daily (expected ~${expected_kill})")

    if checks_total == 0:
        return 0.5, ["No ad sets with budget data"]
    return round(checks_passed / max(checks_total, 1), 2), issues


def _check_platform_fit(strategy: dict, personas: list, channels: list) -> tuple[float, list[str]]:
    issues = []
    checks_passed = 0
    checks_total = 0
    channel_set = set(ch.lower() for ch in channels)

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            placements = ad_set.get("placements", [])
            checks_total += 1
            if not placements:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has no placements")
                continue
            invalid = [p for p in placements if p.lower() not in channel_set and not any(p.lower() in ch for ch in channel_set)]
            if invalid:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has placements not in channel strategy: {invalid}")
            else:
                checks_passed += 1

    if checks_total == 0:
        return 0.5, ["No ad sets with placements"]
    return round(checks_passed / checks_total, 2), issues


def _check_split_test(strategy: dict) -> tuple[float, list[str]]:
    issues = []
    split = strategy.get("split_test", {})
    if not split:
        return 0.0, ["No split test defined"]
    variable = split.get("variable", "")
    if not variable:
        issues.append("Split test has no variable specified")
        return 0.2, issues
    if variable not in ("creative", "copy", "audience", "placement"):
        issues.append(f"Split test variable '{variable}' is unusual — expected 'creative' or 'copy'")
    if not split.get("description"):
        issues.append("Split test has no description of what differs")
    if not split.get("measurement"):
        issues.append("Split test has no measurement criteria")
    campaigns = strategy.get("campaigns", [])
    if len(campaigns) < 2:
        issues.append("Need at least 2 campaigns for a split test")
        return 0.3, issues
    score = 1.0 - (len(issues) * 0.25)
    return max(0.0, round(score, 2)), issues


def _check_kill_scale_rules(strategy: dict) -> tuple[float, list[str]]:
    issues = []
    has_rules = 0
    total = 0
    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            total += 1
            kill = ad_set.get("kill_rule", "")
            scale = ad_set.get("scale_rule", "")
            if not kill:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' missing kill rule")
            elif "monitor" in kill.lower() or "adjust" in kill.lower():
                issues.append(f"Ad set '{ad_set.get('name', '?')}' kill rule is vague: '{kill}'")
            else:
                has_rules += 1
            if not scale:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' missing scale rule")
    if total == 0:
        return 0.0, ["No ad sets found"]
    return round(has_rules / total, 2), issues


def _check_tier_structure(strategy: dict) -> tuple[float, list[str]]:
    issues = []
    tier = strategy.get("tier", 1)
    if tier == 1:
        for campaign in strategy.get("campaigns", []):
            for ad_set in campaign.get("ad_sets", []):
                name = ad_set.get("name", "").lower()
                if "lookalike" in name or "lla" in name or "retarget" in name:
                    issues.append(f"Tier 1 should not have LLA/retargeting: '{ad_set.get('name')}'")
    progression = strategy.get("progression_rules", {})
    if not progression.get("trigger"):
        issues.append("No progression trigger defined (need specific threshold like '250 leads')")
    elif "enough" in str(progression.get("trigger", "")).lower():
        issues.append(f"Progression trigger is vague: '{progression['trigger']}' — need specific number")
    score = 1.0 - (len(issues) * 0.3)
    return max(0.0, round(score, 2)), issues
