"""LinkedIn organic client — Organization page UGC post analytics via Marketing API v2.

Uses LinkedIn API v2. Requires:
  LI_ORG_ID    — LinkedIn Organization ID (URN like urn:li:organization:12345)
  LI_TOKEN     — OAuth 2.0 access token with r_organization_social scope
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

LI_API_BASE = "https://api.linkedin.com/v2"


# ---------------------------------------------------------------------------
# Pure helpers (testable without DB or network)
# ---------------------------------------------------------------------------

def _parse_share(share: dict) -> dict:
    """Extract normalised fields from a LinkedIn UGC post object.

    Returns a flat dict ready to pass to _upsert_post.
    """
    post_id: str = str(share.get("id", ""))

    # Text lives inside specificContent
    specific_content: dict = share.get("specificContent", {})
    share_content: dict = specific_content.get("com.linkedin.ugc.ShareContent", {})
    commentary: dict = share_content.get("shareCommentary", {})
    post_text: str = commentary.get("text", "")

    # Media category determines post type (e.g. "IMAGE", "VIDEO", "ARTICLE", "NONE")
    raw_media_category: str = share_content.get("shareMediaCategory", "post")
    post_type: str = raw_media_category.lower() if raw_media_category else "post"

    # Published timestamp is in milliseconds since epoch
    created: dict = share.get("created", {})
    raw_ms: int | None = created.get("time")
    if raw_ms is not None:
        published_at: str | None = datetime.fromtimestamp(
            raw_ms / 1000, tz=timezone.utc
        ).isoformat()
    else:
        published_at = None

    # Build post URL from the share URN — format: urn:li:ugcPost:12345
    urn: str = post_id
    # Extract the numeric ID from URN (e.g. "urn:li:ugcPost:12345" -> "12345")
    urn_parts = urn.split(":")
    numeric_id: str = urn_parts[-1] if urn_parts else urn
    post_url: str = f"https://www.linkedin.com/feed/update/{urn}/" if urn else ""

    return {
        "post_id": post_id,
        "post_text": post_text,
        "post_type": post_type,
        "published_at": published_at,
        "post_url": post_url,
    }


def _parse_stats(stats: dict) -> dict:
    """Map LinkedIn organizationalEntityShareStatistics to a normalised metrics dict.

    Reads from the totalShareStatistics sub-object. Defaults all to 0 if missing.
    """
    totals: dict = stats.get("totalShareStatistics", {})

    impressions: int = int(totals.get("impressionCount", 0) or 0)
    unique_impressions: int = int(totals.get("uniqueImpressionsCount", 0) or 0)
    clicks: int = int(totals.get("clickCount", 0) or 0)
    likes: int = int(totals.get("likeCount", 0) or 0)
    comments: int = int(totals.get("commentCount", 0) or 0)
    shares: int = int(totals.get("shareCount", 0) or 0)
    engagement: float = float(totals.get("engagement", 0) or 0)

    return {
        "impressions": impressions,
        "unique_impressions": unique_impressions,
        "clicks": clicks,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "engagement": engagement,
    }


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class LinkedInOrganicClient:
    """Fetch LinkedIn Organization page UGC posts and cache organic metrics."""

    def __init__(
        self,
        db,                      # asyncpg Pool
        org_id: str | None = None,
        token: str | None = None,
    ) -> None:
        self.db = db
        self.org_id: str = org_id or os.environ.get("LI_ORG_ID", "")
        self.token: str = token or os.environ.get("LI_TOKEN", "")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_connected(self) -> bool:
        """True when org_id and token are both present."""
        return bool(self.org_id and self.token)

    async def sync(self, days: int = 7) -> dict:
        """Fetch recent UGC posts and upsert metrics into linkedin_organic_cache.

        Returns a summary dict: {"posts": N, "errors": [...]}
        """
        summary: dict[str, Any] = {"posts": 0, "errors": []}

        if not self.is_connected():
            summary["errors"].append("Missing LI_ORG_ID or LI_TOKEN")
            return summary

        headers = {
            "Authorization": f"Bearer {self.token}",
            "X-Restli-Protocol-Version": "2.0.0",
        }

        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            try:
                shares = await self._fetch_shares(client)
            except Exception as exc:
                logger.error("LinkedIn shares fetch failed: %s", exc)
                summary["errors"].append(f"fetch_shares:{exc}")
                return summary

            for share in shares:
                share_urn: str = str(share.get("id", ""))
                try:
                    parsed = _parse_share(share)
                    stats_raw = await self._fetch_share_stats(client, share_urn)
                    metrics = _parse_stats(stats_raw)
                    await self._upsert_post(parsed, metrics)
                    summary["posts"] += 1
                except Exception as exc:
                    logger.warning("LinkedIn share %s failed: %s", share_urn, exc)
                    summary["errors"].append(f"share:{share_urn}:{exc}")

        logger.info("LinkedIn organic sync: %s", summary)
        return summary

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    async def _fetch_shares(self, client: httpx.AsyncClient) -> list[dict]:
        """Fetch UGC posts authored by the organization."""
        # Encode the authors filter for Restli 2.0 protocol
        authors_filter = f"List(urn%3Ali%3Aorganization%3A{self.org_id.split(':')[-1]})"
        url = f"{LI_API_BASE}/ugcPosts"
        params = {
            "q": "authors",
            "authors": f"List({self.org_id})",
            "count": 100,
        }
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("elements", [])

    async def _fetch_share_stats(
        self, client: httpx.AsyncClient, share_urn: str
    ) -> dict:
        """Fetch share statistics for a single UGC post URN."""
        url = f"{LI_API_BASE}/organizationalEntityShareStatistics"
        params = {
            "q": "organizationalEntity",
            "organizationalEntity": self.org_id,
            "shares[0]": share_urn,
        }
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        elements: list[dict] = data.get("elements", [])
        return elements[0] if elements else {}

    # ------------------------------------------------------------------
    # DB helper
    # ------------------------------------------------------------------

    async def _upsert_post(self, parsed: dict, metrics: dict) -> None:
        """Upsert a post row into linkedin_organic_cache.

        Conflict target: (org_id, post_id, date) — one row per post per day
        so repeated syncs within the same day update in-place.
        """
        date_val = (
            parsed["published_at"][:10]
            if parsed.get("published_at")
            else datetime.now(timezone.utc).date().isoformat()
        )

        sql = """
            INSERT INTO linkedin_organic_cache (
                org_id, post_id, post_type, post_url, post_text,
                published_at, date,
                impressions, unique_impressions, clicks, likes,
                comments, shares, engagement,
                synced_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14,
                NOW()
            )
            ON CONFLICT (org_id, post_id, date) DO UPDATE SET
                impressions        = EXCLUDED.impressions,
                unique_impressions  = EXCLUDED.unique_impressions,
                clicks             = EXCLUDED.clicks,
                likes              = EXCLUDED.likes,
                comments           = EXCLUDED.comments,
                shares             = EXCLUDED.shares,
                engagement         = EXCLUDED.engagement,
                synced_at          = NOW()
        """
        async with self.db.acquire() as conn:
            await conn.execute(
                sql,
                self.org_id,
                parsed["post_id"],
                parsed["post_type"],
                parsed["post_url"],
                parsed["post_text"],
                parsed["published_at"],
                date_val,
                metrics.get("impressions", 0),
                metrics.get("unique_impressions", 0),
                metrics.get("clicks", 0),
                metrics.get("likes", 0),
                metrics.get("comments", 0),
                metrics.get("shares", 0),
                metrics.get("engagement", 0.0),
            )
