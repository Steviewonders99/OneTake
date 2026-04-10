"""Tests for composition archetype selection logic."""

import pytest
from pipeline.archetype_selector import select_archetype


def test_shape_pillar_always_photo_feature():
    assert select_archetype("shape", {}, "ig_feed") == "photo_feature"
    assert select_archetype("shape", {}, "linkedin_feed") == "photo_feature"
    assert select_archetype("shape", {}, "ig_story") == "photo_feature"


def test_story_formats_gradient_hero():
    assert select_archetype("earn", {}, "ig_story") == "gradient_hero"
    assert select_archetype("earn", {}, "tiktok_feed") == "gradient_hero"
    assert select_archetype("grow", {}, "whatsapp_story") == "gradient_hero"


def test_earn_pillar_floating_props():
    assert select_archetype("earn", {}, "ig_feed") == "floating_props"
    assert select_archetype("earn", {}, "linkedin_feed") == "floating_props"


def test_grow_pillar_floating_props():
    assert select_archetype("grow", {}, "ig_feed") == "floating_props"
    assert select_archetype("grow", {}, "facebook_feed") == "floating_props"


def test_unknown_pillar_defaults_gradient_hero():
    assert select_archetype("unknown", {}, "ig_feed") == "gradient_hero"
    assert select_archetype("", {}, "linkedin_feed") == "gradient_hero"


def test_shape_overrides_story_format():
    assert select_archetype("shape", {}, "ig_story") == "photo_feature"
    assert select_archetype("shape", {}, "tiktok_feed") == "photo_feature"


def test_wechat_moments_gradient_hero():
    assert select_archetype("earn", {}, "wechat_moments") == "gradient_hero"
