"""Tests for all 12 layout templates -- brand-correct OneForma."""
import pytest
from compositor.layouts import LAYOUT_RENDERERS


MOCK_BG = '<div class="layer-background" style="background:red;"></div>'
MOCK_ACTOR = '<div class="layer-actor"><img src="https://example.com/a.png" /></div>'
MOCK_OVERLAY = '<div class="layer-overlay"></div>'
MOCK_TEXT = '<div class="layer-text">Test Headline</div>'
MOCK_CTA = '<div class="layer-cta">Put your expertise to work</div>'
MOCK_CTX = '<div class="context-element">Context</div>'
MOCK_LOGO = '<div class="logo">OneForma</div>'
MOCK_GLOW = '<div class="edge-glow"></div>'


class TestAllLayouts:
    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_returns_valid_html(self, layout_id):
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
            logo_html=MOCK_LOGO, edge_glow_html=MOCK_GLOW,
        )
        assert "<!DOCTYPE html>" in html
        assert "Test Headline" in html
        assert "Put your expertise to work" in html
        assert "example.com/a.png" in html

    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_respects_dimensions(self, layout_id):
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
            logo_html=MOCK_LOGO, edge_glow_html=MOCK_GLOW,
            width=1200, height=627,
        )
        assert "1200" in html
        assert "627" in html

    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_includes_logo(self, layout_id):
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
            logo_html=MOCK_LOGO, edge_glow_html=MOCK_GLOW,
        )
        assert "OneForma" in html

    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_includes_edge_glow(self, layout_id):
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
            logo_html=MOCK_LOGO, edge_glow_html=MOCK_GLOW,
        )
        assert "edge-glow" in html

    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_backward_compat_defaults(self, layout_id):
        """Layouts still work when logo_html and edge_glow_html default to empty."""
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
        )
        assert "<!DOCTYPE html>" in html

    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_uses_roboto_font(self, layout_id):
        """Every layout declares Roboto as primary font."""
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
            logo_html=MOCK_LOGO, edge_glow_html=MOCK_GLOW,
        )
        assert "Roboto" in html

    @pytest.mark.parametrize("layout_id", list(LAYOUT_RENDERERS.keys()))
    def test_layout_imports_roboto_font(self, layout_id):
        """Every layout includes Google Fonts @import for Roboto."""
        render_fn = LAYOUT_RENDERERS[layout_id]
        html = render_fn(
            MOCK_BG, MOCK_ACTOR, MOCK_OVERLAY, MOCK_TEXT, MOCK_CTA, MOCK_CTX,
            logo_html=MOCK_LOGO, edge_glow_html=MOCK_GLOW,
        )
        assert "fonts.googleapis.com" in html

    def test_all_12_layouts_registered(self):
        assert len(LAYOUT_RENDERERS) == 12

    def test_earn_layouts_present(self):
        for lid in ["earn_hero_badge", "earn_split_stat", "earn_full_bleed", "earn_card_stack"]:
            assert lid in LAYOUT_RENDERERS

    def test_grow_layouts_present(self):
        for lid in ["grow_device_mockup", "grow_editorial", "grow_diagonal_split", "grow_bold_type"]:
            assert lid in LAYOUT_RENDERERS

    def test_shape_layouts_present(self):
        for lid in ["shape_portrait_cred", "shape_multi_grid", "shape_clean_card", "shape_photo_frame"]:
            assert lid in LAYOUT_RENDERERS
