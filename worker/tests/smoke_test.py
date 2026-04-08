"""Centric Creative OS — Comprehensive Smoke Test Suite.

Tests EVERY layer of the system:
- Config & environment
- Database connectivity & schema
- All prompt engines (personas, cultural research, composition, etc.)
- All AI modules (LLM, VLM, seedream, compositor, deglosser, etc.)
- All evaluators (brief, image realism, script pre-gate)
- All pipeline stages
- Video pipeline components
- Content format registry
- Ethical positioning
- Platform ad specs

Run: cd worker && python3.13 tests/smoke_test.py
"""
from __future__ import annotations

import os
import sys
import time
import traceback

# Ensure the worker root is on sys.path so imports resolve.
_WORKER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKER_DIR not in sys.path:
    sys.path.insert(0, _WORKER_DIR)


# =========================================================================
# Test runner
# =========================================================================

class SmokeTestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors: list[tuple[str, str]] = []

    def run(self, name: str, fn):
        try:
            fn()
            self.passed += 1
            print(f"  \u2705 {name}")
        except Exception as e:
            self.failed += 1
            self.errors.append((name, str(e)))
            print(f"  \u274c {name}: {e}")

    def skip(self, name: str, reason: str):
        self.skipped += 1
        print(f"  \u23ed  {name}: SKIPPED ({reason})")

    def summary(self) -> bool:
        total = self.passed + self.failed
        print(f"\n{'=' * 60}")
        print(f"SMOKE TEST RESULTS: {self.passed}/{total} passed, {self.failed} failed, {self.skipped} skipped")
        if self.errors:
            print(f"\nFAILURES:")
            for name, err in self.errors:
                print(f"  \u274c {name}: {err}")
        print(f"{'=' * 60}")
        return self.failed == 0


# =========================================================================
# Category 1: Environment & Config (5 tests)
# =========================================================================

def test_config_loads():
    """All config values load from env."""
    from config import DATABASE_URL, OPENROUTER_API_KEY, MLX_SERVER_PORT, LLM_MODEL
    # These have defaults so they always load; env-dependent ones may be empty
    assert MLX_SERVER_PORT > 0, f"MLX_SERVER_PORT={MLX_SERVER_PORT}"
    assert LLM_MODEL, "LLM_MODEL is empty"


def test_config_all_keys():
    """All expected config keys exist as module-level attributes."""
    import config
    required_keys = [
        "DATABASE_URL", "OPENROUTER_API_KEY", "IMAGE_MODEL",
        "LLM_MODEL", "COPY_MODEL", "VLM_MODEL",
        "MLX_SERVER_HOST", "MLX_SERVER_PORT",
        "KLING_API_KEY", "KLING_MODEL",
        "ELEVENLABS_API_KEY", "ELEVENLABS_DEFAULT_VOICE",
        "POLL_INTERVAL_SECONDS", "APP_URL",
        "VERCEL_BLOB_TOKEN", "VERCEL_BLOB_STORE_ID",
    ]
    for key in required_keys:
        assert hasattr(config, key), f"config missing {key}"


def test_all_imports():
    """Every module in the worker imports without error."""
    # prompts
    import prompts.persona_engine
    import prompts.cultural_research
    import prompts.composition_engine
    import prompts.content_formats
    import prompts.recruitment_copy
    import prompts.recruitment_actors
    import prompts.recruitment_brief
    import prompts.ethical_positioning
    import prompts.eval_brief
    import prompts.eval_image_realism
    import prompts.eval_video_script
    import prompts.eval_registry
    import prompts.video_script
    import prompts.video_director
    # ai
    import ai.compositor
    import ai.deglosser
    import ai.graphic_compositor
    import ai.seedream
    import ai.bg_remover
    import ai.tts_engine
    import ai.local_llm
    import ai.local_vlm
    import ai.evaluator
    import ai.kling_client
    import ai.font_cache
    import ai.wav2lip
    # pipeline
    import pipeline.orchestrator
    import pipeline.stage1_intelligence
    import pipeline.stage2_images
    import pipeline.stage3_copy
    import pipeline.stage4_compose
    import pipeline.stage_video
    # top-level
    import neon_client
    import blob_uploader
    import teams_notify
    import mlx_server_manager


def test_neon_connection():
    """Database is reachable and has expected tables (requires DATABASE_URL)."""
    import asyncio
    from config import DATABASE_URL
    if not DATABASE_URL:
        raise AssertionError("DATABASE_URL not set -- cannot test DB connectivity")

    async def _check():
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            rows = await conn.fetch(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            )
            table_names = [r["tablename"] for r in rows]
            assert len(table_names) >= 10, (
                f"Expected >= 10 tables, found {len(table_names)}: {table_names}"
            )
        finally:
            await conn.close()

    asyncio.run(_check())


def test_neon_seed_data():
    """Seed data is present: schemas, languages, regions (requires DATABASE_URL)."""
    import asyncio
    from config import DATABASE_URL
    if not DATABASE_URL:
        raise AssertionError("DATABASE_URL not set -- cannot test seed data")

    async def _check():
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            schemas = await conn.fetchval("SELECT count(*) FROM task_type_schemas")
            assert schemas >= 5, f"Expected >= 5 task_type_schemas, got {schemas}"

            languages = await conn.fetchval(
                "SELECT count(*) FROM option_registries WHERE registry_name = 'languages_registry'"
            )
            assert languages >= 30, f"Expected >= 30 languages, got {languages}"

            regions = await conn.fetchval(
                "SELECT count(*) FROM option_registries WHERE registry_name = 'regions_registry'"
            )
            assert regions >= 20, f"Expected >= 20 regions, got {regions}"
        finally:
            await conn.close()

    asyncio.run(_check())


