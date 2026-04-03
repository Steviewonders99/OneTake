"""Recruitment-specific prompts for brief generation (Stage 1).

OneForma recruits global contributors — gig workers, students, and
freelancers — to annotate, transcribe, segment, and verify data for
AI companies. The tone is friendly, inviting, and opportunity-focused.
Never corporate or intimidating.
"""
from __future__ import annotations

BRIEF_SYSTEM_PROMPT = (
    "You are a Lead Strategic Director for OneForma recruitment marketing. "
    "OneForma is a data annotation company powering AI training for OpenAI, "
    "Anthropic, Google. You recruit global contributors — gig workers, students, "
    "freelancers, stay-at-home parents, multilingual professionals.\n\n"
    "Your tone: friendly, inviting, opportunity-focused. Think 'side-hustle "
    "opportunity' not 'job opening'.\n\n"
    "OUTPUT FORMAT — STRICT:\n"
    "You MUST output a single valid JSON object.\n"
    "No markdown code fences. No commentary before or after.\n"
    "No trailing commas. No single quotes. No unquoted keys.\n"
    "The JSON must be complete — do NOT truncate.\n"
    "The JSON must parse with Python json.loads().\n"
    "Start with { and end with }. Nothing else."
)


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
    feedback_section = ""
    if feedback:
        items = "\n".join(f"- {f}" for f in feedback)
        feedback_section = (
            f"\n\nPREVIOUS ATTEMPT FEEDBACK (you MUST address every point):\n{items}"
        )

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

CRITICAL: The brief above is NOT generic. Every value proposition,
every messaging angle, every channel choice MUST be traceable to a
specific persona's pain point, motivation, or psychology hook.
- Persona 1's pain point → becomes value prop #1
- Persona 2's motivation → becomes messaging angle #2
- Persona 3's psychology hook → determines the emotional tone
- Cultural research findings → determine what to AVOID and what to LEAN INTO
===================================================================
"""

    return f"""Generate a recruitment marketing creative brief for this OneForma project.

PROJECT TITLE: {request.get("title", "")}
TASK TYPE: {request.get("task_type", "")}
TARGET LANGUAGES: {", ".join(request.get("target_languages", []))}
TARGET REGIONS: {", ".join(request.get("target_regions", []))}
VOLUME NEEDED: {request.get("volume_needed", "Not specified")} contributors
TASK DETAILS: {task_description}
{persona_section}
Return ONLY valid JSON (no markdown, no explanation):
{{
  "campaign_objective": "One sentence — must reference the specific persona needs",
  "messaging_strategy": {{
    "primary_message": "The single most compelling message for the PRIMARY persona",
    "per_persona_hooks": {{
      "persona_1": "Specific hook for persona 1 based on their psychology",
      "persona_2": "Specific hook for persona 2 based on their psychology",
      "persona_3": "Specific hook for persona 3 based on their psychology"
    }},
    "value_propositions": [
      "Each value prop must map to a specific persona pain point",
      "Include the psychology hook that works for that persona",
      "Use trigger words from the persona profile",
      "Reference cultural research findings where relevant",
      "At least 5 value props — covering all 3 personas"
    ],
    "tone": "Derived from persona psychology — not generic 'friendly'"
  }},
  "target_audience": {{
    "personas_summary": "Brief summary of all 3 personas and why they were chosen",
    "profile_types": ["The 3 archetype names"],
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
    "psychology_hooks_by_persona": {{
      "persona_1": "primary_bias + messaging_angle",
      "persona_2": "primary_bias + messaging_angle",
      "persona_3": "primary_bias + messaging_angle"
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
    "trust_signals": ["How to build credibility in this region"]
  }}
}}

RULES:
- Every value proposition MUST map to a specific persona's pain point or motivation.
- Channels MUST come from cultural research platform_reality data — NOT assumptions.
- Tone MUST be derived from persona psychology — NOT generic 'friendly, inviting'.
- Include cultural_guardrails to prevent offensive/ineffective messaging.
- Think persona-first: 'What would make Fatima (student) stop scrolling?' not 'What headline works?'

FINAL INSTRUCTION:
Output ONLY the JSON object described above.
No markdown. No code fences. No explanation. Just valid JSON.
Start with {{ and end with }}. Nothing else.{feedback_section}"""


def build_eval_prompt(brief: dict, request: dict) -> str:
    """Build the prompt for evaluating a generated brief."""
    import json

    return f"""Evaluate this recruitment marketing brief for OneForma.

BRIEF:
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

ORIGINAL REQUEST:
Title: {request.get("title")}
Regions: {request.get("target_regions")}
Languages: {request.get("target_languages")}
Task type: {request.get("task_type")}
Volume: {request.get("volume_needed")}

Score each dimension 0.0 to 1.0:
- audience_specificity: Is the persona specific enough for creative decisions? Does it mention real life details (age range, occupation, daily routine)?
- messaging_clarity: Are value props clear, concrete, and contributor-focused? Do they mention specific benefits (earnings, flexibility, skills)?
- channel_feasibility: Are recommended channels actually popular in the target regions?
- language_appropriateness: Is the content language correct for the target regions?
- budget_realism: Is this achievable for a small team (1 marketing manager + 1 designer)?

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "dimensions": {{
    "audience_specificity": {{"score": 0.0, "feedback": "..."}},
    "messaging_clarity": {{"score": 0.0, "feedback": "..."}},
    "channel_feasibility": {{"score": 0.0, "feedback": "..."}},
    "language_appropriateness": {{"score": 0.0, "feedback": "..."}},
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
