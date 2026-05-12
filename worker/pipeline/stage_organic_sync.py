"""Organic Metrics Sync — standalone pipeline stage.

Pulls fresh organic data from all connected platforms (Meta, LinkedIn,
Reddit, GSC), then runs account snapshots + asset attribution matching.

Usage (via compute_job with job_type="organic_sync"):
    context = {"days": 7}
    result = await run_organic_sync(context)
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def run_organic_sync(context: dict) -> dict:
    """Sync organic metrics across all connected platforms.

    Parameters
    ----------
    context:
        Dict containing at minimum ``request_id``. May also include
        ``days`` (int) to override the default lookback window.

    Returns
    -------
    dict
        Per-platform sync results plus totals::

            {
                "meta":     {"fb_posts": N, "ig_media": N, "errors": [...]},
                "linkedin": {"posts": N, "errors": [...]},
                "reddit":   {"posts": N, "errors": [...]},
                "gsc":      {"rows": N, "errors": [...]},
                "snapshot": {...},
                "match":    {...},
                "total_synced": N,
            }
    """
    from config import (
        META_PAGE_ACCESS_TOKEN,
        META_PAGE_ID,
        META_IG_BUSINESS_ID,
        LINKEDIN_ORG_ACCESS_TOKEN,
        LINKEDIN_ORG_ID,
        REDDIT_CLIENT_ID,
        REDDIT_CLIENT_SECRET,
        REDDIT_USERNAME,
        REDDIT_PASSWORD,
        GSC_SERVICE_ACCOUNT_JSON,
        GSC_PROPERTY_URL,
        ORGANIC_SYNC_DAYS,
    )
    from neon_client import _get_pool
    from platforms.meta_organic import MetaOrganicClient
    from platforms.linkedin_organic import LinkedInOrganicClient
    from platforms.reddit_organic import RedditOrganicClient
    from platforms.gsc_client import GscSyncClient
    from platforms import account_snapshotter, asset_matcher

    pool = await _get_pool()
    days: int = int(context.get("days", ORGANIC_SYNC_DAYS))

    # ── Build client instances ──────────────────────────────────────────────
    meta_client = MetaOrganicClient(
        db=pool,
        page_id=META_PAGE_ID,
        token=META_PAGE_ACCESS_TOKEN,
        ig_id=META_IG_BUSINESS_ID,
    )
    linkedin_client = LinkedInOrganicClient(
        db=pool,
        org_id=LINKEDIN_ORG_ID,
        token=LINKEDIN_ORG_ACCESS_TOKEN,
    )
    reddit_client = RedditOrganicClient(
        db=pool,
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        username=REDDIT_USERNAME,
        password=REDDIT_PASSWORD,
    )
    gsc_client = GscSyncClient(
        db=pool,
        service_account_json=GSC_SERVICE_ACCOUNT_JSON,
        property_url=GSC_PROPERTY_URL,
    )

    # ── Filter to connected clients only ────────────────────────────────────
    client_map: dict[str, Any] = {
        "meta":     meta_client,
        "linkedin": linkedin_client,
        "reddit":   reddit_client,
        "gsc":      gsc_client,
    }
    connected: dict[str, Any] = {
        name: client
        for name, client in client_map.items()
        if client.is_connected()
    }

    if not connected:
        logger.warning(
            "organic_sync: no platforms connected — check credentials in config"
        )
        return {
            "meta":     {},
            "linkedin": {},
            "reddit":   {},
            "gsc":      {},
            "snapshot": {},
            "match":    {},
            "total_synced": 0,
        }

    logger.info(
        "organic_sync: syncing %d platform(s): %s (days=%d)",
        len(connected),
        list(connected.keys()),
        days,
    )

    # ── Run all connected platforms in parallel ─────────────────────────────
    async def _safe_sync(name: str, client: Any) -> tuple[str, dict]:
        try:
            result = await client.sync(days=days)
            logger.info("organic_sync: %s done — %s", name, result)
            return name, result
        except Exception as exc:  # noqa: BLE001
            logger.error("organic_sync: %s failed: %s", name, exc, exc_info=True)
            return name, {"errors": [str(exc)]}

    sync_tasks = [_safe_sync(name, client) for name, client in connected.items()]
    sync_results_list: list[tuple[str, dict]] = await asyncio.gather(*sync_tasks)
    sync_results: dict[str, dict] = dict(sync_results_list)

    # Fill in empty dicts for disconnected platforms so callers get a
    # consistent shape regardless of which platforms are wired up.
    for name in client_map:
        sync_results.setdefault(name, {})

    # ── Post-sync: account snapshot + asset attribution ─────────────────────
    snapshot_result: dict = {}
    match_result: dict = {}

    try:
        snapshot_result = await account_snapshotter.snapshot_accounts(pool)
        logger.info("organic_sync: account snapshot complete — %s", snapshot_result)
    except Exception as exc:  # noqa: BLE001
        logger.error("organic_sync: account snapshot failed: %s", exc, exc_info=True)
        snapshot_result = {"error": str(exc)}

    try:
        match_result = await asset_matcher.match_posts(pool)
        logger.info("organic_sync: asset match complete — %s", match_result)
    except Exception as exc:  # noqa: BLE001
        logger.error("organic_sync: asset match failed: %s", exc, exc_info=True)
        match_result = {"error": str(exc)}

    # ── Aggregate total synced count ────────────────────────────────────────
    total_synced = 0
    for platform_result in sync_results.values():
        # Meta returns fb_posts + ig_media; others return posts or rows
        for key in ("fb_posts", "ig_media", "posts", "rows"):
            total_synced += int(platform_result.get(key, 0))

    return {
        **sync_results,
        "snapshot": snapshot_result,
        "match":    match_result,
        "total_synced": total_synced,
    }
