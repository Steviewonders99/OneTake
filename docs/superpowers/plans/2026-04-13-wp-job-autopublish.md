# WordPress Job Auto-Publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a recruiter submits an intake form, auto-publish the job description to WordPress as a `job` custom post type — with proper taxonomies, CPT meta fields, and auto-generated UTM tracked links — before any AI generation starts.

**Architecture:** A WP MCP client adapted from VYRA spawns `mcp-wordpress-remote` via stdio, calls `create_page` with the job content. The content is structured by Qwen 3.5 from intake form data, with hard facts injected verbatim. Published URL is captured and stored in `campaign_landing_pages.job_posting_url`. UTM tracked links are auto-created. This runs as Step 0 of Stage 1, before persona generation.

**Tech Stack:** Python 3.13, MCP Python SDK (`mcp`), `mcp-wordpress-remote` npm package, NVIDIA NIM (Qwen 3.5), Neon Postgres.

---

## File Structure

| File | Responsibility |
|---|---|
| `worker/wp_mcp_client.py` | Adapted MCP client for WordPress — spawns MCP server, manages session, exposes `create_job_post()`. Standalone, no VYRA dependencies. |
| `worker/prompts/job_description_copy.py` | Qwen 3.5 prompt for structuring JD into sections (Description, Purpose, Requirements, etc). Hard facts injected, AI formats only. |
| `worker/pipeline/wp_job_publisher.py` | Orchestrator — builds content, calls WP MCP, captures URL, upserts landing page, creates tracked links. |
| `worker/config.py` | MODIFY — add `WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` env vars. |
| `worker/neon_client.py` | MODIFY — add `upsert_campaign_landing_page()` helper. |
| `worker/pipeline/stage1_intelligence.py` | MODIFY — call WP publisher at start of `run_stage1()`. |

---

### Task 1: Config — WP Environment Variables

**Files:**
- Modify: `worker/config.py`

- [ ] **Step 1: Add WP config vars**

Add after the existing Vercel Blob section in `worker/config.py`:

```python
# ---------------------------------------------------------------------------
# WordPress (MCP auto-publish)
# ---------------------------------------------------------------------------
WP_SITE_URL = os.environ.get("WP_SITE_URL", "")
WP_USERNAME = os.environ.get("WP_USERNAME", "")
WP_APP_PASSWORD = os.environ.get("WP_APP_PASSWORD", "")
```

- [ ] **Step 2: Add to .env**

Add to the worker `.env` file:

```
WP_SITE_URL=https://www.oneforma.com
WP_USERNAME=nova-bot
WP_APP_PASSWORD=
```

(App password left empty until generated in WP admin)

- [ ] **Step 3: Commit**

```bash
git add worker/config.py
git commit -m "feat(wp): add WordPress MCP config environment variables"
```

---

### Task 2: WordPress MCP Client

Adapted from VYRA's `WordPressMCPClient` — stripped of VYRA-specific imports, standalone for Nova.

**Files:**
- Create: `worker/wp_mcp_client.py`

- [ ] **Step 1: Install MCP SDK**

```bash
cd worker && pip3 install mcp
```

- [ ] **Step 2: Create the client**

