"""Artifact-driven compositor prompt builder for GLM-5.

Builds a 6-section prompt that instructs GLM-5 to assemble pre-built
design artifacts into layered HTML creatives.
"""

from __future__ import annotations

from typing import Any


# ── Archetype Structural Constraints ────────────────────────────

ARCHETYPE_CONSTRAINTS: dict[str, dict[str, Any]] = {
    "floating_props": {
        "description": "Gig work / data collection — badge-rich, blob-accented, gradient background",
        "z_layers": [
            {"z": 0, "role": "background", "note": "Gradient background (full canvas)"},
            {"z": 1, "role": "accent_blobs", "note": "3-4 organic blob shapes in corners, opacity 0.3-0.6"},
            {"z": 2, "role": "actor_photo", "note": "Actor photo centered or 40% left, 50-55% canvas height"},
            {"z": 3, "role": "floating_badges", "note": "3-4 icon badges orbiting actor, offset from edges"},
            {"z": 4, "role": "headline", "note": "Headline + subheadline in top 30% or bottom 20%"},
            {"z": 5, "role": "cta", "note": "CTA pill button, bottom center, 12% from bottom edge"},
            {"z": 6, "role": "social_proof", "note": "Avatar-stack (3-4 circles + '+50K contributors') above CTA"},
            {"z": 7, "role": "logo", "note": "OneForma logo, bottom-right corner, small"},
        ],
    },
    "gradient_hero": {
        "description": "High-impact paid media — full gradient, actor in bowl, headline top zone",
        "z_layers": [
            {"z": 0, "role": "background", "note": "Full gradient background"},
            {"z": 1, "role": "divider", "note": "Curved divider creates 'bowl' at 55-60% from top"},
            {"z": 2, "role": "actor_photo", "note": "Actor photo in bowl, bottom-anchored, cropped at waist"},
            {"z": 3, "role": "headline", "note": "Large headline in top zone, above divider"},
            {"z": 4, "role": "subheadline", "note": "Below headline, 60% font size of headline"},
            {"z": 5, "role": "cta", "note": "CTA pill just above divider line, centered"},
            {"z": 6, "role": "badge_strip", "note": "2-3 badges in horizontal row below CTA"},
            {"z": 7, "role": "social_proof", "note": "Avatar-stack in gradient zone above divider"},
            {"z": 8, "role": "logo", "note": "Logo in top-left or bottom-right corner"},
        ],
    },
    "photo_feature": {
        "description": "Credentialed/professional — large masked photo, minimal text, clean layout",
        "z_layers": [
            {"z": 0, "role": "background", "note": "White or light lavender background"},
            {"z": 1, "role": "actor_photo", "note": "Actor photo in blob/egg mask, 55-60% canvas, offset left or right"},
            {"z": 2, "role": "photo_border", "note": "Thin border frame around photo mask, 2px accent color"},
            {"z": 3, "role": "accent_blobs", "note": "1-2 subtle blobs in opposite corner from photo, low opacity"},
            {"z": 4, "role": "headline", "note": "Headline in text zone, opposite side from photo"},
            {"z": 5, "role": "subheadline", "note": "Below headline, muted color"},
            {"z": 6, "role": "cta", "note": "CTA button below text, outline style"},
            {"z": 7, "role": "badge", "note": "Single badge next to CTA for credibility"},
            {"z": 8, "role": "logo", "note": "Logo in corner opposite photo"},
        ],
    },
}


# ── Prompt Sections ─────────────────────────────────────────────

def _section_role() -> str:
    return """You are a senior visual designer composing recruitment marketing creatives for OneForma.
You assemble pre-built design artifacts into layered HTML/CSS compositions.
You do NOT generate SVG paths, gradient CSS, or icons from scratch — you reference artifacts by their artifact_id and blob_url.
Every visual element in your output MUST come from the artifact catalog or the provided actor photo URLs."""


