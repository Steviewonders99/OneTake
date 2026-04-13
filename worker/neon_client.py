"""Neon Postgres client for the Centric Intake local worker.

Uses asyncpg with connection pooling. Every public function acquires a
connection from the pool, executes one or more queries, and releases it.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg

from config import DATABASE_URL

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    """Lazily create and return a connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            statement_cache_size=0,  # Neon serverless works better without
        )
        logger.info("Connection pool created.")
    return _pool


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """Convert an asyncpg Record to a plain dict, serialising JSON columns."""
    d: dict[str, Any] = dict(row)
    for key, val in d.items():
        if isinstance(val, str):
            try:
                d[key] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                pass
    return d


# ---------------------------------------------------------------------------
# Compute jobs
# ---------------------------------------------------------------------------

async def fetch_pending_jobs() -> list[dict[str, Any]]:
    """Fetch up to 5 pending compute jobs, oldest first."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, request_id, job_type, stage_target, feedback,
                   created_at
            FROM compute_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 5
            """,
        )
    return [_row_to_dict(r) for r in rows]


async def claim_next_job(worker_id: str) -> dict[str, Any] | None:
    """Atomically claim the next pending job for this worker.

    Uses FOR UPDATE SKIP LOCKED to guarantee no two workers
    ever claim the same job, even when polling simultaneously.

    Returns the claimed job dict, or None if no pending jobs exist.
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE compute_jobs
            SET status = 'processing',
                started_at = NOW(),
                worker_id = $1
            WHERE id = (
                SELECT id FROM compute_jobs
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, request_id, job_type, stage_target, feedback, created_at
            """,
            worker_id,
        )
    if row is None:
        return None
    return _row_to_dict(row)


async def count_pending_jobs() -> int:
    """Count pending jobs in the queue. Used by supervisor for scaling decisions."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) as cnt FROM compute_jobs WHERE status = 'pending'"
        )
    return int(row["cnt"]) if row else 0


async def reset_stale_jobs(threshold_minutes: int = 30) -> int:
    """Reset jobs stuck in 'processing' for longer than threshold back to 'pending'.

    Returns number of jobs reset. Called by supervisor on startup and periodically.
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'pending', started_at = NULL, worker_id = NULL
            WHERE status = 'processing'
            AND started_at < NOW() - INTERVAL '1 minute' * $1
            """,
            threshold_minutes,
        )
    # result is like "UPDATE 3"
    count = int(result.split()[-1]) if result else 0
    return count


async def mark_job_processing(job_id: str) -> None:
    """Mark a compute job as processing."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'processing', started_at = NOW()
            WHERE id = $1
            """,
            job_id,
        )


async def mark_job_complete(job_id: str) -> None:
    """Mark a compute job as complete."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'complete', completed_at = NOW()
            WHERE id = $1
            """,
            job_id,
        )


async def mark_job_failed(job_id: str, error: str) -> None:
    """Mark a compute job as failed with an error message."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'failed',
                error_message = $2,
                completed_at = NOW()
            WHERE id = $1
            """,
            job_id,
            error,
        )


# ---------------------------------------------------------------------------
# Intake requests
# ---------------------------------------------------------------------------

async def get_intake_request(request_id: str) -> dict[str, Any]:
    """Read an intake request by ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, title, status, task_type,
                   target_languages, target_regions,
                   volume_needed, form_data,
                   created_at, updated_at
            FROM intake_requests
            WHERE id = $1
            """,
            request_id,
        )
    if row is None:
        raise ValueError(f"Intake request {request_id} not found")
    return _row_to_dict(row)


async def update_request_status(request_id: str, status: str) -> None:
    """Update the status of an intake request."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE intake_requests
            SET status = $2, updated_at = NOW()
            WHERE id = $1
            """,
            request_id,
            status,
        )


# ---------------------------------------------------------------------------
# Creative briefs
# ---------------------------------------------------------------------------

async def get_brief(request_id: str) -> dict[str, Any] | None:
    """Read the latest creative brief for a request."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, request_id, brief_data, design_direction,
                   evaluation_score, evaluation_data, content_languages,
                   created_at
            FROM creative_briefs
            WHERE request_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            request_id,
        )
    return _row_to_dict(row) if row else None


