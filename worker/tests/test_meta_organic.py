"""Unit tests for the Meta organic client.

All tests are pure — no network calls, no DB connections.
"""
import sys
import os

# Ensure worker/ is on the path so we can import platforms.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from platforms.meta_organic import (
    MetaOrganicClient,
    _calc_engagement_rate,
    _parse_insights,
    _parse_post,
)


# ---------------------------------------------------------------------------
# _parse_post
# ---------------------------------------------------------------------------

class TestParsePost:
    def test_parse_facebook_post(self):
        raw = {
            "id": "123456789",
            "message": "Join our team in Morocco!",
            "type": "status",
            "created_time": "2026-05-10T12:00:00+0000",
            "permalink_url": "https://www.facebook.com/permalink/123456789",
        }
        result = _parse_post(raw, "facebook")
        assert result["post_id"] == "123456789"
        assert result["platform"] == "facebook"
        assert result["post_text"] == "Join our team in Morocco!"
        assert result["post_url"] == "https://www.facebook.com/permalink/123456789"
        assert result["published_at"] == "2026-05-10T12:00:00+0000"
        assert result["post_type"] == "status"

    def test_parse_instagram_media(self):
        raw = {
            "id": "987654321",
            "caption": "Exciting opportunity! #OneForma",
            "media_type": "IMAGE",
            "permalink": "https://www.instagram.com/p/abcdef/",
            "timestamp": "2026-05-09T08:30:00+0000",
        }
        result = _parse_post(raw, "instagram")
        assert result["post_id"] == "987654321"
        assert result["platform"] == "instagram"
        assert result["post_text"] == "Exciting opportunity! #OneForma"
        assert result["post_url"] == "https://www.instagram.com/p/abcdef/"
        assert result["published_at"] == "2026-05-09T08:30:00+0000"
        assert result["post_type"] == "image"  # lowercased

    def test_parse_post_missing_fields_default_gracefully(self):
        raw = {"id": "111"}
        result = _parse_post(raw, "facebook")
        assert result["post_id"] == "111"
        assert result["post_text"] == ""
        assert result["post_url"] == ""
        assert result["published_at"] is None
        assert result["post_type"] == "post"  # fallback

    def test_parse_post_prefers_message_over_caption_for_fb(self):
        raw = {
            "id": "222",
            "message": "FB message",
            "caption": "IG caption",
        }
        result = _parse_post(raw, "facebook")
        assert result["post_text"] == "FB message"

    def test_parse_post_carousel_type(self):
        raw = {
            "id": "333",
            "media_type": "CAROUSEL_ALBUM",
            "timestamp": "2026-05-08T10:00:00+0000",
        }
        result = _parse_post(raw, "instagram")
        assert result["post_type"] == "carousel_album"


# ---------------------------------------------------------------------------
# _parse_insights
# ---------------------------------------------------------------------------

class TestParseInsights:
    def test_parse_fb_post_insights(self):
        raw = {
            "data": [
                {"name": "post_impressions", "values": [{"value": 5000}]},
                {"name": "post_impressions_unique", "values": [{"value": 3200}]},
                {"name": "post_engaged_users", "values": [{"value": 480}]},
                {"name": "post_clicks", "values": [{"value": 120}]},
                {
                    "name": "post_reactions_by_type_total",
                    "value": {"LIKE": 300, "LOVE": 50, "WOW": 10},
                },
            ]
        }
        result = _parse_insights(raw)
        assert result["impressions"] == 5000
        assert result["reach"] == 3200
        assert result["engagement"] == 480
        assert result["clicks"] == 120
        assert result["likes"] == 360  # 300 + 50 + 10

    def test_parse_ig_media_insights(self):
        raw = {
            "data": [
                {"name": "impressions", "values": [{"value": 8000}]},
                {"name": "reach", "values": [{"value": 6000}]},
                {"name": "engagement", "values": [{"value": 900}]},
                {"name": "likes", "values": [{"value": 750}]},
                {"name": "comments", "values": [{"value": 80}]},
                {"name": "shares", "values": [{"value": 40}]},
                {"name": "saved", "values": [{"value": 30}]},
            ]
        }
        result = _parse_insights(raw)
        assert result["impressions"] == 8000
        assert result["reach"] == 6000
        assert result["engagement"] == 900
        assert result["likes"] == 750
        assert result["comments"] == 80
        assert result["shares"] == 40
        assert result["saves"] == 30

    def test_parse_insights_missing_metrics_returns_zeros(self):
        result = _parse_insights({})
        assert result["impressions"] == 0
        assert result["reach"] == 0
        assert result["engagement"] == 0
        assert result["likes"] == 0
        assert result["comments"] == 0
        assert result["shares"] == 0
        assert result["saves"] == 0
        assert result["clicks"] == 0

    def test_parse_insights_empty_data_list(self):
        result = _parse_insights({"data": []})
        assert all(v == 0 for v in result.values())

    def test_parse_insights_inline_value_format(self):
        """Graph API sometimes returns value inline (not in values list)."""
        raw = {
            "data": [
                {"name": "impressions", "value": 1234},
                {"name": "reach", "value": 999},
            ]
        }
        result = _parse_insights(raw)
        assert result["impressions"] == 1234
        assert result["reach"] == 999

    def test_parse_insights_unknown_metric_ignored(self):
        raw = {
            "data": [
                {"name": "some_future_metric", "values": [{"value": 99}]},
                {"name": "impressions", "values": [{"value": 100}]},
            ]
        }
        result = _parse_insights(raw)
        assert result["impressions"] == 100
        assert "some_future_metric" not in result


# ---------------------------------------------------------------------------
# _calc_engagement_rate
# ---------------------------------------------------------------------------

class TestCalcEngagementRate:
    def test_normal_case(self):
        rate = _calc_engagement_rate(engagement=480, reach=6000)
        assert rate == round(480 / 6000, 6)

    def test_zero_engagement(self):
        rate = _calc_engagement_rate(engagement=0, reach=1000)
        assert rate == 0.0

    def test_divide_by_zero_returns_none(self):
        rate = _calc_engagement_rate(engagement=100, reach=0)
        assert rate is None

    def test_both_zero_returns_none(self):
        rate = _calc_engagement_rate(engagement=0, reach=0)
        assert rate is None

    def test_high_engagement_rate(self):
        rate = _calc_engagement_rate(engagement=500, reach=500)
        assert rate == 1.0


# ---------------------------------------------------------------------------
# MetaOrganicClient.is_connected
# ---------------------------------------------------------------------------

class TestIsConnected:
    def _make_client(self, page_id="", token="", ig_id=""):
        # Pass a fake db — is_connected doesn't use it
        return MetaOrganicClient(db=None, page_id=page_id, token=token, ig_id=ig_id)

    def test_is_connected_false_when_both_empty(self):
        client = self._make_client(page_id="", token="")
        assert client.is_connected() is False

    def test_is_connected_false_when_page_id_missing(self):
        client = self._make_client(page_id="", token="EAAabc123")
        assert client.is_connected() is False

    def test_is_connected_false_when_token_missing(self):
        client = self._make_client(page_id="111222333", token="")
        assert client.is_connected() is False

    def test_is_connected_true_when_both_present(self):
        client = self._make_client(page_id="111222333", token="EAAabc123")
        assert client.is_connected() is True

    def test_is_connected_true_regardless_of_ig_id(self):
        """IG ID is optional — connected as long as page_id + token exist."""
        client = self._make_client(page_id="111222333", token="EAAabc123", ig_id="")
        assert client.is_connected() is True