def test_openrouter_reachable():
    """OpenRouter API responds (lightweight ping, don't burn tokens)."""
    import httpx
    from config import OPENROUTER_API_KEY
    if not OPENROUTER_API_KEY:
        raise AssertionError("OPENROUTER_API_KEY not set -- cannot test connectivity")

    resp = httpx.get(
        "https://openrouter.ai/api/v1/models",
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        timeout=10,
    )
    assert resp.status_code == 200, f"OpenRouter returned {resp.status_code}"
    data = resp.json()
    assert "data" in data, "OpenRouter response missing 'data' key"


# =========================================================================
# Category 2: Persona Engine
# Task 18/19: deleted 8 hardcoded archetypes + rewrote persona_engine.py as
# a pure prompt builder (PERSONA_SYSTEM_PROMPT + build_persona_prompt).
# Task 22 will add replacement tests for the new prompt builder.
# =========================================================================

def test_persona_engine_prompt_builder_exports():
    """persona_engine exposes PERSONA_SYSTEM_PROMPT + build_persona_prompt."""
    from prompts.persona_engine import PERSONA_SYSTEM_PROMPT, build_persona_prompt
    assert isinstance(PERSONA_SYSTEM_PROMPT, str) and len(PERSONA_SYSTEM_PROMPT) > 100
    assert callable(build_persona_prompt)


def test_build_persona_prompt_threads_constraints():
    """build_persona_prompt echoes persona_constraints into the prompt string."""
    from prompts.persona_engine import build_persona_prompt
    prompt = build_persona_prompt(
        request={
            "title": "Dermatology image review",
            "task_type": "image_annotation",
            "target_regions": ["US"],
            "target_languages": ["en"],
        },
        cultural_research={"ai_fatigue": {"level": "low"}},
        persona_constraints={
            "minimum_credentials": "MD/DO with dermatology training",
            "acceptable_tiers": [
                "Board-certified dermatologist",
                "Dermatology resident at US teaching hospital",
            ],
            "age_range_hint": "28-55",
            "excluded_archetypes": ["generic gig worker", "pre-med undergraduate"],
        },
    )
    assert "MD/DO with dermatology training" in prompt
    assert "Board-certified dermatologist" in prompt
    assert "generic gig worker" in prompt
    assert "28-55" in prompt
    assert "3 distinct personas" in prompt


# =========================================================================
# Category 3: Cultural Research (6 tests)
# =========================================================================

def test_research_dimensions_complete():
    """All 9 research dimensions are defined."""
    from prompts.cultural_research import RESEARCH_DIMENSIONS
    assert len(RESEARCH_DIMENSIONS) >= 9, (
        f"Expected >= 9 dimensions, got {len(RESEARCH_DIMENSIONS)}: {list(RESEARCH_DIMENSIONS.keys())}"
    )


def test_regional_platform_priors():
    """12+ regional platform priors exist with correct structure."""
    from prompts.cultural_research import REGIONAL_PLATFORM_PRIORS, get_platform_priors
    assert len(REGIONAL_PLATFORM_PRIORS) >= 12, (
        f"Expected >= 12 regional priors, got {len(REGIONAL_PLATFORM_PRIORS)}"
    )
    # Check structure of a known entry
    us = get_platform_priors("US")
    assert "facebook" in us
    assert "dominant_age" in us["facebook"]
    assert "youth_usage" in us["facebook"]


def test_channels_for_age():
    """get_channels_for_age returns different results for different ages/regions."""
    from prompts.cultural_research import get_channels_for_age
    us_22 = get_channels_for_age("US", 22)
    us_50 = get_channels_for_age("US", 50)
    assert isinstance(us_22, list) and len(us_22) > 0, "No channels for US age 22"
    assert isinstance(us_50, list) and len(us_50) > 0, "No channels for US age 50"
    assert us_22 != us_50, f"Same channels for 22 and 50 in US: {us_22}"


def test_china_blocks_western_platforms():
    """China priors show Facebook/Instagram/LinkedIn as blocked."""
    from prompts.cultural_research import get_platform_priors
    cn = get_platform_priors("CN")
    assert cn["facebook"]["youth_usage"] == "blocked", (
        f"Expected facebook blocked in CN, got {cn['facebook']['youth_usage']}"
    )
    assert cn["instagram"]["youth_usage"] == "blocked", (
        f"Expected instagram blocked in CN, got {cn['instagram']['youth_usage']}"
    )
    assert cn["linkedin"]["youth_usage"] == "blocked", (
        f"Expected linkedin blocked in CN, got {cn['linkedin']['youth_usage']}"
    )


def test_validation_against_priors():
    """validate_research_against_priors catches discrepancies."""
    from prompts.cultural_research import validate_research_against_priors
    # Feed it empty research — should produce warnings for platforms with high usage
    result = validate_research_against_priors("US", {})
    assert isinstance(result, dict)
    assert "confirmed" in result or "warnings" in result or "summary" in result


