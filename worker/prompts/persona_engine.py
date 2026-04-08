"""Persona Engine — generates dynamic target personas from derived_requirements
and cultural research.

Replaced the legacy 8-archetype system (deleted in Task 18 of the intake
schema + persona refactor, 2026-04-08) with LLM-generated personas constrained
by intake job requirements + cultural research. See
worker/brand/oneforma.py for brand voice constraints and
worker/prompts/recruitment_brief.py for the derived_requirements source.
"""
from __future__ import annotations

import json
from typing import Any


PERSONA_SYSTEM_PROMPT = (
    "You are a contributor-recruitment psychologist for OneForma, "
    "the AI platform that sees the expert in everyone.\n\n"
    "Given a set of persona_constraints from the brief derivation and "
    "cultural research context, you generate 3 distinct personas — each "
    "satisfying the minimum_credentials, fitting one of the acceptable_tiers, "
    "staying within the age_range_hint, and NOT matching any excluded "
    "archetype phrase. Each persona should span a different dimension of "
    "difference (career stage within acceptable tiers, regional variation "
    "within scope, or professional context). Do not generate 3 clones.\n\n"
    "Each persona MUST include a matched_tier field that exactly matches "
    "one of the acceptable_tiers strings from the constraints. This is used "
    "by downstream validation to confirm the persona satisfies a declared "
    "tier.\n\n"
    "Return ONLY valid JSON. No markdown. No commentary. No trailing text."
)


def build_persona_prompt(
    request: dict,
    cultural_research: dict,
    persona_constraints: dict,
    brief_messaging: dict | None = None,
    previous_violations: list[str] | None = None,
) -> str:
    """Build the LLM prompt for dynamic persona generation.

    Parameters
    ----------
    request
        intake_requests row (for title, task_type, regions, languages)
    cultural_research
        output of the cultural_research stage (regional platforms, stigmas,
        work norms, professional community data)
    persona_constraints
        derived_requirements.persona_constraints from the Stage 1 brief
        (minimum_credentials, acceptable_tiers, age_range_hint,
        excluded_archetypes)
    brief_messaging
        optional messaging_strategy from the brief for additional context
    previous_violations
        optional list of validation failures from an earlier attempt,
        injected into the prompt as feedback for the retry
    """
    # Format the constraint block clearly
    acceptable_tiers = persona_constraints.get("acceptable_tiers", []) or []
    excluded = persona_constraints.get("excluded_archetypes", []) or []
    min_creds = persona_constraints.get("minimum_credentials", "") or ""
    age_hint = persona_constraints.get("age_range_hint", "") or ""

    tiers_block = "\n".join(f"  - {t}" for t in acceptable_tiers) or "  (none specified)"
    excluded_block = "\n".join(f"  - {e}" for e in excluded) or "  (none)"

    # Optional feedback section for retry loops
    feedback_section = ""
    if previous_violations:
        feedback_section = (
            "\n\n## RETRY FEEDBACK — fix these violations from the previous attempt:\n"
            + "\n".join(f"  - {v}" for v in previous_violations)
            + "\n\nRegenerate the 3 personas avoiding these specific issues.\n"
        )

    # Truncate cultural research to avoid token bloat
    cultural_json = json.dumps(cultural_research or {}, indent=2, ensure_ascii=False)
    if len(cultural_json) > 3500:
        cultural_json = cultural_json[:3500] + "\n  ... (truncated)"

    # Build the prompt
    prompt = f"""Generate 3 distinct personas for this recruitment campaign.

## CAMPAIGN CONTEXT

Title: {request.get("title", "")}
Task type: {request.get("task_type", "")}
Target regions: {", ".join(request.get("target_regions", []) or [])}
Target languages: {", ".join(request.get("target_languages", []) or [])}

## PERSONA CONSTRAINTS (binding)

Minimum credentials required:
{min_creds}

Acceptable applicant tiers (each persona must match one of these):
{tiers_block}

Age range hint:
{age_hint}

EXCLUDED archetype phrases (no persona may contain these phrases in their
archetype, lifestyle, matched_tier, or motivations fields):
{excluded_block}

## CULTURAL RESEARCH CONTEXT

{cultural_json}

## OUTPUT SCHEMA

Return a JSON object with a "personas" array containing exactly 3 distinct personas.
Each persona must have this shape:

{{
  "personas": [
    {{
      "name": "Culturally-appropriate full name",
      "archetype": "Description of who this person is — derived from acceptable_tiers. E.g., 'Second-year dermatology resident at a US teaching hospital.'",
      "matched_tier": "MUST exactly match one of the acceptable_tiers listed above",
      "age_range": "Specific 4-6 year range within the age_range_hint. E.g., '28-32'",
      "lifestyle": "What their daily life actually looks like — specific to the credential context, not generic.",
      "motivations": [
        "Why THIS specific persona would do this work",
        "Multiple concrete motivations"
      ],
      "pain_points": [
        "What frustrates THIS persona",
        "Specific to their credential tier and context"
      ],
      "digital_habitat": [
        "Where THIS persona spends time online — pull from the cultural_research professional_community data when applicable"
      ],
      "psychology_profile": {{
        "primary_bias": "A single psychology trigger — e.g., social_proof, authority, scarcity",
        "secondary_bias": "A backup trigger",
        "messaging_angle": "One-sentence summary of how to speak to them",
        "trigger_words": ["words that resonate for this credential tier"]
      }},
      "jobs_to_be_done": {{
        "functional": "What they want to accomplish",
        "emotional": "How they want to feel",
        "social": "How they want to be seen"
      }},
      "objections": [
        "What would make THIS persona hesitate?"
      ],
      "best_channels": [
        "Where to reach THIS persona — from cultural_research platform data"
      ]
    }},
    {{ ... second persona ... }},
    {{ ... third persona ... }}
  ]
}}

Each of the 3 personas must represent a different tier or career stage from
the acceptable_tiers list. Do not clone the same persona three ways.

Before finalizing your output, verify each persona against ALL constraints:
- matched_tier exactly matches one of the acceptable_tiers strings
- archetype + lifestyle + motivations contain NONE of the excluded phrases
- age_range falls within the age_range_hint
- The persona is culturally grounded in the target region from cultural_research
{feedback_section}

Return ONLY the JSON object. No commentary."""

    return prompt
