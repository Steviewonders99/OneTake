# Web-Grounded Cultural Research Engine

**Date:** 2026-05-20
**Status:** Spec
**Branch:** TBD

## Problem

Cultural research currently asks Kimi K2.6 to generate cultural intelligence from training data. The docstring says "web-grounded" but no actual web calls are made. This means:

1. **Data staleness** — Kimi's training data has a cutoff. Economic rates, platform usage, and cultural sentiment shift constantly.
2. **Hallucination risk** — LLM can confidently fabricate statistics (unemployment rates, wage data, platform rankings) with no grounding.
3. **No citations** — impossible to verify claims or show sources in the brief.

Meanwhile, we have 12 research dimensions per locale, each needing current, region-specific data. For a 7-locale campaign like Motto, that's 84 research queries — all running on stale LLM knowledge.

## Solution

Add a **web search pre-fetch step** before each LLM research call. For each dimension × locale:

1. **Generate 2-3 targeted search queries** from the dimension template
2. **Execute web searches** in parallel (via OpenRouter or dedicated search API)
3. **Fetch top 3-5 result snippets** per query
4. **Inject search results as context** into the LLM prompt
5. **LLM synthesizes** real web data into structured research output (with source URLs)

The LLM becomes a **research analyst** reading real sources, not a **research fabricator** inventing from memory.

## Architecture

### Current Flow (LLM-only)
```
dimension_query → Kimi K2.6 (training data) → structured JSON
```

### New Flow (Web-Grounded)
```
dimension_query → generate_search_queries(dimension, region)
                → parallel web_search(query) × 2-3
                → collect snippets + URLs
                → inject into LLM prompt as SOURCES block
                → Kimi K2.6 (synthesize from real data) → structured JSON + citations
```

### Search Query Generation

Each dimension template already contains rich context. Convert to search queries by extracting the core questions:

```python
SEARCH_QUERY_MAP = {
    "ai_fatigue": [
        "{region} AI job sentiment {year}",
        "{region} gig workers AI skepticism survey",
    ],
    "economic_context": [
        "{region} minimum wage {year}",
        "{region} freelance hourly rate data annotation",
        "{region} gig economy average earnings",
    ],
    "platform_reality": [
        "{region} social media usage statistics {year}",
        "{region} most popular apps {demographic}",
        "{region} job platforms remote work",
    ],
    "cultural_sensitivities": [
        "{region} advertising cultural taboos",
        "{region} recruitment marketing guidelines",
    ],
    "tech_literacy": [
        "{region} smartphone penetration rate {year}",
        "{region} internet speed mobile data cost",
    ],
    "language_nuance": [
        "{region} {language} dialect advertising",
        "{region} formal informal language marketing",
    ],
    # ... etc for all 12 dimensions
}
```

### Web Search Provider Options

**Option A: OpenRouter + Kimi K2.6 web search mode**
- Kimi has native web search via `web_search` tool
- Enable via `tools: [{type: "web_search"}]` in the API call
- Simplest — no separate search API needed
- Kimi searches, reads, and synthesizes in one call

**Option B: Dedicated search API (recommended for control)**
- Use `mcp__seo-ai__web_search` for search queries
- Use `mcp__seo-ai__web_fetch` for page content
- Feed results into LLM prompt as structured context
- Full control over what sources the LLM sees
- Can cache search results across dimensions (same locale = similar queries)

**Option C: Hybrid**
- Use dedicated search API for high-stakes dimensions (economic_context, platform_reality)
- Use Kimi's native search for opinion-based dimensions (ai_fatigue, cultural_sensitivities)

**Recommendation: Option A first** — it's the fastest to implement and Kimi K2.6's built-in search is already designed for this. If quality isn't sufficient, upgrade to Option B.

### Implementation: Option A (Kimi Web Search)

The change is minimal — add `tools` to the API payload in `_call_kimi()`:

```python
payload = {
    "model": "moonshotai/kimi-k2.6",
    "messages": messages,
    "temperature": 0.3,
    "stream": False,
    "tools": [{"type": "web_search"}],  # Enable Kimi's built-in web search
}
```

