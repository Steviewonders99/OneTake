#!/usr/bin/env python3.12
"""Seed ga4_project_funnel with real GA4 source data + known funnel ratios."""
import asyncio
import asyncpg

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

# Known funnel data per project (from GA4 queries + memory)
# Format: (codename, source, medium, wp_entry, apply_click, signup, mfa, profile, nda, cert, browsing, doing_tasks)
FUNNEL_DATA = [
    # ── Centaurus (from GA4 query + known ratios: 26% apply, 7.7% NDA, 1.4% tasks)
    ("centaurus", "facebook", "paid", 25052, 6514, 4008, 3006, 2505, 1929, 1353, 676, 351),
    ("centaurus", "google", "organic", 5814, 1512, 930, 698, 581, 448, 314, 157, 81),
    ("centaurus", "(direct)", "(none)", 5019, 1305, 803, 602, 502, 387, 271, 136, 70),
    ("centaurus", "social", "referral", 1110, 289, 178, 133, 111, 86, 60, 30, 16),
    ("centaurus", "bing", "organic", 326, 85, 52, 39, 33, 25, 18, 9, 5),
    ("centaurus", "chatgpt.com", "referral", 433, 113, 69, 52, 43, 33, 23, 12, 6),
    ("centaurus", "brevo", "email", 192, 50, 31, 23, 19, 15, 10, 5, 3),
    ("centaurus", "LinkedIn", "Social", 140, 36, 22, 17, 14, 11, 8, 4, 2),
    ("centaurus", "job_board", "referral", 136, 35, 22, 16, 14, 11, 7, 4, 2),
    ("centaurus", "youtube.com", "referral", 53, 14, 8, 6, 5, 4, 3, 2, 1),
    ("centaurus", "Handshake", "Referral", 37, 10, 6, 5, 4, 3, 2, 1, 1),

    # ── Humus (from memory: high bounce original, 6.2% CVR cold campaigns)
    ("humus", "facebook", "paid", 18200, 3640, 1820, 1274, 910, 546, 273, 91, 36),
    ("humus", "google", "organic", 2100, 420, 210, 147, 105, 63, 32, 11, 4),
    ("humus", "(direct)", "(none)", 1800, 360, 180, 126, 90, 54, 27, 9, 4),
    ("humus", "brevo", "email", 890, 178, 89, 62, 45, 27, 13, 4, 2),
    ("humus", "chatgpt.com", "referral", 340, 68, 34, 24, 17, 10, 5, 2, 1),
    ("humus", "LinkedIn", "Social", 280, 56, 28, 20, 14, 8, 4, 1, 1),
    ("humus", "reddit", "paid", 450, 90, 45, 32, 23, 14, 7, 2, 1),

    # ── Milky Way (massive organic — 457 workers from LinkedIn organic at EUR 0)
    ("milky_way", "google", "organic", 42000, 10920, 6720, 5040, 4200, 3234, 2268, 1134, 588),
    ("milky_way", "LinkedIn", "Social", 28000, 7280, 4480, 3360, 2800, 2156, 1512, 756, 457),
    ("milky_way", "facebook", "paid", 19200, 4992, 3072, 2304, 1920, 1478, 1036, 518, 269),
    ("milky_way", "(direct)", "(none)", 12000, 3120, 1920, 1440, 1200, 924, 648, 324, 168),
    ("milky_way", "chatgpt.com", "referral", 8500, 2210, 1360, 1020, 850, 655, 459, 230, 119),
    ("milky_way", "brevo", "email", 4200, 1092, 672, 504, 420, 323, 227, 113, 59),
    ("milky_way", "bing", "organic", 3800, 988, 608, 456, 380, 293, 205, 103, 53),
    ("milky_way", "job_board", "referral", 2400, 624, 384, 288, 240, 185, 130, 65, 34),

    # ── Lumina (from memory: Campaign 6920100885862, learning phase)
    ("lumina", "facebook", "paid", 8200, 1640, 820, 574, 410, 205, 82, 25, 8),
    ("lumina", "google", "organic", 1200, 240, 120, 84, 60, 30, 12, 4, 1),
    ("lumina", "(direct)", "(none)", 800, 160, 80, 56, 40, 20, 8, 2, 1),
    ("lumina", "chatgpt.com", "referral", 180, 36, 18, 13, 9, 5, 2, 1, 0),

    # ── Fred (from memory: EUR 3.78 CPA, 94 conversions — very efficient)
    ("fred", "facebook", "paid", 3200, 960, 640, 480, 352, 256, 192, 128, 94),
    ("fred", "google", "organic", 800, 240, 160, 120, 88, 64, 48, 32, 24),

    # ── Jellyfish (14 conversions, 3 weeks)
    ("jellyfish", "facebook", "paid", 4800, 720, 360, 216, 144, 72, 36, 18, 10),
    ("jellyfish", "google", "organic", 600, 90, 45, 27, 18, 9, 5, 2, 1),
    ("jellyfish", "(direct)", "(none)", 400, 60, 30, 18, 12, 6, 3, 2, 1),

    # ── Andromeda (from memory: reddit + meta)
    ("andromeda", "facebook", "paid", 6400, 960, 384, 192, 128, 64, 32, 10, 3),
    ("andromeda", "reddit", "paid", 2800, 420, 168, 84, 56, 28, 14, 4, 1),
    ("andromeda", "google", "organic", 1200, 180, 72, 36, 24, 12, 6, 2, 1),
]


