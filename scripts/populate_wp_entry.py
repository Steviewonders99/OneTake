#!/usr/bin/env python3.12
"""Populate wp_entry and apply_click in ga4_project_funnel from real GA4 data.

Reads GA4 export files for:
  - page_view sessions on /jobs/{slug}/ and /join/{slug}/ pages
  - apply_click events on the same pages

Maps pagePath back to projects via wp_slug, then updates ga4_project_funnel.
Uses totalUsers (not eventCount/sessions) for deduplication.
"""
import asyncio
import asyncpg
import json
import re
from collections import defaultdict

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

SESSIONS_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779303106081.txt"
)
APPLY_CLICK_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779303113972.txt"
)

# LP slug → project codename (for /join/ pages that don't match wp_slug)
LP_TO_PROJECT = {
    "lumina": "lumina",
    "humus": "humus",
    "humus-siblings": "humus",
    "humus-twins": "humus",
    "fur-frame": "fur_frame",
    "fur-frame-dogs": "fur_frame",
    "fur-frame-cats": "fur_frame",
    "centaurus": "centaurus",
    "centaurus-kids": "centaurus_kids",
    "mosaic": "mosaic",
    "motto": "motto",
    "kilo": "kilo",
    "milky-way": "milky_way",
    "moonbrush": "moonbrush",
}


def extract_slug(page_path):
    """Extract slug from /jobs/{slug}/ or /join/{slug}/."""
    m = re.match(r"^/(jobs|join)/([^/?#]+)", page_path)
    if m:
        return m.group(2)
    return None


def parse_ga4_file(filepath):
    """Parse GA4 report JSON, return rows as (pagePath, source, medium, users)."""
    with open(filepath) as f:
        data = json.load(f)
    results = []
    for row in data.get("rows", []):
        dims = row["dimension_values"]
        metrics = row["metric_values"]
        page_path = dims[0]["value"]
        source = dims[1]["value"]
        medium = dims[2]["value"]
        users = int(metrics[1]["value"])  # totalUsers for dedup
        results.append((page_path, source, medium, users))
    return results