def test_apply_research_to_personas():
    """Cultural research enriches dynamic personas with real data."""
    from prompts.cultural_research import apply_research_to_personas

    # Use a minimal synthetic dynamic persona dict (no archetype lookups).
    personas = [
        {
            "name": "Ana",
            "archetype": "Board-certified dermatologist",
            "matched_tier": "Board-certified dermatologist",
            "age_range": "35-45",
            "best_channels": ["linkedin"],
            "psychology_profile": {"primary_bias": "authority"},
        }
    ]
    # Empty research should return personas unchanged
    result = apply_research_to_personas(personas, {})
    assert len(result) == len(personas)


# =========================================================================
# Category 4: Composition Engine (5 tests)
# =========================================================================

def test_all_11_compositions_defined():
    """11 composition techniques exist."""
    from prompts.composition_engine import COMPOSITIONS
    assert len(COMPOSITIONS) == 11, f"Expected 11 compositions, got {len(COMPOSITIONS)}"


def test_all_12_intents_mapped():
    """12 content intents map to compositions."""
    from prompts.composition_engine import INTENT_COMPOSITIONS
    assert len(INTENT_COMPOSITIONS) >= 12, (
        f"Expected >= 12 intents, got {len(INTENT_COMPOSITIONS)}"
    )


def test_composition_never_repeats_in_set():
    """4 images for same actor get 4 different compositions."""
    from prompts.composition_engine import select_composition
    used = []
    for i in range(4):
        comp = select_composition("at_home_working", actor_index=i, used_compositions=used)
        assert comp["composition_key"] not in used, (
            f"Composition {comp['composition_key']} repeated at image {i}. Used: {used}"
        )
        used.append(comp["composition_key"])


def test_8_angle_variations():
    """8 camera angle variations available."""
    from prompts.composition_engine import ANGLE_VARIATIONS
    assert len(ANGLE_VARIATIONS) == 8, f"Expected 8 angles, got {len(ANGLE_VARIATIONS)}"


def test_composition_block_output():
    """build_composition_block returns formatted string + key."""
    from prompts.composition_engine import build_composition_block
    block, key = build_composition_block("at_home_working")
    assert "COMPOSITION TECHNIQUE" in block, "Block missing 'COMPOSITION TECHNIQUE'"
    assert key, "Composition key is empty"
    assert isinstance(block, str)
    assert isinstance(key, str)


# =========================================================================
# Category 5: Content Formats (5 tests)
# =========================================================================

def test_10_platforms_33_formats():
    """10 platforms with 33 total formats."""
    from prompts.content_formats import PLATFORM_FORMATS
    assert len(PLATFORM_FORMATS) >= 10, (
        f"Expected >= 10 platforms, got {len(PLATFORM_FORMATS)}: {list(PLATFORM_FORMATS.keys())}"
    )
    total = sum(len(f) for f in PLATFORM_FORMATS.values())
    assert total >= 33, f"Expected >= 33 total formats, got {total}"


def test_every_format_has_required_fields():
    """Each format has engages_best and creative_approach."""
    from prompts.content_formats import PLATFORM_FORMATS
    for platform, formats in PLATFORM_FORMATS.items():
        for fmt_key, fmt in formats.items():
            assert "engages_best" in fmt, f"{platform}/{fmt_key} missing engages_best"
            assert "creative_approach" in fmt, f"{platform}/{fmt_key} missing creative_approach"


def test_format_matrix_generation():
    """build_format_matrix produces results for 3 dynamic personas."""
    from prompts.content_formats import build_format_matrix
    personas = [
        {"matched_tier": "Board-certified dermatologist", "best_channels": ["instagram", "tiktok"]},
        {"matched_tier": "Freelance linguist with graduate degree", "best_channels": ["linkedin", "twitter"]},
        {"matched_tier": "Primary caregiver with evenings free", "best_channels": ["facebook", "pinterest"]},
    ]
    matrix = build_format_matrix(personas, ["facebook", "instagram"])
    assert len(matrix) == 3, f"Expected 3 personas in matrix, got {len(matrix)}"


def test_wechat_formats_exist():
    """WeChat has at least 3 formats (moments, article, mini program)."""
    from prompts.content_formats import PLATFORM_FORMATS
    assert "wechat" in PLATFORM_FORMATS, "Missing wechat platform"
    wechat = PLATFORM_FORMATS["wechat"]
    assert len(wechat) >= 3, f"Expected >= 3 WeChat formats, got {len(wechat)}"
    expected = ["moments_ad", "official_account_article", "mini_program_ad"]
    for fmt in expected:
        assert fmt in wechat, f"WeChat missing format: {fmt}"


def test_reddit_formats_exist():
    """Reddit has formats including organic post."""
    from prompts.content_formats import PLATFORM_FORMATS
    assert "reddit" in PLATFORM_FORMATS, "Missing reddit platform"
    reddit = PLATFORM_FORMATS["reddit"]
    assert "organic_post" in reddit, "Reddit missing organic_post format"
    assert len(reddit) >= 3, f"Expected >= 3 Reddit formats, got {len(reddit)}"


# =========================================================================
# Category 6: Platform Ad Specs (5 tests)
# =========================================================================

def test_8_platform_ad_specs():
    """8 platform ad specs with real field names."""
    from prompts.recruitment_copy import PLATFORM_AD_SPECS
    assert len(PLATFORM_AD_SPECS) >= 8, (
        f"Expected >= 8 platform specs, got {len(PLATFORM_AD_SPECS)}: {list(PLATFORM_AD_SPECS.keys())}"
    )