```python
"""WordPress MCP client for Nova — auto-publish job posts.

Adapted from VYRA's WordPressMCPClient. Spawns `mcp-wordpress-remote`
via stdio, manages the MCP session, and exposes high-level methods
for creating job posts with taxonomies and custom meta fields.

Requires: pip install mcp
Requires: npx -y mcp-wordpress-remote (auto-installed on first use)
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from config import WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD

logger = logging.getLogger(__name__)


def _parse_mcp_result(result: Any) -> dict:
    """Extract JSON from an MCP tool call result."""
    if hasattr(result, "content") and result.content:
        for block in result.content:
            if hasattr(block, "text"):
                try:
                    return json.loads(block.text)
                except json.JSONDecodeError:
                    return {"raw": block.text}
    return {}


class WordPressMCPClient:
    """Async context manager wrapping the WordPress MCP server.

    Usage:
        async with WordPressMCPClient() as wp:
            result = await wp.create_job_post(title="...", content="...", ...)
    """

    def __init__(
        self,
        site_url: str = "",
        username: str = "",
        app_password: str = "",
    ) -> None:
        self.command = "npx"
        self.args = ["-y", "mcp-wordpress-remote"]
        self.extra_env: dict[str, str] = {}

        url = site_url or WP_SITE_URL
        user = username or WP_USERNAME
        pwd = app_password or WP_APP_PASSWORD

        if url:
            self.extra_env["WORDPRESS_SITE_URL"] = url
            self.extra_env["WPMCP_SITE_URL"] = url
        if user:
            self.extra_env["WORDPRESS_USERNAME"] = user
            self.extra_env["WPMCP_USERNAME"] = user
        if pwd:
            self.extra_env["WORDPRESS_APP_PASSWORD"] = pwd

        self._session: Any = None
        self._stdio_ctx: Any = None
        self._session_ctx: Any = None

    async def __aenter__(self) -> "WordPressMCPClient":
        from mcp import ClientSession
        from mcp.client.stdio import StdioServerParameters, stdio_client

        env = dict(os.environ)
        env.update(self.extra_env)

        server_params = StdioServerParameters(
            command=self.command,
            args=self.args,
            env=env,
        )

        self._stdio_ctx = stdio_client(server_params)
        stdio_transport = await self._stdio_ctx.__aenter__()
        read_stream, write_stream = stdio_transport
        self._session_ctx = ClientSession(read_stream, write_stream)
        self._session = await self._session_ctx.__aenter__()
        await self._session.initialize()
        logger.info("WordPress MCP session initialized")
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._session_ctx:
            await self._session_ctx.__aexit__(exc_type, exc_val, exc_tb)
        if self._stdio_ctx:
            await self._stdio_ctx.__aexit__(exc_type, exc_val, exc_tb)
        self._session = None

    async def _call_tool(self, tool_name: str, arguments: dict) -> dict:
        """Call an MCP tool and return parsed JSON."""
        if not self._session:
            raise RuntimeError("MCP session not initialized — use 'async with'")
        result = await self._session.call_tool(tool_name, arguments)
        return _parse_mcp_result(result)

    async def create_job_post(
        self,
        title: str,
        content: str,
        status: str = "publish",
        slug: Optional[str] = None,
        meta: Optional[dict] = None,
        job_types: Optional[list[str]] = None,
        job_tags: Optional[list[str]] = None,
    ) -> dict:
        """Create a WordPress job post with taxonomies and meta.

        Returns dict with at least {"id": int, "link": str}.
        """
        args: dict[str, Any] = {
            "title": title,
            "content": content,
            "status": status,
            "post_type": "job",
        }
        if slug:
            args["slug"] = slug
        if meta:
            args["meta"] = meta
        if job_types:
            args["job_types"] = job_types
        if job_tags:
            args["job_tags"] = job_tags

        result = await self._call_tool("create_page", args)
        wp_id = result.get("id") or result.get("page_id")
        wp_url = result.get("link") or result.get("url", "")
        logger.info("WP job post created: id=%s url=%s", wp_id, wp_url)
        return result
```

- [ ] **Step 3: Verify import**

```bash
cd worker && python3 -c "from wp_mcp_client import WordPressMCPClient; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add worker/wp_mcp_client.py
git commit -m "feat(wp): add WordPress MCP client adapted from VYRA"
```

---

### Task 3: JD Copy Prompt

Qwen 3.5 structures the JD into clean WordPress content. Hard facts injected, AI only formats.

**Files:**
- Create: `worker/prompts/job_description_copy.py`

- [ ] **Step 1: Create the prompt**

