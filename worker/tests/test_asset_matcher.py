"""Unit tests for asset_matcher pure functions.

All tests are pure — no network calls, no DB connections.
"""
import sys
import os

# Ensure worker/ is on the path so we can import platforms.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from platforms.asset_matcher import (
    _extract_tracked_slug,
    _extract_urls,
    _text_similarity,
)


# ---------------------------------------------------------------------------
# _extract_tracked_slug
# ---------------------------------------------------------------------------

class TestExtractTrackedSlug:
    def test_utm_match_extracts_slug(self):
        """Bare domain + slug returns the slug."""
        assert _extract_tracked_slug("go.oneforma.com/r/abc123") == "abc123"

    def test_utm_match_in_full_url(self):
        """HTTPS full URL returns the slug."""
        assert _extract_tracked_slug("https://go.oneforma.com/r/xyz") == "xyz"

    def test_utm_no_match(self):
        """Unrelated URL returns None."""
        assert _extract_tracked_slug("https://example.com") is None

    def test_utm_slug_with_hyphens_and_underscores(self):
        """Slugs containing hyphens and underscores are captured fully."""
        assert _extract_tracked_slug("go.oneforma.com/r/my-cool_slug") == "my-cool_slug"

    def test_utm_match_embedded_in_sentence(self):
        """Slug extracted even when surrounded by other text."""
        text = "Apply now at https://go.oneforma.com/r/summer-2026 today!"
        assert _extract_tracked_slug(text) == "summer-2026"

    def test_utm_empty_string_returns_none(self):
        assert _extract_tracked_slug("") is None

    def test_utm_none_string_returns_none(self):
        # Guard against callers accidentally passing None
        assert _extract_tracked_slug(None) is None  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# _extract_urls
# ---------------------------------------------------------------------------

class TestExtractUrls:
    def test_url_match_extracts(self):
        """One URL in text is returned."""
        urls = _extract_urls("Check out https://oneforma.com for details.")
        assert "https://oneforma.com" in urls

    def test_url_match_multiple(self):
        """Multiple URLs all extracted."""
        text = "Visit https://oneforma.com and http://apply.oneforma.com/jobs"
        urls = _extract_urls(text)
        assert len(urls) == 2
        assert "https://oneforma.com" in urls
        assert "http://apply.oneforma.com/jobs" in urls

    def test_url_match_no_urls(self):
        """Plain text with no URLs returns empty list."""
        assert _extract_urls("No links here at all.") == []

    def test_url_match_empty_string(self):
        assert _extract_urls("") == []

    def test_url_match_none_string(self):
        assert _extract_urls(None) == []  # type: ignore[arg-type]

    def test_url_preserves_query_params(self):
        text = "https://example.com/page?utm_source=linkedin&utm_medium=social"
        urls = _extract_urls(text)
        assert len(urls) == 1
        assert "utm_source=linkedin" in urls[0]


# ---------------------------------------------------------------------------
# _text_similarity
# ---------------------------------------------------------------------------

class TestTextSimilarity:
    def test_text_similarity_identical(self):
        """Identical strings return 1.0."""
        assert _text_similarity("hello world", "hello world") == 1.0

    def test_text_similarity_high(self):
        """Near-identical strings return > 0.9."""
        a = "Join OneForma and earn money from home today!"
        b = "Join OneForma and earn money from home today"
        assert _text_similarity(a, b) > 0.9

    def test_text_similarity_low(self):
        """Completely different strings return < 0.5."""
        a = "Quantum computing advances at MIT lab"
        b = "Apply for data annotation jobs in Morocco"
        assert _text_similarity(a, b) < 0.5

    def test_text_similarity_empty_a(self):
        """Empty first string returns 0.0."""
        assert _text_similarity("", "some text") == 0.0

    def test_text_similarity_empty_b(self):
        """Empty second string returns 0.0."""
        assert _text_similarity("some text", "") == 0.0

    def test_text_similarity_empty(self):
        """Both empty strings returns 0.0."""
        assert _text_similarity("", "") == 0.0

    def test_text_similarity_none_a(self):
        """None first arg returns 0.0."""
        assert _text_similarity(None, "text") == 0.0  # type: ignore[arg-type]

    def test_text_similarity_none_b(self):
        """None second arg returns 0.0."""
        assert _text_similarity("text", None) == 0.0  # type: ignore[arg-type]

    def test_text_similarity_partial_overlap(self):
        """Partial overlap returns value between 0 and 1."""
        score = _text_similarity("OneForma data annotation", "OneForma recruiting team")
        assert 0.0 < score < 1.0
