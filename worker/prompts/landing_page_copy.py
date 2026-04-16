"""Landing page copy prompts — Gemma 4 31B.

Generates structured JSON copy for LP informational sections.
Every section is grounded in job requirements + cultural research.
Hard facts (compensation, qualifications, location) are NEVER generated
by the LLM — they're injected as Jinja2 template variables separately.

The LLM generates ONLY:
  - why_cards (3 insight cards explaining project purpose)
  - activities (3-4 activity cards describing what contributors do)
  - session_details (3-4 accordion items with logistics)
  - faq (6-10 Q&A pairs)
  - meta_description (SEO, under 160 chars)
"""
from __future__ import annotations

import json
from typing import Any

LP_COPY_SYSTEM_PROMPT = """\
You are a senior recruitment landing page copywriter for OneForma, a global \
data annotation and AI training platform with 1.8M+ contributors across 222 \
markets in 300+ languages.

VOICE & TONE:
- Peer voice — talk WITH candidates, not AT them
- Specific and concrete — never vague or corporate
- Warm but professional — this is a real opportunity, not a sales pitch
- Use the persona's language patterns, cultural references, and communication style
- Mirror the emotional register of the target persona (eg. pragmatic for professionals, \
enthusiastic for students)

HARD RULES — VIOLATING THESE IS A CRITICAL FAILURE:
- NEVER mention compensation amounts — those are injected as template variables
- NEVER invent qualifications — use ONLY what is listed in JOB REQUIREMENTS
- NEVER fabricate locations, cities, or countries — use ONLY the provided regions
- NEVER make promises about future opportunities or career growth
- NEVER use phrases like "competitive pay" or "great benefits" — be specific or omit
- Every activity description must match a REAL task step from the job description
- FAQ answers about pay must say "see compensation details above" — never invent amounts
- FAQ answers about requirements must quote the actual qualifications verbatim

CULTURAL SENSITIVITY:
- Adapt formality level to the target region (formal for Japan/Korea, casual for US/Brazil)
- Reference local context when available (gig economy perception, platform trust, etc.)
- Use region-appropriate examples and analogies
- Respect local norms around work, privacy, and data collection

OUTPUT: Valid JSON matching the exact schema specified. No markdown fences, no commentary.
"""


