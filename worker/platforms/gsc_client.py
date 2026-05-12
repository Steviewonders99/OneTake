"""Google Search Console client — searchAnalytics/query sync.

Uses GSC Data API v1 with a service account JWT. Requires:
  GSC_SERVICE_ACCOUNT_JSON — JSON string (or path) of GCP service account key
  GSC_PROPERTY_URL         — Verified property URL (e.g. "https://example.com/")

Note: GSC data has a ~3 day lag. end_date is always (now - 3 days).
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3"
GSC_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


# ---------------------------------------------------------------------------
# Pure helpers (testable without DB or network)
# ---------------------------------------------------------------------------

def _parse_gsc_row(row: dict) -> dict:
    """Extract normalised fields from a GSC searchAnalytics row.

    The row has a `keys` list (positional: query, page, country, device)
    and scalar metrics (clicks, impressions, ctr, position).
    Missing keys default gracefully: page="", country="GLOBAL", device="ALL".
    """
    keys: list[str] = row.get("keys", [])

    query: str = keys[0] if len(keys) > 0 else ""
    page: str = keys[1] if len(keys) > 1 else ""
    country: str = keys[2] if len(keys) > 2 else "GLOBAL"
    device: str = keys[3] if len(keys) > 3 else "ALL"

    clicks: int = int(row.get("clicks", 0) or 0)
    impressions: int = int(row.get("impressions", 0) or 0)
    ctr: float = float(row.get("ctr", 0.0) or 0.0)
    position: float = float(row.get("position", 0.0) or 0.0)

    return {
        "query": query,
        "page": page,
        "country": country,
        "device": device,
        "clicks": clicks,
        "impressions": impressions,
        "ctr": ctr,
        "position": position,
    }


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class GscSyncClient:
    """Fetch Google Search Console searchAnalytics data and cache it."""

    def __init__(
        self,
        db,                                   # asyncpg Pool
        service_account_json: str | None = None,
        property_url: str | None = None,
    ) -> None:
        self.db = db
        self.service_account_json: str = (
            service_account_json
            or os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")
        )
        self.property_url: str = (
            property_url or os.environ.get("GSC_PROPERTY_URL", "")
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_connected(self) -> bool:
        """True when both service_account_json and property_url are present."""
        return bool(self.service_account_json and self.property_url)

    async def sync(self, days: int = 7) -> dict:
        """Fetch recent GSC rows and upsert into gsc_daily_cache.

        GSC has a ~3 day lag so end_date = now - 3 days.
        Returns a summary dict: {"rows": N, "errors": [...]}
        """
        summary: dict[str, Any] = {"rows": 0, "errors": []}

        if not self.is_connected():
            summary["errors"].append(
                "Missing GSC_SERVICE_ACCOUNT_JSON or GSC_PROPERTY_URL"
            )
            return summary

        now = datetime.now(timezone.utc)
        end_date = (now - timedelta(days=3)).date()
        start_date = (now - timedelta(days=3 + days)).date()

        try:
            token = await self._get_access_token()
        except Exception as exc:
            logger.error("GSC access token fetch failed: %s", exc)
            summary["errors"].append(f"token:{exc}")
            return summary

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        url = f"{GSC_API_BASE}/sites/{self.property_url}/searchAnalytics/query"
        payload = {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "dimensions": ["query", "page", "country", "device"],
            "rowLimit": 25000,
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                rows_raw: list[dict] = resp.json().get("rows", [])
        except Exception as exc:
            logger.error("GSC API request failed: %s", exc)
            summary["errors"].append(f"api:{exc}")
            return summary

        for row_raw in rows_raw:
            try:
                parsed = _parse_gsc_row(row_raw)
                # Use the row's date if present, otherwise end_date
                row_date = row_raw.get("date", end_date.isoformat())
                await self._upsert_row(parsed, row_date)
                summary["rows"] += 1
            except Exception as exc:
                logger.warning("GSC row upsert failed: %s — %s", row_raw, exc)
                summary["errors"].append(f"row:{exc}")

        logger.info("GSC sync: %s", summary)
        return summary

    # ------------------------------------------------------------------
    # Auth helper
    # ------------------------------------------------------------------

    async def _get_access_token(self) -> str:
        """Obtain a Google OAuth2 access token using the service account key.

        Requires google-auth (pip install google-auth). Raises ImportError
        with a clear message if the library is not installed.
        """
        try:
            import google.auth.transport.requests  # type: ignore
            from google.oauth2 import service_account  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "google-auth is required for GSC sync. "
                "Install it with: pip install google-auth"
            ) from exc

        # service_account_json may be a JSON string or a file path
        sa_json = self.service_account_json.strip()
        if sa_json.startswith("{"):
            sa_info = json.loads(sa_json)
        else:
            with open(sa_json) as fh:
                sa_info = json.load(fh)

        credentials = service_account.Credentials.from_service_account_info(
            sa_info, scopes=GSC_SCOPES
        )

        # Refresh to obtain an access token synchronously (lightweight)
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        return credentials.token  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # DB helper
    # ------------------------------------------------------------------

    async def _upsert_row(self, parsed: dict, date: str) -> None:
        """Upsert a GSC row into gsc_daily_cache.

        Conflict target: (property_url, query, page, country, device, date)
        — one row per dimension combination per day.
        """
        sql = """
            INSERT INTO gsc_daily_cache (
                property_url, query, page, country, device, date,
                clicks, impressions, ctr, position,
                synced_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                NOW()
            )
            ON CONFLICT (property_url, query, page, country, device, date) DO UPDATE SET
                clicks      = EXCLUDED.clicks,
                impressions = EXCLUDED.impressions,
                ctr         = EXCLUDED.ctr,
                position    = EXCLUDED.position,
                synced_at   = NOW()
        """
        async with self.db.acquire() as conn:
            await conn.execute(
                sql,
                self.property_url,
                parsed["query"],
                parsed["page"],
                parsed["country"],
                parsed["device"],
                date,
                parsed["clicks"],
                parsed["impressions"],
                parsed["ctr"],
                parsed["position"],
            )
