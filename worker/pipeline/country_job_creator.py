"""Country Job Creator — replaces campaign_splitter.

Instead of creating child intake_requests, creates per-country
compute_jobs on the SAME intake_request. Each job runs the full
pipeline for one country.
"""
from __future__ import annotations

import json
import logging
import uuid

logger = logging.getLogger(__name__)

# Persona/actor scaling by country count.
PERSONA_SCALING = {
    1: {"personas": 2, "actors_per_persona": 2},
    2: {"personas": 2, "actors_per_persona": 2},
}
PERSONA_SCALING_DEFAULT = {"personas": 1, "actors_per_persona": 1}


def get_persona_scaling(country_count: int) -> dict:
    """Return persona/actor counts for a given number of target countries."""
    return PERSONA_SCALING.get(country_count, PERSONA_SCALING_DEFAULT)


def has_country_quotas(request: dict) -> bool:
    """Check if an intake request has structured country quotas."""
    form_data = request.get("form_data") or {}
    quotas = form_data.get("country_quotas", []) if isinstance(form_data, dict) else []
    return isinstance(quotas, list) and len(quotas) >= 1


async def create_country_jobs(request: dict, request_id: str) -> list[dict]:
    """Create per-country compute_jobs for a multi-country campaign.

    Parameters
    ----------
    request : dict
        The intake request from Neon.
    request_id : str
        The intake request ID (same for all country jobs).

    Returns
    -------
    list[dict]
        List of created job dicts with job_id and country.
    """
    from neon_client import _get_pool

    quotas = request["form_data"]["country_quotas"]
    country_count = len(quotas)
    scaling = get_persona_scaling(country_count)

    logger.info(
        "Creating %d country jobs for campaign '%s' (scaling: %d personas, %d actors/persona)",
        country_count,
        request.get("title", "Untitled"),
        scaling["personas"],
        scaling["actors_per_persona"],
    )

    pool = await _get_pool()
    jobs = []

    for quota in quotas:
        if not isinstance(quota, dict) or not quota.get("country"):
            logger.warning("Skipping invalid quota entry: %s", quota)
            continue

        job_id = str(uuid.uuid4())
        country = quota["country"]

        feedback_data = {
            "persona_count": scaling["personas"],
            "actors_per_persona": scaling["actors_per_persona"],
            "total_volume": quota.get("total_volume", 0),
            "rate": quota.get("rate", 0),
            "currency": quota.get("currency", "USD"),
            "demographics": quota.get("demographics", []),
            "locale": quota.get("locale", ""),
        }

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO compute_jobs (id, request_id, job_type, country, status, feedback_data, created_at)
                VALUES ($1::uuid, $2::uuid, 'generate_country', $3, 'pending', $4::jsonb, NOW())
                """,
                job_id,
                request_id,
                country,
                json.dumps(feedback_data),
            )

        jobs.append({"job_id": job_id, "country": country})
        logger.info("  Created job for %s (volume=%d, rate=$%.2f)", country, quota.get("total_volume", 0), quota.get("rate", 0))

    logger.info("Country job creation complete: %d jobs queued", len(jobs))
    return jobs