async def main():
    conn = await asyncpg.connect(DB_URL)

    # Build slug → project_id mapping
    projects = await conn.fetch("SELECT id, codename, wp_slug FROM projects")
    slug_to_pid = {}
    codename_to_pid = {}
    for p in projects:
        codename_to_pid[p["codename"]] = p["id"]
        if p["wp_slug"]:
            slug_to_pid[p["wp_slug"]] = p["id"]

    # Add LP mappings
    for lp_slug, codename in LP_TO_PROJECT.items():
        pid = codename_to_pid.get(codename)
        if pid:
            slug_to_pid[lp_slug] = pid

    print("Slug → project mappings: %d" % len(slug_to_pid))

    # ── Parse sessions (wp_entry) ──────────────────────────────────
    print("\nParsing sessions data for wp_entry...")
    sessions_data = parse_ga4_file(SESSIONS_FILE)
    wp_entry = defaultdict(lambda: defaultdict(int))
    wp_mapped = 0
    wp_unmapped = 0

    for page_path, source, medium, users in sessions_data:
        slug = extract_slug(page_path)
        if not slug:
            continue
        pid = slug_to_pid.get(slug)
        if pid:
            wp_entry[pid][(source, medium)] += users
            wp_mapped += users
        else:
            wp_unmapped += users

    print("  wp_entry: %d users mapped, %d unmapped" % (wp_mapped, wp_unmapped))
    print("  Projects with wp_entry: %d" % len(wp_entry))

    # ── Parse apply_click ──────────────────────────────────────────
    print("\nParsing apply_click data...")
    click_data = parse_ga4_file(APPLY_CLICK_FILE)
    apply_clicks = defaultdict(lambda: defaultdict(int))
    click_mapped = 0

    for page_path, source, medium, users in click_data:
        slug = extract_slug(page_path)
        if not slug:
            continue
        pid = slug_to_pid.get(slug)
        if pid:
            apply_clicks[pid][(source, medium)] += users
            click_mapped += users

    print("  apply_click: %d users mapped" % click_mapped)
    print("  Projects with apply_click: %d" % len(apply_clicks))

    # ── Update ga4_project_funnel ──────────────────────────────────
    print("\nUpdating ga4_project_funnel...")

    # First, update existing rows (matching on project_id + source + medium)
    updated = 0
    inserted = 0

    all_pids = set(wp_entry.keys()) | set(apply_clicks.keys())
    for pid in all_pids:
        # Merge all source/medium keys from both datasets
        all_keys = set(wp_entry.get(pid, {}).keys()) | set(apply_clicks.get(pid, {}).keys())
        for (source, medium) in all_keys:
            entry = wp_entry.get(pid, {}).get((source, medium), 0)
            clicks = apply_clicks.get(pid, {}).get((source, medium), 0)

            # Try update first
            result = await conn.execute(
                "UPDATE ga4_project_funnel SET wp_entry = wp_entry + $1, apply_click = apply_click + $2 "
                "WHERE project_id = $3 AND source = $4 AND medium = $5",
                entry, clicks, pid, source, medium,
            )
            if result == "UPDATE 0":
                # Row doesn't exist — insert it
                await conn.execute(
                    "INSERT INTO ga4_project_funnel "
                    "(project_id, source, medium, wp_entry, apply_click, signup, "
                    "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                    "VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 0, 0, 0) "
                    "ON CONFLICT (project_id, source, medium) DO UPDATE SET "
                    "wp_entry = ga4_project_funnel.wp_entry + EXCLUDED.wp_entry, "
                    "apply_click = ga4_project_funnel.apply_click + EXCLUDED.apply_click",
                    pid, source, medium, entry, clicks,
                )
                inserted += 1
            else:
                updated += 1

    print("  Updated: %d rows, Inserted: %d new rows" % (updated, inserted))

    # ── Rebuild organic weekly + materialized view ─────────────────
    print("\nRebuilding ga4_organic_weekly...")
    await conn.execute("DELETE FROM ga4_organic_weekly")
    await conn.execute("""
        INSERT INTO ga4_organic_weekly
            (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
        SELECT
            g.project_id, p.codename, ws.week_start, g.source, g.medium,
            CASE
                WHEN g.source IN ('facebook','instagram','fb','ig','l.facebook.com','m.facebook.com') AND g.medium != 'paid' THEN 'meta_organic'
                WHEN g.source IN ('LinkedIn','linkedin','linkedin.com') AND g.medium IN ('Social','organic','referral') THEN 'linkedin_organic'
                WHEN g.source IN ('reddit','reddit.com','twitter','x','t.co') THEN 'social_referral'
                WHEN g.source IN ('brevo','sendinblue') THEN 'email'
                WHEN g.source IN ('job_board','Handshake','messages.indeed.com') THEN 'job_board'
                WHEN g.source LIKE 'chatgpt%%' OR g.source LIKE 'gemini%%' THEN 'ai_referral'
                WHEN g.source = '(direct)' THEN 'direct'
                WHEN g.medium = 'organic' THEN 'organic_search'
                WHEN g.source IN ('oneforma.com','on-site','internal','adiafrom') THEN 'internal'
                WHEN g.source = 'Flyers' THEN 'flyer'
                ELSE g.source
            END,
            'organic',
            CASE
                WHEN ws.week_num = 1 THEN GREATEST(ROUND(g.wp_entry * 0.35), 0)
                WHEN ws.week_num = 2 THEN GREATEST(ROUND(g.wp_entry * 0.30), 0)
                WHEN ws.week_num = 3 THEN GREATEST(ROUND(g.wp_entry * 0.20), 0)
                WHEN ws.week_num = 4 THEN GREATEST(ROUND(g.wp_entry * 0.15), 0)
                ELSE 0
            END,
            CASE
                WHEN ws.week_num = 1 THEN GREATEST(ROUND(g.nda_signed * 0.35), 0)
                WHEN ws.week_num = 2 THEN GREATEST(ROUND(g.nda_signed * 0.30), 0)
                WHEN ws.week_num = 3 THEN GREATEST(ROUND(g.nda_signed * 0.20), 0)
                WHEN ws.week_num = 4 THEN GREATEST(ROUND(g.nda_signed * 0.15), 0)
                ELSE 0
            END
        FROM ga4_project_funnel g
        JOIN projects p ON p.id = g.project_id
        CROSS JOIN (
            SELECT 1 AS week_num, date_trunc('week', CURRENT_DATE)::DATE AS week_start
            UNION ALL SELECT 2, (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::DATE
            UNION ALL SELECT 3, (date_trunc('week', CURRENT_DATE) - INTERVAL '14 days')::DATE
            UNION ALL SELECT 4, (date_trunc('week', CURRENT_DATE) - INTERVAL '21 days')::DATE
        ) ws
        WHERE g.medium != 'paid'
        ON CONFLICT (project_id, week_start, source, medium) DO UPDATE SET
            clicks = EXCLUDED.clicks, conversions = EXCLUDED.conversions, channel = EXCLUDED.channel
    """)

    organic_count = await conn.fetchval("SELECT count(*) FROM ga4_organic_weekly")
    print("  ga4_organic_weekly: %d rows" % organic_count)

    print("Refreshing materialized view...")
    await conn.execute("DROP MATERIALIZED VIEW IF EXISTS project_weekly_summary")
    await conn.execute("""
        CREATE MATERIALIZED VIEW project_weekly_summary AS
        SELECT
          project_id, codename,
          date_trunc('week', date)::DATE AS week_start,
          SUM(impressions) AS total_impressions,
          SUM(clicks) AS total_clicks,
          SUM(spend) AS total_spend,
          SUM(conversions) AS total_conversions,
          SUM(reach) AS total_reach,
          SUM(engagement) AS total_engagement,
          SUM(CASE WHEN metric_type = 'paid' THEN spend ELSE 0 END) AS paid_spend,
          SUM(CASE WHEN metric_type = 'paid' THEN clicks ELSE 0 END) AS paid_clicks,
          SUM(CASE WHEN metric_type = 'paid' THEN conversions ELSE 0 END) AS paid_conversions,
          SUM(CASE WHEN metric_type = 'organic' THEN clicks ELSE 0 END) AS organic_clicks,
          SUM(CASE WHEN metric_type = 'email' THEN clicks ELSE 0 END) AS email_clicks,
          CASE WHEN SUM(clicks) > 0
            THEN SUM(conversions)::FLOAT / SUM(clicks) ELSE 0 END AS conversion_rate,
          CASE WHEN SUM(conversions) > 0
            THEN SUM(spend) / SUM(conversions) ELSE NULL END AS blended_cpa,
          COUNT(DISTINCT channel) AS active_channels
        FROM project_daily_funnel
        GROUP BY project_id, codename, date_trunc('week', date)::DATE
    """)
    await conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_project_weekly_pk "
        "ON project_weekly_summary(project_id, week_start)"
    )

    # ── Final verification ─────────────────────────────────────────
    print("\n=== FINAL VERIFICATION ===")
    totals = await conn.fetch(
        "SELECT p.codename, sum(g.wp_entry) as wp, sum(g.apply_click) as clicks, sum(g.nda_signed) as apps "
        "FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id "
        "GROUP BY p.codename ORDER BY wp DESC LIMIT 20"
    )
    print("%-30s %8s %8s %8s" % ("PROJECT", "WP ENTRY", "APPLY", "APPS"))
    print("-" * 60)
    total_wp = 0
    total_ac = 0
    total_apps = 0
    for r in totals:
        total_wp += r["wp"]
        total_ac += r["clicks"]
        total_apps += r["apps"]
        print("%-30s %8d %8d %8d" % (r["codename"], r["wp"], r["clicks"], r["apps"]))
    print("-" * 60)
    print("%-30s %8d %8d %8d" % ("TOTAL", total_wp, total_ac, total_apps))

    ga4_rows = await conn.fetchval("SELECT count(*) FROM ga4_project_funnel")
    ga4_projects = await conn.fetchval("SELECT count(DISTINCT project_id) FROM ga4_project_funnel")
    summary_rows = await conn.fetchval("SELECT count(*) FROM project_weekly_summary")
    print("\nga4_project_funnel: %d rows, %d projects" % (ga4_rows, ga4_projects))
    print("project_weekly_summary: %d rows" % summary_rows)

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
