"""Persona Engine — generates target contributor personas from task requirements.

Once we know the job type, required skills, target regions, and languages,
we generate 3 distinct personas representing the types of people most
likely to sign up. These personas then FEED:
- Actor identity cards (each actor embodies a persona)
- Creative briefs (messaging tailored to persona pain points)
- Ad copy (different hooks per persona)
- Channel strategy (where each persona spends time)
- Psychology hooks (which biases to leverage per persona)

Inspired by the customer-research and product-marketing-context skills
from the marketingskills framework.
"""
from __future__ import annotations

import json
import random
from typing import Any

# ---------------------------------------------------------------------------
# System prompt used when the LLM customises personas for a campaign
# ---------------------------------------------------------------------------

PERSONA_SYSTEM_PROMPT = (
    "You are a contributor-recruitment psychologist for OneForma.\n\n"
    "Given an intake request and a base archetype, you generate a hyper-specific "
    "persona — a fictional but realistic person who would sign up for this exact "
    "task. Include their name, age, daily routine, what motivates them, what "
    "scares them, what they scroll past, and what stops their thumb.\n\n"
    "Your output feeds directly into actor generation (visual identity), "
    "copywriting (hooks and angles), and channel selection (where to place ads).\n\n"
    "Return ONLY valid JSON. No markdown. No commentary."
)

# ---------------------------------------------------------------------------
# PERSONA_ARCHETYPES — Base templates that get customised per campaign
# ---------------------------------------------------------------------------

