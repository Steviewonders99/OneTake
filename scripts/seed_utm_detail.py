#!/usr/bin/env python3.12
"""Seed utm_campaign, utm_term, utm_content into ga4_project_funnel.

Parses GA4 reports with firstUserManualAdContent (utm_content) and
firstUserManualTerm (utm_term) dimensions. These show the specific
job board name, recruiter ID, flyer location, etc.

Uses totalUsers for dedup (not eventCount).
"""
import asyncio
import asyncpg
import json
import re
from collections import defaultdict

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

APPLY_SUCCESS_UTM_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779303465974.txt"
)
WP_ENTRY_UTM_FILE = (
    "/Users/stevenjunop/.claude/projects/-Users-stevenjunop-Oneformadata/"
    "de68cbf9-52d1-4c1f-a2d4-a4065a5ad28b/tool-results/"
    "mcp-analytics-mcp-run_report-1779303474066.txt"
)


def parse_file(filepath):
    with open(filepath) as f:
        data = json.load(f)
    results = []
    for row in data.get("rows", []):
        dims = row["dimension_values"]
        metrics = row["metric_values"]
        results.append({
            "page_path": dims[0]["value"],
            "source": dims[1]["value"],
            "medium": dims[2]["value"],
            "utm_content": dims[3]["value"] if dims[3]["value"] != "(not set)" else None,
            "utm_term": dims[4]["value"] if dims[4]["value"] != "(not set)" else None,
            "users": int(metrics[1]["value"]),
        })
    return results


def extract_slug(page_path):
    m = re.match(r"^/(jobs|join)/([^/?#]+)", page_path)
    return m.group(2) if m else None


def extract_crowd_id(page_path):
    m = re.search(r"/crowd/jobs/(\d+)", page_path)
    return m.group(1) if m else None


async def main():
    conn = await asyncpg.connect(DB_URL)

    # Build mappings
    projects = await conn.fetch("SELECT id, codename, wp_slug FROM projects")
    slug_to_pid = {}
    codename_to_pid = {}
    for p in projects:
        codename_to_pid[p["codename"]] = p["id"]
        if p["wp_slug"]:
            slug_to_pid[p["wp_slug"]] = p["id"]

    locale_rows = await conn.fetch(
        "SELECT project_id, platform_request_id FROM project_locale_links "
        "WHERE platform_request_id IS NOT NULL"
    )
    rid_to_pid = {}
    for r in locale_rows:
        rid = r["platform_request_id"]
        rid_to_pid[rid] = r["project_id"]
        if rid.startswith("crowd_"):
            rid_to_pid[rid.replace("crowd_", "")] = r["project_id"]

    # ── Parse apply_success with UTM detail ────────────────────────
    print("Parsing apply_success with UTM detail...")
    apply_rows = parse_file(APPLY_SUCCESS_UTM_FILE)
    inserted = 0
    for row in apply_rows:
        crowd_id = extract_crowd_id(row["page_path"])
        if not crowd_id:
            continue
        pid = rid_to_pid.get(crowd_id)
        if not pid:
            continue
        if not row["utm_content"] and not row["utm_term"]:
            continue

        await conn.execute(
            "INSERT INTO ga4_project_funnel "
            "(project_id, source, medium, utm_campaign, utm_term, utm_content, "
            "wp_entry, apply_click, signup, mfa_setup, profile_created, nda_signed, "
            "certification, browsing_jobs, doing_tasks) "
            "VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, 0, $7, 0, 0, 0) "
            "ON CONFLICT DO NOTHING",
            pid, row["source"], row["medium"], None, row["utm_term"],
            row["utm_content"], row["users"],
        )
        inserted += 1

    print("  Inserted %d apply_success rows with UTM detail" % inserted)

    # ── Parse wp_entry with UTM detail ─────────────────────────────
    print("Parsing wp_entry (job pages) with UTM detail...")
    entry_rows = parse_file(WP_ENTRY_UTM_FILE)
    entry_inserted = 0
    for row in entry_rows:
        slug = extract_slug(row["page_path"])
        if not slug:
            continue
        pid = slug_to_pid.get(slug)
        if not pid:
            continue
        if not row["utm_content"] and not row["utm_term"]:
            continue

        await conn.execute(
            "INSERT INTO ga4_project_funnel "
            "(project_id, source, medium, utm_campaign, utm_term, utm_content, "
            "wp_entry, apply_click, signup, mfa_setup, profile_created, nda_signed, "
            "certification, browsing_jobs, doing_tasks) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 0, 0, 0, 0, 0, 0) "
            "ON CONFLICT DO NOTHING",
            pid, row["source"], row["medium"], None, row["utm_term"],
            row["utm_content"], row["users"],
        )
        entry_inserted += 1

    print("  Inserted %d wp_entry rows with UTM detail" % entry_inserted)

    # ── Show what we have ──────────────────────────────────────────
    print("\n=== UTM Detail Summary ===")
    utms = await conn.fetch(
        "SELECT p.codename, g.source, g.medium, g.utm_content, g.utm_term, "
        "g.wp_entry, g.nda_signed "
        "FROM ga4_project_funnel g JOIN projects p ON p.id = g.project_id "
        "WHERE g.utm_content IS NOT NULL OR g.utm_term IS NOT NULL "
        "ORDER BY g.nda_signed DESC, g.wp_entry DESC LIMIT 25"
    )
    print("%-20s %-15s %-10s %-20s %-15s %6s %5s" % (
        "PROJECT", "SOURCE", "MEDIUM", "UTM_CONTENT", "UTM_TERM", "ENTRY", "APPS"))
    print("-" * 100)
    for r in utms:
        print("%-20s %-15s %-10s %-20s %-15s %6d %5d" % (
            r["codename"][:20], r["source"][:15], r["medium"][:10],
            (r["utm_content"] or "-")[:20], (r["utm_term"] or "-")[:15],
            r["wp_entry"], r["nda_signed"]))

    total_rows = await conn.fetchval("SELECT count(*) FROM ga4_project_funnel")
    utm_rows = await conn.fetchval(
        "SELECT count(*) FROM ga4_project_funnel WHERE utm_content IS NOT NULL OR utm_term IS NOT NULL"
    )
    print("\nTotal ga4_project_funnel rows: %d (%d with UTM detail)" % (total_rows, utm_rows))

    await conn.close()
    print("Done!")

asyncio.run(main())
