"""Campaign Splitter — splits multinational RFPs into per-country campaigns.

When an RFP spans multiple countries (e.g., Vega with Morocco, France, Brazil,
Spain, India), this creates one child campaign per country, each with:
- City-level targeting (top 2-3 cities for recruitment in that country)
- Country-specific language pairs
- Independent pipeline execution (own personas, creatives, videos)

Flow:
1. Parent RFP comes in with multiple regions
2. Splitter groups regions by country
3. For each country: LLM identifies top recruitment cities
4. Creates child intake_requests (one per country)
5. Creates compute_jobs for each child (pending)
6. Parent job marked as 'split' (not run through pipeline)

The worker then picks up each child job independently.
"""
from __future__ import annotations

import json
import logging
import uuid

logger = logging.getLogger(__name__)

# Minimum regions to trigger splitting (1-2 countries = just run it)
SPLIT_THRESHOLD = 3

# Map regions to their country for grouping
# Handles sub-regions like "South Tyrol" → Italy, "Tamil Nadu" → India
REGION_TO_COUNTRY: dict[str, str] = {
    # Direct country matches
    "morocco": "Morocco",
    "tunisia": "Tunisia",
    "algeria": "Algeria",
    "france": "France",
    "finland": "Finland",
    "germany": "Germany",
    "israel": "Israel",
    "italy": "Italy",
    "malaysia": "Malaysia",
    "brazil": "Brazil",
    "portugal": "Portugal",
    "spain": "Spain",
    "sweden": "Sweden",
    # Sub-regions → country
    "south tyrol": "Italy",
    "basque country": "Spain",
    "catalonia": "Spain",
    "india (tamil nadu)": "India",
    "india": "India",
    "tamil nadu": "India",
    "us-wa": "United States",
    "seattle-metro": "United States",
    "united states": "United States",
    # Add more as needed
}

# Language pairs grouped by country
COUNTRY_LANGUAGE_MAP: dict[str, list[str]] = {
    "Morocco": ["Arabic", "French"],
    "Tunisia": ["Arabic", "French"],
    "Algeria": ["Arabic", "French", "English"],
    "France": ["French", "English", "German"],
    "Finland": ["Finnish", "English"],
    "Germany": ["German", "English", "French"],
    "Israel": ["Hebrew", "English"],
    "Italy": ["Italian", "German"],
    "Malaysia": ["Malay", "English"],
    "Brazil": ["Portuguese", "English"],
    "Portugal": ["Portuguese", "English"],
    "Spain": ["Spanish", "Catalan", "Basque"],
    "Sweden": ["Swedish", "English"],
    "India": ["Tamil", "English", "Hindi"],
    "United States": ["English", "Spanish"],
}

# City selection prompt
CITY_SELECTION_SYSTEM = """You are a recruitment marketing strategist for OneForma.
Given a country and a task type, identify EXACTLY 3 cities for recruitment ads.

CITY SELECTION RULES (follow this order):
1. CITY 1 — HIGHEST DENSITY METRO: The largest, most populated city in the country.
   This is where the most potential contributors are. Always pick the #1 metro.
   Examples: São Paulo (not Brasília), Mumbai/Chennai (not Delhi for Tamil speakers),
   Casablanca (not Rabat), Barcelona (not Madrid for Catalan).

2. CITY 2 — COLLEGE TOWN: A city with major universities and a large student population.
   Students are the #1 contributor demographic — flexible schedule, need side income,
   tech-literate. Pick the top university city (if different from City 1).
   Examples: Coimbra (Portugal), Toulouse (France), Campinas (Brazil), Salamanca (Spain).

3. CITY 3 — SUBURBAN/SECONDARY METRO: A mid-size city or large suburb near City 1.
   This captures the parent/professional demographic — people with home offices,
   stable internet, quieter environments for audio recording.
   Examples: Guarulhos near São Paulo, Boulogne-Billancourt near Paris,
   Coimbatore near Chennai, L'Hospitalet near Barcelona.

Consider:
- Language match (for bilingual tasks, pick cities where BOTH languages are spoken)
- Internet infrastructure (reliable broadband required for audio tasks)
- Economic context (cities where side income is attractive)

Return ONLY a JSON array of 3 city objects:
[
  {"city": "City Name", "type": "metro", "reason": "Why (1 sentence)", "population_tier": "large"},
  {"city": "City Name", "type": "college", "reason": "Why (1 sentence)", "population_tier": "medium"},
  {"city": "City Name", "type": "suburban", "reason": "Why (1 sentence)", "population_tier": "medium"}
]
"""


