#!/usr/bin/env python3
"""Database migration for campaign strategies table and related columns.

Run this script to apply the migration to Neon:
    cd /Users/stevenjunop/centric-intake/worker && python3 migrate_campaign_strategies.py
"""
import asyncio

import asyncpg
from config import DATABASE_URL


async def migrate():
    """Create campaign_strategies table and add targeting columns."""
    conn = await asyncpg.connect(DATABASE_URL)

    # 1. Create campaign_strategies table
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS campaign_strategies (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id       UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
            country          TEXT NOT NULL,
            tier             INT DEFAULT 1,
            monthly_budget   NUMERIC,
            budget_mode      TEXT DEFAULT 'ratio' CHECK (budget_mode IN ('fixed', 'ratio')),
            strategy_data    JSONB NOT NULL,
            evaluation_score NUMERIC,
            evaluation_data  JSONB,
            evaluation_passed BOOLEAN,
            version          INT DEFAULT 1,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    print("Created campaign_strategies table")

    # 2. Create index
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_strategies_request
        ON campaign_strategies(request_id)
    """)
    print("Created index on campaign_strategies.request_id")

    # 3. Add targeting_profile to actor_profiles
    await conn.execute("""
        ALTER TABLE actor_profiles
        ADD COLUMN IF NOT EXISTS targeting_profile JSONB
    """)
    print("Added targeting_profile column to actor_profiles")

    # 4. Add budget_data to creative_briefs
    await conn.execute("""
        ALTER TABLE creative_briefs
        ADD COLUMN IF NOT EXISTS budget_data JSONB
    """)
    print("Added budget_data column to creative_briefs")

    # 5. Add ad_set_assignment to generated_assets
    await conn.execute("""
        ALTER TABLE generated_assets
        ADD COLUMN IF NOT EXISTS ad_set_assignment JSONB
    """)
    print("Added ad_set_assignment column to generated_assets")

    await conn.close()
    print("\nMigration complete: campaign_strategies table + 3 new columns")


if __name__ == "__main__":
    asyncio.run(migrate())
