#!/usr/bin/env python3.12
"""Comprehensive GA4 sync — pulls ALL funnel data automatically.

Single script that replaces all manual seeding. Runs on 3h cron.

Pulls from GA4 Data API:
1. Campaign × source × medium × event → project funnel + per-source breakdown
2. Campaign × source × medium × utm_content → UTM detail (LinkedIn, Handshake, etc.)
3. Campaign × country × event → country performance
4. Page path × source × medium → organic project page views

Maps campaigns to projects using DB aliases + codename fuzzy matching.
Seeds: ga4_project_funnel, ga4_organic_weekly, project_country_performance
Rebuilds: project_weekly_summary materialized view

Usage:
    python3.12 worker/scripts/sync_ga4_all.py

Env: DATABASE_URL, GOOGLE_APPLICATION_CREDENTIALS (or ~/.config/gcloud/application_default_credentials.json)
"""
from __future__ import annotations
import asyncio
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import date, timedelta

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
GA4_PROPERTY = "properties/330157295"
DATE_START = (date.today() - timedelta(days=90)).isoformat()
DATE_END = date.today().isoformat()

EVENT_MAP = {"page_view": "wp_entry", "apply_click": "apply_click", "sign_up": "signup", "purchase": "nda_signed"}


def build_campaign_resolver(projects: list[dict]) -> callable:
    """Build a campaign → project_id resolver from DB project data.

    Uses codename, wp_slug, and aliases for fuzzy matching.
    No hardcoded campaign lists — fully data-driven.
    """
    # Exact matches: codename and wp_slug
    exact = {}
    for p in projects:
        cn = p["codename"].lower()
        exact[cn] = p["id"]
        exact[cn.replace("_", "-")] = p["id"]
        exact[cn.replace("-", "_")] = p["id"]
        if p.get("wp_slug"):
            exact[p["wp_slug"].lower()] = p["id"]

    # Build prefix patterns from codenames (first word)
    prefixes = []
    for p in projects:
        cn = p["codename"].lower()
        # First meaningful word (3+ chars)
        first = cn.split("_")[0].split("-")[0]
        if len(first) >= 3:
            prefixes.append((first, p["id"]))

    def resolve(campaign_name: str) -> str | None:
        if campaign_name in ("(organic)", "(direct)", "(referral)", "(not set)"):
            return None
        low = campaign_name.lower().strip()
        # Exact match
        if low in exact:
            return exact[low]
        # Remove common suffixes and try again
        cleaned = re.sub(r"[-_\s]+(conv|cold|std|nyc|lv|phx|kids|adults|pitch|annotation).*$", "", low, flags=re.I)
        if cleaned in exact:
            return exact[cleaned]
        # Prefix match (first word of campaign matches first word of codename)
        campaign_first = re.split(r"[\s_\-]", low)[0]
        if len(campaign_first) >= 3:
            for prefix, pid in prefixes:
                if campaign_first == prefix or low.startswith(prefix):
                    return pid
        return None

    return resolve


async def run_ga4_report(client, dimensions: list[str], metrics: list[str],
                         dim_filter=None, order_by=None, limit=500) -> list[dict]:
    """Run a GA4 Data API report."""
    from google.analytics.data_v1beta.types import (
        RunReportRequest, DateRange, Dimension, Metric,
    )

    dims = [Dimension(name=d) for d in dimensions]
    mets = [Metric(name=m) for m in metrics]
    dr = [DateRange(start_date=DATE_START, end_date=DATE_END)]

    request = RunReportRequest(
        property=GA4_PROPERTY,
        dimensions=dims,
        metrics=mets,
        date_ranges=dr,
        limit=limit,
        dimension_filter=dim_filter,
        order_bys=order_by,
    )

    response = client.run_report(request)
    rows = []
    for row in response.rows:
        r = {}
        for i, dv in enumerate(row.dimension_values):
            r[dimensions[i]] = dv.value
        for i, mv in enumerate(row.metric_values):
            r[metrics[i]] = int(mv.value) if "." not in mv.value else float(mv.value)
        rows.append(r)
    return rows


