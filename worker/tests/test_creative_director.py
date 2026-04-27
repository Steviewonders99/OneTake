"""Tests for Creative Director LLM — prompt building + response parsing."""
import json
import pytest
from ai.creative_director import build_prompt, parse_response
from compositor.schema import EARN_LAYOUTS


MOCK_ACTORS = [
    {"actor_id": "a1", "name": "Fatima", "persona_summary": "Student, 22", "photo_url": "https://ex.com/a1.png"},
    {"actor_id": "a2", "name": "Youssef", "persona_summary": "Freelancer, 28", "photo_url": "https://ex.com/a2.png"},
    {"actor_id": "a3", "name": "Amina", "persona_summary": "Professional, 35", "photo_url": "https://ex.com/a3.png"},
]

MOCK_COPY = [
    "Earn $17.50/hr from home",
    "Flexible remote work in Morocco",
    "Join 10,000+ contributors worldwide",
    "Data tasks that fit your schedule",
]

MOCK_BRIEF = {"pillar": "earn", "task_type": "data_collection", "compensation": "$17.50/hr", "country": "Morocco"}


class TestBuildPrompt:
    def test_prompt_contains_layouts(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        for layout in EARN_LAYOUTS:
            assert layout in prompt

    def test_prompt_contains_copy_variants(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        for copy in MOCK_COPY:
            assert copy in prompt

    def test_prompt_contains_actors(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        assert "Fatima" in prompt
        assert "Youssef" in prompt

    def test_prompt_contains_rules(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        assert "different layout" in prompt.lower() or "no repeat" in prompt.lower() or "DIFFERENT" in prompt

    def test_only_earn_layouts_for_earn_pillar(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        assert "grow_editorial" not in prompt
        assert "shape_portrait_cred" not in prompt


class TestParseResponse:
    def test_valid_json_array_parses(self):
        raw = json.dumps([
            {
                "layout": "earn_hero_badge",
                "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
                "actor": {"actor_id": "a1", "position": "right", "scale": 0.85, "mask": "soft_fade"},
                "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
                "text": {"headline": "Earn $17.50/hr from home", "subheadline": "Morocco", "position": "top-left", "size": "large", "contrast_backdrop": "dark_gradient"},
                "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
                "context_element": None,
            }
        ])
        configs = parse_response(raw)
        assert len(configs) == 1
        assert configs[0]["layout"] == "earn_hero_badge"

    def test_markdown_fenced_json_parses(self):
        raw = '```json\n[{"layout": "earn_hero_badge"}]\n```'
        configs = parse_response(raw)
        assert len(configs) == 1

    def test_invalid_json_returns_empty(self):
        configs = parse_response("this is not json at all")
        assert configs == []

    def test_single_dict_wrapped_in_list(self):
        raw = json.dumps({"layout": "earn_hero_badge"})
        configs = parse_response(raw)
        assert len(configs) == 1
        assert isinstance(configs, list)
