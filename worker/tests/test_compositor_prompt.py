"""Tests for the artifact-driven compositor prompt builder."""

import pytest
from prompts.compositor_prompt import (
    build_artifact_catalog_section,
    build_compositor_prompt,
    inject_vqa_feedback,
    ARCHETYPE_CONSTRAINTS,
)


# ── Fixtures ──────────────────────────────────────────────────────

SAMPLE_CATALOG = [
    {
        "artifact_id": "blob_organic_1",
        "category": "blob",
        "description": "Large flowing organic shape",
        "blob_url": "https://blob.example.com/blob1.svg",
        "dimensions": "400x380",
        "pillar_affinity": ["earn", "grow"],
    },
    {
        "artifact_id": "gradient_sapphire_pink",
        "category": "gradient",
        "description": "Sapphire to pink gradient",
        "blob_url": "https://blob.example.com/grad.css",
        "dimensions": "CSS",
        "pillar_affinity": ["earn", "grow", "shape"],
    },
    {
        "artifact_id": "cta_pill_filled",
        "category": "cta",
        "description": "Filled pill CTA button",
        "blob_url": "https://blob.example.com/cta.html",
        "dimensions": "auto",
        "pillar_affinity": ["earn", "grow", "shape"],
    },
]

SAMPLE_INPUTS = {
    "platform": "ig_feed",
    "platform_spec": {"width": 1080, "height": 1080, "safe_margin": 60, "label": "Instagram Feed"},
    "pillar": "earn",
    "actor": {
        "name": "Carlos",
        "photo_url": "https://blob.example.com/carlos_full.png",
        "cutout_url": "https://blob.example.com/carlos_cutout.png",
        "persona_key": "remote_earner",
    },
    "copy": {
        "headline": "Earn R$60/hr from Home",
        "subheadline": "Join 50,000+ contributors worldwide",
        "cta": "Apply in 2 Minutes",
    },
    "visual_direction": {
        "work_environment": "home desk setup",
        "wardrobe": "casual t-shirt",
        "emotional_tone": "relaxed casual",
    },
}


# ── Tests ─────────────────────────────────────────────────────────

def test_build_artifact_catalog_section_contains_all_ids():
    section = build_artifact_catalog_section(SAMPLE_CATALOG)
    assert "blob_organic_1" in section
    assert "gradient_sapphire_pink" in section
    assert "cta_pill_filled" in section


def test_build_artifact_catalog_section_is_compact():
    """Catalog section should be short — table rows, not inline SVG."""
    section = build_artifact_catalog_section(SAMPLE_CATALOG)
    lines = section.strip().split("\n")
    assert len(lines) < 30


def test_build_compositor_prompt_contains_all_sections():
    prompt = build_compositor_prompt(
        catalog=SAMPLE_CATALOG,
        archetype="floating_props",
        **SAMPLE_INPUTS,
    )
    assert "senior visual designer" in prompt.lower()
    assert "artifact_id" in prompt
    assert "floating_props" in prompt.lower() or "ARCHETYPE" in prompt
    assert "ig_feed" in prompt
    assert "Earn R$60/hr" in prompt
    assert "#6B21A8" in prompt
    assert "layer_manifest" in prompt


def test_build_compositor_prompt_includes_actor_urls():
    prompt = build_compositor_prompt(
        catalog=SAMPLE_CATALOG,
        archetype="gradient_hero",
        **SAMPLE_INPUTS,
    )
    assert "carlos_full.png" in prompt
    assert "carlos_cutout.png" in prompt


def test_archetype_constraints_all_three_exist():
    assert "floating_props" in ARCHETYPE_CONSTRAINTS
    assert "gradient_hero" in ARCHETYPE_CONSTRAINTS
    assert "photo_feature" in ARCHETYPE_CONSTRAINTS


def test_archetype_constraints_have_z_layers():
    for name, constraint in ARCHETYPE_CONSTRAINTS.items():
        assert "z_layers" in constraint, f"{name} missing z_layers"
        assert len(constraint["z_layers"]) >= 5, f"{name} has too few layers"


def test_inject_vqa_feedback_appends_to_prompt():
    original = "Original prompt text"
    vqa_result = {
        "score": 0.65,
        "issues": ["Headline too small", "Missing CTA"],
        "top_3_fixes": ["Increase headline font size"],
    }
    result = inject_vqa_feedback(original, vqa_result)
    assert "Original prompt text" in result
    assert "0.65" in result
    assert "Headline too small" in result
    assert "Missing CTA" in result
    assert "Fix ONLY" in result
