"""Tests for ROAS calculator — recruitment-specific formulas."""
from roas.calculator import calculate_funnel_costs, calculate_roas_metrics


class TestCalculateRoasMetrics:
    """Test all ROAS formula calculations."""

    def test_basic_rpp_calculation(self):
        result = calculate_roas_metrics(rate=30.0, recognition_rate=0.85)
        assert result["rpp"] == 25.50

    def test_net_rpp_with_variable_cost(self):
        result = calculate_roas_metrics(rate=30.0, variable_cost=12.0)
        assert result["net_rpp"] == 13.50

    def test_target_cpa_is_20_pct_of_rpp(self):
        result = calculate_roas_metrics(rate=30.0)
        assert result["target_cpa"] == 5.10

    def test_recommended_budget_formula(self):
        result = calculate_roas_metrics(rate=30.0, volume=1000)
        assert result["recommended_budget"] == 30600.00

    def test_breakeven_cpa(self):
        result = calculate_roas_metrics(rate=30.0, fulfillment_rate=0.65)
        assert result["breakeven_cpa"] == 16.57

    def test_breakeven_with_variable_cost(self):
        result = calculate_roas_metrics(rate=30.0, variable_cost=12.0, fulfillment_rate=0.65)
        assert result["breakeven_cpa"] == 8.78

    def test_morocco_rate(self):
        result = calculate_roas_metrics(rate=17.50, volume=500)
        assert result["rpp"] == 14.88
        assert result["target_cpa"] == 2.98

    def test_malaysia_cheapest_rate(self):
        result = calculate_roas_metrics(rate=10.0, volume=500)
        assert result["rpp"] == 8.50
        assert result["target_cpa"] == 1.70

    def test_canada_highest_rate(self):
        result = calculate_roas_metrics(rate=37.50, volume=600)
        assert result["rpp"] == 31.88

    def test_no_actuals_returns_projections_only(self):
        result = calculate_roas_metrics(rate=30.0)
        assert "rpp" in result
        assert "target_cpa" in result
        assert "actual_cpa" not in result
        assert "health" not in result

    def test_actuals_with_profitable_campaign(self):
        result = calculate_roas_metrics(rate=30.0, ad_spend=1000, completions=300, volume=1000)
        assert result["actual_cpa"] == 3.33
        assert result["health"] == "excellent"
        assert result["roas"] > 1.0

    def test_actuals_with_acceptable_campaign(self):
        result = calculate_roas_metrics(rate=30.0, ad_spend=3000, completions=300, volume=1000)
        assert result["actual_cpa"] == 10.0
        assert result["health"] == "acceptable"

    def test_actuals_with_unprofitable_campaign(self):
        result = calculate_roas_metrics(rate=30.0, ad_spend=10000, completions=300, volume=1000)
        assert result["actual_cpa"] == 33.33
        assert result["health"] == "unprofitable"

    def test_roas_calculation(self):
        result = calculate_roas_metrics(rate=30.0, ad_spend=2000, completions=141, fulfillment_rate=0.65)
        assert result["roas"] > 1.0
        assert result["roi_pct"] > 0

    def test_roi_percentage(self):
        result = calculate_roas_metrics(rate=30.0, ad_spend=1000, completions=200)
        expected_roi = (result["roas"] - 1) * 100
        assert abs(result["roi_pct"] - round(expected_roi, 1)) < 0.2

    def test_zero_volume_budget_is_zero(self):
        result = calculate_roas_metrics(rate=30.0, volume=0)
        assert result["recommended_budget"] == 0

    def test_custom_recognition_rate(self):
        result = calculate_roas_metrics(rate=30.0, recognition_rate=0.90)
        assert result["rpp"] == 27.0

    def test_custom_budget_multiplier(self):
        result = calculate_roas_metrics(rate=30.0, budget_multiplier=10.0, volume=100)
        target_cpa = 30.0 * 0.85 * 0.20
        assert result["recommended_budget"] == round(target_cpa * 10 * 100, 2)


class TestFunnelCosts:

    def test_full_funnel(self):
        result = calculate_funnel_costs(ad_spend=5000, lp_visitors=10000, signup_starts=1000, email_verified=500, profile_completes=141)
        assert result["cost_per_lp_visitor"] == 0.50
        assert result["cost_per_signup_start"] == 5.00
        assert result["cost_per_profile_complete"] == 35.46

    def test_zero_visitors_returns_none(self):
        result = calculate_funnel_costs(ad_spend=5000, lp_visitors=0)
        assert result["cost_per_lp_visitor"] is None

    def test_usable_participant_cost(self):
        result = calculate_funnel_costs(ad_spend=5000, profile_completes=141, fulfillment_rate=0.65)
        assert result["cost_per_usable_participant"] is not None
        assert result["cost_per_usable_participant"] > result["cost_per_profile_complete"]
