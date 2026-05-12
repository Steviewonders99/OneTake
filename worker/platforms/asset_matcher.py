"""Asset matcher — 3-tier post attribution linking organic posts to intake requests.

Pure functions are in the top section (testable without DB).
The async match_posts(db) function does the DB work.

Attribution tiers (highest confidence first):
  1. UTM match  (confidence 1.0) — tracked_links slug found in post text
  2. URL match  (confidence 0.9) — landing_page_url found in post text
  3. Text similarity (confidence 0.5-0.8) — post text vs copy variants
  4. No match   — inserted as source='manual'
"""
from __future__ import annotations

import difflib
import logging
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pure helpers (testable without DB or network)
# ---------------------------------------------------------------------------

_TRACKED_SLUG_RE = re.compile(r"go\.oneforma\.com/r/([a-zA-Z0-9_-]+)")
_URL_RE = re.compile(r"https?://[^\s<>\"']+")

_TEXT_SIM_LOW  = 0.5
_TEXT_SIM_HIGH = 0.8
_TEXT_SIM_THRESHOLD = 0.7


def _extract_tracked_slug(text: str) -> str | None:
    """Return the slug from a go.oneforma.com/r/<slug> URL, or None.

    Args:
        text: arbitrary string that may contain a tracked link

    Returns:
        The slug string if found, else None.
    """
    if not text:
        return None
    m = _TRACKED_SLUG_RE.search(text)
    return m.group(1) if m else None


def _extract_urls(text: str) -> list[str]:
    """Return all http/https URLs found in text.

    Args:
        text: arbitrary string

    Returns:
        List of URL strings (may be empty).
    """
    if not text:
        return []
    return _URL_RE.findall(text)


def _text_similarity(a: str, b: str) -> float:
    """Return SequenceMatcher ratio between two strings.

    Returns 0.0 for None or empty strings on either side.

    Args:
        a: first string
        b: second string

    Returns:
        Float in [0.0, 1.0].
    """
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


# ---------------------------------------------------------------------------
# Platforms to match
# ---------------------------------------------------------------------------

_PLATFORM_TABLES: list[tuple[str, str]] = [
    ("facebook",  "meta_organic_cache"),
    ("instagram", "meta_organic_cache"),
    ("linkedin",  "linkedin_organic_cache"),
    ("reddit",    "reddit_organic_cache"),
]


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------

async def match_posts(db) -> dict:
    """Attempt 3-tier attribution for every unmatched post across all platform
    caches and upsert results into organic_post_assets.

    Args:
        db: asyncpg connection pool

    Returns:
        dict with keys: matched_utm, matched_url, matched_text, unmatched, errors
    """
    stats: dict[str, int] = {
        "matched_utm": 0,
        "matched_url": 0,
        "matched_text": 0,
        "unmatched": 0,
        "errors": 0,
    }

    async with db.acquire() as conn:
        # Pre-load lookup tables once to avoid repeated queries per post
        tracked_links = await _load_tracked_links(conn)
        landing_pages = await _load_landing_pages(conn)
        copy_variants = await _load_copy_variants(conn)

        for platform, table in _PLATFORM_TABLES:
            try:
                unmatched_posts = await _fetch_unmatched_posts(conn, platform, table)
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("asset_matcher: fetch unmatched (%s) failed: %s", platform, exc)
                stats["errors"] += 1
                continue

            for post in unmatched_posts:
                post_id: str = str(post["post_id"])
                post_text: str = post.get("post_text") or ""

                try:
                    match = (
                        _try_utm_match(post_text, tracked_links)
                        or _try_url_match(post_text, landing_pages)
                        or _try_text_match(post_text, copy_variants)
                    )

                    if match:
                        intake_request_id, asset_id, confidence, source = match
                        tier = (
                            "matched_utm"  if source == "utm"  else
                            "matched_url"  if source == "url"  else
                            "matched_text"
                        )
                        stats[tier] += 1
                    else:
                        intake_request_id, asset_id, confidence, source = None, None, None, "manual"
                        stats["unmatched"] += 1

                    await _upsert_match(
                        conn,
                        platform=platform,
                        post_id=post_id,
                        intake_request_id=intake_request_id,
                        asset_id=asset_id,
                        confidence=confidence,
                        source=source,
                    )

                except Exception as exc:  # pylint: disable=broad-except
                    logger.warning(
                        "asset_matcher: post %s/%s match error: %s", platform, post_id, exc
                    )
                    stats["errors"] += 1

    logger.info("asset_matcher: %s", stats)
    return stats


# ---------------------------------------------------------------------------
# Tier matching helpers (pure logic, testable)
# ---------------------------------------------------------------------------

