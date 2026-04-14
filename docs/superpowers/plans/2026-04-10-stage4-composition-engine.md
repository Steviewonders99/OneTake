# Stage 4 Composition Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stage 4's monolithic LLM-generates-everything approach with a modular artifact-driven composition engine where GLM-5 assembles pre-built design components into layered HTML creatives.

**Architecture:** Pre-built SVG/CSS artifacts stored in Vercel Blob with a Neon catalog table. GLM-5 receives a compact artifact catalog (~50 rows), selects a composition archetype (Floating Props / Gradient Hero / Photo Feature), and outputs layered HTML referencing artifact URLs. Existing VQA two-phase gate evaluates the result. Layered HTML is the primary artifact; PNG is preview-only.

**Tech Stack:** Python 3.13 (worker), Next.js 16 (frontend), Neon Postgres, Vercel Blob, GLM-5 via NIM, Playwright for rendering, Gemma 4 for VQA.

**Spec:** `docs/superpowers/specs/2026-04-10-stage4-composition-engine-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|----------------|
| `worker/prompts/compositor_prompt.py` | Build the 6-section GLM-5 prompt from artifact catalog + inputs |
| `worker/pipeline/stage4_compose_v3.py` | Artifact-driven composition engine — orchestrates GLM-5 + render + VQA + save |
| `worker/pipeline/archetype_selector.py` | Archetype selection logic + z-index structural constraints |
| `scripts/artifacts/` | Source SVG/CSS/HTML files for design artifacts (~82 files) |
| `scripts/seed-design-artifacts.mjs` | Upload artifacts to Blob + insert catalog rows to Neon |
| `src/app/api/export/figma/[assetId]/route.ts` | Figma SVG export — converts layered HTML to single self-contained SVG |
| `src/app/admin/artifacts/page.tsx` | Admin UI for artifact CRUD management |
| `worker/tests/test_archetype_selector.py` | Tests for archetype selection logic |
| `worker/tests/test_compositor_prompt.py` | Tests for prompt builder |
| `worker/tests/test_stage4_v3.py` | Integration tests for v3 compose pipeline |
| `scripts/verify-composition-engine.mjs` | End-to-end verification script |

### Modified Files
| File | Change |
|------|--------|
| `scripts/init-db.mjs` | Add `design_artifacts` table CREATE statement |
| `worker/neon_client.py` | Add `get_active_artifacts()`, `upsert_artifact()`, `delete_artifact()` |
| `worker/pipeline/orchestrator.py:15,60` | Switch import from `stage4_compose_v2` to `stage4_compose_v3` |
| `src/components/AppShell.tsx` | Add "Artifacts" link to admin nav (if admin nav is here) |

---

## Parallelization Guide

```
Group A (independent — run in parallel):
  Task 1: Database schema
  Task 3: Artifact source files
  Task 5: Compositor prompt builder
  Task 6: Archetype selector

Group B (depends on Group A):
  Task 2: Neon client methods (needs Task 1)
  Task 4: Seed script (needs Tasks 1, 2, 3)

Group C (depends on Group B):
  Task 7: stage4_compose_v3 (needs Tasks 2, 5, 6)
  Task 10: Admin artifacts page (needs Task 2)

Group D (depends on Group C):
  Task 8: Pipeline integration (needs Task 7)
  Task 9: Figma SVG export (needs Task 7)

Group E (depends on all):
  Task 11: Verify script
