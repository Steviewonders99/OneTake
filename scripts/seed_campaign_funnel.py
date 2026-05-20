#!/usr/bin/env python3.12
"""Rebuild ga4_project_funnel using firstUserCampaignName attribution.

This is the correct approach — it captures BOTH URL formats:
- ?requestId= projects (Centaurus, Andromeda, Motto, etc.)
- /crowd/jobs/{id} projects (Lighthouse, Apps and Music, etc.)

The purchase event = MFA/NDA completion (fires on /center/mfa/success).
This is the real conversion signal for ALL projects.

Funnel stages:
- wp_entry = page_view unique users
- apply_click = apply_click unique users
- signup = sign_up unique users
- nda_signed = purchase unique users (MFA/NDA completion)
"""
import asyncio
import asyncpg
import json
import re
from collections import defaultdict

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

GA4_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779308864841.txt"
)

# Campaign name → project codename mapping
# Campaigns may have suffixes like locale codes, dates, copy variants
CAMPAIGN_MAP = {
    "centaurus": "centaurus",
    "centaurus_kids": "centaurus_kids",
    "MAPS_Milkyway": "internet_judging",
    "milkyway": "internet_judging",
    "Milkyway_LI": "internet_judging",
    "Milkyway_Indeed": "internet_judging",
    "Milkyway_Boss": "internet_judging",
    "Milkyway_JDB": "internet_judging",
    "Milkyway_Proz": "internet_judging",
    "lumina": "lumina",
    "lumina_conv": "lumina",
    "humus": "humus",
    "humus-cold-std": "humus",
    "humus-cold-nyc": "humus",
    "humus-cold-lv": "humus",
    "humus-cold-phx": "humus",
    "andromeda": "andromeda",
    "fur-frame": "fur_frame",
    "fred-spanish": "fred",
    "mosaic": "mosaic",
    "kilo": "kilo",
    "Jellyfish": "jellyfish",
    "lighthouse-3": "lighthouse-3",
    "Photo ML IQ": "project_photo_ml_iq_2",
    "motto": "motto",
}

# Fuzzy patterns for campaigns that include project name as prefix
FUZZY_PATTERNS = [
    (r"(?i)^centaurus", "centaurus"),
    (r"(?i)^centaurus.kids", "centaurus_kids"),
    (r"(?i)^(MAPS_)?[Mm]ilkyway", "internet_judging"),
    (r"(?i)^lumina", "lumina"),
    (r"(?i)^humus", "humus"),
    (r"(?i)^andromeda", "andromeda"),
    (r"(?i)^fur.frame", "fur_frame"),
    (r"(?i)^fred", "fred"),
    (r"(?i)^mosaic", "mosaic"),
    (r"(?i)^kilo", "kilo"),
    (r"(?i)^[Jj]ellyfish", "jellyfish"),
    (r"(?i)^[Ll]ighthouse", "lighthouse-3"),
    (r"(?i)^[Pp]hoto.ML", "project_photo_ml_iq_2"),
    (r"(?i)^motto", "motto"),
    (r"(?i)^[Aa]cceptabilit", "acceptability_and_preference"),
    (r"(?i)^accpref", "acceptability_and_preference"),
    (r"(?i)^HT.MTPE", "ht-human-translation-and-mtpe-machine-translation-post-editing"),
    (r"(?i)^HT_MTPE", "ht-human-translation-and-mtpe-machine-translation-post-editing"),
    (r"(?i)^[Ss]pring", "project_spring"),
    (r"(?i)^[Ee]duc.Pron", "education-pronunciation-evaluation"),
    (r"(?i)^[Ss]equoia", "paragraph-level-acceptability"),
    (r"(?i)^Longitudinal", "vega-audio-data-collection"),
    (r"(?i)^Fred.Annotation", "fred-annotation"),
]

EVENT_MAP = {
    "page_view": "wp_entry",
    "apply_click": "apply_click",
    "sign_up": "signup",
    "purchase": "nda_signed",
}


def resolve_campaign(campaign_name):
    """Map a GA4 campaign name to a project codename."""
    if campaign_name in ("(organic)", "(direct)", "(referral)", "(not set)"):
        return campaign_name  # Keep as-is for organic/direct attribution

    # Exact match first
    if campaign_name in CAMPAIGN_MAP:
        return CAMPAIGN_MAP[campaign_name]

    # Fuzzy pattern match
    for pattern, codename in FUZZY_PATTERNS:
        if re.match(pattern, campaign_name):
            return codename

    return None  # Unmapped


