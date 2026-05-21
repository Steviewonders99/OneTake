#!/usr/bin/env python3.12
"""Lightweight DB proxy — exposes Azure PG data as JSON endpoints.

Runs as a simple aiohttp server inside the Azure Container App.
Vercel (Next.js) calls these endpoints instead of querying Azure PG directly,
bypassing the IP whitelist issue.

Endpoints:
  GET /health                          → { "ok": true }
  GET /projects                        → list all projects
  GET /projects/:id/funnel?view=weekly → weekly funnel data
  GET /projects/:id/channels           → channel links
  GET /projects/unclassified           → unclassified UTMs
  POST /projects/sync                  → trigger WP sync + auto-link
  POST /refresh                        → refresh materialized view

Auth: Bearer token via PROXY_SECRET env var.

Usage:
  PROXY_SECRET=mysecret python3.12 worker/db_proxy.py
  # Listens on port 8080 by default (PROXY_PORT env var)
"""
from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any

import uuid as _uuid
from decimal import Decimal

import asyncpg
from aiohttp import web

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("AZURE_DATABASE_URL", "")
PROXY_SECRET = os.environ.get("PROXY_SECRET", "")
PROXY_PORT = int(os.environ.get("PROXY_PORT", "8080"))

pool: asyncpg.Pool | None = None


# ── Middleware: Auth ──────────────────────────────────────────────

# ── Rate limiting (in-memory, per-IP) ────────────────────────────
_rate_limiter: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 1000    # requests per window (66 projects × ~5 endpoints per dashboard load)

