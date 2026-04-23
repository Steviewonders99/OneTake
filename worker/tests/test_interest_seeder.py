"""Tests for platform interest seeder — seed data integrity."""
import json
import pytest
from pathlib import Path
from platform_interests.seeder import load_seed_files, SEED_DIR


class TestSeedDataIntegrity:
    """Verify all seed JSON files are valid and well-structured."""

    def test_seed_dir_exists(self):
        assert SEED_DIR.is_dir(), f"Seed directory not found: {SEED_DIR}"

    def test_all_platforms_have_seed_files(self):
        expected = {"meta", "linkedin", "tiktok", "reddit", "snapchat", "wechat"}
        actual = {f.stem for f in SEED_DIR.glob("*.json")}
        assert expected == actual, f"Missing: {expected - actual}, Extra: {actual - expected}"

    def test_load_seed_files_returns_all_platforms(self):
        platforms = load_seed_files()
        assert len(platforms) == 6
        names = {p["platform"] for p in platforms}
        assert "meta" in names
        assert "linkedin" in names

    def test_each_file_has_valid_structure(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            assert "platform" in data, f"{f.name}: missing 'platform'"
            assert "categories" in data, f"{f.name}: missing 'categories'"
            assert isinstance(data["categories"], list), f"{f.name}: 'categories' not a list"
            assert len(data["categories"]) > 0, f"{f.name}: empty categories"

    def test_each_category_has_interests(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                assert "name" in cat, f"{f.name}: category missing 'name'"
                assert "interests" in cat, f"{f.name}/{cat['name']}: missing 'interests'"
                assert len(cat["interests"]) > 0, f"{f.name}/{cat['name']}: empty interests"

    def test_each_interest_has_required_fields(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    assert "name" in interest, f"{f.name}/{cat['name']}: interest missing 'name'"
                    assert isinstance(interest["name"], str), f"{f.name}: interest name not string"
                    assert len(interest["name"]) > 0, f"{f.name}: empty interest name"

    def test_meta_has_minimum_250_interests(self):
        with open(SEED_DIR / "meta.json") as fh:
            data = json.load(fh)
        total = sum(len(cat["interests"]) for cat in data["categories"])
        assert total >= 250, f"Meta has only {total} interests (expected 250+)"

    def test_linkedin_has_minimum_200_interests(self):
        with open(SEED_DIR / "linkedin.json") as fh:
            data = json.load(fh)
        total = sum(len(cat["interests"]) for cat in data["categories"])
        assert total >= 200, f"LinkedIn has only {total} interests (expected 200+)"

    def test_no_duplicate_interests_per_platform(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            seen = set()
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    key = f"{cat['name']}::{interest['name']}".lower()
                    assert key not in seen, f"{f.name}: duplicate interest '{interest['name']}' in '{cat['name']}'"
                    seen.add(key)

    def test_keywords_are_lists_of_strings(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    kw = interest.get("keywords", [])
                    assert isinstance(kw, list), f"{f.name}/{interest['name']}: keywords not a list"
                    for k in kw:
                        assert isinstance(k, str), f"{f.name}/{interest['name']}: keyword not string: {k}"

    def test_tier_values_are_valid(self):
        valid_tiers = {"standard", "niche", "broad"}
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    tier = interest.get("tier", "standard")
                    assert tier in valid_tiers, f"{f.name}/{interest['name']}: invalid tier '{tier}'"

    def test_total_interests_above_1000(self):
        """The full graph should have 1000+ interests across all platforms."""
        total = 0
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            total += sum(len(cat["interests"]) for cat in data["categories"])
        assert total >= 1000, f"Total interests: {total} (expected 1000+)"

    def test_wechat_has_chinese_keywords(self):
        """WeChat interests should include Chinese keyword translations."""
        with open(SEED_DIR / "wechat.json") as fh:
            data = json.load(fh)
        has_chinese = False
        for cat in data["categories"]:
            for interest in cat["interests"]:
                for kw in interest.get("keywords", []):
                    if any('\u4e00' <= c <= '\u9fff' for c in kw):
                        has_chinese = True
                        break
        assert has_chinese, "WeChat seed data should include Chinese keywords"