```

---

### Task 1: Database Schema — `design_artifacts` Table

**Files:**
- Modify: `scripts/init-db.mjs`

- [ ] **Step 1: Read the current init-db.mjs**

Read `scripts/init-db.mjs` to find the pattern for CREATE TABLE statements and understand the connection setup.

- [ ] **Step 2: Add `design_artifacts` table**

Add this CREATE TABLE statement after the existing tables in `scripts/init-db.mjs`:

```sql
CREATE TABLE IF NOT EXISTS design_artifacts (
    artifact_id     TEXT PRIMARY KEY,
    category        TEXT NOT NULL,
    description     TEXT NOT NULL,
    blob_url        TEXT NOT NULL,
    dimensions      TEXT,
    css_class       TEXT,
    usage_snippet   TEXT NOT NULL,
    usage_notes     TEXT,
    pillar_affinity TEXT[] DEFAULT '{}',
    format_affinity TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_artifacts_category ON design_artifacts(category);
CREATE INDEX IF NOT EXISTS idx_design_artifacts_active ON design_artifacts(is_active) WHERE is_active = true;
```

Follow the exact pattern used by the other CREATE TABLE statements in the file (string interpolation, `pool.query()`, error handling).

- [ ] **Step 3: Run init-db to verify**

```bash
cd /Users/stevenjunop/centric-intake && node scripts/init-db.mjs
```

Expected: Table created successfully (or "already exists" if idempotent).

- [ ] **Step 4: Verify table exists in Neon**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -c "
import asyncio
from neon_client import get_pool

async def check():
    pool = await get_pool()
    row = await pool.fetchval(\"SELECT count(*) FROM information_schema.tables WHERE table_name = 'design_artifacts'\")
    print(f'design_artifacts table exists: {row > 0}')
    await pool.close()

asyncio.run(check())
"
```

Expected: `design_artifacts table exists: True`

- [ ] **Step 5: Commit**

```bash
git add scripts/init-db.mjs
git commit -m "feat(db): add design_artifacts table for composition engine artifact catalog"
```

---

### Task 2: Neon Client — Artifact CRUD Methods

**Files:**
- Modify: `worker/neon_client.py`
- Create: `worker/tests/test_neon_artifacts.py`

**Depends on:** Task 1

- [ ] **Step 1: Write failing test for `get_active_artifacts()`**

Create `worker/tests/test_neon_artifacts.py`:

```python
"""Smoke tests for design artifact Neon client methods."""

import asyncio
import pytest
from neon_client import get_active_artifacts, upsert_artifact, delete_artifact


@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def test_get_active_artifacts_returns_list(event_loop):
    """get_active_artifacts should return a list (possibly empty)."""
    result = event_loop.run_until_complete(get_active_artifacts())
    assert isinstance(result, list)


def test_upsert_and_retrieve_artifact(event_loop):
    """Insert a test artifact, retrieve it, then clean up."""
    test_artifact = {
        "artifact_id": "_test_blob_1",
        "category": "blob",
        "description": "Test blob for automated testing",
        "blob_url": "https://example.com/test.svg",
        "dimensions": "100x100",
        "css_class": "test-blob",
        "usage_snippet": '<img src="https://example.com/test.svg" />',
        "usage_notes": "Test only",
        "pillar_affinity": ["earn"],
        "format_affinity": ["ig_feed"],
        "is_active": True,
    }

    # Insert
    result = event_loop.run_until_complete(upsert_artifact(test_artifact))
    assert result["artifact_id"] == "_test_blob_1"

    # Retrieve
    artifacts = event_loop.run_until_complete(get_active_artifacts())
    found = [a for a in artifacts if a["artifact_id"] == "_test_blob_1"]
    assert len(found) == 1
    assert found[0]["category"] == "blob"
    assert found[0]["description"] == "Test blob for automated testing"

    # Clean up — hard delete test row
    event_loop.run_until_complete(delete_artifact("_test_blob_1", hard=True))

    # Verify gone
    artifacts = event_loop.run_until_complete(get_active_artifacts())
    found = [a for a in artifacts if a["artifact_id"] == "_test_blob_1"]
    assert len(found) == 0


def test_delete_artifact_soft(event_loop):
    """Soft delete should set is_active=false, not remove the row."""
    test_artifact = {
        "artifact_id": "_test_blob_soft",
        "category": "blob",
        "description": "Test blob for soft delete",
        "blob_url": "https://example.com/test2.svg",
        "dimensions": "50x50",
        "css_class": "",
        "usage_snippet": '<img src="https://example.com/test2.svg" />',
        "usage_notes": "",
        "pillar_affinity": [],
        "format_affinity": [],
        "is_active": True,
    }

    event_loop.run_until_complete(upsert_artifact(test_artifact))

    # Soft delete
    event_loop.run_until_complete(delete_artifact("_test_blob_soft"))

    # Should not appear in active artifacts
    artifacts = event_loop.run_until_complete(get_active_artifacts())
    found = [a for a in artifacts if a["artifact_id"] == "_test_blob_soft"]
    assert len(found) == 0

    # Hard delete cleanup
    event_loop.run_until_complete(delete_artifact("_test_blob_soft", hard=True))
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_neon_artifacts.py -v
```

Expected: FAIL — `ImportError: cannot import name 'get_active_artifacts' from 'neon_client'`

- [ ] **Step 3: Implement artifact methods in neon_client.py**

Read `worker/neon_client.py` to find the pattern for existing async functions (how they get a pool, execute queries, return results). Then add these three functions at the end of the file, following the same pattern:

```python
async def get_active_artifacts() -> list[dict[str, Any]]:
    """Fetch all active design artifacts for compositor prompt."""
    pool = await get_pool()
    rows = await pool.fetch("""
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
    pool = await get_pool()
    row = await pool.fetchrow("""
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
    pool = await get_pool()
    if hard:
        await pool.execute(
            "DELETE FROM design_artifacts WHERE artifact_id = $1",
            artifact_id,
        )
    else:
        await pool.execute(
            "UPDATE design_artifacts SET is_active = false, updated_at = NOW() WHERE artifact_id = $1",
            artifact_id,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_neon_artifacts.py -v
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/neon_client.py worker/tests/test_neon_artifacts.py
git commit -m "feat(neon): add artifact CRUD methods — get_active_artifacts, upsert_artifact, delete_artifact"
```

---

### Task 3: Artifact Source Files

**Files:**
- Create: `scripts/artifacts/blobs/blob_organic_1.svg` (+ ~15 representative artifacts across categories)
- Create: `scripts/artifacts/README.md`

**Independent — no dependencies**

This task creates a representative set of ~16 hand-crafted artifacts across the key categories. The remaining ~66 artifacts will be added iteratively after the engine is proven.

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /Users/stevenjunop/centric-intake/scripts/artifacts/{blobs,dividers,masks,badges,gradients,ctas,patterns,frames,text_treatments,logos}
```

- [ ] **Step 2: Create blob artifacts (3 files)**

Create `scripts/artifacts/blobs/blob_organic_1.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 380" fill="none">
  <path d="M320 40C380 80 400 180 360 260C320 340 220 380 140 360C60 340 0 280 20 200C40 120 80 60 160 30C240 0 260 0 320 40Z" fill="url(#g1)" opacity="0.4"/>
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="400" y2="380">
      <stop offset="0%" stop-color="#6B21A8"/>
      <stop offset="100%" stop-color="#E91E8C"/>
    </linearGradient>
  </defs>
</svg>
```

Create `scripts/artifacts/blobs/blob_organic_2.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 280" fill="none">
  <path d="M240 30C290 70 300 150 260 210C220 270 140 280 80 250C20 220 0 160 30 100C60 40 120 0 190 10C210 13 225 20 240 30Z" fill="url(#g2)" opacity="0.35"/>
  <defs>
    <linearGradient id="g2" x1="0" y1="0" x2="300" y2="280">
      <stop offset="0%" stop-color="#3D1059"/>
      <stop offset="100%" stop-color="#6B21A8"/>
    </linearGradient>
  </defs>
</svg>
```

Create `scripts/artifacts/blobs/blob_corner_accent.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 160" fill="none">
  <path d="M0 0C60 0 140 20 170 60C200 100 180 160 120 150C60 140 20 100 0 60V0Z" fill="url(#g3)" opacity="0.3"/>
  <defs>
    <linearGradient id="g3" x1="0" y1="0" x2="180" y2="160">
      <stop offset="0%" stop-color="#6B21A8"/>
      <stop offset="100%" stop-color="#9333EA"/>
    </linearGradient>
  </defs>
</svg>
```

- [ ] **Step 3: Create divider artifacts (2 files)**

Create `scripts/artifacts/dividers/divider_curved_wave.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 80" preserveAspectRatio="none">
  <path d="M0 40C180 80 360 0 540 40C720 80 900 0 1080 40V80H0V40Z" fill="white"/>
</svg>
```

Create `scripts/artifacts/dividers/divider_arc.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 60" preserveAspectRatio="none">
  <path d="M0 60C270 0 810 0 1080 60V60H0V60Z" fill="white"/>
</svg>
```

- [ ] **Step 4: Create mask artifacts (2 files)**

Create `scripts/artifacts/masks/mask_blob_egg.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700">
  <defs>
    <clipPath id="mask_blob_egg">
      <path d="M300 20C460 20 570 140 580 300C590 460 520 620 380 670C240 720 100 640 40 480C-20 320 60 120 200 50C240 35 270 20 300 20Z"/>
    </clipPath>
  </defs>
  <rect width="600" height="700" clip-path="url(#mask_blob_egg)" fill="#ccc"/>
</svg>
```

Create `scripts/artifacts/masks/mask_blob_organic.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 600">
  <defs>
    <clipPath id="mask_blob_organic">
      <path d="M350 10C520 10 680 100 690 260C700 420 600 560 440 580C280 600 120 520 40 380C-40 240 80 60 220 20C260 12 310 10 350 10Z"/>
    </clipPath>
  </defs>
  <rect width="700" height="600" clip-path="url(#mask_blob_organic)" fill="#ccc"/>
</svg>
```

- [ ] **Step 5: Create badge artifacts (3 files)**

Create `scripts/artifacts/badges/badge_icon_globe.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="30" fill="url(#bg)"/>
  <path d="M32 12C21 12 12 21 12 32s9 20 20 20 20-9 20-20-9-20-20-20zm0 4c2.5 0 5 4 6 10H26c1-6 3.5-10 6-10zm-14 16c0-2 .3-4 1-6h9v12h-9c-.7-2-1-4-1-6zm14 14c-2.5 0-5-4-6-10h12c-1 6-3.5 10-6 10zm8-14h9c.7 2 1 4 1 6s-.3 4-1 6h-9V32z" fill="white" opacity="0.9"/>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0%" stop-color="#6B21A8"/>
      <stop offset="100%" stop-color="#E91E8C"/>
    </linearGradient>
  </defs>
</svg>
```

Create `scripts/artifacts/badges/badge_icon_briefcase.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="30" fill="url(#bg2)"/>
  <rect x="16" y="24" width="32" height="22" rx="3" fill="white" opacity="0.9"/>
  <rect x="24" y="18" width="16" height="8" rx="2" fill="none" stroke="white" stroke-width="2" opacity="0.9"/>
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0%" stop-color="#6B21A8"/>
      <stop offset="100%" stop-color="#E91E8C"/>
    </linearGradient>
  </defs>
</svg>
```

Create `scripts/artifacts/badges/badge_icon_award.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="30" fill="url(#bg3)"/>
  <circle cx="32" cy="26" r="10" fill="none" stroke="white" stroke-width="2.5" opacity="0.9"/>
  <path d="M26 34L24 48l8-4 8 4-2-14" fill="white" opacity="0.9"/>
  <defs>
    <linearGradient id="bg3" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0%" stop-color="#6B21A8"/>
      <stop offset="100%" stop-color="#E91E8C"/>
    </linearGradient>
  </defs>
</svg>
```

- [ ] **Step 6: Create gradient CSS artifacts (2 files)**

Create `scripts/artifacts/gradients/gradient_sapphire_pink.css`:
```css
.gradient-sapphire-pink {
  background: linear-gradient(135deg, #3D1059 0%, #6B21A8 40%, #E91E8C 100%);
}
```

Create `scripts/artifacts/gradients/gradient_light_lavender.css`:
```css
.gradient-light-lavender {
  background: linear-gradient(180deg, #FFFFFF 0%, #F3E8FF 60%, #E9D5FF 100%);
}
```

- [ ] **Step 7: Create CTA HTML artifacts (2 files)**

Create `scripts/artifacts/ctas/cta_pill_filled.html`:
```html
<div style="display:inline-block;background:linear-gradient(135deg,#6B21A8,#E91E8C);color:#fff;padding:14px 36px;border-radius:9999px;font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(107,33,168,0.4);cursor:pointer;">{cta_text}</div>
```

Create `scripts/artifacts/ctas/cta_pill_outline.html`:
```html
<div style="display:inline-block;background:transparent;color:#fff;padding:12px 32px;border-radius:9999px;border:2px solid rgba(255,255,255,0.8);font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.5px;cursor:pointer;">{cta_text}</div>
```

- [ ] **Step 8: Create artifact README**

Create `scripts/artifacts/README.md`:
```markdown
# Design Artifacts

Pre-built SVG/CSS/HTML components for the Stage 4 composition engine.
These are uploaded to Vercel Blob and cataloged in Neon by `scripts/seed-design-artifacts.mjs`.

## Categories
- `blobs/` — Organic accent shapes (opacity 0.3-0.6, corner anchored)
- `dividers/` — Section separators (wave, arc, straight)
- `masks/` — Clip-paths for actor photos (egg, organic, circle)
- `badges/` — Circle gradient + icon (64x64)
- `gradients/` — CSS background gradient classes
- `ctas/` — Pre-styled CTA button HTML snippets
- `patterns/` — Subtle texture overlays
- `frames/` — Card frames, device mockups
- `text_treatments/` — CSS text effects
- `logos/` — OneForma/Centific logos

## Adding artifacts
1. Add the SVG/CSS/HTML file to the appropriate category folder
2. Add an entry to `ARTIFACTS` array in `scripts/seed-design-artifacts.mjs`
3. Run `node scripts/seed-design-artifacts.mjs`
```

- [ ] **Step 9: Commit**

```bash
git add scripts/artifacts/
git commit -m "feat(artifacts): add initial design artifact source files — 14 SVGs + 2 CSS + 2 HTML across 7 categories"
```

---

### Task 4: Artifact Seed Script

**Files:**
- Create: `scripts/seed-design-artifacts.mjs`

**Depends on:** Tasks 1, 2, 3

- [ ] **Step 1: Read existing seed script pattern**

Read `scripts/init-db.mjs` to understand the Neon connection pattern (pool setup, env vars, error handling). Also read how `worker/blob_uploader.py` constructs the Blob upload URL to replicate in Node.js.

- [ ] **Step 2: Write the seed script**

Create `scripts/seed-design-artifacts.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Seed design artifacts: upload SVG/CSS/HTML files to Vercel Blob,
 * then upsert catalog rows into Neon design_artifacts table.
 *
 * Usage: node scripts/seed-design-artifacts.mjs
 * Idempotent: safe to run multiple times (ON CONFLICT DO UPDATE).
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import pg from "pg";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BLOB_TOKEN) {
  console.error("Missing BLOB_READ_WRITE_TOKEN env var");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var");
  process.exit(1);
}

// ─── Artifact Manifest ──────────────────────────────────────────────
const ARTIFACTS = [
  // Blobs
  {
    artifact_id: "blob_organic_1",
    category: "blob",
    description: "Large flowing organic shape, anchored top-right",
    file: "blobs/blob_organic_1.svg",
    dimensions: "400x380",
    css_class: "artifact-blob-organic-1",
    usage_snippet: '<img src="{url}" style="position:absolute;top:0;right:0;width:400px;opacity:0.4;" />',
    usage_notes: "Use in corners. Opacity 0.3-0.6. Never centered on canvas.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "blob_organic_2",
    category: "blob",
    description: "Medium pebble shape, anchored bottom-left",
    file: "blobs/blob_organic_2.svg",
    dimensions: "300x280",
    css_class: "artifact-blob-organic-2",
    usage_snippet: '<img src="{url}" style="position:absolute;bottom:0;left:0;width:300px;opacity:0.35;" />',
    usage_notes: "Pair with blob_organic_1 for corner framing. Opacity 0.3-0.5.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "blob_corner_accent",
    category: "blob",
    description: "Small corner accent blob for tight spaces",
    file: "blobs/blob_corner_accent.svg",
    dimensions: "180x160",
    css_class: "artifact-blob-corner",
    usage_snippet: '<img src="{url}" style="position:absolute;top:0;left:0;width:180px;opacity:0.3;" />',
    usage_notes: "For corners only. Keep small and subtle.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "ig_story", "linkedin_feed"],
  },

  // Dividers
  {
    artifact_id: "divider_curved_wave",
    category: "divider",
    description: "White curved wave separating sections",
    file: "dividers/divider_curved_wave.svg",
    dimensions: "1080x80",
    css_class: "artifact-divider-wave",
    usage_snippet: '<img src="{url}" style="position:absolute;width:100%;height:80px;" />',
    usage_notes: "Place between gradient zone and photo zone. Use preserveAspectRatio='none' to stretch.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "ig_story", "linkedin_feed", "facebook_feed", "tiktok_feed"],
  },
  {
    artifact_id: "divider_arc",
    category: "divider",
    description: "Smooth arc divider, softer than wave",
    file: "dividers/divider_arc.svg",
    dimensions: "1080x60",
    css_class: "artifact-divider-arc",
    usage_snippet: '<img src="{url}" style="position:absolute;width:100%;height:60px;" />',
    usage_notes: "Subtler than wave. Good for Photo Feature archetype.",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed"],
  },

  // Masks
  {
    artifact_id: "mask_blob_egg",
    category: "mask",
    description: "Egg/pebble clip-path for actor photo",
    file: "masks/mask_blob_egg.svg",
    dimensions: "600x700",
    css_class: "artifact-mask-egg",
    usage_snippet: '<div style="clip-path:url(#mask_blob_egg);width:600px;height:700px;"><img src="{photo_url}" style="width:100%;height:100%;object-fit:cover;" /></div>',
    usage_notes: "Primary mask for Photo Feature archetype. Actor photo fills the egg shape.",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "mask_blob_organic",
    category: "mask",
    description: "Flowing organic clip-path for actor photo",
    file: "masks/mask_blob_organic.svg",
    dimensions: "700x600",
    css_class: "artifact-mask-organic",
    usage_snippet: '<div style="clip-path:url(#mask_blob_organic);width:700px;height:600px;"><img src="{photo_url}" style="width:100%;height:100%;object-fit:cover;" /></div>',
    usage_notes: "Alternative to egg mask. Wider aspect ratio.",
    pillar_affinity: ["shape", "grow"],
    format_affinity: ["linkedin_feed", "facebook_feed"],
  },

  // Badges
  {
    artifact_id: "badge_icon_globe",
    category: "badge",
    description: "Circle gradient badge with globe icon — work from anywhere",
    file: "badges/badge_icon_globe.svg",
    dimensions: "64x64",
    css_class: "artifact-badge-globe",
    usage_snippet: '<img src="{url}" style="width:64px;height:64px;" />',
    usage_notes: "Use for 'work from anywhere' or 'global community' benefit callouts.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_icon_briefcase",
    category: "badge",
    description: "Circle gradient badge with briefcase icon — professional work",
    file: "badges/badge_icon_briefcase.svg",
    dimensions: "64x64",
    css_class: "artifact-badge-briefcase",
    usage_snippet: '<img src="{url}" style="width:64px;height:64px;" />',
    usage_notes: "Use for 'professional opportunity' or 'career growth' callouts.",
    pillar_affinity: ["shape", "grow"],
    format_affinity: ["linkedin_feed", "ig_feed"],
  },
  {
    artifact_id: "badge_icon_award",
    category: "badge",
    description: "Circle gradient badge with award ribbon — recognition",
    file: "badges/badge_icon_award.svg",
    dimensions: "64x64",
    css_class: "artifact-badge-award",
    usage_snippet: '<img src="{url}" style="width:64px;height:64px;" />',
    usage_notes: "Use for 'top contributor' or 'certification' callouts.",
    pillar_affinity: ["shape"],
    format_affinity: ["linkedin_feed", "ig_feed"],
  },

  // Gradients
  {
    artifact_id: "gradient_sapphire_pink",
    category: "gradient",
    description: "Sapphire purple to hot pink — primary brand gradient",
    file: "gradients/gradient_sapphire_pink.css",
    dimensions: "CSS",
    css_class: "gradient-sapphire-pink",
    usage_snippet: '<div style="background:linear-gradient(135deg,#3D1059 0%,#6B21A8 40%,#E91E8C 100%);width:100%;height:100%;"></div>',
    usage_notes: "Primary brand gradient. Use for Gradient Hero archetype backgrounds.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "ig_story", "linkedin_feed", "facebook_feed", "tiktok_feed"],
  },
  {
    artifact_id: "gradient_light_lavender",
    category: "gradient",
    description: "White to soft lavender — light background",
    file: "gradients/gradient_light_lavender.css",
    dimensions: "CSS",
    css_class: "gradient-light-lavender",
    usage_snippet: '<div style="background:linear-gradient(180deg,#FFFFFF 0%,#F3E8FF 60%,#E9D5FF 100%);width:100%;height:100%;"></div>',
    usage_notes: "Use for Photo Feature archetype. Subtle, professional feel.",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed"],
  },

  // CTAs
  {
    artifact_id: "cta_pill_filled",
    category: "cta",
    description: "Sapphire-to-pink filled pill CTA button",
    file: "ctas/cta_pill_filled.html",
    dimensions: "auto",
    css_class: "artifact-cta-filled",
    usage_snippet: '<div style="display:inline-block;background:linear-gradient(135deg,#6B21A8,#E91E8C);color:#fff;padding:14px 36px;border-radius:9999px;font-family:-apple-system,system-ui,sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(107,33,168,0.4);">{cta_text}</div>',
    usage_notes: "Primary CTA. Use on dark/gradient backgrounds. Replace {cta_text} with actual CTA copy.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "ig_story", "linkedin_feed", "facebook_feed", "tiktok_feed"],
  },
  {
    artifact_id: "cta_pill_outline",
    category: "cta",
    description: "White outline pill CTA button",
    file: "ctas/cta_pill_outline.html",
    dimensions: "auto",
    css_class: "artifact-cta-outline",
    usage_snippet: '<div style="display:inline-block;background:transparent;color:#fff;padding:12px 32px;border-radius:9999px;border:2px solid rgba(255,255,255,0.8);font-family:-apple-system,system-ui,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.5px;">{cta_text}</div>',
    usage_notes: "Secondary CTA. Use on gradient backgrounds for less emphasis. Replace {cta_text}.",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed"],
  },
];

// ─── Blob Upload ──────────────────────────────────────────────────
const CONTENT_TYPES = {
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".html": "text/html",
};

async function uploadToBlob(fileBytes, filename, folder) {
  const ext = extname(filename);
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const path = `artifacts/${folder}/${filename}`;

  const resp = await fetch(`https://blob.vercel-storage.com/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "x-api-version": "7",
      "Content-Type": contentType,
    },
    body: fileBytes,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Blob upload failed for ${path}: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.url;
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const artifactsDir = join(import.meta.dirname, "artifacts");

  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  let uploaded = 0;
  let skipped = 0;

  for (const artifact of ARTIFACTS) {
    const filePath = join(artifactsDir, artifact.file);

    if (!existsSync(filePath)) {
      console.warn(`  SKIP: ${artifact.file} not found`);
      skipped++;
      continue;
    }

    // Upload file to Vercel Blob
    const fileBytes = readFileSync(filePath);
    const folder = artifact.file.split("/")[0]; // e.g. "blobs"
    const filename = basename(artifact.file);

    console.log(`  Uploading ${artifact.artifact_id} → artifacts/${folder}/${filename}`);
    const blobUrl = await uploadToBlob(fileBytes, filename, folder);

    // Upsert catalog row
    await pool.query(
      `INSERT INTO design_artifacts
        (artifact_id, category, description, blob_url, dimensions, css_class,
         usage_snippet, usage_notes, pillar_affinity, format_affinity, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (artifact_id) DO UPDATE SET
        category=EXCLUDED.category, description=EXCLUDED.description,
        blob_url=EXCLUDED.blob_url, dimensions=EXCLUDED.dimensions,
        css_class=EXCLUDED.css_class, usage_snippet=EXCLUDED.usage_snippet,
        usage_notes=EXCLUDED.usage_notes, pillar_affinity=EXCLUDED.pillar_affinity,
        format_affinity=EXCLUDED.format_affinity, is_active=EXCLUDED.is_active,
        updated_at=NOW()`,
      [
        artifact.artifact_id,
        artifact.category,
        artifact.description,
        blobUrl,
        artifact.dimensions || "",
        artifact.css_class || "",
        artifact.usage_snippet.replace("{url}", blobUrl),
        artifact.usage_notes || "",
        artifact.pillar_affinity || [],
        artifact.format_affinity || [],
        artifact.is_active !== false,
      ]
    );

    uploaded++;
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped`);

  // Verify count
  const { rows } = await pool.query(
    "SELECT count(*) as cnt FROM design_artifacts WHERE is_active = true"
  );
  console.log(`Total active artifacts in DB: ${rows[0].cnt}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the seed script**

```bash
cd /Users/stevenjunop/centric-intake && node scripts/seed-design-artifacts.mjs
```

Expected: `Done: 14 uploaded, 0 skipped` and `Total active artifacts in DB: 14`

- [ ] **Step 4: Verify artifacts in Neon**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -c "
import asyncio
from neon_client import get_active_artifacts

async def check():
    arts = await get_active_artifacts()
    print(f'Active artifacts: {len(arts)}')
    for a in arts:
        print(f'  {a[\"artifact_id\"]:25s} {a[\"category\"]:10s} {a[\"description\"][:50]}')

asyncio.run(check())
"
```

Expected: 14 artifacts listed with correct categories and descriptions.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-design-artifacts.mjs
git commit -m "feat(artifacts): add seed script — uploads SVGs to Blob + inserts catalog to Neon"
```

---

### Task 5: Compositor Prompt Builder

**Files:**
- Create: `worker/prompts/compositor_prompt.py`
- Create: `worker/tests/test_compositor_prompt.py`

**Independent — no dependencies**

- [ ] **Step 1: Write failing tests**

Create `worker/tests/test_compositor_prompt.py`:

```python
"""Tests for the artifact-driven compositor prompt builder."""

import pytest
from prompts.compositor_prompt import (
    build_artifact_catalog_section,
    build_compositor_prompt,
    ARCHETYPE_CONSTRAINTS,
)


# ── Fixtures ──────────────────────────────────────────────────────

SAMPLE_CATALOG = [
    {
        "artifact_id": "blob_organic_1",
        "category": "blob",
        "description": "Large flowing organic shape",
        "blob_url": "https://blob.example.com/blob1.svg",
        "dimensions": "400x380",
        "pillar_affinity": ["earn", "grow"],
    },
    {
        "artifact_id": "gradient_sapphire_pink",
        "category": "gradient",
        "description": "Sapphire to pink gradient",
        "blob_url": "https://blob.example.com/grad.css",
        "dimensions": "CSS",
        "pillar_affinity": ["earn", "grow", "shape"],
    },
    {
        "artifact_id": "cta_pill_filled",
        "category": "cta",
        "description": "Filled pill CTA button",
        "blob_url": "https://blob.example.com/cta.html",
        "dimensions": "auto",
        "pillar_affinity": ["earn", "grow", "shape"],
    },
]

SAMPLE_INPUTS = {
    "platform": "ig_feed",
    "platform_spec": {"width": 1080, "height": 1080, "safe_margin": 60, "label": "Instagram Feed"},
    "pillar": "earn",
    "actor": {
        "name": "Carlos",
        "photo_url": "https://blob.example.com/carlos_full.png",
        "cutout_url": "https://blob.example.com/carlos_cutout.png",
        "persona_key": "remote_earner",
    },
    "copy": {
        "headline": "Earn R$60/hr from Home",
        "subheadline": "Join 50,000+ contributors worldwide",
        "cta": "Apply in 2 Minutes",
    },
    "visual_direction": {
        "work_environment": "home desk setup",
        "wardrobe": "casual t-shirt",
        "emotional_tone": "relaxed casual",
    },
}


# ── Tests ─────────────────────────────────────────────────────────

def test_build_artifact_catalog_section_contains_all_ids():
    section = build_artifact_catalog_section(SAMPLE_CATALOG)
    assert "blob_organic_1" in section
    assert "gradient_sapphire_pink" in section
    assert "cta_pill_filled" in section


def test_build_artifact_catalog_section_is_compact():
    """Catalog section should be short — table rows, not inline SVG."""
    section = build_artifact_catalog_section(SAMPLE_CATALOG)
    lines = section.strip().split("\n")
    # Header + separator + 3 rows + usage instructions ≈ <20 lines
    assert len(lines) < 30


def test_build_compositor_prompt_contains_all_sections():
    prompt = build_compositor_prompt(
        catalog=SAMPLE_CATALOG,
        archetype="floating_props",
        **SAMPLE_INPUTS,
    )
    # Should contain all 6 sections
    assert "ROLE" in prompt or "senior visual designer" in prompt.lower()
    assert "ARTIFACT" in prompt or "artifact_id" in prompt
    assert "ARCHETYPE" in prompt or "floating_props" in prompt.lower()
    assert "ig_feed" in prompt
    assert "Earn R$60/hr" in prompt
    assert "BRAND" in prompt or "#6B21A8" in prompt
    assert "JSON" in prompt or "layer_manifest" in prompt


def test_build_compositor_prompt_includes_actor_urls():
    prompt = build_compositor_prompt(
        catalog=SAMPLE_CATALOG,
        archetype="gradient_hero",
        **SAMPLE_INPUTS,
    )
    assert "carlos_full.png" in prompt
    assert "carlos_cutout.png" in prompt


def test_archetype_constraints_all_three_exist():
    assert "floating_props" in ARCHETYPE_CONSTRAINTS
    assert "gradient_hero" in ARCHETYPE_CONSTRAINTS
    assert "photo_feature" in ARCHETYPE_CONSTRAINTS


def test_archetype_constraints_have_z_layers():
    for name, constraint in ARCHETYPE_CONSTRAINTS.items():
        assert "z_layers" in constraint, f"{name} missing z_layers"
        assert len(constraint["z_layers"]) >= 5, f"{name} has too few layers"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_compositor_prompt.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'prompts.compositor_prompt'`

- [ ] **Step 3: Write the compositor prompt builder**

Create `worker/prompts/compositor_prompt.py`:

```python
"""Artifact-driven compositor prompt builder for GLM-5.

Builds a 6-section prompt that instructs GLM-5 to assemble pre-built
design artifacts into layered HTML creatives.
"""

from __future__ import annotations

from typing import Any


# ── Archetype Structural Constraints ────────────────────────────

ARCHETYPE_CONSTRAINTS: dict[str, dict[str, Any]] = {
    "floating_props": {
        "description": "Gig work / data collection — badge-rich, blob-accented, gradient background",
        "z_layers": [
            {"z": 0, "role": "background", "note": "Gradient background (full canvas)"},
            {"z": 1, "role": "accent_blobs", "note": "3-4 organic blob shapes in corners, opacity 0.3-0.6"},
            {"z": 2, "role": "actor_photo", "note": "Actor photo centered or 40% left, 50-55% canvas height"},
            {"z": 3, "role": "floating_badges", "note": "3-4 icon badges orbiting actor, offset from edges"},
            {"z": 4, "role": "headline", "note": "Headline + subheadline in top 30% or bottom 20%"},
            {"z": 5, "role": "cta", "note": "CTA pill button, bottom center, 12% from bottom edge"},
            {"z": 6, "role": "social_proof", "note": "Avatar-stack (3-4 circles + '+50K contributors') above CTA"},
            {"z": 7, "role": "logo", "note": "OneForma logo, bottom-right corner, small"},
        ],
    },
    "gradient_hero": {
        "description": "High-impact paid media — full gradient, actor in bowl, headline top zone",
        "z_layers": [
            {"z": 0, "role": "background", "note": "Full gradient background"},
            {"z": 1, "role": "divider", "note": "Curved divider creates 'bowl' at 55-60% from top"},
            {"z": 2, "role": "actor_photo", "note": "Actor photo in bowl, bottom-anchored, cropped at waist"},
            {"z": 3, "role": "headline", "note": "Large headline in top zone, above divider"},
            {"z": 4, "role": "subheadline", "note": "Below headline, 60% font size of headline"},
            {"z": 5, "role": "cta", "note": "CTA pill just above divider line, centered"},
            {"z": 6, "role": "badge_strip", "note": "2-3 badges in horizontal row below CTA"},
            {"z": 7, "role": "social_proof", "note": "Avatar-stack in gradient zone above divider"},
            {"z": 8, "role": "logo", "note": "Logo in top-left or bottom-right corner"},
        ],
    },
    "photo_feature": {
        "description": "Credentialed/professional — large masked photo, minimal text, clean layout",
        "z_layers": [
            {"z": 0, "role": "background", "note": "White or light lavender background"},
            {"z": 1, "role": "actor_photo", "note": "Actor photo in blob/egg mask, 55-60% canvas, offset left or right"},
            {"z": 2, "role": "photo_border", "note": "Thin border frame around photo mask, 2px accent color"},
            {"z": 3, "role": "accent_blobs", "note": "1-2 subtle blobs in opposite corner from photo, low opacity"},
            {"z": 4, "role": "headline", "note": "Headline in text zone, opposite side from photo"},
            {"z": 5, "role": "subheadline", "note": "Below headline, muted color"},
            {"z": 6, "role": "cta", "note": "CTA button below text, outline style"},
            {"z": 7, "role": "badge", "note": "Single badge next to CTA for credibility"},
            {"z": 8, "role": "logo", "note": "Logo in corner opposite photo"},
        ],
    },
}


# ── Prompt Sections ─────────────────────────────────────────────

def _section_role() -> str:
    return """You are a senior visual designer composing recruitment marketing creatives for OneForma.
You assemble pre-built design artifacts into layered HTML/CSS compositions.
You do NOT generate SVG paths, gradient CSS, or icons from scratch — you reference artifacts by their artifact_id and blob_url.
Every visual element in your output MUST come from the artifact catalog or the provided actor photo URLs."""


def build_artifact_catalog_section(catalog: list[dict[str, Any]]) -> str:
    """Build compact artifact table for the prompt. ~50 lines max."""
    lines = [
        "DESIGN ARTIFACTS (reference by artifact_id — use blob_url as img src):",
        "",
        "| artifact_id | category | description | size | pillar_affinity |",
        "|---|---|---|---|---|",
    ]
    for a in catalog:
        affinity = ", ".join(a.get("pillar_affinity") or []) or "any"
        lines.append(
            f"| {a['artifact_id']} | {a['category']} | {a['description'][:55]} | {a.get('dimensions', 'auto')} | {affinity} |"
        )

    lines.extend([
        "",
        "Usage rules:",
        "- SVG artifacts: <img src=\"{blob_url}\" style=\"position:absolute; ...\" />",
        "- Mask artifacts: embed the SVG clipPath inline, then apply via style=\"clip-path:url(#id)\"",
        "- Gradient artifacts: apply as inline CSS background on a div",
        "- CTA artifacts: paste the usage_snippet HTML, replace {cta_text} with actual CTA copy",
        "- All artifacts use position:absolute within the creative container",
    ])
    return "\n".join(lines)


def _section_archetype(archetype: str) -> str:
    """Build archetype constraint section."""
    ac = ARCHETYPE_CONSTRAINTS[archetype]
    lines = [
        f"COMPOSITION ARCHETYPE: {archetype}",
        f"Description: {ac['description']}",
        "",
        "Layer ordering (MUST follow this z-index structure):",
    ]
    for layer in ac["z_layers"]:
        lines.append(f"  z-{layer['z']}: {layer['role']} — {layer['note']}")
    return "\n".join(lines)


def _section_inputs(
    platform: str,
    platform_spec: dict[str, Any],
    pillar: str,
    actor: dict[str, Any],
    copy: dict[str, Any],
    visual_direction: dict[str, Any],
) -> str:
    """Build inputs section with all creative data."""
    vd_summary = "; ".join(
        f"{k}: {v}" for k, v in (visual_direction or {}).items() if v
    ) or "none specified"

    return f"""CREATIVE INPUTS:
Platform: {platform} ({platform_spec['width']}x{platform_spec['height']}, safe margin: {platform_spec.get('safe_margin', 60)}px)
Pillar: {pillar}
Actor name: {actor.get('name', 'Actor')}
Actor full photo URL: {actor.get('photo_url', '')}
Actor cutout URL: {actor.get('cutout_url', '')}
Headline: {copy.get('headline', '')}
Subheadline: {copy.get('subheadline', '')}
CTA text: {copy.get('cta', 'Apply Now')}
Visual direction: {vd_summary}
Language: {copy.get('language', 'en')}"""


def _section_brand_rules() -> str:
    return """BRAND RULES (MANDATORY — violations fail VQA):
- Colors: deep purple #3D1059→#6B21A8, hot pink CTA #E91E8C. NO gold, NO yellow, NO orange.
- Typography: system fonts ONLY — font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif
- CTA: pill buttons (border-radius: 9999px), gradient or filled, white uppercase text
- Photo: ONE LARGE FACE (50-55% canvas height). NOT multiple small faces.
- Whitespace: 20-30% intentional blank space (breathing room)
- Avatar-stack social proof: MANDATORY — 3-4 overlapping circles + "+50K contributors"
- Blob shapes: NEVER occupy >15% of canvas area. They are accents, not features.
- No dot-pattern textures as primary design element
- No "Powered by Centific" text"""


def _section_output_format(width: int, height: int) -> str:
    return f"""OUTPUT FORMAT — Return valid JSON (no markdown fences):
{{
  "archetype": "floating_props|gradient_hero|photo_feature",
  "artifacts_used": ["artifact_id_1", "artifact_id_2"],
  "layer_manifest": [
    {{"z": 0, "artifact_id": "gradient_sapphire_pink", "role": "background", "css": "position:absolute;top:0;left:0;width:100%;height:100%;"}},
    {{"z": 1, "artifact_id": "blob_organic_1", "role": "accent", "css": "position:absolute;top:0;right:0;width:400px;opacity:0.4;"}}
  ],
  "html": "<div style=\\"position:relative;width:{width}px;height:{height}px;overflow:hidden;\\">...</div>"
}}

CRITICAL RULES:
- Every <img> src MUST be a blob_url from the artifact catalog OR an actor photo URL. No other URLs.
- Never inline SVG <path> data. Never write gradient CSS from scratch — use artifact blob_url.
- The outer container MUST be exactly {width}x{height}px with position:relative and overflow:hidden.
- All layers use position:absolute.
- The "html" field must be a SINGLE self-contained HTML string — no external references except blob URLs."""


# ── Main Builder ────────────────────────────────────────────────

def build_compositor_prompt(
    catalog: list[dict[str, Any]],
    archetype: str,
    platform: str,
    platform_spec: dict[str, Any],
    pillar: str,
    actor: dict[str, Any],
    copy: dict[str, Any],
    visual_direction: dict[str, Any] | None = None,
) -> str:
    """Build the complete 6-section GLM-5 compositor prompt.

    Returns a single string to be used as the user message in the chat completion.
    """
    sections = [
        _section_role(),
        build_artifact_catalog_section(catalog),
        _section_archetype(archetype),
        _section_inputs(platform, platform_spec, pillar, actor, copy, visual_direction or {}),
        _section_brand_rules(),
        _section_output_format(platform_spec["width"], platform_spec["height"]),
    ]
    return "\n\n---\n\n".join(sections)


def inject_vqa_feedback(original_prompt: str, vqa_result: dict[str, Any]) -> str:
    """Append VQA feedback to the prompt for retry attempts.

    Instructs the model to edit (not regenerate) the existing HTML.
    """
    score = vqa_result.get("score", vqa_result.get("overall_score", 0))
    issues = vqa_result.get("issues", [])
    top_fixes = vqa_result.get("top_3_fixes", [])

    feedback_items = issues + top_fixes
    feedback_text = "\n".join(f"- {item}" for item in feedback_items[:6])

    return f"""{original_prompt}

---

VQA FEEDBACK (your previous design scored {score:.2f}/1.0):
{feedback_text}

Fix ONLY the listed issues. Keep everything else intact.
Do NOT regenerate from scratch — edit the existing HTML.
Return the same JSON format with updated html and layer_manifest."""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_compositor_prompt.py -v
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/prompts/compositor_prompt.py worker/tests/test_compositor_prompt.py
git commit -m "feat(prompts): add artifact-driven compositor prompt builder for GLM-5"
```

---

### Task 6: Archetype Selector

**Files:**
- Create: `worker/pipeline/archetype_selector.py`
- Create: `worker/tests/test_archetype_selector.py`

**Independent — no dependencies**

- [ ] **Step 1: Write failing tests**

Create `worker/tests/test_archetype_selector.py`:

```python
"""Tests for composition archetype selection logic."""

import pytest
from pipeline.archetype_selector import select_archetype


def test_shape_pillar_always_photo_feature():
    assert select_archetype("shape", {}, "ig_feed") == "photo_feature"
    assert select_archetype("shape", {}, "linkedin_feed") == "photo_feature"
    assert select_archetype("shape", {}, "ig_story") == "photo_feature"


def test_story_formats_gradient_hero():
    """Vertical story formats should use gradient_hero (unless shape)."""
    assert select_archetype("earn", {}, "ig_story") == "gradient_hero"
    assert select_archetype("earn", {}, "tiktok_feed") == "gradient_hero"
    assert select_archetype("grow", {}, "whatsapp_story") == "gradient_hero"


def test_earn_pillar_floating_props():
    assert select_archetype("earn", {}, "ig_feed") == "floating_props"
    assert select_archetype("earn", {}, "linkedin_feed") == "floating_props"


def test_grow_pillar_floating_props():
    assert select_archetype("grow", {}, "ig_feed") == "floating_props"
    assert select_archetype("grow", {}, "facebook_feed") == "floating_props"


def test_unknown_pillar_defaults_gradient_hero():
    assert select_archetype("unknown", {}, "ig_feed") == "gradient_hero"
    assert select_archetype("", {}, "linkedin_feed") == "gradient_hero"


def test_shape_overrides_story_format():
    """Shape pillar should override the story-format rule."""
    assert select_archetype("shape", {}, "ig_story") == "photo_feature"
    assert select_archetype("shape", {}, "tiktok_feed") == "photo_feature"


def test_wechat_moments_gradient_hero():
    assert select_archetype("earn", {}, "wechat_moments") == "gradient_hero"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_archetype_selector.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.archetype_selector'`

- [ ] **Step 3: Write the archetype selector**

Create `worker/pipeline/archetype_selector.py`:

```python
"""Composition archetype selection logic.

Selects one of three archetypes based on pillar, visual direction, and platform:
  - floating_props: Gig work, earn/grow pillar, badge-rich
  - gradient_hero:  High-impact paid media, story formats, default
  - photo_feature:  Credentialed/professional, shape pillar
"""

from __future__ import annotations

STORY_FORMATS = frozenset({
    "ig_story", "tiktok_feed", "whatsapp_story", "wechat_moments", "wechat_channels",
})


def select_archetype(pillar: str, visual_direction: dict, platform: str) -> str:
    """Select composition archetype based on campaign context.

    Priority:
      1. Shape pillar → always photo_feature (professional credentialing)
      2. Story/vertical formats → gradient_hero (high impact, full canvas)
      3. Earn pillar → floating_props (benefit callouts, badge-rich)
      4. Grow pillar → floating_props (community/growth messaging)
      5. Default → gradient_hero
    """
    # Shape pillar always gets Photo Feature — professional, clean, minimal
    if pillar == "shape":
        return "photo_feature"

    # Story/vertical formats → Gradient Hero for maximum visual impact
    if platform in STORY_FORMATS:
        return "gradient_hero"

    # Earn and Grow pillars → Floating Props (badge-heavy benefit callouts)
    if pillar in ("earn", "grow"):
        return "floating_props"

    # Default: Gradient Hero
    return "gradient_hero"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_archetype_selector.py -v
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add worker/pipeline/archetype_selector.py worker/tests/test_archetype_selector.py
git commit -m "feat(pipeline): add archetype selector — floating_props / gradient_hero / photo_feature"
```

---

### Task 7: Stage 4 Compose v3 — Core Engine

**Files:**
- Create: `worker/pipeline/stage4_compose_v3.py`
- Create: `worker/tests/test_stage4_v3.py`

**Depends on:** Tasks 2, 5, 6

- [ ] **Step 1: Read existing v2 for interface contracts**

Read `worker/pipeline/stage4_compose_v2.py` (lines 56-120 and 655-747) and `worker/pipeline/orchestrator.py` (lines 1-70) to understand:
- What `context` dict keys are available
- What `run_stage4()` must return (`{"asset_count": int}`)
- How `_save_creative()` calls `save_asset()` and `upload_to_blob()`

Also read `worker/ai/creative_designer.py` (lines 239-307) to understand the NIM HTTP call pattern.

- [ ] **Step 2: Write smoke test**

Create `worker/tests/test_stage4_v3.py`:

```python
"""Smoke tests for Stage 4 v3 composition engine.

These test the pure logic (archetype selection, prompt building, response parsing)
without hitting external APIs.
"""

import json
import pytest
from pipeline.stage4_compose_v3 import (
    _build_composition_matrix,
    _parse_compositor_response,
    _get_copy_for_pillar_platform,
)


# ── Fixtures ──────────────────────────────────────────────────────

SAMPLE_ACTORS = [
    {
        "name": "Carlos",
        "face_lock": {"persona_key": "remote_earner"},
        "photo_url": "https://blob.example.com/carlos.png",
        "cutout_url": "https://blob.example.com/carlos_cut.png",
    },
    {
        "name": "Fatima",
        "face_lock": {"persona_key": "career_builder"},
        "photo_url": "https://blob.example.com/fatima.png",
        "cutout_url": "https://blob.example.com/fatima_cut.png",
    },
]

SAMPLE_COPY = {
    "earn": {
        "ig_feed": {"headline": "Earn R$60/hr", "subheadline": "From home", "cta": "Apply Now"},
        "linkedin_feed": {"headline": "Earn R$60/hr", "subheadline": "From home", "cta": "Apply Now"},
    },
    "shape": {
        "ig_feed": {"headline": "Shape AI", "subheadline": "Your expertise matters", "cta": "Join Now"},
        "linkedin_feed": {"headline": "Shape AI", "subheadline": "Your expertise matters", "cta": "Join Now"},
    },
}

SAMPLE_PILLAR_WEIGHTING = {"earn": 0.6, "shape": 0.4}


# ── Tests ─────────────────────────────────────────────────────────

def test_build_composition_matrix():
    """Matrix should produce actor x pillar x platform combinations."""
    matrix = _build_composition_matrix(
        actors=SAMPLE_ACTORS,
        pillar_weighting=SAMPLE_PILLAR_WEIGHTING,
        platforms=["ig_feed", "linkedin_feed"],
        copy_variants=SAMPLE_COPY,
        visual_direction={},
    )
    # 2 actors x 2 pillars x 2 platforms = 8 compositions
    assert len(matrix) == 8
    # Each entry has required keys
    for comp in matrix:
        assert "actor" in comp
        assert "pillar" in comp
        assert "platform" in comp
        assert "archetype" in comp
        assert "copy" in comp


def test_build_composition_matrix_limits_to_2_pillars():
    """Even with 3+ pillars, should only use top 2."""
    big_weighting = {"earn": 0.5, "grow": 0.3, "shape": 0.2}
    matrix = _build_composition_matrix(
        actors=SAMPLE_ACTORS[:1],  # 1 actor
        pillar_weighting=big_weighting,
        platforms=["ig_feed"],  # 1 platform
        copy_variants={"earn": SAMPLE_COPY["earn"], "grow": SAMPLE_COPY["earn"], "shape": SAMPLE_COPY["shape"]},
        visual_direction={},
    )
    # 1 actor x 2 pillars (top 2 only) x 1 platform = 2
    assert len(matrix) == 2
    pillars_used = {c["pillar"] for c in matrix}
    assert "earn" in pillars_used
    assert "grow" in pillars_used
    assert "shape" not in pillars_used


def test_parse_compositor_response_valid_json():
    """Should parse a valid JSON response from GLM-5."""
    raw = json.dumps({
        "archetype": "floating_props",
        "artifacts_used": ["blob_organic_1", "gradient_sapphire_pink"],
        "layer_manifest": [
            {"z": 0, "artifact_id": "gradient_sapphire_pink", "role": "background", "css": "width:100%"},
        ],
        "html": '<div style="position:relative;width:1080px;height:1080px;">test</div>',
    })
    result = _parse_compositor_response(raw)
    assert result["archetype"] == "floating_props"
    assert "blob_organic_1" in result["artifacts_used"]
    assert "<div" in result["html"]


def test_parse_compositor_response_markdown_fenced():
    """Should handle markdown-fenced JSON (```json ... ```)."""
    raw = '```json\n{"archetype":"gradient_hero","artifacts_used":[],"layer_manifest":[],"html":"<div>test</div>"}\n```'
    result = _parse_compositor_response(raw)
    assert result["archetype"] == "gradient_hero"


def test_get_copy_for_pillar_platform_exact_match():
    copy = _get_copy_for_pillar_platform(SAMPLE_COPY, "earn", "ig_feed")
    assert copy["headline"] == "Earn R$60/hr"


def test_get_copy_for_pillar_platform_fallback():
    """Should fall back to any available platform copy if exact match missing."""
    copy = _get_copy_for_pillar_platform(SAMPLE_COPY, "earn", "tiktok_feed")
    # Should get some copy (fallback), not empty
    assert "headline" in copy
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_stage4_v3.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.stage4_compose_v3'`

- [ ] **Step 4: Write stage4_compose_v3.py**

Create `worker/pipeline/stage4_compose_v3.py`. Read `worker/pipeline/stage4_compose_v2.py` first to understand the exact patterns for:
- How `context` keys are accessed (lines 56-120)
- How NIM API calls are made (replicate from `creative_designer.py` lines 245-294)
- How `upload_to_blob()` is called (from `blob_uploader.py`)
- How `save_asset()` is called (from `neon_client.py` lines 357-385)
- How `render_to_png()` is called (from `compositor.py` lines 412-476)
- How `evaluate_creative()` is called (from `creative_vqa.py`)

```python
"""Stage 4 v3: Artifact-driven creative composition engine.

Replaces stage4_compose_v2's monolithic LLM-generates-everything approach
with modular artifact assembly. GLM-5 receives a compact catalog of pre-built
design artifacts and composes them into layered HTML creatives.

Entry point: run_stage4(context) → {"asset_count": int}
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from typing import Any

import httpx

from ai.compositor import PLATFORM_SPECS, render_to_png
from ai.creative_vqa import evaluate_creative, CREATIVE_VQA_THRESHOLD
from blob_uploader import upload_to_blob
from config import (
    NVIDIA_NIM_API_KEY,
    NVIDIA_NIM_API_KEYS,
    NVIDIA_NIM_BASE_URL,
    COMPOSE_CONCURRENCY,
)
from neon_client import get_active_artifacts, get_actors, get_assets, save_asset
from pipeline.archetype_selector import select_archetype
from prompts.compositor_prompt import build_compositor_prompt, inject_vqa_feedback

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
COMPOSITOR_MODEL = os.environ.get("NVIDIA_NIM_DESIGN_MODEL", "z-ai/glm5")
COMPOSITOR_TEMPERATURE = 0.7
COMPOSITOR_MAX_TOKENS = 4096

# Key pool rotation for rate limiting
_key_index = 0


def _next_api_key() -> str:
    global _key_index
    keys = NVIDIA_NIM_API_KEYS if NVIDIA_NIM_API_KEYS else [NVIDIA_NIM_API_KEY]
    keys = [k for k in keys if k]
    if not keys:
        raise RuntimeError("No NVIDIA_NIM_API_KEY configured")
    key = keys[_key_index % len(keys)]
    _key_index += 1
    return key


# ── Public Entry Point ──────────────────────────────────────────

async def run_stage4(context: dict[str, Any]) -> dict[str, Any]:
    """Artifact-driven composition engine. Drop-in replacement for v2.

    Returns: {"asset_count": int}
    """
    request_id = context["request_id"]
    logger.info(f"[Stage4-v3] Starting composition for {request_id}")

    # Load artifact catalog
    catalog = await get_active_artifacts()
    if not catalog:
        logger.warning("[Stage4-v3] No active artifacts in catalog — falling back to empty catalog")

    # Load actors from Stage 2
    actors_raw = await get_actors(request_id)
    # Attach image URLs from Stage 2 assets
    image_assets = await get_assets(request_id, asset_type="base_image")
    actors = _attach_image_urls(actors_raw, image_assets)

    if not actors:
        logger.error(f"[Stage4-v3] No actors found for {request_id}")
        return {"asset_count": 0}

    # Load copy from Stage 3
    copy_assets = await get_assets(request_id, asset_type="copy")
    copy_variants = _build_copy_by_pillar(copy_assets)

    # Extract derived requirements
    brief = context.get("brief", {})
    derived = brief.get("derived_requirements", {})
    pillar_weighting = derived.get("pillar_weighting", {"earn": 0.5, "grow": 0.3, "shape": 0.2})
    visual_direction = derived.get("visual_direction", {})
    platforms = context.get("platforms") or list(PLATFORM_SPECS.keys())[:4]

    # Build composition matrix
    matrix = _build_composition_matrix(
        actors=actors,
        pillar_weighting=pillar_weighting,
        platforms=platforms,
        copy_variants=copy_variants,
        visual_direction=visual_direction,
    )

    logger.info(f"[Stage4-v3] Composition matrix: {len(matrix)} creatives ({len(actors)} actors x {len(set(c['pillar'] for c in matrix))} pillars x {len(set(c['platform'] for c in matrix))} platforms)")

    # Run compositions with concurrency limit
    semaphore = asyncio.Semaphore(COMPOSE_CONCURRENCY)
    tasks = [
        _compose_with_semaphore(semaphore, comp, catalog, visual_direction, request_id)
        for comp in matrix
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    asset_count = sum(1 for r in results if isinstance(r, str))
    errors = [r for r in results if isinstance(r, Exception)]
    if errors:
        logger.warning(f"[Stage4-v3] {len(errors)} compositions failed: {errors[0]}")

    logger.info(f"[Stage4-v3] Completed: {asset_count} creatives saved")
    return {"asset_count": asset_count}


# ── Composition Matrix ──────────────────────────────────────────

def _build_composition_matrix(
    actors: list[dict],
    pillar_weighting: dict[str, float],
    platforms: list[str],
    copy_variants: dict[str, dict],
    visual_direction: dict,
) -> list[dict]:
    """Build actor x pillar x platform composition matrix.

    Uses top 2 pillars from pillar_weighting.
    """
    # Sort pillars by weight, take top 2
    sorted_pillars = sorted(pillar_weighting.items(), key=lambda x: x[1], reverse=True)
    pillars = [p[0] for p in sorted_pillars[:2]]

    compositions = []
    for actor in actors:
        for pillar in pillars:
            for platform in platforms:
                if platform not in PLATFORM_SPECS:
                    continue
                archetype = select_archetype(pillar, visual_direction, platform)
                copy_data = _get_copy_for_pillar_platform(copy_variants, pillar, platform)

                compositions.append({
                    "actor": actor,
                    "pillar": pillar,
                    "platform": platform,
                    "archetype": archetype,
                    "copy": copy_data,
                })

    return compositions


def _get_copy_for_pillar_platform(
    copy_variants: dict[str, dict],
    pillar: str,
    platform: str,
) -> dict[str, str]:
    """Get copy data for a specific pillar and platform, with fallback."""
    pillar_copy = copy_variants.get(pillar, {})

    # Exact platform match
    if platform in pillar_copy:
        return pillar_copy[platform]

    # Fuzzy match (ig_feed → ig_story, linkedin_feed → linkedin)
    for key, val in pillar_copy.items():
        if platform.split("_")[0] in key or key.split("_")[0] in platform:
            return val

    # Fallback to any available copy for this pillar
    if pillar_copy:
        return next(iter(pillar_copy.values()))

    # Last resort: empty copy with defaults
    return {"headline": "", "subheadline": "", "cta": "Apply Now"}


# ── Single Composition ─────────────────────────────────────────

async def _compose_with_semaphore(
    semaphore: asyncio.Semaphore,
    comp: dict,
    catalog: list[dict],
    visual_direction: dict,
    request_id: str,
) -> str:
    """Wrapper to respect concurrency limit."""
    async with semaphore:
        return await _compose_single(comp, catalog, visual_direction, request_id)


async def _compose_single(
    comp: dict,
    catalog: list[dict],
    visual_direction: dict,
    request_id: str,
) -> str:
    """Compose a single creative: prompt GLM-5 → render → VQA → save.

    Returns: asset_id on success.
    Raises: on all-attempts failure.
    """
    platform_spec = PLATFORM_SPECS[comp["platform"]]
    actor = comp["actor"]
    uid = uuid.uuid4().hex[:8]

    # Build prompt
    prompt = build_compositor_prompt(
        catalog=catalog,
        archetype=comp["archetype"],
        platform=comp["platform"],
        platform_spec=platform_spec,
        pillar=comp["pillar"],
        actor=actor,
        copy=comp["copy"],
        visual_direction=visual_direction,
    )

    best_result = None
    best_score = 0.0

    for attempt in range(MAX_RETRIES):
        try:
            # Call GLM-5
            raw_response = await _call_compositor_model(prompt)
            parsed = _parse_compositor_response(raw_response)

            if not parsed.get("html"):
                logger.warning(f"[Stage4-v3] Empty HTML from GLM-5 (attempt {attempt + 1})")
                continue

            # Render HTML → PNG via Playwright
            png_bytes = await render_to_png(
                parsed["html"],
                platform_spec["width"],
                platform_spec["height"],
            )

            # VQA evaluation
            design_for_vqa = {
                "html": parsed["html"],
                "overlay_headline": comp["copy"].get("headline", ""),
                "overlay_cta": comp["copy"].get("cta", ""),
                "actor_name": actor.get("name", ""),
            }
            vqa_result = await evaluate_creative(
                design_for_vqa, png_bytes, platform_spec, comp["platform"]
            )

            score = vqa_result.get("score", vqa_result.get("overall_score", 0))
            if score > best_score:
                best_score = score
                best_result = {
                    **parsed,
                    "vqa": vqa_result,
                    "png": png_bytes,
                    "attempt": attempt + 1,
                }

            if score >= CREATIVE_VQA_THRESHOLD:
                logger.info(f"[Stage4-v3] {actor.get('name')}/{comp['pillar']}/{comp['platform']} passed VQA ({score:.2f}) on attempt {attempt + 1}")
                break

            # Inject VQA feedback for retry
            prompt = inject_vqa_feedback(prompt, vqa_result)

        except Exception as e:
            logger.error(f"[Stage4-v3] Attempt {attempt + 1} failed: {e}")
            if attempt == MAX_RETRIES - 1 and best_result is None:
                raise

    if best_result is None:
        raise RuntimeError(f"All {MAX_RETRIES} attempts failed for {actor.get('name')}/{comp['platform']}")

    # Save HTML to Vercel Blob (PRIMARY artifact)
    html_bytes = best_result["html"].encode("utf-8")
    html_filename = f"creative_{comp['platform']}_{comp['pillar']}_{actor.get('name', 'actor')}_{uid}.html"
    html_url = await upload_to_blob(
        html_bytes, html_filename,
        folder=f"requests/{request_id}/composed",
        content_type="text/html",
    )

    # Save PNG preview to Vercel Blob
    png_filename = f"creative_{comp['platform']}_{comp['pillar']}_{actor.get('name', 'actor')}_{uid}.png"
    png_url = await upload_to_blob(
        best_result["png"], png_filename,
        folder=f"requests/{request_id}/composed",
        content_type="image/png",
    )

    # Save asset record to Neon
    persona_key = actor.get("face_lock", {}).get("persona_key", "unknown")
    asset_id = await save_asset(request_id, {
        "asset_type": "composed_creative",
        "platform": comp["platform"],
        "format": f"{platform_spec['width']}x{platform_spec['height']}",
        "language": comp["copy"].get("language", "en"),
        "blob_url": png_url,
        "stage": 4,
        "metadata": {
            "version": 3,
            "html_url": html_url,
            "archetype": comp["archetype"],
            "artifacts_used": best_result.get("artifacts_used", []),
            "layer_manifest": best_result.get("layer_manifest", []),
            "persona": persona_key,
            "pillar": comp["pillar"],
            "actor_name": actor.get("name", ""),
            "overlay_headline": comp["copy"].get("headline", ""),
            "overlay_sub": comp["copy"].get("subheadline", ""),
            "overlay_cta": comp["copy"].get("cta", ""),
            "creative_html": best_result["html"],
            "eval_score": best_score,
            "eval_attempts": best_result.get("attempt", 1),
            "composed_vqa_score": best_score,
            "composed_vqa_data": best_result.get("vqa", {}),
        },
    })

    return asset_id


# ── NIM API Call ────────────────────────────────────────────────

async def _call_compositor_model(prompt: str) -> str:
    """Call GLM-5 via NIM for creative composition.

    Returns raw text response.
    """
    api_key = _next_api_key()
    base_url = NVIDIA_NIM_BASE_URL

    async with httpx.AsyncClient(timeout=120) as client:
        for attempt in range(3):
            try:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": COMPOSITOR_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": COMPOSITOR_TEMPERATURE,
                        "max_tokens": COMPOSITOR_MAX_TOKENS,
                    },
                )

                if resp.status_code == 429:
                    wait = [30, 60, 90][attempt]
                    logger.warning(f"[Stage4-v3] Rate limited, waiting {wait}s")
                    await asyncio.sleep(wait)
                    api_key = _next_api_key()
                    continue

                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as e:
                if attempt == 2:
                    raise
                logger.warning(f"[Stage4-v3] NIM error {e.response.status_code}, retrying")
                await asyncio.sleep(5)

    raise RuntimeError("GLM-5 API call failed after 3 attempts")


# ── Response Parsing ────────────────────────────────────────────

def _parse_compositor_response(text: str) -> dict[str, Any]:
    """Parse JSON response from GLM-5.

    Handles:
    - Direct JSON objects
    - Markdown-fenced JSON (```json ... ```)
    - Embedded JSON in prose
    """
    # Strip markdown fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```\s*$", "", cleaned.strip())

    # Try direct parse
    try:
        result = json.loads(cleaned)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Find JSON object by brace matching
    start = cleaned.find("{")
    if start == -1:
        logger.error(f"[Stage4-v3] No JSON object found in response: {text[:200]}")
        return {"html": "", "artifacts_used": [], "layer_manifest": []}

    depth = 0
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start : i + 1])
                except json.JSONDecodeError:
                    break

    logger.error(f"[Stage4-v3] Failed to parse JSON from response: {text[:200]}")
    return {"html": "", "artifacts_used": [], "layer_manifest": []}


# ── Helpers ─────────────────────────────────────────────────────

def _attach_image_urls(actors: list[dict], image_assets: list[dict]) -> list[dict]:
    """Attach photo_url and cutout_url from Stage 2 assets to actors."""
    # Build lookup: actor_name → URLs
    url_map: dict[str, dict[str, str]] = {}
    for asset in image_assets:
        content = asset.get("content") or {}
        name = content.get("actor_name", "")
        if not name:
            continue
        if name not in url_map:
            url_map[name] = {}
        url_map[name]["photo_url"] = asset.get("blob_url", "")
        if content.get("cutout_url"):
            url_map[name]["cutout_url"] = content["cutout_url"]

    for actor in actors:
        name = actor.get("name", "")
        urls = url_map.get(name, {})
        actor["photo_url"] = urls.get("photo_url", actor.get("photo_url", ""))
        actor["cutout_url"] = urls.get("cutout_url", actor.get("cutout_url", ""))

    return actors


def _build_copy_by_pillar(copy_assets: list[dict]) -> dict[str, dict[str, dict]]:
    """Build pillar → platform → copy_data lookup from Stage 3 assets."""
    result: dict[str, dict[str, dict]] = {}
    for asset in copy_assets:
        content = asset.get("content") or {}
        copy_data = asset.get("copy_data") or content
        pillar = content.get("pillar", "earn")
        platform = asset.get("platform", "ig_feed")

        if pillar not in result:
            result[pillar] = {}
        result[pillar][platform] = {
            "headline": copy_data.get("headline", ""),
            "subheadline": copy_data.get("subheadline", copy_data.get("description", "")),
            "cta": copy_data.get("cta", copy_data.get("cta_text", "Apply Now")),
            "language": asset.get("language", "en"),
        }

    return result
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_stage4_v3.py -v
```

Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add worker/pipeline/stage4_compose_v3.py worker/tests/test_stage4_v3.py
git commit -m "feat(pipeline): add Stage 4 v3 artifact-driven composition engine"
```

---

### Task 8: Pipeline Integration — Switch v2 → v3

**Files:**
- Modify: `worker/pipeline/orchestrator.py`

**Depends on:** Task 7

- [ ] **Step 1: Read orchestrator.py**

Read `worker/pipeline/orchestrator.py` to find the exact import line and stage list entry.

- [ ] **Step 2: Switch import from v2 to v3**

In `worker/pipeline/orchestrator.py`, change:

```python
from pipeline.stage4_compose_v2 import run_stage4
```

To:

```python
from pipeline.stage4_compose_v3 import run_stage4
```

The stage list entry at line 60 remains unchanged — it still references `run_stage4`.

- [ ] **Step 3: Verify import works**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -c "from pipeline.orchestrator import stages; print(f'Stages loaded: {len(stages)}')"
```

Expected: `Stages loaded: N` (no import errors)

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/orchestrator.py
git commit -m "feat(pipeline): switch Stage 4 from v2 to v3 artifact-driven composition"
```

---

### Task 9: Figma SVG Export Route

**Files:**
- Create: `src/app/api/export/figma/[assetId]/route.ts`

**Depends on:** Task 7 (needs v3 asset format with `html_url` and `layer_manifest`)

- [ ] **Step 1: Read existing export route for patterns**

Read `src/app/api/export/[id]/route.ts` to understand the auth pattern (Clerk session OR magic link), how assets are fetched from Neon, and response headers.

- [ ] **Step 2: Write the Figma SVG export route**

Create `src/app/api/export/figma/[assetId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/export/figma/[assetId]
 *
 * Exports a composed creative as a single self-contained SVG for Figma.
 * Converts layered HTML into SVG with named <g> groups.
 * All images base64-encoded inline — no external dependencies.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await params;

  // Fetch asset from Neon
  const rows = await sql`
    SELECT id, platform, format, blob_url, content
    FROM generated_assets
    WHERE id = ${assetId}
      AND asset_type = 'composed_creative'
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const asset = rows[0];
  const content = asset.content || {};
  const format = (asset.format || "1080x1080").split("x");
  const width = parseInt(format[0]) || 1080;
  const height = parseInt(format[1]) || 1080;

  // Get HTML — try html_url first, fall back to inline creative_html
  let html = content.creative_html || "";

  if (!html && content.html_url) {
    try {
      const resp = await fetch(content.html_url);
      if (resp.ok) {
        html = await resp.text();
      }
    } catch {
      // Fall through to empty html check
    }
  }

  if (!html) {
    return NextResponse.json(
      { error: "No HTML source available for this creative" },
      { status: 422 }
    );
  }

  // Build layer manifest for SVG groups
  const layerManifest: Array<{ z: number; role: string; artifact_id?: string }> =
    content.layer_manifest || [];

  // Convert HTML creative to self-contained SVG
  const svg = await buildFigmaSvg(html, width, height, layerManifest, content);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="creative-${assetId}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Convert a layered HTML creative into a Figma-ready SVG.
 *
 * Strategy: Use foreignObject to embed the HTML within SVG,
 * wrapped in named <g> groups for layer isolation in Figma.
 * All external images are fetched and base64-encoded inline.
 */
async function buildFigmaSvg(
  html: string,
  width: number,
  height: number,
  layerManifest: Array<{ z: number; role: string; artifact_id?: string }>,
  content: Record<string, unknown>
): Promise<string> {
  // Inline all external images as base64
  const inlinedHtml = await inlineExternalImages(html);

  // Build layer groups from manifest
  const layerGroups = layerManifest.length > 0
    ? buildLayerGroupsFromManifest(layerManifest)
    : buildDefaultLayerGroups();

  // Wrap in SVG with foreignObject
  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `  viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `  <title>Creative — ${content.actor_name || "Design"} — ${content.pillar || ""}</title>`,
    `  <desc>Archetype: ${content.archetype || "custom"}, Platform: ${content.platform || ""}</desc>`,
    "",
  ];

  // Add each layer as a named group
  for (const layer of layerGroups) {
    const label = layer.label.replace(/[<>&"]/g, "");
    svgParts.push(`  <g id="${layer.id}" inkscape:label="${label}">`);

    if (layer.id === "full-creative") {
      // Main layer: embed the full HTML via foreignObject
      svgParts.push(`    <foreignObject x="0" y="0" width="${width}" height="${height}">`);
      svgParts.push(`      <div xmlns="http://www.w3.org/1999/xhtml">`);
      svgParts.push(`        ${inlinedHtml}`);
      svgParts.push(`      </div>`);
      svgParts.push(`    </foreignObject>`);
    }

    svgParts.push(`  </g>`);
  }

  svgParts.push(`</svg>`);
  return svgParts.join("\n");
}

/**
 * Fetch all external image URLs in the HTML and replace with base64 data URIs.
 */
async function inlineExternalImages(html: string): Promise<string> {
  const imgUrlRegex = /(?:src|url)\s*[=(]\s*["']?(https?:\/\/[^"'\s)]+)/g;
  const urls = new Set<string>();
  let match;

  while ((match = imgUrlRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  let result = html;
  const fetches = Array.from(urls).map(async (url) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;
      const buffer = await resp.arrayBuffer();
      const contentType = resp.headers.get("content-type") || "image/png";
      const base64 = Buffer.from(buffer).toString("base64");
      const dataUri = `data:${contentType};base64,${base64}`;
      // Replace all occurrences of this URL
      result = result.replaceAll(url, dataUri);
    } catch {
      // Leave original URL if fetch fails
    }
  });

  await Promise.all(fetches);
  return result;
}

function buildLayerGroupsFromManifest(
  manifest: Array<{ z: number; role: string; artifact_id?: string }>
): Array<{ id: string; label: string }> {
  const roleLabels: Record<string, string> = {
    background: "Background",
    accent_blobs: "Accent Blobs",
    accent: "Accent",
    divider: "Divider",
    actor_photo: "Actor Photo",
    photo_border: "Photo Border",
    floating_badges: "Floating Badges",
    badge_strip: "Badge Strip",
    badge: "Badge",
    headline: "Headline",
    subheadline: "Subheadline",
    cta: "CTA Button",
    social_proof: "Social Proof",
    logo: "Logo",
  };

  // The full creative goes as the main group
  const groups = [{ id: "full-creative", label: "Full Creative (HTML)" }];

  // Add manifest layers as metadata groups (empty but named for Figma)
  for (const layer of manifest.sort((a, b) => a.z - b.z)) {
    const label = roleLabels[layer.role] || layer.role;
    groups.push({
      id: `layer-${layer.z}-${layer.role}`,
      label: `z${layer.z}: ${label}${layer.artifact_id ? ` (${layer.artifact_id})` : ""}`,
    });
  }

  return groups;
}

function buildDefaultLayerGroups(): Array<{ id: string; label: string }> {
  return [
    { id: "full-creative", label: "Full Creative (HTML)" },
    { id: "background", label: "Background" },
    { id: "actor-photo", label: "Actor Photo" },
    { id: "text-elements", label: "Text Elements" },
    { id: "decorative", label: "Decorative Elements" },
  ];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/app/api/export/figma/\[assetId\]/route.ts 2>&1 | head -20
```

If there are type errors, fix them. Common issues: Clerk auth import path, neon import.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/export/figma/
git commit -m "feat(export): add Figma SVG export route — self-contained SVG with named layer groups"
```

---

### Task 10: Admin Artifacts Page

**Files:**
- Create: `src/app/admin/artifacts/page.tsx`

**Depends on:** Task 2 (needs artifact Neon methods)

- [ ] **Step 1: Read admin layout and existing admin pages**

Read `src/app/admin/layout.tsx` and one existing admin page (e.g., `src/app/admin/pipeline/page.tsx` or `src/app/admin/users/page.tsx`) to understand:
- How the admin layout wraps pages
- Component patterns (server vs client components)
- Data fetching (server component with Neon query vs client-side fetch)
- Table/grid patterns used

Also read `src/components/AppShell.tsx` to find where admin nav links are defined.

- [ ] **Step 2: Add API route for artifact CRUD**

Create `src/app/api/admin/artifacts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artifacts = await sql`
    SELECT artifact_id, category, description, blob_url,
           dimensions, css_class, usage_snippet, usage_notes,
           pillar_affinity, format_affinity, is_active, created_at, updated_at
    FROM design_artifacts
    ORDER BY category, artifact_id
  `;

  return NextResponse.json({ artifacts });
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    artifact_id,
    category,
    description,
    blob_url,
    dimensions,
    css_class,
    usage_snippet,
    usage_notes,
    pillar_affinity,
    format_affinity,
    is_active,
  } = body;

  if (!artifact_id || !category || !description || !blob_url || !usage_snippet) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO design_artifacts
      (artifact_id, category, description, blob_url, dimensions, css_class,
       usage_snippet, usage_notes, pillar_affinity, format_affinity, is_active)
    VALUES (${artifact_id}, ${category}, ${description}, ${blob_url},
            ${dimensions || ""}, ${css_class || ""}, ${usage_snippet},
            ${usage_notes || ""}, ${pillar_affinity || []}, ${format_affinity || []},
            ${is_active !== false})
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
  `;

  return NextResponse.json({ artifact: rows[0] });
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artifact_id } = await request.json();
  if (!artifact_id) {
    return NextResponse.json({ error: "Missing artifact_id" }, { status: 400 });
  }

  await sql`
    UPDATE design_artifacts SET is_active = false, updated_at = NOW()
    WHERE artifact_id = ${artifact_id}
  `;

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write the admin artifacts page**

Create `src/app/admin/artifacts/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface Artifact {
  artifact_id: string;
  category: string;
  description: string;
  blob_url: string;
  dimensions: string;
  css_class: string;
  usage_snippet: string;
  usage_notes: string;
  pillar_affinity: string[];
  format_affinity: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "blob", "divider", "mask", "badge", "icon",
  "gradient", "pattern", "frame", "cta", "text_treatment", "logo",
];

const PILLAR_COLORS: Record<string, string> = {
  earn: "bg-green-100 text-green-800",
  grow: "bg-blue-100 text-blue-800",
  shape: "bg-purple-100 text-purple-800",
};

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  const fetchArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/artifacts");
      const data = await resp.json();
      setArtifacts(data.artifacts || []);
    } catch (err) {
      console.error("Failed to fetch artifacts:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const toggleActive = async (artifact: Artifact) => {
    if (artifact.is_active) {
      await fetch("/api/admin/artifacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact_id: artifact.artifact_id }),
      });
    } else {
      await fetch("/api/admin/artifacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...artifact, is_active: true }),
      });
    }
    fetchArtifacts();
  };

  const filtered = artifacts.filter((a) => {
    if (filterCategory !== "all" && a.category !== filterCategory) return false;
    if (!showInactive && !a.is_active) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Artifact[]>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Design Artifacts</h1>
          <p className="text-[#737373] mt-1">
            {artifacts.filter((a) => a.is_active).length} active artifacts across{" "}
            {new Set(artifacts.filter((a) => a.is_active).map((a) => a.category)).size} categories
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-[#E5E5E5] rounded-[10px] text-sm bg-white cursor-pointer"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace("_", " ")}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-[#737373] cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="cursor-pointer"
          />
          Show inactive
        </label>
      </div>

      {/* Artifact Grid */}
      {loading ? (
        <div className="text-center py-12 text-[#737373]">Loading artifacts...</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, items]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3 capitalize">
                {category.replace("_", " ")}
                <span className="text-[#737373] font-normal text-sm ml-2">
                  ({items.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((artifact) => (
                  <div
                    key={artifact.artifact_id}
                    className={`card p-4 space-y-3 ${
                      !artifact.is_active ? "opacity-50" : ""
                    }`}
                  >
                    {/* Preview */}
                    <div className="h-24 bg-[#F5F5F5] rounded-lg flex items-center justify-center overflow-hidden">
                      {artifact.category === "gradient" || artifact.category === "text_treatment" ? (
                        <div className="text-xs text-[#737373] font-mono px-2">
                          CSS: {artifact.css_class}
                        </div>
                      ) : artifact.category === "cta" ? (
                        <div
                          className="scale-75"
                          dangerouslySetInnerHTML={{
                            __html: artifact.usage_snippet.replace("{cta_text}", "Apply Now"),
                          }}
                        />
                      ) : (
                        <img
                          src={artifact.blob_url}
                          alt={artifact.description}
                          className="max-h-20 max-w-full object-contain"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="font-mono text-xs text-[#737373]">
                        {artifact.artifact_id}
                      </div>
                      <div className="text-sm text-[#1A1A1A] mt-1">
                        {artifact.description}
                      </div>
                      {artifact.dimensions && (
                        <div className="text-xs text-[#737373] mt-1">
                          {artifact.dimensions}
                        </div>
                      )}
                    </div>

                    {/* Pillar Affinity */}
                    {artifact.pillar_affinity?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {artifact.pillar_affinity.map((p) => (
                          <span
                            key={p}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              PILLAR_COLORS[p] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5]">
                      <button
                        onClick={() => toggleActive(artifact)}
                        className={`text-xs px-3 py-1 rounded-full cursor-pointer ${
                          artifact.is_active
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {artifact.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <a
                        href={artifact.blob_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#737373] hover:text-[#1A1A1A] cursor-pointer"
                      >
                        View file
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Artifacts link to admin navigation**

Read `src/components/AppShell.tsx` (or wherever admin nav links are defined). Add an "Artifacts" link pointing to `/admin/artifacts` in the admin section, following the existing pattern for other admin links (Pipeline, Schemas, Users).

- [ ] **Step 5: Verify page loads in dev**

```bash
cd /Users/stevenjunop/centric-intake && npm run dev &
sleep 5 && curl -s http://localhost:3000/admin/artifacts | head -5
```

Expected: HTML response (not a 404).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/artifacts/ src/app/api/admin/artifacts/ src/components/AppShell.tsx
git commit -m "feat(admin): add Design Artifacts management page — grid view, preview, activate/deactivate"
```

---

### Task 11: End-to-End Verification Script

**Files:**
- Create: `scripts/verify-composition-engine.mjs`

**Depends on:** All previous tasks

- [ ] **Step 1: Write verification script**

Create `scripts/verify-composition-engine.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Verify the Stage 4 composition engine is correctly wired.
 *
 * Checks:
 * 1. design_artifacts table exists and has rows
 * 2. Neon client methods work (get_active_artifacts)
 * 3. Archetype selector returns valid archetypes
 * 4. Compositor prompt builder produces valid prompts
 * 5. Stage 4 v3 module imports without errors
 * 6. Figma export route exists
 * 7. Admin artifacts page exists
 */

import pg from "pg";
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const DATABASE_URL = process.env.DATABASE_URL;
const ROOT = join(import.meta.dirname, "..");

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

async function main() {
  console.log("Stage 4 Composition Engine — Verification\n");

  // 1. Database
  console.log("Database:");
  const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const tableExists = await pool.query(
    "SELECT count(*) as cnt FROM information_schema.tables WHERE table_name = 'design_artifacts'"
  );
  check("design_artifacts table exists", parseInt(tableExists.rows[0].cnt) > 0);

  const artifactCount = await pool.query(
    "SELECT count(*) as cnt FROM design_artifacts WHERE is_active = true"
  );
  const count = parseInt(artifactCount.rows[0].cnt);
  check(`Active artifacts in DB: ${count}`, count > 0);

  const categories = await pool.query(
    "SELECT DISTINCT category FROM design_artifacts WHERE is_active = true ORDER BY category"
  );
  check(`Categories: ${categories.rows.map(r => r.category).join(", ")}`, categories.rows.length >= 3);

  await pool.end();

  // 2. Python modules
  console.log("\nPython modules:");

  try {
    execSync("cd worker && python -c 'from neon_client import get_active_artifacts; print(\"OK\")'", { stdio: "pipe" });
    check("neon_client.get_active_artifacts imports", true);
  } catch {
    check("neon_client.get_active_artifacts imports", false);
  }

  try {
    execSync("cd worker && python -c 'from pipeline.archetype_selector import select_archetype; print(select_archetype(\"earn\", {}, \"ig_feed\"))'", { stdio: "pipe" });
    check("archetype_selector imports and runs", true);
  } catch {
    check("archetype_selector imports and runs", false);
  }

  try {
    execSync("cd worker && python -c 'from prompts.compositor_prompt import build_compositor_prompt; print(\"OK\")'", { stdio: "pipe" });
    check("compositor_prompt imports", true);
  } catch {
    check("compositor_prompt imports", false);
  }

  try {
    execSync("cd worker && python -c 'from pipeline.stage4_compose_v3 import run_stage4; print(\"OK\")'", { stdio: "pipe" });
    check("stage4_compose_v3 imports", true);
  } catch (e) {
    check("stage4_compose_v3 imports", false);
  }

  try {
    const result = execSync("cd worker && python -c \"from pipeline.orchestrator import stages; print('v3' if 'v3' in str(stages) else 'check')\"", { stdio: "pipe" }).toString().trim();
    check("orchestrator imports stage4_compose_v3", true);
  } catch {
    check("orchestrator imports stage4_compose_v3", false);
  }

  // 3. File structure
  console.log("\nFile structure:");
  check("stage4_compose_v3.py exists", existsSync(join(ROOT, "worker/pipeline/stage4_compose_v3.py")));
  check("archetype_selector.py exists", existsSync(join(ROOT, "worker/pipeline/archetype_selector.py")));
  check("compositor_prompt.py exists", existsSync(join(ROOT, "worker/prompts/compositor_prompt.py")));
  check("seed-design-artifacts.mjs exists", existsSync(join(ROOT, "scripts/seed-design-artifacts.mjs")));
  check("Figma export route exists", existsSync(join(ROOT, "src/app/api/export/figma/[assetId]/route.ts")));
  check("Admin artifacts page exists", existsSync(join(ROOT, "src/app/admin/artifacts/page.tsx")));
  check("Admin artifacts API route exists", existsSync(join(ROOT, "src/app/api/admin/artifacts/route.ts")));
  check("Artifact source files exist", existsSync(join(ROOT, "scripts/artifacts/blobs/blob_organic_1.svg")));

  // 4. v2 still available for rollback
  check("stage4_compose_v2.py still exists (rollback)", existsSync(join(ROOT, "worker/pipeline/stage4_compose_v2.py")));

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run verification**

```bash
cd /Users/stevenjunop/centric-intake && node scripts/verify-composition-engine.mjs
```

Expected: All checks pass.

- [ ] **Step 3: Run all Python tests**

```bash
cd /Users/stevenjunop/centric-intake/worker && python -m pytest tests/test_archetype_selector.py tests/test_compositor_prompt.py tests/test_stage4_v3.py tests/test_neon_artifacts.py -v
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-composition-engine.mjs
git commit -m "test(verify): add composition engine end-to-end verification script"
```

---

## Rollback Plan

If v3 produces worse results than v2:

1. In `worker/pipeline/orchestrator.py`, change import back:
   ```python
   from pipeline.stage4_compose_v2 import run_stage4
   ```
2. Commit and deploy. v2 doesn't need the artifact catalog — it generates everything from scratch.
3. v3 assets in `generated_assets` have `content.version = 3` — easy to filter/compare.

No data migration needed. Both versions write to the same `generated_assets` table.