def build_artifact_catalog_section(catalog: list[dict[str, Any]]) -> str:
    """Build compact artifact table for the prompt. ~50 lines max."""
    lines = [
        "DESIGN ARTIFACTS (reference by artifact_id — use blob_url as img src):",
        "",
        "| artifact_id | category | description | size | pillar_affinity |",
        "|---|---|---|---|---|",
    ]
    for a in catalog:
        affinity = ", ".join(a.get("pillar_affinity") or []) or "any"
        lines.append(
            f"| {a['artifact_id']} | {a['category']} | {a['description'][:55]} | {a.get('dimensions', 'auto')} | {affinity} |"
        )

    lines.extend([
        "",
        "Usage rules:",
        "- SVG artifacts: <img src=\"{blob_url}\" style=\"position:absolute; ...\" />",
        "- Mask artifacts: embed the SVG clipPath inline, then apply via style=\"clip-path:url(#id)\"",
        "- Gradient artifacts: apply as inline CSS background on a div",
        "- CTA artifacts: paste the usage_snippet HTML, replace {cta_text} with actual CTA copy",
        "- All artifacts use position:absolute within the creative container",
    ])
    return "\n".join(lines)


def _section_archetype(archetype: str) -> str:
    """Build archetype constraint section."""
    ac = ARCHETYPE_CONSTRAINTS[archetype]
    lines = [
        f"COMPOSITION ARCHETYPE: {archetype}",
        f"Description: {ac['description']}",
        "",
        "Layer ordering (MUST follow this z-index structure):",
    ]
    for layer in ac["z_layers"]:
        lines.append(f"  z-{layer['z']}: {layer['role']} — {layer['note']}")
    return "\n".join(lines)


def _section_inputs(
    platform: str,
    platform_spec: dict[str, Any],
    pillar: str,
    actor: dict[str, Any],
    copy: dict[str, Any],
    visual_direction: dict[str, Any],
) -> str:
    """Build inputs section with all creative data."""
    vd_summary = "; ".join(
        f"{k}: {v}" for k, v in (visual_direction or {}).items() if v
    ) or "none specified"

    # Build safe zone description — per-side if available, else uniform margin
    if "safe_top" in platform_spec:
        safe_zone_desc = (
            f"SAFE ZONES (pixels from edge where platform UI covers content — CRITICAL):\n"
            f"  Top: {platform_spec['safe_top']}px (status bar, navigation)\n"
            f"  Right: {platform_spec['safe_right']}px (action buttons on TikTok/Stories)\n"
            f"  Bottom: {platform_spec['safe_bottom']}px (caption, music bar, nav bar)\n"
            f"  Left: {platform_spec['safe_left']}px (minimal overlay)\n"
            f"  ALL text, CTA buttons, and important elements MUST be inside these margins.\n"
            f"  The PERSON'S FACE must also be fully visible within the safe zone — do NOT let\n"
            f"  platform UI overlay the person's face or upper body."
        )
    else:
        m = platform_spec.get("safe_margin", 60)
        safe_zone_desc = (
            f"SAFE ZONE: {m}px from all edges. ALL text, CTA, and the person's face must be inside this margin."
        )

    return f"""CREATIVE INPUTS:
Platform: {platform} ({platform_spec['width']}x{platform_spec['height']})
{safe_zone_desc}
Pillar: {pillar}
Actor name: {actor.get('name', 'Actor')}
Actor full photo URL: {actor.get('photo_url', '')}
Actor cutout URL: {actor.get('cutout_url', '')}
Headline: {copy.get('headline', '')}
Subheadline: {copy.get('subheadline', '')}
CTA text: {copy.get('cta', 'Apply Now')}
Visual direction: {vd_summary}
Language: {copy.get('language', 'en')}

PERSON POSITIONING (CRITICAL — violations fail VQA):
- The actor's face MUST be fully visible (not cropped at any edge).
- The actor must occupy 50-55% of the canvas height.
- On vertical platforms (Stories/TikTok/Reels), position the person in the UPPER 60% of canvas.
  This keeps the face ABOVE the bottom dead zone (caption/nav bars).
- The face must NOT be behind platform action buttons (right side on TikTok).
- Do NOT center the person vertically — bias them UPWARD to stay in the safe zone."""