def _check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    import time
    now = time.time()
    if ip not in _rate_limiter:
        _rate_limiter[ip] = []
    # Purge old entries
    _rate_limiter[ip] = [t for t in _rate_limiter[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limiter[ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_limiter[ip].append(now)
    return True


@web.middleware
async def security_middleware(request: web.Request, handler):
    # Rate limiting
    ip = request.remote or "unknown"
    if not _check_rate_limit(ip):
        return web.json_response({"error": "Rate limited"}, status=429)

    # Auth check (skip for health endpoint)
    if request.path != "/health":
        if not PROXY_SECRET:
            return web.json_response({"error": "Server misconfigured"}, status=500)
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer ") or len(auth) < 20:
            return web.json_response({"error": "Unauthorized"}, status=401)
        # Constant-time comparison to prevent timing attacks
        import hmac
        provided = auth[7:]  # strip "Bearer "
        if not hmac.compare_digest(provided, PROXY_SECRET):
            return web.json_response({"error": "Unauthorized"}, status=401)

    # Execute handler with error sanitization
    try:
        response = await handler(request)
    except Exception as e:
        logger.error("Request error: %s", e)
        return web.json_response({"error": "Internal server error"}, status=500)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Server"] = "onetake-proxy"  # hide Python/aiohttp version
    response.headers["Referrer-Policy"] = "no-referrer"

    return response


# ── Helpers ──────────────────────────────────────────────────────

def row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, _uuid.UUID):
            d[k] = str(v)
        elif isinstance(v, Decimal):
            d[k] = float(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, list):
            d[k] = [str(i) for i in v]
    return d


async def query(sql: str, *args) -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
        return [row_to_dict(r) for r in rows]


async def execute(sql: str, *args) -> str:
    async with pool.acquire() as conn:
        return await conn.execute(sql, *args)


# ── Routes ───────────────────────────────────────────────────────

async def health(request: web.Request):
    return web.json_response({"ok": True, "db": pool is not None})


async def list_projects(request: web.Request):
    status = request.query.get("status", "active")
    rows = await query(
        "SELECT * FROM projects WHERE status = $1 ORDER BY codename", status
    )
    return web.json_response(rows)


async def get_project(request: web.Request):
    pid = request.match_info["id"]
    rows = await query("SELECT * FROM projects WHERE id = $1::UUID", pid)
    if not rows:
        return web.json_response({"error": "Not found"}, status=404)
    return web.json_response(rows[0])


async def get_funnel(request: web.Request):
    pid = request.match_info["id"]
    view = request.query.get("view", "weekly")

    if view == "daily":
        from datetime import date as _date
        start = _date.fromisoformat(request.query.get("start", "2026-01-01"))
        end = _date.fromisoformat(request.query.get("end", "2099-12-31"))
        try:
            rows = await query(
                "SELECT codename, date::TEXT as date, platform, channel, metric_type, "
                "COALESCE(impressions,0) as impressions, COALESCE(clicks,0) as clicks, "
                "COALESCE(spend::FLOAT,0) as spend, COALESCE(conversions,0) as conversions "
                "FROM project_daily_funnel WHERE project_id = $1::UUID "
                "AND date >= $2 AND date <= $3 ORDER BY date",
                pid, start, end,
            )
        except Exception as e:
            logger.error("Daily funnel error: %s", e)
            return web.json_response({"error": str(e)[:200]}, status=500)
        return web.json_response(rows)

    # Weekly with WoW
    rows = await query(
        "SELECT * FROM project_weekly_summary WHERE project_id = $1::UUID "
        "ORDER BY week_start DESC LIMIT 12",
        pid,
    )

    current = rows[0] if rows else None
    previous = rows[1] if len(rows) > 1 else None

    wow = None
    if current and previous:
        def delta(key):
            c = current.get(key, 0) or 0
            p = previous.get(key, 0) or 0
            if p == 0:
                return None
            return round((c - p) / p * 100, 1)

        wow = {
            "impressions": delta("total_impressions"),
            "clicks": delta("total_clicks"),
            "spend": delta("total_spend"),
            "conversions": delta("total_conversions"),
            "cpa_direction": (
                "up" if (current.get("blended_cpa") or 0) > (previous.get("blended_cpa") or 0)
                else "down"
            ) if current.get("blended_cpa") and previous.get("blended_cpa") else None,
        }

    return web.json_response({
        "weeks": rows,
        "wow": wow,
        "current": current,
        "previous": previous,
    })


async def get_channels(request: web.Request):
    pid = request.match_info["id"]
    rows = await query(
        "SELECT pcl.*, cd.slug AS channel_slug, cd.display_name AS channel_name, "
        "cd.category AS channel_category "
        "FROM project_channel_links pcl "
        "JOIN channel_definitions cd ON cd.id = pcl.channel_id "
        "WHERE pcl.project_id = $1::UUID "
        "ORDER BY cd.category, pcl.confidence DESC",
        pid,
    )
    return web.json_response(rows)


async def get_unclassified(request: web.Request):
    items = await query("SELECT * FROM unclassified_channels_pending")
    channels = await query("SELECT * FROM channel_definitions ORDER BY category, slug")
    return web.json_response({"items": items, "channels": channels})


async def normalize_pages(request: web.Request):
    """Normalize page paths to human-readable display names."""
    body = await request.json()
    paths = body.get("paths", [])
    if not paths:
        return web.json_response({})

    results = {}
    for path in paths[:200]:  # max 200 at a time
        rows = await query("SELECT normalize_page_path($1) AS name", path)
        results[path] = rows[0]["name"] if rows else path

    return web.json_response(results)


async def trigger_sync(request: web.Request):
    """Trigger project sync — links intakes, discovers aliases, links channels."""
    results = []

    # Link intake_requests
    r = await query("SELECT link_intake_to_projects() AS count")
    results.append({"step": "intake_link", "result": f"{r[0]['count']} linked"})

    # Refresh view
    try:
        await execute("REFRESH MATERIALIZED VIEW project_weekly_summary")
        results.append({"step": "refresh_view", "result": "done"})
    except Exception as e:
        results.append({"step": "refresh_view", "result": f"error: {str(e)[:100]}"})

    return web.json_response({"ok": True, "steps": results})


async def get_ga4_funnel(request: web.Request):
    """GA4 acquisition funnel: WP entry → profile → NDA per project.
    Optional ?start=YYYY-MM-DD&end=YYYY-MM-DD for date-filtered source breakdown.
    """
    from datetime import date as _date
    pid = request.match_info["id"]
    start_str = request.query.get("start")
    end_str = request.query.get("end")

    # Date-filtered path: use ga4_organic_weekly which has source/medium per week
    if start_str and end_str:
        start = _date.fromisoformat(start_str)
        end = _date.fromisoformat(end_str)
        # Date-filtered views + conversions from organic weekly
        range_rows = await query(
            "SELECT source, medium, SUM(clicks) as wp_entry, SUM(conversions) as nda_signed "
            "FROM ga4_organic_weekly WHERE project_id = $1::UUID "
            "AND week_start >= $2 AND week_start <= $3 "
            "GROUP BY source, medium ORDER BY SUM(clicks) DESC",
            pid, start, end,
        )
        # All-time apply_click + signup per source (not in organic weekly)
        alltime_sources = await query(
            "SELECT source, medium, SUM(apply_click) as apply_click, SUM(signup) as signup "
            "FROM ga4_project_funnel WHERE project_id = $1::UUID "
            "AND source NOT IN ('all_campaigns', 'lp_entry') "
            "AND utm_content IS NULL AND utm_term IS NULL AND utm_campaign IS NULL "
            "GROUP BY source, medium",
            pid,
        )
        at_map = {(r["source"], r["medium"]): r for r in alltime_sources}
        # Merge: date-filtered views/NDA + all-time apply/signup
        rows = []
        for r in range_rows:
            at = at_map.get((r["source"], r["medium"]), {})
            rows.append({
                "campaign_name": None, "source": r["source"], "medium": r["medium"],
                "utm_campaign": None, "utm_term": None, "utm_content": None,
                "wp_entry": r["wp_entry"], "apply_click": at.get("apply_click", 0) or 0,
                "signup": at.get("signup", 0) or 0, "mfa_setup": 0, "profile_created": 0,
                "nda_signed": r["nda_signed"], "certification": 0, "browsing_jobs": 0, "doing_tasks": 0,
            })
        # Also get UTM detail in range
        utm_detail = await query(
            "SELECT source, medium, utm_content, utm_term, "
            "SUM(wp_entry) as wp_entry, SUM(nda_signed) as nda_signed "
            "FROM ga4_project_funnel WHERE project_id = $1::UUID "
            "AND (utm_content IS NOT NULL OR utm_term IS NOT NULL) "
            "GROUP BY source, medium, utm_content, utm_term "
            "ORDER BY SUM(nda_signed) DESC, SUM(wp_entry) DESC",
            pid,
        )
        def range_total(key):
            return sum(r.get(key, 0) or 0 for r in rows)
        tw = range_total("wp_entry")
        tn = range_total("nda_signed")
        # Get apply_click + signup from all-time ga4_project_funnel (not in organic weekly)
        alltime = await query(
            "SELECT SUM(apply_click) as apply_click, SUM(signup) as signup "
            "FROM ga4_project_funnel WHERE project_id = $1::UUID "
            "AND source = 'all_campaigns'",
            pid,
        )
        at = alltime[0] if alltime else {}
        ac = at.get("apply_click", 0) or 0
        su = at.get("signup", 0) or 0
        return web.json_response({
            "by_source": rows,
            "utm_detail": utm_detail,
            "totals": {
                "wp_entry": tw, "apply_click": ac,
                "signup": su, "mfa_setup": 0, "profile_created": 0,
                "nda_signed": tn, "certification": 0, "browsing_jobs": 0, "doing_tasks": 0,
            },
            "rates": {
                "wp_to_apply": round(ac / tw * 100, 1) if tw > 0 else 0,
                "wp_to_nda": round(tn / tw * 100, 1) if tw > 0 else 0,
                "wp_to_signup": round(su / tw * 100, 1) if tw > 0 else 0,
                "wp_to_tasks": 0,
                "nda_to_tasks": 0,
                "apply_to_nda": round(tn / ac * 100, 1) if ac > 0 else 0,
            },
        })

    # All-time path (no date filter)
    # Per-source breakdown (exclude aggregate rows)
    rows = await query(
        "SELECT NULL as campaign_name, source, medium, "
        "NULL as utm_campaign, NULL as utm_term, NULL as utm_content, "
        "SUM(wp_entry) as wp_entry, SUM(apply_click) as apply_click, "
        "SUM(signup) as signup, SUM(mfa_setup) as mfa_setup, "
        "SUM(profile_created) as profile_created, SUM(nda_signed) as nda_signed, "
        "SUM(certification) as certification, SUM(browsing_jobs) as browsing_jobs, "
        "SUM(doing_tasks) as doing_tasks "
        "FROM ga4_project_funnel WHERE project_id = $1::UUID "
        "AND utm_content IS NULL AND utm_term IS NULL AND utm_campaign IS NULL "
        "AND source NOT IN ('all_campaigns', 'lp_entry') "
        "GROUP BY source, medium ORDER BY SUM(wp_entry) DESC, SUM(nda_signed) DESC",
        pid,
    )
    # Totals from the aggregate row (or sum of per-source if no aggregate)
    agg = await query(
        "SELECT SUM(wp_entry) as wp_entry, SUM(apply_click) as apply_click, "
        "SUM(signup) as signup, SUM(mfa_setup) as mfa_setup, "
        "SUM(profile_created) as profile_created, SUM(nda_signed) as nda_signed, "
        "SUM(certification) as certification, SUM(browsing_jobs) as browsing_jobs, "
        "SUM(doing_tasks) as doing_tasks "
        "FROM ga4_project_funnel WHERE project_id = $1::UUID "
        "AND source IN ('all_campaigns', 'lp_entry') "
        "AND utm_content IS NULL AND utm_term IS NULL AND utm_campaign IS NULL",
        pid,
    )
    # Also fetch UTM detail rows (non-null utm_content or utm_term)
    utm_detail = await query(
        "SELECT source, medium, utm_content, utm_term, "
        "SUM(wp_entry) as wp_entry, SUM(nda_signed) as nda_signed "
        "FROM ga4_project_funnel WHERE project_id = $1::UUID "
        "AND (utm_content IS NOT NULL OR utm_term IS NOT NULL) "
        "GROUP BY source, medium, utm_content, utm_term "
        "ORDER BY SUM(nda_signed) DESC, SUM(wp_entry) DESC",
        pid,
    )

    # Use aggregate row for totals (includes LP entry + campaign totals)
    agg_row = agg[0] if agg else {}
    def agg_total(key):
        v = agg_row.get(key, 0)
        return v if v else sum(r.get(key, 0) or 0 for r in rows)

    tw = agg_total("wp_entry")
    return web.json_response({
        "by_source": rows,
        "utm_detail": utm_detail,
        "totals": {
            "wp_entry": tw,
            "apply_click": agg_total("apply_click"),
            "signup": agg_total("signup"),
            "mfa_setup": agg_total("mfa_setup"),
            "profile_created": agg_total("profile_created"),
            "nda_signed": agg_total("nda_signed"),
            "certification": agg_total("certification"),
            "browsing_jobs": agg_total("browsing_jobs"),
            "doing_tasks": agg_total("doing_tasks"),
        },
        "rates": {
            "wp_to_apply": round(agg_total("apply_click") / tw * 100, 1) if tw > 0 else 0,
            "wp_to_signup": round(agg_total("signup") / tw * 100, 1) if tw > 0 else 0,
            "wp_to_nda": round(agg_total("nda_signed") / tw * 100, 1) if tw > 0 else 0,
            "wp_to_tasks": round(agg_total("doing_tasks") / tw * 100, 1) if tw > 0 else 0,
            "nda_to_tasks": round(agg_total("doing_tasks") / agg_total("nda_signed") * 100, 1) if agg_total("nda_signed") > 0 else 0,
            "apply_to_nda": round(agg_total("nda_signed") / agg_total("apply_click") * 100, 1) if agg_total("apply_click") > 0 else 0,
        },
    })


async def get_locales(request: web.Request):
    """Per-language apply links + platform request IDs for a project."""
    pid = request.match_info["id"]
    rows = await query(
        "SELECT language, apply_url, platform_request_id, is_active, first_seen_at, last_seen_at "
        "FROM project_locale_links WHERE project_id = $1::UUID ORDER BY language",
        pid,
    )
    return web.json_response(rows)


async def get_paid_summary(request: web.Request):
    """Paid campaign metrics from NDM: impressions, clicks, spend, CPM, CTR, CPC, CPA."""
    from datetime import date as _date
    pid = request.match_info["id"]
    start_str = request.query.get("start")
    end_str = request.query.get("end")

    where_date = ""
    params = [pid]
    if start_str and end_str:
        start = _date.fromisoformat(start_str)
        end = _date.fromisoformat(end_str)
        where_date = " AND date >= $2 AND date <= $3"
        params.extend([start, end])

    rows = await query(
        f"SELECT channel as campaign, "
        f"SUM(impressions) as impressions, SUM(clicks) as clicks, "
        f"SUM(spend)::FLOAT as spend, SUM(conversions) as conversions "
        f"FROM normalized_daily_metrics WHERE project_id = $1::UUID{where_date} "
        f"GROUP BY channel ORDER BY SUM(spend) DESC",
        *params,
    )

    total_imp = sum(r.get("impressions", 0) or 0 for r in rows)
    total_clicks = sum(r.get("clicks", 0) or 0 for r in rows)
    total_spend = sum(r.get("spend", 0) or 0 for r in rows)
    # Use GA4 conversions (real) instead of NDM conversions (Meta-reported, often inflated)
    # Date-filtered: use ga4_organic_weekly if dates provided, else all-time ga4_project_funnel
    if start_str and end_str:
        from datetime import date as _date2
        s2 = _date2.fromisoformat(start_str)
        e2 = _date2.fromisoformat(end_str)
        ga4_conv_row = await query(
            "SELECT SUM(conversions) as nda_signed FROM ga4_organic_weekly "
            "WHERE project_id = $1::UUID AND week_start >= $2 AND week_start <= $3",
            pid, s2, e2,
        )
    else:
        ga4_conv_row = await query(
            "SELECT nda_signed FROM ga4_project_funnel WHERE project_id = $1::UUID AND source = 'all_campaigns'",
            pid,
        )
    ga4_conv = ga4_conv_row[0].get("nda_signed", 0) if ga4_conv_row else 0
    real_conv = ga4_conv if ga4_conv > 0 else sum(r.get("conversions", 0) or 0 for r in rows)

    # Add computed metrics per campaign (use NDM for media metrics, GA4 for CPA)
    for r in rows:
        imp = r.get("impressions", 0) or 0
        cl = r.get("clicks", 0) or 0
        sp = r.get("spend", 0) or 0
        r["cpm"] = round(sp / imp * 1000, 2) if imp > 0 else 0
        r["ctr"] = round(cl / imp * 100, 2) if imp > 0 else 0
        r["cpc"] = round(sp / cl, 2) if cl > 0 else 0
        # CPA uses GA4 conversions proportional to spend share
        share = sp / total_spend if total_spend > 0 else 0
        camp_conv = round(real_conv * share)
        r["conversions"] = camp_conv
        r["cpa"] = round(sp / camp_conv, 2) if camp_conv > 0 else 0

    return web.json_response({
        "campaigns": rows,
        "totals": {
            "impressions": total_imp, "clicks": total_clicks,
            "spend": round(total_spend, 2), "conversions": real_conv,
            "cpm": round(total_spend / total_imp * 1000, 2) if total_imp > 0 else 0,
            "ctr": round(total_clicks / total_imp * 100, 2) if total_imp > 0 else 0,
            "cpc": round(total_spend / total_clicks, 2) if total_clicks > 0 else 0,
            "cpa": round(total_spend / real_conv, 2) if real_conv > 0 else 0,
        },
    })


async def get_country_performance(request: web.Request):
    """Per-country funnel performance: views, apply clicks, applications."""
    pid = request.match_info["id"]
    rows = await query(
        "SELECT country, page_views, apply_clicks, applications "
        "FROM project_country_performance WHERE project_id = $1::UUID "
        "ORDER BY page_views DESC",
        pid,
    )
    return web.json_response(rows)


async def get_portfolio_countries(request: web.Request):
    """Aggregate country performance across all projects — for Command Center country slicer."""
    rows = await query(
        "SELECT country, count(DISTINCT project_id) as projects, "
        "SUM(page_views) as page_views, SUM(apply_clicks) as apply_clicks, "
        "SUM(applications) as applications "
        "FROM project_country_performance "
        "GROUP BY country ORDER BY SUM(page_views) DESC",
    )
    # Also return which project_ids are in each country for filtering
    mapping = await query(
        "SELECT country, array_agg(DISTINCT project_id::TEXT) as project_ids "
        "FROM project_country_performance "
        "GROUP BY country",
    )
    country_projects = {r["country"]: r["project_ids"] for r in mapping}
    for r in rows:
        r["project_ids"] = country_projects.get(r["country"], [])
    return web.json_response(rows)


async def refresh_view(request: web.Request):
    try:
        await execute("REFRESH MATERIALIZED VIEW project_weekly_summary")
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)[:200]}, status=500)


