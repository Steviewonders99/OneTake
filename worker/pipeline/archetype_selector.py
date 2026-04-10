"""Composition archetype selection logic.

Selects one of three archetypes based on pillar, visual direction, and platform:
  - floating_props: Gig work, earn/grow pillar, badge-rich
  - gradient_hero:  High-impact paid media, story formats, default
  - photo_feature:  Credentialed/professional, shape pillar
"""

from __future__ import annotations

STORY_FORMATS = frozenset({
    "ig_story", "tiktok_feed", "whatsapp_story", "wechat_moments", "wechat_channels",
})


def select_archetype(pillar: str, visual_direction: dict, platform: str) -> str:
    """Select composition archetype based on campaign context.

    Priority:
      1. Shape pillar → always photo_feature (professional credentialing)
      2. Story/vertical formats → gradient_hero (high impact, full canvas)
      3. Earn pillar → floating_props (benefit callouts, badge-rich)
      4. Grow pillar → floating_props (community/growth messaging)
      5. Default → gradient_hero
    """
    if pillar == "shape":
        return "photo_feature"

    if platform in STORY_FORMATS:
        return "gradient_hero"

    if pillar in ("earn", "grow"):
        return "floating_props"

    return "gradient_hero"
