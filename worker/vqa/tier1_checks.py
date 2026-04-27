"""Tier 1 — instant deterministic checks on the HTML string (no vision model).

These run in <1ms and catch structural problems before we ever render a PNG.
"""
from __future__ import annotations

import re
from typing import Dict, List


def run_tier1_checks(html: str) -> Dict[str, object]:
    """Run all Tier 1 checks on an HTML creative string.

    Returns {"passed": bool, "issues": [{"check": str, "detail": str}]}
    """
    issues: List[Dict[str, str]] = []

    # --- HTML_PRESENT: html is not empty and len > 100 ---
    if not html or len(html) <= 100:
        issues.append({
            "check": "HTML_PRESENT",
            "detail": f"HTML is empty or too short ({len(html)} chars, need >100)",
        })
        # If HTML is basically absent, skip remaining checks
        return {"passed": False, "issues": issues}

    # --- HEADLINE_PRESENT: "layer-text" exists in html ---
    if "layer-text" not in html:
        issues.append({
            "check": "HEADLINE_PRESENT",
            "detail": "No element with class 'layer-text' found — headline layer is missing",
        })

    # --- CTA_PRESENT: "layer-cta" exists in html ---
    if "layer-cta" not in html:
        issues.append({
            "check": "CTA_PRESENT",
            "detail": "No element with class 'layer-cta' found — call-to-action layer is missing",
        })

    # --- ACTOR_PRESENT: <img tag exists in html ---
    if "<img" not in html:
        issues.append({
            "check": "ACTOR_PRESENT",
            "detail": "No <img> tag found — actor image layer is missing",
        })

    # --- FONT_SIZE_MIN: regex-extract all font-size values, none below 14px ---
    font_sizes = [int(m) for m in re.findall(r"font-size:\s*(\d+)px", html)]
    small_fonts = [s for s in font_sizes if s < 14]
    if small_fonts:
        issues.append({
            "check": "FONT_SIZE_MIN",
            "detail": f"Font sizes below 14px found: {small_fonts}px — text will be unreadable on mobile",
        })

    # --- BACKGROUND_PRESENT: "layer-background" exists in html ---
    if "layer-background" not in html:
        issues.append({
            "check": "BACKGROUND_PRESENT",
            "detail": "No element with class 'layer-background' found — background layer is missing",
        })

    return {
        "passed": len(issues) == 0,
        "issues": issues,
    }
