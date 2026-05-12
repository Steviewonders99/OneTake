"""Unit tests for the LinkedIn organic client.

All tests are pure — no network calls, no DB connections.
"""
import sys
import os

# Ensure worker/ is on the path so we can import platforms.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from platforms.linkedin_organic import (
    LinkedInOrganicClient,
    _parse_share,
    _parse_stats,
)


# ---------------------------------------------------------------------------
# _parse_share
# ---------------------------------------------------------------------------

class TestParseShare:
    def test_parse_share_full_ugc_structure(self):
        """Verify extraction from a fully-populated LinkedIn UGC post."""
        raw = {
            "id": "urn:li:ugcPost:7198123456789",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": "Exciting new opportunities in data annotation! #OneForma"
                    },
                    "shareMediaCategory": "IMAGE",
                }
            },
            "created": {
                "time": 1715169600000,  # 2024-05-08T12:00:00Z in ms
            },
        }
        result = _parse_share(raw)

        assert result["post_id"] == "urn:li:ugcPost:7198123456789"
        assert result["post_text"] == "Exciting new opportunities in data annotation! #OneForma"
        assert result["post_type"] == "image"  # lowercased
        assert result["published_at"] is not None
        assert "2024-05-08" in result["published_at"]
        assert result["post_url"] == "https://www.linkedin.com/feed/update/urn:li:ugcPost:7198123456789/"

    def test_parse_share_video_post(self):
        raw = {
            "id": "urn:li:ugcPost:9999999",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": "Watch our story!"},
                    "shareMediaCategory": "VIDEO",
                }
            },
            "created": {"time": 1714560000000},
        }
        result = _parse_share(raw)
        assert result["post_type"] == "video"

    def test_parse_share_article_post(self):
        raw = {
            "id": "urn:li:ugcPost:1111111",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": "Read our latest blog."},
                    "shareMediaCategory": "ARTICLE",
                }
            },
            "created": {"time": 1714560000000},
        }
        result = _parse_share(raw)
        assert result["post_type"] == "article"

    def test_parse_share_missing_fields_defaults_gracefully(self):
        """Empty dict should return safe defaults without raising."""
        result = _parse_share({})
        assert result["post_id"] == ""
        assert result["post_text"] == ""
        assert result["post_type"] == "post"  # fallback from empty shareMediaCategory
        assert result["published_at"] is None
        assert result["post_url"] == ""

    def test_parse_share_milliseconds_to_iso(self):
        """published_at must be an ISO 8601 string derived from epoch milliseconds."""
        raw = {
            "id": "urn:li:ugcPost:42",
            "created": {"time": 0},  # Unix epoch
        }
        result = _parse_share(raw)
        assert result["published_at"] == "1970-01-01T00:00:00+00:00"

    def test_parse_share_post_url_contains_urn(self):
        """Post URL must embed the full URN so LinkedIn can resolve it."""
        raw = {"id": "urn:li:ugcPost:55555"}
        result = _parse_share(raw)
        assert "urn:li:ugcPost:55555" in result["post_url"]


# ---------------------------------------------------------------------------
# _parse_stats
# ---------------------------------------------------------------------------

class TestParseStats:
    def test_parse_stats_all_metrics(self):
        raw = {
            "totalShareStatistics": {
                "impressionCount": 12000,
                "uniqueImpressionsCount": 9500,
                "clickCount": 430,
                "likeCount": 780,
                "commentCount": 95,
                "shareCount": 42,
                "engagement": 0.0725,
            }
        }
        result = _parse_stats(raw)
        assert result["impressions"] == 12000
        assert result["unique_impressions"] == 9500
        assert result["clicks"] == 430
        assert result["likes"] == 780
        assert result["comments"] == 95
        assert result["shares"] == 42
        assert result["engagement"] == 0.0725

    def test_parse_stats_partial_metrics(self):
        """Missing keys should default to 0, not raise."""
        raw = {
            "totalShareStatistics": {
                "impressionCount": 5000,
                "likeCount": 200,
            }
        }
        result = _parse_stats(raw)
        assert result["impressions"] == 5000
        assert result["likes"] == 200
        assert result["unique_impressions"] == 0
        assert result["clicks"] == 0
        assert result["comments"] == 0
        assert result["shares"] == 0
        assert result["engagement"] == 0

    def test_parse_stats_empty(self):
        """Empty dict must return all-zero metrics."""
        result = _parse_stats({})
        assert result["impressions"] == 0
        assert result["unique_impressions"] == 0
        assert result["clicks"] == 0
        assert result["likes"] == 0
        assert result["comments"] == 0
        assert result["shares"] == 0
        assert result["engagement"] == 0

    def test_parse_stats_none_values_treated_as_zero(self):
        """API sometimes returns null — must not propagate as None."""
        raw = {
            "totalShareStatistics": {
                "impressionCount": None,
                "clickCount": None,
            }
        }
        result = _parse_stats(raw)
        assert result["impressions"] == 0
        assert result["clicks"] == 0

    def test_parse_stats_metric_keys(self):
        """Ensure all expected metric keys are present in the output."""
        result = _parse_stats({})
        expected_keys = {
            "impressions", "unique_impressions", "clicks",
            "likes", "comments", "shares", "engagement",
        }
        assert set(result.keys()) == expected_keys


# ---------------------------------------------------------------------------
# LinkedInOrganicClient.is_connected
# ---------------------------------------------------------------------------

class TestIsConnected:
    def _make_client(self, org_id: str = "", token: str = "") -> LinkedInOrganicClient:
        # Pass a fake db — is_connected doesn't use it
        return LinkedInOrganicClient(db=None, org_id=org_id, token=token)

    def test_is_connected_false_when_both_empty(self):
        client = self._make_client(org_id="", token="")
        assert client.is_connected() is False

    def test_is_connected_false_when_org_id_missing(self):
        client = self._make_client(org_id="", token="AQV-abc123")
        assert client.is_connected() is False

    def test_is_connected_false_when_token_missing(self):
        client = self._make_client(org_id="urn:li:organization:12345", token="")
        assert client.is_connected() is False

    def test_is_connected_true_when_both_present(self):
        client = self._make_client(org_id="urn:li:organization:12345", token="AQV-abc123")
        assert client.is_connected() is True

    def test_is_connected_uses_numeric_org_id(self):
        """Numeric org IDs (without URN prefix) should also work."""
        client = self._make_client(org_id="12345678", token="AQV-abc123")
        assert client.is_connected() is True
