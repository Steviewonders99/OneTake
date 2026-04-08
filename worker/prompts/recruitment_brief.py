"""Recruitment-specific prompts for brief generation (Stage 1).

OneForma is the AI platform that sees the expert in everyone. This file
contains the Stage 1 (creative brief) LLM prompts. All brand voice content
(tagline, tone rules, pillars, CTAs, service categories, operational context)
is sourced from the single-source-of-truth brand module at `worker/brand/`.

Stage 1 reasons from the operational context (internal only) and outputs
user-facing copy that must follow the brand voice block verbatim — banned
words cause automatic rejection downstream.
"""
from __future__ import annotations

from worker.brand import (
    TAGLINE,
    POSITIONING,
    UNIQUE_VALUE,
    TONE_RULES,
    WORDS_TO_AVOID,
    PILLARS,
    TRUST_STRIP,
    SERVICE_CATEGORIES,
    OPERATIONAL_CONTEXT,
    build_brand_voice_block,
)


def _format_service_categories() -> str:
    """Format the 5 service categories for inline prompt inclusion."""
    lines = []
    for cat in SERVICE_CATEGORIES:
        lines.append(f"  - {cat['id']} ({cat['label']}): {cat['description']}")
    return "\n".join(lines)


BRIEF_SYSTEM_PROMPT = f"""You are a brand strategist for OneForma, the AI platform that sees the expert in everyone.

Your job is to generate a recruitment marketing creative brief that invites
experts from every walk of life and every corner of the globe to contribute
their expertise to AI development — with support and recognition worthy of
their unique background.

OneForma positioning (internal reference):
{POSITIONING}

What makes OneForma different (internal reference):
{UNIQUE_VALUE}

Public trust strip (safe to paraphrase as supporting proof, never as the lead):
{TRUST_STRIP}

═══════════════════════════════════════════════════════════════════════
OPERATIONAL CONTEXT (INTERNAL REASONING ONLY — NEVER QUOTE VERBATIM)
═══════════════════════════════════════════════════════════════════════
{OPERATIONAL_CONTEXT}
═══════════════════════════════════════════════════════════════════════

The operational context above is for YOUR reasoning only. Do NOT quote any
sentence from it in the output. All user-facing language must follow the
BRAND VOICE block below.

THE FIVE SERVICE CATEGORIES (every project maps to exactly ONE):
{_format_service_categories()}

═══════════════════════════════════════════════════════════════════════
{build_brand_voice_block()}
═══════════════════════════════════════════════════════════════════════

OUTPUT LANGUAGE RULES (binding):
- Every persona description, value proposition, headline, and tone note in
  your output must read as if written by the brand voice above.
- You MUST favor the expertise-first, human-first, purposeful, specific
  register. Lead with the expert, not the task or the payout.
- You MUST NOT use ANY of these banned words or phrases in the output:
  {", ".join(WORDS_TO_AVOID)}
- You MUST refer to people as experts, collaborators, or by their specific
  expertise (e.g. "physics PhDs", "native Tagalog speakers", "cardiologists",
  "multilingual professionals") — never as workers, resources, crowd,
  annotators alone, or by any commodity-labor framing.
- Compensation, flexibility, and payout mechanics may appear only as
  supporting proof after the expertise-led hook — never as the lead.

PERSONA GENERATION RULE (critical):
- Generate 3 dynamic personas from cultural research. Do NOT pre-assign
  personas to brand pillars — pillars are angles applied at Stage 3 (copy
  generation), not persona properties. Personas are defined by demographics,
  motivations, and daily context from cultural research; the SAME persona
  can be framed with any of the 3 pillars (Earn, Grow, Shape) depending on
  which angle resonates in a given creative.
- Each persona must be specific enough that a designer could picture them:
  age range, occupation, language(s), daily routine, motivations, pain
  points, and where they spend time online.

OUTPUT FORMAT — STRICT:
You MUST output a single valid JSON object.
No markdown code fences. No commentary before or after.
No trailing commas. No single quotes. No unquoted keys.
The JSON must be complete — do NOT truncate.
The JSON must parse with Python json.loads().
Start with {{ and end with }}. Nothing else.

TAGLINE (for your orientation only, do not paste verbatim into the brief):
{TAGLINE}
"""


