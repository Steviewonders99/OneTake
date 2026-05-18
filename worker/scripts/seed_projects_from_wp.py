#!/usr/bin/env python3.12
"""Seed the projects table from WordPress job posts.

Pulls all published 'job' posts from the WP REST API and calls
seed_project_from_wp() for each one.

Usage:
    python3.12 worker/scripts/seed_projects_from_wp.py

Requires:
    WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD in environment or .env
    DATABASE_URL for Azure PG connection
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
from datetime import datetime, timezone

import asyncpg
import httpx

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────

WP_BASE_URL = os.environ.get("WP_BASE_URL", "https://oneforma.com")
WP_USERNAME = os.environ.get("WP_USERNAME", "")
WP_APP_PASSWORD = os.environ.get("WP_APP_PASSWORD", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")


def extract_codename(title: str, slug: str) -> str:
    """Extract a codename from the job title or slug.

    Priority: explicit codename in title (e.g. 'Centaurus — MFA ...'),
    then slug with common suffixes stripped.
    """
    for sep in ["\u2014", "\u2013", "-", ":"]:
        if sep in title:
            candidate = title.split(sep)[0].strip().lower()
            candidate = re.sub(r"[^a-z0-9_\-]", "", candidate.replace(" ", "_"))
            if len(candidate) >= 3:
                return candidate

    clean = re.sub(
        r"-(job|position|role|hiring|apply|oneforma|2026|2025)$", "", slug
    )
    return clean.lower()


async def fetch_wp_jobs() -> list[dict]:
    """Fetch all published 'job' posts from WP REST API."""
    jobs: list[dict] = []
    page = 1
    auth = (WP_USERNAME, WP_APP_PASSWORD) if WP_USERNAME else None

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = (
                f"{WP_BASE_URL}/wp-json/wp/v2/job"
                f"?per_page=50&page={page}&status=publish"
            )
            resp = await client.get(url, auth=auth)
            if resp.status_code != 200:
                logger.warning(
                    "WP API returned %d on page %d", resp.status_code, page
                )
                break
            batch = resp.json()
            if not batch:
                break
            jobs.extend(batch)
            page += 1
            logger.info("Fetched page %d (%d jobs so far)", page - 1, len(jobs))

    return jobs


async def seed_to_db(jobs: list[dict]) -> int:
    """Insert jobs into projects table via seed_project_from_wp()."""
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    seeded = 0

    async with pool.acquire() as conn:
        for job in jobs:
            title = job.get("title", {}).get("rendered", "Untitled")
            slug = job.get("slug", "")
            wp_id = job.get("id")
            raw_date = job.get("date_gmt", "")
            published = None
            if raw_date:
                try:
                    published = datetime.fromisoformat(raw_date).replace(tzinfo=timezone.utc)
                except ValueError:
                    pass
            codename = extract_codename(title, slug)

            # Extract countries from ACF fields if present
            acf = job.get("acf", {}) or {}
            countries: list[str] = []
            apply_rows = acf.get("apply_job", []) or []
            for row in apply_rows:
                lang = row.get("apply_language", "")
                if lang and lang not in countries:
                    countries.append(lang)

            try:
                project_id = await conn.fetchval(
                    "SELECT seed_project_from_wp("
                    "$1, $2, $3, $4, $5::TIMESTAMPTZ, $6::TEXT[])",
                    codename,
                    title,
                    wp_id,
                    slug,
                    published,
                    countries if countries else [],
                )
                logger.info(
                    "Seeded: %s -> %s (id=%s)", codename, title[:40], project_id
                )
                seeded += 1
            except Exception as e:
                logger.error("Failed to seed %s: %s", codename, e)

    await pool.close()
    return seeded


async def main() -> None:
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    logger.info("Fetching jobs from %s ...", WP_BASE_URL)
    jobs = await fetch_wp_jobs()
    logger.info("Found %d published jobs", len(jobs))

    if not jobs:
        logger.warning("No jobs found. Check WP_BASE_URL and credentials.")
        return

    seeded = await seed_to_db(jobs)
    logger.info(
        "Done. Seeded %d / %d jobs into projects table.", seeded, len(jobs)
    )


if __name__ == "__main__":
    asyncio.run(main())
