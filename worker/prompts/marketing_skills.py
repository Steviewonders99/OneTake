"""Marketing skills injector for pipeline stages.

Loads relevant marketing skill files and injects them into LLM prompts.
Skills sourced from: https://github.com/coreyhaines31/marketingskills

Each pipeline stage gets DIFFERENT skills injected:
- Stage 1 (Brief): marketing-psychology + copywriting + ad-creative
- Stage 3 (Copy): copywriting + ad-creative + paid-ads + social-content
- Stage 4 (Creative): ad-creative + copywriting
- Stage 5 (Video): marketing-psychology + copywriting + social-content
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)

SKILLS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "docs", "marketingskills", "skills",
)

# Which skills to inject per pipeline stage
STAGE_SKILLS: dict[str, list[str]] = {
    "brief": ["marketing-psychology", "copywriting", "ad-creative"],
    "copy": ["copywriting", "ad-creative", "paid-ads", "social-content"],
    "creative": ["creative-design-patterns", "ad-creative", "copywriting", "paid-ads", "social-content"],
    "video": ["marketing-psychology", "copywriting", "social-content"],
    "evaluation": ["marketing-psychology", "ad-creative"],
    "strategy": ["campaign-strategy", "paid-ads"],
}


@lru_cache(maxsize=20)
def _load_skill(skill_name: str) -> str:
    """Load a single skill file content. Cached."""
    skill_path = os.path.join(SKILLS_DIR, skill_name, "SKILL.md")
    if not os.path.exists(skill_path):
        logger.warning("Marketing skill '%s' not found at %s", skill_name, skill_path)
        return ""
    with open(skill_path) as f:
        content = f.read()
    # Strip YAML frontmatter
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            content = content[end + 3:].strip()
    logger.debug("Loaded marketing skill '%s' (%d chars)", skill_name, len(content))
    return content


def get_skills_for_stage(stage: str) -> str:
    """Get combined marketing skills text for a pipeline stage.

    Parameters
    ----------
    stage : str
        Pipeline stage key: "brief", "copy", "creative", "video", "evaluation"

    Returns
    -------
    str
        Combined skill content, ready to inject into an LLM prompt.
        Empty string if no skills found.
    """
    skill_names = STAGE_SKILLS.get(stage, [])
    if not skill_names:
        return ""

    parts = []
    for name in skill_names:
        content = _load_skill(name)
        if content:
            parts.append(f"\n{'='*60}\nMARKETING SKILL: {name.upper()}\n{'='*60}\n{content}")

    combined = "\n".join(parts)
    if combined:
        logger.info(
            "Injected %d marketing skills for stage '%s' (%d chars)",
            len(parts), stage, len(combined),
        )
    return combined
