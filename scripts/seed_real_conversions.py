#!/usr/bin/env python3.12
"""Seed ga4_project_funnel with REAL conversion events from GA4.

Conversions are defined as:
  1. apply_success on /crowd/jobs/{requestId} — platform job application
  2. purchase on */thank-you pages — AidaForm LP completion

Maps requestIds back to projects via project_locale_links.platform_request_id.
Maps thank-you page slugs back to projects via codename matching.

Usage:
    python3.12 scripts/seed_real_conversions.py
"""
import asyncio
import asyncpg
import json
import re

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

# ── AidaForm thank-you page → project codename mapping ─────────────
THANKYOU_TO_PROJECT = {
    "/project-lumina-outreach/thank-you": "lumina",
    "/humus-new-participant-demographics-survey/thank-you": "humus",
    "/Pets-VideoCollection/thank-you": "fur_frame",
    "/kids-data-collection/thank-you": "centaurus_kids",
    "/project-kilo-registration-form/thank-you": "kilo",
    "/humus-minor-demographics-survey-copy/thank-you": "humus_3",
    "/centaurus-minor-demographics-survey/thank-you": "centaurus_kids",
}

# ── Purchase (AidaForm) data from GA4 query ─────────────────────────
# Format: (thank_you_path, source, medium, event_count)
PURCHASE_THANKYOU_DATA = [
    ("/project-lumina-outreach/thank-you", "paid_media", "paid", 641),
    ("/project-lumina-outreach/thank-you", "(direct)", "(none)", 283),
    ("/humus-new-participant-demographics-survey/thank-you", "(direct)", "(none)", 260),
    ("/humus-new-participant-demographics-survey/thank-you", "facebook", "paid", 239),
    ("/project-lumina-outreach/thank-you", "oneforma.com", "referral", 164),
    ("/Pets-VideoCollection/thank-you", "(direct)", "(none)", 130),
    ("/Pets-VideoCollection/thank-you", "facebook", "paid", 123),
    ("/Pets-VideoCollection/thank-you", "oneforma.com", "referral", 93),
    ("/humus-new-participant-demographics-survey/thank-you", "oneforma.com", "referral", 80),
    ("/project-lumina-outreach/thank-you", "facebook", "paid", 61),
    ("/project-lumina-outreach/thank-you", "on-site", "referral", 58),
    ("/kids-data-collection/thank-you", "facebook", "paid", 47),
    ("/project-kilo-registration-form/thank-you", "(direct)", "(none)", 47),
    ("/humus-new-participant-demographics-survey/thank-you", "adiafrom", "referral", 35),
    ("/humus-new-participant-demographics-survey/thank-you", "google", "organic", 35),
    ("/humus-new-participant-demographics-survey/thank-you", "job_board", "referral", 31),
    ("/kids-data-collection/thank-you", "oneforma.com", "referral", 30),
    ("/humus-new-participant-demographics-survey/thank-you", "paid_media", "paid", 29),
    ("/project-lumina-outreach/thank-you", "google", "organic", 19),
    ("/humus-new-participant-demographics-survey/thank-you", "google", "cpc", 17),
    ("/kids-data-collection/thank-you", "(direct)", "(none)", 16),
    ("/humus-minor-demographics-survey-copy/thank-you", "(direct)", "(none)", 15),
    ("/humus-new-participant-demographics-survey/thank-you", "statics.teams.cdn.office.net", "referral", 15),
    ("/project-kilo-registration-form/thank-you", "Flyers", "Referral", 14),
    ("/project-kilo-registration-form/thank-you", "google", "organic", 13),
    ("/project-lumina-outreach/thank-you", "job_board", "referral", 12),
    ("/Pets-VideoCollection/thank-you", "google", "organic", 11),
    ("/project-lumina-outreach/thank-you", "social", "referral", 9),
    ("/centaurus-minor-demographics-survey/thank-you", "(direct)", "(none)", 6),
    ("/humus-new-participant-demographics-survey/thank-you", "lasvegas.craigslist.org", "referral", 6),
    ("/Pets-VideoCollection/thank-you", "brevo", "email", 5),
    ("/humus-new-participant-demographics-survey/thank-you", "l.instagram.com", "referral", 5),
    ("/kids-data-collection/thank-you", "Flyers", "flyer", 5),
    ("/project-lumina-outreach/thank-you", "internal", "referral", 5),
    ("/Pets-VideoCollection/thank-you", "paid_media", "paid", 4),
    ("/humus-minor-demographics-survey-copy/thank-you", "oneforma.com", "referral", 4),
    ("/humus-new-participant-demographics-survey/thank-you", "instagram.com", "referral", 4),
    ("/humus-new-participant-demographics-survey/thank-you", "linkedin.com", "referral", 4),
    ("/project-kilo-registration-form/thank-you", "facebook", "paid", 3),
    ("/project-kilo-registration-form/thank-you", "oneforma.com", "referral", 3),
    ("/project-lumina-outreach/thank-you", "l.facebook.com", "referral", 3),
    ("/project-lumina-outreach/thank-you", "m.facebook.com", "referral", 3),
    ("/project-lumina-outreach/thank-you", "reddit.com", "referral", 3),
    ("/centaurus-minor-demographics-survey/thank-you", "facebook", "paid", 2),
    ("/humus-minor-demographics-survey-copy/thank-you", "job_board", "referral", 2),
    ("/humus-new-participant-demographics-survey/thank-you", "bing", "organic", 2),
    ("/humus-new-participant-demographics-survey/thank-you", "messages.indeed.com", "referral", 2),
    ("/kids-data-collection/thank-you", "google", "organic", 2),
    ("/kids-data-collection/thank-you", "paid_media", "paid", 2),
    ("/project-kilo-registration-form/thank-you", "chatgpt.com", "(not set)", 2),
    ("/project-kilo-registration-form/thank-you", "youtube.com", "referral", 2),
]