```python
"""Job description copy prompt — Qwen 3.5.

Structures raw intake form data into a clean WordPress job post
with proper sections. Hard facts (qualifications, compensation,
location, work mode) are injected verbatim — the AI formats and
adds a Purpose section, but NEVER rewrites factual content.
"""
from __future__ import annotations

from typing import Any


JD_SYSTEM_PROMPT = """\
You are a recruitment content specialist for OneForma, a global data \
annotation and AI training platform. Your job is to structure raw job \
description data into a clean, professional WordPress post.

RULES:
- The Description section should be clear, professional, 2-3 paragraphs
- The Purpose section should explain WHY this work matters (2-3 sentences)
- NEVER change qualification requirements — format them as a clean bullet list
- NEVER invent or change compensation amounts
- NEVER add locations or languages not in the source data
- Keep the tone professional but approachable
- Use plain HTML (h2, p, ul/li) — no custom CSS, no divs

OUTPUT: Valid JSON with the exact keys specified.
"""


def build_jd_content_prompt(form_data: dict[str, Any], request: dict[str, Any]) -> str:
    """Build the user prompt for JD content structuring."""
    title = request.get("title", form_data.get("title", "Untitled"))
    task_description = form_data.get("task_description", "")
    qualifications_required = form_data.get("qualifications_required", "")
    qualifications_preferred = form_data.get("qualifications_preferred", "")
    compensation_rate = form_data.get("compensation_rate", "")
    compensation_model = form_data.get("compensation_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location_scope = form_data.get("location_scope", "")
    engagement_model = form_data.get("engagement_model", "")
    language_requirements = form_data.get("language_requirements", "")

    comp_display = ""
    if compensation_rate:
        comp_display = f"${compensation_rate}"
        if compensation_model:
            comp_display += f" ({compensation_model})"

    return f"""\
Structure this job description into a clean WordPress post.

TITLE: {title}

RAW TASK DESCRIPTION:
{task_description}

QUALIFICATIONS REQUIRED (list EXACTLY as written):
{qualifications_required or "(none specified)"}

QUALIFICATIONS PREFERRED:
{qualifications_preferred or "(none)"}

COMPENSATION: {comp_display or "(see details)"}
WORK MODE: {work_mode}
LOCATION: {location_scope or "Worldwide"}
TIME COMMITMENT: {engagement_model or "Flexible"}
LANGUAGE REQUIREMENTS: {language_requirements or "English"}

OUTPUT — valid JSON:
{{
  "description_html": "<h2>Description:</h2><p>2-3 paragraphs describing the role clearly...</p>",
  "purpose_html": "<h2>Purpose:</h2><p>2-3 sentences on WHY this work matters for AI...</p>",
  "requirements_html": "<h2>Main Requirements:</h2><ul><li>requirement 1</li>...</ul>",
  "preferred_html": "<h2>Preferred Qualifications:</h2><ul><li>preferred 1</li>...</ul>",
  "compensation_html": "<h2>Compensation:</h2><p>{comp_display or 'Details provided during application.'}</p>",
  "details_html": "<h2>Details:</h2><ul><li>Work Mode: {work_mode}</li><li>Location: {location_scope or 'Worldwide'}</li><li>Time: {engagement_model or 'Flexible'}</li><li>Language: {language_requirements or 'English'}</li></ul>",
  "seo_title": "SEO-optimized page title (under 60 chars)",
  "seo_description": "Meta description (under 160 chars)"
}}
"""
```

- [ ] **Step 2: Verify**

```bash
cd worker && python3 -c "from prompts.job_description_copy import JD_SYSTEM_PROMPT, build_jd_content_prompt; print('OK:', len(JD_SYSTEM_PROMPT), 'chars')"
```

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/job_description_copy.py
git commit -m "feat(wp): add JD copy structuring prompt for Qwen 3.5"
```

---

### Task 4: Neon Client — Landing Page Upsert

Add a helper to upsert the `campaign_landing_pages` row with the WP URL.

**Files:**
- Modify: `worker/neon_client.py`

- [ ] **Step 1: Add the upsert function**

Add at the end of `worker/neon_client.py`, before any trailing helper functions:

```python
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
    logger.info("Upserted campaign_landing_pages.%s = %s for %s", field, value[:60], request_id)
