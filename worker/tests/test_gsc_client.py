"""Unit tests for the GSC sync client.

All tests are pure — no network calls, no DB connections, no google-auth needed.
"""
import sys
import os

# Ensure worker/ is on the path so we can import platforms.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from platforms.gsc_client import (
    GscSyncClient,
    _parse_gsc_row,
)


# ---------------------------------------------------------------------------
# _parse_gsc_row
# ---------------------------------------------------------------------------

class TestParseGscRow:
    def test_parse_gsc_row_full_keys(self):
        """Verify all four dimension keys and all four metrics are extracted."""
        row = {
            "keys": ["data annotation jobs", "https://oneforma.com/jobs", "USA", "MOBILE"],
            "clicks": 42,
            "impressions": 1500,
            "ctr": 0.028,
            "position": 6.3,
        }
        result = _parse_gsc_row(row)

        assert result["query"] == "data annotation jobs"
        assert result["page"] == "https://oneforma.com/jobs"
        assert result["country"] == "USA"
        assert result["device"] == "MOBILE"
        assert result["clicks"] == 42
        assert result["impressions"] == 1500
        assert result["ctr"] == 0.028
        assert result["position"] == 6.3

    def test_parse_gsc_row_missing_keys_defaults(self):
        """Rows with a partial keys list should use safe defaults."""
        row = {
            "keys": ["oneforma review"],  # only query present
            "clicks": 10,
            "impressions": 200,
            "ctr": 0.05,
            "position": 3.1,
        }
        result = _parse_gsc_row(row)

        assert result["query"] == "oneforma review"
        assert result["page"] == ""          # default
        assert result["country"] == "GLOBAL" # default
        assert result["device"] == "ALL"     # default
        assert result["clicks"] == 10
        assert result["impressions"] == 200

    def test_parse_gsc_row_empty_keys_list(self):
        """Empty keys list should use all defaults without raising."""
        row = {
            "keys": [],
            "clicks": 5,
            "impressions": 100,
            "ctr": 0.05,
            "position": 4.0,
        }
        result = _parse_gsc_row(row)

        assert result["query"] == ""
        assert result["page"] == ""
        assert result["country"] == "GLOBAL"
        assert result["device"] == "ALL"

    def test_parse_gsc_row_no_keys_field(self):
        """Missing keys field entirely should not raise."""
        row = {
            "clicks": 3,
            "impressions": 50,
            "ctr": 0.06,
            "position": 7.2,
        }
        result = _parse_gsc_row(row)

        assert result["query"] == ""
        assert result["page"] == ""
        assert result["country"] == "GLOBAL"
        assert result["device"] == "ALL"
        assert result["clicks"] == 3

    def test_parse_gsc_row_missing_metrics_default_zero(self):
        """Missing numeric fields should default to 0, not raise."""
        row = {"keys": ["query only"]}
        result = _parse_gsc_row(row)

        assert result["clicks"] == 0
        assert result["impressions"] == 0
        assert result["ctr"] == 0.0
        assert result["position"] == 0.0

    def test_parse_gsc_row_none_metrics_safe(self):
        """None values for metrics should be treated as 0."""
        row = {
            "keys": ["test query"],
            "clicks": None,
            "impressions": None,
            "ctr": None,
            "position": None,
        }
        result = _parse_gsc_row(row)

        assert result["clicks"] == 0
        assert result["impressions"] == 0
        assert result["ctr"] == 0.0
        assert result["position"] == 0.0

    def test_parse_gsc_row_two_keys(self):
        """Two keys: query + page present, country + device default."""
        row = {
            "keys": ["work from home jobs", "https://oneforma.com/"],
            "clicks": 20,
            "impressions": 400,
            "ctr": 0.05,
            "position": 9.0,
        }
        result = _parse_gsc_row(row)

        assert result["query"] == "work from home jobs"
        assert result["page"] == "https://oneforma.com/"
        assert result["country"] == "GLOBAL"
        assert result["device"] == "ALL"

    def test_parse_gsc_row_three_keys(self):
        """Three keys: query + page + country present, device defaults."""
        row = {
            "keys": ["annotation task", "https://oneforma.com/tasks", "GBR"],
            "clicks": 8,
            "impressions": 160,
            "ctr": 0.05,
            "position": 12.0,
        }
        result = _parse_gsc_row(row)

        assert result["country"] == "GBR"
        assert result["device"] == "ALL"

    def test_parse_gsc_row_returns_all_expected_keys(self):
        """Output dict must contain exactly the expected set of keys."""
        result = _parse_gsc_row({})
        expected = {"query", "page", "country", "device", "clicks", "impressions", "ctr", "position"}
        assert set(result.keys()) == expected


# ---------------------------------------------------------------------------
# GscSyncClient.is_connected
# ---------------------------------------------------------------------------

class TestIsConnected:
    def _make_client(
        self,
        service_account_json: str = "",
        property_url: str = "",
    ) -> GscSyncClient:
        return GscSyncClient(
            db=None,
            service_account_json=service_account_json,
            property_url=property_url,
        )

    def test_is_connected_false_when_both_empty(self):
        client = self._make_client()
        assert client.is_connected() is False

    def test_is_connected_false_when_json_missing(self):
        client = self._make_client(property_url="https://oneforma.com/")
        assert client.is_connected() is False

    def test_is_connected_false_when_property_url_missing(self):
        client = self._make_client(service_account_json='{"type": "service_account"}')
        assert client.is_connected() is False

    def test_is_connected_true_when_both_present(self):
        client = self._make_client(
            service_account_json='{"type": "service_account", "project_id": "oneforma"}',
            property_url="https://oneforma.com/",
        )
        assert client.is_connected() is True

    def test_is_connected_true_with_file_path(self):
        """A file path string (non-JSON) is also a valid credential reference."""
        client = self._make_client(
            service_account_json="/secrets/gsc_sa.json",
            property_url="https://oneforma.com/",
        )
        assert client.is_connected() is True
