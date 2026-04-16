"""Unit tests for Stage 4 v3 pure logic functions.

Tests cover:
  - _build_composition_matrix  — actor × pillar × platform, top 2 pillars only
  - _parse_compositor_response — raw JSON, markdown-fenced JSON, brace fallback
  - _get_copy_for_pillar_platform — exact match, fuzzy match, fallback
  - _resolve_channels          — annotation stripping, platform key mapping

No API calls, no Neon, no Playwright. Pure logic only.
"""
from __future__ import annotations

import json

# Import the module under test (all pure functions)
from pipeline.stage4_compose_v3 import (
    _build_composition_matrix,
    _build_copy_lookup,
    _get_copy_for_pillar_platform,
    _get_top_pillars,
    _parse_compositor_response,
    _resolve_channels,
)

# ── _resolve_channels ─────────────────────────────────────────────────────


class TestResolveChannels:
    def test_simple_instagram(self):
        assert _resolve_channels(["instagram"]) == ["ig_feed"]

    def test_strip_annotation(self):
        result = _resolve_channels(["WhatsApp (98.3% penetração)"])
        assert result == ["whatsapp_story"]

    def test_strip_multiple_annotations(self):
        result = _resolve_channels([
            "Instagram (15.2M users)",
            "Facebook (12M reach)",
            "LinkedIn (B2B)",
        ])
        assert result == ["ig_feed", "facebook_feed", "linkedin_feed"]

    def test_deduplication(self):
        result = _resolve_channels(["instagram", "ig", "instagram feed"])
        # All three map to ig_feed — should appear only once
        assert result == ["ig_feed"]

    def test_story_format(self):
        assert _resolve_channels(["instagram stories"]) == ["ig_story"]
        assert _resolve_channels(["ig story"]) == ["ig_story"]

    def test_twitter_aliases(self):
        assert _resolve_channels(["twitter"]) == ["twitter_post"]
        assert _resolve_channels(["x"]) == ["twitter_post"]
        assert _resolve_channels(["x/twitter"]) == ["twitter_post"]

    def test_google_display(self):
        assert _resolve_channels(["google display"]) == ["google_display"]
        assert _resolve_channels(["google ads"]) == ["google_display"]

    def test_unknown_channel_slugified(self):
        # Unknown channels get slugified (spaces → underscores) rather than mapped
        result = _resolve_channels(["some new platform"])
        assert result == ["some_new_platform"]

    def test_empty_list(self):
        assert _resolve_channels([]) == []

    def test_preserves_order(self):
        result = _resolve_channels(["linkedin", "facebook", "instagram"])
        assert result == ["linkedin_feed", "facebook_feed", "ig_feed"]

    def test_case_insensitive(self):
        assert _resolve_channels(["INSTAGRAM"]) == ["ig_feed"]
        assert _resolve_channels(["LinkedIn"]) == ["linkedin_feed"]


# ── _build_composition_matrix ─────────────────────────────────────────────


class TestBuildCompositionMatrix:
    def _make_actor(self, name: str, has_photo: bool = True) -> dict:
        return {
            "id": f"actor-{name}",
            "name": name,
            "photo_url": f"https://blob.vercel.com/{name}.png" if has_photo else "",
        }

    def test_full_matrix(self):
        actors = [self._make_actor("Alice"), self._make_actor("Bob")]
        pillars = ["earn", "grow"]
        platforms = ["ig_feed", "linkedin_feed"]

        matrix = _build_composition_matrix(actors, pillars, platforms)

        # 2 actors × 2 pillars × 2 platforms = 8
        assert len(matrix) == 8

    def test_matrix_keys(self):
        actors = [self._make_actor("Alice")]
        matrix = _build_composition_matrix(actors, ["earn"], ["ig_feed"])

        assert len(matrix) == 1
        item = matrix[0]
        assert "actor" in item
        assert "pillar" in item
        assert "platform" in item

    def test_actor_without_photo_excluded(self):
        actors = [
            self._make_actor("Alice", has_photo=True),
            self._make_actor("Bob", has_photo=False),
        ]
        matrix = _build_composition_matrix(actors, ["earn"], ["ig_feed"])
        # Bob has no photo → excluded
        assert len(matrix) == 1
        assert matrix[0]["actor"]["name"] == "Alice"

    def test_top_2_pillars_only(self):
        actors = [self._make_actor("Alice")]
        # Pass 3 pillars — matrix should contain entries for all 3
        # (the "top 2" selection happens in _get_top_pillars, not here)
        matrix = _build_composition_matrix(actors, ["earn", "grow"], ["ig_feed"])
        pillars_in_matrix = {item["pillar"] for item in matrix}
        assert pillars_in_matrix == {"earn", "grow"}

    def test_empty_actors(self):
        matrix = _build_composition_matrix([], ["earn"], ["ig_feed"])
        assert matrix == []

    def test_empty_pillars(self):
        actors = [self._make_actor("Alice")]
        matrix = _build_composition_matrix(actors, [], ["ig_feed"])
        assert matrix == []

    def test_empty_platforms(self):
        actors = [self._make_actor("Alice")]
        matrix = _build_composition_matrix(actors, ["earn"], [])
        assert matrix == []

    def test_correct_actor_pillar_platform_tuples(self):
        actors = [self._make_actor("Alice")]
        matrix = _build_composition_matrix(actors, ["earn", "grow"], ["ig_feed", "ig_story"])

        tuples = [(m["actor"]["name"], m["pillar"], m["platform"]) for m in matrix]
        assert ("Alice", "earn", "ig_feed") in tuples
        assert ("Alice", "earn", "ig_story") in tuples
        assert ("Alice", "grow", "ig_feed") in tuples
        assert ("Alice", "grow", "ig_story") in tuples


