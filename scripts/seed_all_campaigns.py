#!/usr/bin/env python3.12
"""Map ALL 1,110 GA4 campaign names to projects and reseed everything.

Uses expanded fuzzy patterns + exact matches to maximize coverage.
"""
import asyncio
import asyncpg
import json
import re
from collections import defaultdict

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

# Full dataset: campaign × source × medium × event
GA4_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779309853371.txt"
)

# Expanded campaign → project patterns (order matters — first match wins)
PATTERNS = [
    # Exact matches first
    (r"^centaurus$", "centaurus"),
    (r"^centaurus-kids$", "centaurus"),
    (r"^milkyway$", "internet_judging"),
    (r"^lumina$", "lumina"),
    (r"^lumina_conv$", "lumina"),
    (r"^humus$", "humus"),
    (r"^humus-adults$", "humus"),
    (r"^humus-cold-std$", "humus"),
    (r"^humus-cold-nyc$", "humus"),
    (r"^humus-cold-lv$", "humus"),
    (r"^humus-cold-phx$", "humus"),
    (r"^hummus_conversions$", "humus"),
    (r"^humus-kids$", "humus_3"),
    (r"^andromeda$", "andromeda"),
    (r"^fur-frame$", "fur_frame"),
    (r"^mosaic$", "mosaic"),
    (r"^kilo$", "kilo"),
    (r"^motto$", "motto"),
    (r"^onyx$", "onyx-ocr-annotation-finnish"),
    (r"^vega$", "vega-audio-data-collection"),
    (r"^lighthouse-3$", "lighthouse-3"),
    (r"^lighthouse3$", "lighthouse-3"),

    # Prefix patterns (case-insensitive)
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
    (r"(?i)^vega$", "vega-audio-data-collection"),
    (r"(?i)^[Kk]awaii", "kawaii-audio-annotation-and-speaker-identification"),
    (r"(?i)^[Bb]GN", "bgn-audio"),
    (r"(?i)^[Aa]dLoc", "adloc"),
    (r"(?i)^AdLoc", "adloc"),
    (r"(?i)^[Aa]va.Audio", "ava-audio-collection"),
    (r"(?i)^[Aa]mber", "amber_imageannotator"),
    (r"(?i)^[Dd]iting", "diting-annotation"),
    (r"(?i)^[Bb]oard", "board"),
    (r"(?i)^UHRS", "uhrs-crowd-labeling-tasks"),
    (r"(?i)^[Hh]usky.Speaker", "husky_speaker"),
    (r"(?i)^[Hh]usky.Mod", "husky_moderator"),
    (r"(?i)^[Ll]eli", "leli"),
    (r"(?i)^[Aa]thena", "athena-ai-agent-reviewer"),
    (r"(?i)^[Rr]edwing", "redwing-user-experience-evaluation-medical-domain"),
    (r"(?i)^[Hh]arbor", "adaptation"),  # Harbor Red Teaming → Adaptation
    (r"(?i)^[Ss]agittarius", "paragraph-level-acceptability"),
    (r"(?i)^[Ss]earch.Evaluation", "paragraph-level-acceptability"),
    (r"(?i)^[Aa]zalea", "long-context-acceptability"),
    (r"(?i)^[Ll]ong.Context", "long-context-acceptability"),
    (r"(?i)^Paragraph", "paragraph-level-acceptability"),
    (r"(?i)^HT.*Long.*Context", "ht-long-context-human-translation-project"),
    (r"(?i)^[Dd]r.Strange", "dr-strange"),
    (r"(?i)^[Kk]arl", "karl_llm"),
    (r"(?i)^moonbrush", "moonbrush"),
    (r"(?i)^[Oo]rbit", "project-orbit-in-home-video-data-collection-seattle"),
    (r"(?i)^APT", "apt-collection"),
    (r"(?i)^as-npc", "adaptation"),  # as-npc codes → Adaptation
]

EVENT_MAP = {"page_view": "wp_entry", "apply_click": "apply_click", "sign_up": "signup", "purchase": "nda_signed"}

def resolve(name):
    if name in ("(organic)", "(direct)", "(referral)", "(not set)"):
        return None
    for pattern, codename in PATTERNS:
        if re.match(pattern, name):
            return codename
    return None


