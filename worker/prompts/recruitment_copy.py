"""Recruitment-specific prompts for ad copy generation (Stage 3).

OneForma is the AI platform that sees the expert in everyone. This file
contains the Stage 3 (ad copy) LLM prompts. All brand voice content
(tagline, tone rules, pillars, CTAs, hero templates, operational context)
is sourced from the single-source-of-truth brand module at `worker/brand/`.

Stage 3 generates platform-specific ad copy in the contributor's native
language. For every persona × platform, exactly 3 variations are produced —
one per brand pillar (Earn / Grow / Shape). Each variation uses the hero
copy template for its pillar; the persona's psychology profile is used
only as a secondary signal to pick a sub-variation within the pillar.

Each platform returns the EXACT fields and character limits that the real
ad platform expects. Field names in the output JSON schema are preserved
verbatim so downstream composition and display components keep working.
"""
from __future__ import annotations

import json
from typing import Any

from prompts.ethical_positioning import (
    apply_ethical_framing,
    build_ethical_copy_prompt,
    detect_sensitivity,
)

from brand import (
    TAGLINE,
    POSITIONING,
    TONE_RULES,
    WORDS_TO_AVOID,
    PILLARS,
    HERO_TEMPLATES_BY_PILLAR,
    CTA_PRIMARY,
    CTA_SECONDARY,
    get_cta,
    TRUST_STRIP,
    OPERATIONAL_CONTEXT,
    build_brand_voice_block,
)

# ---------------------------------------------------------------------------
# Re-export ethical helpers so existing imports still work.
# ---------------------------------------------------------------------------
__all__ = [
    "COPY_SYSTEM_PROMPT",
    "COPY_EVAL_SYSTEM_PROMPT",
    "PLATFORM_AD_SPECS",
    "MARKETING_PSYCHOLOGY",
    "build_copy_prompt",
    "build_copy_eval_prompt",
    "build_persona_copy_prompt",
    "build_persona_targeted_copy_prompt",
    "build_variation_prompts",
    "select_psychology_hooks",
    "extract_available_facts",
    "apply_ethical_framing",
    "detect_sensitivity",
]


# ---------------------------------------------------------------------------
# build_persona_copy_prompt — persona context block for copy generation
# (inlined from worker/prompts/persona_engine.py in Task 18/19; operates on
# the dynamic persona schema produced by build_persona_prompt)
# ---------------------------------------------------------------------------

def build_persona_copy_prompt(
    persona: dict,
    channel: str,
    language: str,
    brief: dict | None = None,
) -> str:
    """Build a copy-generation context block that tailors the ad to one persona."""
    del channel, brief  # reserved for future platform-aware tuning
    psychology = persona.get("psychology_profile", {}) or {}
    raw_jtbd = persona.get("jobs_to_be_done", {})
    if isinstance(raw_jtbd, list):
        jtbd = {
            "functional": raw_jtbd[0] if raw_jtbd else "",
            "emotional": raw_jtbd[1] if len(raw_jtbd) > 1 else "",
            "social": raw_jtbd[2] if len(raw_jtbd) > 2 else "",
        }
    elif isinstance(raw_jtbd, dict):
        jtbd = raw_jtbd
    else:
        jtbd = {}
    trigger_words = psychology.get("trigger_words", []) or []

    motivations = persona.get("motivations", []) or []
    pain_points = persona.get("pain_points", []) or []
    primary_motivation = motivations[0] if motivations else ""
    primary_pain = pain_points[0] if pain_points else ""

    persona_name = (
        persona.get("name")
        or persona.get("persona_name")
        or persona.get("matched_tier")
        or "this person"
    )

    objections = persona.get("objections", []) or []
    objection_block = (
        "\n".join(f'  - "{o}"' for o in objections[:3]) if objections else "  (none)"
    )

    region = persona.get("region") or (
        persona.get("age_range", "") and ""
    ) or "target region"

    return f"""PERSONA-TARGETED COPY (this ad speaks directly to this person):

PERSONA: {persona_name}
Archetype: {persona.get("archetype", "")}
Matched tier: {persona.get("matched_tier", "")}
Age range: {persona.get("age_range", "")} | Language: {language} | Region: {region}
Lifestyle: {persona.get("lifestyle", "")}

WHAT THEY CARE ABOUT:
- Motivation: {primary_motivation}
- Pain point: {primary_pain}
- Functional need: {jtbd.get("functional", "")}
- Emotional need: {jtbd.get("emotional", "")}
- Social need: {jtbd.get("social", "")}

PSYCHOLOGY TO LEVERAGE:
- Primary bias: {psychology.get("primary_bias", "")} — {psychology.get("messaging_angle", "")}
- Secondary bias: {psychology.get("secondary_bias", "")}
- Trigger words to weave in: {", ".join(trigger_words)}

OBJECTIONS TO PREEMPT (address these fears subtly in the copy):
{objection_block}

COPY MUST:
- Sound like it was written FOR this specific person, not a generic audience.
- Use trigger words naturally (not forced).
- Address the persona's #1 pain point in the first line.
- Make the persona's emotional need the subtext.
- Be in {language} and feel native.
"""

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_BANNED_WORDS_INLINE = ", ".join(WORDS_TO_AVOID)