def test_meta_has_correct_fields():
    """Meta/Facebook has primary_text, headline, description, cta_button."""
    from prompts.recruitment_copy import PLATFORM_AD_SPECS
    meta = PLATFORM_AD_SPECS["facebook_feed"]
    assert "primary_text" in meta["fields"], "facebook_feed missing primary_text"
    assert "headline" in meta["fields"], "facebook_feed missing headline"
    assert "description" in meta["fields"], "facebook_feed missing description"
    assert "cta_button" in meta["fields"], "facebook_feed missing cta_button"


def test_linkedin_has_correct_fields():
    """LinkedIn has introductory_text, headline, description."""
    from prompts.recruitment_copy import PLATFORM_AD_SPECS
    li = PLATFORM_AD_SPECS["linkedin_feed"]
    assert "introductory_text" in li["fields"], "linkedin_feed missing introductory_text"
    assert "headline" in li["fields"], "linkedin_feed missing headline"
    assert "description" in li["fields"], "linkedin_feed missing description"


def test_char_limits_are_realistic():
    """Character limits match real platform specs."""
    from prompts.recruitment_copy import PLATFORM_AD_SPECS
    meta = PLATFORM_AD_SPECS["facebook_feed"]
    assert meta["char_limits"]["headline"]["recommended"] <= 40, (
        f"Facebook headline recommended limit {meta['char_limits']['headline']['recommended']} > 40"
    )
    assert meta["char_limits"]["primary_text"]["max"] <= 2500, (
        f"Facebook primary_text max {meta['char_limits']['primary_text']['max']} > 2500"
    )


def test_marketing_psychology_hooks():
    """6 psychology hooks with platform mappings."""
    from prompts.recruitment_copy import MARKETING_PSYCHOLOGY
    assert len(MARKETING_PSYCHOLOGY) >= 6, (
        f"Expected >= 6 psychology hooks, got {len(MARKETING_PSYCHOLOGY)}"
    )
    for hook_name, hook in MARKETING_PSYCHOLOGY.items():
        assert "description" in hook, f"{hook_name} missing description"
        assert "templates" in hook, f"{hook_name} missing templates"
        assert "best_for" in hook, f"{hook_name} missing best_for"
        assert len(hook["templates"]) >= 2, f"{hook_name} has fewer than 2 templates"


# =========================================================================
# Category 7: Ethical Positioning (5 tests)
# =========================================================================

def test_6_sensitivity_categories():
    """6 sensitivity categories defined."""
    from prompts.ethical_positioning import SENSITIVITY_CATEGORIES
    assert len(SENSITIVITY_CATEGORIES) >= 6, (
        f"Expected >= 6 sensitivity categories, got {len(SENSITIVITY_CATEGORIES)}"
    )


def test_detect_children_sensitivity():
    """'children' in title triggers children_data category."""
    from prompts.ethical_positioning import detect_sensitivity
    result = detect_sensitivity({"title": "Voice data collection for children safety"})
    categories = [c["category"] for c in result]
    assert "children_data" in categories, (
        f"Expected children_data in {categories}"
    )


def test_detect_medical_sensitivity():
    """'medical' triggers medical_data category."""
    from prompts.ethical_positioning import detect_sensitivity
    result = detect_sensitivity({"title": "Medical image annotation for diagnostics"})
    categories = [c["category"] for c in result]
    assert "medical_data" in categories, (
        f"Expected medical_data in {categories}"
    )


def test_ethical_framing_replaces_bad_phrases():
    """apply_ethical_framing replaces avoid-phrases with use-instead."""
    from prompts.ethical_positioning import apply_ethical_framing, detect_sensitivity
    categories = detect_sensitivity({"title": "children safety annotation"})
    copy = {"headline": "Help us with labeling children data for AI safety"}
    result = apply_ethical_framing(copy, categories)
    # "labeling children" is an avoid_phrase for children_data
    assert "labeling children" not in result.get("headline", "").lower(), (
        f"Bad phrase still present: {result.get('headline')}"
    )


def test_brand_personality_defined():
    """BRAND_PERSONALITY has voice, always, never rules."""
    from prompts.ethical_positioning import BRAND_PERSONALITY
    assert "voice" in BRAND_PERSONALITY, "Missing 'voice'"
    assert "always" in BRAND_PERSONALITY, "Missing 'always'"
    assert "never" in BRAND_PERSONALITY, "Missing 'never'"
    assert len(BRAND_PERSONALITY["always"]) >= 3, "Too few 'always' rules"
    assert len(BRAND_PERSONALITY["never"]) >= 3, "Too few 'never' rules"


# =========================================================================
# Category 8: Evaluators (10 tests)
# =========================================================================

def test_brief_evaluator_8_dimensions():
    """Brief evaluator has 8 dimensions summing to weight 1.0."""
    from prompts.eval_brief import BRIEF_EVAL_DIMENSIONS
    assert len(BRIEF_EVAL_DIMENSIONS) == 8, (
        f"Expected 8 brief dimensions, got {len(BRIEF_EVAL_DIMENSIONS)}"
    )
    total = sum(d["weight"] for d in BRIEF_EVAL_DIMENSIONS.values())
    assert abs(total - 1.0) < 0.01, f"Brief weights sum to {total}, not 1.0"


