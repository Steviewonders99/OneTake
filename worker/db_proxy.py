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
        rows = await query(
            "SELECT NULL as campaign_name, source, medium, "
            "NULL as utm_campaign, NULL as utm_term, NULL as utm_content, "
            "SUM(clicks) as wp_entry, 0 as apply_click, 0 as signup, 0 as mfa_setup, "
            "0 as profile_created, SUM(conversions) as nda_signed, "
            "0 as certification, 0 as browsing_jobs, 0 as doing_tasks "
            "FROM ga4_organic_weekly WHERE project_id = $1::UUID "
            "AND week_start >= $2 AND week_start <= $3 "
            "GROUP BY source, medium ORDER BY SUM(clicks) DESC",
            pid, start, end,
        )
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
        return web.json_response({
            "by_source": rows,
            "utm_detail": utm_detail,
            "totals": {
                "wp_entry": tw, "apply_click": range_total("apply_click"),
                "signup": 0, "mfa_setup": 0, "profile_created": 0,
                "nda_signed": tn, "certification": 0, "browsing_jobs": 0, "doing_tasks": 0,
            },
            "rates": {
                "wp_to_nda": round(tn / tw * 100, 1) if tw > 0 else 0,
                "wp_to_apply": 0, "wp_to_signup": 0, "wp_to_tasks": 0,
                "nda_to_tasks": 0, "apply_to_nda": 0,
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


async def refresh_view(request: web.Request):
    try:
        await execute("REFRESH MATERIALIZED VIEW project_weekly_summary")
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)[:200]}, status=500)


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
    app.router.add_post("/pages/normalize", normalize_pages)
    app.router.add_post("/projects/sync", trigger_sync)
    app.router.add_post("/refresh", refresh_view)

    return app


if __name__ == "__main__":
    app = create_app()
    logger.info("Starting DB proxy on port %d", PROXY_PORT)
    web.run_app(app, host="0.0.0.0", port=PROXY_PORT)