```

- [ ] **Step 2: Verify**

```bash
cd worker && python3 -c "from neon_client import upsert_campaign_landing_page; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add worker/neon_client.py
git commit -m "feat(wp): add upsert_campaign_landing_page helper to neon_client"
```

---

### Task 5: WP Job Publisher — The Orchestrator

Ties everything together: builds content, calls WP MCP, captures URL, upserts DB, creates tracked links.

**Files:**
- Create: `worker/pipeline/wp_job_publisher.py`

- [ ] **Step 1: Create the publisher**

```python
"""WordPress job auto-publisher — Step 0 of Stage 1.

When a recruiter submits an intake form, this module:
1. Structures the JD via Qwen 3.5 (AI formats, hard facts injected)
2. Publishes to WordPress as a 'job' custom post type
3. Sets Job Types + Job Tags taxonomies
4. Sets CPT meta fields (Apply Job repeater with per-language rows)
5. Captures the live URL → upserts campaign_landing_pages.job_posting_url
6. Auto-creates UTM tracked links for the recruiter
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from ai.local_llm import generate_text
from neon_client import upsert_campaign_landing_page, _get_pool
from prompts.job_description_copy import JD_SYSTEM_PROMPT, build_jd_content_prompt

logger = logging.getLogger(__name__)

# ── Taxonomy mappings ─────────────────────────────────────────────────

TASK_TYPE_TO_JOB_TYPE: dict[str, str] = {
    "annotation": "Annotation",
    "data_collection": "Data Collection",
    "transcription": "Transcription",
    "translation": "Translation",
    "judging": "Judging",
    "llm_prompt_authoring": "LLM Prompt Authoring",
}

COMPENSATION_TO_TAG: dict[str, str] = {
    "per_hour": "Fixed Rate Per Hour",
    "per_asset": "Fixed Rate Per Approved Asset",
    "per_completion": "Fixed Rate Upon Completion",
    "per_word": "Fixed Rate Per Source Word",
    "hourly": "Fixed Rate Per Hour",
    "per_task": "Fixed Rate Upon Completion",
}

# ── Region display names ──────────────────────────────────────────────

REGION_DISPLAY: dict[str, str] = {
    "US": "US", "GB": "UK", "CA": "Canada", "AU": "Australia",
    "BR": "Brazil", "MX": "Mexico", "DE": "Germany", "FR": "France",
    "JP": "Japan", "KR": "South Korea", "IN": "India", "SG": "Singapore",
    "PH": "Philippines", "ID": "Indonesia", "MA": "Morocco",
    "EG": "Egypt", "SA": "Saudi Arabia", "AE": "UAE", "NG": "Nigeria",
    "ZA": "South Africa", "TR": "Turkey", "PL": "Poland", "NL": "Netherlands",
}


async def publish_job_to_wordpress(
    request_id: str,
    request: dict[str, Any],
    form_data: dict[str, Any],
    target_languages: list[str],
    target_regions: list[str],
) -> dict[str, Any]:
    """Publish JD to WordPress and return the live URL.

    Returns dict with 'wp_url', 'wp_post_id', and 'tracked_links'.
    """
    title = request.get("title", form_data.get("title", "Untitled"))
    task_type = request.get("task_type", "data_collection")

    # ── 1. Structure JD content via Qwen 3.5 ──
    logger.info("Structuring JD content for WP: %s", title)
    jd_prompt = build_jd_content_prompt(form_data, request)
    raw_response = await generate_text(
        JD_SYSTEM_PROMPT,
        jd_prompt,
        thinking=False,
        max_tokens=2048,
        temperature=0.5,
    )
    jd_data = _parse_json(raw_response)

    # Assemble full HTML content
    html_sections = [
        jd_data.get("description_html", ""),
        jd_data.get("purpose_html", ""),
        jd_data.get("requirements_html", ""),
    ]
    if jd_data.get("preferred_html"):
        html_sections.append(jd_data["preferred_html"])
    html_sections.append(jd_data.get("compensation_html", ""))
    html_sections.append(jd_data.get("details_html", ""))

    content = "\n\n".join(s for s in html_sections if s)

    # ── 2. Build taxonomy terms ──
    job_type = TASK_TYPE_TO_JOB_TYPE.get(task_type, "Data Collection")

    comp_model = form_data.get("compensation_model", "")
    job_tags = []
    if comp_model:
        tag = COMPENSATION_TO_TAG.get(comp_model.lower().replace(" ", "_"))
        if tag:
            job_tags.append(tag)

    if not target_regions or len(target_regions) > 10:
        job_tags.append("Worldwide")
    else:
        for region in target_regions:
            display = REGION_DISPLAY.get(region, region)
            job_tags.append(display)

    # ── 3. Build CPT meta — Apply Job repeater ──
    # Get existing apply URL if set
    apply_url = await _get_apply_url(request_id)

    apply_rows = []
    languages = target_languages if target_languages else ["English"]
    for lang in languages:
        apply_rows.append({
            "language": lang,
            "apply_url": apply_url,
        })

    apply_title = (
        f"This role is available in {languages[0]}"
        if len(languages) == 1
        else "This role is available in multiple languages"
    )

    meta = {
        "apply_job_title": apply_title,
        "apply_job_description": "Select the one most relevant to you.",
        "apply_job": apply_rows,
    }

    # ── 4. Publish to WordPress ──
    slug = _slugify(title)

    from config import WP_SITE_URL
    if not WP_SITE_URL:
        logger.warning("WP_SITE_URL not set — skipping WordPress publish")
        return {"wp_url": "", "wp_post_id": None, "tracked_links": []}

    try:
        from wp_mcp_client import WordPressMCPClient

        async with WordPressMCPClient() as wp:
            result = await wp.create_job_post(
                title=title,
                content=content,
                status="publish",
                slug=slug,
                meta=meta,
                job_types=[job_type],
                job_tags=job_tags,
            )

        wp_url = result.get("link") or result.get("url", "")
        wp_post_id = result.get("id") or result.get("page_id")
        logger.info("✓ WP job published: %s → %s", title, wp_url)

    except Exception as exc:
        logger.error("WordPress publish failed (non-fatal): %s", exc)
        return {"wp_url": "", "wp_post_id": None, "tracked_links": []}

    # ── 5. Upsert campaign_landing_pages.job_posting_url ──
    if wp_url:
        await upsert_campaign_landing_page(request_id, "job_posting_url", wp_url)

    # ── 6. Auto-create UTM tracked links ──
    tracked = []
    if wp_url:
        campaign_slug = slug
        utm_configs = [
            ("organic", "job_board", campaign_slug),
            ("social", "linkedin", campaign_slug),
            ("email", "outreach", campaign_slug),
        ]
        pool = await _get_pool()
        async with pool.acquire() as conn:
            for source, medium, campaign in utm_configs:
                utm_url = (
                    f"{wp_url}?utm_source={source}"
                    f"&utm_medium={medium}"
                    f"&utm_campaign={campaign}"
                )
                await conn.execute(
                    """
                    INSERT INTO tracked_links (id, request_id, base_url, utm_source, utm_medium, utm_campaign, short_code, created_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
                    ON CONFLICT DO NOTHING
                    """,
                    request_id, wp_url, source, medium, campaign,
                    f"{campaign[:20]}-{source[:3]}",
                )
                tracked.append(utm_url)
        logger.info("Created %d UTM tracked links for %s", len(tracked), wp_url)

    return {
        "wp_url": wp_url,
        "wp_post_id": wp_post_id,
        "tracked_links": tracked,
    }


async def _get_apply_url(request_id: str) -> str:
    """Fetch existing apply URL from campaign_landing_pages."""
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT ada_form_url, job_posting_url, landing_page_url "
                "FROM campaign_landing_pages WHERE request_id = $1",
                request_id,
            )
        if row:
            return (
                row.get("ada_form_url")
                or row.get("job_posting_url")
                or row.get("landing_page_url")
                or "#apply"
            )
    except Exception:
        pass
    return "#apply"


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:80]


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output."""
    if not text:
        return {}
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1]
    if "```" in cleaned:
        cleaned = cleaned.split("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except (ValueError, TypeError):
        logger.warning("Failed to parse JD JSON (%d chars)", len(cleaned))
        return {}
```

- [ ] **Step 2: Verify import**

```bash
cd worker && python3 -c "from pipeline.wp_job_publisher import publish_job_to_wordpress; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/wp_job_publisher.py
git commit -m "feat(wp): add WP job publisher — content build, publish, URL capture, UTM links"
```

---

### Task 6: Wire into Stage 1

Call the WP publisher at the very start of `run_stage1()` — Step 0, before cultural research.

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Add import**

At the top of `stage1_intelligence.py`, add:

```python
from pipeline.wp_job_publisher import publish_job_to_wordpress
```

- [ ] **Step 2: Add Step 0 call**

In `run_stage1()`, right after extracting `form_data` and `task_type` (around line 96-97), add the WP publish call BEFORE the cultural research step:

```python
    # ==================================================================
    # STEP 0: WORDPRESS JOB PUBLISH (before any AI generation)
    # Publish the JD to WordPress immediately so the job posting URL
    # is live while the pipeline generates everything else.
    # ==================================================================
    logger.info("Step 0: Publishing JD to WordPress...")
    wp_result = await publish_job_to_wordpress(
        request_id=request_id,
        request=request,
        form_data=form_data,
        target_languages=target_languages,
        target_regions=target_regions,
    )
    if wp_result.get("wp_url"):
        context["wp_job_url"] = wp_result["wp_url"]
        context["wp_post_id"] = wp_result["wp_post_id"]
        logger.info("✓ WP job live: %s", wp_result["wp_url"])
    else:
        logger.info("WP publish skipped (no credentials or non-fatal error)")
```

Insert this block between the form_data extraction and the existing `# STEP 1: CULTURAL RESEARCH` comment.

- [ ] **Step 3: Verify no import errors**

```bash
cd worker && python3 -c "from pipeline.stage1_intelligence import run_stage1; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "feat(wp): wire WP job publish into Stage 1 as Step 0"
```

---

### Task 7: Smoke Test

Test the full flow manually — verify JD publishes to WP, URL is captured, tracked links created.

- [ ] **Step 1: Set WP credentials in .env**

Add real credentials to `worker/.env`:
```
WP_SITE_URL=https://www.oneforma.com
WP_USERNAME=nova-bot
WP_APP_PASSWORD=<generate in WP admin>
```

- [ ] **Step 2: Test WP MCP connection**

```bash
cd worker && python3 -c "
import asyncio
from wp_mcp_client import WordPressMCPClient

async def test():
    async with WordPressMCPClient() as wp:
        tools = await wp._session.list_tools()
        print('Available tools:', [t.name for t in tools.tools])

asyncio.run(test())
"
```

Expected: List of available MCP tools including `create_page`

- [ ] **Step 3: Test JD content generation**

```bash
cd worker && python3 -c "
import asyncio
from ai.local_llm import generate_text
from prompts.job_description_copy import JD_SYSTEM_PROMPT, build_jd_content_prompt

async def test():
    prompt = build_jd_content_prompt(
        {'task_description': 'Review images of Finnish handwriting...', 'qualifications_required': 'Fluency in Finnish\nAttention to detail', 'compensation_rate': '15', 'compensation_model': 'per_hour', 'work_mode': 'remote'},
        {'title': 'Onyx OCR Annotation (Finnish)', 'task_type': 'annotation'},
    )
    result = await generate_text(JD_SYSTEM_PROMPT, prompt, thinking=False, max_tokens=2048)
    print(result[:500])

asyncio.run(test())
"
```

- [ ] **Step 4: Test full publish (draft mode)**

Temporarily change `status="draft"` in `wp_job_publisher.py` to test without publishing live, then run Stage 1 on an existing campaign.

- [ ] **Step 5: Verify in WP admin**

Open WordPress admin → Jobs → verify the draft post was created with:
- Correct title
- Structured content (Description, Purpose, Requirements sections)
- Job Type taxonomy set
- Job Tags set
- CPT meta Apply Job repeater filled

- [ ] **Step 6: Switch to publish mode and commit**

Change back to `status="publish"` and commit any fixes:

```bash
git add -A
git commit -m "fix(wp): smoke test fixes for WordPress job auto-publish"
```