async def save_brief(
    request_id: str,
    data: dict[str, Any],
    pillar_primary: str | None = None,
    pillar_secondary: str | None = None,
    derived_requirements: dict | None = None,
) -> str:
    """Insert a creative brief and return its ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO creative_briefs
                (request_id, brief_data, design_direction,
                 evaluation_score, evaluation_data, content_languages,
                 pillar_primary, pillar_secondary, derived_requirements)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            """,
            request_id,
            json.dumps(data.get("brief_data", {}), default=str),
            json.dumps(data.get("design_direction", {}), default=str),
            data.get("evaluation_score", 0.0),
            json.dumps(data.get("evaluation_data", {}), default=str),
            data.get("content_languages", []),  # TEXT[] — pass list directly, not JSON string
            pillar_primary,
            pillar_secondary,
            json.dumps(derived_requirements, default=str) if derived_requirements is not None else None,
        )
    brief_id: str = row["id"]
    logger.info("Saved creative brief %s for request %s", brief_id, request_id)
    return brief_id


# ---------------------------------------------------------------------------
# Actor profiles
# ---------------------------------------------------------------------------

async def save_actor(request_id: str, data: dict[str, Any]) -> str:
    """Insert an actor profile and return its ID.

    Data keys match the DB schema: name, face_lock, prompt_seed,
    outfit_variations, signature_accessory, backdrops.
    """
    # Merge persona_key into face_lock so it's always available for grouping
    face_lock = data.get("face_lock", {})
    if isinstance(face_lock, str):
        try:
            face_lock = json.loads(face_lock)
        except (json.JSONDecodeError, TypeError):
            face_lock = {}
    if data.get("persona_key"):
        face_lock["persona_key"] = data["persona_key"]
    if data.get("persona_name"):
        face_lock["persona_name"] = data["persona_name"]

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO actor_profiles
                (request_id, name, face_lock, prompt_seed,
                 outfit_variations, signature_accessory, backdrops)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            """,
            request_id,
            data.get("name", "Contributor"),
            json.dumps(face_lock, default=str),
            data.get("prompt_seed", ""),
            json.dumps(data.get("outfit_variations", {}), default=str),
            data.get("signature_accessory", ""),
            data.get("backdrops", []),
        )
    return row["id"]


async def update_actor_seed(actor_id: str, seed_url: str) -> None:
    """Store the validated hero seed image URL on the actor profile.

    The actor_profiles table doesn't have a dedicated column for this,
    so we store it inside the face_lock JSONB as ``validated_seed_url``.
    This keeps the seed co-located with the identity data.
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE actor_profiles
            SET face_lock = face_lock || $1::jsonb
            WHERE id = $2
            """,
            json.dumps({"validated_seed_url": seed_url}, default=str),
            actor_id,
        )


async def get_actors(request_id: str) -> list[dict[str, Any]]:
    """Read all actor profiles for a request."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, request_id, name, face_lock, prompt_seed,
                   outfit_variations, signature_accessory, backdrops,
                   created_at
            FROM actor_profiles
            WHERE request_id = $1
            ORDER BY created_at ASC
            """,
            request_id,
        )
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Generated assets
# ---------------------------------------------------------------------------

async def save_asset(request_id: str, data: dict[str, Any]) -> str:
    """Insert a generated asset and return its ID."""
    pool = await _get_pool()
    metadata = data.get("metadata", {})
    actor_id = metadata.get("actor_id") or data.get("actor_id")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO generated_assets
                (request_id, actor_id, asset_type, platform, format,
                 language, blob_url, content, evaluation_score,
                 evaluation_data, evaluation_passed, stage)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
            """,
            request_id,
            actor_id,
            data.get("asset_type", "image"),
            data.get("platform", ""),
            data.get("format", ""),
            data.get("language", ""),
            data.get("blob_url", ""),
            json.dumps(metadata, default=str),
            metadata.get("vqa_score"),
            json.dumps(metadata.get("vqa_dimensions", {}), default=str),
            metadata.get("vqa_score", 0) >= 0.75 if metadata.get("vqa_score") else None,
            data.get("stage", 2),
        )
    return str(row["id"])


async def get_assets(request_id: str, asset_type: str | None = None) -> list[dict[str, Any]]:
    """Read generated assets for a request, optionally filtered by type."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        if asset_type:
            rows = await conn.fetch(
                """
                SELECT id, request_id, actor_id, asset_type, platform, format,
                       language, blob_url, content, copy_data,
                       evaluation_score, evaluation_data, evaluation_passed,
                       stage, created_at
                FROM generated_assets
                WHERE request_id = $1 AND asset_type = $2
                ORDER BY created_at ASC
                """,
                request_id,
                asset_type,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, request_id, actor_id, asset_type, platform, format,
                       language, blob_url, content, copy_data,
                       evaluation_score, evaluation_data, evaluation_passed,
                       stage, created_at
                FROM generated_assets
                WHERE request_id = $1
                ORDER BY created_at ASC
                """,
                request_id,
            )
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Campaign strategies
# ---------------------------------------------------------------------------