PERSONA_ARCHETYPES: dict[str, dict[str, Any]] = {
    "the_student": {
        "archetype": "University Student",
        "age_range": "18-24",
        "lifestyle": "Full-time student, limited schedule, needs flexible side income",
        "motivations": [
            "Extra income for tuition/living",
            "Flexible around class schedule",
            "Meaningful work on resume",
        ],
        "pain_points": [
            "Most part-time jobs conflict with class times",
            "Low hourly pay at service jobs",
            "No relevant work experience",
        ],
        "digital_habitat": [
            "Instagram", "TikTok", "WhatsApp groups",
            "University forums", "Reddit",
        ],
        "psychology_profile": {
            "primary_bias": "effort_minimization",
            "secondary_bias": "social_proof",
            "messaging_angle": "Easy to start, fits around your schedule",
            "trigger_words": [
                "flexible", "no experience needed",
                "between classes", "from your dorm",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Earn money without disrupting studies",
            "emotional": "Feel productive and independent",
            "social": "Have something impressive to talk about",
        },
        "objections": [
            "Is this a scam?",
            "Will it take too much time?",
            "Can I really earn enough?",
        ],
        "best_channels": ["instagram_feed", "tiktok_feed", "facebook_feed"],
    },
    "the_freelancer": {
        "archetype": "Between-Gigs Freelancer",
        "age_range": "24-35",
        "lifestyle": "Experienced freelancer, between projects, needs income bridge",
        "motivations": [
            "Steady income between client projects",
            "Keep skills sharp",
            "Work from anywhere",
        ],
        "pain_points": [
            "Income gaps between freelance gigs",
            "Feast-or-famine cycle",
            "Clients pay late",
        ],
        "digital_habitat": [
            "LinkedIn", "Twitter/X", "Freelancer forums",
            "Upwork/Fiverr communities",
        ],
        "psychology_profile": {
            "primary_bias": "concrete_specificity",
            "secondary_bias": "identity_appeal",
            "messaging_angle": "Reliable income that respects your expertise",
            "trigger_words": [
                "per hour", "steady work",
                "your skills matter", "professional",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Fill income gaps between projects",
            "emotional": "Feel secure and valued",
            "social": "Maintain professional identity",
        },
        "objections": [
            "Is the rate competitive?",
            "Is this beneath my skill level?",
            "How consistent is the work?",
        ],
        "best_channels": ["linkedin_feed", "twitter_post", "google_display"],
    },
    "the_parent": {
        "archetype": "Stay-at-Home Parent",
        "age_range": "26-42",
        "lifestyle": "Primary caregiver, needs work that fits around children's schedule",
        "motivations": [
            "Earn while kids are at school/napping",
            "Contribute to household income",
            "Keep brain active",
        ],
        "pain_points": [
            "Can't commit to fixed hours",
            "Childcare costs eat into earnings",
            "Feel isolated from professional world",
        ],
        "digital_habitat": [
            "Facebook groups", "Instagram",
            "WhatsApp parent groups", "Local community boards",
        ],
        "psychology_profile": {
            "primary_bias": "loss_aversion",
            "secondary_bias": "effort_minimization",
            "messaging_angle": "Finally, work that fits YOUR schedule — not the other way around",
            "trigger_words": [
                "while kids sleep", "your schedule",
                "from home", "no commute",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Earn income without leaving home",
            "emotional": "Feel capable and contributing",
            "social": "Have an identity beyond 'just a parent'",
        },
        "objections": [
            "What if my kid interrupts?",
            "Is the schedule truly flexible?",
            "Do I need special equipment?",
        ],
        "best_channels": ["facebook_feed", "instagram_feed", "facebook_stories"],
    },
    "the_graduate": {
        "archetype": "Recent Graduate",
        "age_range": "21-27",
        "lifestyle": "Just finished education, job hunting, needs income and experience",
        "motivations": [
            "Income while job searching",
            "Build resume/portfolio",
            "Use degree-relevant skills",
        ],
        "pain_points": [
            "Entry-level jobs require experience",
            "Student loan pressure",
            "Overqualified for retail/service",
        ],
        "digital_habitat": [
            "LinkedIn", "Instagram", "TikTok",
            "Job boards", "Reddit",
        ],
        "psychology_profile": {
            "primary_bias": "identity_appeal",
            "secondary_bias": "curiosity_gap",
            "messaging_angle": "Your degree + your languages = real AI work",
            "trigger_words": [
                "launch your career", "AI industry",
                "real experience", "professional development",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Earn while building career credentials",
            "emotional": "Feel like the degree was worth it",
            "social": "Tell people you work in AI",
        },
        "objections": [
            "Is this a real career step?",
            "Will this count as experience?",
            "Is it worth my time vs applying for 'real' jobs?",
        ],
        "best_channels": ["linkedin_feed", "instagram_feed", "indeed_banner"],
    },
    "the_multilingual": {
        "archetype": "Multilingual Professional",
        "age_range": "25-45",
        "lifestyle": (
            "Speaks 2+ languages fluently, may be an immigrant or diaspora, "
            "underemployed relative to skills"
        ),
        "motivations": [
            "Monetize language skills specifically",
            "Work that values their unique abilities",
            "Connect to global tech industry",
        ],
        "pain_points": [
            "Language skills undervalued in local job market",
            "Accent discrimination in other jobs",
            "Qualifications not recognized in new country",
        ],
        "digital_habitat": [
            "Facebook diaspora groups", "WhatsApp community groups",
            "LinkedIn", "Telegram channels",
        ],
        "psychology_profile": {
            "primary_bias": "identity_appeal",
            "secondary_bias": "social_proof",
            "messaging_angle": (
                "Your languages are your superpower — AI companies need "
                "exactly what you have"
            ),
            "trigger_words": [
                "your language", "finally valued",
                "global community", "500K+ contributors",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Get paid for language abilities specifically",
            "emotional": "Feel recognized for a unique skill",
            "social": "Belong to a global community that values diversity",
        },
        "objections": [
            "Do you really need MY specific language?",
            "Is this legitimate?",
            "Can I do this in my country?",
        ],
        "best_channels": ["facebook_feed", "telegram_card", "linkedin_feed"],
    },
    "the_retiree": {
        "archetype": "Active Retiree / Semi-Retired",
        "age_range": "50-68",
        "lifestyle": (
            "Retired or semi-retired, wants to stay mentally active and "
            "earn supplemental income"
        ),
        "motivations": [
            "Mental stimulation",
            "Supplemental income",
            "Feel useful and connected",
        ],
        "pain_points": [
            "Boredom in retirement",
            "Fixed income pressure",
            "Feeling left behind by technology",
        ],
        "digital_habitat": [
            "Facebook", "LinkedIn",
            "Email newsletters", "Local community boards",
        ],
        "psychology_profile": {
            "primary_bias": "social_proof",
            "secondary_bias": "effort_minimization",
            "messaging_angle": (
                "Stay sharp, stay connected, and earn — all from your living room"
            ),
            "trigger_words": [
                "stay active", "mental exercise",
                "at your own pace", "no pressure",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Stay mentally engaged while earning",
            "emotional": "Feel relevant and capable",
            "social": "Have something to contribute",
        },
        "objections": [
            "Is this too technical for me?",
            "Will I be too slow?",
            "Do I need to learn new software?",
        ],
        "best_channels": ["facebook_feed", "google_display", "indeed_banner"],
    },
    "the_techie": {
        "archetype": "Tech-Savvy Side Hustler",
        "age_range": "20-35",
        "lifestyle": (
            "Has a primary job/career but does annotation as skilled side work"
        ),
        "motivations": [
            "Extra income from home",
            "Interest in AI/ML",
            "Skill development in AI field",
        ],
        "pain_points": [
            "Primary job doesn't pay enough",
            "Want exposure to AI industry",
            "Looking for remote side work",
        ],
        "digital_habitat": [
            "Reddit", "Twitter/X", "Hacker News",
            "Discord", "LinkedIn",
        ],
        "psychology_profile": {
            "primary_bias": "curiosity_gap",
            "secondary_bias": "concrete_specificity",
            "messaging_angle": (
                "Train the AI models everyone is talking about — from your laptop"
            ),
            "trigger_words": [
                "AI training data", "behind the scenes",
                "cutting edge", "OpenAI", "Anthropic",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Earn extra income with tech-relevant work",
            "emotional": "Feel part of the AI revolution",
            "social": "Have insider knowledge to share",
        },
        "objections": [
            "Is the rate worth my time vs freelance dev work?",
            "Is this actually meaningful work?",
            "How does annotation help AI?",
        ],
        "best_channels": ["twitter_post", "linkedin_feed", "tiktok_feed"],
    },
    "the_gig_worker": {
        "archetype": "Experienced Gig Economy Worker",
        "age_range": "22-40",
        "lifestyle": (
            "Already does Uber/DoorDash/TaskRabbit type work, looking for "
            "better opportunities"
        ),
        "motivations": [
            "Higher hourly rate than delivery/ride gigs",
            "Work from home (no car expenses)",
            "More interesting work",
        ],
        "pain_points": [
            "Physical gig work is exhausting",
            "Gas/vehicle costs cut into earnings",
            "No sick days or flexibility",
        ],
        "digital_habitat": [
            "Facebook groups", "Reddit r/beermoney r/WorkOnline",
            "TikTok", "Instagram",
        ],
        "psychology_profile": {
            "primary_bias": "concrete_specificity",
            "secondary_bias": "loss_aversion",
            "messaging_angle": (
                "Same flexibility as gig work, but from your couch — "
                "and no gas money"
            ),
            "trigger_words": [
                "$X/hour", "no commute",
                "no car needed", "from home", "better than delivery",
            ],
        },
        "jobs_to_be_done": {
            "functional": "Earn good money without physical labor",
            "emotional": "Feel smart about earning choices",
            "social": "Tell others about a better gig option",
        },
        "objections": [
            "Can I really earn as much as driving?",
            "Is the work boring?",
            "How fast can I start?",
        ],
        "best_channels": ["facebook_feed", "tiktok_feed", "instagram_feed"],
    },
}


# ---------------------------------------------------------------------------
# Scoring weights — used to rank archetypes against intake requirements
# ---------------------------------------------------------------------------

# Task-type affinities: which archetypes are a natural fit for each task kind.
_TASK_TYPE_AFFINITY: dict[str, list[str]] = {
    "audio_annotation": [
        "the_multilingual", "the_student", "the_parent", "the_retiree",
    ],
    "audio_transcription": [
        "the_multilingual", "the_parent", "the_student", "the_freelancer",
    ],
    "image_annotation": [
        "the_techie", "the_student", "the_gig_worker", "the_freelancer",
    ],
    "image_labeling": [
        "the_student", "the_gig_worker", "the_parent", "the_techie",
    ],
    "text_annotation": [
        "the_multilingual", "the_graduate", "the_freelancer", "the_student",
    ],
    "text_evaluation": [
        "the_graduate", "the_multilingual", "the_freelancer", "the_retiree",
    ],
    "video_annotation": [
        "the_techie", "the_student", "the_gig_worker", "the_freelancer",
    ],
    "data_collection": [
        "the_student", "the_gig_worker", "the_parent", "the_multilingual",
    ],
    "content_moderation": [
        "the_freelancer", "the_graduate", "the_techie", "the_gig_worker",
    ],
    "search_relevance": [
        "the_multilingual", "the_techie", "the_graduate", "the_freelancer",
    ],
    "llm_evaluation": [
        "the_techie", "the_graduate", "the_multilingual", "the_freelancer",
    ],
    "translation": [
        "the_multilingual", "the_graduate", "the_student", "the_freelancer",
    ],
    "localization": [
        "the_multilingual", "the_freelancer", "the_graduate", "the_retiree",
    ],
}

# Commitment-level affinities.
_COMMITMENT_AFFINITY: dict[str, list[str]] = {
    "full_time": [
        "the_freelancer", "the_gig_worker", "the_graduate", "the_techie",
    ],
    "part_time": [
        "the_student", "the_parent", "the_retiree", "the_gig_worker",
    ],
    "flexible": [
        "the_student", "the_parent", "the_multilingual", "the_retiree",
    ],
    "project_based": [
        "the_freelancer", "the_techie", "the_graduate", "the_gig_worker",
    ],
}

# Region affinities — some archetypes are more relevant in certain regions.
_REGION_AFFINITY: dict[str, list[str]] = {
    "Latin America": [
        "the_student", "the_parent", "the_multilingual", "the_gig_worker",
    ],
    "Southeast Asia": [
        "the_student", "the_gig_worker", "the_multilingual", "the_techie",
    ],
    "Eastern Europe": [
        "the_freelancer", "the_student", "the_multilingual", "the_techie",
    ],
    "South Asia": [
        "the_student", "the_freelancer", "the_multilingual", "the_techie",
    ],
    "Africa": [
        "the_student", "the_gig_worker", "the_multilingual", "the_graduate",
    ],
    "Middle East": [
        "the_student", "the_multilingual", "the_parent", "the_graduate",
    ],
    "CIS": [
        "the_freelancer", "the_student", "the_multilingual", "the_techie",
    ],
    "East Asia": [
        "the_student", "the_techie", "the_freelancer", "the_retiree",
    ],
    "Western Europe": [
        "the_freelancer", "the_student", "the_techie", "the_graduate",
    ],
    "North America": [
        "the_gig_worker", "the_student", "the_techie", "the_parent",
    ],
}


# ---------------------------------------------------------------------------
# score_archetypes — rank all 8 against the intake data
# ---------------------------------------------------------------------------

def _score_archetypes(intake_data: dict) -> list[tuple[float, str]]:
    """Score each archetype against the intake requirements.

    Returns a list of (score, archetype_key) sorted descending by score.
    """
    task_type = (intake_data.get("task_type") or "").lower().replace(" ", "_")
    regions: list[str] = intake_data.get("target_regions", [])
    languages: list[str] = intake_data.get("target_languages", [])
    form_data: dict = intake_data.get("form_data", {})
    commitment = (
        form_data.get("commitment_level", "")
        or form_data.get("schedule_type", "")
        or "flexible"
    ).lower().replace(" ", "_")
    language_count = len(languages)

    scores: dict[str, float] = {k: 0.0 for k in PERSONA_ARCHETYPES}

    # 1. Task-type match (up to 3 points — decreasing by position)
    affinity_list = _TASK_TYPE_AFFINITY.get(task_type, [])
    for idx, key in enumerate(affinity_list):
        scores[key] += max(3.0 - idx * 0.75, 0.5)

    # 2. Commitment-level match (up to 2 points)
    commitment_list = _COMMITMENT_AFFINITY.get(commitment, _COMMITMENT_AFFINITY["flexible"])
    for idx, key in enumerate(commitment_list):
        scores[key] += max(2.0 - idx * 0.5, 0.25)

    # 3. Region affinity (up to 1.5 points per matching region)
    for region in regions:
        region_list = _REGION_AFFINITY.get(region, [])
        for idx, key in enumerate(region_list):
            scores[key] += max(1.5 - idx * 0.4, 0.2)

    # 4. Language-count bonus — multilingual archetype scores higher when
    #    the campaign needs rare or multiple languages.
    if language_count >= 2:
        scores["the_multilingual"] += 1.5
    if language_count >= 4:
        scores["the_multilingual"] += 1.0

    # 5. Small random jitter so ties don't always resolve the same way.
    for key in scores:
        scores[key] += random.uniform(0, 0.3)

    ranked = sorted(scores.items(), key=lambda t: t[1], reverse=True)
    return [(score, key) for key, score in ranked]


# ---------------------------------------------------------------------------
# generate_personas — the main entry point
# ---------------------------------------------------------------------------

def generate_personas(intake_data: dict, *, count: int = 3) -> list[dict[str, Any]]:
    """Select and customise the top *count* persona archetypes for a campaign.

    This is a deterministic (non-LLM) function that:
    1. Scores all 8 archetypes against the intake requirements.
    2. Picks the top *count* by score.
    3. Customises each with region / language / task specifics.

    The returned personas are ready to be injected into brief generation,
    actor generation, and copy prompts.

    Parameters
    ----------
    intake_data:
        The intake request dict — must contain at minimum ``task_type``,
        ``target_regions``, and ``target_languages``.
    count:
        How many personas to return (default 3).

    Returns
    -------
    list[dict]
        Each dict is a fully-customised persona ready for downstream use.
    """
    ranked = _score_archetypes(intake_data)

    regions: list[str] = intake_data.get("target_regions", []) or ["Global"]
    languages: list[str] = intake_data.get("target_languages", []) or ["English"]
    task_type: str = intake_data.get("task_type", "data annotation")
    form_data: dict = intake_data.get("form_data", {})
    rate_hint = form_data.get("rate", form_data.get("pay_rate", ""))

    personas: list[dict[str, Any]] = []
    used_keys: set[str] = set()

    for score, key in ranked:
        if len(personas) >= count:
            break
        if key in used_keys:
            continue
        used_keys.add(key)

        archetype = PERSONA_ARCHETYPES[key]

        # Assign a region and language (round-robin across personas)
        persona_idx = len(personas)
        region = regions[persona_idx % len(regions)]
        language = languages[persona_idx % len(languages)]

        persona = _customise_persona(
            archetype_key=key,
            archetype=archetype,
            region=region,
            language=language,
            task_type=task_type,
            rate_hint=str(rate_hint) if rate_hint else "",
            score=score,
        )
        personas.append(persona)

    return personas


# ---------------------------------------------------------------------------
# _customise_persona — flesh out an archetype for a specific campaign
# ---------------------------------------------------------------------------

def _customise_persona(
    *,
    archetype_key: str,
    archetype: dict[str, Any],
    region: str,
    language: str,
    task_type: str,
    rate_hint: str,
    score: float,
) -> dict[str, Any]:
    """Customise a base archetype into a campaign-specific persona."""
    age_range = archetype["age_range"]
    low, high = (int(x) for x in age_range.split("-"))
    age = random.randint(low, high)

    # Build a persona name hint (the LLM will generate the real name later,
    # but we provide a placeholder pattern for deterministic pipelines).
    name = _generate_placeholder_name(archetype_key, region)

    psychology = archetype["psychology_profile"]
    rate_str = f"${rate_hint}/hr" if rate_hint else "competitive pay"

    # Build a messaging hook that combines the persona's psychology with
    # the specific task and language.
    messaging_hook = _build_hook(
        psychology=psychology,
        language=language,
        task_type=task_type,
        rate_hint=rate_str,
    )

    # Derive actor seed hints from the archetype lifestyle and region.
    actor_seed_hints = _build_actor_seed_hints(archetype_key, archetype, region)

    # Build objection handlers specific to OneForma.
    objection_handlers = _build_objection_handlers(archetype["objections"])

    return {
        "archetype_key": archetype_key,
        "archetype_label": archetype["archetype"],
        "persona_name": f"{name} — {archetype['archetype']} in {region}",
        "age": age,
        "region": region,
        "language": language,
        "lifestyle": archetype["lifestyle"],
        "customized_motivation": _localise_motivation(archetype, language, task_type),
        "customized_pain": _localise_pain(archetype, region),
        "motivations": archetype["motivations"],
        "pain_points": archetype["pain_points"],
        "messaging_hook": messaging_hook,
        "psychology_hooks": [
            psychology["primary_bias"],
            psychology["secondary_bias"],
        ],
        "psychology_profile": psychology,
        "jobs_to_be_done": archetype["jobs_to_be_done"],
        "digital_habitat": archetype["digital_habitat"],
        "best_channels": archetype["best_channels"],
        "objections": archetype["objections"],
        "objection_handlers": objection_handlers,
        "actor_seed_hints": actor_seed_hints,
        "score": round(score, 2),
    }


# ---------------------------------------------------------------------------
# build_persona_brief_prompt — inject personas into brief generation
# ---------------------------------------------------------------------------

def build_persona_brief_prompt(personas: list[dict], brief: dict) -> str:
    """Inject persona data into the brief so all downstream messaging is tailored.

    This is called AFTER the initial brief is generated and BEFORE design
    direction. The personas enrich the brief's target_audience section with
    specific pain points, motivations, channels, and psychology hooks.

    Parameters
    ----------
    personas:
        List of customised persona dicts (output of ``generate_personas``).
    brief:
        The creative brief dict from Stage 1 brief generation.

    Returns
    -------
    str
        A prompt section that can be appended to the design-direction prompt
        or used to re-score the brief.
    """
    persona_blocks: list[str] = []
    all_channels: set[str] = set()
    all_hooks: set[str] = set()

    for i, p in enumerate(personas, 1):
        all_channels.update(p.get("best_channels", []))
        all_hooks.update(p.get("psychology_hooks", []))

        block = (
            f"PERSONA {i}: {p['persona_name']}\n"
            f"  Age: {p['age']} | Language: {p['language']} | Region: {p['region']}\n"
            f"  Lifestyle: {p['lifestyle']}\n"
            f"  Motivation: {p.get('customized_motivation', p.get('motivation', ''))}\n"
            f"  Pain point: {p.get('customized_pain', p.get('pain_point', ''))}\n"
            f"  Messaging hook: {p.get('messaging_hook', '')}\n"
            f"  Psychology: {', '.join(p.get('psychology_hooks', []))}\n"
            f"  Best channels: {', '.join(p.get('best_channels', []))}\n"
            f"  Jobs-to-be-done: {json.dumps(p.get('jobs_to_be_done', {}), ensure_ascii=False, default=str)}"
        )
        persona_blocks.append(block)

    return f"""TARGET PERSONAS (these personas MUST inform all messaging decisions):

{chr(10).join(persona_blocks)}

PERSONA-DRIVEN REQUIREMENTS:
- Each persona's pain points should appear as messaging angles in the brief.
- Each persona's motivations should map to specific value propositions.
- Channel strategy MUST include: {', '.join(sorted(all_channels))}
- Psychology hooks to leverage: {', '.join(sorted(all_hooks))}
- Each persona gets their own ad variant — do NOT write generic one-size-fits-all copy.
"""


# ---------------------------------------------------------------------------
# build_persona_actor_prompt — generate an actor FROM a persona
# ---------------------------------------------------------------------------

def build_persona_actor_prompt(
    persona: dict[str, Any],
    region: str,
    language: str,
) -> str:
    """Generate an LLM prompt for creating an actor identity card derived
    from a specific persona.

    Instead of generating a generic actor per region, the actor's identity,
    setting, outfit, and vibe all come from the persona archetype.

    Parameters
    ----------
    persona:
        A single customised persona dict.
    region:
        Target region for cultural authenticity.
    language:
        Target language.

    Returns
    -------
    str
        A prompt string to send to the actor-generation LLM.
    """
    hints = persona.get("actor_seed_hints", {})
    psychology = persona.get("psychology_profile", {})
    jtbd = persona.get("jobs_to_be_done", {})

    return f"""Create an AI UGC actor identity card for a OneForma recruitment ad campaign.

This actor EMBODIES a specific target persona — every detail should make
the target audience think "that looks like ME".

TARGET PERSONA: {persona['persona_name']}
ARCHETYPE: {persona.get('archetype_label', 'Contributor')}
AGE: {persona['age']}
REGION: {region}
LANGUAGE: {language}

PERSONA CONTEXT (the actor must LOOK like this person):
- Lifestyle: {persona.get('lifestyle', '')}
- Motivation: {persona.get('customized_motivation', '')}
- Daily life: {hints.get('occupation', 'Works from home on their laptop')}
- Setting they would be in: {hints.get('setting', 'Home desk or cafe')}
- What they would wear: {hints.get('outfit_hint', 'Casual, comfortable clothes')}

PSYCHOLOGY (the image must TRIGGER these responses in the target audience):
- Primary hook: {psychology.get('primary_bias', 'social_proof')}
- The viewer should think: "{psychology.get('messaging_angle', 'This could be me')}"
- Jobs-to-be-done — functional: {jtbd.get('functional', 'Earn money remotely')}
- Jobs-to-be-done — emotional: {jtbd.get('emotional', 'Feel productive')}

Return ONLY valid JSON matching this EXACT schema:
{{
  "name": "A culturally appropriate first name for {region}",
  "persona_key": "{persona.get('archetype_key', 'unknown')}",
  "face_lock": {{
    "skin_tone_hex": "#HEXCOLOR (realistic for someone from {region})",
    "eye_color": "specific eye color",
    "jawline": "face shape description",
    "hair": "specific hairstyle common in {region} for a {persona.get('archetype_label', 'person')}",
    "nose_shape": "specific description",
    "age_range": "{persona['age'] - 2}-{persona['age'] + 2}",
    "distinguishing_marks": "1-2 unique features"
  }},
  "prompt_seed": "One dense paragraph (80-120 words) describing this EXACT person. Include: ethnicity, age, skin tone hex, face shape, hair, eye color, distinguishing marks, default expression. This person IS a {persona.get('archetype_label', 'contributor')} — their vibe should communicate '{persona.get('customized_motivation', 'earning flexibly')}'.",
  "outfit_variations": {{
    "at_home_working": "{hints.get('outfit_hint', 'Casual clothes')} — annotating data at home",
    "at_home_relaxed": "Relaxed version — couch or bed with laptop",
    "cafe_working": "Slightly more put-together for a cafe",
    "celebrating_earnings": "Same vibe, looking at phone with satisfied expression"
  }},
  "signature_accessory": "ONE item they ALWAYS have (over-ear headphones, earbuds, watch, bracelet, hair clip, glasses — relevant to a {persona.get('archetype_label', 'contributor')})",
  "backdrops": [
    "{hints.get('setting', 'Home desk')} — primary setting",
    "A realistic {region} cafe or public workspace",
    "A realistic {region} outdoor or balcony setting",
    "A close-up framing for story/portrait format"
  ]
}}

RULES:
- This actor is a {persona.get('archetype_label', 'contributor')} aged {persona['age']} in {region}.
- They should look like someone the target persona would IDENTIFY with.
- NOT a stock-photo model. NOT corporate. Real person vibes.
- Age {persona['age'] - 2}-{persona['age'] + 2} (the persona demographic).
- Setting should match the persona's lifestyle: {hints.get('setting', 'home or cafe')}."""


# ---------------------------------------------------------------------------
# build_persona_copy_prompt — persona-specific ad copy generation
# ---------------------------------------------------------------------------

def build_persona_copy_prompt(
    persona: dict[str, Any],
    channel: str,
    language: str,
    brief: dict | None = None,
) -> str:
    """Build a copy-generation prompt section that tailors the ad to a
    specific persona's psychology, pain points, and motivations.

    This is injected INTO the existing ``build_copy_prompt`` flow — it does
    not replace it. The output is a persona-context block that gets prepended
    to the standard copy prompt.

    Parameters
    ----------
    persona:
        A single customised persona dict.
    channel:
        The ad platform key (e.g. ``"facebook_feed"``).
    language:
        Target language for the copy.
    brief:
        Optional creative brief for additional context.

    Returns
    -------
    str
        A prompt section to prepend to the copy generation prompt.
    """
    psychology = persona.get("psychology_profile", {})
    jtbd = persona.get("jobs_to_be_done", {})
    trigger_words = psychology.get("trigger_words", [])

    # Build objection-preemption guidance.
    objection_lines = []
    handlers = persona.get("objection_handlers", {})
    for objection, handler in handlers.items():
        objection_lines.append(f'  - Objection: "{objection}" -> Preempt with: "{handler}"')
    objection_block = "\n".join(objection_lines) if objection_lines else "  (none)"

    return f"""PERSONA-TARGETED COPY (this ad speaks directly to this person):

PERSONA: {persona['persona_name']}
Age: {persona['age']} | Language: {language} | Region: {persona['region']}
Lifestyle: {persona.get('lifestyle', '')}

WHAT THEY CARE ABOUT:
- Motivation: {persona.get('customized_motivation', '')}
- Pain point: {persona.get('customized_pain', '')}
- Functional need: {jtbd.get('functional', '')}
- Emotional need: {jtbd.get('emotional', '')}
- Social need: {jtbd.get('social', '')}

PSYCHOLOGY TO LEVERAGE:
- Primary bias: {psychology.get('primary_bias', '')} — {psychology.get('messaging_angle', '')}
- Secondary bias: {psychology.get('secondary_bias', '')}
- Trigger words to weave in: {', '.join(trigger_words)}

OBJECTION PREEMPTION (address these fears subtly in the copy):
{objection_block}

COPY MUST:
- Sound like it was written FOR this specific person, not a generic audience.
- Use trigger words naturally (not forced).
- Address the persona's #1 pain point in the first line.
- Make the persona's emotional need the subtext.
- Be in {language} and feel native to {persona['region']}.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PLACEHOLDER_NAMES: dict[str, dict[str, list[str]]] = {
    "the_student": {
        "Latin America": ["Sofia", "Mateo", "Valentina"],
        "Southeast Asia": ["Anh", "Priya", "Rizal"],
        "Eastern Europe": ["Katya", "Mateusz", "Ivana"],
        "South Asia": ["Ananya", "Ravi", "Meera"],
        "Africa": ["Amina", "Kwame", "Fatou"],
        "Middle East": ["Fatima", "Omar", "Layla"],
        "CIS": ["Dasha", "Artem", "Alina"],
        "East Asia": ["Yuki", "Wei", "Jimin"],
        "Global": ["Alex", "Sam", "Jordan"],
    },
    "the_freelancer": {
        "Latin America": ["Diego", "Camila", "Andres"],
        "Southeast Asia": ["Tran", "Malee", "Arjun"],
        "Eastern Europe": ["Jan", "Petra", "Nikola"],
        "South Asia": ["Vikram", "Priya", "Amir"],
        "Africa": ["Emeka", "Zara", "Kofi"],
        "Middle East": ["Hassan", "Nour", "Karim"],
        "CIS": ["Sergei", "Yelena", "Dmitri"],
        "East Asia": ["Kenji", "Mei", "Hyun"],
        "Global": ["Chris", "Maya", "Robin"],
    },
    "the_parent": {
        "Latin America": ["Maria", "Carlos", "Ana"],
        "Southeast Asia": ["Linh", "Budi", "Sari"],
        "Eastern Europe": ["Monika", "Tomas", "Eva"],
        "South Asia": ["Sunita", "Rahul", "Deepa"],
        "Africa": ["Nia", "Ibrahim", "Adaeze"],
        "Middle East": ["Mariam", "Youssef", "Hana"],
        "CIS": ["Natasha", "Oleg", "Irina"],
        "East Asia": ["Sakura", "Ming", "Soojin"],
        "Global": ["Sarah", "David", "Lisa"],
    },
    "the_graduate": {
        "Latin America": ["Juan", "Isabella", "Luis"],
        "Southeast Asia": ["Rina", "Kiet", "Mila"],
        "Eastern Europe": ["Lukas", "Zuzana", "Ondrej"],
        "South Asia": ["Neha", "Arjun", "Kavya"],
        "Africa": ["Tendai", "Aisha", "Olumide"],
        "Middle East": ["Dina", "Ali", "Rania"],
        "CIS": ["Maxim", "Yulia", "Pavel"],
        "East Asia": ["Haruto", "Suki", "Taemin"],
        "Global": ["Emma", "Liam", "Zoe"],
    },
    "the_multilingual": {
        "Latin America": ["Lucia", "Fernando", "Bianca"],
        "Southeast Asia": ["Linh", "Raj", "Mei"],
        "Eastern Europe": ["Iveta", "Krzysztof", "Marta"],
        "South Asia": ["Ayesha", "Rohan", "Divya"],
        "Africa": ["Fatoumata", "Moussa", "Chiamaka"],
        "Middle East": ["Leila", "Tariq", "Salma"],
        "CIS": ["Gulnara", "Timur", "Aigul"],
        "East Asia": ["Yuna", "Hao", "Miku"],
        "Global": ["Aria", "Niko", "Leah"],
    },
    "the_retiree": {
        "Latin America": ["Rosa", "Jorge", "Elena"],
        "Southeast Asia": ["Somchai", "Lakshmi", "Phuong"],
        "Eastern Europe": ["Helena", "Miroslav", "Jadwiga"],
        "South Asia": ["Kamala", "Suresh", "Geeta"],
        "Africa": ["Grace", "Baba", "Amara"],
        "Middle East": ["Samira", "Mahmoud", "Aida"],
        "CIS": ["Valentina", "Boris", "Ludmila"],
        "East Asia": ["Akiko", "Liang", "Eunji"],
        "Global": ["Margaret", "Robert", "Helen"],
    },
    "the_techie": {
        "Latin America": ["Santiago", "Daniela", "Nico"],
        "Southeast Asia": ["Quan", "Nisha", "Devi"],
        "Eastern Europe": ["Jakub", "Tereza", "Milos"],
        "South Asia": ["Karthik", "Shreya", "Aditya"],
        "Africa": ["Chidi", "Nalini", "Yemi"],
        "Middle East": ["Amir", "Zahra", "Faisal"],
        "CIS": ["Kirill", "Olga", "Vlad"],
        "East Asia": ["Takumi", "Xin", "Doha"],
        "Global": ["Max", "Luna", "Kai"],
    },
    "the_gig_worker": {
        "Latin America": ["Pedro", "Lorena", "Miguel"],
        "Southeast Asia": ["Tan", "Wati", "Bayu"],
        "Eastern Europe": ["Andrej", "Hana", "Radek"],
        "South Asia": ["Sanjay", "Pooja", "Imran"],
        "Africa": ["Sekou", "Blessing", "Juma"],
        "Middle East": ["Khalid", "Maha", "Waleed"],
        "CIS": ["Ruslan", "Svetlana", "Azamat"],
        "East Asia": ["Ryu", "Ling", "Jinwoo"],
        "Global": ["Jake", "Nina", "Tyler"],
    },
}


def _generate_placeholder_name(archetype_key: str, region: str) -> str:
    """Pick a culturally-plausible placeholder name."""
    names = _PLACEHOLDER_NAMES.get(archetype_key, {})
    region_names = names.get(region, names.get("Global", ["Contributor"]))
    return random.choice(region_names)


def _build_hook(
    *,
    psychology: dict[str, Any],
    language: str,
    task_type: str,
    rate_hint: str,
) -> str:
    """Build a messaging hook from the persona's psychology profile."""
    primary = psychology.get("primary_bias", "social_proof")
    trigger_words = psychology.get("trigger_words", [])

    hook_templates: dict[str, str] = {
        "effort_minimization": (
            f"Your {language} is worth {rate_hint} — work between classes"
        ),
        "concrete_specificity": (
            f"Earn {rate_hint} doing {task_type.replace('_', ' ')} from home"
        ),
        "social_proof": (
            f"Join 500K+ contributors using their {language} to shape AI"
        ),
        "identity_appeal": (
            f"Your {language} skills are exactly what AI companies need"
        ),
        "loss_aversion": (
            f"Don't let your {language} skills go to waste — "
            f"{task_type.replace('_', ' ')} tasks available now"
        ),
        "curiosity_gap": (
            f"What if your {language} skills were worth {rate_hint}? "
            f"AI companies are paying."
        ),
    }

    hook = hook_templates.get(primary, hook_templates["social_proof"])

    # Append a trigger word if it fits.
    if trigger_words:
        tw = random.choice(trigger_words)
        if tw.lower() not in hook.lower():
            hook = f"{hook} ({tw})"

    return hook


def _build_actor_seed_hints(
    archetype_key: str,
    archetype: dict[str, Any],
    region: str,
) -> dict[str, str]:
    """Derive actor visual hints from persona archetype and region."""
    setting_map: dict[str, str] = {
        "the_student": "University library or student apartment desk",
        "the_freelancer": "Co-working space or minimalist home office",
        "the_parent": "Kitchen table or living room couch with kids' drawings visible",
        "the_graduate": "Small apartment desk with diploma/books visible",
        "the_multilingual": "Home desk with multiple language books/notes visible",
        "the_retiree": "Comfortable study or living room with reading glasses nearby",
        "the_techie": "Desk with dual monitors, mechanical keyboard, tech stickers",
        "the_gig_worker": "Couch or bed with laptop, phone charger, casual setup",
    }
    occupation_map: dict[str, str] = {
        "the_student": f"Computer science student at a university in {region}",
        "the_freelancer": f"Freelance designer/writer between gigs in {region}",
        "the_parent": f"Stay-at-home parent managing household in {region}",
        "the_graduate": f"Recent graduate job-hunting in {region}",
        "the_multilingual": f"Multilingual professional in {region}",
        "the_retiree": f"Recently retired professional in {region}",
        "the_techie": f"Software developer doing AI side work in {region}",
        "the_gig_worker": f"Former delivery driver now working remotely in {region}",
    }
    outfit_map: dict[str, str] = {
        "the_student": "University hoodie, laptop bag, earbuds",
        "the_freelancer": "Button-up shirt or clean t-shirt, wireless headphones",
        "the_parent": "Comfortable home clothes — cardigan or soft sweater",
        "the_graduate": "Smart casual — polo or blouse, neat but not corporate",
        "the_multilingual": "Casual professional — culture-appropriate everyday wear",
        "the_retiree": "Comfortable but put-together — reading glasses on head",
        "the_techie": "Tech company t-shirt or hoodie, mechanical keyboard visible",
        "the_gig_worker": "Athleisure or casual streetwear — comfortable for long sits",
    }

    return {
        "occupation": occupation_map.get(archetype_key, f"Contributor in {region}"),
        "setting": setting_map.get(archetype_key, "Home desk with laptop"),
        "outfit_hint": outfit_map.get(archetype_key, "Casual, comfortable clothes"),
    }


def _localise_motivation(archetype: dict, language: str, task_type: str) -> str:
    """Create a one-sentence motivation customised to language + task."""
    primary_motivation = archetype["motivations"][0] if archetype["motivations"] else "Earn flexibly"
    task_readable = task_type.replace("_", " ")
    return f"{primary_motivation} by doing {task_readable} tasks using {language}"


def _localise_pain(archetype: dict, region: str) -> str:
    """Create a one-sentence pain point customised to region."""
    primary_pain = archetype["pain_points"][0] if archetype["pain_points"] else "Limited remote work"
    return f"{primary_pain} — especially in {region} where options are limited"


def _build_objection_handlers(objections: list[str]) -> dict[str, str]:
    """Build standard OneForma objection handlers."""
    handlers: dict[str, str] = {}
    handler_map: dict[str, str] = {
        "Is this a scam?": (
            "OneForma is owned by Centific, a $200M+ company working with "
            "OpenAI and Google"
        ),
        "Will it take too much time?": (
            "Work as little as 4 hours a week — it's up to you"
        ),
        "Can I really earn enough?": (
            "Our top contributors earn $300-800/month working part-time"
        ),
        "Is the rate competitive?": (
            "Rates range from $12-25/hr depending on task type and language"
        ),
        "Is this beneath my skill level?": (
            "You'd be training AI models for companies like OpenAI — "
            "it's intellectually engaging work"
        ),
        "How consistent is the work?": (
            "We have ongoing projects — most contributors work for months "
            "or years"
        ),
        "What if my kid interrupts?": (
            "Totally fine — tasks are self-paced. Pause and resume anytime."
        ),
        "Is the schedule truly flexible?": (
            "100% — log in when you want, work as much or little as you want"
        ),
        "Do I need special equipment?": (
            "Just a laptop and internet connection. That's it."
        ),
        "Is this a real career step?": (
            "Many contributors use OneForma as a launchpad into AI careers"
        ),
        "Will this count as experience?": (
            "Absolutely — 'AI Data Annotator' on a resume opens doors"
        ),
        "Is it worth my time vs applying for 'real' jobs?": (
            "Do both — OneForma is flexible enough to work alongside "
            "your job search"
        ),
        "Do you really need MY specific language?": (
            "Yes — AI models need native-level judgment in every language "
            "they support"
        ),
        "Is this legitimate?": (
            "OneForma has 500K+ contributors worldwide and is backed by "
            "Centific, a Fortune 1000 partner"
        ),
        "Can I do this in my country?": (
            "OneForma operates in 70+ countries — check our available "
            "projects for your region"
        ),
        "Is this too technical for me?": (
            "Not at all — we provide training for every project. "
            "If you can browse the internet, you can do this."
        ),
        "Will I be too slow?": (
            "There's no speed requirement — quality matters more than speed"
        ),
        "Do I need to learn new software?": (
            "Our platform is browser-based — no downloads, no installs"
        ),
        "Is the rate worth my time vs freelance dev work?": (
            "It's a great supplement — many devs do annotation in "
            "downtime for steady income"
        ),
        "Is this actually meaningful work?": (
            "You're literally teaching AI to understand human language — "
            "it doesn't get more meaningful"
        ),
        "How does annotation help AI?": (
            "Every label you add teaches the model to be more accurate — "
            "you're the human behind the AI"
        ),
        "Can I really earn as much as driving?": (
            "Many contributors earn $12-18/hr — with zero gas or "
            "vehicle costs"
        ),
        "Is the work boring?": (
            "Tasks vary — audio, image, text, video. Most contributors "
            "find it surprisingly engaging."
        ),
        "How fast can I start?": (
            "Sign up takes 5 minutes. Most people get their first task "
            "within 48 hours."
        ),
    }

    for objection in objections:
        handlers[objection] = handler_map.get(
            objection,
            "OneForma is a trusted platform with 500K+ contributors worldwide.",
        )

    return handlers


# ---------------------------------------------------------------------------
# apply_cultural_research — enrich personas with cultural research data
# ---------------------------------------------------------------------------

def apply_cultural_research(
    personas: list[dict[str, Any]],
    research: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Enrich personas with cultural research findings.

    This is a convenience wrapper that delegates to
    ``cultural_research.apply_research_to_personas``. It exists here so
    callers working with the persona engine don't need to import a
    separate module.

    Adjustments:
    - If AI fatigue is HIGH: remove "AI" from messaging, reframe as
      "flexible remote work".
    - If gig work is STIGMATIZED: frame as "professional freelance" not
      "gig work".
    - If trust is LOW: add trust signals (company size, known clients,
      payment proof).
    - If platform reality differs from defaults: override best_channels.
    - If economic context shows low wages: adjust rate framing.
    - Add cultural sensitivity notes to each persona.
    - Add language nuance to copy guidance.

    Parameters
    ----------
    personas:
        List of persona dicts from ``generate_personas``.
    research:
        Dict keyed by region from cultural research.

    Returns
    -------
    list[dict]
        The same personas, enriched with cultural context.
    """
    from prompts.cultural_research import apply_research_to_personas

    return apply_research_to_personas(personas, research)


# =========================================================================
# LLM-POWERED DYNAMIC PERSONA GENERATION (Qwen 397B via NIM)
# =========================================================================

PERSONA_GEN_SYSTEM = """You are an expert recruitment marketing strategist.
Generate 3 DISTINCT target personas for a specific recruitment campaign.

Each persona must be a REAL person profile — not a generic archetype.
Base your personas on the cultural research data and job description provided.

For each persona, output:
- archetype_key: a snake_case key (e.g., "seattle_tech_worker", "diverse_local_resident")
- archetype: human-readable title (e.g., "Seattle Tech Professional")
- persona_name: a realistic first name appropriate for the region
- age: specific age (not range)
- age_range: range like "25-35"
- region: which target region this persona is from
- language: primary language
- lifestyle: 1-2 sentence description of their daily life
- motivations: list of 3 specific reasons they'd sign up for THIS project
- pain_points: list of 3 specific barriers or concerns they'd have about THIS project
- objections: list of 3 things they'd say to push back ("Is this legit?", etc.)
- digital_habitat: list of 5 platforms where they spend time (be specific to the region)
- best_channels: list of 3 ad platforms to reach them
- psychology_profile: {
    primary_bias: which cognitive bias to leverage (e.g., "social_proof", "loss_aversion"),
    secondary_bias: second bias,
    messaging_angle: the core message that would resonate,
    trigger_words: list of 4-5 words/phrases that would catch their attention
  }
- jobs_to_be_done: list of 3 "jobs" this person is trying to accomplish by signing up
- score: relevance score 0-3 (how likely they are to convert for THIS specific project)
- targeting_profile: {
    demographics: {
      age_min: integer (lower bound of age_range),
      age_max: integer (upper bound of age_range),
      gender: "all" | "male" | "female",
      education_level: "high_school" | "university" | "graduate" | "any",
      occupation: specific job title or "student" or "freelancer",
      income_bracket: "low" | "medium" | "high",
      languages: list of languages this persona speaks,
      relationship_status: "single" | "married" | "any"
    },
    interests: {
      hyper: list of 3+ VERY specific interests related to the task (e.g., "AI data labeling", "voice recording freelance", "linguistic research" — NOT generic like "technology"),
      hot: list of 2-3 stacked interests (e.g., "side hustle" + "flexible work schedule"),
      broad: list of 3-5 wider interests to cover the full target base (e.g., "part time jobs", "online earning", "university life")
    },
    behaviors: list of 3 behavioral traits (e.g., "smartphone power user", "mobile payment user", "online course taker"),
    psychographics: {
      values: list of 3 core values,
      pain_points: same as persona pain_points (reference),
      media_consumption: list of platform + usage patterns (e.g., "TikTok 2hrs/day", "WhatsApp groups")
    },
    estimated_pool_size: "large" | "medium" | "small" — how many people match this targeting in the region,
    expected_cpl_tier: "low" | "medium" | "high" — estimated cost per lead on primary channels,
    budget_weight_pct: integer 1-100 — what % of budget this persona should get (all personas must sum to 100)
  }

CRITICAL:
- Personas must be DIFFERENT from each other (different demographics, different motivations)
- Personas must be SPECIFIC to the project location, compensation, and requirements
- Use the cultural research to inform platform choices and messaging
- Think about WHO would actually show up for this — not who you wish would show up
- targeting_profile.interests.hyper MUST be specific to the task type. For audio recording → "voice acting", "podcast production", "audiobook narration". For data annotation → "AI training data", "data labeling", "machine learning datasets". NEVER generic like "technology" or "AI".
- budget_weight_pct across all personas MUST sum to exactly 100
- estimated_pool_size should reflect actual market size in the target region based on cultural research

OUTPUT: Return a JSON array of 3 persona objects. No markdown, no commentary.
"""


async def generate_personas_llm(
    intake_data: dict,
    cultural_research: dict | None = None,
    count: int = 3,
) -> list[dict]:
    """Generate personas dynamically using Qwen 397B + cultural research.

    Instead of picking from 8 hardcoded archetypes, the LLM creates
    CUSTOM personas based on the actual project description, location,
    compensation, requirements, and cultural research findings.

    Falls back to the old deterministic method if LLM fails.
    """
    import json
    import logging
    logger = logging.getLogger(__name__)

    form_data = intake_data.get("form_data", {})

    # Build the project context for the LLM
    project_context = f"""
PROJECT DETAILS:
- Title: {intake_data.get("title", "Unknown")}
- Task type: {intake_data.get("task_type", "Unknown")}
- Description: {json.dumps(form_data.get("description", ""), default=str)[:500]}
- Compensation: {json.dumps(form_data.get("compensation", {}), default=str)}
- Location: {json.dumps(form_data.get("location", {}), default=str)}
- Requirements: {json.dumps(form_data.get("requirements", {}), default=str)[:500]}
- Time commitment: {json.dumps(form_data.get("time_commitment", {}), default=str)}
- Target regions: {intake_data.get("target_regions", [])}
- Target languages: {intake_data.get("target_languages", [])}
- Volume needed: {intake_data.get("volume_needed", "Unknown")}
- Key selling points: {json.dumps(form_data.get("key_selling_points", []), default=str)}
- Diversity focus: {form_data.get("diversity_focus", "")}
"""

    # Add cultural research if available
    research_context = ""
    if cultural_research:
        for region, data in cultural_research.items():
            if isinstance(data, dict):
                research_context += f"\nCULTURAL RESEARCH — {region}:\n"
                for dim, val in data.items():
                    if isinstance(val, str) and len(val) > 20:
                        research_context += f"  {dim}: {val[:300]}\n"

    # Add archetype examples (for inspiration, not as templates)
    archetype_examples = "\nEXAMPLE ARCHETYPES (for inspiration — create CUSTOM personas, don't copy these):\n"
    for key, arch in list(PERSONA_ARCHETYPES.items())[:4]:
        archetype_examples += f"- {arch['archetype']} ({arch['age_range']}): {arch['lifestyle']}\n"

    user_prompt = (
        f"{project_context}\n"
        f"{research_context}\n"
        f"{archetype_examples}\n"
        f"Generate {count} CUSTOM personas specifically for this project. "
        f"Return a JSON array of {count} persona objects."
    )

    try:
        from ai.local_llm import generate_text
        result = await generate_text(
            PERSONA_GEN_SYSTEM,
            user_prompt,
            thinking=True,
            max_tokens=8192,
            temperature=0.7,
        )

        # Parse JSON
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()

        # Try direct parse
        try:
            personas = json.loads(cleaned)
            if isinstance(personas, list) and len(personas) >= 1:
                logger.info(
                    "LLM generated %d dynamic personas: %s",
                    len(personas),
                    [p.get("archetype_key", "?") for p in personas],
                )
                return personas[:count]
        except json.JSONDecodeError:
            pass

        # Search for JSON array in text
        bracket_depth = 0
        arr_start = -1
        for i, char in enumerate(cleaned):
            if char == '[':
                if bracket_depth == 0:
                    arr_start = i
                bracket_depth += 1
            elif char == ']':
                bracket_depth -= 1
                if bracket_depth == 0 and arr_start >= 0:
                    candidate = cleaned[arr_start:i+1]
                    try:
                        parsed = json.loads(candidate)
                        if isinstance(parsed, list) and len(parsed) >= 1:
                            logger.info(
                                "LLM generated %d dynamic personas (extracted): %s",
                                len(parsed),
                                [p.get("archetype_key", "?") for p in parsed],
                            )
                            return parsed[:count]
                    except json.JSONDecodeError:
                        pass
                    arr_start = -1

        logger.warning("LLM persona generation failed to parse — falling back to deterministic")

    except Exception as e:
        logger.warning("LLM persona generation failed: %s — falling back to deterministic", e)

    # Fallback: old deterministic method
    return generate_personas(intake_data, count=count)
