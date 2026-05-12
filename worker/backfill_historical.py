#!/usr/bin/env python3
"""
Historical Data Backfill — Pull 2 years of ad platform data into Neon/Azure PG.

Pulls from:
  1. Meta Ads API (Graph API v21.0) — campaign-level daily data
  2. Reddit Ads API (v3) — campaign-level daily reporting

Writes directly to:
  - meta_ads_cache
  - reddit_ads_cache
  - normalized_daily_metrics (via normalization step)

Usage:
    cd worker/
    python3 backfill_historical.py                    # defaults: 730 days, all platforms
    python3 backfill_historical.py --days 365         # last 1 year
    python3 backfill_historical.py --platform meta    # meta only
    python3 backfill_historical.py --platform reddit  # reddit only
    python3 backfill_historical.py --dry-run          # show what would be pulled, don't write

Designed to be run ONCE to seed historical data. Safe to re-run (upserts).
"""
from __future__ import annotations

import argparse
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

# Load worker env
from dotenv import load_dotenv
load_dotenv()

import asyncpg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("backfill")

# Prefer Azure PG for backfill, fall back to DATABASE_URL (Neon)
DATABASE_URL = os.environ.get("AZURE_DATABASE_URL", os.environ.get("DATABASE_URL", ""))

# ═══════════════════════════════════════════════════════════
# META ADS BACKFILL
# ═══════════════════════════════════════════════════════════

META_TOKEN = os.environ.get("META_ADS_ACCESS_TOKEN", os.environ.get("META_PAGE_ACCESS_TOKEN", ""))
META_AD_ACCOUNT = os.environ.get("META_ADS_AD_ACCOUNT_ID", "")
META_API_BASE = "https://graph.facebook.com/v21.0"

# Meta limits time_range to 37 months max, and returns max 25 results per page at adset level.
# We'll chunk into 30-day windows to stay safe with pagination.
META_CHUNK_DAYS = 30


def _meta_api_get(url: str) -> dict:
    """Make a GET request to Meta Graph API with retry."""
    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(url)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 429 or "rate" in body.lower():
                wait = 2 ** (attempt + 1)
                logger.warning("Meta rate limited, waiting %ds...", wait)
                time.sleep(wait)
                continue
            logger.error("Meta API error (%d): %s", e.code, body[:300])
            raise
    raise RuntimeError("Meta API: max retries exceeded")


async def backfill_meta(pool: asyncpg.Pool, total_days: int, dry_run: bool = False) -> int:
    """Pull Meta Ads data in 30-day chunks going back total_days."""
    if not META_TOKEN or not META_AD_ACCOUNT:
        logger.warning("META: Missing credentials — skipping")
        return 0

    logger.info("META: Starting backfill — %d days, account act_%s", total_days, META_AD_ACCOUNT)
    total_rows = 0
    end = datetime.now()
    chunks_done = 0
    chunks_total = (total_days + META_CHUNK_DAYS - 1) // META_CHUNK_DAYS

    while total_days > 0:
        chunk = min(total_days, META_CHUNK_DAYS)
        start = end - timedelta(days=chunk)
        since_str = start.strftime("%Y-%m-%d")
        until_str = end.strftime("%Y-%m-%d")

        chunks_done += 1
        logger.info("META: Chunk %d/%d — %s to %s", chunks_done, chunks_total, since_str, until_str)

        params = urllib.parse.urlencode({
            "fields": "campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions,cpc,cpm,ctr",
            "time_range": json.dumps({"since": since_str, "until": until_str}),
            "time_increment": "1",
            "level": "adset",
            "limit": "500",
            "access_token": META_TOKEN,
        })
        url = f"{META_API_BASE}/act_{META_AD_ACCOUNT}/insights?{params}"

        chunk_rows = 0
        while url:
            data = _meta_api_get(url)
            rows = data.get("data", [])

            if dry_run:
                chunk_rows += len(rows)
            else:
                for row in rows:
                    conversions = sum(
                        int(a.get("value", 0))
                        for a in (row.get("actions") or [])
                        if a.get("action_type") in ("offsite_conversion", "lead")
                    )
                    async with pool.acquire() as conn:
                        await conn.execute("""
                            INSERT INTO meta_ads_cache (
                                ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
                                impressions, clicks, conversions, spend, date
                            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                            ON CONFLICT (ad_account_id, campaign_id, adset_id, date) DO UPDATE SET
                                impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
                                conversions=EXCLUDED.conversions, spend=EXCLUDED.spend,
                                campaign_name=EXCLUDED.campaign_name, adset_name=EXCLUDED.adset_name,
                                last_synced_at=NOW()
                        """,
                            META_AD_ACCOUNT,
                            row.get("campaign_id", ""),
                            row.get("campaign_name", ""),
                            row.get("adset_id") or "",
                            row.get("adset_name") or "",
                            int(row.get("impressions", 0)),
                            int(row.get("clicks", 0)),
                            conversions,
                            float(row.get("spend", 0)),
                            datetime.strptime(row.get("date_start", since_str), "%Y-%m-%d").date(),
                        )
                    chunk_rows += 1

            # Pagination
            url = data.get("paging", {}).get("next")

        total_rows += chunk_rows
        logger.info("META: Chunk done — %d rows (total: %d)", chunk_rows, total_rows)

        end = start
        total_days -= chunk

        # Rate limit courtesy pause
        time.sleep(1)

    logger.info("META: Backfill complete — %d total rows", total_rows)
    return total_rows


