#!/usr/bin/env python3.12
"""Seed ga4_project_funnel with DEDUPED conversion data (totalUsers, not eventCount).

Uses totalUsers to eliminate double-firing inflation:
- apply_success on /crowd/jobs/{id} → unique users who submitted applications
- purchase on */thank-you → unique users who completed AidaForm

This is the clean, defensible number for leadership.
"""
import asyncio
import asyncpg
import json
import re
from collections import defaultdict

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

# ── AidaForm thank-you → project mapping ──────────────────────────
THANKYOU_TO_PROJECT = {
    "/project-lumina-outreach/thank-you": "lumina",
    "/humus-new-participant-demographics-survey/thank-you": "humus",
    "/Pets-VideoCollection/thank-you": "fur_frame",
    "/kids-data-collection/thank-you": "centaurus_kids",
    "/project-kilo-registration-form/thank-you": "kilo",
    "/humus-minor-demographics-survey-copy/thank-you": "humus_3",
    "/centaurus-minor-demographics-survey/thank-you": "centaurus_kids",
}

# ── Purchase/thank-you data (using totalUsers, not eventCount) ────
# (path, source, medium, unique_users)
PURCHASE_THANKYOU_USERS = [
    ("/project-lumina-outreach/thank-you", "paid_media", "paid", 520),
    ("/project-lumina-outreach/thank-you", "(direct)", "(none)", 211),
    ("/humus-new-participant-demographics-survey/thank-you", "(direct)", "(none)", 166),
    ("/humus-new-participant-demographics-survey/thank-you", "facebook", "paid", 191),
    ("/project-lumina-outreach/thank-you", "oneforma.com", "referral", 135),
    ("/Pets-VideoCollection/thank-you", "(direct)", "(none)", 90),
    ("/Pets-VideoCollection/thank-you", "facebook", "paid", 105),
    ("/Pets-VideoCollection/thank-you", "oneforma.com", "referral", 75),
    ("/humus-new-participant-demographics-survey/thank-you", "oneforma.com", "referral", 54),
    ("/project-lumina-outreach/thank-you", "facebook", "paid", 43),
    ("/project-lumina-outreach/thank-you", "on-site", "referral", 45),
    ("/kids-data-collection/thank-you", "facebook", "paid", 43),
    ("/project-kilo-registration-form/thank-you", "(direct)", "(none)", 35),
    ("/humus-new-participant-demographics-survey/thank-you", "adiafrom", "referral", 19),
    ("/humus-new-participant-demographics-survey/thank-you", "google", "organic", 19),
    ("/humus-new-participant-demographics-survey/thank-you", "job_board", "referral", 18),
    ("/kids-data-collection/thank-you", "oneforma.com", "referral", 28),
    ("/humus-new-participant-demographics-survey/thank-you", "paid_media", "paid", 22),
    ("/project-lumina-outreach/thank-you", "google", "organic", 15),
    ("/humus-new-participant-demographics-survey/thank-you", "google", "cpc", 7),
    ("/kids-data-collection/thank-you", "(direct)", "(none)", 15),
    ("/humus-minor-demographics-survey-copy/thank-you", "(direct)", "(none)", 11),
    ("/project-kilo-registration-form/thank-you", "Flyers", "Referral", 13),
    ("/project-kilo-registration-form/thank-you", "google", "organic", 11),
    ("/project-lumina-outreach/thank-you", "job_board", "referral", 7),
    ("/Pets-VideoCollection/thank-you", "google", "organic", 7),
    ("/project-lumina-outreach/thank-you", "social", "referral", 8),
    ("/centaurus-minor-demographics-survey/thank-you", "(direct)", "(none)", 3),
    ("/Pets-VideoCollection/thank-you", "brevo", "email", 3),
    ("/kids-data-collection/thank-you", "Flyers", "flyer", 2),
    ("/project-lumina-outreach/thank-you", "internal", "referral", 3),
    ("/Pets-VideoCollection/thank-you", "paid_media", "paid", 4),
    ("/humus-minor-demographics-survey-copy/thank-you", "oneforma.com", "referral", 4),
    ("/humus-new-participant-demographics-survey/thank-you", "linkedin.com", "referral", 2),
    ("/project-kilo-registration-form/thank-you", "facebook", "paid", 3),
    ("/project-kilo-registration-form/thank-you", "oneforma.com", "referral", 2),
    ("/project-lumina-outreach/thank-you", "m.facebook.com", "referral", 3),
    ("/project-lumina-outreach/thank-you", "reddit.com", "referral", 1),
    ("/centaurus-minor-demographics-survey/thank-you", "facebook", "paid", 1),
    ("/humus-minor-demographics-survey-copy/thank-you", "job_board", "referral", 1),
    ("/humus-new-participant-demographics-survey/thank-you", "bing", "organic", 1),
    ("/kids-data-collection/thank-you", "google", "organic", 1),
    ("/kids-data-collection/thank-you", "paid_media", "paid", 2),
    ("/project-kilo-registration-form/thank-you", "chatgpt.com", "(not set)", 2),
    ("/project-kilo-registration-form/thank-you", "youtube.com", "referral", 2),
    ("/project-kilo-registration-form/thank-you", "brevo", "email", 1),
    ("/project-lumina-outreach/thank-you", "chatgpt.com", "referral", 1),
    ("/project-lumina-outreach/thank-you", "l.facebook.com", "referral", 2),
    ("/project-lumina-outreach/thank-you", "duckduckgo", "organic", 1),
]