async def get_meta_organic_posts(request: web.Request):
    """Meta organic posts — FB or IG with engagement metrics."""
    platform = request.query.get("platform", "")  # facebook | instagram
    limit = min(int(request.query.get("limit", "30")), 100)
    sort = request.query.get("sort", "engagement")  # engagement | reach | published_at

    order_col = {
        "engagement": "COALESCE(engagement,0)",
        "reach": "COALESCE(reach,0)",
        "published_at": "published_at",
        "likes": "COALESCE(likes,0)",
        "saves": "COALESCE(saves,0)",
    }.get(sort, "COALESCE(engagement,0)")

    where = "WHERE 1=1"
    params: list = []
    if platform:
        params.append(platform)
        where += f" AND platform = ${len(params)}"

    params.append(limit)
    rows = await query(
        f"SELECT post_id, platform, post_type, post_url, "
        f"LEFT(post_text, 200) as post_text, published_at, "
        f"COALESCE(impressions,0) as impressions, COALESCE(reach,0) as reach, "
        f"COALESCE(engagement,0) as engagement, COALESCE(likes,0) as likes, "
        f"COALESCE(comments,0) as comments, COALESCE(shares,0) as shares, "
        f"COALESCE(saves,0) as saves, COALESCE(clicks,0) as clicks, "
        f"COALESCE(video_views,0) as video_views, "
        f"COALESCE(engagement_rate,0) as engagement_rate "
        f"FROM meta_organic_cache {where} "
        f"ORDER BY {order_col} DESC LIMIT ${len(params)}",
        *params,
    )
    # Also provide summary stats
    summary = await query(
        f"SELECT COUNT(*) as total_posts, "
        f"COALESCE(SUM(impressions),0) as total_impressions, "
        f"COALESCE(SUM(reach),0) as total_reach, "
        f"COALESCE(SUM(engagement),0) as total_engagement, "
        f"COALESCE(SUM(likes),0) as total_likes, "
        f"COALESCE(SUM(comments),0) as total_comments, "
        f"COALESCE(SUM(shares),0) as total_shares, "
        f"COALESCE(SUM(saves),0) as total_saves "
        f"FROM meta_organic_cache {where.replace(f' LIMIT ${len(params)}', '')}",
        *params[:-1] if platform else [],
    )
    return web.json_response({
        "posts": rows,
        "summary": summary[0] if summary else {},
    })


