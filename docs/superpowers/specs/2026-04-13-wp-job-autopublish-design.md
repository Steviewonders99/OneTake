# WordPress Job Description Auto-Publish — Design Spec

**Date:** 2026-04-13
**Author:** Steven Junop + Claude
**Status:** Approved

## Overview

When a recruiter submits an intake form, Nova automatically publishes a job description to the OneForma WordPress site as a `job` custom post type — before any AI generation starts. The JD goes live immediately, the URL is captured and stored in `campaign_landing_pages.job_posting_url`, and UTM tracked links are auto-created for the recruiter.

This runs as Step 0 of Stage 1, before persona generation. The recruiter submits → JD is live on oneforma.com within seconds.

## WordPress Custom Post Type: `job`

Based on the existing WP setup:

### Post Content (AI-structured, hard facts injected)
Qwen 3.5 structures the JD into clean sections matching the existing format:

| Section | Source | AI Role |
|---|---|---|
| Title | `intake_requests.title` | Verbatim |
| Description | `form_data.task_description` | Reformat into clear paragraphs |
| Purpose | `brief.campaign_objective` or derived from task_description | AI writes 2-3 sentences explaining why this work matters |
| Main Requirements | `form_data.qualifications_required` | Formatted as bullet list, verbatim content |
| Preferred Qualifications | `form_data.qualifications_preferred` | Formatted as bullet list, verbatim content |
| Compensation | `form_data.compensation_rate` + `compensation_model` | Injected as variable, never rewritten |
| Work Mode | `form_data.work_mode` + `location_scope` | Verbatim |
| How to Apply | Auto-generated | "Click Apply below and select your language" |

### Taxonomies (auto-tagged)

**Job Types** (custom taxonomy — maps from `task_type`):

| Intake `task_type` | WP Job Type |
|---|---|
| `annotation` | Annotation |
| `data_collection` | Data Collection |
| `transcription` | Transcription |
| `translation` | Translation |
| `judging` | Judging |
| `llm_prompt_authoring` | LLM Prompt Authoring |
| (other) | Data Collection (default) |

**Job Tags** (custom taxonomy — maps from compensation + regions):

| Source Field | Tag Value |
|---|---|
| `compensation_model` = "per_hour" | "Fixed Rate Per Hour" |
| `compensation_model` = "per_asset" | "Fixed Rate Per Approved Asset" |
| `compensation_model` = "per_completion" | "Fixed Rate Upon Completion" |
| `compensation_model` = "per_word" | "Fixed Rate Per Source Word" |
| `target_regions` = all/empty | "Worldwide" |
| `target_regions` = ["US"] | "US" |
| `target_regions` = ["US", "SG"] | "US", "Singapore" |
| (each region gets its own tag) | |

### CPT Custom Meta Fields

**Apply Job Title:**
```
"This role is available in multiple languages"
```
(or "This role is available in {language}" if single language)

**Apply Job Description:**
```
"Select the one most relevant to you."
```

**Apply Job Repeater** — one row per `target_language`:

| Language | Apply URL |
|---|---|
| Finnish | `campaign_landing_pages.ada_form_url` or AIDA screener URL |
| Arabic | Same URL (or language-specific if available) |
| Portuguese | Same URL |

The Apply URL comes from `campaign_landing_pages.ada_form_url` (for onsite tasks) or `campaign_landing_pages.job_posting_url` (for remote). If neither exists yet, use `#apply` as placeholder — updated later when URLs are entered.

## Data Flow

```
Recruiter submits intake form
    ↓
POST /api/intake → creates intake_request (status: draft)
    ↓
Pipeline auto-triggers → compute_job (type: generate)
    ↓
Worker claims job → Stage 1 starts
    ↓
Step 0: WP Job Auto-Publish (NEW — runs BEFORE persona gen)
    ├── Qwen 3.5 structures JD content from form_data
    ├── WP MCP creates job post (status: publish)
    ├── Sets Job Types taxonomy from task_type
    ├── Sets Job Tags from compensation_model + target_regions
    ├── Sets CPT meta: apply_job repeater (one row per language)
    ├── Captures live URL from WP response
    ├── Upserts campaign_landing_pages.job_posting_url
    └── Auto-creates UTM tracked links
    ↓
Step 1: Persona generation (existing Stage 1 continues)
```

