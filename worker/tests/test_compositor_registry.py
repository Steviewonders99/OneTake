"""Tests for component registry -- resolves IDs to HTML fragments.

All assertions use brand-correct colors from worker/brand/oneforma.py:
- Brand gradient: #0452BF -> #CD128A
- CTA gradient: #6B21A8 -> #E91E8C
- Text primary: #001427
- Logo dark: #CD128A spiral, #001427 text
- Edge glow: rgba(205,18,138,...) and rgba(4,82,191,...)
"""
import pytest
from compositor.registry import (
    get_background_html,
    get_cta_html,
    get_edge_glow_html,
    get_logo_html,
    get_overlay_html,
    get_text_block_html,
    get_actor_html,
)


class TestBackgrounds:
    def test_gradient_preset_returns_html(self):
        html = get_background_html("gradient", "gradient_brand_primary")
        assert "background" in html
        assert "linear-gradient" in html

    def test_gradient_warm_sunset_alias(self):
        html = get_background_html("gradient", "gradient_warm_sunset")
        assert "background" in html
        assert "linear-gradient" in html

    def test_solid_color_returns_html(self):
        html = get_background_html("solid", "bg_dark")
        assert "background" in html
        assert "#001427" in html

    def test_solid_charcoal_alias(self):
        html = get_background_html("solid", "bg_charcoal")
        assert "background" in html
        assert "#001427" in html

    def test_unknown_preset_raises(self):
        with pytest.raises(KeyError):
            get_background_html("gradient", "nonexistent_gradient")


class TestCTA:
    def test_pill_primary_returns_html(self):
        html = get_cta_html("pill_primary", "Put your expertise to work", "bottom-center")
        assert "Put your expertise to work" in html
        assert "border-radius" in html or "rounded" in html
        # Brand CTA gradient
        assert "#6B21A8" in html
        assert "#E91E8C" in html

    def test_pill_primary_uppercase(self):
        html = get_cta_html("pill_primary", "Test CTA", "bottom-center")
        assert "text-transform:uppercase" in html

    def test_banner_full_returns_html(self):
        html = get_cta_html("banner_full", "Find a project", "bottom-center")
        assert "Find a project" in html
        assert "width" in html
        assert "#6B21A8" in html

    def test_pill_outline_uses_brand_purple(self):
        html = get_cta_html("pill_outline", "Test", "bottom-center")
        assert "#6B21A8" in html
        assert "border" in html

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
        assert "44" in html  # large = H1 = 44px

    def test_text_small_is_22px(self):
        html = get_text_block_html("H", "S", "top-left", "small", "none")
        assert "22px" in html

    def test_text_medium_is_32px(self):
        html = get_text_block_html("H", "S", "top-left", "medium", "none")
        assert "32px" in html

    def test_text_xlarge_is_64px(self):
        html = get_text_block_html("H", "S", "top-left", "xlarge", "none")
        assert "64px" in html
        assert "900" in html  # Display weight

    def test_dark_backdrop_uses_white_text(self):
        html = get_text_block_html("H", "S", "top-left", "large", "dark_gradient")
        assert "#FFFFFF" in html or "white" in html.lower() or "fff" in html.lower()

    def test_light_text_uses_brand_primary(self):
        html = get_text_block_html("H", "S", "top-left", "large", "none")
        assert "#001427" in html

    def test_text_has_letter_spacing(self):
        html = get_text_block_html("H", "S", "top-left", "large", "none")
        assert "letter-spacing" in html

    def test_text_has_text_shadow(self):
        html = get_text_block_html("H", "S", "top-left", "large", "dark_gradient")
        assert "text-shadow" in html

    def test_frosted_card_has_brand_border(self):
        html = get_text_block_html("H", "S", "top-left", "large", "frosted_card")
        assert "rgba(215,224,234,0.3)" in html

    def test_text_uses_roboto_font(self):
        html = get_text_block_html("H", "S", "top-left", "large", "none")
        assert "Roboto" in html


class TestLogoHTML:
    def test_white_logo(self):
        html = get_logo_html("white")
        assert "OneForma" in html
        assert "rgba(255,255,255" in html

    def test_dark_logo_uses_brand_pink(self):
        html = get_logo_html("dark")
        assert "OneForma" in html
        assert "#CD128A" in html
        assert "#001427" in html

    def test_default_is_white(self):
        html = get_logo_html()
        assert "rgba(255,255,255" in html


class TestEdgeGlow:
    def test_edge_glow_returns_html(self):
        html = get_edge_glow_html()
        assert "box-shadow" in html
        assert "inset" in html

    def test_edge_glow_uses_brand_colors(self):
        html = get_edge_glow_html()
        assert "rgba(205,18,138" in html  # Brand pink #CD128A
        assert "rgba(4,82,191" in html    # Brand sapphire #0452BF