async def get_meta_ads_detail(request: web.Request):
    """Meta ads at campaign or adset level with full metrics."""
    level = request.query.get("level", "campaign")  # campaign | adset
    limit = min(int(request.query.get("limit", "30")), 100)

    if level == "adset":
        rows = await query(
            "SELECT campaign_name, adset_id, adset_name, "
            "SUM(COALESCE(impressions,0)) as impressions, "
            "SUM(COALESCE(clicks,0)) as clicks, "
            "SUM(COALESCE(conversions,0)) as conversions, "
            "SUM(COALESCE(spend,0))::FLOAT as spend "
            "FROM meta_ads_cache "
            "GROUP BY campaign_name, adset_id, adset_name "
            "ORDER BY SUM(COALESCE(spend,0)) DESC LIMIT $1",
            limit,
        )
    else:
        rows = await query(
            "SELECT campaign_name, "
            "COUNT(DISTINCT adset_id) as adsets, COUNT(DISTINCT ad_id) as ads, "
            "SUM(COALESCE(impressions,0)) as impressions, "
            "SUM(COALESCE(clicks,0)) as clicks, "
            "SUM(COALESCE(conversions,0)) as conversions, "
            "SUM(COALESCE(spend,0))::FLOAT as spend "
            "FROM meta_ads_cache "
            "GROUP BY campaign_name "
            "ORDER BY SUM(COALESCE(spend,0)) DESC LIMIT $1",
            limit,
        )

    # Computed metrics per row
    for r in rows:
        imp = r.get("impressions", 0) or 0
        cl = r.get("clicks", 0) or 0
        sp = r.get("spend", 0) or 0
        cv = r.get("conversions", 0) or 0
        r["cpm"] = round(sp / imp * 1000, 2) if imp > 0 else 0
        r["ctr"] = round(cl / imp * 100, 2) if imp > 0 else 0
        r["cpc"] = round(sp / cl, 2) if cl > 0 else 0
        r["cpa"] = round(sp / cv, 2) if cv > 0 else 0

    return web.json_response(rows)