def test_image_evaluator_10_dimensions():
    """Image evaluator has 10 dimensions summing to weight 1.0."""
    from prompts.eval_image_realism import IMAGE_REALISM_DIMENSIONS
    assert len(IMAGE_REALISM_DIMENSIONS) == 10, (
        f"Expected 10 image dimensions, got {len(IMAGE_REALISM_DIMENSIONS)}"
    )
    total = sum(d["weight"] for d in IMAGE_REALISM_DIMENSIONS.values())
    assert abs(total - 1.0) < 0.01, f"Image weights sum to {total}, not 1.0"


def test_image_evaluator_auto_reject_triggers():
    """80+ auto-reject triggers across all image dimensions."""
    from prompts.eval_image_realism import IMAGE_REALISM_DIMENSIONS
    total = sum(
        len(d.get("auto_reject_triggers", []))
        for d in IMAGE_REALISM_DIMENSIONS.values()
    )
    assert total >= 80, f"Expected >= 80 auto-reject triggers, got {total}"


def test_script_evaluator_8_dimensions():
    """Script evaluator has 8 dimensions."""
    from prompts.eval_video_script import SCRIPT_EVAL_DIMENSIONS
    assert len(SCRIPT_EVAL_DIMENSIONS) == 8, (
        f"Expected 8 script dimensions, got {len(SCRIPT_EVAL_DIMENSIONS)}"
    )


def test_brief_scoring_accept():
    """Perfect scores produce 'accept' verdict."""
    from prompts.eval_brief import score_brief, BRIEF_EVAL_DIMENSIONS
    perfect = {
        "dimensions": {
            k: {"score": 10, "feedback": "Perfect"}
            for k in BRIEF_EVAL_DIMENSIONS
        },
        "improvement_suggestions": [],
        "evaluator_notes": "Excellent",
    }
    result = score_brief(perfect)
    assert result["verdict"] == "accept", f"Expected 'accept', got '{result['verdict']}'"
    assert result["weighted_score"] == 10.0, f"Expected 10.0, got {result['weighted_score']}"


def test_brief_scoring_reject():
    """Low scores produce 'reject' verdict."""
    from prompts.eval_brief import score_brief, BRIEF_EVAL_DIMENSIONS
    terrible = {
        "dimensions": {
            k: {"score": 2, "feedback": "Terrible"}
            for k in BRIEF_EVAL_DIMENSIONS
        },
        "improvement_suggestions": ["Fix everything"],
        "evaluator_notes": "Unacceptable",
    }
    result = score_brief(terrible)
    assert result["verdict"] == "reject", f"Expected 'reject', got '{result['verdict']}'"


def test_image_auto_reject_on_extra_fingers():
    """'extra fingers' trigger forces dimension to 0 and rejects."""
    from prompts.eval_image_realism import score_image_realism, IMAGE_REALISM_DIMENSIONS
    # Build eval response where anatomical_correctness has auto_reject_triggered
    eval_resp = {
        "dimensions": {
            k: {"score": 9, "feedback": "Good", "auto_reject_triggered": False}
            for k in IMAGE_REALISM_DIMENSIONS
        },
        "ai_telltales_detected": ["extra fingers on right hand"],
        "evaluator_confidence": "high",
    }
    # Trigger auto-reject on anatomical_correctness
    eval_resp["dimensions"]["anatomical_correctness"] = {
        "score": 0,
        "feedback": "Extra fingers detected",
        "auto_reject_triggered": True,
        "finger_count_left": 5,
        "finger_count_right": 6,
    }
    result = score_image_realism(eval_resp)
    anat = result["dimension_scores"]["anatomical_correctness"]
    assert anat["score"] == 0, f"Expected anatomical score 0, got {anat['score']}"
    assert result["verdict"] != "accept", f"Should not accept with extra fingers"


def test_script_unsafe_rejects():
    """Unsafe safety status produces 'reject' verdict."""
    from prompts.eval_video_script import score_script, SCRIPT_EVAL_DIMENSIONS
    eval_resp = {
        "dimensions": {
            k: {"score": 8, "feedback": "Good"}
            for k in SCRIPT_EVAL_DIMENSIONS
        },
        "safety_status": "unsafe",
        "safety_issues": ["Misleading income claims"],
        "strongest_element": "hook",
        "weakest_element": "safety",
        "rewrite_suggestions": ["Remove income guarantee"],
    }
    result = score_script(eval_resp)
    assert result["verdict"] == "reject", f"Expected 'reject', got '{result['verdict']}'"


def test_evaluator_weights_sum_to_1():
    """ALL evaluators have weights summing to 1.0."""
    from prompts.eval_brief import BRIEF_EVAL_DIMENSIONS
    from prompts.eval_image_realism import IMAGE_REALISM_DIMENSIONS
    from prompts.eval_video_script import SCRIPT_EVAL_DIMENSIONS

    for name, dims in [
        ("brief", BRIEF_EVAL_DIMENSIONS),
        ("image_realism", IMAGE_REALISM_DIMENSIONS),
        ("video_script", SCRIPT_EVAL_DIMENSIONS),
    ]:
        total = sum(d["weight"] for d in dims.values())
        assert abs(total - 1.0) < 0.01, f"{name} weights sum to {total}, not 1.0"


def test_eval_registry_has_3_evaluators():
    """Eval registry exposes brief, image_realism, video_script."""
    from prompts.eval_registry import EVALUATORS, list_evaluators
    assert "brief" in EVALUATORS, "Registry missing 'brief'"
    assert "image_realism" in EVALUATORS, "Registry missing 'image_realism'"
    assert "video_script" in EVALUATORS, "Registry missing 'video_script'"
    all_evals = list_evaluators()
    assert len(all_evals) == 3, f"Expected 3 evaluators, got {len(all_evals)}"


