"""Pillar Router — deterministic classification of jobs to creative pillars.

Maps job characteristics (qualifications, compensation, engagement model,
technical requirements) to the most appropriate creative pillar:

  EARN  — financial motivation, reward, entry-level gig economy
  GROW  — skill development, career building, aspiration
  SHAPE — expertise, credibility, professional authority

The router returns a primary + secondary pillar. The recruiter can
override via the intake form (pillar_override field).

Usage::

    from compositor.pillar_router import classify_pillar

    result = classify_pillar(form_data)
    # {"primary": "shape", "secondary": "earn", "confidence": 0.85, "reasoning": "..."}
"""
from __future__ import annotations

import re
from typing import Any

# ── Signal keywords per pillar ────────────────────────────────────
# Weighted: strong signals (3 points), moderate (2), weak (1)

_SHAPE_STRONG = {
    "phd", "ph.d", "doctorate", "doctoral", "postdoc", "professor",
    "master's degree", "masters degree", "msc", "mba",
    "specialist", "expert", "senior", "principal", "lead",
    "certified", "certification", "licensed", "accredited",
    "years of experience", "years experience", "domain expert",
    "research", "researcher", "scientist", "engineer",
    "medical", "clinical", "legal", "financial",
    "professional", "industry experience", "subject matter expert",
}

_SHAPE_MODERATE = {
    "bachelor", "degree required", "university", "graduate",
    "technical expertise", "advanced", "specialized",
    "consultant", "analyst", "architect", "manager",
    "portfolio required", "published", "peer-reviewed",
    "fluent in", "native speaker", "c1", "c2",
}

_GROW_STRONG = {
    "learn", "learning", "training", "develop", "development",
    "skill-building", "career growth", "career development",
    "mentorship", "upskill", "reskill", "portfolio",
    "gain experience", "build your", "grow your",
    "no experience required", "beginners welcome", "entry-level",
    "students welcome", "fresh graduates",
}

_GROW_MODERATE = {
    "flexible", "remote work", "work from home", "part-time",
    "freelance", "side hustle", "contract", "project-based",
    "bilingual", "multilingual", "language skills",
    "creative", "writing", "translation",
    "community", "contributor", "crowd",
}

_EARN_STRONG = {
    "per hour", "/hr", "$/hr", "per task", "per unit",
    "bonus", "incentive", "reward", "payout", "payment",
    "earn", "earning", "income", "money",
    "quick tasks", "micro tasks", "simple tasks",
    "data collection", "data annotation", "labeling",
    "survey", "recording", "selfie", "photo tasks",
    "no qualifications", "anyone can", "open to all",
}

_EARN_MODERATE = {
    "gig", "crowd-sourcing", "crowdsource",
    "sign up", "register", "apply now",
    "immediate start", "start today", "start earning",
    "weekly pay", "daily pay", "fast payment",
    "volume", "quantity", "batch",
    "transcription", "categorization", "tagging",
}


def _score_text(text: str) -> dict[str, float]:
    """Score a text blob against all three pillars.

    Returns {"earn": float, "grow": float, "shape": float}
    """
    text_lower = text.lower()
    scores = {"earn": 0.0, "grow": 0.0, "shape": 0.0}

    for keyword in _SHAPE_STRONG:
        if keyword in text_lower:
            scores["shape"] += 3
    for keyword in _SHAPE_MODERATE:
        if keyword in text_lower:
            scores["shape"] += 2

    for keyword in _GROW_STRONG:
        if keyword in text_lower:
            scores["grow"] += 3
    for keyword in _GROW_MODERATE:
        if keyword in text_lower:
            scores["grow"] += 2

    for keyword in _EARN_STRONG:
        if keyword in text_lower:
            scores["earn"] += 3
    for keyword in _EARN_MODERATE:
        if keyword in text_lower:
            scores["earn"] += 2

    return scores


def _extract_compensation_signal(form_data: dict) -> str | None:
    """Extract hourly rate from compensation fields and classify tier."""
    comp_fields = [
        form_data.get("compensation", ""),
        form_data.get("rate", ""),
        form_data.get("pay_rate", ""),
        str(form_data.get("country_quotas", "")),
    ]
    text = " ".join(str(f) for f in comp_fields if f)

    # Extract dollar amounts
    amounts = re.findall(r'\$\s*(\d+(?:\.\d+)?)', text)
    if not amounts:
        return None

    max_rate = max(float(a) for a in amounts)

    # Tier classification
    if max_rate >= 50:
        return "shape"  # $50+/hr = expert-level
    elif max_rate >= 25:
        return "grow"   # $25-49/hr = skilled work
    else:
        return "earn"   # Under $25/hr = volume work


