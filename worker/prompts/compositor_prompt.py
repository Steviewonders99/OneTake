"""Artifact-driven compositor prompt builder for GLM-5.

Builds a 7-section prompt that instructs GLM-5 to assemble pre-built
design artifacts into layered HTML creatives.

Section 7 (NEW): PPTX-extracted reference code showing real layered
design techniques — SVG clip-paths, gradient blobs, z-index stacking.
"""

from __future__ import annotations

from pathlib import Path
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


def _section_project_context(project_context: str, design_intent: str) -> str:
    """Build project context section with persona mini brief + design intent."""
    return f"""PROJECT CONTEXT (understand WHO this creative is for and WHY):

{project_context}

DESIGN INTENT (from copy strategist — design to support this angle):
{design_intent}

Use this context to make CREATIVE design decisions:
- Choose artifacts that match the persona's psychology type
- Adjust visual weight based on emotional tone
- A clinical professional should FEEL different from a gig worker
- Let the persona's trigger words and motivations guide your aesthetic choices"""


def filter_catalog(catalog: list[dict], pillar: str, platform: str) -> list[dict]:
    """Filter artifact catalog by pillar and format affinity."""
    filtered = []
    for a in catalog:
        pillar_match = not a.get("pillar_affinity") or pillar in a["pillar_affinity"]
        format_match = not a.get("format_affinity") or platform in a["format_affinity"]
        if pillar_match and format_match:
            filtered.append(a)
    # Always include at least the full catalog if filtering is too aggressive
    return filtered if len(filtered) >= 4 else catalog


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

    base = f"""CREATIVE INPUTS:
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

    # 25% text overlay enforcement
    text_rule = ""
    if copy.get("overlay_headline"):
        text_rule = f"""
TEXT OVERLAY RULE (HARD LIMIT — 25% max):
  The graphic copy has been pre-generated and length-optimized. Do NOT add extra text.
  Headline: {copy.get('overlay_headline', '')}
  Sub: {copy.get('overlay_sub', '')}
  CTA: {copy.get('overlay_cta', '')}
  Design around this text exactly as provided. Do NOT modify it."""

    # Task contextualizer device mockup
    device_block = ""
    device_url = actor.get("device_mockup_url", "")
    if device_url:
        device_block = f"""

TASK CONTEXTUALIZER (floating device showing what contributors DO — HIGH IMPACT):
  Device mockup URL: {device_url}
  This is a phone mockup showing the actual task interface.
  Layer it alongside or overlapping the actor photo:
  - Floating to the left or right of the actor
  - Slightly rotated (2-5 degrees tilt for natural feel)
  - 30-40% of canvas width
  - Subtle drop shadow (0 8px 24px rgba(0,0,0,0.15))
  - Can overlap the actor slightly for depth
  Usage: <img src="{device_url}" style="position:absolute; ..." />
  This element is OPTIONAL — skip if layout is too cramped.
  But when used, it dramatically increases perceived quality."""

    return base + text_rule + device_block


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


# ── Reference Code (PPTX-extracted layered designs) ────────────

# Best 3 references — picked for layer diversity and technique coverage.
# Purple/Black: gradient CTA pill, clipped photo, avatar circles, bold text
# Blue/Yellow: 5 gradient blobs + 7 clipped photos + 9 text layers (most complex)
# Purple/Pink: 12 clipped photos (blob masks), gradient blobs, 21 total layers
_REFERENCE_FILES = [
    "Purple_and_Black_Modern_Tech_Talk_Event_Promotion_Instagram_.html",
    "Blue_and_Yellow_Modern_Professional_We_Are_Hiring_Instagram_.html",
    "Purple_And_Pink_Modern_Software_Development_Instagram_Post.html",
]

_REF_DIR = Path(__file__).resolve().parent.parent.parent / "Designinspio" / "reference_code"

_reference_cache: str | None = None


def _load_references() -> str:
    """Load and cache reference code from PPTX-extracted HTML files."""
    global _reference_cache
    if _reference_cache is not None:
        return _reference_cache

    blocks = []
    for fname in _REFERENCE_FILES:
        fpath = _REF_DIR / fname
        if not fpath.exists():
            continue
        raw = fpath.read_text(encoding="utf-8")

        # Extract just the canvas div (skip DOCTYPE/head/body wrapper)
        canvas_start = raw.find('<div class="canvas">')
        canvas_end = raw.rfind("</div>\n</body>")
        if canvas_start == -1 or canvas_end == -1:
            continue
        canvas_html = raw[canvas_start:canvas_end + len("</div>")]

        # Extract the manifest comment
        manifest_start = raw.find("<!--")
        manifest_end = raw.find("-->")
        manifest = raw[manifest_start:manifest_end + 3] if manifest_start != -1 else ""

        # Clean template name
        label = fname.replace("_", " ").replace(".html", "").strip()

        blocks.append(f"""--- REFERENCE: {label} ---
{manifest}

CODE (study this layering technique):
{canvas_html}""")

    if not blocks:
        _reference_cache = ""
        return ""

    _reference_cache = """DESIGN REFERENCE CODE (extracted from professional PPTX templates):

Study these REAL designs to understand how professional designers layer elements.
Key techniques to replicate:
- SVG <clipPath> + <path> = organic blob-shaped photo masks (NOT border-radius)
- Multiple gradient blobs at different z-indices with rotation for depth
- Precise absolute positioning (every element has exact px coordinates)
- Text layers sit ABOVE photos and blobs (highest z-index)
- Gradient pills for CTA buttons with solid inner shapes
- Small clipped circles for avatar-stack social proof

DO NOT copy these designs verbatim. Study the TECHNIQUES and apply them
to the OneForma brand (purple #3D1059→#6B21A8, pink #E91E8C).

""" + "\n\n".join(blocks)

    return _reference_cache


def _section_reference_code() -> str:
    """Build reference code section from PPTX-extracted templates."""
    return _load_references()


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
    project_context: str = "",
    design_intent: str = "",
) -> str:
    """Build the complete GLM-5 compositor prompt.

    Returns a single string to be used as the user message in the chat completion.
    """
    sections = [
        _section_role(),
        _section_reference_code(),
        build_artifact_catalog_section(catalog),
        _section_archetype(archetype),
        _section_project_context(project_context, design_intent) if project_context else "",
        _section_inputs(platform, platform_spec, pillar, actor, copy, visual_direction or {}),
        _section_brand_rules(),
        _section_output_format(platform_spec["width"], platform_spec["height"]),
    ]
    return "\n\n---\n\n".join(s for s in sections if s)


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