# =========================================================================
# Category 9: Video Pipeline (8 tests)
# =========================================================================

def test_8_video_templates():
    """8 video script templates exist."""
    from prompts.video_script import VIDEO_TEMPLATES
    assert len(VIDEO_TEMPLATES) == 8, (
        f"Expected 8 video templates, got {len(VIDEO_TEMPLATES)}: {list(VIDEO_TEMPLATES.keys())}"
    )


def test_20_camera_moves():
    """20 Kling camera moves defined."""
    from prompts.video_director import CAMERA_MOVES
    assert len(CAMERA_MOVES) >= 20, (
        f"Expected >= 20 camera moves, got {len(CAMERA_MOVES)}"
    )


def test_kling_constraints():
    """Kling constraints match documented limits."""
    from prompts.video_director import KLING_CONSTRAINTS
    assert KLING_CONSTRAINTS["max_duration_s"] == 15, (
        f"Expected max_duration_s=15, got {KLING_CONSTRAINTS['max_duration_s']}"
    )
    assert KLING_CONSTRAINTS["max_shots"] == 6, (
        f"Expected max_shots=6, got {KLING_CONSTRAINTS['max_shots']}"
    )
    assert KLING_CONSTRAINTS["lip_sync_safe_s"] == 10, (
        f"Expected lip_sync_safe_s=10, got {KLING_CONSTRAINTS['lip_sync_safe_s']}"
    )


def test_xtts_17_languages():
    """XTTS-v2 supports 17 languages."""
    from ai.tts_engine import XTTS_LANGUAGES
    assert len(XTTS_LANGUAGES) >= 17, (
        f"Expected >= 17 XTTS languages, got {len(XTTS_LANGUAGES)}: {XTTS_LANGUAGES}"
    )


def test_video_template_selection():
    """Each video template has required structure fields."""
    from prompts.video_script import VIDEO_TEMPLATES
    for tpl_key, tpl in VIDEO_TEMPLATES.items():
        assert "description" in tpl, f"Template {tpl_key} missing description"
        assert "structure" in tpl, f"Template {tpl_key} missing structure"
        assert "best_for" in tpl, f"Template {tpl_key} missing best_for"
        assert "platforms" in tpl, f"Template {tpl_key} missing platforms"
        assert "scene_blueprint" in tpl, f"Template {tpl_key} missing scene_blueprint"
        assert "duration_range" in tpl, f"Template {tpl_key} missing duration_range"


def test_script_validates_against_kling():
    """build_multishot_prompt raises ValueError on too many shots."""
    from prompts.video_director import build_multishot_prompt
    # 7 shots should exceed the 6-shot max
    scenes = [
        {"camera": "static", "action": "talking", "duration_s": 2, "label": f"shot_{i}"}
        for i in range(7)
    ]
    try:
        build_multishot_prompt(scenes, ["ref1.png"])
        assert False, "Should have raised ValueError for 7 shots"
    except ValueError as e:
        assert "max" in str(e).lower() or "6" in str(e), f"Unexpected error: {e}"


def test_character_reference_set_generates_3_angles():
    """build_character_reference_set returns front/side/back prompts."""
    from prompts.video_director import build_character_reference_set
    actor = {
        "name": "Test Actor",
        "face_lock": {
            "skin_tone_hex": "#8D5524",
            "eye_color": "dark brown",
            "hair": "short black curly",
        },
        "prompt_seed": "A 24-year-old person with short black curly hair",
        "signature_accessory": "over-ear headphones",
        "outfit_variations": {"at_home_working": "gray hoodie, jeans"},
    }
    refs = build_character_reference_set(actor)
    assert len(refs) == 3, f"Expected 3 reference angles, got {len(refs)}"
    angles = [r["angle"] for r in refs]
    assert "front" in angles, f"Missing 'front' angle, got {angles}"


def test_multishot_prompt_builds():
    """build_multishot_prompt produces valid output for valid input."""
    from prompts.video_director import build_multishot_prompt
    scenes = [
        {"camera": "close_up", "action": "talking to camera", "duration_s": 3, "label": "hook"},
        {"camera": "push_in", "action": "showing phone screen", "duration_s": 4, "label": "demo"},
        {"camera": "pull_back", "action": "smiling, CTA", "duration_s": 3, "label": "cta"},
    ]
    result = build_multishot_prompt(scenes, ["ref1.png", "ref2.png"])
    assert "prompt" in result, "Missing 'prompt' in multishot output"
    assert "total_duration_s" in result, "Missing 'total_duration_s'"
    assert result["total_duration_s"] == 10, f"Expected 10s, got {result['total_duration_s']}"


# =========================================================================
# Category 10: AI Modules (6 tests)
# =========================================================================

def test_compositor_7_templates():
    """HTML/CSS compositor has 7 templates."""
    from ai.compositor import TEMPLATES
    assert len(TEMPLATES) >= 7, (
        f"Expected >= 7 compositor templates, got {len(TEMPLATES)}"
    )


def test_compositor_9_platforms():
    """Compositor supports 9 platform dimensions."""
    from ai.compositor import PLATFORM_SPECS
    assert len(PLATFORM_SPECS) >= 9, (
        f"Expected >= 9 platform specs, got {len(PLATFORM_SPECS)}: {list(PLATFORM_SPECS.keys())}"
    )


