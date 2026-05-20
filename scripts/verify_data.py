#!/usr/bin/env python3.12
"""Verify database state after migration."""
import asyncio
import asyncpg

DB_URL = "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"

async def verify():
    conn = await asyncpg.connect(DB_URL)

    top = await conn.fetch(
        "SELECT codename, count(*) as weeks, sum(total_spend)::float as spend, "
        "sum(total_conversions) as conv, sum(total_clicks) as clicks "
        "FROM project_weekly_summary GROUP BY codename ORDER BY spend DESC"
    )
    print("=== Weekly summary by project ===")
    total_spend = 0
    total_conv = 0
    for r in top:
        cn = r["codename"]
        wk = r["weeks"]
        sp = r["spend"]
        cv = r["conv"]
        cl = r["clicks"]
        total_spend += sp
        total_conv += cv
        print("  %-25s %2d wk  EUR %10.2f  %5d conv  %6d clicks" % (cn, wk, sp, cv, cl))

    print("\n  TOTAL: EUR %.2f spend, %d conv across %d projects" % (total_spend, total_conv, len(top)))

    ga4_count = await conn.fetchval("SELECT count(*) FROM ga4_project_funnel")
    locale_count = await conn.fetchval("SELECT count(*) FROM project_locale_links")
    page_count = await conn.fetchval("SELECT count(*) FROM page_display_names")
    organic_count = await conn.fetchval("SELECT count(*) FROM ga4_organic_weekly")
    mapped = await conn.fetchval("SELECT count(*) FROM normalized_daily_metrics WHERE project_id IS NOT NULL")
    total_ndm = await conn.fetchval("SELECT count(*) FROM normalized_daily_metrics")

    print("\n=== Table counts ===")
    print("  ga4_project_funnel:  %d" % ga4_count)
    print("  ga4_organic_weekly:  %d" % organic_count)
    print("  project_locale_links: %d" % locale_count)
    print("  page_display_names:  %d" % page_count)
    print("  NDM mapped:          %d / %d" % (mapped, total_ndm))

    await conn.close()

asyncio.run(verify())