def _section_brand_rules() -> str:
    return """BRAND RULES (MANDATORY — violations fail VQA):
- Colors: deep purple #3D1059→#6B21A8, hot pink CTA #E91E8C. NO gold, NO yellow, NO orange.
- Typography: system fonts ONLY — font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif
- CTA: pill buttons (border-radius: 9999px), gradient or filled, white uppercase text
- Photo: ONE LARGE FACE (50-55% canvas height). NOT multiple small faces.
- Whitespace: 20-30% intentional blank space (breathing room)
- Avatar-stack social proof: MANDATORY — 3-4 overlapping circles + "+50K contributors"
- Blob shapes: NEVER occupy >15% of canvas area. They are accents, not features.
- No dot-pattern textures as primary design element
- No "Powered by Centific" text"""


def _section_output_format(width: int, height: int) -> str:
    return f"""OUTPUT FORMAT — Return valid JSON (no markdown fences):
{{
  "archetype": "floating_props|gradient_hero|photo_feature",
  "artifacts_used": ["artifact_id_1", "artifact_id_2"],
  "layer_manifest": [
    {{"z": 0, "artifact_id": "gradient_sapphire_pink", "role": "background", "css": "position:absolute;top:0;left:0;width:100%;height:100%;"}},
    {{"z": 1, "artifact_id": "blob_organic_1", "role": "accent", "css": "position:absolute;top:0;right:0;width:400px;opacity:0.4;"}}
  ],
  "html": "<div style=\\"position:relative;width:{width}px;height:{height}px;overflow:hidden;\\">...</div>"
}}

CRITICAL RULES:
- Every <img> src MUST be a blob_url from the artifact catalog OR an actor photo URL. No other URLs.
- Never inline SVG <path> data. Never write gradient CSS from scratch — use artifact blob_url.
- The outer container MUST be exactly {width}x{height}px with position:relative and overflow:hidden.
- All layers use position:absolute.
- The "html" field must be a SINGLE self-contained HTML string — no external references except blob URLs."""


# ── Main Builder ────────────────────────────────────────────────

def build_compositor_prompt(
    catalog: list[dict[str, Any]],
    archetype: str,
    platform: str,
    platform_spec: dict[str, Any],
    pillar: str,
    actor: dict[str, Any],
    copy: dict[str, Any],
    visual_direction: dict[str, Any] | None = None,
) -> str:
    """Build the complete 6-section GLM-5 compositor prompt.

    Returns a single string to be used as the user message in the chat completion.
    """
    sections = [
        _section_role(),
        build_artifact_catalog_section(catalog),
        _section_archetype(archetype),
        _section_inputs(platform, platform_spec, pillar, actor, copy, visual_direction or {}),
        _section_brand_rules(),
        _section_output_format(platform_spec["width"], platform_spec["height"]),
    ]
    return "\n\n---\n\n".join(sections)


def inject_vqa_feedback(original_prompt: str, vqa_result: dict[str, Any]) -> str:
    """Append VQA feedback to the prompt for retry attempts.

    Instructs the model to edit (not regenerate) the existing HTML.
    """
    score = vqa_result.get("score", vqa_result.get("overall_score", 0))
    issues = vqa_result.get("issues", [])
    top_fixes = vqa_result.get("top_3_fixes", [])

    feedback_items = issues + top_fixes
    feedback_text = "\n".join(f"- {item}" for item in feedback_items[:6])

    return f"""{original_prompt}

---

VQA FEEDBACK (your previous design scored {score:.2f}/1.0):
{feedback_text}

Fix ONLY the listed issues. Keep everything else intact.
Do NOT regenerate from scratch — edit the existing HTML.
Return the same JSON format with updated html and layer_manifest."""
