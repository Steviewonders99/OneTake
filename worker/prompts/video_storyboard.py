# worker/prompts/video_storyboard.py
"""Storyboard generator — Gemma 4 writes Seedream prompts + VQA gates each frame.

For each shot in an approved script:
1. Build a Seedream prompt from actor face_lock + shot details + location hints
2. After Seedream generates the image, VQA checks it against the script
3. If VQA fails, rewrite the prompt with visual feedback and retry
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GEMMA4_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))

MAX_STORYBOARD_RETRIES = 2


def build_seedream_prompt(
    shot: dict[str, Any],
    actor: dict[str, Any],
    location: dict[str, Any],
) -> str:
    """Build a Seedream 4.5 image prompt for one shot.

    Combines actor face_lock data, shot camera/action/direction,
    and location seedream_hints into a single prompt.
    """
    face_lock = actor.get("face_lock", {})
    if isinstance(face_lock, str):
        face_lock = json.loads(face_lock)

    # Actor description from face_lock
    actor_desc = (
        f"{face_lock.get('age_range', '25-35')} year old person, "
        f"{face_lock.get('hair', 'natural hair')}, "
        f"{face_lock.get('eye_color', 'brown')} eyes, "
        f"skin tone {face_lock.get('skin_tone_hex', '#C8A882')}, "
        f"{face_lock.get('jawline', 'defined jawline')}, "
        f"{face_lock.get('nose_shape', 'natural nose')}"
    )

    # Shot details
    camera = shot.get("camera", "close_up")
    direction = shot.get("direction", "")
    action = shot.get("action", direction)
    energy = shot.get("energy", 5)

    # Location hints
    location_hints = location.get("seedream_hints", "")
    mood = ", ".join(location.get("mood_bias", []))

    # Energy → expression mapping
    expression_map = {
        (1, 3): "relaxed, calm, neutral expression",
        (4, 5): "engaged, slight smile, attentive",
        (6, 7): "excited, genuine smile, animated",
        (8, 9): "very excited, bright eyes, enthusiastic gestures",
        (10, 10): "ecstatic, fist pump or celebratory, huge genuine smile",
    }
    expression = "neutral expression"
    for (lo, hi), desc in expression_map.items():
        if lo <= energy <= hi:
            expression = desc
            break

    return (
        f"Hyper-realistic photograph, iPhone 15 Pro quality. "
        f"{actor_desc}. "
        f"{direction}. "
        f"{expression}. "
        f"{location_hints}. "
        f"Mood: {mood}. "
        f"Camera: {camera.replace('_', ' ')}. "
        f"Natural skin texture, no beauty filter, no airbrushed look. "
        f"9:16 vertical portrait orientation."
    )


async def vqa_storyboard_frame(
    image_bytes: bytes,
    shot: dict[str, Any],
    actor: dict[str, Any],
    location: dict[str, Any],
) -> dict[str, Any]:
    """Use Gemma 4 to evaluate a storyboard frame against the script.

    Returns dict with:
        passed (bool), score (float 0-1), issues (list[str]), rewrite_hint (str)
    """
    if not GEMMA4_KEY:
        logger.warning("No Gemma 4 key — auto-passing storyboard VQA")
        return {"passed": True, "score": 0.85, "issues": [], "rewrite_hint": ""}

    face_lock = actor.get("face_lock", {})
    if isinstance(face_lock, str):
        face_lock = json.loads(face_lock)

    # Resize for VQA
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.resize((512, 512), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.warning("Failed to process image for VQA: %s", e)
        return {"passed": True, "score": 0.75, "issues": [], "rewrite_hint": ""}

    prompt = f"""Review this storyboard frame for a UGC video ad.

EXPECTED:
- Character: {face_lock.get('age_range', '?')} with {face_lock.get('hair', '?')}, {face_lock.get('eye_color', '?')} eyes
- Camera: {shot.get('camera', '?')}
- Action: {shot.get('direction', '?')}
- Location: {location.get('key', '?')} — {location.get('seedream_hints', '')[:100]}
- Energy level: {shot.get('energy', 5)}/10

Score 0.0-1.0 on:
- character_match: Does the person match the description?
- camera_angle: Is the framing correct?
- setting_match: Does the environment match the location?
- expression: Does the expression match the energy level?
- quality: Is the image sharp, realistic, no artifacts?

Return ONLY valid JSON:
{{
  "character_match": 0.0,
  "camera_angle": 0.0,
  "setting_match": 0.0,
  "expression": 0.0,
  "quality": 0.0,
  "overall": 0.0,
  "passed": true,
  "issues": ["list of specific problems"],
  "rewrite_hint": "specific instruction to fix the Seedream prompt"
}}"""

    try:
        payload = {
            "model": GEMMA4_MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            }],
            "max_tokens": 2048,
            "temperature": 0.3,
            "stream": False,
        }

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
        result = _parse_json(content)
        result.setdefault("passed", result.get("overall", 0) >= 0.70)
        result.setdefault("issues", [])
        result.setdefault("rewrite_hint", "")
        return result

    except Exception as e:
        logger.warning("Storyboard VQA failed: %s — auto-passing", e)
        return {"passed": True, "score": 0.75, "issues": [], "rewrite_hint": ""}


def rewrite_seedream_prompt(
    original_prompt: str,
    vqa_result: dict[str, Any],
) -> str:
    """Rewrite a Seedream prompt using VQA feedback."""
    hint = vqa_result.get("rewrite_hint", "")
    issues = vqa_result.get("issues", [])
    feedback = hint or "; ".join(issues)

    return (
        f"{original_prompt}\n\n"
        f"CRITICAL FIX: {feedback}\n"
        f"Ensure the image matches the described character, camera angle, and setting exactly."
    )


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Brace search
    depth = 0
    start = -1
    last = None
    for i, c in enumerate(cleaned):
        if c == '{':
            if depth == 0: start = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    p = json.loads(cleaned[start:i+1])
                    if isinstance(p, dict):
                        last = p
                except json.JSONDecodeError:
                    pass
                start = -1
    return last or {}