# ═══════════════════════════════════════════════════════════
# REDDIT ADS BACKFILL
# ═══════════════════════════════════════════════════════════

REDDIT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                   "..", "oneformadata", "reddit_ads_config.json")


def _load_reddit_config() -> dict:
    """Load Reddit config from oneformadata repo or env vars."""
    config = {}

    # Try loading from oneformadata config file
    for path in [REDDIT_CONFIG_PATH, os.path.expanduser("~/oneformadata/reddit_ads_config.json")]:
        if os.path.exists(path):
            with open(path) as f:
                config = json.load(f)
            break

    # Env var overrides
    if os.environ.get("REDDIT_CLIENT_ID"):
        config["client_id"] = os.environ["REDDIT_CLIENT_ID"]
    if os.environ.get("REDDIT_CLIENT_SECRET"):
        config["client_secret"] = os.environ["REDDIT_CLIENT_SECRET"]
    if os.environ.get("REDDIT_ADS_ACCESS_TOKEN"):
        config["access_token"] = os.environ["REDDIT_ADS_ACCESS_TOKEN"]
    if os.environ.get("REDDIT_ADS_AD_ACCOUNT_ID"):
        config["account_id"] = os.environ["REDDIT_ADS_AD_ACCOUNT_ID"]

    return config


def _reddit_api_post(url: str, body: dict, headers: dict) -> dict:
    """Make a POST request to Reddit Ads API."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    for k, v in headers.items():
        req.add_header(k, v)
    req.add_header("Content-Type", "application/json")

    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(req)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            if e.code == 429:
                wait = 2 ** (attempt + 1)
                logger.warning("Reddit rate limited, waiting %ds...", wait)
                time.sleep(wait)
                continue
            logger.error("Reddit API error (%d): %s", e.code, error_body[:300])
            raise
    raise RuntimeError("Reddit API: max retries exceeded")


# Reddit Ads API limits date ranges — we chunk into 90-day windows
REDDIT_CHUNK_DAYS = 90
REDDIT_API_BASE = "https://ads-api.reddit.com/api/v3"


async def backfill_reddit(pool: asyncpg.Pool, total_days: int, dry_run: bool = False) -> int:
    """Pull Reddit Ads data in 90-day chunks."""
    config = _load_reddit_config()
    if not config.get("access_token") or not config.get("account_id"):
        logger.warning("REDDIT: Missing credentials — skipping")
        return 0

    account_id = config["account_id"]
    headers = {
        "Authorization": f"Bearer {config['access_token']}",
        "User-Agent": config.get("user_agent", "oneforma-backfill:v1.0"),
    }

    logger.info("REDDIT: Starting backfill — %d days, account %s", total_days, account_id)
    total_rows = 0
    end = datetime.now()
    chunks_done = 0
    chunks_total = (total_days + REDDIT_CHUNK_DAYS - 1) // REDDIT_CHUNK_DAYS

    while total_days > 0:
        chunk = min(total_days, REDDIT_CHUNK_DAYS)
        start = end - timedelta(days=chunk)
        since_str = start.strftime("%Y-%m-%d")
        until_str = end.strftime("%Y-%m-%d")

        chunks_done += 1
        logger.info("REDDIT: Chunk %d/%d — %s to %s", chunks_done, chunks_total, since_str, until_str)

        body = {
            "data": {
                "starts_at": f"{since_str}T00:00:00Z",
                "ends_at": f"{until_str}T00:00:00Z",
                "fields": ["CAMPAIGN_ID", "DATE", "IMPRESSIONS", "CLICKS", "SPEND", "CTR", "CPC", "ECPM"],
            }
        }

        try:
            result = _reddit_api_post(
                f"{REDDIT_API_BASE}/ad_accounts/{account_id}/reports",
                body, headers,
            )
            rows = result.get("data", {}).get("metrics", [])
        except Exception as e:
            logger.error("REDDIT: Chunk failed — %s", e)
            end = start
            total_days -= chunk
            continue

        chunk_rows = 0
        if dry_run:
            chunk_rows = len(rows)
        else:
            for row in rows:
                # Reddit returns money in micros
                spend = row.get("spend", row.get("SPEND", 0))
                if isinstance(spend, (int, float)) and abs(spend) > 10000:
                    spend = spend / 1_000_000
                cpc = row.get("cpc", row.get("CPC", 0))
                if isinstance(cpc, (int, float)) and abs(cpc) > 10000:
                    cpc = cpc / 1_000_000
                ecpm = row.get("ecpm", row.get("ECPM", 0))
                if isinstance(ecpm, (int, float)) and abs(ecpm) > 10000:
                    ecpm = ecpm / 1_000_000

                campaign_id = str(row.get("campaign_id", row.get("CAMPAIGN_ID", "")))
                date_val = row.get("date", row.get("DATE", since_str))
                if isinstance(date_val, str) and "T" in date_val:
                    date_val = date_val.split("T")[0]
                if isinstance(date_val, str):
                    date_val = datetime.strptime(date_val, "%Y-%m-%d").date()

                async with pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO reddit_ads_cache (
                            ad_account_id, campaign_id, impressions, clicks,
                            spend, ecpm, cpc, ctr, date
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                        ON CONFLICT (ad_account_id, campaign_id, ad_group_id, date) DO UPDATE SET
                            impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
                            spend=EXCLUDED.spend, ecpm=EXCLUDED.ecpm, cpc=EXCLUDED.cpc,
                            ctr=EXCLUDED.ctr, last_synced_at=NOW()
                    """,
                        account_id, campaign_id,
                        int(row.get("impressions", row.get("IMPRESSIONS", 0))),
                        int(row.get("clicks", row.get("CLICKS", 0))),
                        float(spend),
                        float(ecpm) if ecpm else None,
                        float(cpc) if cpc else None,
                        float(row.get("ctr", row.get("CTR", 0))),
                        date_val,
                    )
                chunk_rows += 1

        total_rows += chunk_rows
        logger.info("REDDIT: Chunk done — %d rows (total: %d)", chunk_rows, total_rows)

        end = start
        total_days -= chunk
        time.sleep(1)

    logger.info("REDDIT: Backfill complete — %d total rows", total_rows)
    return total_rows


