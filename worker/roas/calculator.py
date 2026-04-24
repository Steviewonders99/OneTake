"""ROAS calculator — recruitment-specific return on ad spend formulas.

Where the participant IS the product. Every metric flows from RPP
(Revenue Per Participant).

Business rules:
- Target CPA = 20% of RPP (participant revenue)
- Starting ad budget = 6x Target CPA per participant needed
- Recognition rate = 85% default (our share of contract value)
- Fulfillment rate = 65% default (% of completions that deliver usable data)
"""
from __future__ import annotations


def calculate_roas_metrics(
    rate: float,
    recognition_rate: float = 0.85,
    variable_cost: float = 0.0,
    fulfillment_rate: float = 0.65,
    cpa_target_pct: float = 0.20,
    budget_multiplier: float = 6.0,
    volume: int = 0,
    ad_spend: float | None = None,
    completions: int | None = None,
) -> dict:
    """Calculate all ROAS metrics for a campaign or country."""
    rpp = rate * recognition_rate
    net_rpp = rpp - variable_cost
    target_cpa = rpp * cpa_target_pct
    breakeven_cpa = net_rpp * fulfillment_rate if fulfillment_rate > 0 else 0
    recommended_budget = target_cpa * budget_multiplier * volume

    result = {
        "rpp": round(rpp, 2),
        "net_rpp": round(net_rpp, 2),
        "target_cpa": round(target_cpa, 2),
        "breakeven_cpa": round(breakeven_cpa, 2),
        "recommended_budget": round(recommended_budget, 2),
        "volume": volume,
        "rate": rate,
        "recognition_rate": recognition_rate,
        "fulfillment_rate": fulfillment_rate,
    }

    if ad_spend is not None and completions is not None and completions > 0:
        actual_cpa = ad_spend / completions
        effective_cpa = ad_spend / (completions * fulfillment_rate) if fulfillment_rate > 0 else 0
        roas = (completions * fulfillment_rate * net_rpp) / ad_spend if ad_spend > 0 else 0
        roi_pct = (roas - 1) * 100

        if actual_cpa <= target_cpa:
            health = "excellent"
        elif actual_cpa <= breakeven_cpa:
            health = "acceptable"
        else:
            health = "unprofitable"

        result.update({
            "actual_cpa": round(actual_cpa, 2),
            "effective_cpa": round(effective_cpa, 2),
            "roas": round(roas, 4),
            "roi_pct": round(roi_pct, 1),
            "health": health,
        })

    return result


def calculate_funnel_costs(
    ad_spend: float,
    lp_visitors: int = 0,
    signup_starts: int = 0,
    email_verified: int = 0,
    profile_completes: int = 0,
    fulfillment_rate: float = 0.65,
) -> dict:
    """Calculate cost at each funnel stage to find where money leaks."""
    def safe_div(a: float, b: int) -> float | None:
        return round(a / b, 2) if b > 0 else None

    return {
        "cost_per_lp_visitor": safe_div(ad_spend, lp_visitors),
        "cost_per_signup_start": safe_div(ad_spend, signup_starts),
        "cost_per_email_verified": safe_div(ad_spend, email_verified),
        "cost_per_profile_complete": safe_div(ad_spend, profile_completes),
        "cost_per_usable_participant": safe_div(ad_spend, int(profile_completes * fulfillment_rate)) if profile_completes > 0 else None,
    }
