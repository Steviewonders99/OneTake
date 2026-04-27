"""Tests for component registry — resolves IDs to HTML fragments."""
import pytest
from compositor.registry import (
    get_background_html,
    get_cta_html,
    get_overlay_html,
    get_text_block_html,
    get_actor_html,
)


class TestBackgrounds:
    def test_gradient_preset_returns_html(self):
        html = get_background_html("gradient", "gradient_warm_sunset")
        assert "background" in html
        assert "linear-gradient" in html

    def test_solid_color_returns_html(self):
        html = get_background_html("solid", "bg_charcoal")
        assert "background" in html
        assert "#32373C" in html or "32373C" in html.lower()

    def test_unknown_preset_raises(self):
        with pytest.raises(KeyError):
            get_background_html("gradient", "nonexistent_gradient")


class TestCTA:
    def test_pill_primary_returns_html(self):
        html = get_cta_html("pill_primary", "Apply Now", "bottom-center")
        assert "Apply Now" in html
        assert "border-radius" in html or "rounded" in html

    def test_banner_full_returns_html(self):
        html = get_cta_html("banner_full", "Sign Up Today", "bottom-center")
        assert "Sign Up Today" in html
        assert "width" in html

    def test_unknown_style_raises(self):
        with pytest.raises(KeyError):
            get_cta_html("neon_glow", "Click", "bottom-center")


class TestActorHTML:
    def test_actor_right_soft_fade(self):
        html = get_actor_html(
            photo_url="https://example.com/actor.png",
            position="right",
            scale=0.85,
            mask="soft_fade",
        )
        assert "example.com/actor.png" in html
        assert "right" in html

    def test_actor_center_none(self):
        html = get_actor_html(
            photo_url="https://example.com/actor.png",
            position="center",
            scale=1.0,
            mask="none",
        )
        assert "center" in html


class TestTextBlock:
    def test_text_block_with_headline(self):
        html = get_text_block_html("Test Headline", "Subline", "top-left", "large", "none")
        assert "Test Headline" in html
        assert "Subline" in html
        assert "32" in html  # large = 32px

    def test_dark_backdrop_uses_white_text(self):
        html = get_text_block_html("H", "S", "top-left", "large", "dark_gradient")
        assert "#FFFFFF" in html or "white" in html.lower() or "fff" in html.lower()