def _format_feedback_section(feedback: list | None) -> str:
    """Format the feedback loop section for the prompt."""
    if not feedback:
        return ""
    items = "\n".join(f"- {f}" for f in feedback)
    return (
        "\n\nPREVIOUS ATTEMPT FEEDBACK (you MUST address every point, and the "
        "revised brief must stay expertise-first and respect every tone rule "
        "and banned-word constraint):\n"
        f"{items}"
    )


def _format_pillar_reference() -> str:
    """Short pillar reference for prompt context (angles, not personas)."""
    lines = []
    for p in PILLARS.values():
        lines.append(
            f"  - {p['display_name']} (JTBD: {p['jtbd']}) — {p['voice']}"
        )
    return "\n".join(lines)


def build_brief_prompt(
    request: dict,
    feedback: list | None = None,
    persona_context: str | None = None,
) -> str:
    """Build the prompt for creative brief generation.

    Parameters
    ----------
    request:
        The intake request dict from Neon.
    feedback:
        Optional list of improvement suggestions from a failed evaluation.
    persona_context:
        Pre-built persona + cultural research context block. When provided,
        the brief is generated FROM persona psychology — not generic.
    """
    feedback_section = _format_feedback_section(feedback)

    form_data = request.get("form_data", {})
    task_description = (
        form_data.get("task_description", "")
        if isinstance(form_data, dict)
        else str(form_data)
    )

    # Persona-first: if we have persona + cultural data, the brief
    # must be built FROM their psychology, not bolted on after.
    persona_section = ""
    if persona_context:
        persona_section = f"""

===================================================================
TARGET PERSONAS & CULTURAL INTELLIGENCE (the brief MUST serve these)
===================================================================
{persona_context}

CRITICAL: The persona profiles above are NOT generic. Every value
proposition, every messaging angle, every channel choice MUST be
traceable to a specific persona's expertise, motivation, or daily
context.
- Persona 1's pain point → becomes value prop #1 (framed expertise-first)
- Persona 2's motivation → becomes messaging angle #2
- Persona 3's expertise hook → determines the emotional tone
- Cultural research findings → determine what to AVOID and what to LEAN INTO

Remember: personas are people, not pillars. The same persona can be
framed with Earn, Grow, or Shape angles at copy-generation time.
===================================================================
"""

    service_category_section = f"""

===================================================================
SERVICE CATEGORY MAPPING (required)
===================================================================
Every OneForma project maps to exactly ONE of these 5 service categories.
Read the project title, task type, and task description below and identify
which category this project belongs to:

{_format_service_categories()}

Include the chosen category id in the output JSON under the field
"service_category" and a one-sentence rationale under "service_category_rationale".
===================================================================
"""

    pillar_reference = f"""

===================================================================
BRAND PILLARS (angles applied at Stage 3 — NOT persona properties)
===================================================================
These 3 pillars are creative angles used downstream at copy generation.
Do NOT assign a single pillar to a persona; each persona should be
frameable through any of the 3 angles depending on which resonates.

{_format_pillar_reference()}
===================================================================
"""

    return f"""Generate a recruitment marketing creative brief for this OneForma project.

PROJECT TITLE: {request.get("title", "")}
TASK TYPE: {request.get("task_type", "")}
TARGET LANGUAGES: {", ".join(request.get("target_languages", []))}
TARGET REGIONS: {", ".join(request.get("target_regions", []))}
VOLUME NEEDED: {request.get("volume_needed", "Not specified")} experts
TASK DETAILS: {task_description}
{service_category_section}
{persona_section}
{pillar_reference}
Return ONLY valid JSON (no markdown, no explanation):
{{
  "service_category": "One of: annotation | data_collection | judging | transcription | translation",
  "service_category_rationale": "One sentence explaining why this project maps to that category",
  "campaign_objective": "One sentence — must reference specific persona expertise and the OneForma invitation",
  "messaging_strategy": {{
    "primary_message": "The single most compelling expertise-first message for the PRIMARY persona",
    "per_persona_hooks": {{
      "persona_1": "Specific hook for persona 1 — leads with their expertise, not a payout",
      "persona_2": "Specific hook for persona 2 — leads with their expertise, not a payout",
      "persona_3": "Specific hook for persona 3 — leads with their expertise, not a payout"
    }},
    "value_propositions": [
      "Each value prop must map to a specific persona's expertise or motivation",
      "Each value prop must follow the 4 tone rules (expertise-first, human-first, purposeful, specific)",
      "Use approved words (expert, expertise, recognize, worthy, respect, unlock, collaborator, etc.)",
      "Reference cultural research findings where relevant",
      "At least 5 value props — covering all 3 personas"
    ],
    "tone": "Derived from persona psychology AND the 4 brand tone rules — never generic 'friendly'"
  }},
  "target_audience": {{
    "personas_summary": "Brief summary of all 3 personas and why they were chosen — frame them as experts",
    "profile_types": ["3 specific expertise archetype names (e.g. 'Native Tagalog linguist', 'Medical student', 'Freelance translator')"],
    "motivations_by_persona": {{
      "persona_1": ["motivation1", "motivation2"],
      "persona_2": ["motivation1", "motivation2"],
      "persona_3": ["motivation1", "motivation2"]
    }},
    "pain_points_by_persona": {{
      "persona_1": ["pain1", "pain2"],
      "persona_2": ["pain1", "pain2"],
      "persona_3": ["pain1", "pain2"]
    }},
    "expertise_hooks_by_persona": {{
      "persona_1": "The specific expertise + recognition hook that resonates",
      "persona_2": "The specific expertise + recognition hook that resonates",
      "persona_3": "The specific expertise + recognition hook that resonates"
    }}
  }},
  "content_language": {{
    "primary": "Language code",
    "secondary": "Optional",
    "dialect_notes": "From cultural research — e.g. 'Moroccan Darija + Standard French'",
    "formality": "From cultural research — e.g. 'Semi-formal French for ads, Darija for social'"
  }},
  "channels": {{
    "per_persona": {{
      "persona_1": ["their best channels from cultural research"],
      "persona_2": ["their best channels"],
      "persona_3": ["their best channels"]
    }},
    "primary": ["Top 3 channels across all personas"],
    "secondary": ["Additional reach channels"],
    "rationale": "Why — referencing cultural research platform_reality data"
  }},
  "cultural_guardrails": {{
    "things_to_avoid": ["From cultural research — imagery, phrases, topics to avoid"],
    "things_to_lean_into": ["What resonates culturally — from research findings"],
    "trust_signals": ["How to build credibility in this region — referencing expertise and recognition"]
  }}
}}

RULES:
- Every value proposition MUST map to a specific persona's expertise, motivation,
  or pain point.
- Channels MUST come from cultural research platform_reality data — NOT assumptions.
- Tone MUST be derived from persona psychology AND the 4 brand tone rules
  (expertise-first, human-first, purposeful, specific).
- Every persona, value prop, and headline MUST read as written by the OneForma
  brand voice. Run a mental check for banned words before emitting each string.
- Include cultural_guardrails to prevent offensive/ineffective messaging.
- Think expertise-first: 'What would make Fatima (native Darija speaker) feel
  recognized for her language skill?' — NOT 'What headline works?'.

FINAL INSTRUCTION:
Output ONLY the JSON object described above.
No markdown. No code fences. No explanation. Just valid JSON.
Start with {{ and end with }}. Nothing else.{feedback_section}"""