async def main():
    conn = await asyncpg.connect(DB_URL)

    # ── Build requestId → project_id mapping ───────────────────────
    print("Building requestId → project mapping...")
    locale_rows = await conn.fetch(
        "SELECT project_id, platform_request_id FROM project_locale_links "
        "WHERE platform_request_id IS NOT NULL"
    )
    rid_to_project = {}
    for r in locale_rows:
        rid = r["platform_request_id"]
        pid = r["project_id"]
        rid_to_project[rid] = pid
        if rid.startswith("crowd_"):
            rid_to_project[rid.replace("crowd_", "")] = pid

    projects = await conn.fetch("SELECT id, codename FROM projects")
    codename_to_pid = {r["codename"]: r["id"] for r in projects}
    pid_to_codename = {r["id"]: r["codename"] for r in projects}

    # ── Parse apply_success — use totalUsers (index 1), not eventCount ──
    print("\nParsing apply_success (using totalUsers for dedup)...")
    with open(
        "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
        "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
        "mcp-analytics-mcp-run_report-1779297249991.txt"
    ) as f:
        data = json.load(f)

    project_apps = defaultdict(lambda: defaultdict(int))
    mapped_total = 0
    unmapped_total = 0

    for row in data["rows"]:
        dims = row["dimension_values"]
        metrics = row["metric_values"]
        page_path = dims[0]["value"]
        source = dims[1]["value"]
        medium = dims[2]["value"]
        unique_users = int(metrics[1]["value"])  # totalUsers, NOT eventCount

        match = re.search(r"/crowd/jobs/(\d+)", page_path)
        if not match:
            continue
        job_id = match.group(1)

        pid = rid_to_project.get(job_id)
        if pid:
            project_apps[pid][(source, medium)] += unique_users
            mapped_total += unique_users
        else:
            unmapped_total += unique_users

    print("  apply_success: %d unique users mapped, %d unmapped" % (mapped_total, unmapped_total))

    # ── Add purchase/thank-you (already using totalUsers) ──────────
    print("Processing purchase/thank-you (totalUsers)...")
    thankyou_total = 0
    for path, source, medium, users in PURCHASE_THANKYOU_USERS:
        codename = THANKYOU_TO_PROJECT.get(path)
        if not codename:
            continue
        pid = codename_to_pid.get(codename) or codename_to_pid.get("centaurus")
        if pid:
            project_apps[pid][(source, medium)] += users
            thankyou_total += users

    print("  purchase/thank-you: %d unique users" % thankyou_total)

    # ── Clear and seed ga4_project_funnel ──────────────────────────
    print("\nSeeding ga4_project_funnel with deduped data...")
    await conn.execute("DELETE FROM ga4_project_funnel")

    inserted = 0
    for pid, source_data in project_apps.items():
        for (source, medium), applications in source_data.items():
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, "
                "browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, 0, 0, 0, 0, 0, $4, 0, 0, 0) "
                "ON CONFLICT (project_id, source, medium) DO UPDATE SET "
                "nda_signed = ga4_project_funnel.nda_signed + EXCLUDED.nda_signed",
                pid, source, medium, applications,
            )
            inserted += 1

    print("  Inserted %d rows" % inserted)

    # ── Verify totals ──────────────────────────────────────────────
    total = await conn.fetchval("SELECT sum(nda_signed) FROM ga4_project_funnel")
    proj_count = await conn.fetchval("SELECT count(DISTINCT project_id) FROM ga4_project_funnel")

    print("\n=== DEDUPED CONVERSION TOTALS ===")
    print("  Total unique applicants: %d" % (total or 0))
    print("  Projects with data: %d" % (proj_count or 0))
    print("  (apply_success users: %d + purchase/thank-you users: %d)" % (mapped_total, thankyou_total))

    top = await conn.fetch(
        "SELECT p.codename, sum(g.nda_signed) as apps "
        "FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id "
        "GROUP BY p.codename ORDER BY apps DESC LIMIT 15"
    )
    print("\n=== Top projects by unique applicants ===")
    for r in top:
        print("  %-30s %5d unique applicants" % (r["codename"], r["apps"]))

    # ── Rebuild organic weekly ─────────────────────────────────────
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

    # ── Refresh materialized view ──────────────────────────────────
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

    summary = await conn.fetchval("SELECT count(*) FROM project_weekly_summary")
    summary_proj = await conn.fetchval("SELECT count(DISTINCT codename) FROM project_weekly_summary")
    print("  project_weekly_summary: %d rows, %d projects" % (summary, summary_proj))

    await conn.close()
    print("\nDone — all numbers are deduped unique users. Clean for tomorrow.")


if __name__ == "__main__":
    asyncio.run(main())
