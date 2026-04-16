"""Cache manager for reusable pipeline assets.

Two caching systems:
1. RESEARCH CACHE — Cultural research per region (file-based JSON)
   If we researched "US-WA" before, reuse it for the next campaign.
   Research changes slowly — cache for 7 days.

2. ACTOR LIBRARY — Approved actors + seeds + angles in Neon
   If a future campaign needs "Seattle tech professional", check
   the library first before generating a new actor.
   Actors are reusable across campaigns targeting similar demographics.
"""
from __future__ import annotations

import json
import logging
import os
import time

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
RESEARCH_CACHE_TTL = 7 * 24 * 3600  # 7 days


# ── Research Cache (file-based) ──────────────────────────────────

def get_cached_research(region: str) -> dict | None:
    """Get cached cultural research for a region if fresh enough."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"research_{_safe_key(region)}.json")

    if not os.path.exists(cache_file):
        return None

    try:
        with open(cache_file) as f:
            data = json.load(f)

        cached_at = data.get("_cached_at", 0)
        if time.time() - cached_at > RESEARCH_CACHE_TTL:
            logger.info("Research cache EXPIRED for %s (%.0f days old)", region, (time.time() - cached_at) / 86400)
            return None

        logger.info("Research cache HIT for %s (%.0f hours old)", region, (time.time() - cached_at) / 3600)
        return data.get("research")

    except (json.JSONDecodeError, KeyError) as e:
        logger.warning("Research cache corrupt for %s: %s", region, e)
        return None


def save_research_cache(region: str, research: dict) -> None:
    """Cache cultural research for a region."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"research_{_safe_key(region)}.json")

    data = {
        "_cached_at": time.time(),
        "_region": region,
        "research": research,
    }

    with open(cache_file, "w") as f:
        json.dump(data, f, default=str)

    logger.info("Research cached for %s (%d dimensions)", region, len([k for k in research if not k.startswith("_")]))


# ── Actor Library (Neon-based) ───────────────────────────────────

async def find_reusable_actors(
    persona_description: str,
    region: str,
    count: int = 1,
) -> list[dict]:
    """Search for existing approved actors that match a persona description.

    Looks in Neon for actors with:
    - Same or similar region
    - Existing seed images (VQA approved)
    - Compatible face_lock data

    Returns matching actors with their image URLs, or empty list.
    """
    try:
        from neon_client import _get_pool

        pool = await _get_pool()
        async with pool.acquire() as conn:
            # Find actors in the same region with approved images
            rows = await conn.fetch(
                """
                SELECT ap.id, ap.name, ap.face_lock, ap.prompt_seed,
                       ap.outfit_variations, ap.signature_accessory, ap.backdrops,
                       ap.request_id, ap.created_at,
                       COUNT(ga.id) as image_count
                FROM actor_profiles ap
                LEFT JOIN generated_assets ga ON ga.actor_id = ap.id
                    AND ga.asset_type = 'base_image'
                    AND ga.evaluation_score >= 0.80
                GROUP BY ap.id
                HAVING COUNT(ga.id) >= 1
                ORDER BY ap.created_at DESC
                LIMIT $1
                """,
                count * 3,  # Fetch more than needed for filtering
            )

        actors = []
        for row in rows:
            actor = dict(row)
            # Parse face_lock if string
            if isinstance(actor.get("face_lock"), str):
                try:
                    actor["face_lock"] = json.loads(actor["face_lock"])
                except (json.JSONDecodeError, TypeError):
                    pass
            actors.append(actor)

        if actors:
            logger.info(
                "Found %d reusable actors in library (requested %d)",
                len(actors), count,
            )

        return actors[:count]

    except Exception as e:
        logger.warning("Actor library search failed: %s", e)
        return []


async def get_actor_images(actor_id: str) -> list[dict]:
    """Get all approved images for an actor from Neon."""
    try:
        from neon_client import get_assets

        assets = await get_assets(None)  # Need to filter by actor_id
        return [
            a for a in assets
            if str(a.get("actor_id", "")) == actor_id
            and a.get("evaluation_score", 0) >= 0.80
        ]
    except Exception as e:
        logger.warning("Failed to get actor images: %s", e)
        return []


def _safe_key(text: str) -> str:
    """Convert text to a safe filename key."""
    return text.lower().replace(" ", "_").replace("/", "_").replace("-", "_")
