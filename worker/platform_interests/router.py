"""Interest router — maps LLM-generated concepts to real platform interests.

Queries the interest_nodes knowledge graph to find real, validated platform
interests that match conceptual targeting. Returns structured interests_by_tier.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_TIER_COUNTS = {"hyper": 3, "hot": 5, "broad": 3}


async def route_interests(
    platform: str,
    concepts: list[str],
    tier_counts: dict[str, int] | None = None,
) -> dict[str, list[str]]:
    """Map conceptual interests to real platform interests from the graph.

    Parameters
    ----------
    platform : str
        Target ad platform ('meta', 'linkedin', 'tiktok', 'reddit', 'snapchat', 'wechat').
    concepts : list[str]
        LLM-generated conceptual interest keywords.
    tier_counts : dict
        How many interests per tier. Defaults to {"hyper": 3, "hot": 5, "broad": 3}.

    Returns
    -------
    dict with keys 'hyper', 'hot', 'broad' — each a list of real platform interest strings.
    """
    from neon_client import _get_pool

    counts = tier_counts or DEFAULT_TIER_COUNTS
    total_needed = sum(counts.values())

    if not concepts:
        logger.warning("No concepts provided for %s — returning empty interests", platform)
        return {"hyper": [], "hot": [], "broad": []}

    # Build keyword search terms from concepts
    search_terms = []
    for concept in concepts:
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        search_terms.extend(words)
    search_terms = list(set(search_terms))

    if not search_terms:
        return {"hyper": [], "hot": [], "broad": []}

    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Query 1: Find interests matching by keyword overlap
        rows = await conn.fetch(
            """
            SELECT interest, category, subcategory, tier,
                   (SELECT COUNT(*) FROM unnest(keywords) kw
                    WHERE kw = ANY($2::text[])) AS match_score
            FROM interest_nodes
            WHERE platform = $1
              AND is_active = TRUE
              AND keywords && $2::text[]
            ORDER BY match_score DESC, tier ASC
            LIMIT $3
            """,
            platform,
            search_terms,
            total_needed * 2,
        )

        # Query 2: If not enough matches, broaden to interest name matching
        if len(rows) < total_needed:
            like_patterns = [f"%{term}%" for term in search_terms[:10]]
            broadened = await conn.fetch(
                """
                SELECT interest, category, subcategory, tier, 0 AS match_score
                FROM interest_nodes
                WHERE platform = $1
                  AND is_active = TRUE
                  AND (
                    LOWER(interest) LIKE ANY($2::text[])
                    OR LOWER(category) LIKE ANY($2::text[])
                  )
                ORDER BY tier ASC
                LIMIT $3
                """,
                platform,
                like_patterns,
                total_needed - len(rows),
            )
            rows = list(rows) + list(broadened)

    # Distribute across tiers
    hyper: list[str] = []
    hot: list[str] = []
    broad: list[str] = []
    seen: set[str] = set()

    for row in rows:
        name = row["interest"]
        if name in seen:
            continue
        seen.add(name)

        tier = row["tier"]
        if tier == "niche" and len(hyper) < counts["hyper"]:
            hyper.append(name)
        elif tier == "standard" and len(hot) < counts["hot"]:
            hot.append(name)
        elif tier == "broad" and len(broad) < counts["broad"]:
            broad.append(name)
        elif len(hot) < counts["hot"]:
            hot.append(name)
        elif len(broad) < counts["broad"]:
            broad.append(name)

    logger.info(
        "Routed %d concepts to %s: hyper=%d, hot=%d, broad=%d",
        len(concepts), platform, len(hyper), len(hot), len(broad),
    )

    return {"hyper": hyper, "hot": hot, "broad": broad}


async def route_interests_cross_platform(
    platforms: list[str],
    concepts: list[str],
    tier_counts: dict[str, int] | None = None,
) -> dict[str, dict[str, list[str]]]:
    """Route interests across multiple platforms with cross-platform awareness.

    Returns dict keyed by platform, each containing interests_by_tier.
    Uses equivalent_on edges to ensure consistent targeting.
    """
    results: dict[str, dict[str, list[str]]] = {}

    if platforms:
        results[platforms[0]] = await route_interests(platforms[0], concepts, tier_counts)

    for platform in platforms[1:]:
        direct = await route_interests(platform, concepts, tier_counts)

        from neon_client import _get_pool
        pool = await _get_pool()
        enriched_concepts = list(concepts)

        for prev_platform, prev_interests in results.items():
            all_prev = prev_interests["hyper"] + prev_interests["hot"] + prev_interests["broad"]
            if all_prev:
                async with pool.acquire() as conn:
                    equiv_rows = await conn.fetch(
                        """
                        SELECT n2.interest
                        FROM interest_nodes n1
                        JOIN interest_edges e ON e.source_id = n1.id AND e.edge_type = 'equivalent_on'
                        JOIN interest_nodes n2 ON n2.id = e.target_id AND n2.platform = $1
                        WHERE n1.platform = $2 AND n1.interest = ANY($3::text[])
                        """,
                        platform, prev_platform, all_prev,
                    )
                    for row in equiv_rows:
                        if row["interest"] not in enriched_concepts:
                            enriched_concepts.append(row["interest"])

        if len(enriched_concepts) > len(concepts):
            direct = await route_interests(platform, enriched_concepts, tier_counts)

        results[platform] = direct

    return results
