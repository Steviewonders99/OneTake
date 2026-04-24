# GPT Image 2 + Stage 2 Parallelization — Design Spec

> Feature: Switch image generation from Seedream to GPT-5.4-mini-image-2 via OpenRouter. Add configurable quality mode and two-wave parallelization for 5-6x speed improvement.
> Date: 2026-04-24
> Status: Approved

---

## Problem

Stage 2 currently uses Seedream 4.5 via OpenRouter at $0.04/image with hardcoded concurrency of 9 and sequential per-actor processing. GPT Image 2.0 dropped with superior quality (99% text accuracy, built-in reasoning, 242-point Arena lead) at comparable or lower cost. Processing is also sequential per actor (seed → variations → next actor), leaving significant parallelization on the table.

## Solution

1. Swap `IMAGE_MODEL` default to `openai/gpt-5.4-mini-image-2`
2. Add configurable `IMAGE_QUALITY` (low/medium/high) — start at low ($0.006/image)
3. Make `IMAGE_CONCURRENCY` configurable via env var (default 15, up from hardcoded 9)
4. Restructure Stage 2 into two-wave parallel processing: all seeds first, then all variations

---

## Changes

### 1. config.py — New settings

```python
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "openai/gpt-5.4-mini-image-2")
IMAGE_QUALITY = os.environ.get("IMAGE_QUALITY", "low")  # low, medium, high
IMAGE_CONCURRENCY = int(os.environ.get("IMAGE_CONCURRENCY", "15"))
```

### 2. seedream.py — Quality parameter + response format handling

The `generate_image()` function already calls OpenRouter with `IMAGE_MODEL`. Changes:

- Import `IMAGE_QUALITY` from config
- Add `quality` parameter to the request payload
- Handle GPT Image 2 response format (may differ from Seedream — URL vs base64 vs data URI)
- The function signature stays the same: `async def generate_image(prompt, dimension_key, negative_prompt) -> bytes`

GPT Image 2 via OpenRouter chat completions:
```json
{
  "model": "openai/gpt-5.4-mini-image-2",
  "messages": [{"role": "user", "content": [{"type": "text", "text": "prompt"}]}],
  "quality": "low"
}
```

Response handling: Extract image from `choices[0].message.content` — may be base64, data URI, or URL. The existing Seedream code already handles all three formats via `_extract_image_bytes()`.

### 3. stage2_images.py — Two-wave parallelization

**Current flow (sequential per actor):**
```
for each actor:
    generate_seed(actor) → wait
    generate_variations(actor) → wait
```

**New flow (two-wave parallel):**
```
# Wave 1: All hero seeds in parallel
seeds = await asyncio.gather(*[
    _generate_validated_image(actor, is_seed=True, ...)
    for actor in actors
])

# Update actor profiles with seed URLs

# Wave 2: All variations in parallel (semaphore-controlled)
variations = await asyncio.gather(*[
    _generate_validated_image(actor, outfit, is_seed=False, ...)
    for actor in actors
    for outfit in actor.outfits
])
```

- Import `IMAGE_CONCURRENCY` from config instead of hardcoded `9`
- `asyncio.Semaphore(IMAGE_CONCURRENCY)` controls max concurrent API calls
- Seeds have no dependency on each other → full parallel
- Variations depend on seed URL (for reference) → run after seeds complete

### Speed comparison

```
Current (sequential, 3 actors, 4 images each):
  102s total (34s per actor)

New (two-wave, 3 actors, 4 images each):
  Wave 1: 3 seeds in parallel → ~10s
  Wave 2: 9 variations in parallel → ~8s
  Total: ~18s (5.7x faster)

16-country campaign (16 actors, 2 images each):
  Current: ~544s (9 min)
  New: ~18s (same — semaphore handles 15 concurrent)
```

---

## Cost Analysis

| Quality | Per Image | 3 actors x 4 | 16-country (16 x 2) | Monthly (50 campaigns) |
|---|---|---|---|---|
| Low | $0.006 | $0.07 | $0.19 | **$9.60** |
| Medium | $0.053 | $0.64 | $1.70 | **$84.80** |
| High | $0.211 | $2.53 | $6.74 | **$336.80** |
| Seedream (current) | $0.04 | $0.48 | $1.28 | **$64.00** |

**Low quality is 6.7x cheaper than Seedream.** The VQA gate + deglosser + Flux edit retry pipeline ensures quality stays high regardless of initial generation quality.

---

## Files to Modify

| File | Change |
|---|---|
| `worker/config.py` | Add `IMAGE_QUALITY`, make `IMAGE_CONCURRENCY` configurable, change `IMAGE_MODEL` default |
| `worker/ai/seedream.py` | Add quality parameter to request, verify GPT Image 2 response format handling |
| `worker/pipeline/stage2_images.py` | Two-wave parallel processing, read `IMAGE_CONCURRENCY` from config |

---

## Fallback

If GPT-5.4-mini quality is insufficient at low:
1. Bump to `IMAGE_QUALITY=medium` ($0.053) 
2. If still insufficient, switch back to Seedream: `IMAGE_MODEL=bytedance-seed/seedream-4.5`
3. All via env var — zero code changes needed to switch

## Testing

- Run a test campaign with `IMAGE_QUALITY=low` and compare VQA pass rates to Seedream
- If pass rate drops below 70% at low, test medium
- Monitor cost per campaign via OpenRouter dashboard

---

## Out of Scope

- Provider abstraction (ImageProvider base class) — YAGNI for now
- Midjourney/Ideogram integration
- Image caching across campaigns
- Seed image reuse across countries (same persona, different country)