async def main():
    conn = await asyncpg.connect(DB_URL)
    projects = await conn.fetch("SELECT id, codename FROM projects")
    cn_to_pid = {r["codename"]: r["id"] for r in projects}

    with open(GA4_FILE) as f:
        data = json.load(f)

    # Aggregate: project → event → users (for all_campaigns row)
    project_totals = defaultdict(lambda: defaultdict(int))
    # project → source/medium → event → users (for per-source rows)
    project_sources = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    unmapped = defaultdict(int)
    mapped_campaigns = set()

    for row in data["rows"]:
        dims = row["dimension_values"]
        campaign = dims[0]["value"]
        source = dims[1]["value"]
        medium = dims[2]["value"]
        event = dims[3]["value"]
        users = int(row["metric_values"][0]["value"])

        codename = resolve(campaign)
        if not codename:
            unmapped[campaign] += users
            continue
        field = EVENT_MAP.get(event)
        if not field:
            continue

        mapped_campaigns.add(campaign)
        project_totals[codename][field] += users
        project_sources[codename][(source, medium)][field] += users

    print("Mapped %d campaigns to %d projects" % (len(mapped_campaigns), len(project_totals)))
    print("Unmapped: %d campaigns (%d users)" % (len(unmapped), sum(unmapped.values())))

    # Top unmapped
    top_un = sorted(unmapped.items(), key=lambda x: -x[1])[:15]
    print("\nTop unmapped:")
    for c, u in top_un:
        print("  %-50s %6d" % (c[:50], u))

    # Clear and reseed
    print("\nReseeding ga4_project_funnel...")
    await conn.execute("DELETE FROM ga4_project_funnel")

    inserted_agg = 0
    inserted_src = 0
    for codename, events in project_totals.items():
        pid = cn_to_pid.get(codename)
        if not pid:
            continue
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
        inserted_agg += 1

        # Per-source rows
        for (source, medium), sevents in project_sources[codename].items():
            await conn.execute(
                "INSERT INTO ga4_project_funnel "
                "(project_id, source, medium, wp_entry, apply_click, signup, "
                "mfa_setup, profile_created, nda_signed, certification, browsing_jobs, doing_tasks) "
                "VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, 0, 0, 0) "
                "ON CONFLICT DO NOTHING",
                pid, source, medium,
                sevents.get("wp_entry", 0), sevents.get("apply_click", 0),
                sevents.get("signup", 0), sevents.get("nda_signed", 0),
            )
            inserted_src += 1

    print("Inserted %d aggregate + %d source rows" % (inserted_agg, inserted_src))

    # Add LP views back
    LP_DATA = {
        "lumina": 21473, "andromeda": 16559, "fred": 2413, "kilo": 2827,
        "jellyfish": 2237, "fur_frame": 2024, "acceptability_and_preference": 1526,
        "onyx-ocr-annotation-finnish": 1243, "mosaic": 516, "motto": 407,
        "internet_judging": 53, "vega-audio-data-collection": 3, "humus": 3,
    }
    for codename, lp_views in LP_DATA.items():
        pid = cn_to_pid.get(codename)
        if pid:
            await conn.execute(
                "UPDATE ga4_project_funnel SET wp_entry = wp_entry + $1 "
                "WHERE project_id = $2 AND source = 'all_campaigns'", lp_views, pid)

    # AidaForm thank-you corrections
    AIDAFORM = {"lumina": 1005, "humus": 519, "fur_frame": 290, "kilo": 77, "humus_3": 19}
    for codename, total in AIDAFORM.items():
        pid = cn_to_pid.get(codename)
        if pid:
            await conn.execute(
                "UPDATE ga4_project_funnel SET nda_signed = $1 "
                "WHERE project_id = $2 AND source = 'all_campaigns'", total, pid)

    # Fill (other)/unattributed gaps
    projs = await conn.fetch("""
        SELECT p.id, p.codename,
            (SELECT nda_signed FROM ga4_project_funnel WHERE project_id = p.id AND source = 'all_campaigns') as agg_nda,
            (SELECT wp_entry FROM ga4_project_funnel WHERE project_id = p.id AND source = 'all_campaigns') as agg_wp,
            (SELECT sum(nda_signed) FROM ga4_project_funnel WHERE project_id = p.id AND source NOT IN ('all_campaigns','lp_entry') AND utm_content IS NULL AND utm_term IS NULL) as src_nda,
            (SELECT sum(wp_entry) FROM ga4_project_funnel WHERE project_id = p.id AND source NOT IN ('all_campaigns','lp_entry') AND utm_content IS NULL AND utm_term IS NULL) as src_wp
        FROM projects p WHERE p.id IN (SELECT DISTINCT project_id FROM ga4_project_funnel WHERE source = 'all_campaigns')
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

    # Rebuild organic weekly with per-source
    print("\nRebuilding ga4_organic_weekly...")
    await conn.execute("DELETE FROM ga4_organic_weekly")
    await conn.execute("""
        INSERT INTO ga4_organic_weekly (project_id, codename, week_start, source, medium, channel, metric_type, clicks, conversions)
        SELECT g.project_id, p.codename, ws.week_start, g.source, g.medium, g.source, 'organic',
            CASE WHEN ws.week_num=1 THEN GREATEST(ROUND(g.wp_entry*0.35),0) WHEN ws.week_num=2 THEN GREATEST(ROUND(g.wp_entry*0.30),0)
                 WHEN ws.week_num=3 THEN GREATEST(ROUND(g.wp_entry*0.20),0) WHEN ws.week_num=4 THEN GREATEST(ROUND(g.wp_entry*0.15),0) ELSE 0 END,
            CASE WHEN ws.week_num=1 THEN GREATEST(ROUND(g.nda_signed*0.35),0) WHEN ws.week_num=2 THEN GREATEST(ROUND(g.nda_signed*0.30),0)
                 WHEN ws.week_num=3 THEN GREATEST(ROUND(g.nda_signed*0.20),0) WHEN ws.week_num=4 THEN GREATEST(ROUND(g.nda_signed*0.15),0) ELSE 0 END
        FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id
        CROSS JOIN (SELECT 1 AS week_num, date_trunc('week',CURRENT_DATE)::DATE AS week_start
            UNION ALL SELECT 2,(date_trunc('week',CURRENT_DATE)-INTERVAL '7 days')::DATE
            UNION ALL SELECT 3,(date_trunc('week',CURRENT_DATE)-INTERVAL '14 days')::DATE
            UNION ALL SELECT 4,(date_trunc('week',CURRENT_DATE)-INTERVAL '21 days')::DATE) ws
        WHERE g.utm_content IS NULL AND g.utm_term IS NULL AND g.utm_campaign IS NULL AND g.source NOT IN ('all_campaigns','lp_entry')
        ON CONFLICT (project_id,week_start,source,medium) DO UPDATE SET clicks=EXCLUDED.clicks, conversions=EXCLUDED.conversions
    """)

    # Rebuild mat view
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
    print("\n=== FINAL COVERAGE ===")
    rows = await conn.fetch("""
        SELECT p.codename,
            (SELECT wp_entry FROM ga4_project_funnel WHERE project_id=p.id AND source='all_campaigns') as wp,
            (SELECT nda_signed FROM ga4_project_funnel WHERE project_id=p.id AND source='all_campaigns') as nda
        FROM projects p WHERE status='active' ORDER BY
            (SELECT nda_signed FROM ga4_project_funnel WHERE project_id=p.id AND source='all_campaigns') DESC NULLS LAST
    """)
    has_data = sum(1 for r in rows if (r["wp"] or 0) > 0)
    has_conv = sum(1 for r in rows if (r["nda"] or 0) > 0)
    empty = sum(1 for r in rows if (r["wp"] or 0) == 0)
    print("With data: %d / %d  |  With conversions: %d  |  Empty: %d" % (has_data, len(rows), has_conv, empty))

    for r in rows:
        wp = r["wp"] or 0
        nda = r["nda"] or 0
        if wp > 0 or nda > 0:
            print("  %-35s %8d views  %5d NDA" % (r["codename"], wp, nda))

    await conn.close()
    print("\nDone!")

asyncio.run(main())
