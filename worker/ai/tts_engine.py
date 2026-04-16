"""TTS Engine — routes to XTTS-v2 (free local) or ElevenLabs (paid).

XTTS-v2: 17 languages, FREE, runs on CPU/GPU locally
ElevenLabs: 32 languages, paid ($0.05-0.10/min), premium quality

Routing logic:
1. If language is supported by XTTS-v2 and no explicit provider override -> XTTS-v2
2. If language is NOT supported by XTTS-v2 -> ElevenLabs
3. If provider="elevenlabs" explicitly -> ElevenLabs (premium quality override)
4. If ElevenLabs API key is missing -> always XTTS-v2 (with warning if unsupported lang)
"""
from __future__ import annotations

import asyncio
import logging
import tempfile
from typing import Any

import httpx
from config import ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language support maps
# ---------------------------------------------------------------------------

XTTS_LANGUAGES: list[str] = [
    "en", "fr", "es", "pt", "de", "it", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh", "ja", "hu", "ko", "hi",
]

# Full language name -> ISO 639-1 code mapping for common languages
_LANGUAGE_CODES: dict[str, str] = {
    "english": "en", "french": "fr", "spanish": "es", "portuguese": "pt",
    "german": "de", "italian": "it", "polish": "pl", "turkish": "tr",
    "russian": "ru", "dutch": "nl", "czech": "cs", "arabic": "ar",
    "chinese": "zh", "japanese": "ja", "hungarian": "hu", "korean": "ko",
    "hindi": "hi", "thai": "th", "vietnamese": "vi", "indonesian": "id",
    "malay": "ms", "tagalog": "tl", "swahili": "sw", "persian": "fa",
    "urdu": "ur", "bengali": "bn", "tamil": "ta", "telugu": "te",
    "marathi": "mr", "gujarati": "gu", "kannada": "kn", "malayalam": "ml",
    "romanian": "ro", "ukrainian": "uk", "greek": "el", "hebrew": "he",
    "swedish": "sv", "norwegian": "no", "danish": "da", "finnish": "fi",
}

# ElevenLabs voice IDs by language/accent for natural sounding output
_ELEVENLABS_VOICES: dict[str, str] = {
    "en": "21m00Tcm4TlvDq8ikWAM",  # Rachel — clear, friendly
    "es": "AZnzlk1XvdvUeBnXmlld",  # Domi — warm Spanish
    "fr": "MF3mGyEYCl7XYWbV9V6O",  # Elli — natural French
    "de": "ErXwobaYiN019PkySvjV",  # Antoni — German-friendly
    "pt": "VR6AewLTigWG4xSOukaG",  # Arnold — Portuguese-friendly
    "default": "21m00Tcm4TlvDq8ikWAM",  # Rachel fallback
}


def _resolve_language_code(language: str) -> str:
    """Resolve a language name or code to an ISO 639-1 code."""
    lang_lower = language.lower().strip()
    # Already a code
    if len(lang_lower) <= 3:
        return lang_lower
    # Full name lookup
    return _LANGUAGE_CODES.get(lang_lower, lang_lower[:2])


def _select_provider(language: str, provider: str | None) -> str:
    """Select the best TTS provider for a language.

    Returns ``"xtts"`` or ``"elevenlabs"``.
    """
    if provider == "elevenlabs":
        if ELEVENLABS_API_KEY:
            return "elevenlabs"
        logger.warning(
            "ElevenLabs requested but no API key configured — falling back to XTTS"
        )
        return "xtts"

    if provider == "xtts":
        return "xtts"

    # Auto-routing
    lang_code = _resolve_language_code(language)
    if lang_code in XTTS_LANGUAGES:
        return "xtts"

    # Language not in XTTS — try ElevenLabs
    if ELEVENLABS_API_KEY:
        return "elevenlabs"

    # No ElevenLabs key — XTTS as best effort
    logger.warning(
        "Language '%s' not natively supported by XTTS-v2 and no ElevenLabs key. "
        "Attempting XTTS anyway — quality may be reduced.",
        language,
    )
    return "xtts"