When `web_search` is enabled, Kimi will:
1. Analyze the query
2. Generate and execute search queries internally
3. Read relevant web pages
4. Synthesize findings with citations
5. Return structured response with source URLs

### Output Format Update

Add `sources` to each dimension's output:

```python
# Current output per dimension:
{
    "fatigue_level": "moderate",
    "sentiment": "cautious but growing",
    "recommended_framing": "...",
    "tier_specific_notes": "..."
}

# New output with sources:
{
    "fatigue_level": "moderate",
    "sentiment": "cautious but growing",
    "recommended_framing": "...",
    "tier_specific_notes": "...",
    "sources": [
        {"title": "...", "url": "https://...", "snippet": "..."},
        {"title": "...", "url": "https://...", "snippet": "..."}
    ]
}
```

Add `"sources"` to each dimension's `output_keys` list.

### Parallelization (Already Committed)

`research_all_regions()` already parallelized via `asyncio.gather` (commit `331b70a`). All 7 locales run concurrently. Within each locale, the 10-12 dimensions run sequentially (they share rate limits). This gives us:

- **Before:** 7 locales × 12 dimensions × ~5s = ~7 minutes sequential
- **After parallel regions:** 12 dimensions × ~5s = ~1 minute (all locales concurrent)
- **With web search:** 12 dimensions × ~10s (search adds latency) = ~2 minutes

### Rate Limit Strategy

Web-search-enabled Kimi calls are heavier (LLM + search). Expect:
- NIM free tier: ~5-10 calls/minute (will hit 429 faster)
- OpenRouter paid: 30+ calls/minute (no practical limit)

Strategy:
1. Try NIM first (free)
2. On 429, immediately fall back to OpenRouter (paid, unlimited)
3. All 7 locales running in parallel means ~70-84 total calls
4. With NIM + OpenRouter combined: ~3-5 minutes total

### Caching

Search results for the same region are similar across dimensions. Add a per-region search cache:

```python
_search_cache: dict[str, list[dict]] = {}  # region → cached search results

async def _get_cached_search(region: str, query: str) -> list[dict]:
    cache_key = f"{region}:{query}"
    if cache_key in _search_cache:
        return _search_cache[cache_key]
    results = await _web_search(query)
    _search_cache[cache_key] = results
    return results
```

This prevents redundant searches — "India gig work 2026" searched once, reused across ai_fatigue, gig_work_perception, and economic_context.

## Files Changed

| Action | File | Change |
|--------|------|--------|
| Modify | `worker/prompts/cultural_research.py` | Add `tools: [{type: "web_search"}]` to Kimi payload, add `sources` to output_keys |
| Modify | `worker/prompts/cultural_research.py` | Update `_RESEARCH_SYSTEM_PROMPT` to instruct citing sources |

## System Prompt Update

```python
_RESEARCH_SYSTEM_PROMPT = """You are a cultural research analyst for recruitment marketing campaigns.

You have access to web search. USE IT for every query. Do not rely on training data alone.

For each research dimension:
1. Search the web for current, region-specific data
2. Cite your sources (include URLs)
3. Distinguish between verified data (from web) and your analysis
4. Flag any data points you couldn't verify online

Return structured JSON with the requested keys. Include a "sources" array with
{"title": "...", "url": "...", "snippet": "..."} for each web source you used.

Be specific to the region and demographic. Generic global answers are useless."""
```

## Success Criteria

1. Cultural research returns `sources` array with real URLs
2. Economic data (wages, unemployment) matches recent web sources
3. Platform usage data reflects 2026 reality, not 2024 training data
4. Total research time for 7 locales < 5 minutes (parallel + web search)
5. No increase in parse errors (JSON output format unchanged except `sources` addition)

## Implementation Estimate

**Option A (Kimi web search tool):** ~30 min
- Add `tools` to payload: 2 lines
- Update system prompt: 1 block
- Add `sources` to output_keys: 12 additions
- Test with one locale

**Option B (dedicated search API):** ~2 hours
- Build search query generator per dimension
- Wire up search API client
- Build snippet injection into prompts
- Add caching layer
- Test with one locale
