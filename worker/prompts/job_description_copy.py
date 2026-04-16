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
annotation and AI training platform with 1.8M+ contributors across \
222 markets in 300+ languages.

Your job is to structure raw job description data into a clean, \
professional WordPress post.

RULES:
- The Description section: clear, professional, 2-3 paragraphs explaining the role
- The Purpose section: 2-3 sentences explaining WHY this work matters for AI
- NEVER change qualification requirements — format as a clean bullet list, verbatim
- NEVER invent or change compensation amounts — use EXACT figures provided
- NEVER add locations or languages not in the source data
- Keep the tone professional but approachable — this is OneForma's voice
- Use plain HTML (h2, p, ul/li) — no custom CSS, no divs, no classes

OUTPUT: Valid JSON with the exact keys specified. No markdown, no explanation.
"""


def build_jd_content_prompt(
    form_data: dict[str, Any],
    request: dict[str, Any],
) -> str:
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
Structure this job description into a clean WordPress post for OneForma.

TITLE: {title}

RAW TASK DESCRIPTION:
{task_description}

QUALIFICATIONS REQUIRED (list EXACTLY as written — do NOT rephrase):
{qualifications_required or "(none specified)"}

QUALIFICATIONS PREFERRED:
{qualifications_preferred or "(none)"}

COMPENSATION: {comp_display or "(details provided during application)"}
WORK MODE: {work_mode}
LOCATION: {location_scope or "Worldwide"}
TIME COMMITMENT: {engagement_model or "Flexible"}
LANGUAGE REQUIREMENTS: {language_requirements or "English"}

OUTPUT — valid JSON, exact keys below:
{{
  "description_html": "<h2>Description:</h2><p>2-3 clear paragraphs describing what contributors will do in this role. Be specific about the tasks, tools, and expected output.</p>",
  "purpose_html": "<h2>Purpose:</h2><p>2-3 sentences explaining WHY this work matters — how it improves AI systems, who benefits, what real-world impact it has.</p>",
  "requirements_html": "<h2>Main Requirements:</h2><ul><li>EXACT qualification from the list above</li><li>EXACT qualification from the list above</li></ul>",
  "preferred_html": "<h2>Preferred Qualifications:</h2><ul><li>preferred qual</li></ul>",
  "compensation_html": "<h2>Compensation:</h2><p>{comp_display or 'Details provided during the application process.'}</p>",
  "details_html": "<h2>Details:</h2><ul><li><strong>Work Mode:</strong> {work_mode}</li><li><strong>Location:</strong> {location_scope or 'Worldwide'}</li><li><strong>Time Commitment:</strong> {engagement_model or 'Flexible'}</li><li><strong>Language:</strong> {language_requirements or 'English'}</li></ul>",
  "seo_title": "SEO title under 60 chars — include task type and key language/skill",
  "seo_description": "Meta description under 160 chars — include what, who, and key benefit"
}}
"""
