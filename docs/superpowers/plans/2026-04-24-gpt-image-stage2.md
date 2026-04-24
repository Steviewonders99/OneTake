# GPT Image 2 + Stage 2 Parallelization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch Stage 2 image generation from Seedream to GPT-5.4-mini-image-2 via OpenRouter with configurable quality and increased parallelism.

**Architecture:** Change `IMAGE_MODEL` default in config.py, add `IMAGE_QUALITY` and configurable `IMAGE_CONCURRENCY`. Update seedream.py to pass quality parameter. Stage 2 already runs all actors in parallel via `asyncio.gather` + semaphore — just bump the concurrency limit.

**Tech Stack:** Python 3, httpx, asyncio, OpenRouter API

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `worker/config.py` | Modify | Add IMAGE_QUALITY, make IMAGE_CONCURRENCY configurable, update IMAGE_MODEL default |
| `worker/ai/seedream.py` | Modify | Add quality parameter to OpenRouter request |
| `worker/pipeline/stage2_images.py` | Modify | Read IMAGE_CONCURRENCY from config instead of hardcoded 9 |

---

### Task 1: Update config.py with new settings

**Files:**
- Modify: `worker/config.py`

- [ ] **Step 1: Find the IMAGE_MODEL line and update**

Find:
```python
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "bytedance-seed/seedream-4.5")
```

Replace with:
```python
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "openai/gpt-5.4-mini-image-2")
IMAGE_QUALITY = os.environ.get("IMAGE_QUALITY", "low")  # low, medium, high
IMAGE_CONCURRENCY = int(os.environ.get("IMAGE_CONCURRENCY", "15"))
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "from config import IMAGE_MODEL, IMAGE_QUALITY, IMAGE_CONCURRENCY; print(f'{IMAGE_MODEL} | {IMAGE_QUALITY} | {IMAGE_CONCURRENCY}')"`

Expected: `openai/gpt-5.4-mini-image-2 | low | 15`

- [ ] **Step 3: Commit**

```bash
git add worker/config.py
git commit -m "feat: switch IMAGE_MODEL to GPT-5.4-mini, add IMAGE_QUALITY + IMAGE_CONCURRENCY config"
```

---

### Task 2: Update seedream.py to pass quality parameter

**Files:**
- Modify: `worker/ai/seedream.py`

- [ ] **Step 1: Update the import line**

Find line 15:
```python
from config import IMAGE_MODEL, OPENROUTER_API_KEY
```

Replace with:
```python
from config import IMAGE_MODEL, IMAGE_QUALITY, OPENROUTER_API_KEY
```

- [ ] **Step 2: Update the docstring**

Replace the module docstring (lines 1-7):
```python
"""Image generation via OpenRouter.

Supports Seedream 4.5, GPT Image 2, and other OpenRouter image models.
Uses the /api/v1/chat/completions endpoint.
Provider is selected via IMAGE_MODEL env var.
Quality (low/medium/high) controlled via IMAGE_QUALITY env var.
"""
```

- [ ] **Step 3: Add quality to the request JSON**

Find the request JSON block (lines 109-114):
```python
                    json={
                        "model": IMAGE_MODEL,
                        "messages": [
                            {"role": "user", "content": full_prompt},
                        ],
                    },
```

Replace with:
```python
                    json={
                        "model": IMAGE_MODEL,
                        "messages": [
                            {"role": "user", "content": full_prompt},
                        ],
                        **({"quality": IMAGE_QUALITY} if "gpt" in IMAGE_MODEL or "openai" in IMAGE_MODEL else {}),
                    },
```

The `**` conditional spread only adds `quality` for GPT/OpenAI models. Seedream doesn't support the quality parameter, so we skip it for non-GPT models.

- [ ] **Step 4: Update the log line**

Find line 88-91:
```python
    logger.info(
        "Generating image via %s (%dx%d, prompt=%d chars)...",
        IMAGE_MODEL, width, height, len(full_prompt),
    )
```

Replace with:
```python
    quality_label = IMAGE_QUALITY if ("gpt" in IMAGE_MODEL or "openai" in IMAGE_MODEL) else "default"
    logger.info(
        "Generating image via %s (%dx%d, quality=%s, prompt=%d chars)...",
        IMAGE_MODEL, width, height, quality_label, len(full_prompt),
    )
```

- [ ] **Step 5: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import ai.seedream; print('OK')"`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add worker/ai/seedream.py
git commit -m "feat: add quality parameter to image generation for GPT Image 2 support"
```

---

### Task 3: Update stage2_images.py — configurable concurrency

**Files:**
- Modify: `worker/pipeline/stage2_images.py:265`

- [ ] **Step 1: Replace hardcoded concurrency**

Find line 265:
```python
    IMAGE_CONCURRENCY = 9  # Seedream is paid API — no rate limit, max parallelism
```

Replace with:
```python
    from config import IMAGE_CONCURRENCY  # Default: 15 (configurable via env)
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage2_images; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage2_images.py
git commit -m "feat: read IMAGE_CONCURRENCY from config (default 15, was hardcoded 9)"
```

---

### Task 4: Run ruff lint and verify all tests pass

- [ ] **Step 1: Run ruff**

Run: `cd /Users/stevenjunop/centric-intake && python3 -m ruff check worker/ --config worker/ruff.toml --fix`

Expected: `All checks passed!` (or fixes applied)

- [ ] **Step 2: Run Python tests**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -m pytest tests/ -v --tb=short 2>&1 | tail -5`

Expected: `201 passed`

- [ ] **Step 3: Run TypeScript tests**

Run: `cd /Users/stevenjunop/centric-intake && pnpm test -- --run 2>&1 | tail -5`

Expected: `413 passed`

- [ ] **Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: ruff lint for GPT Image 2 changes"
```

---

### Task 5: Test image generation with GPT-5.4-mini

- [ ] **Step 1: Test generate_image directly**

```python
cd /Users/stevenjunop/centric-intake/worker
python3 -c "
import asyncio
async def test():
    from ai.seedream import generate_image
    img = await generate_image(
        'A 28-year-old Moroccan woman wearing a hijab, sitting at a modern co-working space desk with a laptop, natural lighting, shot on Canon R5, 85mm f/1.4, shallow DOF',
        dimension_key='square'
    )
    with open('/tmp/gpt_image_test.png', 'wb') as f:
        f.write(img)
    print(f'Success: {len(img)} bytes saved to /tmp/gpt_image_test.png')
asyncio.run(test())
"
```

- [ ] **Step 2: Open and verify the image**

Run: `open /tmp/gpt_image_test.png`

Verify: Image is a realistic photo, not cartoon/illustration. Check for text artifacts, face quality, overall composition.

- [ ] **Step 3: Test with different quality levels**

```python
# Test medium quality
IMAGE_QUALITY=medium python3 -c "
import asyncio, os
os.environ['IMAGE_QUALITY'] = 'medium'
async def test():
    import importlib
    import config
    importlib.reload(config)
    from ai.seedream import generate_image
    img = await generate_image('A 25-year-old Brazilian man in a casual home office', dimension_key='square')
    with open('/tmp/gpt_image_medium.png', 'wb') as f:
        f.write(img)
    print(f'Medium: {len(img)} bytes')
asyncio.run(test())
"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```