def test_deglosser_3_intensities():
    """Deglosser has light/medium/heavy intensities."""
    from ai.deglosser import degloss
    from PIL import Image
    import io
    # Create a small test image
    img = Image.new("RGB", (100, 100), (180, 150, 140))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw = buf.getvalue()
    for intensity in ["light", "medium", "heavy"]:
        result = degloss(raw, intensity=intensity, seed=42)
        assert len(result) > 0, f"Deglosser returned empty bytes for {intensity}"
        # Verify it is a valid image
        out_img = Image.open(io.BytesIO(result))
        assert out_img.size == (100, 100), f"Output size mismatch for {intensity}"


def test_graphic_compositor_popout():
    """GraphicCompositor builds layered designs."""
    from ai.graphic_compositor import GraphicCompositor
    comp = GraphicCompositor(200, 200)
    comp.add_gradient_background()
    result = comp.render()
    assert len(result) > 0, "GraphicCompositor render returned empty bytes"
    # Verify it is a valid PNG
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(result))
    assert img.size == (200, 200), f"Expected 200x200, got {img.size}"


def test_seedream_10_dimensions():
    """Seedream client has 10 dimension presets."""
    from ai.seedream import DIMENSIONS
    assert len(DIMENSIONS) >= 10, (
        f"Expected >= 10 dimension presets, got {len(DIMENSIONS)}: {list(DIMENSIONS.keys())}"
    )


def test_bg_remover_imports():
    """Background remover imports without error."""
    from ai.bg_remover import remove_background, create_cutout_with_shadow
    assert callable(remove_background)
    assert callable(create_cutout_with_shadow)


# =========================================================================
# Category 11: Actor System (5 tests)
# =========================================================================

def test_realism_anchors_count():
    """10 realism anchors defined."""
    from prompts.recruitment_actors import REALISM_ANCHORS
    assert len(REALISM_ANCHORS) == 10, (
        f"Expected 10 realism anchors, got {len(REALISM_ANCHORS)}"
    )


def test_anti_gloss_instruction():
    """Anti-gloss instruction includes subject AND background rules."""
    from prompts.recruitment_actors import ANTI_GLOSS_INSTRUCTION
    text = ANTI_GLOSS_INSTRUCTION.upper()
    assert "SUBJECT" in text or "SKIN" in ANTI_GLOSS_INSTRUCTION.upper(), (
        "Anti-gloss missing subject/skin rules"
    )
    assert "BACKGROUND" in text or "WALL" in ANTI_GLOSS_INSTRUCTION.upper(), (
        "Anti-gloss missing background/wall rules"
    )


def test_actor_prompt_returns_tuple():
    """build_image_prompt returns (prompt_string, composition_key)."""
    from prompts.recruitment_actors import build_image_prompt
    actor = {
        "name": "Test Actor",
        "face_lock": {"skin_tone_hex": "#8D5524", "eye_color": "brown", "hair": "black"},
        "prompt_seed": "A young person in a home office",
        "outfit_variations": {"at_home_working": "hoodie and jeans"},
        "signature_accessory": "headphones",
        "backdrops": ["home office with laptop"],
    }
    result = build_image_prompt(actor=actor)
    assert isinstance(result, tuple), f"Expected tuple, got {type(result)}"
    assert len(result) == 2, f"Expected 2-tuple, got {len(result)}"
    prompt_str, comp_key = result
    assert isinstance(prompt_str, str) and len(prompt_str) > 100
    assert isinstance(comp_key, str) and len(comp_key) > 0


def test_region_settings_coverage():
    """Region settings cover 8+ regions."""
    from prompts.recruitment_actors import REGION_SETTINGS
    assert len(REGION_SETTINGS) >= 8, (
        f"Expected >= 8 region settings, got {len(REGION_SETTINGS)}: {list(REGION_SETTINGS.keys())}"
    )


def test_multi_actor_scenes():
    """build_scene_prompt handles 2+ actors."""
    from prompts.recruitment_actors import build_scene_prompt
    actors = [
        {
            "name": "Actor A",
            "face_lock": {"skin_tone_hex": "#8D5524"},
            "prompt_seed": "Person A, young woman",
            "signature_accessory": "watch",
        },
        {
            "name": "Actor B",
            "face_lock": {"skin_tone_hex": "#C68642"},
            "prompt_seed": "Person B, young man",
            "signature_accessory": "earbuds",
        },
    ]
    prompt = build_scene_prompt(actors=actors, scene_type="collaboration")
    assert "PERSON 1" in prompt, "Missing PERSON 1 in scene prompt"
    assert "PERSON 2" in prompt, "Missing PERSON 2 in scene prompt"
    assert "Actor A" in prompt or "Person A" in prompt
    assert "Actor B" in prompt or "Person B" in prompt


# =========================================================================
# MAIN
# =========================================================================