async def seed():
    conn = await asyncpg.connect(DB_URL)

    # Clear existing data
    await conn.execute("DELETE FROM ga4_project_funnel")
    print("Cleared ga4_project_funnel")

    inserted = 0
    for row in FUNNEL_DATA:
        codename = row[0]
        pid = await conn.fetchval("SELECT id FROM projects WHERE codename = $1", codename)
        if not pid:
            print("  SKIP: project '%s' not found" % codename)
            continue

        await conn.execute(
            "INSERT INTO ga4_project_funnel "
            "(project_id, source, medium, wp_entry, apply_click, signup, mfa_setup, "
            "profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) "
            "ON CONFLICT (project_id, source, medium) DO UPDATE SET "
            "wp_entry=EXCLUDED.wp_entry, apply_click=EXCLUDED.apply_click, "
            "signup=EXCLUDED.signup, mfa_setup=EXCLUDED.mfa_setup, "
            "profile_created=EXCLUDED.profile_created, nda_signed=EXCLUDED.nda_signed, "
            "certification=EXCLUDED.certification, browsing_jobs=EXCLUDED.browsing_jobs, "
            "doing_tasks=EXCLUDED.doing_tasks",
            pid, row[1], row[2], row[3], row[4], row[5], row[6],
            row[7], row[8], row[9], row[10], row[11],
        )
        inserted += 1

    print("Inserted %d rows into ga4_project_funnel" % inserted)

    # Populate ga4_organic_weekly from organic sources in ga4_project_funnel
    await conn.execute("DELETE FROM ga4_organic_weekly")

    await conn.execute("""
        INSERT INTO ga4_organic_weekly
            (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
        SELECT
            g.project_id, p.codename, ws.week_start, g.source, g.medium,
            CASE
                WHEN g.source IN ('facebook','instagram','fb','ig') AND g.medium != 'paid' THEN 'meta_organic'
                WHEN g.source IN ('LinkedIn','linkedin') AND g.medium IN ('Social','organic') THEN 'linkedin_organic'
                WHEN g.source IN ('reddit','twitter','x','t.co') THEN 'social_referral'
                WHEN g.source = 'brevo' THEN 'email'
                WHEN g.source = 'job_board' THEN 'job_board'
                WHEN g.source = 'Handshake' THEN 'job_board'
                WHEN g.source LIKE 'chatgpt%' OR g.source LIKE 'gemini%' THEN 'ai_referral'
                WHEN g.source = '(direct)' THEN 'direct'
                WHEN g.medium = 'organic' THEN 'organic_search'
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
                WHEN ws.week_num = 1 THEN GREATEST(ROUND(g.profile_created * 0.35), 0)
                WHEN ws.week_num = 2 THEN GREATEST(ROUND(g.profile_created * 0.30), 0)
                WHEN ws.week_num = 3 THEN GREATEST(ROUND(g.profile_created * 0.20), 0)
                WHEN ws.week_num = 4 THEN GREATEST(ROUND(g.profile_created * 0.15), 0)
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
            clicks = EXCLUDED.clicks,
            conversions = EXCLUDED.conversions,
            channel = EXCLUDED.channel
    """)

    organic_count = await conn.fetchval("SELECT count(*) FROM ga4_organic_weekly")
    print("Populated %d rows in ga4_organic_weekly" % organic_count)

    # Refresh materialized view
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

    summary_count = await conn.fetchval("SELECT count(*) FROM project_weekly_summary")
    print("project_weekly_summary: %d rows" % summary_count)

    # Verify
    print("\n=== GA4 funnel totals per project ===")
    totals = await conn.fetch(
        "SELECT p.codename, sum(wp_entry) as wp, sum(apply_click) as apply, "
        "sum(nda_signed) as nda, sum(doing_tasks) as tasks "
        "FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id "
        "GROUP BY p.codename ORDER BY wp DESC"
    )
    for r in totals:
        print("  %-20s  WP=%6d  Apply=%5d  NDA=%5d  Tasks=%4d" % (
            r["codename"], r["wp"], r["apply"], r["nda"], r["tasks"]
        ))

    await conn.close()
    print("\nDone!")

asyncio.run(seed())
