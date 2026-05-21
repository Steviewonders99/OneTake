#!/usr/bin/env python3.12
"""Sync GA4 organic landing pages → ga4_organic_landing_pages table.

Queries GA4 Data API for landing pages with organic traffic,
stores per-page sessions + conversions for the SEO Channel Intel panel.

Env: DATABASE_URL, GOOGLE_APPLICATION_CREDENTIALS (or ADC)
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("AZURE_DATABASE_URL", "")
GA4_PROPERTY_ID = "330157295"


async def ensure_table(pool: asyncpg.Pool):
    """Create the landing pages table if it doesn't exist."""
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ga4_organic_landing_pages (
                id SERIAL PRIMARY KEY,
                page_path TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'google',
                sessions INT NOT NULL DEFAULT 0,
                users INT NOT NULL DEFAULT 0,
                conversions INT NOT NULL DEFAULT 0,
                period TEXT NOT NULL DEFAULT '30d',
                synced_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(page_path, source, period)
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_ga4_olp_sessions
            ON ga4_organic_landing_pages(sessions DESC)
        """)


async def sync_landing_pages(pool: asyncpg.Pool, days: int = 30):
    """Query GA4 for organic landing pages and upsert."""
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        RunReportRequest, DateRange, Dimension, Metric,
        FilterExpression, Filter, OrderBy,
    )

    client = BetaAnalyticsDataClient()
    period = f"{days}d"

    request = RunReportRequest(
        property=f"properties/{GA4_PROPERTY_ID}",
        date_ranges=[DateRange(start_date=f"{days}daysAgo", end_date="today")],
        dimensions=[
            Dimension(name="landingPage"),
            Dimension(name="sessionSource"),
        ],
        metrics=[
            Metric(name="sessions"),
            Metric(name="totalUsers"),
            Metric(name="conversions"),
        ],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="sessionMedium",
                string_filter=Filter.StringFilter(
                    value="organic",
                    match_type=Filter.StringFilter.MatchType.EXACT,
                ),
            )
        ),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=200,
    )

    response = client.run_report(request)
    rows_inserted = 0

    async with pool.acquire() as conn:
        # Clear old data for this period
        await conn.execute(
            "DELETE FROM ga4_organic_landing_pages WHERE period = $1", period
        )

        for row in response.rows:
            page_path = row.dimension_values[0].value
            source = row.dimension_values[1].value
            sessions = int(row.metric_values[0].value)
            users = int(row.metric_values[1].value)
            conversions = int(float(row.metric_values[2].value))

            if not page_path or page_path == "(not set)":
                continue

            await conn.execute(
                """INSERT INTO ga4_organic_landing_pages
                   (page_path, source, sessions, users, conversions, period, synced_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())
                   ON CONFLICT (page_path, source, period) DO UPDATE SET
                     sessions = EXCLUDED.sessions,
                     users = EXCLUDED.users,
                     conversions = EXCLUDED.conversions,
                     synced_at = NOW()
                """,
                page_path, source, sessions, users, conversions, period,
            )
            rows_inserted += 1

    logger.info("Synced %d organic landing page rows for %s", rows_inserted, period)
    return rows_inserted


async def main():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3)
    await ensure_table(pool)
    count = await sync_landing_pages(pool, days=30)
    logger.info("Done — %d rows", count)
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
