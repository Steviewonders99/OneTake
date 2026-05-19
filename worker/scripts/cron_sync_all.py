#!/usr/bin/env python3.12
"""Master cron orchestrator — runs all project sync tasks in sequence.

Designed to run inside the Azure Container App on a 6-hour schedule.
Direct PG access — no proxy needed.

Sequence:
  1. seed_projects_from_wp.py  — detect new WP job posts → seed projects table
  2. sync_locale_links.py     — sync per-language apply URLs → extract requestIds
  3. sync_ga4_funnel.py       — refresh GA4 funnel data → refresh materialized view
  4. link_intake_to_projects   — match intake_requests to projects
  5. REFRESH MATERIALIZED VIEW project_weekly_summary

Usage:
  # Run all steps
  python3.12 worker/scripts/cron_sync_all.py

  # Run from container (crontab or process manager)
  0 */6 * * * cd /app && python3.12 worker/scripts/cron_sync_all.py >> /var/log/sync.log 2>&1

Env vars: DATABASE_URL, WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from importlib import import_module
from pathlib import Path

import asyncpg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("AZURE_DATABASE_URL", "")


async def run_step(name: str, coro) -> dict:
    """Run a step and return timing + result."""
    t0 = time.time()
    try:
        await coro
        ms = int((time.time() - t0) * 1000)
        logger.info("  ✓ %s completed (%dms)", name, ms)
        return {"step": name, "status": "ok", "ms": ms}
    except Exception as e:
        ms = int((time.time() - t0) * 1000)
        logger.error("  ✗ %s failed (%dms): %s", name, ms, str(e)[:200])
        return {"step": name, "status": "error", "error": str(e)[:200], "ms": ms}


async def step_seed_projects():
    """Step 1: Seed projects from WordPress."""
    # Import and run the WP seeder
    sys.path.insert(0, str(Path(__file__).parent))
    from seed_projects_from_wp import fetch_wp_jobs, seed_to_db
    jobs = await fetch_wp_jobs()
    if jobs:
        seeded = await seed_to_db(jobs)
        logger.info("    Seeded %d / %d WP jobs", seeded, len(jobs))


async def step_sync_locale_links():
    """Step 2: Sync locale links from WP ACF fields."""
    sys.path.insert(0, str(Path(__file__).parent))
    from sync_locale_links import fetch_all_jobs, sync_locale_links
    jobs = await fetch_all_jobs()
    if jobs:
        stats = await sync_locale_links(jobs)
        logger.info(
            "    Links: %d new, %d updated, %d removed",
            stats["new"], stats["updated"], stats["removed"],
        )


async def step_sync_ga4_funnel():
    """Step 3: Refresh GA4 funnel data."""
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    sys.path.insert(0, str(Path(__file__).parent))
    from sync_ga4_funnel import get_project_campaign_map, sync_funnel_data
    project_map = await get_project_campaign_map(pool)
    stats = await sync_funnel_data(pool, project_map)
    logger.info(
        "    Funnel: %d projects, %d with data, %d rows",
        stats["projects_checked"], stats["projects_with_data"], stats["rows_updated"],
    )
    await pool.close()


async def step_link_intakes():
    """Step 4: Link intake_requests to projects via campaign_slug."""
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT link_intake_to_projects()")
        if count > 0:
            logger.info("    Linked %d intake_requests to projects", count)
    await pool.close()


async def step_refresh_view():
    """Step 5: Refresh materialized view."""
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    async with pool.acquire() as conn:
        await conn.execute("REFRESH MATERIALIZED VIEW project_weekly_summary")
    await pool.close()


async def main():
    if not DATABASE_URL:
        logger.error("DATABASE_URL or AZURE_DATABASE_URL not set")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("OneTake Sync — Starting full cron cycle")
    logger.info("=" * 60)
    t0 = time.time()

    results = []

    results.append(await run_step("1. Seed WP projects", step_seed_projects()))
    results.append(await run_step("2. Sync locale links", step_sync_locale_links()))
    results.append(await run_step("3. Sync GA4 funnel", step_sync_ga4_funnel()))
    results.append(await run_step("4. Link intakes", step_link_intakes()))
    results.append(await run_step("5. Refresh mat. view", step_refresh_view()))

    total_ms = int((time.time() - t0) * 1000)
    ok = sum(1 for r in results if r["status"] == "ok")
    failed = sum(1 for r in results if r["status"] == "error")

    logger.info("=" * 60)
    logger.info("Sync complete: %d/%d steps OK, %d failed, %dms total", ok, len(results), failed, total_ms)
    logger.info("=" * 60)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