## WordPress MCP Integration

Using the `WordPressMCPClient` from VYRA (`/vyra/apps/api/app/services/optimize/mcp_clients/wp_mcp_client.py`).

### Connection Config

```python
WP_CONFIG = {
    "site_url": os.environ.get("WP_SITE_URL", "https://www.oneforma.com"),
    "username": os.environ.get("WP_USERNAME", ""),
    "app_password": os.environ.get("WP_APP_PASSWORD", ""),
    "mode": "remote",
}
```

### Create Job Post

```python
async with WordPressMCPClient(config=WP_CONFIG) as wp:
    result = await wp.call_tool("create_page", {
        "title": title,
        "content": html_content,
        "status": "publish",
        "slug": slug,
        "post_type": "job",  # Custom post type
        "meta": {
            "apply_job_title": apply_title,
            "apply_job_description": apply_description,
            "apply_job": apply_rows,  # Repeater: [{language, apply_url}, ...]
        },
        "job_types": [job_type_term],  # Taxonomy
        "job_tags": job_tag_terms,     # Taxonomy
    })
    wp_url = result.get("link") or result.get("url")
    wp_post_id = result.get("id") or result.get("page_id")
```

Note: The exact parameter names for custom post types and taxonomies depend on the WP REST API configuration. The MCP server may need `post_type` passed differently — we'll test and adapt during implementation.

## Auto UTM Link Creation

After WP publish, auto-create tracked links:

```python
# Create 3 default UTM tracked links for the new JD page
tracked_links = [
    {
        "base_url": wp_url,
        "utm_source": "organic",
        "utm_medium": "job_board",
        "utm_campaign": campaign_slug,
    },
    {
        "base_url": wp_url,
        "utm_source": "social",
        "utm_medium": "linkedin",
        "utm_campaign": campaign_slug,
    },
    {
        "base_url": wp_url,
        "utm_source": "email",
        "utm_medium": "outreach",
        "utm_campaign": campaign_slug,
    },
]
```

These appear in the recruiter's Link Builder immediately.

## Drift Prevention

Same philosophy as Stage 6 landing pages:
- Compensation amount injected as variable, never rewritten by AI
- Qualifications listed verbatim from intake form
- Regions/languages from `target_regions` / `target_languages` arrays
- Apply URLs from `campaign_landing_pages` table
- AI only structures/formats — never invents facts

## New Files

| File | Purpose | Lines (est.) |
|---|---|---|
| `worker/pipeline/wp_job_publisher.py` | WP MCP integration — build content, publish, capture URL, create tracked links | ~200 |
| `worker/prompts/job_description_copy.py` | Qwen 3.5 prompt for structuring JD into sections | ~100 |
| `worker/wp_mcp_client.py` | Adapted WP MCP client from VYRA (simplified for Nova's needs) | ~80 |

### Modified Files

| File | Changes |
|---|---|
| `worker/pipeline/stage1_intelligence.py` | Call `publish_job_to_wordpress()` at start before persona gen |
| `worker/neon_client.py` | Add `upsert_campaign_landing_page()` helper |
| `worker/config.py` | Add `WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` env vars |

## Environment Variables (New)

```
WP_SITE_URL=https://www.oneforma.com
WP_USERNAME=nova-bot
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

WordPress Application Password (not regular password) — generated in WP admin under Users → Application Passwords.

## Location Split (Future — Specced for Easy Adaptation)

Currently: one `job` post per campaign with all languages in the Apply Job repeater.

Future: when `SPLIT_JOBS_BY_REGION=true`:
- Loop `target_regions` array
- Create one `job` post per region
- Title suffix: "— {Region}" (e.g., "OCR Annotation — Morocco")
- Each post gets only the languages relevant to that region
- Job Tags include the specific region
- All URLs captured and stored

The `wp_job_publisher.py` will have a `split_by_region` parameter that defaults to `False`. When set to `True`, the loop changes from single-post to per-region. No other code changes needed.

## Out of Scope (v1)

- Updating existing WP posts when intake form is edited (create-only for now)
- Deleting WP posts when campaigns are cancelled
- WP post analytics integration
- Elementor or Divi page builder formatting (plain WP blocks only)
- Featured image auto-set from Stage 2 actor photos
