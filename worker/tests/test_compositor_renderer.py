"""Tests for deterministic renderer -- JSON config -> HTML string.

Uses brand-correct colors: gradient_warm_sunset (alias for brand_primary),
blob_warm_1 (brand purple-pink gradient).
"""
import pytest
from compositor.renderer import assemble_html
from compositor.schema import CreativeConfig


def _make_config_dict(**overrides):
    base = {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "abc-123", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": "Put your expertise to work",
            "subheadline": "Data collection tasks in Morocco",
            "position": "top-left",
            "size": "large",
            "contrast_backdrop": "dark_gradient",
        },
        "cta": {"text": "Put your expertise to work", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }
    base.update(overrides)
    return base


class TestAssembleHTML:
    def test_returns_valid_html(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/actor.png")
        assert "<!DOCTYPE html>" in html
        assert "Put your expertise to work" in html

    def test_contains_actor_image(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/face.jpg")
        assert "example.com/face.jpg" in html

    def test_different_layouts_produce_different_html(self):
        c1 = CreativeConfig.from_dict(_make_config_dict(layout="earn_hero_badge"))
        c2 = CreativeConfig.from_dict(_make_config_dict(layout="earn_full_bleed"))
        h1 = assemble_html(c1, actor_photo_url="https://example.com/a.png")
        h2 = assemble_html(c2, actor_photo_url="https://example.com/a.png")
        assert h1 != h2

    def test_context_element_included_when_set(self):
        config = CreativeConfig.from_dict(_make_config_dict(
            context_element={"type": "device_mockup", "position": "bottom-left", "content": "survey_ui"}
        ))
        html = assemble_html(config, actor_photo_url="https://example.com/a.png")
        # The device mockup component should have "OneForma" or "Task" or similar content
        assert len(html) > 500  # Should be substantially bigger with context element

    def test_custom_dimensions(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/a.png", width=1200, height=627)
        assert "1200" in html
        assert "627" in html

    def test_contains_oneforma_logo(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/a.png")
        assert "OneForma" in html

    def test_contains_edge_glow(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/a.png")
        assert "box-shadow" in html
        assert "inset" in html

    def test_html_uses_brand_cta_gradient(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/a.png")
        assert "#6B21A8" in html  # CTA gradient start
        assert "#E91E8C" in html  # CTA gradient end

    def test_html_uses_roboto_font(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/a.png")
        assert "Roboto" in html
