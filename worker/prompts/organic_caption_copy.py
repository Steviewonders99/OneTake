"""Organic caption copy — Gemma 4 31B.

Generates recruiter-voice captions for LinkedIn and Instagram organic posts.
This is a RECRUITER posting on their PERSONAL account — first person,
peer-to-peer, warm but professional. NOT a corporate brand post.

Hard facts (compensation, qualifications, location, work mode) are injected
as template variables and must appear EXACTLY as provided. The LLM shapes
the tone and framing, but NEVER rewrites factual content.

Two variations per persona per platform — enforced via different angles:
  Variation 1: lead benefit / opportunity framing
  Variation 2: social proof / impact framing
"""
from __future__ import annotations

from typing import Any

ORGANIC_CAPTION_SYSTEM_PROMPT = """\
You are writing a social media post for a recruiter at OneForma. \
The recruiter is posting on their PERSONAL LinkedIn or Instagram account \
about a job opportunity. This is NOT a corporate brand post — it's a real \
person sharing a real opportunity with their network.

VOICE:
- First person: "We're looking for...", "I'm hiring...", "My team needs..."
- Peer-to-peer: talking to potential candidates as equals
- Casual-professional: warm, credible, human — like texting a colleague
- Enthusiastic but authentic — real recruiter energy, not marketing speak

HARD RULES — VIOLATING THESE IS A CRITICAL FAILURE:
- Use the EXACT compensation amount provided — never round, rephrase, or estimate
- List ONLY qualifications from the provided list — never invent requirements
- State the EXACT work mode (remote/onsite) — never flip or assume
- NEVER promise: "guaranteed income", "career growth", "life-changing opportunity"
- NEVER say "no experience needed" unless the qualifications literally say that
- NEVER use corporate buzzwords: "leverage", "synergy", "paradigm", "dynamic"
- NEVER fabricate team size, company stats, or testimonials

OUTPUT: Plain text caption only. No JSON, no markdown, no formatting tags.
"""


def build_linkedin_caption_prompt(
    form_data: dict[str, Any],
    persona: dict[str, Any],
    brief: dict[str, Any],
    variation: int,
    stage3_headline: str = "",
) -> str:
    """Build LinkedIn caption prompt for recruiter voice.

    Variation 1: lead benefit / opportunity angle
    Variation 2: social proof / impact angle
    """
    title = form_data.get("title", brief.get("title", ""))
    compensation = form_data.get("compensation_rate", "")
    comp_model = form_data.get("compensation_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location = form_data.get("location_scope", "Worldwide")
    quals = form_data.get("qualifications_required", "")
    engagement = form_data.get("engagement_model", "Flexible")

    comp_display = f"${compensation}" if compensation else ""
    if comp_model:
        comp_display += f" ({comp_model})"

    angle = (
        "Lead with the OPPORTUNITY — what makes this role exciting, who would thrive in it, why now"
        if variation == 1
        else "Lead with SOCIAL PROOF and IMPACT — how many people are already doing this, what their work powers, the scale of the mission"
    )

    return f"""\
Write a LinkedIn post for a recruiter sharing this job opportunity.

ANGLE: {angle}

JOB DETAILS (use these EXACTLY):
  Title: {title}
  Compensation: {comp_display or "(don't mention specific pay — say 'competitive')"}
  Work mode: {work_mode}
  Location: {location}
  Time commitment: {engagement}
  Key requirements: {quals[:400] or "(flexible — mention 'details in the link')"}

{f"HOOK INSPIRATION (adapt, don't copy): {stage3_headline}" if stage3_headline else ""}

LINKEDIN FORMAT RULES:
- 3-5 sentences maximum
- Open with a hook: who you're looking for or why this matters
- Mention: {work_mode}, {f"pay ({comp_display})" if comp_display else "pay details in link"}, flexibility
- Close with engagement CTA: "Know someone? Tag them!" or "DM me if interested"
- End with: "Link in comments 👇" (NOT a URL in the post body)
- NO hashtags (LinkedIn deprioritizes posts with hashtags in 2026)
- Keep under 200 words
- Sound like a REAL PERSON, not a job board listing
"""


def build_ig_caption_prompt(
    form_data: dict[str, Any],
    persona: dict[str, Any],
    brief: dict[str, Any],
    variation: int,
    stage3_headline: str = "",
) -> str:
    """Build Instagram caption prompt for recruiter voice.

    Variation 1: opportunity excitement angle
    Variation 2: community and impact angle
    """
    title = form_data.get("title", brief.get("title", ""))
    compensation = form_data.get("compensation_rate", "")
    comp_model = form_data.get("compensation_model", "")
    work_mode = form_data.get("work_mode", "remote")
    location = form_data.get("location_scope", "Worldwide")
    quals = form_data.get("qualifications_required", "")

    comp_display = f"${compensation}" if compensation else ""
    if comp_model:
        comp_display += f" ({comp_model})"

    angle = (
        "EXCITEMENT — this is a great opportunity, convey energy and urgency"
        if variation == 1
        else "COMMUNITY — join thousands of contributors, your work has real impact"
    )

    return f"""\
Write an Instagram caption for a recruiter posting about this job.

ANGLE: {angle}

JOB DETAILS (use these EXACTLY):
  Title: {title}
  Compensation: {comp_display or "competitive"}
  Work mode: {work_mode}
  Location: {location}
  Key requirements: {quals[:250] or "(flexible)"}

{f"HOOK INSPIRATION (adapt, don't copy): {stage3_headline}" if stage3_headline else ""}

INSTAGRAM FORMAT RULES:
- 2-3 punchy lines with emoji (🎯 💰 🌍 etc.)
- First line = hook (most important — this shows in the preview)
- Mention: role, pay, work mode in line 2
- "Swipe for details →" (this is a carousel post)
- "Link in bio ✨" as final CTA
- Then add 5-8 relevant hashtags on a new line
  Good: #NowHiring #RemoteWork #AIJobs #OneForma #DataAnnotation
  Bad: #blessed #hustle #grind (too generic)
- Keep caption under 100 words (before hashtags)
- Sound like a real person posting, NOT a brand account
"""