async def get_organic_landing_pages(request: web.Request):
    """Top organic landing pages from GA4 (sessions, conversions by page path)."""
    source = request.query.get("source", "")
    limit = min(int(request.query.get("limit", "30")), 100)

    where = "WHERE 1=1"
    params: list = []
    if source:
        params.append(source)
        where += f" AND source = ${len(params)}"

    params.append(limit)
    rows = await query(
        f"SELECT page_path, source, sessions, users, conversions "
        f"FROM ga4_organic_landing_pages {where} "
        f"ORDER BY sessions DESC LIMIT ${len(params)}",
        *params,
    )
    return web.json_response(rows)


async def get_gsc_keywords(request: web.Request):
    """Top GSC keywords: clicks, impressions, ctr, position."""
    from datetime import date as _date
    start = _date.fromisoformat(request.query.get("start", "2026-01-01"))
    end = _date.fromisoformat(request.query.get("end", "2099-12-31"))
    limit = min(int(request.query.get("limit", "50")), 200)

    rows = await query(
        "SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions, "
        "ROUND(AVG(ctr)::NUMERIC * 100, 1) as ctr, ROUND(AVG(position)::NUMERIC, 1) as position "
        "FROM gsc_daily_cache WHERE date >= $1 AND date <= $2 "
        "GROUP BY query ORDER BY SUM(clicks) DESC LIMIT $3",
        start, end, limit,
    )
    return web.json_response(rows)