COPY_SYSTEM_PROMPT = f"""You are a brand copywriter for OneForma, the AI platform that sees the expert in everyone.

OneForma positioning (internal reference):
{POSITIONING}

Public trust strip (safe to paraphrase as supporting proof, never as the lead):
{TRUST_STRIP}

═══════════════════════════════════════════════════════════════════════
OPERATIONAL CONTEXT (INTERNAL REASONING ONLY — NEVER QUOTE VERBATIM)
═══════════════════════════════════════════════════════════════════════
{OPERATIONAL_CONTEXT}
═══════════════════════════════════════════════════════════════════════

The operational context above is for YOUR reasoning only. Do NOT quote any
sentence from it in your output. All user-facing ad copy must follow the
BRAND VOICE block below exactly.

═══════════════════════════════════════════════════════════════════════
{build_brand_voice_block()}
═══════════════════════════════════════════════════════════════════════

OUTPUT LANGUAGE RULES (binding):
- Every headline, body line, description, and button label you write must
  read as if authored by the brand voice above — expertise-first, human-first,
  purposeful, and specific.
- Lead with the expert's expertise, not the task and not the payout.
  Compensation, flexibility, and payout mechanics are proof points only —
  never the hook.
- Your output copy must draw on the expertise-first vocabulary
  (expert, expertise, recognize, recognition, worth, worthy, respected, every
  walk of life, earn, grow, shape, collaborator, native, global).
- Your output copy must NEVER contain any of these banned words or phrases:
  {_BANNED_WORDS_INLINE}
  If ANY banned word appears in your output, the output is automatically
  rejected and regenerated.
- Refer to people as experts, collaborators, or by their specific expertise
  (e.g. "native Tagalog speakers", "physics PhDs", "cardiologists",
  "multilingual professionals") — never as workers, resources, crowd,
  annotators alone, or by any commodity-labor framing.
- Use the target language natively. It must read as if written by a native
  speaker, not translated.
- Use LOCAL CURRENCY when mentioning money (R$ for Brazil, ₹ for India, etc.)
  and only as a proof point after the expertise-led hook.

THREE-VARIATION RULE (binding):
- For every persona × platform, you generate exactly 3 copy variations —
  one per brand pillar: Earn, Grow, and Shape.
- Each variation uses the hero copy template for its pillar:
    Earn  → "Put your {{expertise}} to work. From wherever you are."
    Grow  → "Build the AI experience your career deserves."
    Shape → "Your {{profession}} expertise is exactly what AI is missing."
- The persona's psychology profile (primary_bias, secondary_bias) still
  informs which sub-variation within the pillar to pick, but the PRIMARY
  axis of variation is pillar — not psychology bias.
- Each variation must carry a "pillar" field set to exactly one of
  "earn", "grow", or "shape" so downstream composition knows which angle
  the copy is aimed at.

CTA RULES:
- Earn angle  → CTA_PRIMARY   ("Put your expertise to work" or an approved variation)
- Grow angle  → CTA_SECONDARY ("Find a project that knows your worth" or an approved variation)
- Shape angle → CTA_SECONDARY
- Never invent a new CTA. Pick from the approved list in the brand module.

OUTPUT FORMAT — STRICT:
- Return ONLY valid JSON matching the exact schema shown in the user prompt.
- No markdown code fences. No commentary before or after the JSON.
- No trailing commas, no single quotes, no unquoted keys.
- Respect every character limit — count carefully before returning.
- Every field name in the schema is binding: do not rename, add, or drop
  fields. The only new field you introduce is "pillar" where the schema
  asks for it.
"""

COPY_EVAL_SYSTEM_PROMPT = f"""You evaluate OneForma ad copy for brand voice
compliance and platform fit.

OneForma is the AI platform that sees the expert in everyone. Its copy must
be expertise-first, human-first, purposeful, and specific. Lead with the
expert, not the task or the payout. Compensation is a supporting proof
point only — never the hook.

Your job is to verify that every copy variation:
1. Matches the brand voice block below
2. Contains the EXACT fields required by the target platform
3. Stays within every character limit for that platform
4. Uses NONE of the banned words or phrases below
5. Clearly embodies exactly one of the three brand pillars
   (Earn, Grow, Shape) without ambiguity

═══════════════════════════════════════════════════════════════════════
{build_brand_voice_block()}
═══════════════════════════════════════════════════════════════════════

BANNED WORDS (automatic score 0 on brand_voice_compliance if ANY appear):
{_BANNED_WORDS_INLINE}
"""

# ---------------------------------------------------------------------------
# PLATFORM_AD_SPECS — real platform fields, limits, tone, and examples
# ---------------------------------------------------------------------------
#
# CTA selection is NOT hardcoded per platform. For every variation, the CTA
# is resolved at generation time by the LLM using the pillar it is writing
# for, via get_cta(pillar=variation.pillar, lang=campaign.language) from the
# worker.brand module. The cta_guidance field below is documentation for the
# LLM; platforms that accept a free-form button label get an approved CTA
# variation directly, while platforms with fixed intent buckets (Meta, etc.)
# map the chosen CTA string to the closest platform intent at composition
# time, not at copy-generation time.

_CTA_GUIDANCE = (
    "Use get_cta(pillar=variation.pillar, lang=campaign.language) from "
    "worker.brand. Earn → CTA_PRIMARY; Grow/Shape → CTA_SECONDARY. "
    "Never invent new CTAs."
)

