"""Tests for reference-driven layer manifests and renderer."""
import json
from pathlib import Path

import pytest

from compositor.reference_renderer import render_reference_html
from compositor.reference_schema import ReferenceCreativeManifest


FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "templates"
    / "reference_layouts"
    / "oneforma_pet_frame.json"
)


def _fixture_dict():
    return json.loads(FIXTURE.read_text())


def test_fixture_parses_with_expected_layers():
    manifest = ReferenceCreativeManifest.from_dict(_fixture_dict())

    assert manifest.canvas.width == 1080
    assert manifest.canvas.height == 1080
    assert len(manifest.layers) >= 12
    assert {layer.role for layer in manifest.layers} >= {
        "base_photo",
        "rounded_frame",
        "headline_primary",
        "subheadline",
        "brand_logo",
    }


def test_renderer_outputs_editable_layered_html():
    manifest = ReferenceCreativeManifest.from_dict(_fixture_dict())
    html = render_reference_html(
        manifest,
        replacements={"base_photo": "https://example.com/replacement.png"},
    )

    assert "<!doctype html>" in html
    assert "https://example.com/replacement.png" in html
    assert 'data-role="headline_primary"' in html
    assert 'contenteditable="true"' in html
    assert "mix-blend-mode:screen" in html
    assert "OneForma" in html


def test_rejects_unknown_layer_type():
    data = _fixture_dict()
    data["layers"][0]["type"] = "freestyle_css"

    with pytest.raises(ValueError, match="layer type"):
        ReferenceCreativeManifest.from_dict(data)


def test_rejects_invalid_blend_mode():
    data = _fixture_dict()
    data["layers"][1]["blendMode"] = "made-up-mode"

    with pytest.raises(ValueError, match="blend mode"):
        ReferenceCreativeManifest.from_dict(data)