async def get_gsc_pages(request: web.Request):
    """Top GSC landing pages: clicks, impressions, ctr, position."""
    from datetime import date as _date
    start = _date.fromisoformat(request.query.get("start", "2026-01-01"))
    end = _date.fromisoformat(request.query.get("end", "2099-12-31"))
    limit = min(int(request.query.get("limit", "50")), 200)

    rows = await query(
        "SELECT page, SUM(clicks) as clicks, SUM(impressions) as impressions, "
        "ROUND(AVG(ctr)::NUMERIC * 100, 1) as ctr, ROUND(AVG(position)::NUMERIC, 1) as position "
        "FROM gsc_daily_cache WHERE date >= $1 AND date <= $2 "
        "GROUP BY page ORDER BY SUM(clicks) DESC LIMIT $3",
        start, end, limit,
    )
    return web.json_response(rows)


# ── App Setup ────────────────────────────────────────────────────

async def on_startup(app: web.Application):
    global pool
    if not DATABASE_URL:
        logger.error("DATABASE_URL or AZURE_DATABASE_URL not set")
        sys.exit(1)
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5, statement_cache_size=0)
    logger.info("DB pool created → %s", DATABASE_URL.split("@")[1].split("/")[0] if "@" in DATABASE_URL else "unknown")


async def on_cleanup(app: web.Application):
    if pool:
        await pool.close()