PLATFORM_AD_SPECS: dict[str, dict[str, Any]] = {
    # ----- Meta (Facebook/Instagram) Feed Ads -----
    "facebook_feed": {
        "fields": {
            "primary_text": "Main body text above the image — this is where the expertise-led hook lives.",
            "headline": "Bold text below the image.",
            "description": "Gray text below headline.",
            "cta_button": "Approved CTA variation for the pillar of this variation.",
            "display_link": "Short display URL shown to user.",
        },
        "char_limits": {
            "primary_text": {"recommended": 125, "max": 2200},
            "headline": {"recommended": 27, "max": 40},
            "description": {"recommended": 27, "max": 30},
            "display_link": {"max": 30},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Conversational but grounded — like a colleague telling you about a project worthy of your expertise. "
            "Short sentences. Lead with a specific expertise hook, never with a dollar amount. "
            "Emoji use is rare and only when it reinforces the expertise angle."
        ),
        "good_examples": [
            "Your native Tagalog is exactly what AI is missing. Shape how AI talks to 30 million people — from wherever you are.",
            "Put your eye for detail to work. Real projects, real pay, on your schedule.",
            "Already studying ML? Get the real-world AI experience textbooks can't teach.",
        ],
        "bad_examples": [
            "We are hiring for our AI platform",
            "Position: Data Specialist — Competitive Salary",
            "Earn $15/hr from home — no experience needed",
        ],
        "psychology_hooks": [
            "social_proof", "curiosity_gap", "identity_appeal",
        ],
    },

    # ----- Meta Stories/Reels Ads -----
    "facebook_stories": {
        "fields": {
            "primary_text": "Overlay text on the creative — ultra-short expertise hook.",
            "cta_button": "Approved CTA variation for the pillar of this variation.",
            "sticker_text": "Optional — short label like 'Projects in your language' or 'Your expertise wanted'.",
        },
        "char_limits": {
            "primary_text": {"max": 72},
            "sticker_text": {"max": 25},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Ultra-short, punchy, visual-first. One sentence max. "
            "Lead with a specific form of expertise (language, profession, skill). "
            "Feels native to Stories without ever reducing the person to 'a contributor'."
        ),
        "good_examples": [
            "Your Tagalog = an AI that actually understands you.",
            "Your eye for detail. Real projects. Your schedule.",
            "Cardiologist? AI medicine needs your judgment.",
        ],
        "bad_examples": [
            "Competitive compensation for remote work",
            "Seeking contributors for our growing platform",
            "Earn from home — no degree needed",
        ],
        "psychology_hooks": [
            "effort_minimization", "loss_aversion", "curiosity_gap",
        ],
    },

    # ----- LinkedIn Sponsored Content -----
    "linkedin_feed": {
        "fields": {
            "introductory_text": "Professional tone — appears above image. Mobile-optimized.",
            "headline": "Bold text below image.",
            "description": "Supporting text below headline.",
            "cta_button": "Approved CTA variation for the pillar of this variation.",
            "organization_name": "Always 'OneForma by Centific'.",
        },
        "char_limits": {
            "introductory_text": {"recommended": 150, "max": 600},
            "headline": {"max": 70},
            "description": {"max": 100},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Professional and warm — like a peer sharing a project worthy of your expertise. "
            "No emojis. Career-building and expertise-recognition language. "
            "Acknowledge the reader's specific skill, profession, or credential."
        ),
        "good_examples": [
            "Your multilingual fluency is a credential — use it to build AI career experience, not just a side income.",
            "Build the AI experience your career deserves. Real projects, with certifications hiring managers recognize.",
            "Your securities-law experience is exactly what frontier AI is missing.",
        ],
        "bad_examples": [
            "HOT JOB ALERT — We're hiring!",
            "Remote gig work — easy money from home",
            "Flexible part-time role in the AI space",
        ],
        "psychology_hooks": [
            "identity_appeal", "social_proof", "concrete_specificity",
        ],
    },

    # ----- TikTok In-Feed Ads -----
    "tiktok_feed": {
        "fields": {
            "ad_text": "Appears at bottom of video. Conversational, creator-voice.",
            "cta_button": "Approved CTA variation for the pillar of this variation.",
            "display_name": "Always '@OneForma'.",
            "profile_text": "Short description visible on profile tap.",
        },
        "char_limits": {
            "ad_text": {"max": 100},
            "display_name": {"max": 20},
            "profile_text": {"max": 80},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Creator-native, conversational, relatable — speak like a real person who got a project worthy of their skills. "
            "Short, specific, never shouty. Slang is fine when it reinforces the expertise angle; emojis are rare."
        ),
        "good_examples": [
            "POV: you're bilingual and an AI team finally realized that matters.",
            "Real projects, real pay, real feedback on how your work was used.",
            "Studying ML? Put that on a real project before graduation.",
        ],
        "bad_examples": [
            "Apply for quick remote opportunities",
            "We offer flexible part-time work in AI",
            "Competitive rates for qualified linguists",
        ],
        "psychology_hooks": [
            "curiosity_gap", "effort_minimization", "social_proof",
        ],
    },

    # ----- Telegram Sponsored Messages -----
    "telegram_card": {
        "fields": {
            "message_text": "Direct, conversational. No images — text only.",
            "button_text": "Single CTA button label — approved CTA variation for the pillar.",
            "button_url": "Landing page URL.",
        },
        "char_limits": {
            "message_text": {"max": 160},
            "button_text": {"max": 20},
            "button_url": {"max": 100},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Direct, community-oriented — like a group admin sharing a project worth looking at. "
            "No fluff. Specific about what expertise the project needs. Conversational but not slangy."
        ),
        "good_examples": [
            "Your native language is exactly what AI is missing. Real projects, twice-monthly payouts, on your schedule.",
            "AI teams need human judgment from people who actually know the field. OneForma matches you to projects worthy of your expertise.",
            "Put your expertise to work on real AI projects — from wherever you are. No fees, ever.",
        ],
        "bad_examples": [
            "Dear potential contributor, we invite you to explore opportunities",
            "Leading platform seeking talent for exciting positions",
            "Click here for remote work opportunities",
        ],
        "psychology_hooks": [
            "social_proof", "loss_aversion", "concrete_specificity",
        ],
    },

    # ----- Google Display Ads (Responsive) -----
    "google_display": {
        "fields": {
            "headlines": "3-5 short headlines (30 chars each). Google mixes and matches.",
            "long_headline": "Used in larger placements.",
            "descriptions": "2-3 descriptions (90 chars each).",
            "business_name": "Always 'OneForma'.",
            "cta_text": "Optional — only if CTA extension is enabled.",
        },
        "char_limits": {
            "headlines": {"max_per_item": 30, "min_count": 3, "max_count": 5},
            "long_headline": {"max": 90},
            "descriptions": {"max_per_item": 90, "min_count": 2, "max_count": 3},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Concise, expertise-led, high-contrast. Every character counts. "
            "Lead with a specific form of expertise or a pillar promise — never with a dollar amount."
        ),
        "good_examples": [
            "Your Expertise. Real AI Projects.",
            "Put Your Skills To Work",
            "Projects Worthy Of Your Expertise",
        ],
        "bad_examples": [
            "Easy Remote Work",
            "Click Here For Info",
            "Great Opportunity Inside",
        ],
        "psychology_hooks": [
            "concrete_specificity", "effort_minimization", "identity_appeal",
        ],
    },

    # ----- Indeed Sponsored Jobs -----
    "indeed_banner": {
        "fields": {
            "job_title": "Specific and searchable. Not a marketing headline.",
            "company_description": "What OneForma does — for job seekers.",
            "job_highlights": "Up to 3 bullet points.",
            "salary_info": "Optional — rate range if available.",
            "location_type": "Usually 'Remote'.",
        },
        "char_limits": {
            "job_title": {"max": 60},
            "company_description": {"max": 200},
            "job_highlights": {"max_per_item": 50, "max_count": 3},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Job-seeker empathetic — acknowledge the reader's expertise. Professional but warm. "
            "Specific about what the work is and what expertise it recognizes. Honest about flexibility."
        ),
        "good_examples": [
            "Remote AI Project Expert — Native Language Review",
            "Domain Expert Reviewer — Flexible, Asynchronous Projects",
            "Multilingual AI Evaluator — Real Projects, Real Feedback",
        ],
        "bad_examples": [
            "Amazing AI Opportunity!",
            "Easy Remote Work From Home",
            "Data Entry Specialist",
        ],
        "psychology_hooks": [
            "concrete_specificity", "identity_appeal", "effort_minimization",
        ],
    },

    # ----- X (Twitter) Promoted Ads -----
    "twitter_post": {
        "fields": {
            "tweet_text": "Conversational, hashtag-friendly. The main post.",
            "card_headline": "Website card headline.",
            "card_description": "Website card description.",
            "cta": "Approved CTA variation for the pillar of this variation.",
        },
        "char_limits": {
            "tweet_text": {"max": 280},
            "card_headline": {"max": 70},
            "card_description": {"max": 200},
        },
        "cta_guidance": _CTA_GUIDANCE,
        "tone": (
            "Conversational, human, and specific — speak like a real person, not a brand. "
            "Hot takes welcome when they reinforce the expertise-recognition angle. "
            "Hashtags only when they name real expertise (e.g. #NLP, #MedAI, #MultilingualAI)."
        ),
        "good_examples": [
            "Your native language is a credential. AI teams need human judgment from people who actually speak it — and OneForma treats you like the expert you are.",
            "Studying ML? Your real-world AI projects shouldn't start after graduation. Put your expertise on a real project now.",
            "Your cardiology experience is exactly what AI medicine is missing. Real projects, real feedback on how your work shaped the model.",
        ],
        "bad_examples": [
            "OneForma is hiring! Apply now.",
            "Looking for talented people to join our team.",
            "Exciting remote AI role available.",
        ],
        "psychology_hooks": [
            "curiosity_gap", "identity_appeal", "social_proof",
        ],
    },
}

# Backward-compatible alias for imports that reference the old name.
PLATFORM_GUIDANCE = PLATFORM_AD_SPECS


