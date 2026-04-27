"""VQA Auto-Fix — maps VQA issues to deterministic prop tweaks (no LLM re-call).

Each fix is a simple, predictable mutation on the creative config dict.
The caller can re-render and re-VQA up to MAX_FIX_CYCLES times.
"""
from __future__ import annotations

import copy
from typing import Any, Dict, List

from compositor.schema import _SAFE_TEXT_POSITIONS

MAX_FIX_CYCLES = 2

# Text size progression for VISUAL_HIERARCHY bumps
_SIZE_LADDER = ["small", "medium", "large", "hero"]

# Actor position mirrors for COMPOSITION_BALANCE
_MIRROR_POSITIONS: Dict[str, str] = {
    "left": "right",
    "right": "left",
    "top-left": "top-right",
    "top-right": "top-left",
    "bottom-left": "bottom-right",
    "bottom-right": "bottom-left",
    "center": "center",
    "top-center": "top-center",
    "bottom-center": "bottom-center",
}


def _pick_safe_text_position(actor_position: str, current_text_position: str) -> str:
    """Pick the first safe text position for the given actor side, avoiding current."""
    safe = _SAFE_TEXT_POSITIONS.get(actor_position, frozenset())
    # Prefer positions that aren't the current one
    candidates = [p for p in safe if p != current_text_position]
    if candidates:
        return candidates[0]
    # Fallback to any safe position
    if safe:
        return next(iter(safe))
    return "center"


def apply_fixes(config_dict: Dict[str, Any], issues: List[Dict[str, str]]) -> Dict[str, Any]:
    """Apply deterministic fixes for VQA issues. Returns a new config (deep copy).

    Does NOT mutate the original config_dict.
    """
    cfg = copy.deepcopy(config_dict)

    for issue in issues:
        check = issue.get("check", "")
        detail = issue.get("detail", "").lower()

        if check == "FACE_VISIBLE":
            if "cover" in detail or "text" in detail:
                # Text is covering the actor's face — flip text to a safe position
                actor_pos = cfg.get("actor", {}).get("position", "center")
                current_text_pos = cfg.get("text", {}).get("position", "center")
                cfg.setdefault("text", {})["position"] = _pick_safe_text_position(actor_pos, current_text_pos)
            else:
                # Face is cut off by frame — reduce actor scale
                actor = cfg.setdefault("actor", {})
                actor["scale"] = max(actor.get("scale", 0.85) - 0.15, 0.5)

        elif check == "NO_OVERLAP":
            # Reduce overlay intensity and add contrast backdrop
            overlay = cfg.setdefault("overlay", {})
            overlay["intensity"] = "subtle"
            text = cfg.setdefault("text", {})
            if text.get("contrast_backdrop", "none") == "none":
                text["contrast_backdrop"] = "dark_gradient"

        elif check == "PROPER_SPACING":
            # Reduce actor scale to create more breathing room
            actor = cfg.setdefault("actor", {})
            actor["scale"] = max(actor.get("scale", 0.85) - 0.1, 0.5)

        elif check == "VISUAL_HIERARCHY":
            # Bump text size up one level
            text = cfg.setdefault("text", {})
            current_size = text.get("size", "medium")
            if current_size in _SIZE_LADDER:
                idx = _SIZE_LADDER.index(current_size)
                if idx < len(_SIZE_LADDER) - 1:
                    text["size"] = _SIZE_LADDER[idx + 1]
            # Add contrast backdrop if missing
            if text.get("contrast_backdrop", "none") == "none":
                text["contrast_backdrop"] = "dark_gradient"

        elif check == "NO_DEAD_SPACE":
            # Increase actor scale to fill space
            actor = cfg.setdefault("actor", {})
            actor["scale"] = min(actor.get("scale", 0.85) + 0.15, 1.0)
            # Add a blob overlay if no overlay elements exist
            overlay = cfg.setdefault("overlay", {})
            elements = overlay.get("elements", [])
            if not elements:
                overlay["elements"] = ["blob_warm_1"]

        elif check == "COMPOSITION_BALANCE":
            # Mirror actor position (left <-> right)
            actor = cfg.setdefault("actor", {})
            current_pos = actor.get("position", "center")
            new_pos = _MIRROR_POSITIONS.get(current_pos, current_pos)
            actor["position"] = new_pos
            # Update text position to safe side for new actor position
            text = cfg.setdefault("text", {})
            current_text_pos = text.get("position", "center")
            text["position"] = _pick_safe_text_position(new_pos, current_text_pos)

    return cfg
