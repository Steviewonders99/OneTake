"""Tests for pillar router — deterministic job → pillar classification."""
import pytest
from compositor.pillar_router import classify_pillar


class TestShapeClassification:
    """Expert/PhD/professional jobs should route to SHAPE."""

    def test_phd_research_study(self):
        result = classify_pillar({
            "title": "Medical Research Data Collection",
            "qualifications_required": "PhD in biomedical sciences or related field. 5+ years of research experience required.",
            "technical_requirements": "Published peer-reviewed papers. Certified in clinical trials methodology.",
            "compensation": "$75/hr",
            "engagement_model": "Long-term contract",
        })
        assert result["primary"] == "shape"

    def test_domain_expert_task(self):
        result = classify_pillar({
            "title": "Legal Document Analysis",
            "qualifications_required": "Licensed attorney with 10+ years experience in corporate law.",
            "technical_requirements": "Domain expert in financial regulations.",
            "compensation": "$120/hr",
        })
        assert result["primary"] == "shape"

    def test_senior_specialist(self):
        result = classify_pillar({
            "title": "AI Training Data — Senior Specialist",
            "qualifications_required": "Master's degree in Computer Science. Senior engineer with certification in ML.",
            "compensation": "$60/hr",
        })
        assert result["primary"] == "shape"


class TestGrowClassification:
    """Skill-building/career growth jobs should route to GROW."""

    def test_learn_new_skills(self):
        result = classify_pillar({
            "title": "Translation Training Project",
            "qualifications_required": "Bilingual speakers. No experience required.",
            "context_notes": "Great opportunity to learn and develop translation skills. Build your portfolio with real-world tasks.",
            "compensation": "$30/hr",
            "engagement_model": "Freelance project-based",
        })
        assert result["primary"] == "grow"

    def test_career_development(self):
        result = classify_pillar({
            "title": "Creative Writing — Career Development",
            "context_notes": "Grow your career in content creation. Flexible remote work. Students welcome.",
            "compensation": "$28/hr",
        })
        assert result["primary"] == "grow"

    def test_entry_level_with_growth(self):
        result = classify_pillar({
            "title": "Data Entry — Fresh Graduates",
            "qualifications_required": "Entry-level. Beginners welcome. Training provided.",
            "context_notes": "Gain experience in data science workflows. Upskill in AI annotation.",
            "engagement_model": "Part-time contract",
        })
        assert result["primary"] == "grow"


class TestEarnClassification:
    """Gig/volume/entry-level tasks should route to EARN."""

    def test_selfie_video_task(self):
        result = classify_pillar({
            "title": "Selfie Video Data Collection",
            "qualifications_required": "No qualifications needed. Anyone can participate.",
            "task_type": "data_collection",
            "context_notes": "Record short selfie videos from home. Quick tasks, earn per recording.",
            "compensation": "$15/hr",
            "engagement_model": "Per-task gig",
        })
        assert result["primary"] == "earn"

    def test_survey_micro_task(self):
        result = classify_pillar({
            "title": "Survey Completion — Earn Money",
            "context_notes": "Simple survey tasks. Immediate start, weekly pay. Start earning today.",
            "compensation": "$12/hr",
        })
        assert result["primary"] == "earn"

    def test_data_annotation(self):
        result = classify_pillar({
            "title": "Image Labeling — Data Annotation",
            "qualifications_required": "Open to all. No experience needed.",
            "task_type": "data_annotation",
            "context_notes": "Batch labeling tasks. Fast payment. Volume bonus available.",
            "compensation": "$18/hr",
        })
        assert result["primary"] == "earn"


class TestSecondaryPillar:
    """Secondary pillar should always differ from primary."""

    def test_secondary_differs_from_primary(self):
        result = classify_pillar({
            "title": "Expert PhD Research",
            "qualifications_required": "PhD required",
            "compensation": "$100/hr",
        })
        assert result["secondary"] != result["primary"]
        assert result["secondary"] in ("earn", "grow", "shape")

    def test_well_paying_gig_has_earn_secondary(self):
        """A well-paid expert job: SHAPE primary, EARN secondary."""
        result = classify_pillar({
            "title": "Senior Research Specialist",
            "qualifications_required": "PhD in linguistics. 10 years experience.",
            "compensation": "$80/hr",
            "context_notes": "Earn top rates for your expertise.",
        })
        assert result["primary"] == "shape"
        # Secondary should be earn (high pay mentioned) or grow
        assert result["secondary"] in ("earn", "grow")


class TestRecruiterOverride:
    """Recruiter override takes precedence over auto-classification."""

    def test_override_changes_primary(self):
        result = classify_pillar({
            "title": "Selfie Video Task",
            "compensation": "$15/hr",
            "task_type": "data_collection",
            "pillar_override": "shape",
        })
        assert result["primary"] == "shape"
        assert result["confidence"] == 1.0
        assert "Recruiter override" in result["reasoning"]

    def test_override_case_insensitive(self):
        result = classify_pillar({
            "title": "Test",
            "pillar_override": "GROW",
        })
        assert result["primary"] == "grow"

    def test_invalid_override_ignored(self):
        result = classify_pillar({
            "title": "Selfie Video Task",
            "compensation": "$15/hr",
            "pillar_override": "invalid",
        })
        assert result["primary"] in ("earn", "grow", "shape")
        assert "Recruiter override" not in result["reasoning"]


class TestConfidence:
    """Confidence should reflect how clear the classification is."""

    def test_strong_signal_high_confidence(self):
        result = classify_pillar({
            "qualifications_required": "PhD in medical sciences. 15 years experience. Certified specialist.",
            "compensation": "$100/hr",
            "engagement_model": "Full-time retainer",
        })
        assert result["confidence"] >= 0.7

    def test_no_signals_low_confidence(self):
        result = classify_pillar({
            "title": "Task",
            "description": "Complete the following work.",
        })
        assert result["confidence"] <= 0.7


class TestEdgeCases:
    def test_empty_form_defaults_to_earn(self):
        result = classify_pillar({})
        assert result["primary"] in ("earn", "grow", "shape")
        # With no signals, scores are all 0, sorted alphabetically
        assert result["primary"] == "earn"

    def test_all_none_fields(self):
        result = classify_pillar({
            "title": None,
            "qualifications_required": None,
            "compensation": None,
        })
        assert result["primary"] in ("earn", "grow", "shape")

    def test_result_has_all_keys(self):
        result = classify_pillar({"title": "Test"})
        assert "primary" in result
        assert "secondary" in result
        assert "confidence" in result
        assert "reasoning" in result
        assert "scores" in result