# ---------------------------------------------------------------------------
# MARKETING_PSYCHOLOGY — sub-variation hooks inside each pillar
# ---------------------------------------------------------------------------
#
# Pillars are the primary axis of variation (Earn / Grow / Shape). Psychology
# hooks are the SECONDARY axis — they are used by the LLM to pick the sub-
# variation inside a pillar based on the persona's psychology_profile. No hook
# replaces the pillar's hero template; it only flavors how the template is
# filled in.

MARKETING_PSYCHOLOGY: dict[str, dict[str, Any]] = {
    "social_proof": {
        "description": "People act on what others like them already do",
        "templates": [
            "Join {number}+ experts who already shape AI in their field",
            "{number} experts in {region} are building AI projects this month",
            "Trusted by {number}+ experts from every walk of life",
        ],
        "best_for": ["facebook_feed", "linkedin_feed", "telegram_card"],
    },
    "curiosity_gap": {
        "description": "Open a loop the reader needs to close",
        "templates": [
            "The AI model you use probably has a gap — and your {expertise} might be what closes it",
            "What if your native {language} was the credential AI teams were looking for?",
            "Why AI teams are asking native speakers to shape how their models talk",
        ],
        "best_for": ["tiktok_feed", "facebook_feed", "twitter_post"],
    },
    "loss_aversion": {
        "description": "Fear of missing out on recognition the reader deserves",
        "templates": [
            "Your {expertise} is a credential — don't let it sit unrecognized",
            "This project needs experts like you — applications close in {days} days",
            "AI teams are matching experts in {region} to real projects now",
        ],
        "best_for": ["facebook_stories", "telegram_card"],
    },
    "concrete_specificity": {
        "description": "Specific, verifiable proof beats vague promise",
        "templates": [
            "Twice-monthly payouts via Payoneer and PayPal. $10 minimum. No fees, ever.",
            "300+ languages, 222 markets, real projects from real AI teams",
            "Post-project feedback on exactly how your {expertise} shaped the model",
        ],
        "best_for": ["google_display", "indeed_banner", "linkedin_feed"],
    },
    "identity_appeal": {
        "description": "People act consistently with the expert identity they already hold",
        "templates": [
            "If you're a native {language} speaker, you're exactly who AI needs",
            "Your {profession} expertise is exactly what AI is missing",
            "Your eye for detail is a credential in itself",
        ],
        "best_for": ["linkedin_feed", "facebook_feed"],
    },
    "effort_minimization": {
        "description": "Reduce perceived friction to start — without minimizing the work",
        "templates": [
            "Apply once. Get matched to projects that fit your expertise.",
            "Flexible, asynchronous projects. Your schedule, your expertise.",
            "No fees, ever. Twice-monthly payouts via Payoneer and PayPal.",
        ],
        "best_for": ["tiktok_feed", "google_display", "facebook_stories"],
    },
}


# ---------------------------------------------------------------------------
# select_psychology_hooks — pick sub-variation hooks for a channel + brief
# ---------------------------------------------------------------------------

def select_psychology_hooks(
    channel: str,
    brief: dict,
    *,
    max_hooks: int = 3,
) -> list[dict[str, Any]]:
    """Select the most effective psychology hooks for a channel and brief.

    Hooks are the SECONDARY axis of variation — they flavor how a pillar's
    hero template is filled in. They never replace the pillar.

    Parameters
    ----------
    channel:
        The ad platform key (e.g. ``"facebook_feed"``).
    brief:
        The creative brief dict — used to pick hooks whose templates
        can be meaningfully populated (e.g. if brief contains a rate,
        ``concrete_specificity`` is prioritised).
    max_hooks:
        Maximum number of hooks to return (default 3).

    Returns
    -------
    list[dict]
        Each dict contains ``name``, ``description``, ``templates``, and a
        ``relevance`` note explaining why this hook was selected.
    """
    brief_text = json.dumps(brief, ensure_ascii=False, default=str).lower()

    # Score each hook by (a) platform fit and (b) template fillability.
    scored: list[tuple[float, str, dict]] = []

    for hook_name, hook in MARKETING_PSYCHOLOGY.items():
        score = 0.0

        # Primary signal: is this hook recommended for the channel?
        if channel in hook.get("best_for", []):
            score += 2.0

        # Secondary signal: can the templates be filled from the brief?
        fillable_keywords = {
            "expertise": ["expert", "expertise", "skill", "credential", "profession"],
            "language": ["language", "lingual", "native", "speak"],
            "number": ["member", "expert", "1.8m", "300", "222", "community"],
            "region": ["region", "country", "location", "geo", "market"],
            "profession": ["physician", "phd", "lawyer", "engineer", "doctor", "profession"],
            "days": ["deadline", "close", "days", "urgent"],
        }
        for _placeholder, keywords in fillable_keywords.items():
            if any(kw in brief_text for kw in keywords):
                score += 0.5

        relevance = (
            f"Recommended for {channel}"
            if channel in hook.get("best_for", [])
            else "Cross-platform effective"
        )

        scored.append((score, hook_name, {
            "name": hook_name,
            "description": hook["description"],
            "templates": hook["templates"],
            "relevance": relevance,
        }))

    # Sort descending by score, take top N.
    scored.sort(key=lambda t: t[0], reverse=True)
    return [item[2] for item in scored[:max_hooks]]


# ---------------------------------------------------------------------------
# _build_platform_json_schema — JSON template for Gemma 3 to fill in
# ---------------------------------------------------------------------------
#
# Every schema now carries a "pillar" field so downstream composition knows
# which brand angle the copy variation is aimed at. All existing field names
# (primary_text, headline, description, cta_button, etc.) are preserved
# verbatim for backward compatibility with Stage 4 composition and with
# frontend display components (BriefExecutive.tsx, AssetCard, etc.).

_PILLAR_FIELD_COMMENT = '"pillar": "<one of: earn | grow | shape — which brand angle this variation uses>"'