async def main():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    # Init GA4 client
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            FilterExpression, Filter, FilterExpressionList, OrderBy,
        )
        StringFilter = Filter.StringFilter
        InListFilter = Filter.InListFilter
        client = BetaAnalyticsDataClient()
        logger.info("GA4 client initialized")
    except Exception as e:
        logger.error("Failed to init GA4 client: %s", e)
        logger.error("Install: pip install google-analytics-data")
        sys.exit(1)

    conn = await asyncpg.connect(DATABASE_URL)
    projects = await conn.fetch("SELECT id, codename, wp_slug FROM projects WHERE status = 'active'")
    resolve = build_campaign_resolver([dict(r) for r in projects])
    cn_to_pid = {r["codename"]: r["id"] for r in projects}
    pid_to_cn = {r["id"]: r["codename"] for r in projects}
    slug_to_pid = {r["wp_slug"]: r["id"] for r in projects if r["wp_slug"]}

    # ── Query 1: Campaign × Source × Medium × Event ──────────────
    logger.info("Query 1: Campaign funnel by source...")
    skip_filter = FilterExpression(
        not_expression=FilterExpression(
            filter=Filter(
                field_name="firstUserCampaignName",
                in_list_filter=Filter.InListFilter(values=["(organic)", "(direct)", "(referral)", "(not set)"])
            )
        )
    )
    event_filter = FilterExpression(
        filter=Filter(
            field_name="eventName",
            in_list_filter=Filter.InListFilter(values=["page_view", "apply_click", "sign_up", "purchase"])
        )
    )
    combined = FilterExpression(
        and_group=FilterExpressionList(expressions=[skip_filter, event_filter])
    )

    rows = await run_ga4_report(
        client,
        ["firstUserCampaignName", "firstUserSource", "firstUserMedium", "eventName"],
        ["totalUsers"],
        dim_filter=combined,
        limit=10000,
    )
    logger.info("  Got %d rows", len(rows))

    # Aggregate into project data
    proj_totals = defaultdict(lambda: defaultdict(int))
    proj_sources = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

    for r in rows:
        pid = resolve(r["firstUserCampaignName"])
        if not pid:
            continue
        field = EVENT_MAP.get(r["eventName"])
        if not field:
            continue
        proj_totals[pid][field] += r["totalUsers"]
        proj_sources[pid][(r["firstUserSource"], r["firstUserMedium"])][field] += r["totalUsers"]

    logger.info("  Mapped to %d projects", len(proj_totals))

    # ── Query 2: UTM detail (social/job_board × utm_content) ─────
    logger.info("Query 2: UTM detail for social/job_board...")
    social_filter = FilterExpression(
        filter=Filter(
            field_name="firstUserSource",
            in_list_filter=Filter.InListFilter(values=["social", "job_board"])
        )
    )
    utm_not_set = FilterExpression(
        not_expression=FilterExpression(
            filter=Filter(
                field_name="firstUserManualAdContent",
                string_filter=Filter.StringFilter(match_type=Filter.StringFilter.MatchType.EXACT, value="(not set)")
            )
        )
    )
    utm_filter = FilterExpression(
        and_group=FilterExpressionList(expressions=[skip_filter, social_filter, utm_not_set])
    )

    utm_rows = await run_ga4_report(
        client,
        ["firstUserCampaignName", "firstUserSource", "firstUserMedium", "firstUserManualAdContent", "eventName"],
        ["totalUsers"],
        dim_filter=utm_filter,
        limit=5000,
    )
    logger.info("  Got %d UTM rows", len(utm_rows))

    utm_data = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in utm_rows:
        pid = resolve(r["firstUserCampaignName"])
        if not pid:
            continue
        field = EVENT_MAP.get(r["eventName"])
        if not field:
            continue
        key = (r["firstUserSource"], r["firstUserMedium"], r["firstUserManualAdContent"])
        utm_data[pid][key][field] += r["totalUsers"]

    # ── Query 3: Country performance ─────────────────────────────
    logger.info("Query 3: Country performance...")
    country_rows = await run_ga4_report(
        client,
        ["firstUserCampaignName", "country", "eventName"],
        ["totalUsers"],
        dim_filter=combined,
        limit=10000,
    )
    logger.info("  Got %d country rows", len(country_rows))

    country_data = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in country_rows:
        pid = resolve(r["firstUserCampaignName"])
        if not pid:
            continue
        field = EVENT_MAP.get(r["eventName"])
        if not field:
            continue
        country_data[pid][r["country"]][field] += r["totalUsers"]

    # ── Query 4: Page path views for organic projects ────────────
    logger.info("Query 4: Page path views...")
    page_filter = FilterExpression(
        filter=Filter(
            field_name="pagePath",
            string_filter=Filter.StringFilter(match_type=Filter.StringFilter.MatchType.BEGINS_WITH, value="/jobs/")
        )
    )
    page_rows = await run_ga4_report(
        client,
        ["pagePath", "firstUserSource", "firstUserMedium"],
        ["totalUsers"],
        dim_filter=page_filter,
        limit=10000,
    )
    logger.info("  Got %d page rows", len(page_rows))

    page_data = defaultdict(lambda: defaultdict(int))
    for r in page_rows:
        m = re.match(r"^/jobs/([^/?#]+)", r["pagePath"])
        if not m:
            continue
        slug = m.group(1)
        pid = slug_to_pid.get(slug)
        if pid and pid not in proj_totals:
            page_data[pid][(r["firstUserSource"], r["firstUserMedium"])] += r["totalUsers"]

    # ── Seed everything ──────────────────────────────────────────
    logger.info("Seeding ga4_project_funnel...")
    await conn.execute("DELETE FROM ga4_project_funnel")

    for pid, events in proj_totals.items():
        # Aggregate row
        await conn.execute(
            "INSERT INTO ga4_project_funnel "
            "(project_id, source, medium, wp_entry, apply_click, signup, "
            "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
            "VALUES ($1, 'all_campaigns', 'attributed', $2, $3, $4, 0, 0, $5, 0, 0, 0) "
            "ON CONFLICT DO NOTHING",
            pid, events.get("wp_entry", 0), events.get("apply_click", 0),
            events.get("signup", 0), events.get("nda_signed", 0),
        )
        # Per-source rows
        for (src, med), sevents in proj_sources[pid].items():
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 0, 0, 0) "
                "ON CONFLICT DO NOTHING",
                pid, src, med, sevents.get("wp_entry", 0), sevents.get("apply_click", 0),
                sevents.get("signup", 0), sevents.get("nda_signed", 0),
            )
        # UTM detail rows
        for (src, med, content), uevents in utm_data.get(pid, {}).items():
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, utm_content, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6, 0, 0, 0) "
                "ON CONFLICT DO NOTHING",
                pid, src, med, content, uevents.get("wp_entry", 0), uevents.get("nda_signed", 0),
            )

    # Organic-only projects (page path data)
    for pid, sources in page_data.items():
        total_views = sum(sources.values())
        await conn.execute(
            "INSERT INTO ga4_project_funnel "
            "(project_id, source, medium, wp_entry, apply_click, signup, "
            "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
            "VALUES ($1, 'all_campaigns', 'attributed', $2, 0, 0, 0, 0, 0, 0, 0, 0) "
            "ON CONFLICT DO NOTHING",
            pid, total_views,
        )
        for (src, med), views in sources.items():
            if views < 5:
                continue
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, $4, 0, 0, 0, 0, 0, 0, 0, 0) ON CONFLICT DO NOTHING",
                pid, src, med, views,
            )

    # Fill (other)/unattributed gaps
    projs = await conn.fetch("""
        SELECT p.id,
            (SELECT nda_signed FROM ga4_project_funnel WHERE project_id=p.id AND source='all_campaigns') as agg_nda,
            (SELECT wp_entry FROM ga4_project_funnel WHERE project_id=p.id AND source='all_campaigns') as agg_wp,
            (SELECT sum(nda_signed) FROM ga4_project_funnel WHERE project_id=p.id AND source NOT IN ('all_campaigns','lp_entry') AND utm_content IS NULL AND utm_term IS NULL) as src_nda,
            (SELECT sum(wp_entry) FROM ga4_project_funnel WHERE project_id=p.id AND source NOT IN ('all_campaigns','lp_entry') AND utm_content IS NULL AND utm_term IS NULL) as src_wp
        FROM projects p WHERE p.id IN (SELECT DISTINCT project_id FROM ga4_project_funnel WHERE source='all_campaigns')
    """)
    for p in projs:
        nda_gap = max((p["agg_nda"] or 0) - (p["src_nda"] or 0), 0)
        wp_gap = max((p["agg_wp"] or 0) - (p["src_wp"] or 0), 0)
        if nda_gap > 0 or wp_gap > 0:
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                "VALUES ($1, '(other)', 'unattributed', $2, 0, 0, 0, 0, $3, 0, 0, 0) ON CONFLICT DO NOTHING",
                p["id"], wp_gap, nda_gap)

    # ── Country performance ──────────────────────────────────────
    logger.info("Seeding country performance...")
    await conn.execute("DELETE FROM project_country_performance")
    for pid, countries in country_data.items():
        for country, metrics in countries.items():
            views = metrics.get("wp_entry", 0)
            if views < 3:
                continue
            await conn.execute(
                "INSERT INTO project_country_performance "
                "(project_id, country, page_views, apply_clicks, applications) "
                "VALUES ($1, $2, $3, $4, $5) "
                "ON CONFLICT (project_id, country) DO UPDATE SET "
                "page_views=EXCLUDED.page_views, apply_clicks=EXCLUDED.apply_clicks, applications=EXCLUDED.applications",
                pid, country, views, metrics.get("apply_click", 0), metrics.get("nda_signed", 0),
            )

    # ── Rebuild organic weekly + mat view ────────────────────────
    logger.info("Rebuilding organic weekly...")
    await conn.execute("DELETE FROM ga4_organic_weekly")
    await conn.execute("""
        INSERT INTO ga4_organic_weekly (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
        SELECT sub.project_id, sub.codename, sub.week_start, sub.source, sub.medium, sub.source, 'organic', sub.clicks, sub.conversions
        FROM (
            SELECT g.project_id, p.codename, ws.week_start, g.source, g.medium,
                SUM(CASE WHEN ws.week_num=1 THEN GREATEST(ROUND(g.wp_entry*0.35),0) WHEN ws.week_num=2 THEN GREATEST(ROUND(g.wp_entry*0.30),0)
                         WHEN ws.week_num=3 THEN GREATEST(ROUND(g.wp_entry*0.20),0) WHEN ws.week_num=4 THEN GREATEST(ROUND(g.wp_entry*0.15),0) ELSE 0 END) as clicks,
                SUM(CASE WHEN ws.week_num=1 THEN GREATEST(ROUND(g.nda_signed*0.35),0) WHEN ws.week_num=2 THEN GREATEST(ROUND(g.nda_signed*0.30),0)
                         WHEN ws.week_num=3 THEN GREATEST(ROUND(g.nda_signed*0.20),0) WHEN ws.week_num=4 THEN GREATEST(ROUND(g.nda_signed*0.15),0) ELSE 0 END) as conversions
            FROM ga4_project_funnel g JOIN projects p ON p.id=g.project_id
            CROSS JOIN (SELECT 1 AS week_num, date_trunc('week',CURRENT_DATE)::DATE AS week_start
                UNION ALL SELECT 2,(date_trunc('week',CURRENT_DATE)-INTERVAL '7 days')::DATE
                UNION ALL SELECT 3,(date_trunc('week',CURRENT_DATE)-INTERVAL '14 days')::DATE
                UNION ALL SELECT 4,(date_trunc('week',CURRENT_DATE)-INTERVAL '21 days')::DATE) ws
            WHERE g.utm_content IS NULL AND g.utm_term IS NULL AND g.utm_campaign IS NULL AND g.source NOT IN ('all_campaigns','lp_entry')
            GROUP BY g.project_id, p.codename, ws.week_start, g.source, g.medium
        ) sub
        ON CONFLICT (project_id,week_start,source,medium) DO UPDATE SET clicks=EXCLUDED.clicks, conversions=EXCLUDED.conversions
    """)

    logger.info("Rebuilding materialized view...")
    await conn.execute("DROP MATERIALIZED VIEW IF EXISTS project_weekly_summary")
    await conn.execute("""
        CREATE MATERIALIZED VIEW project_weekly_summary AS
        SELECT project_id, codename, date_trunc('week',date)::DATE AS week_start,
          SUM(impressions) AS total_impressions, SUM(clicks) AS total_clicks, SUM(spend) AS total_spend,
          SUM(conversions) AS total_conversions, SUM(reach) AS total_reach, SUM(engagement) AS total_engagement,
          SUM(CASE WHEN metric_type='paid' THEN spend ELSE 0 END) AS paid_spend,
          SUM(CASE WHEN metric_type='paid' THEN clicks ELSE 0 END) AS paid_clicks,
          SUM(CASE WHEN metric_type='paid' THEN conversions ELSE 0 END) AS paid_conversions,
          SUM(CASE WHEN metric_type='organic' THEN clicks ELSE 0 END) AS organic_clicks,
          SUM(CASE WHEN metric_type='email' THEN clicks ELSE 0 END) AS email_clicks,
          CASE WHEN SUM(clicks)>0 THEN SUM(conversions)::FLOAT/SUM(clicks) ELSE 0 END AS conversion_rate,
          CASE WHEN SUM(conversions)>0 THEN SUM(spend)/SUM(conversions) ELSE NULL END AS blended_cpa,
          COUNT(DISTINCT channel) AS active_channels
        FROM project_daily_funnel GROUP BY project_id, codename, date_trunc('week',date)::DATE
    """)
    await conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_project_weekly_pk ON project_weekly_summary(project_id,week_start)")

    # Final report
    funnel_count = await conn.fetchval("SELECT count(*) FROM ga4_project_funnel")
    funnel_projects = await conn.fetchval("SELECT count(DISTINCT project_id) FROM ga4_project_funnel")
    country_count = await conn.fetchval("SELECT count(*) FROM project_country_performance")
    summary_count = await conn.fetchval("SELECT count(*) FROM project_weekly_summary")

    logger.info("=== Sync complete ===")
    logger.info("  ga4_project_funnel: %d rows, %d projects", funnel_count, funnel_projects)
    logger.info("  project_country_performance: %d rows", country_count)
    logger.info("  project_weekly_summary: %d rows", summary_count)

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
