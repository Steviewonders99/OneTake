"""Deterministic persona validation against derived_requirements.persona_constraints.

Matches excluded_archetype phrases as full-substring, case-insensitive against
a concatenated blob of persona fields (archetype + lifestyle + matched_tier +
motivations). Single-word entries in excluded_archetypes are discouraged by
the Stage 1 prompt rules because they would over-match and reject valid
personas — the prompt instructs the LLM to use disambiguated multi-word
phrases.

Mirror of scripts/verify-persona-validation.mjs. Update both in sync if the
validation logic changes.
"""
from __future__ import annotations


class Stage1PersonaValidationError(Exception):
    """Raised when Stage 1 persona validation persistently fails after max retries.

    The compute_job runner catches this exception and marks the job as failed
    with the error message surfaced in the admin dashboard for manual review.
    """


def validate_personas(
    personas: list[dict],
    constraints: dict,
) -> tuple[bool, list[str]]:
    """Validate generated personas against persona_constraints.

    Returns (ok, violations). If ok is False, violations is a non-empty list
    of human-readable violation messages suitable for feedback injection into
    the Stage 1 retry prompt.
    """
    violations: list[str] = []
    excluded = [
        kw.strip().lower()
        for kw in constraints.get("excluded_archetypes", []) or []
        if isinstance(kw, str) and kw.strip()
    ]

    for i, persona in enumerate(personas):
        if not isinstance(persona, dict):
            violations.append(
                f"Persona at index {i} is not an object — cannot validate."
            )
            continue

        persona_name = persona.get("name") or f"persona_{i + 1}"

        # Check matched_tier is populated
        matched_tier = persona.get("matched_tier")
        if not matched_tier or not str(matched_tier).strip():
            violations.append(
                f"Persona '{persona_name}' is missing matched_tier — "
                f"cannot verify it satisfies any acceptable_tier."
            )

        # Build a searchable text blob from the persona fields
        motivations = persona.get("motivations", [])
        if isinstance(motivations, list):
            motivations_text = " ".join(str(m) for m in motivations)
        else:
            motivations_text = str(motivations)

        text_fields = [
            str(persona.get("archetype", "")),
            str(persona.get("lifestyle", "")),
            str(persona.get("matched_tier", "")),
            motivations_text,
        ]
        blob = " ".join(text_fields).lower()

        # Full-substring case-insensitive match on each excluded phrase
        for kw in excluded:
            if kw and kw in blob:
                violations.append(
                    f"Persona '{persona_name}' contains excluded archetype "
                    f"phrase: '{kw}'"
                )
                break  # one violation per persona is enough for feedback

    return len(violations) == 0, violations