def build_lp_copy_prompt(
    persona: dict[str, Any],
    brief: dict[str, Any],
    form_data: dict[str, Any],
    cultural_research: dict[str, Any] | None = None,
    project_context: str = "",
    language: str = "English",
) -> str:
    """Build the user prompt for LP copy generation.

    Injects ALL job requirements, persona psychology, and cultural
    insights so the LLM has complete context. The copy must be
    detailed to every requirement in the job description — no drift,
    no embellishment, no fabrication.
    """
    # ── Job requirements (the single source of truth) ──
    task_description = form_data.get(
        "task_description",
        brief.get("campaign_objective", ""),
    )
    qualifications_required = form_data.get("qualifications_required", "")
    qualifications_preferred = form_data.get("qualifications_preferred", "")
    engagement_model = form_data.get("engagement_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location_scope = form_data.get("location_scope", "")
    language_requirements = form_data.get("language_requirements", "")
    demographic = form_data.get("demographic", "")
    title = form_data.get("title", brief.get("title", "Untitled"))

    # ── Derived requirements from Stage 1 intelligence ──
    derived = brief.get("derived_requirements", {})
    if isinstance(derived, str):
        try:
            derived = json.loads(derived)
        except (ValueError, TypeError):
            derived = {}

    task_steps = derived.get("task_steps", []) if isinstance(derived, dict) else []
    equipment_needed = derived.get("equipment_needed", []) if isinstance(derived, dict) else []
    time_estimate = derived.get("time_estimate", engagement_model) if isinstance(derived, dict) else engagement_model
    task_environment = derived.get("task_environment", "") if isinstance(derived, dict) else ""
    data_types = derived.get("data_types_collected", []) if isinstance(derived, dict) else []

    # ── Persona psychology (shapes tone, not facts) ──
    persona_name = persona.get(
        "persona_name",
        persona.get("name", persona.get("archetype_key", "Candidate")),
    )
    archetype = persona.get("archetype_key", "")
    age_range = persona.get("age_range", "")
    region = persona.get("region", "")
    lifestyle = persona.get("lifestyle", "")

    motivations = persona.get("motivations", [])
    pain_points = persona.get("pain_points", [])
    objections = persona.get("objections", [])

    psychology = persona.get("psychology_profile", {})
    if isinstance(psychology, str):
        try:
            psychology = json.loads(psychology)
        except (ValueError, TypeError):
            psychology = {}

    trigger_words = psychology.get("trigger_words", [])
    primary_bias = psychology.get("primary_bias", "")
    secondary_bias = psychology.get("secondary_bias", "")
    messaging_angle = psychology.get("messaging_angle", "")

    jobs_to_be_done = persona.get("jobs_to_be_done", {})
    if isinstance(jobs_to_be_done, str):
        try:
            jobs_to_be_done = json.loads(jobs_to_be_done)
        except (ValueError, TypeError):
            jobs_to_be_done = {}

    jtbd_functional = jobs_to_be_done.get("functional", "")
    jtbd_emotional = jobs_to_be_done.get("emotional", "")
    jtbd_social = jobs_to_be_done.get("social", "")

    # ── Cultural research — region-specific insights ──
    cultural_block = ""
    if cultural_research:
        region_data = cultural_research.get(region, {})
        if not region_data:
            # Try first region as fallback
            for r in form_data.get("target_regions", []):
                region_data = cultural_research.get(r, {})
                if region_data:
                    break

        if isinstance(region_data, dict):
            insights = []
            for dim_key, dim_data in region_data.items():
                if dim_key.startswith("_"):
                    continue
                if isinstance(dim_data, dict):
                    summary = dim_data.get("summary", dim_data.get("key_finding", ""))
                    trust_builders = dim_data.get("trust_builders", "")
                    if trust_builders:
                        summary = f"{summary} Trust builders: {trust_builders}"
                elif isinstance(dim_data, str):
                    summary = dim_data
                else:
                    continue
                if summary:
                    insights.append(f"  - {dim_key}: {summary[:400]}")
            if insights:
                cultural_block = (
                    f"CULTURAL INSIGHTS FOR {region or 'THIS REGION'}:\n"
                    + "\n".join(insights[:10])
                )
        elif isinstance(region_data, str):
            cultural_block = f"CULTURAL CONTEXT: {region_data[:1500]}"

    # ── Format lists for prompt ──
    def _fmt_list(items: list, prefix: str = "  - ") -> str:
        if not items:
            return "  (not specified)"
        if isinstance(items, str):
            return f"{prefix}{items}"
        return "\n".join(f"{prefix}{item}" for item in items)

    task_steps_str = (
        "\n".join(f"  {i+1}. {s}" for i, s in enumerate(task_steps))
        if task_steps
        else "  (derive from task description below)"
    )
    equipment_str = ", ".join(equipment_needed) if equipment_needed else "(none specified)"
    data_types_str = ", ".join(data_types) if data_types else "(not specified)"

    return f"""\
Generate landing page copy for persona "{persona_name}" in {language}.
Campaign: {title}

{'=' * 60}
JOB REQUIREMENTS — SOURCE OF TRUTH (do NOT contradict any of these)
{'=' * 60}

TASK DESCRIPTION:
{task_description}

DERIVED TASK STEPS (from Stage 1 analysis):
{task_steps_str}

EQUIPMENT NEEDED: {equipment_str}
DATA TYPES COLLECTED: {data_types_str}
TASK ENVIRONMENT: {task_environment or work_mode}

REQUIRED QUALIFICATIONS (every one of these must be accurately reflected):
{qualifications_required or "(none specified)"}

PREFERRED QUALIFICATIONS:
{qualifications_preferred or "(none)"}

WORK MODE: {work_mode}
LOCATION SCOPE: {location_scope or region or "(not specified)"}
LANGUAGE REQUIREMENTS: {language_requirements or language}
TIME COMMITMENT: {time_estimate or engagement_model or "(not specified)"}
TARGET DEMOGRAPHIC: {demographic or "(not specified)"}

{'=' * 60}
PERSONA PSYCHOLOGY — shapes tone and framing, NOT facts
{'=' * 60}

Name: {persona_name}
Archetype: {archetype}
Age range: {age_range}
Region: {region}
Lifestyle: {lifestyle}

MOTIVATIONS (what draws them to this work):
{_fmt_list(motivations)}

PAIN POINTS (what holds them back):
{_fmt_list(pain_points)}

LIKELY OBJECTIONS (what they need answered before applying):
{_fmt_list(objections)}

PSYCHOLOGY PROFILE:
  Primary cognitive bias: {primary_bias}
  Secondary bias: {secondary_bias}
  Messaging angle: {messaging_angle}
  Trigger words: {", ".join(trigger_words) if trigger_words else "(none)"}

JOBS TO BE DONE:
  Functional: {jtbd_functional}
  Emotional: {jtbd_emotional}
  Social: {jtbd_social}

{cultural_block}

{f"DIAMOND PERSONA CONTEXT (from project_context builder):{chr(10)}{project_context}" if project_context else ""}

{'=' * 60}
OUTPUT — Valid JSON, exact schema below
{'=' * 60}

{{
  "why_cards": [
    {{
      "title": "short punchy title (5-8 words)",
      "description": "2-3 sentences explaining WHY this work matters to the world. Ground in the task_description. Make this persona care based on their motivations.",
      "icon_hint": "users|smile|spark|globe|shield|book|video|mic"
    }}
    // 3 cards total. Each must connect to a different aspect of the task.
  ],
  "activities": [
    {{
      "title": "activity name (2-4 words matching a real task step)",
      "description": "2-3 sentences describing what the contributor ACTUALLY does in this step. Must match a real task step from DERIVED TASK STEPS above. Include specific details — duration, tools used, what the output looks like.",
      "image_label": "descriptive alt text for a candid photo of someone doing this activity"
    }}
    // 3-4 cards. ONE per real task step. Do NOT invent activities that aren't in the job description.
  ],
  "session_details": [
    {{
      "title": "session or logistics topic",
      "body": "2-4 sentences with specific details from the job requirements. Include time estimates from TIME COMMITMENT, equipment from EQUIPMENT NEEDED, what to expect step by step.",
      "has_image": true
    }}
    // 3-4 items. ONLY include onsite-specific items (studio, location, facilitator) if work_mode is "onsite".
    // For remote: focus on setup, internet requirements, quiet environment, software needed.
  ],
  "faq": [
    {{
      "question": "anticipated question from this specific persona based on their objections",
      "answer": "specific factual answer. For compensation: say 'see compensation details above'. For qualifications: quote the exact REQUIRED QUALIFICATIONS. For time: use the exact TIME COMMITMENT. Never be vague."
    }}
    // 6-10 pairs.
    // FIRST 3 MUST BE: 1) participation/qualification requirements, 2) time commitment, 3) payment schedule.
    // REMAINING: address this persona's specific objections listed above.
    // LAST FAQ: "Is this a one-time commitment?" — answer based on engagement model.
  ],
  "meta_description": "SEO meta description under 160 chars. Include: task type, who it's for, key benefit. Example: 'Native Arabic speakers needed for AI voice study. Flexible schedule, twice-monthly payouts.'"
}}
"""