def build_eval_prompt(brief: dict, request: dict) -> str:
    """Build the prompt for evaluating a generated brief."""
    import json

    return f"""Evaluate this recruitment marketing brief for OneForma.

OneForma is the AI platform that sees the expert in everyone. Evaluate the
brief as a brand strategist would — checking both creative quality AND brand
voice compliance.

BRIEF:
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

ORIGINAL REQUEST:
Title: {request.get("title")}
Regions: {request.get("target_regions")}
Languages: {request.get("target_languages")}
Task type: {request.get("task_type")}
Volume: {request.get("volume_needed")}

Score each dimension 0.0 to 1.0:
- audience_specificity: Is the persona specific enough for creative decisions? Does it describe real-life details (age range, expertise type, daily routine, where they spend time online)?
- messaging_clarity: Are value props clear, concrete, and expertise-first? Do they lead with the expert's skill or recognition — NOT with hourly pay or generic "opportunity" language?
- channel_feasibility: Are recommended channels actually popular in the target regions?
- language_appropriateness: Is the content language correct for the target regions?
- brand_voice_compliance: Does every persona description, value prop, headline, and tone note respect the 4 OneForma tone rules (expertise-first, human-first, purposeful, specific) and avoid all banned words ({", ".join(WORDS_TO_AVOID)})?
- budget_realism: Is this achievable for a small team (1 marketing manager + 1 designer)?

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "dimensions": {{
    "audience_specificity": {{"score": 0.0, "feedback": "..."}},
    "messaging_clarity": {{"score": 0.0, "feedback": "..."}},
    "channel_feasibility": {{"score": 0.0, "feedback": "..."}},
    "language_appropriateness": {{"score": 0.0, "feedback": "..."}},
    "brand_voice_compliance": {{"score": 0.0, "feedback": "..."}},
    "budget_realism": {{"score": 0.0, "feedback": "..."}}
  }},
  "improvement_suggestions": ["...", "..."]
}}"""


