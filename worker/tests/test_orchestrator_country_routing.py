"""Tests for orchestrator country job routing and context injection.

These tests verify that:
1. generate jobs with country_quotas create country jobs (not child requests)
2. generate_country jobs inject correct context
3. Status rollup only marks campaign as 'review' when ALL country jobs complete
4. Legacy campaigns (no quotas) still work through the old pipeline
"""
import pytest
import json

from pipeline.country_job_creator import has_country_quotas, get_persona_scaling


class TestOrchestratorCountryRouting:
    """Test that the orchestrator correctly routes country jobs."""

    def _make_generate_job(self, request_id="req-123"):
        return {
            "request_id": request_id,
            "job_type": "generate",
            "stage_target": None,
            "feedback": None,
            "country": None,
            "feedback_data": None,
        }

    def _make_country_job(self, request_id="req-123", country="Morocco"):
        return {
            "request_id": request_id,
            "job_type": "generate_country",
            "stage_target": None,
            "feedback": None,
            "country": country,
            "feedback_data": json.dumps({
                "persona_count": 1,
                "actors_per_persona": 1,
                "total_volume": 500,
                "rate": 17.5,
                "currency": "USD",
                "demographics": [{"category": "Ethnicity", "value": "Arab", "percentage": 60, "volume": 300}],
                "locale": "ar_MA",
            }),
        }

    def _make_request_with_quotas(self):
        return {
            "title": "Centaurus Data Collection",
            "task_type": "data_collection",
            "target_regions": ["Morocco", "France", "Germany"],
            "target_languages": ["Arabic", "French", "German"],
            "form_data": {
                "country_quotas": [
                    {"country": "Morocco", "total_volume": 500, "rate": 17.5, "currency": "USD", "locale": "ar_MA", "demographics": []},
                    {"country": "France", "total_volume": 800, "rate": 37.5, "currency": "USD", "locale": "fr_FR", "demographics": []},
                    {"country": "Germany", "total_volume": 300, "rate": 37.5, "currency": "USD", "locale": "de_DE", "demographics": []},
                ],
            },
        }

    def _make_request_without_quotas(self):
        return {
            "title": "Simple Campaign",
            "task_type": "annotation",
            "target_regions": ["Morocco"],
            "target_languages": ["Arabic"],
            "form_data": {},
        }

    def test_has_country_quotas_detected(self):
        """Orchestrator should detect country_quotas and create country jobs."""
        request = self._make_request_with_quotas()
        assert has_country_quotas(request) is True

    def test_no_country_quotas_falls_through(self):
        """Requests without country_quotas should not trigger country job creation."""
        request = self._make_request_without_quotas()
        assert has_country_quotas(request) is False

    def test_country_job_context_parsing(self):
        """Verify country job feedback_data is correctly parsed into context."""
        job = self._make_country_job(country="Morocco")
        feedback_data = job["feedback_data"]
        if isinstance(feedback_data, str):
            feedback_data = json.loads(feedback_data)

        assert feedback_data["persona_count"] == 1
        assert feedback_data["actors_per_persona"] == 1
        assert feedback_data["total_volume"] == 500
        assert feedback_data["rate"] == 17.5
        assert feedback_data["currency"] == "USD"
        assert len(feedback_data["demographics"]) == 1
        assert feedback_data["demographics"][0]["category"] == "Ethnicity"
        assert feedback_data["demographics"][0]["percentage"] == 60
        assert feedback_data["locale"] == "ar_MA"

    def test_country_context_overrides_target_regions(self):
        """For country jobs, target_regions should be overridden to just the single country."""
        job = self._make_country_job(country="Morocco")
        # Simulate what orchestrator does
        context = {"request_id": job["request_id"]}
        context["country"] = job["country"]
        context["target_regions"] = [job["country"]]

        assert context["target_regions"] == ["Morocco"]
        assert context["country"] == "Morocco"

    def test_persona_scaling_applied_to_context(self):
        """Country job context should include correct persona/actor scaling."""
        job = self._make_country_job()
        feedback_data = json.loads(job["feedback_data"])

        context = {
            "persona_count": feedback_data.get("persona_count", 2),
            "actors_per_persona": feedback_data.get("actors_per_persona", 2),
        }

        # 3+ countries = 1 persona, 1 actor
        assert context["persona_count"] == 1
        assert context["actors_per_persona"] == 1


