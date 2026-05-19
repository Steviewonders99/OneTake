#!/usr/bin/env python3.12
"""Sync locale apply links from WordPress ACF fields into project_locale_links.

For each WP job post, pulls the apply_job ACF repeater which contains
per-language apply URLs like:
  https://my.oneforma.com/webapp/dataCollection/signup?requestId=1820106519139329

The requestId is the internal platform ID — the key that ties a WP job post
to the actual application flow on my.oneforma.com.

This script:
1. Pulls all published WP jobs with ACF data
2. Extracts locale links + requestIds
3. Upserts into project_locale_links (marks new, updates last_seen, marks removed)

Run on cron (every 6h, after sync-projects):
  python3.12 worker/scripts/sync_locale_links.py

Env vars: WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD, DATABASE_URL
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

import asyncpg
import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

WP_BASE_URL = os.environ.get("WP_BASE_URL", "https://www.oneforma.com")
WP_USERNAME = os.environ.get("WP_USERNAME", "")
WP_APP_PASSWORD = os.environ.get("WP_APP_PASSWORD", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")


def extract_request_id(url: str) -> str | None:
    """Extract platform ID from apply URL. Handles 3 URL formats:
    1. /webapp/dataCollection/signup?requestId=...  → requestId
    2. /crowd/jobs/{id}?from=list                   → job id from path
    3. /UserPortal/job_page.php?job_id=...          → job_id
    """
    try:
        parsed = urlparse(url)
        params = parse_qs(parsed.query)

        # Format 1: requestId param (new projects)
        rid = params.get("requestId", [None])[0]
        if rid:
            return rid

        # Format 2: /crowd/jobs/{id} (mid-era)
        match = re.search(r"/crowd/jobs/(\d+)", parsed.path)
        if match:
            return f"crowd_{match.group(1)}"

        # Format 3: job_id param (legacy)
        jid = params.get("job_id", [None])[0]
        if jid:
            return f"legacy_{jid}"

        return None
    except Exception:
        return None


async def fetch_all_jobs() -> list[dict]:
    """Fetch all published jobs with ACF data."""
    jobs: list[dict] = []
    page = 1
    headers: dict[str, str] = {}
    if WP_USERNAME and WP_APP_PASSWORD:
        from base64 import b64encode
        creds = b64encode(f"{WP_USERNAME}:{WP_APP_PASSWORD}".encode()).decode()
        headers["Authorization"] = f"Basic {creds}"

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = f"{WP_BASE_URL}/wp-json/wp/v2/job?per_page=50&page={page}&status=publish"
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                break
            batch = resp.json()
            if not batch:
                break
            jobs.extend(batch)
            page += 1
            if len(jobs) >= 500:
                break

    return jobs


async def sync_locale_links(jobs: list[dict]) -> dict[str, int]:
    """Sync locale links from WP jobs into project_locale_links."""
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    stats = {"new": 0, "updated": 0, "removed": 0, "total_links": 0, "jobs_with_links": 0}

    async with pool.acquire() as conn:
        # Get project codename → id mapping
        projects = await conn.fetch("SELECT id, codename, wp_job_id FROM projects WHERE wp_job_id IS NOT NULL")
        wp_id_to_project = {r["wp_job_id"]: r["id"] for r in projects}

        # Get all currently active links
        active_links = await conn.fetch(
            "SELECT id, project_id, language FROM project_locale_links WHERE is_active = TRUE"
        )
        active_set = {(r["project_id"], r["language"]): r["id"] for r in active_links}
        seen_keys: set[tuple] = set()

        for job in jobs:
            wp_id = job.get("id")
            project_id = wp_id_to_project.get(wp_id)
            if not project_id:
                continue

            acf = job.get("acf") or {}
            apply_links = acf.get("apply_job") or []
            if not apply_links:
                continue

            stats["jobs_with_links"] += 1

            for link_data in apply_links:
                language = link_data.get("language", "").strip()
                apply_url = link_data.get("apply_url", "").strip()
                if not language or not apply_url:
                    continue

                request_id = extract_request_id(apply_url)
                key = (project_id, language)
                seen_keys.add(key)
                stats["total_links"] += 1

                if key in active_set:
                    # Update last_seen + URL (may have changed)
                    await conn.execute(
                        "UPDATE project_locale_links SET "
                        "apply_url = $1, platform_request_id = $2, last_seen_at = NOW(), is_active = TRUE, removed_at = NULL "
                        "WHERE id = $3",
                        apply_url, request_id, active_set[key],
                    )
                    stats["updated"] += 1
                else:
                    # New link
                    await conn.execute(
                        "INSERT INTO project_locale_links "
                        "(project_id, language, apply_url, platform_request_id) "
                        "VALUES ($1, $2, $3, $4) "
                        "ON CONFLICT (project_id, language) DO UPDATE SET "
                        "apply_url = EXCLUDED.apply_url, platform_request_id = EXCLUDED.platform_request_id, "
                        "last_seen_at = NOW(), is_active = TRUE, removed_at = NULL",
                        project_id, language, apply_url, request_id,
                    )
                    stats["new"] += 1

        # Mark removed links (were active but not seen in this sync)
        for key, link_id in active_set.items():
            if key not in seen_keys:
                await conn.execute(
                    "UPDATE project_locale_links SET is_active = FALSE, removed_at = NOW() WHERE id = $1",
                    link_id,
                )
                stats["removed"] += 1

    await pool.close()
    return stats


async def main() -> None:
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    logger.info("Fetching jobs from %s ...", WP_BASE_URL)
    jobs = await fetch_all_jobs()
    logger.info("Found %d published jobs", len(jobs))

    stats = await sync_locale_links(jobs)
    logger.info(
        "Done. %d jobs with links. %d total locale links. "
        "New: %d | Updated: %d | Removed: %d",
        stats["jobs_with_links"], stats["total_links"],
        stats["new"], stats["updated"], stats["removed"],
    )


if __name__ == "__main__":
    asyncio.run(main())