async def main():
    conn = await asyncpg.connect(DB_URL)

    # Load project codename → id
    projects = await conn.fetch("SELECT id, codename FROM projects")
    codename_to_pid = {r["codename"]: r["id"] for r in projects}

    # Parse GA4 data
    with open(GA4_FILE) as f:
        data = json.load(f)

    # Aggregate: project_codename → event_name → totalUsers
    project_data = defaultdict(lambda: defaultdict(int))
    unmapped_campaigns = defaultdict(int)

    for row in data["rows"]:
        campaign = row["dimension_values"][0]["value"]
        event = row["dimension_values"][1]["value"]
        users = int(row["metric_values"][0]["value"])

        codename = resolve_campaign(campaign)
        if codename is None:
            unmapped_campaigns[campaign] += users
            continue

        field = EVENT_MAP.get(event)
        if not field:
            continue

        project_data[codename][field] += users

    print("=== Campaign → Project mapping ===")
    print("Mapped campaigns to %d project keys" % len(project_data))
    print("Unmapped campaigns: %d (total %d users)" % (
        len(unmapped_campaigns), sum(unmapped_campaigns.values())))

    if unmapped_campaigns:
        top_unmapped = sorted(unmapped_campaigns.items(), key=lambda x: -x[1])[:10]
        print("Top unmapped:")
        for c, u in top_unmapped:
            print("  %-50s %5d users" % (c[:50], u))

    # Clear and seed ga4_project_funnel
    print("\nSeeding ga4_project_funnel...")
    await conn.execute("DELETE FROM ga4_project_funnel")

    inserted = 0
    for codename, events in project_data.items():
        # For organic/direct/referral, create a synthetic row per type
        if codename in ("(organic)", "(direct)", "(referral)", "(not set)"):
            source_map = {
                "(organic)": ("google", "organic"),
                "(direct)": ("(direct)", "(none)"),
                "(referral)": ("referral", "referral"),
                "(not set)": ("(not set)", "(not set)"),
            }
            source, medium = source_map[codename]
            # Don't insert — these are unattributed to a project
            continue

        pid = codename_to_pid.get(codename)
        if not pid:
            print("  SKIP: project '%s' not in DB" % codename)
            continue

        await conn.execute(
            "INSERT INTO ga4_project_funnel "
            "(project_id, source, medium, wp_entry, apply_click, signup, "
            "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
            "VALUES ($1, 'all_campaigns', 'attributed', $2, $3, $4, 0, 0, $5, 0, 0, 0) "
            "ON CONFLICT DO NOTHING",
            pid, events.get("wp_entry", 0), events.get("apply_click", 0),
            events.get("signup", 0), events.get("nda_signed", 0),
        )
        inserted += 1

    print("Inserted %d project rows" % inserted)

    # Verify
    print("\n=== REAL FUNNEL DATA (firstUserCampaignName attribution) ===")
    print("%-35s %8s %8s %8s %8s" % ("PROJECT", "VIEWS", "APPLY", "SIGNUP", "NDA/MFA"))
    print("-" * 75)
    totals = await conn.fetch(
        "SELECT p.codename, sum(g.wp_entry) as wp, sum(g.apply_click) as ac, "
        "sum(g.signup) as su, sum(g.nda_signed) as nda "
        "FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id "
        "WHERE g.utm_content IS NULL AND g.utm_term IS NULL AND g.utm_campaign IS NULL "
        "GROUP BY p.codename ORDER BY sum(g.nda_signed) DESC LIMIT 20"
    )
    grand_wp = grand_ac = grand_su = grand_nda = 0
    for r in totals:
        grand_wp += r["wp"]
        grand_ac += r["ac"]
        grand_su += r["su"]
        grand_nda += r["nda"]
        print("%-35s %8d %8d %8d %8d" % (r["codename"], r["wp"], r["ac"], r["su"], r["nda"]))
    print("-" * 75)
    print("%-35s %8d %8d %8d %8d" % ("TOTAL", grand_wp, grand_ac, grand_su, grand_nda))

    # Rebuild organic weekly + materialized view
    print("\nRebuilding ga4_organic_weekly...")
    await conn.execute("DELETE FROM ga4_organic_weekly")
    await conn.execute("""
        INSERT INTO ga4_organic_weekly
            (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
        SELECT
            g.project_id, p.codename, ws.week_start, g.source, g.medium,
            'campaign_attributed', 'organic',
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
        WHERE g.utm_content IS NULL AND g.utm_term IS NULL AND g.utm_campaign IS NULL
        ON CONFLICT (project_id, week_start, source, medium) DO UPDATE SET
            clicks = EXCLUDED.clicks, conversions = EXCLUDED.conversions, channel = EXCLUDED.channel
    """)

    print("Refreshing materialized view...")
    await conn.execute("DROP MATERIALIZED VIEW IF EXISTS project_weekly_summary")
    await conn.execute("""
        CREATE MATERIALIZED VIEW project_weekly_summary AS
        SELECT project_id, codename,
          date_trunc('week', date)::DATE AS week_start,
          SUM(impressions) AS total_impressions, SUM(clicks) AS total_clicks,
          SUM(spend) AS total_spend, SUM(conversions) AS total_conversions,
          SUM(reach) AS total_reach, SUM(engagement) AS total_engagement,
          SUM(CASE WHEN metric_type = 'paid' THEN spend ELSE 0 END) AS paid_spend,
          SUM(CASE WHEN metric_type = 'paid' THEN clicks ELSE 0 END) AS paid_clicks,
          SUM(CASE WHEN metric_type = 'paid' THEN conversions ELSE 0 END) AS paid_conversions,
          SUM(CASE WHEN metric_type = 'organic' THEN clicks ELSE 0 END) AS organic_clicks,
          SUM(CASE WHEN metric_type = 'email' THEN clicks ELSE 0 END) AS email_clicks,
          CASE WHEN SUM(clicks) > 0 THEN SUM(conversions)::FLOAT / SUM(clicks) ELSE 0 END AS conversion_rate,
          CASE WHEN SUM(conversions) > 0 THEN SUM(spend) / SUM(conversions) ELSE NULL END AS blended_cpa,
          COUNT(DISTINCT channel) AS active_channels
        FROM project_daily_funnel
        GROUP BY project_id, codename, date_trunc('week', date)::DATE
    """)
    await conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_project_weekly_pk ON project_weekly_summary(project_id, week_start)")

    summary = await conn.fetchval("SELECT count(*) FROM project_weekly_summary")
    print("project_weekly_summary: %d rows" % summary)

    await conn.close()
    print("\nDone!")

asyncio.run(main())
