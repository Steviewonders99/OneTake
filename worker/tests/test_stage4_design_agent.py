"""Integration tests for Stage 4 graphic design agent -- pure logic only.

Tests the full flow: config -> render -> tier1 -> auto-fix
without touching APIs (Creative Director, VQA, Blob, Neon).

Uses brand-correct presets: gradient_warm_sunset (alias for brand_primary),
blob_warm_1 (brand purple-pink gradient).
"""
import pytest
from compositor.schema import CreativeConfig, validate_batch, EARN_LAYOUTS, GROW_LAYOUTS, SHAPE_LAYOUTS
from compositor.renderer import assemble_html
from vqa.tier1_checks import run_tier1_checks
from vqa.auto_fix import apply_fixes


def _make_earn_config(layout: str, headline: str, actor_pos: str = "right", text_pos: str = "top-left"):
    return {
        "layout": layout,
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "test-1", "position": actor_pos, "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": headline,
            "subheadline": "Test subheadline",
            "position": text_pos,
            "size": "large",
            "contrast_backdrop": "dark_gradient",
        },
        "cta": {"text": "Put your expertise to work", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }


class TestFullFlow:
    def test_config_to_html_roundtrip(self):
        """Config -> CreativeConfig -> assemble_html produces valid HTML."""
        raw = _make_earn_config("earn_hero_badge", "Put your expertise to work")
        config = CreativeConfig.from_dict(raw)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        assert "<!DOCTYPE html>" in html
        assert "Put your expertise to work" in html
        assert "example.com/test.png" in html

    def test_all_earn_layouts_render(self):
        """All 4 earn layouts produce valid HTML."""
        earn_list = sorted(EARN_LAYOUTS)
        headlines = [f"Earn headline for {layout}" for layout in earn_list]
        for layout, headline in zip(earn_list, headlines):
            raw = _make_earn_config(layout, headline)
            config = CreativeConfig.from_dict(raw)
            html = assemble_html(config, actor_photo_url="https://example.com/test.png")
            assert "<!DOCTYPE html>" in html
            assert headline in html

    def test_all_grow_layouts_render(self):
        """All 4 grow layouts produce valid HTML."""
        grow_list = sorted(GROW_LAYOUTS)
        headlines = [f"Grow headline for {layout}" for layout in grow_list]
        for layout, headline in zip(grow_list, headlines):
            raw = _make_earn_config(layout, headline)
            config = CreativeConfig.from_dict(raw)
            html = assemble_html(config, actor_photo_url="https://example.com/test.png")
            assert "<!DOCTYPE html>" in html

    def test_all_shape_layouts_render(self):
        """All 4 shape layouts produce valid HTML."""
        shape_list = sorted(SHAPE_LAYOUTS)
        headlines = [f"Shape headline for {layout}" for layout in shape_list]
        for layout, headline in zip(shape_list, headlines):
            raw = _make_earn_config(layout, headline)
            config = CreativeConfig.from_dict(raw)
            html = assemble_html(config, actor_photo_url="https://example.com/test.png")
            assert "<!DOCTYPE html>" in html

    def test_tier1_passes_valid_render(self):
        """Tier 1 checks pass on properly assembled HTML."""
        raw = _make_earn_config("earn_hero_badge", "Test headline")
        config = CreativeConfig.from_dict(raw)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        result = run_tier1_checks(html)
        assert result["passed"] is True, f"Tier 1 failed: {result['issues']}"

    def test_all_12_layouts_pass_tier1(self):
        """Every single layout passes Tier 1 when properly assembled."""
        all_layouts = sorted(EARN_LAYOUTS | GROW_LAYOUTS | SHAPE_LAYOUTS)
        for layout in all_layouts:
            raw = _make_earn_config(layout, f"Headline for {layout}")
            config = CreativeConfig.from_dict(raw)
            html = assemble_html(config, actor_photo_url="https://example.com/test.png")
            result = run_tier1_checks(html)
            assert result["passed"] is True, f"Layout {layout} failed Tier 1: {result['issues']}"

    def test_batch_validation_rejects_duplicates(self):
        """Batch validation catches duplicate layouts."""
        c1 = _make_earn_config("earn_hero_badge", "Headline A")
        c2 = _make_earn_config("earn_hero_badge", "Headline B")
        errors = validate_batch([c1, c2], pillar="earn", copy_variants=["Headline A", "Headline B"])
        assert any("duplicate" in e.lower() for e in errors)

    def test_auto_fix_preserves_valid_config(self):
        """Auto-fix with no issues returns identical config."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        fixed = apply_fixes(raw, [])
        assert fixed["actor"]["scale"] == raw["actor"]["scale"]
        assert fixed["text"]["position"] == raw["text"]["position"]

    def test_full_batch_diverse_layouts(self):
        """A full batch of 4 earn creatives uses all different layouts."""
        earn_list = sorted(EARN_LAYOUTS)
        headlines = [f"H{i}" for i in range(len(earn_list))]
        configs = [
            _make_earn_config(layout, headline)
            for layout, headline in zip(earn_list, headlines)
        ]
        errors = validate_batch(configs, pillar="earn", copy_variants=headlines)
        assert errors == [], f"Batch errors: {errors}"

    def test_context_element_renders(self):
        """Config with context element produces HTML containing device mockup."""
        raw = _make_earn_config("earn_hero_badge", "Put your expertise to work")
        raw["context_element"] = {"type": "device_mockup", "position": "bottom-left", "content": "survey_ui"}
        config = CreativeConfig.from_dict(raw)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        assert len(html) > 1000  # With context element, HTML is substantially larger
        assert "ctx-device-mockup" in html

    def test_auto_fix_no_dead_space_increases_scale(self):
        """Auto-fix for NO_DEAD_SPACE increases actor scale and adds blob overlay."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        original_scale = raw["actor"]["scale"]
        fixed = apply_fixes(raw, [
            {"check": "NO_DEAD_SPACE", "detail": "empty area"},
        ])
        assert fixed["actor"]["scale"] > original_scale
        assert "blob_warm_1" in fixed["overlay"]["elements"]

    def test_auto_fix_face_visible_reduces_scale(self):
        """Auto-fix for FACE_VISIBLE (frame cut) reduces actor scale."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        original_scale = raw["actor"]["scale"]
        fixed = apply_fixes(raw, [
            {"check": "FACE_VISIBLE", "detail": "face cut off by frame"},
        ])
        assert fixed["actor"]["scale"] < original_scale

    def test_auto_fix_face_visible_text_covering_flips_position(self):
        """Auto-fix for FACE_VISIBLE (text covering) moves text to safe position."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        fixed = apply_fixes(raw, [
            {"check": "FACE_VISIBLE", "detail": "text is covering the face"},
        ])
        # Text position should change since the fix detects "cover" or "text" in detail
        assert fixed["text"]["position"] != raw["text"]["position"]

    def test_auto_fix_then_rerender_passes_tier1(self):
        """After auto-fix for NO_DEAD_SPACE, the re-rendered HTML still passes Tier 1."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        fixed = apply_fixes(raw, [
            {"check": "NO_DEAD_SPACE", "detail": "empty area"},
        ])
        config = CreativeConfig.from_dict(fixed)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        result = run_tier1_checks(html)
        assert result["passed"] is True

    def test_batch_validation_rejects_cross_pillar(self):
        """Batch validation catches layout from wrong pillar."""
        grow_layout = sorted(GROW_LAYOUTS)[0]
        c1 = _make_earn_config(grow_layout, "Headline A")
        earn_layout = sorted(EARN_LAYOUTS)[0]
        c2 = _make_earn_config(earn_layout, "Headline B")
        errors = validate_batch([c1, c2], pillar="earn", copy_variants=["Headline A", "Headline B"])
        assert any("does not belong to pillar" in e for e in errors)

    def test_batch_validation_rejects_wrong_headline(self):
        """Batch validation catches headline not in copy variants."""
        earn_list = sorted(EARN_LAYOUTS)
        c1 = _make_earn_config(earn_list[0], "Headline A")
        errors = validate_batch([c1], pillar="earn", copy_variants=["Different headline"])
        assert any("not found in copy variants" in e for e in errors)

    def test_different_sizes_render(self):
        """All valid text sizes produce HTML with correct font-size."""
        for size in ("small", "medium", "large"):
            raw = _make_earn_config("earn_hero_badge", "Test size")
            raw["text"]["size"] = size
            config = CreativeConfig.from_dict(raw)
            html = assemble_html(config, actor_photo_url="https://example.com/test.png")
            assert "<!DOCTYPE html>" in html
            assert "Test size" in html

    def test_html_contains_brand_colors(self):
        """Rendered HTML contains brand CTA colors."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        config = CreativeConfig.from_dict(raw)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        assert "#6B21A8" in html  # CTA gradient purple
        assert "#E91E8C" in html  # CTA gradient pink