def _extract_engagement_signal(form_data: dict) -> str | None:
    """Classify engagement model."""
    model = str(form_data.get("engagement_model", "")).lower()

    if any(w in model for w in ("full-time", "permanent", "long-term", "retainer")):
        return "shape"
    elif any(w in model for w in ("contract", "project", "freelance", "part-time")):
        return "grow"
    elif any(w in model for w in ("gig", "per-task", "micro", "one-time", "batch")):
        return "earn"

    return None


def classify_pillar(form_data: dict[str, Any]) -> dict[str, Any]:
    """Classify a job's creative pillar based on form data.

    Parameters
    ----------
    form_data:
        Intake form data dict. Relevant fields:
        - qualifications_required, qualifications_preferred
        - technical_requirements, context_notes
        - engagement_model, compensation, rate
        - task_type, description, title

    Returns
    -------
    dict with:
        - primary: str ("earn" | "grow" | "shape")
        - secondary: str (different from primary)
        - confidence: float (0-1)
        - reasoning: str (human-readable explanation)
        - scores: dict[str, float] (raw scores per pillar)
    """
    # Combine all text fields for keyword scoring
    text_fields = [
        form_data.get("qualifications_required", ""),
        form_data.get("qualifications_preferred", ""),
        form_data.get("technical_requirements", ""),
        form_data.get("context_notes", ""),
        form_data.get("task_type", ""),
        form_data.get("description", ""),
        form_data.get("title", ""),
        form_data.get("job_title", ""),
    ]
    combined_text = " ".join(str(f) for f in text_fields if f)

    # Score keywords
    scores = _score_text(combined_text)

    # Add compensation signal (strong — 5 points)
    comp_signal = _extract_compensation_signal(form_data)
    if comp_signal:
        scores[comp_signal] += 5

    # Add engagement model signal (moderate — 3 points)
    engagement_signal = _extract_engagement_signal(form_data)
    if engagement_signal:
        scores[engagement_signal] += 3

    # Determine primary + secondary
    sorted_pillars = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    primary = sorted_pillars[0][0]
    secondary = sorted_pillars[1][0]

    # Confidence: how much does primary beat secondary?
    total = sum(scores.values()) or 1
    confidence = min(1.0, (scores[primary] - scores[secondary]) / total + 0.5)

    # Build reasoning
    reasons = []
    if comp_signal:
        reasons.append(f"compensation suggests {comp_signal}")
    if engagement_signal:
        reasons.append(f"engagement model ({form_data.get('engagement_model', '')}) suggests {engagement_signal}")

    top_keyword_hits = []
    text_lower = combined_text.lower()
    for kw_set, label in [
        (_SHAPE_STRONG, "shape"), (_GROW_STRONG, "grow"), (_EARN_STRONG, "earn")
    ]:
        hits = [kw for kw in kw_set if kw in text_lower]
        if hits:
            top_keyword_hits.append(f"{label}: {', '.join(hits[:3])}")

    if top_keyword_hits:
        reasons.append(f"keywords matched: {'; '.join(top_keyword_hits)}")

    reasoning = f"Primary={primary} (score {scores[primary]:.0f}), secondary={secondary} (score {scores[secondary]:.0f}). "
    if reasons:
        reasoning += " | ".join(reasons)
    else:
        reasoning += "No strong signals — defaulting to earn."

    # Check for recruiter override
    override = form_data.get("pillar_override", "")
    if override and override.lower() in ("earn", "grow", "shape"):
        primary = override.lower()
        # Pick best secondary that isn't the override
        secondary = [p for p, _ in sorted_pillars if p != primary][0]
        reasoning = f"Recruiter override: {primary}. Auto-classified would have been {sorted_pillars[0][0]}."
        confidence = 1.0

    return {
        "primary": primary,
        "secondary": secondary,
        "confidence": round(confidence, 2),
        "reasoning": reasoning,
        "scores": {k: round(v, 1) for k, v in scores.items()},
    }
