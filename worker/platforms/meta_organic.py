"""Meta organic client — Facebook Page posts + Instagram Business media insights.

Uses Graph API v21.0. Requires:
  META_PAGE_ID       — Facebook Page ID
  META_PAGE_TOKEN    — Page access token (long-lived)
  META_IG_ID         — Instagram Business Account ID (linked to the Page)
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v21.0"

# FB post-level insight metrics
POST_INSIGHT_METRICS = [
    "post_impressions",
    "post_impressions_unique",
    "post_engaged_users",
    "post_reactions_by_type_total",
    "post_clicks",
]

# IG media insight metrics (v21.0+ — 'impressions' and 'engagement' deprecated for newer posts)
IG_MEDIA_METRICS = [
    "reach",
    "likes",
    "comments",
    "shares",
    "saved",
    "total_interactions",
]


# ---------------------------------------------------------------------------
# Pure helpers (testable without DB or network)
# ---------------------------------------------------------------------------

def _parse_post(post: dict, platform: str) -> dict:
    """Extract normalised fields from a Graph API post/media object.

    Works for both Facebook (post) and Instagram (media) objects.
    Returns a flat dict ready to pass to _upsert_post.
    """
    post_id: str = str(post.get("id", ""))

    # Facebook posts use 'message', IG media use 'caption'
    post_text: str = post.get("message") or post.get("caption") or ""

    # Facebook posts: permalink_url; IG media: permalink
    post_url: str = post.get("permalink_url") or post.get("permalink") or ""

    # FB: created_time; IG: timestamp
    raw_ts: str = post.get("created_time") or post.get("timestamp") or ""
    published_at: str | None = raw_ts if raw_ts else None

    # FB: post_type derived from 'story' presence; IG: media_type field
    post_type: str = (
        post.get("media_type")              # IG: IMAGE / VIDEO / CAROUSEL_ALBUM
        or ("video" if post.get("story") and "video" in str(post.get("story", "")).lower() else None)
        or post.get("type")                 # FB Graph sometimes returns 'type'
        or "post"
    )

    return {
        "post_id": post_id,
        "platform": platform,
        "post_type": post_type.lower() if post_type else "post",
        "post_url": post_url,
        "post_text": post_text,
        "published_at": published_at,
    }


def _parse_insights(raw: dict) -> dict:
    """Map Graph API insights response to a normalised metrics dict.

    Handles both FB post insights (named metrics in data[]) and
    IG media insights (same structure). Defaults all to 0 if missing.
    """
    metrics: dict[str, int] = {
        "impressions": 0,
        "reach": 0,
        "engagement": 0,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "saves": 0,
        "clicks": 0,
    }

    # Graph API returns {"data": [{"name": "metric_name", "values": [{"value": N}]}]}
    data: list[dict] = raw.get("data", [])

    # FB metric name → normalised name
    fb_map: dict[str, str] = {
        "post_impressions": "impressions",
        "post_impressions_unique": "reach",
        "post_engaged_users": "engagement",
        "post_clicks": "clicks",
        # reactions are a nested dict; we'll handle them separately
    }

    # IG metric name → normalised name
    ig_map: dict[str, str] = {
        "impressions": "impressions",
        "reach": "reach",
        "engagement": "engagement",
        "total_interactions": "engagement",
        "likes": "likes",
        "comments": "comments",
        "shares": "shares",
        "saved": "saves",
    }

    for item in data:
        name: str = item.get("name", "")
        # Value can come as {"values": [{"value": N}]} or {"value": N}
        value: Any = item.get("value")
        if value is None:
            values_list: list = item.get("values", [])
            value = values_list[0].get("value", 0) if values_list else 0

        # Reactions are a dict like {"LIKE": 12, "LOVE": 3, ...}
        if name == "post_reactions_by_type_total":
            if isinstance(value, dict):
                metrics["likes"] = sum(value.values())
            continue

        target = fb_map.get(name) or ig_map.get(name)
        if target and isinstance(value, (int, float)):
            metrics[target] = int(value)

    return metrics


def _calc_engagement_rate(engagement: int, reach: int) -> float | None:
    """Return engagement / reach. Returns None when reach is 0."""
    if reach == 0:
        return None
    return round(engagement / reach, 6)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class MetaOrganicClient:
    """Fetch Facebook Page + Instagram Business organic metrics and cache them."""

    def __init__(
        self,
        db,                     # asyncpg Pool
        page_id: str | None = None,
        token: str | None = None,
        ig_id: str | None = None,
    ) -> None:
        self.db = db
        self.page_id: str = page_id or os.environ.get("META_PAGE_ID", "")
        self.token: str = token or os.environ.get("META_PAGE_ACCESS_TOKEN", os.environ.get("META_PAGE_TOKEN", ""))
        self.ig_id: str = ig_id or os.environ.get("META_IG_BUSINESS_ID", os.environ.get("META_IG_ID", ""))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_connected(self) -> bool:
        """True when the minimum credentials (page_id + token) are present."""
        return bool(self.page_id and self.token)

    async def sync(self, days: int = 7) -> dict:
        """Fetch recent posts/media and upsert metrics into meta_organic_cache.

        Returns a summary dict: {"fb_posts": N, "ig_media": N, "errors": [...]}
        """
        summary: dict[str, Any] = {"fb_posts": 0, "ig_media": 0, "errors": []}

        if not self.is_connected():
            summary["errors"].append("Missing META_PAGE_ID or META_PAGE_TOKEN")
            return summary

        since_ts = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())

        # --- Facebook page posts ---
        try:
            fb_posts = await self._fetch_fb_posts(since_ts)
            for post in fb_posts:
                try:
                    parsed = _parse_post(post, "facebook")
                    insights_raw = await self._fetch_fb_insights(post["id"])
                    metrics = _parse_insights(insights_raw)
                    metrics["engagement_rate"] = _calc_engagement_rate(
                        metrics["engagement"], metrics["reach"]
                    )
                    await self._upsert_post(parsed, metrics)
                    summary["fb_posts"] += 1
                except Exception as exc:
                    logger.warning("FB post %s failed: %s", post.get("id"), exc)
                    summary["errors"].append(f"fb:{post.get('id')}:{exc}")
        except Exception as exc:
            logger.error("FB post fetch failed: %s", exc)
            summary["errors"].append(f"fb_fetch:{exc}")

        # --- Instagram media ---
        if self.ig_id:
            try:
                ig_media = await self._fetch_ig_media(since_ts)
                for media in ig_media:
                    try:
                        parsed = _parse_post(media, "instagram")
                        insights_raw = await self._fetch_ig_insights(media["id"])
                        metrics = _parse_insights(insights_raw)
                        metrics["engagement_rate"] = _calc_engagement_rate(
                            metrics["engagement"], metrics["reach"]
                        )
                        await self._upsert_post(parsed, metrics)
                        summary["ig_media"] += 1
                    except Exception as exc:
                        logger.warning("IG media %s failed: %s", media.get("id"), exc)
                        summary["errors"].append(f"ig:{media.get('id')}:{exc}")
            except Exception as exc:
                logger.error("IG media fetch failed: %s", exc)
                summary["errors"].append(f"ig_fetch:{exc}")

        logger.info("Meta organic sync: %s", summary)
        return summary

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    async def _fetch_fb_posts(self, since_ts: int) -> list[dict]:
        """Fetch recent posts from the Facebook Page."""
        url = f"{GRAPH_API_BASE}/{self.page_id}/posts"
        params = {
            "access_token": self.token,
            "since": since_ts,
            "fields": "id,message,story,type,created_time,permalink_url",
            "limit": 100,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def _fetch_fb_insights(self, post_id: str) -> dict:
        """Fetch insights for a single Facebook post."""
        url = f"{GRAPH_API_BASE}/{post_id}/insights"
        params = {
            "access_token": self.token,
            "metric": ",".join(POST_INSIGHT_METRICS),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def _fetch_ig_media(self, since_ts: int) -> list[dict]:
        """Fetch recent media from the Instagram Business account."""
        url = f"{GRAPH_API_BASE}/{self.ig_id}/media"
        params = {
            "access_token": self.token,
            "since": since_ts,
            "fields": "id,caption,media_type,permalink,timestamp",
            "limit": 100,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def _fetch_ig_insights(self, media_id: str) -> dict:
        """Fetch insights for a single Instagram media object."""
        url = f"{GRAPH_API_BASE}/{media_id}/insights"
        params = {
            "access_token": self.token,
            "metric": ",".join(IG_MEDIA_METRICS),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # DB helper
    # ------------------------------------------------------------------

    async def _upsert_post(self, parsed: dict, metrics: dict) -> None:
        """Upsert a post row into meta_organic_cache.

        Conflict target: (page_id, post_id, date) — one row per post per day
        so repeated syncs within the same day update in-place.
        """
        date_val = (
            parsed["published_at"][:10]
            if parsed.get("published_at")
            else datetime.now(timezone.utc).date().isoformat()
        )

        sql = """
            INSERT INTO meta_organic_cache (
                page_id, post_id, platform, post_type, post_url, post_text,
                published_at, date,
                impressions, reach, engagement, likes, comments, shares,
                saves, clicks, engagement_rate,
                synced_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8,
                $9, $10, $11, $12, $13, $14,
                $15, $16, $17,
                NOW()
            )
            ON CONFLICT (page_id, post_id, date) DO UPDATE SET
                impressions     = EXCLUDED.impressions,
                reach           = EXCLUDED.reach,
                engagement      = EXCLUDED.engagement,
                likes           = EXCLUDED.likes,
                comments        = EXCLUDED.comments,
                shares          = EXCLUDED.shares,
                saves           = EXCLUDED.saves,
                clicks          = EXCLUDED.clicks,
                engagement_rate = EXCLUDED.engagement_rate,
                synced_at       = NOW()
        """
        async with self.db.acquire() as conn:
            await conn.execute(
                sql,
                self.page_id,
                parsed["post_id"],
                parsed["platform"],
                parsed["post_type"],
                parsed["post_url"],
                parsed["post_text"],
                parsed["published_at"],
                date_val,
                metrics.get("impressions", 0),
                metrics.get("reach", 0),
                metrics.get("engagement", 0),
                metrics.get("likes", 0),
                metrics.get("comments", 0),
                metrics.get("shares", 0),
                metrics.get("saves", 0),
                metrics.get("clicks", 0),
                metrics.get("engagement_rate"),
            )
