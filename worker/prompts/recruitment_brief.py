"""Recruitment-specific prompts for brief generation (Stage 1).

OneForma recruits global contributors — gig workers, students, and
freelancers — to annotate, transcribe, segment, and verify data for
AI companies. The tone is friendly, inviting, and opportunity-focused.
Never corporate or intimidating.
"""
from __future__ import annotations

BRIEF_SYSTEM_PROMPT = (
    "You are a recruitment marketing strategist for OneForma, a data "
    "annotation company that powers AI training for companies like OpenAI "
    "and Anthropic.\n\n"
    "OneForma recruits global contributors — gig workers, students, "
    "freelancers, stay-at-home parents, and multilingual professionals — "
    "to annotate, transcribe, segment, and verify data.\n\n"
    "Contributors are NOT traditional corporate employees. They are "
    "independent workers who value flexibility, remote work, and using "
    "their language skills to earn.\n\n"
    "Your tone is friendly, inviting, and opportunity-focused — never "
    "corporate, stiff, or intimidating. Think 'side-hustle opportunity' "
    "not 'job opening'."
)


def build_brief_prompt(request: dict, feedback: list | None = None) -> str:
    """Build the prompt for creative brief generation.

    Parameters
    ----------
    request:
        The intake request dict from Neon.
    feedback:
        Optional list of improvement suggestions from a failed evaluation.
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

    return f"""Generate a recruitment marketing creative brief for this OneForma project.

PROJECT TITLE: {request.get("title", "")}
TASK TYPE: {request.get("task_type", "")}
TARGET LANGUAGES: {", ".join(request.get("target_languages", []))}
TARGET REGIONS: {", ".join(request.get("target_regions", []))}
VOLUME NEEDED: {request.get("volume_needed", "Not specified")} contributors
TASK DETAILS: {task_description}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "campaign_objective": "One sentence describing the recruitment goal",
  "messaging_strategy": {{
    "primary_message": "The single most important thing a potential contributor should know",
    "value_propositions": [
      "Earn from home on your own schedule",
      "Use your language skills to shape AI",
      "No experience needed — we train you",
      "Get paid weekly via your preferred method",
      "Join a global community of 500,000+ contributors"
    ],
    "tone": "friendly, inviting, opportunity-focused"
  }},
  "target_audience": {{
    "persona": "A short description of the ideal contributor",
    "profile_types": ["students", "freelancers", "stay-at-home parents", "multilingual professionals"],
    "motivations": ["extra income", "flexible schedule", "meaningful work in AI", "use language skills"],
    "pain_points": ["uncertain gig economy", "limited remote work options", "undervalued language skills"]
  }},
  "content_language": {{
    "primary": "The primary language for ad copy",
    "secondary": "Optional secondary language",
    "rationale": "Why these languages were chosen for the target regions"
  }},
  "channels": {{
    "primary": ["linkedin_feed", "facebook_feed"],
    "secondary": ["telegram_card", "indeed_banner"],
    "rationale": "Why these channels reach the target audience"
  }}
}}

RULES:
- Value propositions must focus on CONTRIBUTOR benefits, not company benefits.
- Think 'Earn $X/hour from home' NOT 'We are hiring annotators'.
- Persona must be specific to the target region and language.
- Channels must be relevant to the target region (e.g. Telegram for CIS, LINE for Japan).{feedback_section}"""


def build_eval_prompt(brief: dict, request: dict) -> str:
    """Build the prompt for evaluating a generated brief."""
    import json

    return f"""Evaluate this recruitment marketing brief for OneForma.

BRIEF:
{json.dumps(brief, indent=2, ensure_ascii=False)}

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
{json.dumps(brief, indent=2, ensure_ascii=False)}

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
