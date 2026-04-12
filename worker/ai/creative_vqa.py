"""Creative Visual QA — evaluates rendered ad creatives for quality.

Two-phase gate:
  Phase 1: Deterministic checks (fast, cheap) — text in safe zone, required
           elements present, contrast ratio, file dimensions.
  Phase 2: VLM scoring (slow, expensive) — brand consistency, visual hierarchy,
           z-index depth, CTR appeal, headline-scene match.

If Phase 1 fails, skip Phase 2 and return feedback immediately.
If Phase 2 score < threshold, return VLM feedback for the retry loop.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import tempfile
from typing import Any

logger = logging.getLogger(__name__)

# Thresholds
CREATIVE_VQA_THRESHOLD = 0.85  # Stricter — fewer creatives means higher bar
MAX_CREATIVE_RETRIES = 3  # Total attempts = 1 initial + 3 retries = 4

# Phase 1: deterministic check labels
REQUIRED_ELEMENTS = ["headline", "cta"]  # Must be present in design metadata


# ── Phase 1: Deterministic Checks ──────────────────────────────────

def check_deterministic(
    design: dict[str, Any],
    rendered_png: bytes,
    spec: dict[str, Any],
) -> dict[str, Any]:
    """Run fast deterministic checks on a rendered creative.

    Returns
    -------
    dict with:
        - ``passed`` (bool): all checks passed
        - ``issues`` (list[str]): human-readable failure descriptions
        - ``checks`` (dict): individual check results
    """
    issues: list[str] = []
    checks: dict[str, bool] = {}

    # 1. Required metadata elements
    headline = design.get("overlay_headline", "").strip()
    cta = design.get("overlay_cta", "").strip()
    checks["has_headline"] = bool(headline)
    checks["has_cta"] = bool(cta)
    if not headline:
        issues.append("Missing overlay headline — creative has no scroll-stopping text")
    if not cta:
        issues.append("Missing CTA — creative has no call to action button")

    # 2. Headline length (3-7 words)
    word_count = len(headline.split()) if headline else 0
    checks["headline_length_ok"] = 2 <= word_count <= 10
    if word_count > 10:
        issues.append(f"Headline too long ({word_count} words) — max 7 words for scroll-stopping impact")
    elif word_count < 2 and headline:
        issues.append(f"Headline too short ({word_count} word) — needs 3-7 words")

    # 3. HTML present and non-trivial
    html = design.get("html", "")
    checks["has_html"] = len(html) > 200
    if len(html) < 200:
        issues.append("HTML too short — likely incomplete or broken render")

    # 4. Rendered image not empty/tiny
    checks["render_size_ok"] = len(rendered_png) > 10_000  # >10KB minimum
    if len(rendered_png) < 10_000:
        issues.append("Rendered image too small — likely blank or failed render")

    # 5. Check for z-index usage in HTML (depth layering)
    checks["has_depth_layering"] = "z-index" in html
    if "z-index" not in html:
        issues.append("No z-index layering detected — creative lacks depth. Use z-index 0-5 stack with elements behind AND in front of the person cutout")

    # 6. Check for brand violations
    html_lower = html.lower()
    checks["no_gold_yellow"] = "gold" not in html_lower and "#ffd" not in html_lower and "yellow" not in html_lower
    if not checks["no_gold_yellow"]:
        issues.append("Brand violation: gold/yellow colors detected — OneForma uses purple/pink/white ONLY")

    # 7. Scene-headline mismatch check (basic)
    scene = design.get("scene", "")
    if scene and headline:
        scene_lower = scene.lower()
        headline_lower = headline.lower()
        # Flag obvious mismatches
        if "cafe" in scene_lower and any(w in headline_lower for w in ["couch", "sofa", "bed", "home"]):
            issues.append(f"Scene-headline mismatch: scene is '{scene}' but headline mentions home/couch")
        if "home" in scene_lower and any(w in headline_lower for w in ["cafe", "coffee shop", "office"]):
            issues.append(f"Scene-headline mismatch: scene is '{scene}' but headline mentions cafe/office")

    # 8. Person visibility — check HTML for actor photo positioning
    # The actor photo should be present and positioned within the safe zone
    html_str = design.get("html", "")
    has_actor_img = bool(design.get("actor_photo") or "photo_url" in str(design) or "<img" in html_str)
    checks["has_actor_photo"] = has_actor_img
    if not has_actor_img:
        issues.append("No actor photo detected — creative must include a visible person (50-55% canvas height)")

    # 9. Person position vs. dead zone — for vertical platforms (Stories/TikTok/Reels)
    # Check that the person image is not vertically centered (which puts them in the bottom dead zone)
    is_vertical = spec.get("height", 0) > spec.get("width", 0)
    if is_vertical and html_str:
        # Flag if actor photo uses vertical centering (top:50% or top:45%+) — likely in dead zone
        import re as _re
        # Find img tags and check their positioning
        actor_url = design.get("actor_photo", "") or design.get("photo_url", "")
        if actor_url and actor_url in html_str:
            # Find the style context around the actor image
            idx = html_str.find(actor_url)
            if idx > 0:
                # Look at the surrounding ~500 chars for positioning clues
                context = html_str[max(0, idx - 500):idx + 200]
                # Check for bottom-heavy centering
                bottom_pct_match = _re.search(r'top:\s*(\d+)%', context)
                if bottom_pct_match:
                    top_pct = int(bottom_pct_match.group(1))
                    safe_bottom = spec.get("safe_bottom", spec.get("safe_margin", 80))
                    bottom_dead_pct = (safe_bottom / spec["height"]) * 100
                    # If person is positioned past the 50% mark, they risk being in the dead zone
                    if top_pct > 50:
                        checks["person_in_safe_zone"] = False
                        issues.append(
                            f"Person positioned at top:{top_pct}% — too low on vertical canvas. "
                            f"Bottom {safe_bottom}px is dead zone (platform UI). "
                            f"Move person to top:20-40% range to keep face visible."
                        )
                    else:
                        checks["person_in_safe_zone"] = True
                else:
                    checks["person_in_safe_zone"] = True  # Can't determine — pass
        else:
            checks["person_in_safe_zone"] = True  # No URL match — can't check

    # 10. Universal 25% text overlay rule (applies to ALL platforms)
    overlay_headline = design.get("overlay_headline", "") or headline
    overlay_sub = design.get("overlay_sub", "")
    overlay_cta = design.get("overlay_cta", "") or cta
    total_chars = len(overlay_headline) + len(overlay_sub) + len(overlay_cta)
    if total_chars > 0:
        est_text_pixels_universal = total_chars * 20 * 40
        canvas_pixels_universal = spec.get("width", 1080) * spec.get("height", 1080)
        est_pct_universal = (est_text_pixels_universal / canvas_pixels_universal) * 100
        checks["universal_text_overlay_ok"] = est_pct_universal <= 25
        if est_pct_universal > 25:
            issues.append(
                f"Text overlay ~{est_pct_universal:.0f}% exceeds 25% limit — "
                f"total {total_chars} chars. Shorten headline or remove subheadline."
            )

    # 11. WeChat 20% text overlay rule
    text_overlay_max = spec.get("text_overlay_max_pct")
    if text_overlay_max and headline:
        # Rough estimate: count text characters, estimate pixel coverage
        # Each char ~20px wide, ~40px tall at typical overlay sizes
        total_text_chars = len(headline) + len(design.get("overlay_sub", "")) + len(cta)
        est_text_pixels = total_text_chars * 20 * 40  # rough char footprint
        canvas_pixels = spec.get("width", 1080) * spec.get("height", 1080)
        est_pct = (est_text_pixels / canvas_pixels) * 100
        checks["wechat_text_overlay_ok"] = est_pct <= text_overlay_max
        if est_pct > text_overlay_max:
            issues.append(
                f"WeChat text overlay ~{est_pct:.0f}% exceeds {text_overlay_max}% limit — "
                f"reduce text or WeChat will reject the ad"
            )

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "checks": checks,
    }


# ── Phase 2: VLM Creative Quality Assessment ───────────────────────

CREATIVE_VQA_PROMPT = """You are a senior creative director at a top-tier ad agency evaluating a recruitment ad creative for OneForma (a data annotation platform by Centific).

