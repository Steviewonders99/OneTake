"""Unit tests for the Reddit organic client.

All tests are pure — no network calls, no DB connections.
"""
import sys
import os
from unittest.mock import patch

# Ensure worker/ is on the path so we can import platforms.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from platforms.reddit_organic import (
    RedditOrganicClient,
    _parse_reddit_post,
)

# Blank out all Reddit env vars for the duration of this test module so that
# credentials present in the developer's shell never leak into is_connected() tests.
_CLEAN_ENV = {
    "REDDIT_CLIENT_ID": "",
    "REDDIT_CLIENT_SECRET": "",
    "REDDIT_USERNAME": "",
    "REDDIT_PASSWORD": "",
}


# ---------------------------------------------------------------------------
# _parse_reddit_post
# ---------------------------------------------------------------------------

class TestParseRedditPost:
    def test_parse_reddit_post_all_fields(self):
        """Verify all expected fields are extracted from a full post object."""
        data = {
            "name": "t3_abc123",
            "subreddit": "dataannotation",
            "post_hint": "self",
            "permalink": "/r/dataannotation/comments/abc123/my_post/",
            "title": "Earning with OneForma — my experience",
            "selftext": "Been doing annotation tasks for 3 months...",
            "created_utc": 1715169600.0,  # 2024-05-08T12:00:00Z
            "ups": 42,
            "score": 38,
            "num_comments": 7,
            "upvote_ratio": 0.90,
            "num_crossposts": 2,
            "total_awards_received": 1,
        }
        result = _parse_reddit_post(data)

        assert result["post_id"] == "t3_abc123"
        assert result["subreddit"] == "dataannotation"
        assert result["post_type"] == "self"
        assert result["post_url"] == "https://www.reddit.com/r/dataannotation/comments/abc123/my_post/"
        assert result["post_title"] == "Earning with OneForma — my experience"
        assert result["post_text"] == "Been doing annotation tasks for 3 months..."
        assert result["published_at"] is not None
        assert "2024-05-08" in result["published_at"]
        assert result["upvotes"] == 42
        assert result["score"] == 38
        assert result["downvotes"] == 4   # 42 - 38
        assert result["comments"] == 7
        assert result["upvote_ratio"] == 0.90
        assert result["crossposts"] == 2
        assert result["awards"] == 1

    def test_parse_reddit_post_image_hint(self):
        """post_hint field determines post_type."""
        data = {
            "name": "t3_img999",
            "post_hint": "image",
            "created_utc": 1715000000.0,
            "ups": 10,
            "score": 10,
        }
        result = _parse_reddit_post(data)
        assert result["post_type"] == "image"

    def test_parse_reddit_post_link_hint(self):
        data = {
            "name": "t3_link000",
            "post_hint": "link",
            "created_utc": 1715000000.0,
            "ups": 5,
            "score": 5,
        }
        result = _parse_reddit_post(data)
        assert result["post_type"] == "link"

    def test_parse_reddit_post_missing_fields_defaults_gracefully(self):
        """Empty dict should return safe defaults without raising."""
        result = _parse_reddit_post({})

        assert result["post_id"] == ""
        assert result["subreddit"] == ""
        assert result["post_type"] == "self"   # default
        assert result["post_url"] == ""
        assert result["post_title"] == ""
        assert result["post_text"] == ""
        assert result["published_at"] is None
        assert result["upvotes"] == 0
        assert result["downvotes"] == 0
        assert result["score"] == 0
        assert result["comments"] == 0
        assert result["upvote_ratio"] == 0.0
        assert result["crossposts"] == 0
        assert result["awards"] == 0

    def test_parse_reddit_post_permalink_prepend(self):
        """post_url must prepend https://www.reddit.com to the permalink."""
        data = {
            "name": "t3_xyz",
            "permalink": "/r/jobs/comments/xyz/title/",
            "created_utc": 1715000000.0,
            "ups": 1,
            "score": 1,
        }
        result = _parse_reddit_post(data)
        assert result["post_url"].startswith("https://www.reddit.com")
        assert result["post_url"].endswith("/r/jobs/comments/xyz/title/")

    def test_parse_reddit_post_empty_permalink(self):
        """Empty permalink should produce empty post_url, not just the base URL."""
        data = {"name": "t3_empty", "permalink": ""}
        result = _parse_reddit_post(data)
        assert result["post_url"] == ""

    def test_parse_reddit_post_downvotes_never_negative(self):
        """When score > ups (shouldn't happen but API quirks), downvotes floor at 0."""
        data = {
            "name": "t3_quirk",
            "ups": 5,
            "score": 10,  # odd edge case
        }
        result = _parse_reddit_post(data)
        assert result["downvotes"] >= 0

    def test_parse_reddit_post_created_utc_iso(self):
        """created_utc must be converted to a valid ISO 8601 string."""
        data = {
            "name": "t3_ts",
            "created_utc": 0.0,  # Unix epoch
            "ups": 0,
            "score": 0,
        }
        result = _parse_reddit_post(data)
        assert result["published_at"] == "1970-01-01T00:00:00+00:00"

    def test_parse_reddit_post_none_numeric_fields_safe(self):
        """None values for numeric fields should not raise — default to 0."""
        data = {
            "name": "t3_nones",
            "ups": None,
            "score": None,
            "num_comments": None,
            "upvote_ratio": None,
            "num_crossposts": None,
            "total_awards_received": None,
            "created_utc": 1715000000.0,
        }
        result = _parse_reddit_post(data)
        assert result["upvotes"] == 0
        assert result["score"] == 0
        assert result["comments"] == 0
        assert result["upvote_ratio"] == 0.0
        assert result["crossposts"] == 0
        assert result["awards"] == 0


# ---------------------------------------------------------------------------
# RedditOrganicClient.is_connected
# ---------------------------------------------------------------------------

class TestIsConnected:
    def _make_client(
        self,
        client_id: str = "",
        client_secret: str = "",
        username: str = "",
        password: str = "",
    ) -> RedditOrganicClient:
        # Always override env vars so shell credentials never pollute these tests.
        with patch.dict(os.environ, _CLEAN_ENV, clear=False):
            return RedditOrganicClient(
                db=None,
                client_id=client_id,
                client_secret=client_secret,
                username=username,
                password=password,
            )

    def test_is_connected_false_when_all_empty(self):
        client = self._make_client()
        assert client.is_connected() is False

    def test_is_connected_false_missing_client_id(self):
        client = self._make_client(
            client_secret="secret", username="user", password="pass"
        )
        assert client.is_connected() is False

    def test_is_connected_false_missing_client_secret(self):
        client = self._make_client(
            client_id="id", username="user", password="pass"
        )
        assert client.is_connected() is False

    def test_is_connected_false_missing_username(self):
        client = self._make_client(
            client_id="id", client_secret="secret", password="pass"
        )
        assert client.is_connected() is False

    def test_is_connected_false_missing_password(self):
        client = self._make_client(
            client_id="id", client_secret="secret", username="user"
        )
        assert client.is_connected() is False

    def test_is_connected_true_all_present(self):
        client = self._make_client(
            client_id="id123",
            client_secret="secret456",
            username="oneforma_bot",
            password="hunter2",
        )
        assert client.is_connected() is True