async def generate_speech(
    text: str,
    language: str,
    voice_id: str | None = None,
    provider: str | None = None,
    speaker_wav: str | None = None,
) -> bytes:
    """Generate speech audio from text. Auto-routes to best provider.

    Parameters
    ----------
    text:
        The text to convert to speech.
    language:
        The target language (name or ISO code).
    voice_id:
        ElevenLabs voice ID (only used if provider is ElevenLabs).
    provider:
        Force a specific provider: ``"xtts"`` or ``"elevenlabs"``.
        If ``None``, auto-selects based on language support and availability.
    speaker_wav:
        Path to a speaker reference WAV file for XTTS voice cloning.

    Returns
    -------
    bytes
        Audio bytes in WAV format.
    """
    selected = _select_provider(language, provider)
    lang_code = _resolve_language_code(language)

    logger.info(
        "TTS: text=%d chars, language=%s (%s), provider=%s",
        len(text), language, lang_code, selected,
    )

    if selected == "elevenlabs":
        resolved_voice = voice_id or _ELEVENLABS_VOICES.get(
            lang_code, ELEVENLABS_DEFAULT_VOICE
        )
        return await generate_speech_elevenlabs(text, language, resolved_voice)
    else:
        return await generate_speech_xtts(text, language, speaker_wav)


async def generate_speech_xtts(
    text: str,
    language: str,
    speaker_wav: str | None = None,
) -> bytes:
    """Generate speech via local XTTS-v2 (free).

    XTTS-v2 runs as a local server (typically on port 8020) or can be
    called in-process via the TTS library. This implementation calls the
    local server first, with an in-process fallback.

    Parameters
    ----------
    text:
        Text to synthesize.
    language:
        Target language (name or ISO code).
    speaker_wav:
        Optional path to a speaker reference WAV for voice cloning.
        If not provided, uses the XTTS default speaker.

    Returns
    -------
    bytes
        WAV audio bytes.
    """
    lang_code = _resolve_language_code(language)

    # Try the local XTTS server first (faster, already warm)
    try:
        return await _xtts_server_generate(text, lang_code, speaker_wav)
    except Exception as exc:
        logger.warning("XTTS server unavailable (%s), falling back to in-process", exc)

    # Fallback: in-process TTS generation
    return await _xtts_inprocess_generate(text, lang_code, speaker_wav)


async def _xtts_server_generate(
    text: str,
    lang_code: str,
    speaker_wav: str | None,
) -> bytes:
    """Call the local XTTS-v2 server (coqui-ai/TTS server mode)."""
    payload: dict[str, Any] = {
        "text": text,
        "language": lang_code,
    }
    if speaker_wav:
        payload["speaker_wav"] = speaker_wav

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "http://localhost:8020/tts",
            json=payload,
        )
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "audio" in content_type or "octet-stream" in content_type:
            return resp.content

        # Some TTS servers return JSON with base64 audio
        data = resp.json()
        if "audio" in data:
            import base64
            return base64.b64decode(data["audio"])

        raise ValueError("XTTS server returned unexpected response format")


async def _xtts_inprocess_generate(
    text: str,
    lang_code: str,
    speaker_wav: str | None,
) -> bytes:
    """Generate TTS in-process using the coqui-ai TTS library."""
    def _generate() -> bytes:
        try:
            from TTS.api import TTS
        except ImportError:
            raise RuntimeError(
                "TTS library not installed. Run: pip install TTS"
            )

        tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            tts.tts_to_file(
                text=text,
                language=lang_code,
                speaker_wav=speaker_wav,
                file_path=tmp_path,
            )
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            import os
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return await asyncio.to_thread(_generate)


async def generate_speech_elevenlabs(
    text: str,
    language: str,
    voice_id: str,
) -> bytes:
    """Generate speech via ElevenLabs API (paid, premium quality).

    Parameters
    ----------
    text:
        Text to synthesize.
    language:
        Target language (used to set the model's language hint).
    voice_id:
        ElevenLabs voice ID.

    Returns
    -------
    bytes
        WAV audio bytes.
    """
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    lang_code = _resolve_language_code(language)

    # Use the multilingual v2 model for non-English, monolingual for English
    model_id = (
        "eleven_monolingual_v1" if lang_code == "en"
        else "eleven_multilingual_v2"
    )

    payload: dict[str, Any] = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.5,
            "use_speaker_boost": True,
        },
    }

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/wav",
            },
            json=payload,
        )
        resp.raise_for_status()

        logger.info(
            "ElevenLabs TTS: %d chars -> %d bytes audio (voice=%s, model=%s)",
            len(text), len(resp.content), voice_id, model_id,
        )
        return resp.content
