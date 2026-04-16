"""
OneForma Brand Voice — package entrypoint.

Re-exports the constants and helper functions from oneforma.py so prompt files
can import them concisely:

    from brand import TAGLINE, TONE_RULES, get_cta

(The worker process launches with `cd worker && python main.py`, which puts
`worker/` on sys.path[0]. So `brand/` is a top-level package — same convention
as `config`, `pipeline`, `prompts`, etc. used throughout the worker.)

See oneforma.py for the full content and governance policy.
"""
from .oneforma import (
    ANTI_EXAMPLES,
    APPROVED_LOCALES,
    CTA_PRIMARY,
    CTA_SECONDARY,
    DESIGN_MOTIFS,
    HERO_TEMPLATES_BY_PILLAR,
    MISSION,
    OPERATIONAL_CONTEXT,
    PALETTE,
    PILLARS,
    POSITIONING,
    SERVICE_CATEGORIES,
    TAGLINE,
    TONE_RULES,
    TRUST_STRIP,
    TYPOGRAPHY,
    UNIQUE_VALUE,
    VISION,
    WORDS_TO_AVOID,
    WORDS_TO_USE,
    build_brand_voice_block,
    get_cta,
)

__all__ = [
    "ANTI_EXAMPLES",
    "APPROVED_LOCALES",
    "CTA_PRIMARY",
    "CTA_SECONDARY",
    "DESIGN_MOTIFS",
    "HERO_TEMPLATES_BY_PILLAR",
    "MISSION",
    "OPERATIONAL_CONTEXT",
    "PALETTE",
    "PILLARS",
    "POSITIONING",
    "SERVICE_CATEGORIES",
    "TAGLINE",
    "TONE_RULES",
    "TRUST_STRIP",
    "TYPOGRAPHY",
    "UNIQUE_VALUE",
    "VISION",
    "WORDS_TO_AVOID",
    "WORDS_TO_USE",
    "build_brand_voice_block",
    "get_cta",
]