def _build_platform_json_schema(channel: str, language: str) -> str:
    """Return a JSON template string showing the exact fields Gemma 3 must
    return for *channel*, with inline char-limit comments."""
    spec = PLATFORM_AD_SPECS.get(channel, PLATFORM_AD_SPECS["facebook_feed"])
    limits = spec["char_limits"]

    if channel == "facebook_feed":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "primary_text": "<{limits["primary_text"]["recommended"]} chars recommended, '
            f'{limits["primary_text"]["max"]} max — expertise-led body text in {language}>",\n'
            f'  "headline": "<{limits["headline"]["recommended"]} chars recommended, '
            f'{limits["headline"]["max"]} max — bold text below image in {language}>",\n'
            f'  "description": "<{limits["description"]["recommended"]} chars recommended, '
            f'{limits["description"]["max"]} max — supporting text below headline in {language}>",\n'
            '  "cta_button": "<approved CTA variation for this pillar, via get_cta(pillar, lang)>",\n'
            '  "display_link": "oneforma.com"\n'
            '}}'
        )
    elif channel == "facebook_stories":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "primary_text": "<{limits["primary_text"]["max"]} chars max — expertise-led overlay text in {language}>",\n'
            '  "cta_button": "<approved CTA variation for this pillar, via get_cta(pillar, lang)>",\n'
            f'  "sticker_text": "<{limits["sticker_text"]["max"]} chars max — optional short expertise label>"\n'
            '}}'
        )
    elif channel == "linkedin_feed":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "introductory_text": "<{limits["introductory_text"]["recommended"]} chars recommended, '
            f'{limits["introductory_text"]["max"]} max — professional expertise-led text in {language}>",\n'
            f'  "headline": "<{limits["headline"]["max"]} chars max — bold text below image in {language}>",\n'
            f'  "description": "<{limits["description"]["max"]} chars max — supporting text in {language}>",\n'
            '  "cta_button": "<approved CTA variation for this pillar, via get_cta(pillar, lang)>",\n'
            '  "organization_name": "OneForma by Centific"\n'
            '}}'
        )
    elif channel == "tiktok_feed":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "ad_text": "<{limits["ad_text"]["max"]} chars max — expertise-led bottom-of-video text in {language}>",\n'
            '  "cta_button": "<approved CTA variation for this pillar, via get_cta(pillar, lang)>",\n'
            '  "display_name": "@OneForma",\n'
            f'  "profile_text": "<{limits["profile_text"]["max"]} chars max — profile description in {language}>"\n'
            '}}'
        )
    elif channel == "telegram_card":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "message_text": "<{limits["message_text"]["max"]} chars max — direct expertise-led message in {language}>",\n'
            f'  "button_text": "<{limits["button_text"]["max"]} chars max — approved CTA variation via get_cta(pillar, lang)>",\n'
            '  "button_url": "oneforma.com"\n'
            '}}'
        )
    elif channel == "google_display":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "headlines": ["<{limits["headlines"]["max_per_item"]} chars max each — '
            f'provide {limits["headlines"]["min_count"]}-{limits["headlines"]["max_count"]} expertise-led headlines in {language}>"],\n'
            f'  "long_headline": "<{limits["long_headline"]["max"]} chars max — used in larger placements in {language}>",\n'
            f'  "descriptions": ["<{limits["descriptions"]["max_per_item"]} chars max each — '
            f'provide {limits["descriptions"]["min_count"]}-{limits["descriptions"]["max_count"]} descriptions in {language}>"],\n'
            '  "business_name": "OneForma",\n'
            '  "cta_text": "<optional — approved CTA variation via get_cta(pillar, lang)>"\n'
            '}}'
        )
    elif channel == "indeed_banner":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "job_title": "<{limits["job_title"]["max"]} chars max — specific, searchable title in {language}>",\n'
            f'  "company_description": "<{limits["company_description"]["max"]} chars max — expertise-first description of what OneForma does>",\n'
            f'  "job_highlights": ["<{limits["job_highlights"]["max_per_item"]} chars max each — '
            f'up to {limits["job_highlights"]["max_count"]} bullet points in {language}>"],\n'
            '  "salary_info": "<optional — rate range as supporting proof only>",\n'
            '  "location_type": "Remote"\n'
            '}}'
        )
    elif channel == "twitter_post":
        return (
            '{{\n'
            f'  {_PILLAR_FIELD_COMMENT},\n'
            f'  "tweet_text": "<{limits["tweet_text"]["max"]} chars max — expertise-led conversational post in {language}>",\n'
            f'  "card_headline": "<{limits["card_headline"]["max"]} chars max — website card headline in {language}>",\n'
            f'  "card_description": "<{limits["card_description"]["max"]} chars max — website card description in {language}>",\n'
            '  "cta": "<approved CTA variation for this pillar, via get_cta(pillar, lang)>"\n'
            '}}'
        )
    else:
        # Fallback: facebook_feed structure.
        return _build_platform_json_schema("facebook_feed", language)


# ---------------------------------------------------------------------------
# build_copy_prompt — platform-specific prompt for Gemma 3
# ---------------------------------------------------------------------------

def build_copy_prompt(
    brief: dict,
    channel: str,
    language: str,
    regions: list[str] | None = None,
    form_data: dict | None = None,
    feedback: list | None = None,
) -> str:
    """Build the prompt for generating ad copy for a specific channel + language.

    The prompt instructs Gemma 3 to return the EXACT JSON fields the target
    platform requires, with per-field character limits and a required
    ``pillar`` field identifying which brand angle the variation uses.

    When the brief or form data touches sensitive categories (children's data,
    medical records, content moderation, etc.), ethical positioning guardrails
    are automatically injected into the prompt.
    """
    spec = PLATFORM_AD_SPECS.get(channel, PLATFORM_AD_SPECS["facebook_feed"])
    regions_str = ", ".join(regions) if regions else "Global"

    # --- Feedback from previous attempts ---
    feedback_section = ""
    if feedback:
        items = "\n".join(f"- {f}" for f in feedback)
        feedback_section = (
            f"\n\nPREVIOUS ATTEMPT FEEDBACK (address every point):\n{items}"
        )

    # --- Task details ---
    task_info = ""
    if form_data:
        task_info = f"\nTASK DETAILS: {json.dumps(form_data, ensure_ascii=False, default=str)}"

    # --- Ethical positioning: detect sensitive categories and inject framing ---
    sensitivity_input: dict = {**brief}
    if form_data:
        sensitivity_input["form_data"] = form_data
    detected_categories = detect_sensitivity(sensitivity_input)
    ethical_section = build_ethical_copy_prompt(brief, detected_categories)

    # --- Psychology hooks (sub-variation signals) ---
    hooks = select_psychology_hooks(channel, brief)
    psychology_section = _format_psychology_section(hooks)

    # --- Platform-specific JSON schema ---
    json_schema = _build_platform_json_schema(channel, language)

    # --- Good / bad examples ---
    good_examples = "\n".join(f'- "{ex}"' for ex in spec.get("good_examples", []))
    bad_examples = "\n".join(f'- "{ex}"' for ex in spec.get("bad_examples", []))

    # --- CTA guidance (pillar-locked, not a free-form list) ---
    cta_section = (
        "\nCTA: The cta_button / button_text / cta field must carry an approved "
        "CTA variation for this variation's pillar. Earn → CTA_PRIMARY "
        f"({CTA_PRIMARY['canonical_en']!r} or approved variation). "
        f"Grow / Shape → CTA_SECONDARY ({CTA_SECONDARY['canonical_en']!r} or "
        "approved variation). Translate to the target language using the "
        "approved translation table; fall back to English canonical if no "
        "translation exists. Never invent a new CTA."
    )

    # --- Character limits summary ---
    limits_lines = []
    for field_name, limit_info in spec["char_limits"].items():
        if isinstance(limit_info, dict):
            if "max_per_item" in limit_info:
                count_range = f"{limit_info.get('min_count', 1)}-{limit_info.get('max_count', 5)}"
                limits_lines.append(
                    f"- {field_name}: {limit_info['max_per_item']} chars max per item, "
                    f"provide {count_range} items"
                )
            elif "recommended" in limit_info:
                limits_lines.append(
                    f"- {field_name}: {limit_info['recommended']} chars recommended, "
                    f"{limit_info['max']} max"
                )
            else:
                limits_lines.append(f"- {field_name}: {limit_info['max']} chars max")
    char_limits_block = "\n".join(limits_lines)

    return f"""Write OneForma recruitment ad copy.

BRIEF:
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

PLATFORM: {channel}
LANGUAGE: {language}
TARGET REGIONS: {regions_str}{task_info}

PLATFORM RULES:
Tone: {spec["tone"]}
{char_limits_block}
{cta_section}
{psychology_section}

Write ALL copy in {language}. It must sound native — not translated.

Every copy object you return must carry a "pillar" field set to exactly
one of "earn", "grow", or "shape" — identifying which OneForma brand angle
this variation is aimed at. The body copy, hook, and CTA must all reflect
that pillar's hero template.

Return ONLY valid JSON with the EXACT fields shown below — no extra fields,
no missing fields, no renaming:
{json_schema}

EXAMPLES OF GOOD ONEFORMA COPY FOR {channel.upper()}:
{good_examples}

NEVER write (these violate the brand voice):
{bad_examples}

NEVER write:
- "We are hiring" / "Job opening" / "Position available" — corporate HR speak
- "Competitive salary" / "Great benefits" — generic HR language
- "Easy money" / "Make $X from home" — money-first transactional leads
- Any of the banned words listed in the BRAND VOICE block
- Anything that reduces the person to a commodity role{ethical_section}{feedback_section}"""