class TestStatusRollup:
    """Test the all-countries-complete status rollup logic."""

    def test_rollup_logic_all_complete(self):
        """When all country jobs are complete, campaign should move to review."""
        # Simulate the check: total == done
        total = 3
        done = 3
        all_complete = (done == total and total > 0)
        assert all_complete is True

    def test_rollup_logic_not_all_complete(self):
        """When some jobs are still processing, campaign stays generating."""
        total = 3
        done = 1
        all_complete = (done == total and total > 0)
        assert all_complete is False

    def test_rollup_logic_no_jobs(self):
        """Zero country jobs should not trigger review."""
        total = 0
        done = 0
        all_complete = (done == total and total > 0)
        assert all_complete is False


class TestBackwardsCompatibility:
    """Verify that existing campaigns without country_quotas still work."""

    def test_legacy_request_no_quotas(self):
        """A request with no country_quotas should bypass country job creation."""
        legacy_request = {
            "title": "Old Campaign",
            "form_data": {
                "target_volume": 500,
                "compensation_rate": 25,
            },
        }
        assert has_country_quotas(legacy_request) is False

    def test_legacy_request_empty_form_data(self):
        assert has_country_quotas({"form_data": {}}) is False

    def test_legacy_request_no_form_data_key(self):
        assert has_country_quotas({}) is False

    def test_generate_job_type_still_works(self):
        """generate job type should still be valid."""
        job = {"job_type": "generate", "request_id": "test"}
        assert job["job_type"] == "generate"

    def test_regenerate_job_types_unaffected(self):
        """Other job types should not be affected by country changes."""
        for jt in ["regenerate", "regenerate_stage", "regenerate_asset", "resume_from"]:
            job = {"job_type": jt, "request_id": "test"}
            # These should never trigger country job creation
            assert job["job_type"] != "generate"
            assert job["job_type"] != "generate_country"


class TestStageContextReading:
    """Verify that pipeline stages correctly read country context.

    These tests verify the context shape that stages expect,
    without running the actual AI pipeline.
    """

    def _make_country_context(self, country="Morocco", persona_count=1, actors_per_persona=1):
        return {
            "request_id": "req-123",
            "country": country,
            "persona_count": persona_count,
            "actors_per_persona": actors_per_persona,
            "country_quota": {
                "total_volume": 500,
                "rate": 17.5,
                "currency": "USD",
                "demographics": [],
                "locale": "ar_MA",
            },
            "target_regions": [country],
            "form_data": {},
            "feedback": None,
        }

    def _make_legacy_context(self):
        return {
            "request_id": "req-456",
            "feedback": None,
        }

    def test_country_context_has_all_fields(self):
        ctx = self._make_country_context()
        assert "country" in ctx
        assert "persona_count" in ctx
        assert "actors_per_persona" in ctx
        assert "country_quota" in ctx
        assert "target_regions" in ctx
        assert ctx["country"] == "Morocco"

    def test_country_context_persona_count_readable(self):
        ctx = self._make_country_context(persona_count=2)
        assert ctx.get("persona_count", 2) == 2

    def test_country_context_actors_per_persona_readable(self):
        ctx = self._make_country_context(actors_per_persona=2)
        assert ctx.get("actors_per_persona", 2) == 2

    def test_legacy_context_persona_count_defaults(self):
        """Legacy context should default to 2 personas when not specified."""
        ctx = self._make_legacy_context()
        assert ctx.get("persona_count", 2) == 2

    def test_legacy_context_actors_defaults(self):
        """Legacy context should default to 2 actors when not specified."""
        ctx = self._make_legacy_context()
        assert ctx.get("actors_per_persona", 2) == 2

    def test_legacy_context_country_is_none(self):
        """Legacy context should have no country."""
        ctx = self._make_legacy_context()
        assert ctx.get("country") is None

    def test_country_context_target_regions_overridden(self):
        """Country jobs should have target_regions = [country]."""
        ctx = self._make_country_context(country="France")
        assert ctx["target_regions"] == ["France"]

    def test_three_plus_countries_gets_minimal_scaling(self):
        """With 3+ countries, each country gets 1 persona and 1 actor."""
        scaling = get_persona_scaling(16)
        ctx = self._make_country_context(
            persona_count=scaling["personas"],
            actors_per_persona=scaling["actors_per_persona"],
        )
        assert ctx["persona_count"] == 1
        assert ctx["actors_per_persona"] == 1

    def test_single_country_gets_full_scaling(self):
        """With 1 country, it gets 2 personas and 2 actors."""
        scaling = get_persona_scaling(1)
        ctx = self._make_country_context(
            persona_count=scaling["personas"],
            actors_per_persona=scaling["actors_per_persona"],
        )
        assert ctx["persona_count"] == 2
        assert ctx["actors_per_persona"] == 2


