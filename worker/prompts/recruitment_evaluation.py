"""Recruitment-adapted creative evaluation prompts (Stage 4).

These prompts are used by the evaluator to score composed creatives
(image + text overlay) before they are approved for review.

Brand voice auditor: every dimension is now graded against OneForma's
new brand voice (tagline, 4 tone rules, locked CTAs, banned words).
The visual color prescription has been removed — Phase 2 HTML templates
own color enforcement at composition time.

JSON output schema (`employer_brand_fit`, `candidate_hook`,
`application_cta`, `platform_compliance`, `culture_proof`,
`visual_text_harmony`, `readability`) is preserved for downstream
compatibility with worker/ai/evaluator.py — but each dimension's
SEMANTIC MEANING has been rewritten for the new brand voice.
"""
from __future__ import annotations

from brand import (
    CTA_PRIMARY,
    CTA_SECONDARY,
    WORDS_TO_AVOID,
    build_brand_voice_block,
)

EVAL_SYSTEM_PROMPT = (
    "You are a brand voice evaluator for OneForma, the AI platform that sees "
    "the expert in everyone. You audit composed recruitment creatives "
    "(hero image + text overlay) for both creative quality AND brand voice "
    "compliance.\n\n"
    "Your scores must be honest and actionable — a score of 0.70+ means "
    "'good enough to ship', not 'perfect'. The brand voice rules are binding: "
    "any creative containing a banned word is automatically rejected (score 0 "
    "on the affected dimension).\n\n"
    f"{build_brand_voice_block()}\n\n"
    "Return only the requested JSON. No markdown, no commentary outside the JSON."
)


def build_eval_prompt(creative_data: dict) -> str:
    """Build the evaluation prompt for a composed creative.

    Parameters
    ----------
    creative_data:
        Dict with keys like ``headline``, ``subheadline``, ``cta_text``,
        ``platform``, ``template``, ``actor_region``.

    Notes
    -----
    The JSON output schema preserves the original dimension names
    (employer_brand_fit, candidate_hook, application_cta, etc.) so
    downstream parsers in worker/ai/evaluator.py keep working. The
    SCORING SEMANTICS have been rewritten to match the new brand voice.
    """
    headline = creative_data.get("headline", "")
    subheadline = creative_data.get("subheadline", "")
    cta_text = creative_data.get("cta_text", "")
    overlay_text_combined = " ".join([headline, subheadline, cta_text]).strip()

    banned_words_csv = ", ".join(WORDS_TO_AVOID)
    cta_primary_canonical = CTA_PRIMARY["canonical_en"]
    cta_secondary_canonical = CTA_SECONDARY["canonical_en"]
    cta_primary_variations = ", ".join(f'"{v}"' for v in CTA_PRIMARY["approved_variations_en"])
    cta_secondary_variations = ", ".join(f'"{v}"' for v in CTA_SECONDARY["approved_variations_en"])

    return f"""Evaluate this recruitment creative for OneForma.

CREATIVE DETAILS:
- Headline: "{headline}"
- Subheadline: "{subheadline}"
- CTA button: "{cta_text}"
- Platform: {creative_data.get("platform", "unknown")}
- Template: {creative_data.get("template", "unknown")}
- Target region: {creative_data.get("actor_region", "unknown")}

Combined overlay text to scan for banned words:
"{overlay_text_combined}"

=== BANNED WORDS GATE (apply BEFORE scoring) ===
Scan the entire overlay text and any copy_data fields for any of these banned words:
{banned_words_csv}

If ANY banned word is detected:
- employer_brand_fit.score = 0.0 (automatic)
- The improvement_suggestions list must include "BANNED_WORD_DETECTED: <word>"
- Note the offending word(s) in employer_brand_fit.feedback

Score EACH dimension 0.0 to 1.0 with specific feedback:

1. EMPLOYER_BRAND_FIT — now graded as BRAND_VOICE_FIT (threshold: 0.70)
   Does this creative match OneForma's brand voice?
   - Tagline alignment: does it support "the AI platform that sees the expert in everyone"?
   - Compliance with the 4 tone rules:
     1) Expertise First, Not Output First — leads with the expert and their skill, NOT money or task volume
     2) Human First, Not AI First — AI is context, the human is the hook
     3) Purposeful, Not Transactional — purpose first, transactional detail as proof
     4) Specific, Not Vague — concrete numbers, plain words, no buzzwords
   - Pillar clarity: is the creative on one of Earn / Grow / Shape angles?
   - AUTOMATIC 0 if any banned word detected (see banned words gate above).

2. CANDIDATE_HOOK — now graded as EXPERT_HOOK (threshold: 0.65)
   Would a {creative_data.get("actor_region", "global")} EXPERT stop scrolling?
   - Does the headline lead with EXPERTISE recognition (their language, skill, profession, lived experience)?
   - Does it AVOID money-first / output-first / hustle framing?
   - Does it address a real need or aspiration of someone with skill to share?
   - Would YOU click this if your expertise was being recognized?

3. READABILITY (threshold: 0.70)
   Can someone scan this in 2 seconds on mobile?
   - Headline under 8 words?
   - No jargon or buzzwords?
   - Clear visual hierarchy?

4. VISUAL_TEXT_HARMONY (threshold: 0.60)
   Do the template choice and text work together?
   - Is the template appropriate for the headline length?
   - Would the text be readable over the image?
   - Is there enough contrast between text and background?

5. APPLICATION_CTA — now graded as LOCKED_CTA (threshold: 0.70)
   Does the CTA match one of the 2 LOCKED CTA intents?
   - CTA_PRIMARY canonical: "{cta_primary_canonical}"
   - CTA_PRIMARY approved variations: {cta_primary_variations}
   - CTA_SECONDARY canonical: "{cta_secondary_canonical}"
   - CTA_SECONDARY approved variations: {cta_secondary_variations}
   - Translations into approved locales (Spanish, French, Portuguese, German,
     Italian, Japanese, Chinese, Korean, Arabic, Hindi, Indonesian, Tagalog)
     are also acceptable provided they preserve the locked intent.
   - Score 0.90+ only if the CTA is one of these (or an approved translation).
   - Score 0.40 or less if the CTA is invented (e.g. "Apply Now", "Learn More",
     "Sign Up Today") — those are NOT locked CTAs and break the brand system.

6. PLATFORM_COMPLIANCE (threshold: 0.75)
   Does this suit {creative_data.get("platform", "the target platform")}?
   - Are dimensions correct for the platform?
   - Does the tone match platform conventions?
   - Would this blend naturally into the feed?

7. CULTURE_PROOF (threshold: 0.50)
   Does this feel authentic and expert-respecting?
   - Would a real domain expert share this?
   - Does it avoid corporate-brochure / stock-photo / "we are hiring" vibes?
   - Does the person in the image read as a respected collaborator, not a task-completer?

Return ONLY valid JSON (preserve these exact field names — downstream parsers depend on them):
{{
  "dimensions": {{
    "employer_brand_fit": {{"score": 0.0, "feedback": "..."}},
    "candidate_hook": {{"score": 0.0, "feedback": "..."}},
    "readability": {{"score": 0.0, "feedback": "..."}},
    "visual_text_harmony": {{"score": 0.0, "feedback": "..."}},
    "application_cta": {{"score": 0.0, "feedback": "..."}},
    "platform_compliance": {{"score": 0.0, "feedback": "..."}},
    "culture_proof": {{"score": 0.0, "feedback": "..."}}
  }},
  "overall_score": 0.0,
  "improvement_suggestions": [
    "Specific, actionable suggestion 1",
    "Specific, actionable suggestion 2"
  ]
}}"""