def build_design_direction_prompt(brief: dict, request: dict) -> str:
    """Build the prompt for generating design direction from an approved brief."""
    import json

    return f"""Based on this approved creative brief for OneForma, determine the visual design direction.

BRIEF:
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

BRAND GUIDELINES:
- OneForma uses a LIGHT theme: white backgrounds, charcoal (#32373C) buttons and text.
- Buttons are pill-shaped (border-radius: 9999px).
- System fonts (-apple-system, system-ui, 'Segoe UI', Roboto).
- Accent: cyan-blue to purple gradient — used sparingly for highlights.
- Photography: real people in real settings, UGC aesthetic, NOT stock photos.
- The feel should be approachable, modern, clean — like a fintech app, not a job board.
- People in photos are experts and collaborators, portrayed with dignity and
  specificity — framed as someone whose expertise is being recognized, not
  someone completing a task for money.

TARGET REGIONS: {request.get("target_regions")}
TARGET LANGUAGES: {request.get("target_languages")}

Return ONLY valid JSON following this structured ART DIRECTION format
(inspired by professional art direction workflows):
{{
  "visual_style": "light_clean",
  "palette": {{
    "primary_bg": "#FFFFFF",
    "primary_text": "#32373C",
    "cta_bg": "#32373C",
    "cta_text": "#FFFFFF",
    "accent": "One campaign-specific accent color hex"
  }},
  "mood": "One sentence — the FEELING this campaign should evoke",
  "lighting": {{
    "type": "Be SPECIFIC: 'warm golden hour from camera left at 45 degrees' or 'overhead fluorescent mixed with window daylight'",
    "color_temperature": "warm (3200K) / neutral (5000K) / cool (6500K) / mixed",
    "shadows": "soft and diffused / hard directional / mixed (window + lamp)"
  }},
  "photography_direction": {{
    "style": "UGC candid / editorial lifestyle / documentary / intimate portrait",
    "lens": "35mm equivalent (environmental) / 50mm (natural) / 85mm (portrait/bokeh)",
    "depth_of_field": "shallow f/1.8 (person sharp, background blurred) / medium f/4 (both visible) / deep f/8 (everything sharp)",
    "film_stock": "iPhone 15 Pro sensor look — slight grain, warm cast, natural contrast"
  }},
  "environment": {{
    "setting_type": "Specific location type for this region and audience",
    "surface_textures": "MUST specify: wall finish (paint strokes/cracks/tiles), furniture material (wood grain/plastic/metal), floor type",
    "lived_in_details": "List 5+ specific real objects that should be visible (charger cable, sticky notes, water bottle, etc.)",
    "lighting_on_environment": "How light hits surfaces — warm pool on desk, cool wash on wall, hard shadow from object"
  }},
  "texture": {{
    "skin": "Natural with visible pores, slight oiliness, under-eye shadows — NOT airbrushed",
    "fabric": "Visible weave, wrinkles at joints, slight pilling on worn items",
    "surfaces": "Wood grain on desk, scuff marks on floor, fingerprints on screen edge",
    "film_grain": "Subtle sensor noise, stronger in shadow areas — iPhone aesthetic"
  }},
  "do_not": [
    "List 5+ specific things to AVOID for this campaign — e.g. 'no corporate office', 'no studio lighting', 'no stock photo poses'"
  ],
  "template_preferences": {{
    "linkedin_feed": "HERO_HEADLINE or BOTTOM_BAND",
    "facebook_feed": "HERO_HEADLINE or CENTERED_OVERLAY",
    "facebook_stories": "CENTERED_OVERLAY",
    "telegram_card": "MINIMAL_CTA"
  }},
  "format_matrix": {{
    "linkedin_feed": ["1200x627"],
    "facebook_feed": ["1080x1080"],
    "facebook_stories": ["1080x1920"],
    "telegram_card": ["1280x720"]
  }}
}}"""
