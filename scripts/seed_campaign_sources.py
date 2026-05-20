#!/usr/bin/env python3.12
"""Add per-source/medium breakdown to ga4_project_funnel.

Reads GA4 data with firstUserCampaignName × firstUserSource × firstUserMedium
to restore the "How People Found This Project" breakdown while keeping
campaign-level project attribution.

Keeps the existing 'all_campaigns' aggregate row for totals.
Adds per-source rows (facebook/paid, google/organic, etc.) for the breakdown.
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
    "mcp-analytics-mcp-run_report-1779309853371.txt"
)

# Same campaign → project mapping from seed_campaign_funnel.py
FUZZY_PATTERNS = [
    (r"(?i)^centaurus", "centaurus"),
    (r"(?i)^(MAPS_)?[Mm]ilkyway", "internet_judging"),
    (r"(?i)^lumina", "lumina"),
    (r"(?i)^humus", "humus"),
    (r"(?i)^andromeda", "andromeda"),
    (r"(?i)^fur.frame", "fur_frame"),
    (r"(?i)^fred(?!.Ann)", "fred"),
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
    (r"(?i)^voice.assistant", "jellyfish"),
    (r"(?i)^Koala", "paragraph-level-acceptability"),
]

EVENT_MAP = {
    "page_view": "wp_entry",
    "apply_click": "apply_click",
    "sign_up": "signup",
    "purchase": "nda_signed",
}


def resolve_campaign(name):
    if name in ("(organic)", "(direct)", "(referral)", "(not set)"):
        return None
    for pattern, codename in FUZZY_PATTERNS:
        if re.match(pattern, name):
            return codename
    return None


async def main():
    conn = await asyncpg.connect(DB_URL)

    projects = await conn.fetch("SELECT id, codename FROM projects")
    cn_to_pid = {r["codename"]: r["id"] for r in projects}

    with open(GA4_FILE) as f:
        data = json.load(f)

    # Aggregate: project → source/medium → event → users
    source_data = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

    for row in data["rows"]:
        dims = row["dimension_values"]
        campaign = dims[0]["value"]
        source = dims[1]["value"]
        medium = dims[2]["value"]
        event = dims[3]["value"]
        users = int(row["metric_values"][0]["value"])

        codename = resolve_campaign(campaign)
        if not codename:
            continue
        field = EVENT_MAP.get(event)
        if not field:
            continue

        source_data[codename][(source, medium)][field] += users

    print("Projects with source breakdown: %d" % len(source_data))

    # Delete old per-source rows (keep all_campaigns aggregate)
    await conn.execute(
        "DELETE FROM ga4_project_funnel WHERE source != 'all_campaigns' "
        "AND source != 'lp_entry' "
        "AND utm_content IS NULL AND utm_term IS NULL AND utm_campaign IS NULL"
    )

    inserted = 0
    for codename, sources in source_data.items():
        pid = cn_to_pid.get(codename)
        if not pid:
            continue

        for (source, medium), events in sources.items():
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 0, 0, 0) "
                "ON CONFLICT DO NOTHING",
                pid, source, medium,
                events.get("wp_entry", 0),
                events.get("apply_click", 0),
                events.get("signup", 0),
                events.get("nda_signed", 0),
            )
            inserted += 1

    print("Inserted %d source rows" % inserted)

    # Verify Centaurus breakdown
    print("\n=== Centaurus source breakdown ===")
    rows = await conn.fetch(
        "SELECT source, medium, wp_entry, apply_click, nda_signed "
        "FROM ga4_project_funnel "
        "WHERE project_id = (SELECT id FROM projects WHERE codename = 'centaurus') "
        "AND source != 'all_campaigns' AND source != 'lp_entry' "
        "AND utm_content IS NULL AND utm_term IS NULL AND utm_campaign IS NULL "
        "ORDER BY wp_entry DESC LIMIT 10"
    )
    for r in rows:
        print("  %-20s %-10s  views=%6d  apply=%5d  nda=%4d" % (
            r["source"], r["medium"], r["wp_entry"], r["apply_click"], r["nda_signed"]))

    await conn.close()
    print("\nDone!")

asyncio.run(main())