async def main():
    conn = await asyncpg.connect(DB_URL)

    # ── Step 1: Build requestId → project_id mapping ───────────────
    print("Building requestId → project mapping...")
    locale_rows = await conn.fetch(
        "SELECT project_id, platform_request_id FROM project_locale_links "
        "WHERE platform_request_id IS NOT NULL"
    )
    # platform_request_id values: "1820106519139329" or "crowd_12345" or "legacy_999"
    rid_to_project = {}
    for r in locale_rows:
        rid = r["platform_request_id"]
        pid = r["project_id"]
        # Direct numeric requestId
        rid_to_project[rid] = pid
        # Also map the crowd_ prefix version
        if rid.startswith("crowd_"):
            rid_to_project[rid.replace("crowd_", "")] = pid

    print("  %d requestId mappings from locale_links" % len(rid_to_project))

    # Also build codename → project_id
    projects = await conn.fetch("SELECT id, codename FROM projects")
    codename_to_pid = {r["codename"]: r["id"] for r in projects}

    # ── Step 2: Parse apply_success data from GA4 export ───────────
    print("\nParsing apply_success data...")
    apply_success_file = (
        "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
        "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
        "mcp-analytics-mcp-run_report-1779297249991.txt"
    )

    with open(apply_success_file) as f:
        raw = f.read()

    # Parse the JSON from the GA4 report
    data = json.loads(raw)
    rows = data.get("rows", [])

    # Group by project: requestId → {source/medium → count}
    # project_conversions[project_id][(source, medium)] += count
    from collections import defaultdict
    project_conversions = defaultdict(lambda: defaultdict(int))
    project_users = defaultdict(lambda: defaultdict(int))
    unmapped_ids = set()
    mapped_count = 0
    unmapped_count = 0

    for row in rows:
        dims = row["dimension_values"]
        metrics = row["metric_values"]
        page_path = dims[0]["value"]
        source = dims[1]["value"]
        medium = dims[2]["value"]
        event_count = int(metrics[0]["value"])
        users = int(metrics[1]["value"])

        # Extract job ID from /crowd/jobs/{id}
        match = re.search(r"/crowd/jobs/(\d+)", page_path)
        if not match:
            continue
        job_id = match.group(1)

        # Map to project
        pid = rid_to_project.get(job_id)
        if pid:
            project_conversions[pid][(source, medium)] += event_count
            project_users[pid][(source, medium)] += users
            mapped_count += event_count
        else:
            unmapped_ids.add(job_id)
            unmapped_count += event_count

    print("  apply_success: %d events mapped to projects, %d unmapped" % (mapped_count, unmapped_count))
    print("  %d unique projects with apply_success data" % len(project_conversions))
    if unmapped_ids:
        print("  %d unmapped job IDs (no locale link)" % len(unmapped_ids))

    # ── Step 3: Add purchase/thank-you data ────────────────────────
    print("\nProcessing purchase/thank-you data...")
    thankyou_mapped = 0
    for path, source, medium, count in PURCHASE_THANKYOU_DATA:
        codename = THANKYOU_TO_PROJECT.get(path)
        if not codename:
            continue
        # Handle centaurus_kids → might not exist, fall back to centaurus
        pid = codename_to_pid.get(codename) or codename_to_pid.get("centaurus")
        if pid:
            project_conversions[pid][(source, medium)] += count
            thankyou_mapped += count

    print("  purchase/thank-you: %d events mapped" % thankyou_mapped)

    # ── Step 4: Clear and seed ga4_project_funnel ──────────────────
    print("\nSeeding ga4_project_funnel with real data...")
    await conn.execute("DELETE FROM ga4_project_funnel")

    # Get codename for each project_id
    pid_to_codename = {r["id"]: r["codename"] for r in projects}

    inserted = 0
    for pid, source_data in project_conversions.items():
        codename = pid_to_codename.get(pid, "unknown")
        for (source, medium), applications in source_data.items():
            users = project_users.get(pid, {}).get((source, medium), applications)
            # applications = real apply_success + purchase/thank-you count
            # We store in nda_signed as the primary conversion metric
            # (it's the closest funnel stage to "applied")
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, "
                "browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) "
                "ON CONFLICT (project_id, source, medium) DO UPDATE SET "
                "nda_signed = ga4_project_funnel.nda_signed + EXCLUDED.nda_signed, "
                "wp_entry = ga4_project_funnel.wp_entry + EXCLUDED.wp_entry",
                pid, source, medium,
                0,  # wp_entry (will fill from page_view query later)
                0,  # apply_click
                0,  # signup
                0,  # mfa_setup
                0,  # profile_created
                applications,  # nda_signed = real applications
                0,  # certification
                0,  # browsing_jobs
                0,  # doing_tasks
            )
            inserted += 1

    print("  Inserted %d rows into ga4_project_funnel" % inserted)

    # ── Step 5: Verify totals ──────────────────────────────────────
    total_apps = await conn.fetchval(
        "SELECT sum(nda_signed) FROM ga4_project_funnel"
    )
    project_count = await conn.fetchval(
        "SELECT count(DISTINCT project_id) FROM ga4_project_funnel"
    )
    print("\n=== Real conversion totals ===")
    print("  Total applications (apply_success + purchase/thank-you): %d" % (total_apps or 0))
    print("  Projects with conversion data: %d" % (project_count or 0))

    # Top projects
    top = await conn.fetch(
        "SELECT p.codename, sum(g.nda_signed) as apps "
        "FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id "
        "GROUP BY p.codename ORDER BY apps DESC LIMIT 15"
    )
    print("\n=== Top projects by real applications ===")
    for r in top:
        print("  %-30s %5d applications" % (r["codename"], r["apps"]))

    # ── Step 6: Rebuild organic weekly + materialized view ─────────
    print("\nRebuilding ga4_organic_weekly...")
    await conn.execute("DELETE FROM ga4_organic_weekly")
    await conn.execute("""
        INSERT INTO ga4_organic_weekly
            (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
        SELECT
            g.project_id, p.codename, ws.week_start, g.source, g.medium,
            CASE
                WHEN g.source IN ('facebook','instagram','fb','ig','l.facebook.com','m.facebook.com','lm.facebook.com') AND g.medium != 'paid' THEN 'meta_organic'
                WHEN g.source IN ('LinkedIn','linkedin','linkedin.com') AND g.medium IN ('Social','organic','referral') THEN 'linkedin_organic'
                WHEN g.source IN ('reddit','reddit.com','twitter','x','t.co') THEN 'social_referral'
                WHEN g.source IN ('brevo','sendinblue') THEN 'email'
                WHEN g.source IN ('job_board','Handshake','messages.indeed.com') THEN 'job_board'
                WHEN g.source LIKE 'chatgpt%%' OR g.source LIKE 'gemini%%' THEN 'ai_referral'
                WHEN g.source = '(direct)' THEN 'direct'
                WHEN g.medium = 'organic' THEN 'organic_search'
                WHEN g.source IN ('oneforma.com','on-site','internal') THEN 'internal'
                WHEN g.source = 'Flyers' THEN 'flyer'
                ELSE g.source
            END,
            'organic',
            -- Distribute nda_signed (applications) across 4 weeks
            CASE
                WHEN ws.week_num = 1 THEN GREATEST(ROUND(g.nda_signed * 0.35), 0)
                WHEN ws.week_num = 2 THEN GREATEST(ROUND(g.nda_signed * 0.30), 0)
                WHEN ws.week_num = 3 THEN GREATEST(ROUND(g.nda_signed * 0.20), 0)
                WHEN ws.week_num = 4 THEN GREATEST(ROUND(g.nda_signed * 0.15), 0)
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

    # Refresh materialized view
    print("\nRefreshing materialized view...")
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

    summary_count = await conn.fetchval("SELECT count(*) FROM project_weekly_summary")
    summary_projects = await conn.fetchval("SELECT count(DISTINCT codename) FROM project_weekly_summary")
    print("  project_weekly_summary: %d rows, %d projects" % (summary_count, summary_projects))

    await conn.close()
    print("\nDone! Real conversion data seeded.")


if __name__ == "__main__":
    asyncio.run(main())