async def save_campaign_strategy(request_id: str, strategy: dict) -> str:
    """Save a campaign strategy to Neon. Returns the strategy ID."""
    import uuid
    pool = await _get_pool()
    strategy_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO campaign_strategies (id, request_id, country, tier, monthly_budget,
                budget_mode, strategy_data, evaluation_score, evaluation_data, evaluation_passed)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10)
            """,
            strategy_id,
            request_id,
            strategy.get("country", "global"),
            str(strategy.get("tier", 1)),
            strategy.get("monthly_budget"),
            strategy.get("budget_mode", "ratio"),
            json.dumps(strategy.get("strategy_data", {}), default=str),
            strategy.get("evaluation_score"),
            json.dumps(strategy.get("evaluation_data", {}), default=str) if strategy.get("evaluation_data") else None,
            strategy.get("evaluation_passed"),
        )
    return strategy_id


async def update_actor_targeting(actor_id: str, targeting_profile: dict) -> None:
    """Save targeting_profile JSONB on an actor profile."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE actor_profiles SET targeting_profile = $1::jsonb WHERE id = $2::uuid",
            json.dumps(targeting_profile, default=str),
            actor_id,
        )


# ── Design Artifacts ────────────────────────────────────────────


async def get_active_artifacts() -> list[dict[str, Any]]:
    """Fetch all active design artifacts for compositor prompt."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT artifact_id, category, description, blob_url,
                   dimensions, css_class, usage_snippet, usage_notes,
                   pillar_affinity, format_affinity
            FROM design_artifacts
            WHERE is_active = true
            ORDER BY category, artifact_id
        """)
    return [dict(r) for r in rows]


async def upsert_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    """Insert or update a design artifact. Returns the upserted row."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO design_artifacts
                (artifact_id, category, description, blob_url,
                 dimensions, css_class, usage_snippet, usage_notes,
                 pillar_affinity, format_affinity, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (artifact_id) DO UPDATE SET
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                blob_url = EXCLUDED.blob_url,
                dimensions = EXCLUDED.dimensions,
                css_class = EXCLUDED.css_class,
                usage_snippet = EXCLUDED.usage_snippet,
                usage_notes = EXCLUDED.usage_notes,
                pillar_affinity = EXCLUDED.pillar_affinity,
                format_affinity = EXCLUDED.format_affinity,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            RETURNING *
        """,
            artifact["artifact_id"],
            artifact["category"],
            artifact["description"],
            artifact["blob_url"],
            artifact.get("dimensions", ""),
            artifact.get("css_class", ""),
            artifact["usage_snippet"],
            artifact.get("usage_notes", ""),
            artifact.get("pillar_affinity", []),
            artifact.get("format_affinity", []),
            artifact.get("is_active", True),
        )
    return dict(row)


async def delete_artifact(artifact_id: str, *, hard: bool = False) -> None:
    """Delete a design artifact. Soft delete by default (sets is_active=false).
    Pass hard=True to remove the row entirely (for test cleanup).
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        if hard:
            await conn.execute(
                "DELETE FROM design_artifacts WHERE artifact_id = $1",
                artifact_id,
            )
        else:
            await conn.execute(
                "UPDATE design_artifacts SET is_active = false, updated_at = NOW() WHERE artifact_id = $1",
                artifact_id,
            )


# ---------------------------------------------------------------------------
# Campaign landing pages
# ---------------------------------------------------------------------------

async def upsert_campaign_landing_page(
    request_id: str,
    field: str,
    value: str,
) -> None:
    """Upsert a single field in campaign_landing_pages.

    Parameters
    ----------
    request_id : str
        The intake request UUID.
    field : str
        One of: 'job_posting_url', 'landing_page_url', 'ada_form_url'.
    value : str
        The URL to store.
    """
    allowed = {"job_posting_url", "landing_page_url", "ada_form_url"}
    if field not in allowed:
        raise ValueError(f"Invalid field: {field}. Must be one of {allowed}")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO campaign_landing_pages (id, request_id, {field}, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
            ON CONFLICT (request_id) DO UPDATE SET {field} = $2, updated_at = NOW()
            """,
            request_id,
            value,
        )
    logger.info("Upserted campaign_landing_pages.%s for %s", field, request_id[:8])
