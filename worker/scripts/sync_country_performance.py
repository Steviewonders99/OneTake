#!/usr/bin/env python3.12
"""Sync per-country performance data from GA4 export into project_country_performance.

Reads the GA4 campaign × country × event export, maps campaigns to projects,
and aggregates page_views, apply_clicks, applications per country per project.

Run after seeding GA4 funnel data:
    python3.12 worker/scripts/sync_country_performance.py

Cron: runs as part of cron_sync_all.py after GA4 funnel sync.
"""
import asyncio
import asyncpg
import json
import re
from collections import defaultdict

DATABASE_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

GA4_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779317828834.txt"
)

PATTERNS = [
    (r"(?i)^[Cc]entaurus", "centaurus"),
    (r"(?i)^(MAPS_)?[Mm]ilky\s*[Ww]ay", "internet_judging"),
    (r"(?i)^[Mm]ilkyway", "internet_judging"),
    (r"(?i)^lumina", "lumina"),
    (r"(?i)^humus", "humus"),
    (r"(?i)^hummus", "humus"),
    (r"(?i)^andromeda", "andromeda"),
    (r"(?i)^Andromeda", "andromeda"),
    (r"(?i)^fur.?frame", "fur_frame"),
    (r"(?i)^furframe", "fur_frame"),
    (r"(?i)^fred.spanish", "fred"),
    (r"(?i)^fred(?!.Ann)", "fred"),
    (r"(?i)^Fred Annotation", "fred-annotation"),
    (r"(?i)^mosaic", "mosaic"),
    (r"(?i)^kilo", "kilo"),
    (r"(?i)^[Jj]ellyfish", "jellyfish"),
    (r"(?i)^voice.assistant", "jellyfish"),
    (r"(?i)^[Ll]ighthouse", "lighthouse-3"),
    (r"(?i)^[Pp]hoto.ML", "project_photo_ml_iq_2"),
    (r"(?i)^motto", "motto"),
    (r"(?i)^[Aa]cceptabilit", "acceptability_and_preference"),
    (r"(?i)^accpref", "acceptability_and_preference"),
    (r"(?i)^[Aa]cceptability", "acceptability_and_preference"),
    (r"(?i)^HT.MTPE", "ht-human-translation-and-mtpe-machine-translation-post-editing"),
    (r"(?i)^HT_MTPE", "ht-human-translation-and-mtpe-machine-translation-post-editing"),
    (r"(?i)^HT AND MTPE", "ht-human-translation-and-mtpe-machine-translation-post-editing"),
    (r"(?i)^ht_mtpe", "ht-human-translation-and-mtpe-machine-translation-post-editing"),
    (r"(?i)^[Ss]pring", "project_spring"),
    (r"(?i)^[Ee]duc.Pron", "education-pronunciation-evaluation"),
    (r"(?i)^[Ss]equoia", "paragraph-level-acceptability"),
    (r"(?i)^Longitudinal", "vega-audio-data-collection"),
    (r"(?i)^[Kk]oala", "paragraph-level-acceptability"),
    (r"(?i)^[Nn]exa", "nexa"),
    (r"(?i)^onyx", "onyx-ocr-annotation-finnish"),
    (r"(?i)^[Vv]ega.Audio.Collection.*QA", "vega-audio-collection-qa"),
    (r"(?i)^[Vv]ega.*Audio.*Data", "vega-audio-data-collection"),
    (r"(?i)^[Vv]ega.Transcription", "vega-transcription"),
    (r"(?i)^vegatranscription", "vega-transcription"),
    (r"(?i)^[Kk]awaii", "kawaii-audio-annotation-and-speaker-identification"),
    (r"(?i)^[Bb]GN", "bgn-audio"),
    (r"(?i)^[Hh]usky.Speaker", "husky_speaker"),
    (r"(?i)^[Hh]usky.Mod", "husky_moderator"),
    (r"(?i)^[Ll]eli", "leli"),
    (r"(?i)^[Aa]thena", "athena-ai-agent-reviewer"),
]

EVENT_MAP = {"page_view": "page_views", "apply_click": "apply_clicks", "purchase": "applications"}


def resolve(name):
    if name in ("(organic)", "(direct)", "(referral)", "(not set)"):
        return None
    for p, c in PATTERNS:
        if re.match(p, name):
            return c
    return None


async def main():
    conn = await asyncpg.connect(DATABASE_URL)

    projects = await conn.fetch("SELECT id, codename FROM projects WHERE status = 'active'")
    cn_to_pid = {r["codename"]: r["id"] for r in projects}

    with open(GA4_FILE) as f:
        data = json.load(f)

    # project → country → {page_views, apply_clicks, applications}
    country_data = defaultdict(lambda: defaultdict(lambda: {"page_views": 0, "apply_clicks": 0, "applications": 0}))

    for row in data["rows"]:
        dims = row["dimension_values"]
        campaign = dims[0]["value"]
        country = dims[1]["value"]
        event = dims[2]["value"]
        users = int(row["metric_values"][0]["value"])

        codename = resolve(campaign)
        if not codename:
            continue
        field = EVENT_MAP.get(event)
        if not field:
            continue

        country_data[codename][country][field] += users

    # Clear and reseed
    await conn.execute("DELETE FROM project_country_performance")

    inserted = 0
    for codename, countries in country_data.items():
        pid = cn_to_pid.get(codename)
        if not pid:
            continue
        for country, metrics in countries.items():
            if metrics["page_views"] < 5:
                continue
            await conn.execute(
                "INSERT INTO project_country_performance "
                "(project_id, country, page_views, apply_clicks, applications) "
                "VALUES ($1, $2, $3, $4, $5) "
                "ON CONFLICT (project_id, country) DO UPDATE SET "
                "page_views = EXCLUDED.page_views, apply_clicks = EXCLUDED.apply_clicks, "
                "applications = EXCLUDED.applications",
                pid, country, metrics["page_views"], metrics["apply_clicks"], metrics["applications"],
            )
            inserted += 1

    print("Inserted %d country rows for %d projects" % (inserted, len(country_data)))

    # Verify
    top = await conn.fetch("""
        SELECT p.codename, count(*) as countries,
            sum(cp.page_views) as views, sum(cp.applications) as apps
        FROM project_country_performance cp
        JOIN projects p ON p.id = cp.project_id
        GROUP BY p.codename ORDER BY sum(cp.applications) DESC LIMIT 10
    """)
    print("\nTop projects by country coverage:")
    for r in top:
        print("  %-30s %3d countries  %6d views  %4d apps" % (
            r["codename"], r["countries"], r["views"], r["apps"]))

    await conn.close()
    print("\nDone!")

asyncio.run(main())
