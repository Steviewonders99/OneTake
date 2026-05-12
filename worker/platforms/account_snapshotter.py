"""Account snapshotter — daily account-level rollup across all organic platforms.

Queries each platform cache for today's aggregated metrics and upserts a single
row per (platform, account_id, date) into social_account_snapshots.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Per-platform query config
# ---------------------------------------------------------------------------

# Each entry: (platform_label, table, account_id_col, engagement_col)
# engagement_col is the "engagement" equivalent per table
_PLATFORM_CONFIGS: list[tuple[str, str, str, str]] = [
    ("facebook",  "meta_organic_cache",     "page_id",    "engagement"),
    ("instagram", "meta_organic_cache",     "page_id",    "engagement"),
    ("linkedin",  "linkedin_organic_cache", "org_id",     "engagement"),
    ("reddit",    "reddit_organic_cache",   "username",   "score"),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def snapshot_accounts(db) -> dict:
    """Aggregate today's organic metrics per platform and upsert to
    social_account_snapshots.

    Args:
        db: asyncpg connection pool

    Returns:
        dict mapping platform name -> bool (True = snapshotted, False = skipped/error)
    """
    today: str = datetime.now(timezone.utc).date().isoformat()
    result: dict[str, bool] = {}

    async with db.acquire() as conn:
        for platform, table, acct_col, eng_col in _PLATFORM_CONFIGS:
            try:
                rows = await _query_platform(conn, platform, table, acct_col, eng_col, today)
                if not rows:
                    logger.debug("account_snapshotter: no rows for %s on %s", platform, today)
                    result[platform] = False
                    continue

                for row in rows:
                    account_id: str = str(row["account_id"])
                    follower_delta = await _calc_follower_delta(
                        conn, platform, account_id, today
                    )
                    await _upsert_snapshot(
                        conn,
                        platform=platform,
                        account_id=account_id,
                        date=today,
                        post_count=row["post_count"],
                        impressions=row["total_impressions"],
                        reach=row["total_reach"],
                        engagement=row["total_engagement"],
                        engagement_rate_avg=row["avg_engagement_rate"],
                        follower_count=0,       # to be populated via platform API later
                        follower_delta=follower_delta,
                    )

                result[platform] = True
                logger.info(
                    "account_snapshotter: snapshotted %s (%d account(s)) for %s",
                    platform, len(rows), today,
                )

            except Exception as exc:  # pylint: disable=broad-except
                logger.error("account_snapshotter: %s failed: %s", platform, exc)
                result[platform] = False

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _query_platform(
    conn,
    platform: str,
    table: str,
    acct_col: str,
    eng_col: str,
    today: str,
) -> list:
    """Aggregate today's metrics from a platform cache table.

    Returns one row per account_id.  We COALESCE reach/impressions to 0 for
    tables (reddit) that don't have those columns.
    """
    # reddit_organic_cache has no impressions/reach columns — use 0
    if table == "reddit_organic_cache":
        sql = f"""
            SELECT
                MIN({acct_col})         AS account_id,
                COUNT(DISTINCT post_id) AS post_count,
                0                       AS total_impressions,
                0                       AS total_reach,
                SUM({eng_col})          AS total_engagement,
                NULL                    AS avg_engagement_rate
            FROM {table}
            WHERE date = $1
              AND platform = $2
            GROUP BY {acct_col}
        """
    else:
        sql = f"""
            SELECT
                MIN({acct_col})         AS account_id,
                COUNT(DISTINCT post_id) AS post_count,
                SUM(impressions)        AS total_impressions,
                SUM(reach)              AS total_reach,
                SUM({eng_col})          AS total_engagement,
                AVG(engagement_rate)    AS avg_engagement_rate
            FROM {table}
            WHERE date = $1
              AND platform = $2
            GROUP BY {acct_col}
        """

    return await conn.fetch(sql, today, platform)


async def _calc_follower_delta(
    conn,
    platform: str,
    account_id: str,
    today: str,
) -> int:
    """Return the change in follower_count vs the most recent previous snapshot.

    Returns 0 when there is no prior snapshot or when follower_count is 0
    (not yet populated from the platform API).
    """
    row = await conn.fetchrow(
        """
        SELECT follower_count
        FROM social_account_snapshots
        WHERE platform    = $1
          AND account_id  = $2
          AND date        < $3
        ORDER BY date DESC
        LIMIT 1
        """,
        platform, account_id, today,
    )
    if row is None:
        return 0
    return 0 - int(row["follower_count"] or 0)   # current (0) minus previous


async def _upsert_snapshot(
    conn,
    *,
    platform: str,
    account_id: str,
    date: str,
    post_count: int,
    impressions: int,
    reach: int,
    engagement: int,
    engagement_rate_avg: float | None,
    follower_count: int,
    follower_delta: int,
) -> None:
    """Upsert one row into social_account_snapshots."""
    sql = """
        INSERT INTO social_account_snapshots (
            platform, account_id, date,
            post_count, impressions, reach, engagement,
            engagement_rate_avg,
            follower_count, follower_delta,
            snapshotted_at
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7,
            $8,
            $9, $10,
            NOW()
        )
        ON CONFLICT (platform, account_id, date) DO UPDATE SET
            post_count          = EXCLUDED.post_count,
            impressions         = EXCLUDED.impressions,
            reach               = EXCLUDED.reach,
            engagement          = EXCLUDED.engagement,
            engagement_rate_avg = EXCLUDED.engagement_rate_avg,
            follower_count      = EXCLUDED.follower_count,
            follower_delta      = EXCLUDED.follower_delta,
            snapshotted_at      = NOW()
    """
    await conn.execute(
        sql,
        platform,
        account_id,
        date,
        int(post_count or 0),
        int(impressions or 0),
        int(reach or 0),
        int(engagement or 0),
        float(engagement_rate_avg) if engagement_rate_avg is not None else None,
        follower_count,
        follower_delta,
    )