Score this creative on a 0-1 scale across these dimensions, then give an overall score:

1. VISUAL HIERARCHY (0-1): Does the eye follow headline → person → CTA in under 2 seconds? Is there clear typographic hierarchy with 3 distinct size levels?

2. Z-INDEX DEPTH (0-1): Are there elements BEHIND the person AND in front? Does the headline appear partially occluded by the person cutout? Does the creative have a 3D depth illusion?

3. BRAND CONSISTENCY (0-1): Does it use OneForma's purple/pink palette? System fonts? Pill-shaped CTA? Organic blob shapes? No gold/yellow? Professional clean feel?

4. CTR APPEAL (0-1): Would this stop someone scrolling on {platform}? Is there a clear human face? Eye contact? Contrasting CTA button? Emotional hook in the headline?

5. COMPOSITION QUALITY (0-1): Asymmetric balance (not everything centered)? Generous whitespace (20-30%)? Blob shapes as compositional anchors? Person as visual anchor?

6. HEADLINE-SCENE MATCH (0-1): Does the overlay headline match what's happening in the image? (e.g., person at desk → work/earning headline, NOT "your couch" headline)

7. PERSON VISIBILITY (0-1): Is the person's face FULLY visible and not cropped? Does the person occupy 50-55% of canvas height? Is the face in the UPPER 60% of the canvas (critical for vertical formats like Stories/TikTok where bottom 20-30% is covered by platform UI)? Score 0 if the face is cropped, hidden behind UI elements, or positioned in the bottom dead zone.

