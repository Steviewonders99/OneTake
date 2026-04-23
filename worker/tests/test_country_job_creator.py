"""Tests for country_job_creator.py — pure logic, no DB or network.

Covers:
- get_persona_scaling: scaling persona/actor counts by country count
- has_country_quotas: detecting structured country quotas in form_data
"""
import pytest
from pipeline.country_job_creator import get_persona_scaling, has_country_quotas, PERSONA_SCALING, PERSONA_SCALING_DEFAULT


class TestGetPersonaScaling:
    """Verify persona/actor counts scale correctly by country count."""

    def test_single_country_gets_2_personas_2_actors(self):
        result = get_persona_scaling(1)
        assert result == {"personas": 2, "actors_per_persona": 2}

    def test_two_countries_gets_2_personas_2_actors(self):
        result = get_persona_scaling(2)
        assert result == {"personas": 2, "actors_per_persona": 2}

    def test_three_countries_gets_1_persona_1_actor(self):
        result = get_persona_scaling(3)
        assert result == {"personas": 1, "actors_per_persona": 1}

    def test_sixteen_countries_gets_1_persona_1_actor(self):
        result = get_persona_scaling(16)
        assert result == {"personas": 1, "actors_per_persona": 1}

    def test_thirty_countries_gets_1_persona_1_actor(self):
        result = get_persona_scaling(30)
        assert result == {"personas": 1, "actors_per_persona": 1}

    def test_zero_countries_gets_default(self):
        """Edge case: zero countries should fall back to default."""
        result = get_persona_scaling(0)
        assert result == PERSONA_SCALING_DEFAULT

    def test_negative_countries_gets_default(self):
        """Edge case: negative number should fall back to default."""
        result = get_persona_scaling(-1)
        assert result == PERSONA_SCALING_DEFAULT

    def test_scaling_dict_is_exhaustive_for_1_and_2(self):
        """Ensure scaling dict explicitly covers 1 and 2."""
        assert 1 in PERSONA_SCALING
        assert 2 in PERSONA_SCALING

    def test_default_is_minimal(self):
        """Default scaling should be the minimal config (1/1)."""
        assert PERSONA_SCALING_DEFAULT["personas"] == 1
        assert PERSONA_SCALING_DEFAULT["actors_per_persona"] == 1


class TestHasCountryQuotas:
    """Verify detection of country_quotas in form_data."""

    def test_returns_true_with_valid_quotas(self):
        request = {"form_data": {"country_quotas": [{"country": "Morocco", "total_volume": 500, "rate": 17.5}]}}
        assert has_country_quotas(request) is True

    def test_returns_true_with_multiple_quotas(self):
        request = {"form_data": {"country_quotas": [
            {"country": "Morocco", "total_volume": 500},
            {"country": "France", "total_volume": 800},
            {"country": "Germany", "total_volume": 300},
        ]}}
        assert has_country_quotas(request) is True

    def test_returns_false_with_empty_quotas(self):
        request = {"form_data": {"country_quotas": []}}
        assert has_country_quotas(request) is False

    def test_returns_false_with_no_quotas_key(self):
        request = {"form_data": {}}
        assert has_country_quotas(request) is False

    def test_returns_false_with_no_form_data(self):
        request = {}
        assert has_country_quotas(request) is False

    def test_returns_false_with_none_form_data(self):
        """form_data=None should be handled gracefully."""
        request = {"form_data": None}
        assert has_country_quotas(request) is False

    def test_returns_false_with_quotas_as_string(self):
        """Quotas should be a list, not a string."""
        request = {"form_data": {"country_quotas": "not a list"}}
        assert has_country_quotas(request) is False

    def test_returns_false_with_quotas_as_dict(self):
        """Quotas should be a list, not a dict."""
        request = {"form_data": {"country_quotas": {"Morocco": 500}}}
        assert has_country_quotas(request) is False