def _format_psychology_section(hooks: list[dict[str, Any]]) -> str:
    """Format selected psychology hooks into prompt instructions."""
    if not hooks:
        return ""

    lines = [
        "SUB-VARIATION PSYCHOLOGY (use to flavor the pillar hero template — never replace it):",
    ]
    for hook in hooks:
        lines.append(f"\n• {hook['name'].upper()}: {hook['description']}")
        lines.append(f"  Relevance: {hook['relevance']}")
        lines.append("  Example templates (adapt, do not copy verbatim):")
        for template in hook["templates"]:
            lines.append(f"    - \"{template}\"")

    lines.append(
        "\nBlend 1-2 hooks naturally into the pillar's hero template so the copy "
        "feels organic. Pillars are the PRIMARY axis of variation; these hooks "
        "are the secondary signal for picking the sub-variation inside a pillar."
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# build_copy_eval_prompt — platform-specific evaluation
# ---------------------------------------------------------------------------

def build_copy_eval_prompt(
    copy_data: dict,
    brief: dict,
    channel: str,
    language: str,
) -> str:
    """Build the prompt for evaluating generated ad copy.

    The evaluation verifies brand voice compliance, pillar clarity, platform
    field presence, and character-limit compliance. Any banned word
    appearing in the output automatically scores 0 on brand_voice_compliance.
    """
    spec = PLATFORM_AD_SPECS.get(channel, PLATFORM_AD_SPECS["facebook_feed"])

    # Build a human-readable field checklist.
    field_checklist_lines = []
    for field_name, field_desc in spec["fields"].items():
        limit_info = spec["char_limits"].get(field_name)
        if limit_info:
            if isinstance(limit_info, dict) and "max_per_item" in limit_info:
                limit_str = (
                    f"{limit_info['max_per_item']} chars max per item, "
                    f"{limit_info.get('min_count', 1)}-{limit_info.get('max_count', 5)} items"
                )
            elif isinstance(limit_info, dict) and "recommended" in limit_info:
                limit_str = (
                    f"{limit_info['recommended']} chars recommended, "
                    f"{limit_info['max']} max"
                )
            elif isinstance(limit_info, dict):
                limit_str = f"{limit_info['max']} chars max"
            else:
                limit_str = str(limit_info)
        else:
            limit_str = "no char limit"
        field_checklist_lines.append(
            f"  - {field_name}: {field_desc} ({limit_str})"
        )
    field_checklist = "\n".join(field_checklist_lines)

    return f"""Evaluate this OneForma ad copy against brand voice and platform fit.

COPY:
{json.dumps(copy_data, indent=2, ensure_ascii=False, default=str)}

BRIEF CONTEXT:
{json.dumps(brief, indent=2, ensure_ascii=False, default=str)}

PLATFORM: {channel}
LANGUAGE: {language}

REQUIRED FIELDS FOR {channel.upper()}:
{field_checklist}

BANNED WORDS (automatic brand_voice_compliance = 0 if ANY appear in the copy):
{_BANNED_WORDS_INLINE}

Score each dimension 0.0 to 1.0:

- brand_voice_compliance: Does the copy follow the 4 OneForma tone rules
  (expertise-first, human-first, purposeful, specific)? Does it lead with
  the expert and not with a dollar amount or task? Score 0.0 if ANY banned
  word or phrase appears anywhere in the copy.
- pillar_clarity: Does this variation clearly embody exactly ONE brand pillar
  (earn, grow, or shape)? The "pillar" field must be present and match the
  body copy's angle. Score 0.0 if the pillar is missing, ambiguous, or the
  body copy contradicts the declared pillar.
- expertise_led_hook: Does the first line lead with a specific form of
  expertise (language, profession, skill, credential) rather than with pay,
  hours, or generic "opportunity" framing?
- scroll_stopping: Would a real expert in the target region stop scrolling?
  Is it specific, recognition-led, and grounded in real expertise?
- native_language: Does it sound like a native {language} speaker wrote it?
  No awkward machine-translation artifacts.
- cta_strength: Is the CTA an approved variation for this variation's pillar
  (CTA_PRIMARY for earn, CTA_SECONDARY for grow/shape)? Score 0.0 on any
  invented or freestyle CTA.
- platform_fit: Does the tone and length match {channel} conventions?
- character_compliance: Are ALL fields within platform character limits?
  Score 0.0 if ANY field exceeds its max.
- field_compliance: Are ALL required fields (including "pillar") present?
  Score 0.0 if any required field is missing.

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "dimensions": {{
    "brand_voice_compliance": {{"score": 0.0, "feedback": "..."}},
    "pillar_clarity": {{"score": 0.0, "feedback": "..."}},
    "expertise_led_hook": {{"score": 0.0, "feedback": "..."}},
    "scroll_stopping": {{"score": 0.0, "feedback": "..."}},
    "native_language": {{"score": 0.0, "feedback": "..."}},
    "cta_strength": {{"score": 0.0, "feedback": "..."}},
    "platform_fit": {{"score": 0.0, "feedback": "..."}},
    "character_compliance": {{"score": 0.0, "feedback": "..."}},
    "field_compliance": {{"score": 0.0, "feedback": "..."}}
  }},
  "banned_words_found": ["<any banned word or phrase spotted in the copy>"],
  "field_char_counts": {{
    "<field_name>": "<actual_count>/<limit>"
  }},
  "improvement_suggestions": ["...", "..."]
}}"""


# ---------------------------------------------------------------------------
# build_persona_targeted_copy_prompt — persona context + platform prompt
# ---------------------------------------------------------------------------

def build_persona_targeted_copy_prompt(
    persona: dict,
    brief: dict,
    channel: str,
    language: str,
    regions: list[str] | None = None,
    form_data: dict | None = None,
    feedback: list | None = None,
) -> str:
    """Build a copy prompt that targets a specific persona.

    This wraps the standard ``build_copy_prompt`` with persona context
    prepended, so the LLM generates copy tailored to the persona's
    psychology, pain points, and motivations rather than a generic audience.

    Parameters
    ----------
    persona:
        A customised persona dict from the persona engine.
    brief:
        The creative brief dict.
    channel:
        The ad platform key (e.g. ``"facebook_feed"``).
    language:
        Target language for the copy.
    regions:
        Target regions.
    form_data:
        Task details from the intake form.
    feedback:
        Optional improvement suggestions from a failed evaluation.

    Returns
    -------
    str
        The full copy-generation prompt with persona context prepended.
    """
    # Generate the persona-specific context block.
    persona_block = build_persona_copy_prompt(persona, channel, language, brief)

    # Generate the standard platform copy prompt.
    standard_prompt = build_copy_prompt(
        brief=brief,
        channel=channel,
        language=language,
        regions=regions,
        form_data=form_data,
        feedback=feedback,
    )

    # Combine: persona context first, then the standard prompt.
    return f"""{persona_block}
---

{standard_prompt}"""


# ---------------------------------------------------------------------------
# 3-pillar copy generation — one variation per brand pillar
# ---------------------------------------------------------------------------

def extract_available_facts(brief: dict, form_data: dict | None = None) -> dict[str, str]:
    """Extract concrete facts from brief/form_data that the LLM can use.

    Returns a dict of fact_name → value. Only includes facts that actually
    exist — never fabricates. The LLM decides whether to use each fact as a
    proof point after the expertise-led hook.
    """
    facts: dict[str, str] = {}
    fd = form_data or {}

    # Compensation — check multiple possible locations
    comp = fd.get("compensation", brief.get("compensation", {}))
    if isinstance(comp, dict):
        rate = comp.get("rate", comp.get("hourly_rate", comp.get("pay_rate", "")))
        if rate:
            facts["rate"] = str(rate)
        currency = comp.get("currency", "")
        if currency:
            facts["currency"] = currency
        pay_method = comp.get("payment_method", comp.get("pay_method", ""))
        if pay_method:
            facts["payment_method"] = pay_method
    elif isinstance(comp, str) and comp:
        facts["compensation_description"] = comp

    # Simple rate field
    for key in ("rate", "pay_rate", "hourly_rate"):
        val = fd.get(key, brief.get(key, ""))
        if val and "rate" not in facts:
            facts["rate"] = str(val)

    # Task type
    task = fd.get("task_type", brief.get("task_type", ""))
    if task:
        facts["task_type"] = str(task).replace("_", " ")

    # Task description
    desc = fd.get("task_description", fd.get("description", ""))
    if desc:
        facts["task_description"] = str(desc)[:200]

    # Expert / member count (if known) — framed as experts, not contributors
    for key in ("contributor_count", "contributors", "community_size", "member_count"):
        val = brief.get(key, fd.get(key, ""))
        if val:
            facts["expert_count"] = str(val)

    # Target languages
    langs = brief.get("content_language", {})
    if isinstance(langs, dict) and langs.get("primary"):
        facts["primary_language"] = langs["primary"]

    # Regions
    regions = fd.get("target_regions", brief.get("target_regions", []))
    if regions:
        facts["regions"] = ", ".join(regions) if isinstance(regions, list) else str(regions)

    # Public trust strip — always available, always safe
    facts["trust_strip"] = TRUST_STRIP

    return facts


PEER_VOICE_SYSTEM = """You are not a copywriter reading off a brief. You are
{persona_name}'s peer — someone from their walk of life, who knows exactly
what their expertise is worth, and who just found a project on OneForma
that fits them.

You know {persona_name}'s context: {lifestyle_snippet}
You know what they're navigating right now: {pain_snippet}
You know what would actually matter to them: {motivation_snippet}

Even though you're writing in a peer voice, you still honor the four
OneForma tone rules, because they're the same rules a real friend would
follow when recommending a good project:

  1. Expertise first, not output first — you talk about what {persona_name}
     KNOWS, not about what they'll earn.
  2. Human first, not AI first — AI is the context, never the hook.
     "Your language is what AI is missing" not "help train LLMs".
  3. Purposeful, not transactional — you lead with impact and recognition.
     Money, flexibility, and logistics are proof points, never the headline.
  4. Specific, not vague — if you have a real number, use it.
     If you don't, be specific about the experience instead.

Peer-voice rules:
- Write in {language}. It must sound native, not translated.
- Use the persona's trigger words naturally: {trigger_words}
- Address their real pain without being heavy-handed
- Even in peer voice, the person's EXPERTISE is what's valuable —
  never their time-for-money trade
- Refer to {persona_name} as an expert, a collaborator, or by their
  specific skill (native speaker, physics PhD, cardiologist, detail-oriented
  reviewer). Never as a worker, resource, crowd member, annotator alone,
  or by any commodity-labor framing.
- Return ONLY the JSON fields requested — no commentary
- Every word must earn its place. If a word could appear in any
  generic gig-work ad, cut it.

BANNED WORDS (automatic rejection if any appear in your copy):
{banned_words}

{copy_benchmarks}"""


COPY_BENCHMARKS_BLOCK = """
PHRASES THAT WORK FOR ONEFORMA (use when they fit — never forced):
- Expertise-led hooks: "Your native {language} is exactly what AI is missing"
- Profession-led hooks: "Your {profession} expertise is exactly what AI is missing"
- Recognition framing: "Put your expertise to work", "Projects worthy of your expertise"
- Proof points (AFTER the hook, not as the hook):
    "Twice-monthly payouts via Payoneer and PayPal. No fees, ever."
    "Real projects from real AI teams"
    "Post-project feedback on how your work was used"
    "1.8M members, 300+ languages, 222 markets"
- Pillar anchors:
    Earn  → "From wherever you are. Real projects, on your schedule."
    Grow  → "Build the AI experience your career deserves."
    Shape → "Shape how AI talks to 30 million people."

PHRASES THAT KILL THE BRAND (never use):
- "We are hiring" / "Position available" — corporate HR
- "Easy money from home" — money-first transactional
- "Competitive pay" / "Great benefits" — generic HR
- "Flexible hours" alone — every gig platform says this
- "Earn $X/hr" as the lead — violates Purposeful Not Transactional
- Any of the banned words from the brand voice block
"""


def build_peer_voice_system(persona: dict, language: str) -> str:
    """Build a system prompt where the LLM embodies the persona's peer.

    The voice is calibrated from the persona's actual psychology profile,
    but all four OneForma tone rules and the banned-word list are still
    binding.
    """
    psychology = persona.get("psychology_profile", {})
    trigger_words = psychology.get("trigger_words", [])

    return PEER_VOICE_SYSTEM.format(
        persona_name=persona.get("persona_name", persona.get("name", "this person")),
        lifestyle_snippet=persona.get("lifestyle", "their daily life")[:120],
        pain_snippet=persona.get(
            "customized_pain",
            persona.get("pain_points", ["finding work worthy of their expertise"])[0]
            if persona.get("pain_points") else "",
        )[:120],
        motivation_snippet=persona.get(
            "customized_motivation",
            "work that recognizes their expertise",
        )[:120],
        language=language,
        trigger_words=(
            ", ".join(trigger_words[:6])
            if trigger_words
            else "expertise, recognition, real projects"
        ),
        banned_words=_BANNED_WORDS_INLINE,
        copy_benchmarks=COPY_BENCHMARKS_BLOCK,
    )


# Pillar order is fixed so downstream callers can rely on it.
_PILLAR_ORDER: tuple[str, ...] = ("earn", "grow", "shape")


def _format_hero_template(pillar_key: str) -> str:
    """Return a short formatted hero template block for a pillar."""
    hero = HERO_TEMPLATES_BY_PILLAR[pillar_key]
    examples = "\n".join(f"    - {ex}" for ex in hero["h1_examples"])
    return (
        f"HERO TEMPLATE FOR THIS PILLAR ({pillar_key.upper()}):\n"
        f"  H1 template: {hero['h1_template']}\n"
        f"  Subhead: {hero['subhead_template']}\n"
        f"  Example H1s (adapt to this persona + language):\n{examples}\n"
        f"  CTA reference: {hero['cta_ref']}"
    )


def build_variation_prompts(
    persona: dict,
    brief: dict,
    channel: str,
    language: str,
    regions: list[str] | None = None,
    form_data: dict | None = None,
    pillar_weighting: dict | None = None,
    cultural_context: str | None = None,
) -> list[dict[str, str]]:
    """Build 3 copy prompts — one per brand pillar (Earn / Grow / Shape).

    For each persona × platform, exactly 3 variations are produced. The
    PRIMARY axis of variation is the brand pillar; the persona's
    psychology_profile (primary_bias, secondary_bias) is used as a
    SECONDARY signal to pick the sub-variation inside each pillar.

    Returns a list of 3 dicts, each with:
      - ``angle``: human-readable label for the variation (pillar-prefixed)
      - ``pillar``: one of "earn", "grow", "shape"
      - ``bias``: the psychology bias used as sub-variation signal
                  (kept for backward compat with existing stage3 writer)
      - ``cta``: the resolved CTA string for this pillar × language
      - ``system``: the system prompt (peer voice, tone-rule-locked)
      - ``user``: the user prompt (platform spec + pillar hero template)
    """
    psychology = persona.get("psychology_profile", {})
    primary_bias = psychology.get("primary_bias", "")
    secondary_bias = psychology.get("secondary_bias", "")
    messaging_angle = psychology.get("messaging_angle", "")

    # Extract available facts (only what exists — no fabrication)
    facts = extract_available_facts(brief, form_data)
    facts_block = ""
    if facts:
        lines = [f"- {k}: {v}" for k, v in facts.items()]
        facts_block = (
            "\nAVAILABLE PROOF POINTS (use as supporting proof AFTER the "
            "expertise-led hook — do NOT lead with any of these, and do NOT "
            "fabricate data):\n" + "\n".join(lines)
        )

    # Build the base platform prompt (char limits, JSON schema, examples)
    base_prompt = build_copy_prompt(
        brief=brief,
        channel=channel,
        language=language,
        regions=regions,
        form_data=form_data,
    )

    # Persona context block (inlined — legacy persona_engine helper deleted in Task 18/19)
    persona_block = build_persona_copy_prompt(persona, channel, language, brief)

    # System prompt — peer voice with tone rules + banned words
    system = build_peer_voice_system(persona, language)

    persona_name = persona.get("persona_name", persona.get("name", "this person"))

    # Sub-variation rationale — which psychology signal to emphasize inside
    # each pillar. We rotate: Earn gets primary_bias, Grow gets secondary_bias,
    # Shape gets the contrasting / messaging_angle signal.
    sub_bias_by_pillar: dict[str, str] = {
        "earn": primary_bias or "practicality",
        "grow": secondary_bias or primary_bias or "growth",
        "shape": messaging_angle or "recognition",
    }

    # Determine which pillars to generate based on pillar_weighting
    VALID_PILLARS = {"earn", "grow", "shape"}
    if (
        pillar_weighting
        and isinstance(pillar_weighting, dict)
        and pillar_weighting.get("primary") in VALID_PILLARS
        and pillar_weighting.get("secondary") in VALID_PILLARS
    ):
        active_pillars = [pillar_weighting["primary"], pillar_weighting["secondary"]]
    else:
        active_pillars = list(_PILLAR_ORDER)

    variations: list[dict[str, str]] = []

    for pillar_key in active_pillars:
        pillar_meta = PILLARS[pillar_key]
        hero_block = _format_hero_template(pillar_key)
        sub_bias = sub_bias_by_pillar[pillar_key]
        cta_str = get_cta(pillar=pillar_key, lang=language)

        angle_instruction = (
            f"PILLAR: {pillar_meta['display_name']} ({pillar_key})\n"
            f"Pillar JTBD: {pillar_meta['jtbd']}\n"
            f"Pillar voice: {pillar_meta['voice']}\n\n"
            f"{hero_block}\n\n"
            f"SUB-VARIATION SIGNAL (use to flavor the hero template — "
            f"never replace it): within the {pillar_meta['display_name']} "
            f"angle for {persona_name}, emphasize {sub_bias!r} since this "
            f"persona responds to that trigger. Messaging angle from persona "
            f"research: {messaging_angle or 'unspecified'}.\n\n"
            f"CTA (locked for this pillar × {language}): {cta_str}\n"
            f"You MUST use this exact CTA string (or its closest approved "
            f"variation) in the cta_button / button_text / cta field. Do "
            f"not invent a new CTA.\n\n"
            f"REQUIRED: include a top-level \"pillar\" field with value "
            f'"{pillar_key}" in your JSON output.'
        )

        # Cultural context (if provided)
        cultural_block = ""
        if cultural_context:
            cultural_block = f"\n\nCULTURAL CONTEXT FOR THIS REGION:\n{cultural_context}\n\nUse these cultural insights to make the copy feel native to this region — not just translated, but culturally resonant."

        variations.append({
            "angle": f"pillar_{pillar_key}",
            "pillar": pillar_key,
            "bias": sub_bias,
            "cta": cta_str,
            "system": system,
            "user": f"""{angle_instruction}
{facts_block}

{persona_block}
{cultural_block}
---
{base_prompt}""",
        })

    return variations