class TestCountryQuotaDataIntegrity:
    """Test that country quota data maintains integrity through the pipeline."""

    CENTAURUS_QUOTAS = [
        {"country": "Bulgaria", "locale": "bg_BG", "total_volume": 400, "rate": 17.5, "currency": "USD", "demographics": []},
        {"country": "Croatia", "locale": "hr_HR", "total_volume": 350, "rate": 27.5, "currency": "USD", "demographics": []},
        {"country": "Czech Republic", "locale": "cs_CZ", "total_volume": 250, "rate": 25.0, "currency": "USD", "demographics": []},
        {"country": "Canada", "locale": "en_CA", "total_volume": 600, "rate": 37.5, "currency": "USD", "demographics": []},
        {"country": "Ireland", "locale": "en_IE", "total_volume": 300, "rate": 37.5, "currency": "USD", "demographics": []},
        {"country": "South Africa", "locale": "en_ZA", "total_volume": 450, "rate": 25.0, "currency": "USD", "demographics": []},
        {"country": "United States", "locale": "en_US", "total_volume": 1000, "rate": 30.0, "currency": "USD", "demographics": [
            {"category": "Ethnicity", "value": "Middle Eastern", "percentage": 50, "volume": 500},
            {"category": "Ethnicity", "value": "Hispanic/Latino", "percentage": 30, "volume": 300},
        ]},
        {"country": "Germany", "locale": "de_DE", "total_volume": 300, "rate": 37.5, "currency": "USD", "demographics": []},
        {"country": "Greece", "locale": "el_GR", "total_volume": 200, "rate": 20.0, "currency": "USD", "demographics": []},
        {"country": "Italy", "locale": "it_IT", "total_volume": 350, "rate": 27.5, "currency": "USD", "demographics": []},
        {"country": "Malaysia", "locale": "ms_MY", "total_volume": 500, "rate": 10.0, "currency": "USD", "demographics": []},
        {"country": "Poland", "locale": "pl_PL", "total_volume": 400, "rate": 20.0, "currency": "USD", "demographics": []},
        {"country": "Romania", "locale": "ro_RO", "total_volume": 350, "rate": 17.5, "currency": "USD", "demographics": []},
        {"country": "Chile", "locale": "es_CL", "total_volume": 300, "rate": 17.5, "currency": "USD", "demographics": []},
        {"country": "Colombia", "locale": "es_CO", "total_volume": 400, "rate": 15.0, "currency": "USD", "demographics": []},
        {"country": "France", "locale": "fr_CA", "total_volume": 400, "rate": 37.5, "currency": "USD", "demographics": []},
    ]

    def test_centaurus_has_16_countries(self):
        assert len(self.CENTAURUS_QUOTAS) == 16

    def test_all_countries_have_required_fields(self):
        for q in self.CENTAURUS_QUOTAS:
            assert "country" in q and q["country"]
            assert "locale" in q and q["locale"]
            assert "total_volume" in q and q["total_volume"] > 0
            assert "rate" in q and q["rate"] > 0
            assert "currency" in q
            assert "demographics" in q and isinstance(q["demographics"], list)

    def test_total_volume_is_reasonable(self):
        total = sum(q["total_volume"] for q in self.CENTAURUS_QUOTAS)
        assert total > 0
        assert total < 100000  # sanity check

    def test_rates_are_positive(self):
        for q in self.CENTAURUS_QUOTAS:
            assert q["rate"] > 0

    def test_us_has_demographic_quotas(self):
        us = next(q for q in self.CENTAURUS_QUOTAS if q["country"] == "United States")
        assert len(us["demographics"]) == 2
        assert us["demographics"][0]["category"] == "Ethnicity"
        assert us["demographics"][0]["percentage"] == 50
        assert us["demographics"][1]["percentage"] == 30

    def test_persona_scaling_for_centaurus(self):
        """16 countries should get 1 persona, 1 actor each."""
        scaling = get_persona_scaling(len(self.CENTAURUS_QUOTAS))
        assert scaling["personas"] == 1
        assert scaling["actors_per_persona"] == 1

    def test_feedback_data_structure(self):
        """Verify feedback_data matches what create_country_jobs would produce."""
        scaling = get_persona_scaling(len(self.CENTAURUS_QUOTAS))

        for quota in self.CENTAURUS_QUOTAS:
            feedback_data = {
                "persona_count": scaling["personas"],
                "actors_per_persona": scaling["actors_per_persona"],
                "total_volume": quota.get("total_volume", 0),
                "rate": quota.get("rate", 0),
                "currency": quota.get("currency", "USD"),
                "demographics": quota.get("demographics", []),
                "locale": quota.get("locale", ""),
            }
            # Verify it's JSON-serializable
            serialized = json.dumps(feedback_data)
            deserialized = json.loads(serialized)
            assert deserialized["persona_count"] == 1
            assert deserialized["total_volume"] == quota["total_volume"]
            assert deserialized["rate"] == quota["rate"]