def create_app() -> web.Application:
    app = web.Application(middlewares=[security_middleware])
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    app.router.add_get("/health", health)
    app.router.add_get("/projects", list_projects)
    app.router.add_get("/projects/unclassified", get_unclassified)
    app.router.add_get("/projects/{id}", get_project)
    app.router.add_get("/projects/{id}/funnel", get_funnel)
    app.router.add_get("/projects/{id}/ga4-funnel", get_ga4_funnel)
    app.router.add_get("/projects/{id}/locales", get_locales)
    app.router.add_get("/projects/{id}/channels", get_channels)
    app.router.add_get("/projects/{id}/countries", get_country_performance)
    app.router.add_get("/countries", get_portfolio_countries)
    app.router.add_get("/projects/{id}/paid", get_paid_summary)
    app.router.add_get("/meta/organic-posts", get_meta_organic_posts)
    app.router.add_get("/meta/ads", get_meta_ads_detail)
    app.router.add_get("/ga4/landing-pages", get_organic_landing_pages)
    app.router.add_get("/gsc/keywords", get_gsc_keywords)
    app.router.add_get("/gsc/pages", get_gsc_pages)
    app.router.add_post("/pages/normalize", normalize_pages)
    app.router.add_post("/projects/sync", trigger_sync)
    app.router.add_post("/refresh", refresh_view)

    return app


if __name__ == "__main__":
    app = create_app()
    logger.info("Starting DB proxy on port %d", PROXY_PORT)
    web.run_app(app, host="0.0.0.0", port=PROXY_PORT)
