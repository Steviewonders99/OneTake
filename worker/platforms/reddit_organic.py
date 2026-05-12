"""Reddit organic client — user submission metrics via OAuth API.

Uses Reddit OAuth2 password grant. Requires:
  REDDIT_CLIENT_ID     — OAuth app client ID
  REDDIT_CLIENT_SECRET — OAuth app client secret
  REDDIT_USERNAME      — Reddit account username
  REDDIT_PASSWORD      — Reddit account password
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)

REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"
USER_AGENT = "OneForma/1.0 (recruitment analytics bot)"


# ---------------------------------------------------------------------------
# Pure helpers (testable without DB or network)
# ---------------------------------------------------------------------------

def _parse_reddit_post(data: dict) -> dict:
    """Extract normalised fields from a Reddit listing post object.

    Reads from the data sub-dict of a listing child. Returns a flat dict
    ready to pass to _upsert_post.
    """
    # post_id — Reddit fullname like "t3_xxxx"
    post_id: str = str(data.get("name", ""))

    subreddit: str = str(data.get("subreddit", ""))

    # post_type from post_hint field; default to "self"
    post_type: str = str(data.get("post_hint", "self"))

    # post_url from permalink (relative) — prepend reddit.com
    permalink: str = str(data.get("permalink", ""))
    post_url: str = f"https://www.reddit.com{permalink}" if permalink else ""

    post_title: str = str(data.get("title", ""))
    post_text: str = str(data.get("selftext", ""))

    # published_at from created_utc (Unix timestamp → ISO string)
    created_utc: float | None = data.get("created_utc")
    if created_utc is not None:
        published_at: str | None = datetime.fromtimestamp(
            float(created_utc), tz=timezone.utc
        ).isoformat()
    else:
        published_at = None

    # Engagement metrics
    upvotes: int = int(data.get("ups", 0) or 0)
    score: int = int(data.get("score", 0) or 0)
    # Reddit hides real downvote counts; estimate from ups - score
    downvotes: int = max(0, upvotes - score)
    comments: int = int(data.get("num_comments", 0) or 0)
    upvote_ratio: float = float(data.get("upvote_ratio", 0.0) or 0.0)
    crossposts: int = int(data.get("num_crossposts", 0) or 0)
    awards: int = int(data.get("total_awards_received", 0) or 0)

    return {
        "post_id": post_id,
        "subreddit": subreddit,
        "post_type": post_type,
        "post_url": post_url,
        "post_title": post_title,
        "post_text": post_text,
        "published_at": published_at,
        "upvotes": upvotes,
        "downvotes": downvotes,
        "score": score,
        "comments": comments,
        "upvote_ratio": upvote_ratio,
        "crossposts": crossposts,
        "awards": awards,
    }


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class RedditOrganicClient:
    """Fetch user submission metrics from Reddit and cache them."""

    def __init__(
        self,
        db,                             # asyncpg Pool
        client_id: str | None = None,
        client_secret: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        self.db = db
        self.client_id: str = client_id or os.environ.get("REDDIT_CLIENT_ID", "")
        self.client_secret: str = client_secret or os.environ.get("REDDIT_CLIENT_SECRET", "")
        self.username: str = username or os.environ.get("REDDIT_USERNAME", "")
        self.password: str = password or os.environ.get("REDDIT_PASSWORD", "")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_connected(self) -> bool:
        """True when all four credentials are present."""
        return bool(self.client_id and self.client_secret and self.username and self.password)

    async def sync(self, days: int = 7) -> dict:
        """Fetch recent user submissions and upsert into reddit_organic_cache.

        Returns a summary dict: {"posts": N, "errors": [...]}
        """
        summary: dict[str, Any] = {"posts": 0, "errors": []}

        if not self.is_connected():
            summary["errors"].append(
                "Missing REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, or REDDIT_PASSWORD"
            )
            return summary

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        try:
            token = await self._get_token()
        except Exception as exc:
            logger.error("Reddit OAuth token fetch failed: %s", exc)
            summary["errors"].append(f"token:{exc}")
            return summary

        headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": USER_AGENT,
        }

        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            try:
                posts = await self._fetch_user_posts(client, headers)
            except Exception as exc:
                logger.error("Reddit submissions fetch failed: %s", exc)
                summary["errors"].append(f"fetch_posts:{exc}")
                return summary

            for post in posts:
                try:
                    # Filter by date
                    published_at = post.get("published_at")
                    if published_at:
                        post_dt = datetime.fromisoformat(published_at)
                        if post_dt < cutoff:
                            continue

                    await self._upsert_post(post)
                    summary["posts"] += 1
                except Exception as exc:
                    logger.warning(
                        "Reddit post %s failed: %s", post.get("post_id"), exc
                    )
                    summary["errors"].append(f"post:{post.get('post_id')}:{exc}")

        logger.info("Reddit organic sync: %s", summary)
        return summary

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    async def _get_token(self) -> str:
        """Obtain an OAuth2 bearer token via the password grant flow."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                REDDIT_AUTH_URL,
                data={
                    "grant_type": "password",
                    "username": self.username,
                    "password": self.password,
                },
                auth=(self.client_id, self.client_secret),
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def _fetch_user_posts(
        self, client: httpx.AsyncClient, headers: dict
    ) -> list[dict]:
        """GET /user/{username}/submitted and return parsed post dicts."""
        url = f"{REDDIT_API_BASE}/user/{self.username}/submitted"
        params = {"limit": 100, "sort": "new", "t": "all"}
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        children = resp.json().get("data", {}).get("children", [])
        return [_parse_reddit_post(child["data"]) for child in children]

    # ------------------------------------------------------------------
    # DB helper
    # ------------------------------------------------------------------

    async def _upsert_post(self, parsed: dict) -> None:
        """Upsert a post row into reddit_organic_cache.

        Conflict target: (username, post_id, date) — one row per post per day
        so repeated syncs within the same day update in-place.
        """
        date_val = (
            parsed["published_at"][:10]
            if parsed.get("published_at")
            else datetime.now(timezone.utc).date().isoformat()
        )

        sql = """
            INSERT INTO reddit_organic_cache (
                username, post_id, subreddit, post_type, post_url,
                post_title, post_text, published_at, date,
                upvotes, downvotes, score, comments, upvote_ratio,
                crossposts, awards,
                synced_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, $13, $14,
                $15, $16,
                NOW()
            )
            ON CONFLICT (username, post_id, date) DO UPDATE SET
                upvotes       = EXCLUDED.upvotes,
                downvotes     = EXCLUDED.downvotes,
                score         = EXCLUDED.score,
                comments      = EXCLUDED.comments,
                upvote_ratio  = EXCLUDED.upvote_ratio,
                crossposts    = EXCLUDED.crossposts,
                awards        = EXCLUDED.awards,
                synced_at     = NOW()
        """
        async with self.db.acquire() as conn:
            await conn.execute(
                sql,
                self.username,
                parsed["post_id"],
                parsed["subreddit"],
                parsed["post_type"],
                parsed["post_url"],
                parsed["post_title"],
                parsed["post_text"],
                parsed["published_at"],
                date_val,
                parsed["upvotes"],
                parsed["downvotes"],
                parsed["score"],
                parsed["comments"],
                parsed["upvote_ratio"],
                parsed["crossposts"],
                parsed["awards"],
            )