def _try_utm_match(
    post_text: str,
    tracked_links: list[dict],
) -> tuple[str | None, str | None, float, str] | None:
    """Tier 1: look for a tracked slug in post_text, confidence = 1.0."""
    slug = _extract_tracked_slug(post_text)
    if not slug:
        return None
    for tl in tracked_links:
        if tl.get("slug") == slug:
            return tl.get("intake_request_id"), tl.get("asset_id"), 1.0, "utm"
    return None


def _try_url_match(
    post_text: str,
    landing_pages: list[dict],
) -> tuple[str | None, str | None, float, str] | None:
    """Tier 2: look for a landing_page_url in post_text URLs, confidence = 0.9."""
    urls_in_post = set(_extract_urls(post_text))
    if not urls_in_post:
        return None
    for lp in landing_pages:
        lp_url: str = lp.get("landing_page_url") or ""
        if lp_url and any(lp_url in u or u in lp_url for u in urls_in_post):
            return lp.get("id"), None, 0.9, "url"
    return None


def _try_text_match(
    post_text: str,
    copy_variants: list[dict],
) -> tuple[str | None, str | None, float, str] | None:
    """Tier 3: text similarity vs copy variants, threshold 0.7, confidence 0.5-0.8."""
    if not post_text:
        return None
    best_score = 0.0
    best = None
    for cv in copy_variants:
        variant_text: str = cv.get("copy_text") or ""
        if not variant_text:
            continue
        score = _text_similarity(post_text, variant_text)
        if score > best_score:
            best_score = score
            best = cv
    if best_score >= _TEXT_SIM_THRESHOLD and best:
        # Map 0.7-1.0 similarity into 0.5-0.8 confidence range
        confidence = _TEXT_SIM_LOW + (best_score - _TEXT_SIM_THRESHOLD) * (
            (_TEXT_SIM_HIGH - _TEXT_SIM_LOW) / (1.0 - _TEXT_SIM_THRESHOLD)
        )
        confidence = min(_TEXT_SIM_HIGH, round(confidence, 4))
        return best.get("intake_request_id"), best.get("asset_id"), confidence, "text"
    return None


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _fetch_unmatched_posts(conn, platform: str, table: str) -> list:
    """Fetch posts that have no entry in organic_post_assets yet."""
    sql = f"""
        SELECT c.post_id, c.post_text
        FROM {table} c
        LEFT JOIN organic_post_assets opa
               ON opa.platform = c.platform
              AND opa.post_id   = c.post_id
        WHERE c.platform = $1
          AND opa.post_id IS NULL
    """
    return await conn.fetch(sql, platform)


async def _load_tracked_links(conn) -> list[dict]:
    """Load all tracked links (slug -> intake_request_id + asset_id)."""
    rows = await conn.fetch(
        "SELECT slug, intake_request_id, asset_id FROM tracked_links"
    )
    return [dict(r) for r in rows]


async def _load_landing_pages(conn) -> list[dict]:
    """Load intake_requests with a landing_page_url for URL-tier matching."""
    rows = await conn.fetch(
        "SELECT id, form_data->>'landing_page_url' AS landing_page_url FROM intake_requests"
        " WHERE form_data->>'landing_page_url' IS NOT NULL"
    )
    return [dict(r) for r in rows]


async def _load_copy_variants(conn) -> list[dict]:
    """Load generated copy variants with their parent intake_request_id and asset_id."""
    rows = await conn.fetch(
        """
        SELECT ga.id AS asset_id, ga.intake_request_id,
               jsonb_array_elements_text(ga.content->'variants') AS copy_text
        FROM generated_assets ga
        WHERE ga.asset_type = 'copy'
          AND ga.content->'variants' IS NOT NULL
        """
    )
    return [dict(r) for r in rows]


async def _upsert_match(
    conn,
    *,
    platform: str,
    post_id: str,
    intake_request_id: str | None,
    asset_id: str | None,
    confidence: float | None,
    source: str,
) -> None:
    """Upsert attribution result into organic_post_assets."""
    sql = """
        INSERT INTO organic_post_assets (
            platform, post_id,
            intake_request_id, asset_id,
            match_confidence, match_source,
            matched_at
        ) VALUES (
            $1, $2,
            $3, $4,
            $5, $6,
            NOW()
        )
        ON CONFLICT (platform, post_id) DO UPDATE SET
            intake_request_id = EXCLUDED.intake_request_id,
            asset_id          = EXCLUDED.asset_id,
            match_confidence  = EXCLUDED.match_confidence,
            match_source      = EXCLUDED.match_source,
            matched_at        = NOW()
    """
    await conn.execute(
        sql,
        platform,
        post_id,
        intake_request_id,
        asset_id,
        confidence,
        source,
    )