async def should_split(request: dict) -> bool:
    """Check if an RFP should be split into per-country campaigns."""
    regions = request.get("target_regions", [])
    if len(regions) < SPLIT_THRESHOLD:
        return False

    # Count unique countries
    countries = set()
    for region in regions:
        country = REGION_TO_COUNTRY.get(region.lower(), region)
        countries.add(country)

    return len(countries) >= SPLIT_THRESHOLD


async def split_campaign(
    request: dict,
    request_id: str,
) -> list[dict]:
    """Split a multinational RFP into per-country child campaigns.

    Parameters
    ----------
    request : dict
        The parent intake request from Neon.
    request_id : str
        Parent request ID.

    Returns
    -------
    list[dict]
        List of child campaign dicts, each with:
        - child_request_id, country, cities, languages, regions, form_data
    """
    from neon_client import _get_pool

    # Idempotency: check if already split
    pool = await _get_pool()
    async with pool.acquire() as conn:
        current_status = await conn.fetchval(
            "SELECT status FROM intake_requests WHERE id = $1::uuid", request_id
        )
        if current_status == "split":
            logger.info("Campaign %s already split — skipping", request_id)
            existing = await conn.fetch(
                "SELECT id::text, title FROM intake_requests WHERE form_data->>'parent_request_id' = $1",
                request_id,
            )
            return [{"child_request_id": str(r["id"]), "title": r["title"], "country": ""} for r in existing]

    regions = request.get("target_regions", [])
    form_data = request.get("form_data", {})
    task_type = request.get("task_type", "data annotation")
    title = request.get("title", "Untitled Campaign")
    created_by = request.get("created_by", "system")
    all_language_pairs = form_data.get("language_pairs", [])

    # Group regions by country
    country_regions: dict[str, list[str]] = {}
    for region in regions:
        country = REGION_TO_COUNTRY.get(region.lower(), region)
        if country not in country_regions:
            country_regions[country] = []
        country_regions[country].append(region)

    logger.info(
        "Splitting campaign '%s' into %d country campaigns: %s",
        title, len(country_regions), list(country_regions.keys()),
    )

    children: list[dict] = []

    for country, country_region_list in country_regions.items():
        # Determine languages for this country
        country_langs = COUNTRY_LANGUAGE_MAP.get(country, ["English"])
        # Filter language pairs to those relevant to this country
        country_pairs = [
            pair for pair in all_language_pairs
            if any(lang.lower() in pair.lower() for lang in country_langs)
        ]

        # Get top cities via LLM
        cities = await _get_top_cities(country, task_type, form_data)

        # Build child form_data
        child_form = dict(form_data)
        child_form["target_regions"] = [country] + [c["city"] for c in cities]
        child_form["target_languages"] = country_langs
        child_form["language_pairs"] = country_pairs
        child_form["parent_request_id"] = request_id
        child_form["country"] = country
        child_form["cities"] = cities
        child_form["target_volume"] = max(
            50, form_data.get("target_volume", 500) // len(country_regions)
        )

        child_title = f"{title} — {country}"
        child_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())

        # Insert child request
        async with pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO intake_requests (
                    id, title, task_type, status, target_languages,
                    target_regions, form_data, created_by, created_at
                ) VALUES ($1::uuid, $2, $3, 'generating', $4, $5, $6::jsonb, $7, NOW())
            ''',
                child_id,
                child_title,
                task_type,
                country_langs,
                child_form["target_regions"],
                json.dumps(child_form),
                created_by,
            )

            # Create compute job for child
            await conn.execute('''
                INSERT INTO compute_jobs (id, request_id, job_type, status, created_at)
                VALUES ($1::uuid, $2::uuid, 'generate', 'pending', NOW())
            ''', job_id, child_id)

        child = {
            "child_request_id": child_id,
            "job_id": job_id,
            "country": country,
            "title": child_title,
            "cities": cities,
            "languages": country_langs,
            "language_pairs": country_pairs,
            "regions": child_form["target_regions"],
            "target_volume": child_form["target_volume"],
        }
        children.append(child)

        logger.info(
            "  Created child: %s (cities=%s, langs=%s, pairs=%s)",
            child_title,
            [c["city"] for c in cities],
            country_langs,
            country_pairs,
        )

    # Mark parent as split
    async with pool.acquire() as conn:
        await conn.execute('''
            UPDATE intake_requests SET status = 'split',
            form_data = jsonb_set(form_data, '{child_campaigns}', $1::jsonb)
            WHERE id = $2::uuid
        ''',
            json.dumps([{
                "child_request_id": c["child_request_id"],
                "country": c["country"],
                "title": c["title"],
            } for c in children]),
            request_id,
        )

    logger.info(
        "Campaign split complete: %d child campaigns created. "
        "Parent marked as 'split'. Worker will pick up children on next poll.",
        len(children),
    )

    return children


async def _get_top_cities(
    country: str,
    task_type: str,
    form_data: dict,
) -> list[dict]:
    """Use LLM to identify top 2-3 recruitment cities in a country."""
    from ai.local_llm import generate_text

    prompt = (
        f"Country: {country}\n"
        f"Task type: {task_type}\n"
        f"Task description: {form_data.get('description', 'data annotation')}\n"
        f"Requirements: {json.dumps(form_data.get('requirements', {}), default=str)[:300]}\n"
        f"Target volume: {form_data.get('target_volume', 100)} contributors\n\n"
        f"Identify the TOP 2-3 cities in {country} to run recruitment ads for this task."
    )

    try:
        raw = await generate_text(
            CITY_SELECTION_SYSTEM,
            prompt,
            max_tokens=1024,
            temperature=0.3,
        )

        # Parse JSON
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()

        cities = json.loads(cleaned)
        if isinstance(cities, list):
            logger.info("Cities for %s: %s", country, [c.get("city") for c in cities])
            return cities[:3]

    except Exception as e:
        logger.warning("City selection failed for %s: %s — using capital", country, e)

    # Fallback: use known capitals
    FALLBACK_CITIES: dict[str, list[dict]] = {
        "Morocco": [{"city": "Casablanca", "reason": "Largest city, tech hub", "population_tier": "large"}],
        "France": [{"city": "Paris", "reason": "Capital, largest talent pool", "population_tier": "large"}],
        "Brazil": [{"city": "São Paulo", "reason": "Largest city, tech center", "population_tier": "large"}],
        "Spain": [{"city": "Barcelona", "reason": "Capital of Catalonia, bilingual hub", "population_tier": "large"}],
        "India": [{"city": "Chennai", "reason": "Capital of Tamil Nadu", "population_tier": "large"}],
        "Germany": [{"city": "Berlin", "reason": "Capital, diverse talent", "population_tier": "large"}],
        "Italy": [{"city": "Milan", "reason": "Business capital", "population_tier": "large"}],
        "United States": [{"city": "Seattle", "reason": "Tech hub", "population_tier": "large"}],
    }
    return FALLBACK_CITIES.get(country, [{"city": country, "reason": "Primary market", "population_tier": "large"}])