if __name__ == "__main__":
    runner = SmokeTestRunner()
    start = time.time()

    print("\U0001f52c CENTRIC CREATIVE OS \u2014 SMOKE TEST SUITE")
    print(f"{'=' * 60}\n")

    # ------------------------------------------------------------------
    print("\U0001f4cb Category 1: Environment & Config")
    runner.run("config_loads", test_config_loads)
    runner.run("config_all_keys", test_config_all_keys)
    runner.run("all_imports", test_all_imports)

    from config import DATABASE_URL, OPENROUTER_API_KEY
    if DATABASE_URL:
        runner.run("neon_connection", test_neon_connection)
        runner.run("neon_seed_data", test_neon_seed_data)
    else:
        runner.skip("neon_connection", "DATABASE_URL not set")
        runner.skip("neon_seed_data", "DATABASE_URL not set")

    if OPENROUTER_API_KEY:
        runner.run("openrouter_reachable", test_openrouter_reachable)
    else:
        runner.skip("openrouter_reachable", "OPENROUTER_API_KEY not set")

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 2: Persona Engine")
    runner.run("persona_engine_prompt_builder_exports", test_persona_engine_prompt_builder_exports)
    runner.run("build_persona_prompt_threads_constraints", test_build_persona_prompt_threads_constraints)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 3: Cultural Research")
    runner.run("research_dimensions_complete", test_research_dimensions_complete)
    runner.run("regional_platform_priors", test_regional_platform_priors)
    runner.run("channels_for_age", test_channels_for_age)
    runner.run("china_blocks_western_platforms", test_china_blocks_western_platforms)
    runner.run("validation_against_priors", test_validation_against_priors)
    runner.run("apply_research_to_personas", test_apply_research_to_personas)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 4: Composition Engine")
    runner.run("all_11_compositions_defined", test_all_11_compositions_defined)
    runner.run("all_12_intents_mapped", test_all_12_intents_mapped)
    runner.run("composition_never_repeats_in_set", test_composition_never_repeats_in_set)
    runner.run("8_angle_variations", test_8_angle_variations)
    runner.run("composition_block_output", test_composition_block_output)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 5: Content Formats")
    runner.run("10_platforms_33_formats", test_10_platforms_33_formats)
    runner.run("every_format_has_required_fields", test_every_format_has_required_fields)
    runner.run("format_matrix_generation", test_format_matrix_generation)
    runner.run("wechat_formats_exist", test_wechat_formats_exist)
    runner.run("reddit_formats_exist", test_reddit_formats_exist)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 6: Platform Ad Specs")
    runner.run("8_platform_ad_specs", test_8_platform_ad_specs)
    runner.run("meta_has_correct_fields", test_meta_has_correct_fields)
    runner.run("linkedin_has_correct_fields", test_linkedin_has_correct_fields)
    runner.run("char_limits_are_realistic", test_char_limits_are_realistic)
    runner.run("marketing_psychology_hooks", test_marketing_psychology_hooks)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 7: Ethical Positioning")
    runner.run("6_sensitivity_categories", test_6_sensitivity_categories)
    runner.run("detect_children_sensitivity", test_detect_children_sensitivity)
    runner.run("detect_medical_sensitivity", test_detect_medical_sensitivity)
    runner.run("ethical_framing_replaces_bad_phrases", test_ethical_framing_replaces_bad_phrases)
    runner.run("brand_personality_defined", test_brand_personality_defined)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 8: Evaluators")
    runner.run("brief_evaluator_8_dimensions", test_brief_evaluator_8_dimensions)
    runner.run("image_evaluator_10_dimensions", test_image_evaluator_10_dimensions)
    runner.run("image_evaluator_auto_reject_triggers", test_image_evaluator_auto_reject_triggers)
    runner.run("script_evaluator_8_dimensions", test_script_evaluator_8_dimensions)
    runner.run("brief_scoring_accept", test_brief_scoring_accept)
    runner.run("brief_scoring_reject", test_brief_scoring_reject)
    runner.run("image_auto_reject_on_extra_fingers", test_image_auto_reject_on_extra_fingers)
    runner.run("script_unsafe_rejects", test_script_unsafe_rejects)
    runner.run("evaluator_weights_sum_to_1", test_evaluator_weights_sum_to_1)
    runner.run("eval_registry_has_3_evaluators", test_eval_registry_has_3_evaluators)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 9: Video Pipeline")
    runner.run("8_video_templates", test_8_video_templates)
    runner.run("20_camera_moves", test_20_camera_moves)
    runner.run("kling_constraints", test_kling_constraints)
    runner.run("xtts_17_languages", test_xtts_17_languages)
    runner.run("video_template_selection", test_video_template_selection)
    runner.run("script_validates_against_kling", test_script_validates_against_kling)
    runner.run("character_reference_set_generates_3_angles", test_character_reference_set_generates_3_angles)
    runner.run("multishot_prompt_builds", test_multishot_prompt_builds)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 10: AI Modules")
    runner.run("compositor_7_templates", test_compositor_7_templates)
    runner.run("compositor_9_platforms", test_compositor_9_platforms)
    runner.run("deglosser_3_intensities", test_deglosser_3_intensities)
    runner.run("graphic_compositor_popout", test_graphic_compositor_popout)
    runner.run("seedream_10_dimensions", test_seedream_10_dimensions)
    runner.run("bg_remover_imports", test_bg_remover_imports)

    # ------------------------------------------------------------------
    print(f"\n\U0001f4cb Category 11: Actor System")
    runner.run("realism_anchors_count", test_realism_anchors_count)
    runner.run("anti_gloss_instruction", test_anti_gloss_instruction)
    runner.run("actor_prompt_returns_tuple", test_actor_prompt_returns_tuple)
    runner.run("region_settings_coverage", test_region_settings_coverage)
    runner.run("multi_actor_scenes", test_multi_actor_scenes)

    # ------------------------------------------------------------------
    elapsed = time.time() - start
    print(f"\n\u23f1  Completed in {elapsed:.1f}s")
    success = runner.summary()
    sys.exit(0 if success else 1)
