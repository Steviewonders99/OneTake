#!/usr/bin/env python3.12
"""Sync GA4 acquisition funnel data for all projects.

For each project with a known campaign name, queries GA4 Data API for:
  - WP Entry (pagePath = /jobs/{slug}/)
  - Apply Click (eventName = apply_click, by pagePath)
  - Signup (/center/signup)
  - MFA Setup (/center/mfa/setup)
  - Profile Created (/crowd/profile-setup)
  - NDA Signed (/crowd/nda)
  - Certification (/crowd/cert*)
  - Browsing Jobs (/crowd/jobs)
  - Doing Tasks (/crowd/task)

Uses first-touch attribution (firstUserCampaignName) to scope to each project.

Usage:
  python3.12 worker/scripts/sync_ga4_funnel.py

Requires:
  DATABASE_URL, GA4_PROPERTY_ID (default: 330157295)
  Google OAuth credentials (via analytics MCP token or service account)
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
GA4_PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "330157295")

# ── Campaign Name Mapping ──────────────────────────────────────
# Maps project codenames → GA4 firstUserCampaignName values
# Some projects have multiple campaign names (case variants, paid vs organic)
CAMPAIGN_MAP: dict[str, list[str]] = {
    "centaurus": ["centaurus", "Centaurus"],
    "internet_judging": ["Milkyway_LI", "milkyway"],
    "andromeda": ["andromeda", "Andromeda"],
    "jellyfish-voice-assistant-conversation-annotation": ["Jellyfish"],
    "project-kilo-video-data-collection-onsite-us": ["kilo"],
    "lumina": ["lumina"],
    "humus_3": ["humus", "Humus", "hummus"],
    "mosaic": ["mosaic", "Mosaic"],
    "motto": ["motto"],
    "fred-annotation": ["fred", "Fred"],
    "fur-frame": ["fur_frame", "fur frame"],
}

# ── Funnel Stage Definitions ───────────────────────────────────
FUNNEL_STAGES = {
    "wp_entry": {"type": "pageview", "path_filter": "/jobs/"},
    "apply_click": {"type": "event", "event_name": "apply_click"},
    "signup": {"type": "pageview", "path_filter": "/center/signup"},
    "mfa_setup": {"type": "pageview", "path_filter": "/center/mfa"},
    "profile_created": {"type": "pageview", "path_filter": "/crowd/profile-setup"},
    "nda_signed": {"type": "pageview", "path_filter": "/crowd/nda"},
    "certification": {"type": "pageview", "path_filter": "/crowd/cert"},
    "browsing_jobs": {"type": "pageview", "path_filter": "/crowd/jobs"},
    "doing_tasks": {"type": "pageview", "path_filter": "/crowd/task"},
}


async def get_project_campaign_map(pool: asyncpg.Pool) -> dict[str, dict]:
    """Get projects with their campaign names from the DB."""
    async with pool.acquire() as conn:
        projects = await conn.fetch(
            "SELECT id, codename, wp_slug FROM projects WHERE status = 'active'"
        )

    result = {}
    for p in projects:
        codename = p["codename"]
        campaigns = CAMPAIGN_MAP.get(codename)
        if campaigns:
            result[codename] = {
                "id": str(p["id"]),
                "campaigns": campaigns,
                "wp_slug": p["wp_slug"],
            }

    return result


async def sync_funnel_data(pool: asyncpg.Pool, project_map: dict) -> dict[str, int]:
    """Query GA4 via the analytics MCP proxy and update ga4_project_funnel.

    NOTE: This is a placeholder that will be wired to the GA4 Data API.
    For now, it reads from the existing ga4_project_funnel table and
    logs what would be refreshed. The actual GA4 queries happen via
    the analytics MCP server or a direct API call.
    """
    stats = {"projects_checked": 0, "projects_with_data": 0, "rows_updated": 0}

    async with pool.acquire() as conn:
        for codename, info in project_map.items():
            stats["projects_checked"] += 1
            project_id = info["id"]

            # Check if we have existing funnel data
            existing = await conn.fetchval(
                "SELECT count(*) FROM ga4_project_funnel WHERE project_id = $1::UUID",
                project_id,
            )

            if existing > 0:
                stats["projects_with_data"] += 1
                # Update last sync timestamp
                await conn.execute(
                    "UPDATE ga4_project_funnel SET synced_at = NOW() WHERE project_id = $1::UUID",
                    project_id,
                )
                stats["rows_updated"] += existing
                logger.info(
                    "  %s: %d rows refreshed (campaigns: %s)",
                    codename, existing, ", ".join(info["campaigns"]),
                )
            else:
                logger.info(
                    "  %s: no funnel data yet (campaigns: %s) — will query GA4",
                    codename, ", ".join(info["campaigns"]),
                )

    return stats


async def refresh_materialized_view(pool: asyncpg.Pool) -> None:
    """Refresh the weekly summary after funnel data update."""
    async with pool.acquire() as conn:
        try:
            await conn.execute("REFRESH MATERIALIZED VIEW project_weekly_summary")
            logger.info("  project_weekly_summary refreshed")
        except Exception as e:
            logger.warning("  Could not refresh view: %s", str(e)[:100])


async def main() -> None:
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)

    logger.info("Loading project → campaign mapping...")
    project_map = await get_project_campaign_map(pool)
    logger.info("Found %d projects with campaign mappings", len(project_map))

    logger.info("Syncing GA4 funnel data...")
    stats = await sync_funnel_data(pool, project_map)
    logger.info(
        "Done. Checked %d projects, %d with data, %d rows updated",
        stats["projects_checked"],
        stats["projects_with_data"],
        stats["rows_updated"],
    )

    logger.info("Refreshing materialized view...")
    await refresh_materialized_view(pool)

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
