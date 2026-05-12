#!/usr/bin/env python3
"""
GA4 Funnel Events Backfill — Pull event-level conversion data with campaign attribution.

Pulls: eventName × sessionSource × sessionMedium × sessionCampaignName × date
Key events: sign_up, generate_lead, begin_checkout, purchase, apply_click, Onboarding,
            UserEnterLoginPage, Job Details Page, AdToHomepageView, survey_complete

Writes to: ga4_funnel_events on Azure PG

Usage:
    cd worker/
    python3 backfill_funnel.py                  # default 730 days
    python3 backfill_funnel.py --days 365       # 1 year
    python3 backfill_funnel.py --days 90        # 3 months (quick test)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

import asyncpg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("funnel-backfill")

DATABASE_URL = os.environ.get("AZURE_DATABASE_URL", os.environ.get("DATABASE_URL", ""))
GA4_PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "330157295")
ADC_PATH = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")

# Funnel events we care about (ordered by funnel stage)
FUNNEL_EVENTS = [
    "first_visit",
    "session_start",
    "AdToHomepageView",
    "page_view",
    "Job Card List",
    "Job Details Page",
    "apply_click",
    "UserEnterLoginPage",
    "Onboarding",
    "sign_up",
    "generate_lead",
    "begin_checkout",
    "purchase",
    "survey_complete",
    "webapp",
]

CHUNK_DAYS = 30


def _get_google_creds():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    with open(ADC_PATH) as f:
        adc = json.load(f)
    creds = Credentials(
        token=None, refresh_token=adc["refresh_token"],
        client_id=adc["client_id"], client_secret=adc["client_secret"],
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(Request())
    return creds


async def backfill_funnel(pool: asyncpg.Pool, total_days: int) -> int:
    creds = _get_google_creds()
    logger.info("Starting funnel backfill — %d days, property %s", total_days, GA4_PROPERTY_ID)

    total_rows = 0
    end = datetime.now()
    remaining = total_days
    chunks_done = 0
    chunks_total = (total_days + CHUNK_DAYS - 1) // CHUNK_DAYS

    while remaining > 0:
        chunk = min(remaining, CHUNK_DAYS)
        start = end - timedelta(days=chunk)
        since_str = start.strftime("%Y-%m-%d")
        until_str = end.strftime("%Y-%m-%d")

        chunks_done += 1
        logger.info("Chunk %d/%d — %s to %s", chunks_done, chunks_total, since_str, until_str)

        # Build the event filter
        event_filter = {
            "filter": {
                "fieldName": "eventName",
                "inListFilter": {"values": FUNNEL_EVENTS},
            }
        }

        body = json.dumps({
            "dateRanges": [{"startDate": since_str, "endDate": until_str}],
            "dimensions": [
                {"name": "date"},
                {"name": "eventName"},
                {"name": "sessionSource"},
                {"name": "sessionMedium"},
                {"name": "sessionCampaignName"},
                {"name": "country"},
            ],
            "metrics": [
                {"name": "eventCount"},
                {"name": "conversions"},
            ],
            "dimensionFilter": event_filter,
            "limit": 50000,
        }).encode()

        url = f"https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROPERTY_ID}:runReport"
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {creds.token}")
        req.add_header("Content-Type", "application/json")

        try:
            resp = urllib.request.urlopen(req)
            result = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            logger.error("GA4 API error (%d): %s", e.code, error_body[:300])
            # Token might have expired — refresh
            if e.code == 401:
                creds = _get_google_creds()
                logger.info("Token refreshed, retrying...")
                end = start
                remaining -= chunk
                continue
            end = start
            remaining -= chunk
            continue

        rows = result.get("rows", [])
        chunk_rows = 0

        for row in rows:
            dims = [d.get("value", "") for d in row.get("dimensionValues", [])]
            mets = [m.get("value", "0") for m in row.get("metricValues", [])]

            # dims: date, eventName, source, medium, campaign, country
            date_str = dims[0] if len(dims) > 0 else since_str
            if len(date_str) == 8:
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            date_val = datetime.strptime(date_str, "%Y-%m-%d").date()

            async with pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO ga4_funnel_events (
                        property_id, date, event_name, source, medium, campaign, country,
                        event_count, conversions
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    ON CONFLICT (property_id, date, event_name, source, medium, campaign, country)
                    DO UPDATE SET
                        event_count=EXCLUDED.event_count, conversions=EXCLUDED.conversions, synced_at=NOW()
                """,
                    GA4_PROPERTY_ID,
                    date_val,
                    dims[1] if len(dims) > 1 else "",
                    dims[2] if len(dims) > 2 else "(not set)",
                    dims[3] if len(dims) > 3 else "(not set)",
                    dims[4] if len(dims) > 4 else "(not set)",
                    dims[5] if len(dims) > 5 else "GLOBAL",
                    int(mets[0]) if len(mets) > 0 else 0,
                    int(mets[1]) if len(mets) > 1 else 0,
                )
            chunk_rows += 1

        total_rows += chunk_rows
        logger.info("Chunk done — %d rows (total: %d)", chunk_rows, total_rows)

        end = start
        remaining -= chunk
        time.sleep(1)

    logger.info("Funnel backfill complete — %d total rows", total_rows)
    return total_rows


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=730)
    args = parser.parse_args()

    if not DATABASE_URL:
        logger.error("No DATABASE_URL set")
        sys.exit(1)

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3, statement_cache_size=0)
    try:
        rows = await backfill_funnel(pool, args.days)
        logger.info("DONE — %d funnel event rows", rows)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
