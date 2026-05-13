#!/usr/bin/env python3
"""
Creative Backfill — Pull Meta ad creatives + GA4 per-creative funnel data.

Writes to ad_creatives_cache with BOTH ad metrics (from Meta) AND funnel
metrics (from GA4 via utm_content first-touch attribution).

Usage:
    cd worker/
    python3 backfill_creatives.py              # last 30 days
    python3 backfill_creatives.py --days 90    # last 90 days
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

import asyncpg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("creative-backfill")

DATABASE_URL = os.environ.get("AZURE_DATABASE_URL", os.environ.get("DATABASE_URL", ""))
META_TOKEN = os.environ.get("META_ADS_ACCESS_TOKEN", "")
META_AD_ACCOUNT = os.environ.get("META_ADS_AD_ACCOUNT_ID", "")
GA4_PROPERTY_ID = os.environ.get("GA4_PROPERTY_ID", "330157295")
ADC_PATH = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")


def _meta_api_get(url: str) -> dict:
    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(url, timeout=30)
            return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                import time
                time.sleep(2 ** (attempt + 1))
                continue
            raise
    raise RuntimeError("Meta API: max retries")


def _get_google_token() -> str | None:
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        if not os.path.exists(ADC_PATH):
            return None
        with open(ADC_PATH) as f:
            adc = json.load(f)
        creds = Credentials(
            token=None, refresh_token=adc["refresh_token"],
            client_id=adc["client_id"], client_secret=adc["client_secret"],
            token_uri="https://oauth2.googleapis.com/token",
        )
        creds.refresh(Request())
        return creds.token
    except Exception as e:
        logger.warning("Google auth failed: %s", e)
        return None


async def backfill_creatives(pool: asyncpg.Pool, days: int = 30) -> int:
    if not META_TOKEN or not META_AD_ACCOUNT:
        logger.error("Missing META_ADS_ACCESS_TOKEN or META_ADS_AD_ACCOUNT_ID")
        return 0

    since = datetime.now() - timedelta(days=days)
    since_str = since.strftime("%Y-%m-%d")
    until_str = datetime.now().strftime("%Y-%m-%d")

    # ── Step 1: Pull all ads with creatives + insights from Meta ──
    logger.info("Pulling Meta ad creatives (days=%d)...", days)

    params = urllib.parse.urlencode({
        "fields": "id,name,status,campaign_id,campaign.fields(name),adset_id,adset.fields(name),"
                  "creative.fields(id,name,thumbnail_url,image_url,image_hash,video_id),"
                  f"insights.time_range({{\"since\":\"{since_str}\",\"until\":\"{until_str}\"}}).fields(impressions,clicks,spend,actions,ctr,cpc)",
        "limit": "200",
        "access_token": META_TOKEN,
    })
    url = f"https://graph.facebook.com/v21.0/act_{META_AD_ACCOUNT}/ads?{params}"

    all_ads = []
    while url:
        data = _meta_api_get(url)
        all_ads.extend(data.get("data", []))
        url = data.get("paging", {}).get("next")
        logger.info("  Fetched %d ads so far...", len(all_ads))

    logger.info("Total Meta ads: %d", len(all_ads))

    # Parse into creative records
    creatives = []
    for ad in all_ads:
        creative = ad.get("creative", {})
        insights = (ad.get("insights", {}).get("data", [{}]))[0] if ad.get("insights") else {}
        actions = insights.get("actions", [])
        conversions = sum(
            int(a.get("value", 0))
            for a in actions
            if a.get("action_type") in ("offsite_conversion", "lead", "purchase", "complete_registration")
        )
        spend = float(insights.get("spend", 0))

        creatives.append({
            "ad_id": ad.get("id", ""),
            "ad_name": ad.get("name", ""),
            "creative_id": creative.get("id", ""),
            "creative_name": creative.get("name", ""),
            "campaign_id": ad.get("campaign_id", ""),
            "campaign_name": (ad.get("campaign", {}) or {}).get("name", ""),
            "adset_id": ad.get("adset_id", ""),
            "adset_name": (ad.get("adset", {}) or {}).get("name", ""),
            "status": ad.get("status", ""),
            "image_url": creative.get("image_url", ""),
            "thumbnail_url": creative.get("thumbnail_url", ""),
            "image_hash": creative.get("image_hash", ""),
            "video_id": creative.get("video_id"),
            "impressions": int(insights.get("impressions", 0)),
            "clicks": int(insights.get("clicks", 0)),
            "spend": spend,
            "conversions": conversions,
            "ctr": float(insights.get("ctr", 0)),
            "cpc": float(insights.get("cpc", 0)),
            "cpa": spend / conversions if conversions > 0 else 0,
        })

    # ── Step 2: Pull GA4 per-creative funnel via utm_content ──
    logger.info("Pulling GA4 funnel data via utm_content...")
    ga4_token = _get_google_token()
    funnel_map = {}

    if ga4_token:
        ad_names = [c["ad_name"] for c in creatives if c["ad_name"] and len(c["ad_name"]) > 2]

        if ad_names:
            ga4_body = json.dumps({
                "dateRanges": [{"startDate": since_str, "endDate": until_str}],
                "dimensions": [
                    {"name": "sessionManualAdContent"},
                    {"name": "eventName"},
                ],
                "metrics": [{"name": "eventCount"}],
                "dimensionFilter": {
                    "andGroup": {
                        "expressions": [
                            {"filter": {"fieldName": "sessionManualAdContent", "inListFilter": {"values": ad_names}}},
                            {"filter": {"fieldName": "eventName", "inListFilter": {"values": [
                                "session_start", "sign_up", "purchase", "apply_click", "generate_lead", "begin_checkout"
                            ]}}},
                        ]
                    }
                },
                "limit": 10000,
            }).encode()

            req = urllib.request.Request(
                f"https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROPERTY_ID}:runReport",
                data=ga4_body, method="POST",
            )
            req.add_header("Authorization", f"Bearer {ga4_token}")
            req.add_header("Content-Type", "application/json")

            try:
                resp = urllib.request.urlopen(req, timeout=30)
                ga4_data = json.loads(resp.read())

                for row in ga4_data.get("rows", []):
                    utm = row["dimensionValues"][0]["value"]
                    event = row["dimensionValues"][1]["value"]
                    count = int(row["metricValues"][0]["value"])

                    if utm not in funnel_map:
                        funnel_map[utm] = {"sessions": 0, "signups": 0, "completions": 0}
                    if event == "session_start":
                        funnel_map[utm]["sessions"] += count
                    elif event == "sign_up":
                        funnel_map[utm]["signups"] += count
                    elif event == "purchase":
                        funnel_map[utm]["completions"] += count

                logger.info("GA4 funnel data for %d creatives", len(funnel_map))
            except Exception as e:
                logger.error("GA4 API error: %s", e)
    else:
        logger.warning("No Google credentials — skipping GA4 funnel enrichment")

    # ── Step 3: Merge funnel into creatives and upsert to DB ──
    logger.info("Upserting %d creatives to ad_creatives_cache...", len(creatives))
    count = 0

    for c in creatives:
        funnel = funnel_map.get(c["ad_name"], {"sessions": 0, "signups": 0, "completions": 0})
        funnel_cvr = funnel["completions"] / funnel["sessions"] * 100 if funnel["sessions"] > 0 else 0

        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO ad_creatives_cache (
                    platform, ad_account_id, ad_id, ad_name, creative_id, creative_name,
                    campaign_id, campaign_name, adset_id, adset_name, status,
                    image_url, thumbnail_url, image_hash, video_id,
                    impressions, clicks, spend, conversions, ctr, cpc, cpa,
                    utm_content,
                    funnel_sessions, funnel_signups, funnel_completions, funnel_cvr,
                    date_range_start, date_range_end
                ) VALUES (
                    'meta_ads', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20, $21,
                    $22,
                    $23, $24, $25, $26,
                    $27, $28
                )
                ON CONFLICT (platform, ad_id, date_range_start) DO UPDATE SET
                    ad_name=EXCLUDED.ad_name, creative_name=EXCLUDED.creative_name,
                    campaign_name=EXCLUDED.campaign_name, adset_name=EXCLUDED.adset_name,
                    status=EXCLUDED.status,
                    image_url=EXCLUDED.image_url, thumbnail_url=EXCLUDED.thumbnail_url,
                    impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
                    spend=EXCLUDED.spend, conversions=EXCLUDED.conversions,
                    ctr=EXCLUDED.ctr, cpc=EXCLUDED.cpc, cpa=EXCLUDED.cpa,
                    utm_content=EXCLUDED.utm_content,
                    funnel_sessions=EXCLUDED.funnel_sessions, funnel_signups=EXCLUDED.funnel_signups,
                    funnel_completions=EXCLUDED.funnel_completions, funnel_cvr=EXCLUDED.funnel_cvr,
                    last_synced_at=NOW()
            """,
                META_AD_ACCOUNT, c["ad_id"], c["ad_name"], c["creative_id"], c["creative_name"],
                c["campaign_id"], c["campaign_name"], c["adset_id"], c["adset_name"], c["status"],
                c["image_url"], c["thumbnail_url"], c["image_hash"], c.get("video_id"),
                c["impressions"], c["clicks"], c["spend"], c["conversions"],
                c["ctr"], c["cpc"], c["cpa"],
                c["ad_name"],  # utm_content = ad_name
                funnel["sessions"], funnel["signups"], funnel["completions"], funnel_cvr,
                datetime.strptime(since_str, "%Y-%m-%d").date(),
                datetime.strptime(until_str, "%Y-%m-%d").date(),
            )
        count += 1

    logger.info("Done — %d creatives upserted with funnel data", count)
    return count


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=3, statement_cache_size=0)
    try:
        count = await backfill_creatives(pool, args.days)
        logger.info("DONE — %d creatives", count)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