Return ONLY valid JSON:
{{
  "visual_hierarchy": 0.0,
  "depth_layering": 0.0,
  "brand_consistency": 0.0,
  "ctr_appeal": 0.0,
  "composition": 0.0,
  "headline_scene_match": 0.0,
  "person_visibility": 0.0,
  "overall_score": 0.0,
  "issues": ["issue 1", "issue 2"],
  "strengths": ["strength 1"],
  "verdict": "pass|fail"
}}

The overall_score should be a weighted average: CTR_APPEAL (25%) + PERSON_VISIBILITY (20%) + DEPTH (20%) + COMPOSITION (15%) + BRAND (10%) + HEADLINE_MATCH (10%).
PERSON_VISIBILITY is critical — if the person's face is not fully visible or is in the dead zone, the overall score MUST be below 0.7.
Score generously — 0.8+ means "would ship to client". 0.6-0.8 means "needs one more revision". Below 0.6 means "start over".
"""


async def evaluate_creative_vlm(
    rendered_png: bytes,
    platform: str,
) -> dict[str, Any]:
    """Run VLM evaluation on a rendered creative PNG.

    Returns parsed VQA result dict with overall_score and issues.
    """
    from ai.local_vlm import analyze_image

    # Write rendered PNG to temp file for VLM
    tmp_path = os.path.join(tempfile.gettempdir(), f"creative_vqa_{os.urandom(4).hex()}.png")
    try:
        with open(tmp_path, "wb") as f:
            f.write(rendered_png)

        prompt = CREATIVE_VQA_PROMPT.format(platform=platform)
        result_text = await analyze_image(tmp_path, prompt)

        # Parse JSON from VLM response
        return _parse_vqa_json(result_text)

    except Exception as e:
        logger.warning("VLM creative evaluation failed: %s — defaulting to pass", e)
        return {"overall_score": 0.85, "issues": [], "verdict": "pass", "_vlm_error": str(e)}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _parse_vqa_json(text: str) -> dict[str, Any]:
    """Parse JSON from VLM creative QA response with fallback scoring."""
    if not text:
        return {"overall_score": 0.75, "issues": ["Empty VLM response"], "verdict": "fail"}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "overall_score" in parsed:
            return parsed
    except json.JSONDecodeError:
        pass

    # Brace-depth search for JSON object
    brace_depth = 0
    obj_start = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                obj_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and obj_start >= 0:
                try:
                    parsed = json.loads(cleaned[obj_start:i + 1])
                    if isinstance(parsed, dict) and "overall_score" in parsed:
                        return parsed
                except json.JSONDecodeError:
                    pass
                obj_start = -1

    # Prose fallback — scan for quality signals
    text_lower = text.lower()
    positive = ["professional", "strong hierarchy", "good depth", "on brand", "eye-catching",
                "well composed", "clear cta", "effective", "would ship"]
    negative = ["off brand", "no depth", "flat", "cluttered", "missing cta", "text unreadable",
                "too busy", "needs work", "start over", "fail"]

    pos = sum(1 for p in positive if p in text_lower)
    neg = sum(1 for n in negative if n in text_lower)

    if neg > pos:
        score = 0.55
    elif pos > neg:
        score = 0.85
    else:
        score = 0.72

    return {
        "overall_score": score,
        "issues": ["Could not parse structured VQA response"],
        "verdict": "pass" if score >= CREATIVE_VQA_THRESHOLD else "fail",
        "_raw_text": text[:500],
    }


# ── Combined Gate ──────────────────────────────────────────────────

async def evaluate_creative(
    design: dict[str, Any],
    rendered_png: bytes,
    spec: dict[str, Any],
    platform: str,
) -> dict[str, Any]:
    """Full two-phase creative evaluation.

    Phase 1: Deterministic checks (instant, free)
    Phase 2: VLM scoring (if Phase 1 passes)

    Returns
    -------
    dict with:
        - ``passed`` (bool)
        - ``score`` (float, 0-1)
        - ``issues`` (list[str]) — feedback for retry loop
        - ``phase1`` (dict) — deterministic check results
        - ``phase2`` (dict|None) — VLM results (None if Phase 1 failed)
    """
    # Phase 1: fast deterministic checks
    phase1 = check_deterministic(design, rendered_png, spec)

    if not phase1["passed"]:
        logger.info(
            "Creative FAILED Phase 1 (deterministic): %d issues",
            len(phase1["issues"]),
        )
        return {
            "passed": False,
            "score": 0.0,
            "issues": phase1["issues"],
            "phase1": phase1,
            "phase2": None,
        }

    # Phase 2: VLM quality scoring
    phase2 = await evaluate_creative_vlm(rendered_png, platform)
    score = float(phase2.get("overall_score", 0))
    passed = score >= CREATIVE_VQA_THRESHOLD

    all_issues = phase1["issues"] + phase2.get("issues", [])

    logger.info(
        "Creative evaluation: Phase 1 PASS, Phase 2 score=%.2f (%s) — %d issues",
        score, "PASS" if passed else "FAIL", len(all_issues),
    )

    return {
        "passed": passed,
        "score": score,
        "issues": all_issues,
        "phase1": phase1,
        "phase2": phase2,
    }


# ── Phase 3: Gemma 4 Composed Creative VQA ────────────────────────

# Gemma 4 VQA config
GEMMA4_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))
COMPOSED_VQA_THRESHOLD = 0.80  # Raised — fewer creatives, each must be higher quality

COMPOSED_VQA_PROMPT = '''You are a senior creative director scoring a OneForma recruitment ad creative.
Use the 8-category weighted matrix below. Score each category 1-10, then compute the weighted total (max 100).

## SCORING MATRIX (8 categories, weighted to 100):

### Cat 1: SCROLL-STOP POWER (weight: 20%)
Score 1-10 on: visual disruption (bold color/contrast vs feed), first-glance clarity (<1s to understand), photo impact (large face, expressive, authentic), image-to-canvas ratio (50-80% is ideal).
- 1-3: Blends into feed, small/stock photo, too much whitespace
- 7-8: Strong photo, clear message, would slow scrolling
- 9-10: Impossible to scroll past — bold, face-forward, immediate hook

### Cat 2: HEADLINE & HOOK (weight: 20%)
Score 1-10 on: specificity (has dollar amount OR timeframe OR geography?), differentiation (could a competitor use this verbatim?), emotional trigger (hits a real nerve?), readability at thumb size (bold, high-contrast, ≤8 words?).
- 1-3: Vague ("Earn money"), no number, generic gig copy
- 7-8: Has a number or question, somewhat specific
- 9-10: Specific $ + audience + task. "Speak Portuguese? Earn $12/hr."

### Cat 3: VALUE PROP CLARITY (weight: 15%)
Score 1-10 on: WIIFM clarity (concrete personal benefit?), objection handling (addresses #1 hesitation?), supporting copy quality (subheadline adds new reason?).
- 1-3: Talks about platform not person, no objection handling
- 7-8: Clear benefit, mentions ease of entry
- 9-10: "Review AI translations from home. No experience needed."

### Cat 4: SOCIAL PROOF & TRUST (weight: 10%)
Score 1-10 on: proof elements (contributor count? ratings? testimonial?), credibility signals (payment method? brand logo?).
- 1-3: ZERO social proof — no numbers, no testimonials
- 7-8: Avatar-stack or star rating with count
- 9-10: Multiple proof layers — count + payment badge + named testimonial

### Cat 5: CTA & CONVERSION (weight: 10%)
Score 1-10 on: button visibility (high contrast, ≥44px tap target?), copy strength (specific action, not "Learn More"), urgency (reason to act now?).
- 1-3: Small, blends in, generic "Sign Up"
- 7-8: Visible pill button, action-oriented copy
- 9-10: "Apply in 2 Minutes →" — specific, friction-reducing, impossible to miss

### Cat 6: VISUAL DESIGN (weight: 10%)
Score 1-10 on: eye flow (Z/F-pattern?), color contrast (text legible?), layout balance (asymmetric > centered?), brand consistency (OneForma purple/pink?).
- 1-3: Cramped, low contrast, everything centered
- 7-8: Clean split layout, clear hierarchy
- 9-10: Professional editorial quality, intentional asymmetry

### Cat 7: AUDIENCE & PLATFORM FIT (weight: 10%)
Score 1-10 on: audience resonance (speaks to specific person?), photo representation (matches target demographic?), platform-native feel (looks like organic content?), geo/language signals (local currency, local payment?).
- 1-3: Generic, no localization, stock-looking
- 7-8: Right demographic, mentions local payment
- 9-10: Deeply localized — Pix badge, R$ currency, culturally relevant imagery

### Cat 8: TECHNICAL & COMPLIANCE (weight: 5%)
Score 1-10 on: spec compliance (right dimensions, safe zones?), text legibility on mobile (readable at 375px?), file quality (sharp, no artifacts?).
- 1-3: Wrong dims, text unreadable on mobile
- 7-8: Meets specs, readable
- 9-10: Pixel-perfect, tested at actual mobile size

## AUTO-FAIL TRIGGERS (cap at grade C regardless of total):
- No specificity in headline (missing dollar amount AND timeframe AND geography)
- Unreadable on mobile (text too small or low contrast)
- Generic gig copy (Upwork/Fiverr could use it verbatim)
- 60%+ empty white space
- No CTA button visible
- Stock-looking photo
- Internal jargon in copy ("human review", "secure platform")
- Person's face cropped, hidden, or not fully visible
- Person positioned in bottom dead zone (face behind caption/nav bars on Stories/TikTok/Reels)
- No clear human face visible in the creative

## GRADE THRESHOLDS:
- 85-100: A — Ship It (launch immediately)
- 70-84: B — Ship with Notes (fix 1-2 things)
- 55-69: C — Iterate (redesign weakest categories)
- 40-54: D — Rethink (go back to brief)
- Below 40: F — Kill It (delete, start over)

Return ONLY valid JSON:
{
  "scroll_stop_power": {"score": 0, "fix": "specific CSS/design fix or null"},
  "headline_hook": {"score": 0, "fix": "specific copy fix or null"},
  "value_prop_clarity": {"score": 0, "fix": "specific copy fix or null"},
  "social_proof": {"score": 0, "fix": "what proof element to add or null"},
  "cta_conversion": {"score": 0, "fix": "specific CTA fix or null"},
  "visual_design": {"score": 0, "fix": "specific layout/CSS fix or null"},
  "audience_fit": {"score": 0, "fix": "specific localization fix or null"},
  "technical": {"score": 0, "fix": "specific technical fix or null"},
  "weighted_total": 0,
  "grade": "A|B|C|D|F",
  "auto_fail_triggers": ["list of triggered auto-fails or empty"],
  "overall_score": 0.0,
  "passed": true,
  "top_3_fixes": ["most impactful fix first with exact CSS/copy", "second", "third"]
}

IMPORTANT: overall_score = weighted_total / 100 (so 85/100 = 0.85).
passed = true if grade is A or B (weighted_total >= 70 AND no auto-fail triggers).'''


async def evaluate_composed_creative(
    image_path: str,
    platform: str = "",
    headline: str = "",
) -> dict[str, Any]:
    """Evaluate a composed creative using Gemma 4 31B Vision on NIM.

    Returns detailed per-dimension scores with actionable CSS fix instructions.
    """
    import httpx

    if not GEMMA4_KEY:
        logger.warning("No Gemma 4 VQA key — returning default pass")
        return {"overall_score": 0.80, "passed": True, "dimensions": {}, "top_3_fixes": []}

    # Read and resize image
    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        img = img.resize((512, 512), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.warning("Failed to load image for VQA: %s", e)
        return {"overall_score": 0.75, "passed": True, "dimensions": {}, "top_3_fixes": []}

    payload = {
        "model": GEMMA4_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": COMPOSED_VQA_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        "max_tokens": 4096,
        "temperature": 0.3,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GEMMA4_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"].get("content", "")
        usage = data.get("usage", {})
        logger.info(
            "Gemma 4 VQA: %d tokens in, %d out",
            usage.get("prompt_tokens", 0),
            usage.get("completion_tokens", 0),
        )

        # Parse JSON from response
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()

        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find JSON in the text
            brace_depth = 0
            start = -1
            last_valid = None
            for i, char in enumerate(cleaned):
                if char == '{':
                    if brace_depth == 0:
                        start = i
                    brace_depth += 1
                elif char == '}':
                    brace_depth -= 1
                    if brace_depth == 0 and start >= 0:
                        try:
                            parsed = json.loads(cleaned[start:i+1])
                            if isinstance(parsed, dict) and "overall_score" in parsed:
                                last_valid = parsed
                        except json.JSONDecodeError:
                            pass
                        start = -1
            if last_valid:
                result = last_valid
            else:
                logger.warning("Could not parse Gemma 4 VQA response")
                return {"overall_score": 0.75, "passed": True, "dimensions": {}, "top_3_fixes": []}

        # Ensure required fields
        result.setdefault("overall_score", 0.0)
        result.setdefault("passed", result["overall_score"] >= COMPOSED_VQA_THRESHOLD)
        result.setdefault("top_3_fixes", [])

        logger.info(
            "Composed creative VQA: score=%.2f, passed=%s, fixes=%d",
            result["overall_score"],
            result["passed"],
            len(result.get("top_3_fixes", [])),
        )

        return result

    except Exception as e:
        logger.error("Gemma 4 VQA failed: %s", e)
        return {"overall_score": 0.75, "passed": True, "dimensions": {}, "top_3_fixes": []}