# ── _parse_compositor_response ────────────────────────────────────────────


class TestParseCompositorResponse:
    def _sample_design(self) -> dict:
        return {
            "archetype": "gradient_hero",
            "artifacts_used": ["gradient_sapphire_pink"],
            "layer_manifest": [
                {"z": 0, "artifact_id": "gradient_sapphire_pink", "role": "background"},
            ],
            "html": "<div style=\"position:relative;width:1080px;height:1080px;\">content</div>",
        }

    def test_raw_json(self):
        design = self._sample_design()
        raw = json.dumps(design)
        result = _parse_compositor_response(raw)
        assert result["archetype"] == "gradient_hero"
        assert result["html"].startswith("<div")

    def test_markdown_fenced_json(self):
        design = self._sample_design()
        raw = f"```json\n{json.dumps(design)}\n```"
        result = _parse_compositor_response(raw)
        assert result["archetype"] == "gradient_hero"

    def test_markdown_fenced_no_language(self):
        design = self._sample_design()
        raw = f"```\n{json.dumps(design)}\n```"
        result = _parse_compositor_response(raw)
        assert result["archetype"] == "gradient_hero"

    def test_brace_matching_fallback(self):
        """JSON embedded in surrounding prose text."""
        design = self._sample_design()
        raw = f"Here is the design:\n{json.dumps(design)}\nLet me know if you need changes."
        result = _parse_compositor_response(raw)
        assert result["archetype"] == "gradient_hero"

    def test_empty_string(self):
        assert _parse_compositor_response("") == {}

    def test_no_json(self):
        result = _parse_compositor_response("I cannot produce a design for this input.")
        assert result == {}

    def test_malformed_json(self):
        result = _parse_compositor_response("{bad json without closing")
        assert result == {}

    def test_nested_braces_in_html(self):
        """HTML field contains nested braces — brace matcher must handle nesting."""
        design = {
            "archetype": "floating_props",
            "artifacts_used": [],
            "layer_manifest": [],
            "html": "<div style=\"{}\">inner</div>",
        }
        raw = json.dumps(design)
        result = _parse_compositor_response(raw)
        assert result["archetype"] == "floating_props"

    def test_json_with_whitespace_prefix(self):
        design = self._sample_design()
        raw = f"\n\n  \t{json.dumps(design)}"
        result = _parse_compositor_response(raw)
        assert result["archetype"] == "gradient_hero"


# ── _get_copy_for_pillar_platform ─────────────────────────────────────────


class TestGetCopyForPillarPlatform:
    def _make_copy(self, headline: str, pillar: str = "", platform: str = "global") -> dict:
        return {
            "content": {"pillar": pillar} if pillar else {},
            "copy_data": {"headline": headline, "subheadline": f"{headline} sub", "cta": "Apply"},
            "platform": platform,
            "asset_type": "copy",
        }

    def test_exact_match(self):
        assets = [
            self._make_copy("Earn Big", pillar="earn", platform="ig_feed"),
            self._make_copy("Grow Fast", pillar="grow", platform="linkedin_feed"),
        ]
        lookup = _build_copy_lookup(assets)
        result = _get_copy_for_pillar_platform(lookup, "earn", "ig_feed")
        assert result["headline"] == "Earn Big"

    def test_pillar_global_fallback(self):
        """Pillar exists but not this platform — fall back to global."""
        assets = [
            self._make_copy("Earn More", pillar="earn", platform="global"),
        ]
        lookup = _build_copy_lookup(assets)
        result = _get_copy_for_pillar_platform(lookup, "earn", "ig_story")
        assert result["headline"] == "Earn More"

    def test_any_pillar_platform_match(self):
        """No pillar match — use __any__ pillar with exact platform."""
        assets = [
            {
                "content": {},
                "copy_data": {"headline": "Generic IG", "cta": "Join"},
                "platform": "ig_feed",
                "asset_type": "copy",
            }
        ]
        lookup = _build_copy_lookup(assets)
        result = _get_copy_for_pillar_platform(lookup, "unknown_pillar", "ig_feed")
        assert result["headline"] == "Generic IG"

    def test_empty_lookup_returns_empty_dict(self):
        result = _get_copy_for_pillar_platform({}, "earn", "ig_feed")
        assert result == {}

    def test_any_pillar_global_fallback(self):
        """No pillar, no platform match — fall back to __any__ global."""
        assets = [
            {
                "content": {},
                "copy_data": {"headline": "Fallback Copy", "cta": "Start"},
                "platform": "global",
                "asset_type": "copy",
            }
        ]
        lookup = _build_copy_lookup(assets)
        result = _get_copy_for_pillar_platform(lookup, "earn", "tiktok_feed")
        assert result["headline"] == "Fallback Copy"


# ── _get_top_pillars ──────────────────────────────────────────────────────


class TestGetTopPillars:
    def test_returns_top_2(self):
        weighting = {"earn": 0.5, "grow": 0.3, "shape": 0.2}
        result = _get_top_pillars(weighting)
        assert result == ["earn", "grow"]

    def test_empty_weighting_default(self):
        result = _get_top_pillars({})
        assert result == ["earn", "grow"]

    def test_single_pillar(self):
        result = _get_top_pillars({"shape": 1.0})
        assert result == ["shape"]

    def test_order_by_weight_descending(self):
        weighting = {"shape": 0.6, "earn": 0.3, "grow": 0.1}
        result = _get_top_pillars(weighting)
        assert result[0] == "shape"
        assert result[1] == "earn"

    def test_caps_at_2(self):
        weighting = {"earn": 0.4, "grow": 0.3, "shape": 0.2, "connect": 0.1}
        result = _get_top_pillars(weighting)
        assert len(result) == 2
