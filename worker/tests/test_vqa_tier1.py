"""Tests for Tier 1 deterministic VQA checks."""
import pytest
from vqa.tier1_checks import run_tier1_checks


class TestTier1:
    def test_valid_html_passes(self):
        html = '<div class="layer-background" style="background:red;"></div><div class="layer-text"><div style="font-size:32px;">Headline</div></div><div class="layer-cta">Apply</div><img src="test.png" />'
        result = run_tier1_checks(html)
        assert result["passed"] is True
        assert result["issues"] == []

    def test_missing_headline_fails(self):
        html = '<div class="layer-background"></div><div class="layer-cta">Apply</div><img src="test.png" />' + ('x' * 100)
        result = run_tier1_checks(html)
        assert result["passed"] is False
        assert any("headline" in i["check"].lower() for i in result["issues"])

    def test_missing_cta_fails(self):
        html = '<div class="layer-background"></div><div class="layer-text"><div style="font-size:32px;">Headline</div></div><img src="test.png" />' + ('x' * 100)
        result = run_tier1_checks(html)
        assert result["passed"] is False
        assert any("cta" in i["check"].lower() for i in result["issues"])

    def test_empty_html_fails(self):
        result = run_tier1_checks("")
        assert result["passed"] is False

    def test_small_font_fails(self):
        html = '<div class="layer-background"></div><div class="layer-text"><div style="font-size:10px;">Small</div></div><div class="layer-cta">CTA</div><img src="x.png" />' + ('x' * 100)
        result = run_tier1_checks(html)
        assert result["passed"] is False
        assert any("font" in i["check"].lower() for i in result["issues"])
