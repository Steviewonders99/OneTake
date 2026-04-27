"""Tests for creative config schema validation."""
import pytest
from compositor.schema import (
    CreativeConfig,
    validate_batch,
    EARN_LAYOUTS,
    GROW_LAYOUTS,
    SHAPE_LAYOUTS,
    VALID_POSITIONS,
    VALID_MASKS,
    VALID_TEXT_SIZES,
    VALID_CTA_STYLES,
)


def _make_config(**overrides):
    """Factory for valid CreativeConfig dicts."""
    base = {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "abc-123", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": "Earn $17.50/hr from home",
            "subheadline": "Data collection tasks in Morocco",
            "position": "top-left",
            "size": "large",
            "contrast_backdrop": "dark_gradient",
        },
        "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }
    base.update(overrides)
    return base


class TestCreativeConfig:
    def test_valid_config_parses(self):
        config = CreativeConfig.from_dict(_make_config())
        assert config.layout == "earn_hero_badge"
        assert config.actor.position == "right"
        assert config.text.headline == "Earn $17.50/hr from home"

    def test_invalid_layout_raises(self):
        with pytest.raises(ValueError, match="layout"):
            CreativeConfig.from_dict(_make_config(layout="nonexistent_layout"))

    def test_invalid_position_raises(self):
        with pytest.raises(ValueError, match="position"):
            CreativeConfig.from_dict(
                _make_config(actor={"actor_id": "x", "position": "top", "scale": 0.8, "mask": "none"})
            )

    def test_scale_out_of_range_raises(self):
        with pytest.raises(ValueError, match="scale"):
            CreativeConfig.from_dict(
                _make_config(actor={"actor_id": "x", "position": "right", "scale": 1.5, "mask": "none"})
            )

    def test_invalid_mask_raises(self):
        with pytest.raises(ValueError, match="mask"):
            CreativeConfig.from_dict(
                _make_config(actor={"actor_id": "x", "position": "right", "scale": 0.8, "mask": "hexagon"})
            )

    def test_invalid_text_size_raises(self):
        with pytest.raises(ValueError, match="size"):
            d = _make_config()
            d["text"]["size"] = "tiny"
            CreativeConfig.from_dict(d)

    def test_invalid_cta_style_raises(self):
        with pytest.raises(ValueError, match="style"):
            d = _make_config()
            d["cta"]["style"] = "neon_glow"
            CreativeConfig.from_dict(d)

    def test_context_element_optional(self):
        config = CreativeConfig.from_dict(_make_config(context_element=None))
        assert config.context_element is None

    def test_context_element_parses(self):
        config = CreativeConfig.from_dict(_make_config(
            context_element={"type": "device_mockup", "position": "bottom-left", "content": "survey_ui"}
        ))
        assert config.context_element.type == "device_mockup"


class TestBatchValidation:
    def test_duplicate_layouts_rejected(self):
        configs = [_make_config(layout="earn_hero_badge")] * 2
        errors = validate_batch(configs, pillar="earn", copy_variants=["Earn $17.50/hr from home"])
        assert any("duplicate" in e.lower() for e in errors)

    def test_cross_pillar_layout_rejected(self):
        configs = [_make_config(layout="grow_editorial")]
        errors = validate_batch(configs, pillar="earn", copy_variants=["Earn $17.50/hr from home"])
        assert any("pillar" in e.lower() for e in errors)

    def test_headline_not_in_copy_variants_rejected(self):
        configs = [_make_config()]
        errors = validate_batch(configs, pillar="earn", copy_variants=["Different headline"])
        assert any("headline" in e.lower() for e in errors)

    def test_actor_text_overlap_rejected(self):
        d = _make_config()
        d["actor"]["position"] = "right"
        d["text"]["position"] = "top-right"
        errors = validate_batch([d], pillar="earn", copy_variants=["Earn $17.50/hr from home"])
        assert any("overlap" in e.lower() or "separation" in e.lower() for e in errors)

    def test_valid_batch_passes(self):
        c1 = _make_config(layout="earn_hero_badge")
        c2 = _make_config(layout="earn_split_stat")
        c2["text"]["headline"] = "Flexible remote work"
        errors = validate_batch(
            [c1, c2],
            pillar="earn",
            copy_variants=["Earn $17.50/hr from home", "Flexible remote work"],
        )
        assert errors == []