# ═══════════════════════════════════════════════════════════
# GA4 BACKFILL (via Google Analytics Data API)
# ═══════════════════════════════════════════════════════════

GA4_PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "330157295")
ADC_PATH = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")


def _get_google_credentials():
    """Load Google ADC credentials for GA4 + GSC."""
    try:
        from google.oauth2.credentials import Credentials as UserCredentials
        from google.auth.transport.requests import Request

        if not os.path.exists(ADC_PATH):
            logger.warning("GOOGLE: No ADC at %s", ADC_PATH)
            return None

        with open(ADC_PATH) as f:
            adc = json.load(f)

        creds = UserCredentials(
            token=None,
            refresh_token=adc.get("refresh_token"),
            client_id=adc.get("client_id"),
            client_secret=adc.get("client_secret"),
            token_uri="https://oauth2.googleapis.com/token",
        )
        creds.refresh(Request())
        return creds
    except Exception as e:
        logger.error("GOOGLE: Failed to load credentials — %s", e)
        return None


GA4_CHUNK_DAYS = 30


async def backfill_ga4(pool: asyncpg.Pool, total_days: int, dry_run: bool = False) -> int:
    """Pull GA4 session data via Analytics Data API v1beta."""
    creds = _get_google_credentials()
    if not creds:
        logger.warning("GA4: No credentials — skipping")
        return 0

    logger.info("GA4: Starting backfill — %d days, property %s", total_days, GA4_PROPERTY_ID)
    total_rows = 0
    end = datetime.now()
    chunks_done = 0
    chunks_total = (total_days + GA4_CHUNK_DAYS - 1) // GA4_CHUNK_DAYS

    while total_days > 0:
        chunk = min(total_days, GA4_CHUNK_DAYS)
        start = end - timedelta(days=chunk)
        since_str = start.strftime("%Y-%m-%d")
        until_str = end.strftime("%Y-%m-%d")

        chunks_done += 1
        logger.info("GA4: Chunk %d/%d — %s to %s", chunks_done, chunks_total, since_str, until_str)

        body = json.dumps({
            "dateRanges": [{"startDate": since_str, "endDate": until_str}],
            "dimensions": [
                {"name": "date"},
                {"name": "sessionSource"},
                {"name": "sessionMedium"},
                {"name": "sessionCampaignName"},
                {"name": "country"},
                {"name": "deviceCategory"},
            ],
            "metrics": [
                {"name": "sessions"},
                {"name": "engagedSessions"},
                {"name": "conversions"},
            ],
            "limit": 10000,
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
            logger.error("GA4: API error (%d): %s", e.code, error_body[:300])
            end = start
            total_days -= chunk
            continue

        rows = result.get("rows", [])
        chunk_rows = 0

        if dry_run:
            chunk_rows = len(rows)
        else:
            for row in rows:
                dims = [d.get("value", "") for d in row.get("dimensionValues", [])]
                mets = [m.get("value", "0") for m in row.get("metricValues", [])]
                # dims: date, source, medium, campaign, country, device
                date_str = dims[0] if len(dims) > 0 else since_str
                if len(date_str) == 8:  # YYYYMMDD → YYYY-MM-DD
                    date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                date_val = datetime.strptime(date_str, "%Y-%m-%d").date()

                async with pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO ga4_session_cache (
                            property_id, date, source, medium, campaign, country, device_category,
                            sessions, engaged_sessions, conversions
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                        ON CONFLICT (property_id, date, source, medium, campaign, country, device_category)
                        DO UPDATE SET
                            sessions=EXCLUDED.sessions, engaged_sessions=EXCLUDED.engaged_sessions,
                            conversions=EXCLUDED.conversions, synced_at=NOW()
                    """,
                        GA4_PROPERTY_ID,
                        date_val,
                        dims[1] if len(dims) > 1 else "(not set)",
                        dims[2] if len(dims) > 2 else "(not set)",
                        dims[3] if len(dims) > 3 else "(not set)",
                        dims[4] if len(dims) > 4 else "GLOBAL",
                        dims[5] if len(dims) > 5 else "ALL",
                        int(mets[0]) if len(mets) > 0 else 0,
                        int(mets[1]) if len(mets) > 1 else 0,
                        int(mets[2]) if len(mets) > 2 else 0,
                    )
                chunk_rows += 1

        total_rows += chunk_rows
        logger.info("GA4: Chunk done — %d rows (total: %d)", chunk_rows, total_rows)
        end = start
        total_days -= chunk
        time.sleep(1)

    logger.info("GA4: Backfill complete — %d total rows", total_rows)
    return total_rows


# ═══════════════════════════════════════════════════════════
# GSC BACKFILL (Google Search Console API)
# ═══════════════════════════════════════════════════════════

GSC_PROPERTY = os.environ.get("GSC_PROPERTY_URL", "sc-domain:oneforma.com")
GSC_CHUNK_DAYS = 30


async def backfill_gsc(pool: asyncpg.Pool, total_days: int, dry_run: bool = False) -> int:
    """Pull GSC search analytics data. Note: GSC only retains 16 months of data."""
    creds = _get_google_credentials()
    if not creds:
        logger.warning("GSC: No credentials — skipping")
        return 0

    # GSC max history is ~16 months, cap at 480 days
    effective_days = min(total_days, 480)
    if effective_days < total_days:
        logger.info("GSC: Capping to %d days (GSC retains ~16 months max)", effective_days)

    logger.info("GSC: Starting backfill — %d days, property %s", effective_days, GSC_PROPERTY)
    total_rows = 0
    end = datetime.now() - timedelta(days=3)  # GSC has ~3 day data lag
    remaining = effective_days
    chunks_done = 0
    chunks_total = (effective_days + GSC_CHUNK_DAYS - 1) // GSC_CHUNK_DAYS

    while remaining > 0:
        chunk = min(remaining, GSC_CHUNK_DAYS)
        start = end - timedelta(days=chunk)
        since_str = start.strftime("%Y-%m-%d")
        until_str = end.strftime("%Y-%m-%d")

        chunks_done += 1
        logger.info("GSC: Chunk %d/%d — %s to %s", chunks_done, chunks_total, since_str, until_str)

        body = json.dumps({
            "startDate": since_str,
            "endDate": until_str,
            "dimensions": ["query", "page", "country", "device"],
            "rowLimit": 5000,
        }).encode()

        encoded_property = urllib.parse.quote(GSC_PROPERTY, safe="")
        url = f"https://searchconsole.googleapis.com/webmasters/v3/sites/{encoded_property}/searchAnalytics/query"
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Authorization", f"Bearer {creds.token}")
        req.add_header("Content-Type", "application/json")

        try:
            resp = urllib.request.urlopen(req)
            result = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            logger.error("GSC: API error (%d): %s", e.code, error_body[:300])
            end = start
            remaining -= chunk
            continue

        rows = result.get("rows", [])
        chunk_rows = 0

        if dry_run:
            chunk_rows = len(rows)
        else:
            for row in rows:
                keys = row.get("keys", [])
                query = keys[0] if len(keys) > 0 else ""
                page = keys[1] if len(keys) > 1 else ""
                country = keys[2] if len(keys) > 2 else "GLOBAL"
                device = keys[3] if len(keys) > 3 else "ALL"

                async with pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO gsc_daily_cache (
                            property_url, query, page, country, device,
                            clicks, impressions, ctr, position, date
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                        ON CONFLICT (property_url, query, page, country, device, date) DO UPDATE SET
                            clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions,
                            ctr=EXCLUDED.ctr, position=EXCLUDED.position, last_synced_at=NOW()
                    """,
                        GSC_PROPERTY, query, page, country, device,
                        int(row.get("clicks", 0)),
                        int(row.get("impressions", 0)),
                        float(row.get("ctr", 0)),
                        float(row.get("position", 0)),
                        end.date(),  # GSC aggregates don't have per-row dates in this mode
                    )
                chunk_rows += 1

        total_rows += chunk_rows
        logger.info("GSC: Chunk done — %d rows (total: %d)", chunk_rows, total_rows)
        end = start
        remaining -= chunk
        time.sleep(1)

    logger.info("GSC: Backfill complete — %d total rows", total_rows)
    return total_rows


# ═══════════════════════════════════════════════════════════
# META ORGANIC BACKFILL (Facebook Page posts — limited without pages_read_engagement)
# ═══════════════════════════════════════════════════════════

META_PAGE_TOKEN = os.environ.get("META_PAGE_ACCESS_TOKEN", "")
META_PAGE_ID_VAL = os.environ.get("META_PAGE_ID", "")


async def backfill_meta_organic(pool: asyncpg.Pool, total_days: int, dry_run: bool = False) -> int:
    """Pull Facebook Page posts. Note: engagement metrics require pages_read_engagement permission.
    Without it, we can still store post metadata (id, message, created_time, permalink)."""
    if not META_PAGE_TOKEN or not META_PAGE_ID_VAL:
        logger.warning("META ORGANIC: Missing META_PAGE_ACCESS_TOKEN or META_PAGE_ID — skipping")
        return 0

    logger.info("META ORGANIC: Starting backfill — %d days, page %s", total_days, META_PAGE_ID_VAL)
    since_ts = int((datetime.now() - timedelta(days=total_days)).timestamp())

    params = urllib.parse.urlencode({
        "fields": "id,message,created_time,permalink_url",
        "since": since_ts,
        "limit": 100,
        "access_token": META_PAGE_TOKEN,
    })
    url = f"{META_API_BASE}/{META_PAGE_ID_VAL}/posts?{params}"

    total_rows = 0
    while url:
        try:
            data = _meta_api_get(url)
        except Exception as e:
            logger.error("META ORGANIC: API error — %s", e)
            break

        posts = data.get("data", [])
        if not posts:
            break

        for post in posts:
            today = datetime.now().date()
            if dry_run:
                total_rows += 1
                continue

            async with pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO meta_organic_cache (
                        page_id, post_id, platform, post_url, post_text, published_at, date
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                    ON CONFLICT (page_id, post_id, date) DO UPDATE SET
                        post_url=EXCLUDED.post_url, post_text=EXCLUDED.post_text, last_synced_at=NOW()
                """,
                    META_PAGE_ID_VAL,
                    post.get("id", ""),
                    "facebook",
                    post.get("permalink_url", ""),
                    post.get("message", ""),
                    datetime.strptime(post.get("created_time", "2026-01-01T00:00:00+0000"), "%Y-%m-%dT%H:%M:%S%z") if post.get("created_time") else None,
                    today,
                )
            total_rows += 1

        url = data.get("paging", {}).get("next")
        logger.info("META ORGANIC: %d posts so far...", total_rows)
        time.sleep(0.5)

    logger.info("META ORGANIC: Backfill complete — %d posts (note: engagement metrics require pages_read_engagement permission)", total_rows)
    return total_rows


# ═══════════════════════════════════════════════════════════
# NORMALIZATION (post-backfill)
# ═══════════════════════════════════════════════════════════

async def normalize_all(pool: asyncpg.Pool) -> int:
    """Normalize all cached ad data into normalized_daily_metrics."""
    logger.info("NORMALIZE: Running cross-platform normalization...")
    total = 0

    async with pool.acquire() as conn:
        # Meta → normalized (aggregate by campaign+date to avoid NULL request_id conflict issues)
        result = await conn.execute("""
            INSERT INTO normalized_daily_metrics (
                country, date, platform, channel,
                impressions, clicks, spend, conversions, conversion_value,
                signups, profile_completes, cpa, ctr
            )
            SELECT
                'GLOBAL',
                mac.date,
                'meta_ads',
                COALESCE(mac.campaign_name, 'unknown'),
                SUM(mac.impressions),
                SUM(mac.clicks),
                SUM(mac.spend),
                SUM(mac.conversions),
                0, 0, 0,
                CASE WHEN SUM(mac.conversions) > 0 THEN SUM(mac.spend) / SUM(mac.conversions) ELSE NULL END,
                CASE WHEN SUM(mac.impressions) > 0 THEN SUM(mac.clicks)::float / SUM(mac.impressions) ELSE NULL END
            FROM meta_ads_cache mac
            GROUP BY mac.date, mac.campaign_name
            ON CONFLICT DO NOTHING
        """)
        logger.info("NORMALIZE: Meta → %s", result)

        # Reddit → normalized
        result = await conn.execute("""
            INSERT INTO normalized_daily_metrics (
                country, date, platform, channel,
                impressions, clicks, spend, conversions, conversion_value,
                signups, profile_completes, cpa, ctr
            )
            SELECT
                'GLOBAL',
                rac.date,
                'reddit_ads',
                COALESCE(rac.campaign_name, 'reddit_promoted'),
                SUM(rac.impressions),
                SUM(rac.clicks),
                SUM(rac.spend),
                SUM(rac.conversions),
                0, 0, 0,
                CASE WHEN SUM(rac.conversions) > 0 THEN SUM(rac.spend) / SUM(rac.conversions) ELSE NULL END,
                CASE WHEN SUM(rac.impressions) > 0 THEN SUM(rac.clicks)::float / SUM(rac.impressions) ELSE NULL END
            FROM reddit_ads_cache rac
            GROUP BY rac.date, rac.campaign_name
            ON CONFLICT DO NOTHING
        """)
        logger.info("NORMALIZE: Reddit → %s rows", result)

    logger.info("NORMALIZE: Complete")
    return total


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(description="Historical data backfill")
    parser.add_argument("--days", type=int, default=730, help="Days of history to pull (default: 730 = ~2 years)")
    parser.add_argument("--platform", choices=["meta", "reddit", "ga4", "gsc", "organic", "all"], default="all", help="Which platform to backfill")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be pulled without writing")
    parser.add_argument("--skip-normalize", action="store_true", help="Skip normalization step")
    args = parser.parse_args()

    if not DATABASE_URL:
        logger.error("DATABASE_URL not set — cannot connect to database")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("HISTORICAL BACKFILL — %d days (%s)", args.days, args.platform)
    if args.dry_run:
        logger.info("DRY RUN — no data will be written")
    logger.info("Database: %s...%s", DATABASE_URL[:30], DATABASE_URL[-20:])
    logger.info("=" * 60)

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3, statement_cache_size=0)

    try:
        meta_rows = 0
        reddit_rows = 0
        ga4_rows = 0
        gsc_rows = 0
        organic_rows = 0

        if args.platform in ("meta", "all"):
            meta_rows = await backfill_meta(pool, args.days, args.dry_run)

        if args.platform in ("reddit", "all"):
            reddit_rows = await backfill_reddit(pool, args.days, args.dry_run)

        if args.platform in ("ga4", "all"):
            ga4_rows = await backfill_ga4(pool, args.days, args.dry_run)

        if args.platform in ("gsc", "all"):
            gsc_rows = await backfill_gsc(pool, args.days, args.dry_run)

        if args.platform in ("organic", "all"):
            organic_rows = await backfill_meta_organic(pool, args.days, args.dry_run)

        logger.info("")
        logger.info("=" * 60)
        logger.info("BACKFILL SUMMARY")
        logger.info("  Meta Ads:      %d rows", meta_rows)
        logger.info("  Reddit Ads:    %d rows", reddit_rows)
        logger.info("  GA4 Sessions:  %d rows", ga4_rows)
        logger.info("  GSC Queries:   %d rows", gsc_rows)
        logger.info("  Meta Organic:  %d rows", organic_rows)
        logger.info("  Total:         %d rows", meta_rows + reddit_rows + ga4_rows + gsc_rows + organic_rows)

        if not args.dry_run and not args.skip_normalize:
            await normalize_all(pool)

        logger.info("=" * 60)
        logger.info("DONE")

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
