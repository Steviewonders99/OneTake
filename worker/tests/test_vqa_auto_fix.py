"""Tests for VQA auto-fix — deterministic prop tweaks."""
import pytest
from vqa.auto_fix import apply_fixes


def _base_config():
    return {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "x", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": "Test",
            "subheadline": "Sub",
            "position": "top-left",
            "size": "large",
            "contrast_backdrop": "none",
        },
        "cta": {"text": "Apply", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }


class TestAutoFix:
    def test_face_visible_text_cover_flips_text_position(self):
        config = _base_config()
        config["text"]["position"] = "top-right"
        config["actor"]["position"] = "right"
        fixed = apply_fixes(config, [{"check": "FACE_VISIBLE", "detail": "text covers actor face"}])
        # Any position safe for actor="right" except the original "top-right"
        safe_for_right = {"top-left", "left", "bottom-left", "top-center", "bottom-center", "center"}
        assert fixed["text"]["position"] in safe_for_right
        assert fixed["text"]["position"] != "top-right"  # must have moved

    def test_face_visible_cut_off_reduces_scale(self):
        config = _base_config()
        fixed = apply_fixes(config, [{"check": "FACE_VISIBLE", "detail": "face cut off by frame"}])
        assert fixed["actor"]["scale"] < 0.85

    def test_dead_space_increases_scale(self):
        config = _base_config()
        config["actor"]["scale"] = 0.5
        fixed = apply_fixes(config, [{"check": "NO_DEAD_SPACE", "detail": "large empty area"}])
        assert fixed["actor"]["scale"] > 0.5

    def test_composition_balance_mirrors_actor(self):
        config = _base_config()
        config["actor"]["position"] = "right"
        fixed = apply_fixes(config, [{"check": "COMPOSITION_BALANCE", "detail": "all on right"}])
        assert fixed["actor"]["position"] == "left"

    def test_visual_hierarchy_bumps_size(self):
        config = _base_config()
        config["text"]["size"] = "medium"
        fixed = apply_fixes(config, [{"check": "VISUAL_HIERARCHY", "detail": "no clear reading order"}])
        assert fixed["text"]["size"] == "large"

    def test_does_not_mutate_original(self):
        config = _base_config()
        original_scale = config["actor"]["scale"]
        apply_fixes(config, [{"check": "FACE_VISIBLE", "detail": "cut off"}])
        assert config["actor"]["scale"] == original_scale

    def test_no_overlap_sets_subtle_overlay(self):
        config = _base_config()
        fixed = apply_fixes(config, [{"check": "NO_OVERLAP", "detail": "elements stacking"}])
        assert fixed["overlay"]["intensity"] == "subtle"

    def test_multiple_fixes_applied(self):
        config = _base_config()
        config["text"]["size"] = "small"
        config["actor"]["scale"] = 0.5
        fixed = apply_fixes(config, [
            {"check": "VISUAL_HIERARCHY", "detail": "no reading order"},
            {"check": "NO_DEAD_SPACE", "detail": "empty area"},
        ])
        assert fixed["text"]["size"] != "small"
        assert fixed["actor"]["scale"] > 0.5
