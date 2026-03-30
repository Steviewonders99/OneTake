"""Local LLM inference via MLX on Apple Silicon.

All inference goes through the MLX HTTP server (managed by MLXServerManager).
NO in-process model loading — this prevents double model loading which caused
37GB RAM usage (two copies of Qwen3.5-9B) on a 48GB machine.

Models
------
- **Qwen3.5-9B** (``LLM_MODEL``) -- orchestrator, brief generation, template
  selection.
- **Gemma 3 12B** (``COPY_MODEL``) -- multilingual ad copy writer.
"""
from __future__ import annotations

import asyncio
import logging

from config import COPY_MODEL, LLM_MODEL

logger = logging.getLogger(__name__)


async def generate_text(
    system_prompt: str,
    user_prompt: str,
    model_name: str | None = None,
    max_tokens: int = 8192,
    temperature: float = 0.7,
    thinking: bool = True,
) -> str:
    """Generate text using MLX. HTTP server first, in-process fallback.

    Parameters
    ----------
    system_prompt:
        The system message that sets the AI persona.
    user_prompt:
        The user query or task description.
    model_name:
        Override the default model. Falls back to ``LLM_MODEL``.
    max_tokens:
        Maximum number of tokens to generate.
    temperature:
        Sampling temperature (0 = deterministic, 1 = creative).
    thinking:
        If True (default), Qwen3.5 uses extended thinking mode —
        ideal for orchestration (brief, template selection, direction).
        If False, prepends /no_think for direct JSON output —
        ideal for evaluations, scores, structured extraction.

    Returns
    -------
    str
        The model's generated text.
    """
    model_name = model_name or LLM_MODEL
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # HTTP server ONLY — no in-process fallback (prevents double model loading
    # which caused 37GB RAM usage on a 48GB machine).
    from mlx_server_manager import mlx_server

    for attempt in range(3):
        try:
            return await mlx_server.generate(
                messages=messages,
                model=model_name,
                max_tokens=max_tokens,
                temperature=temperature,
                thinking=thinking,
            )
        except Exception as e:
            if attempt < 2:
                logger.warning(
                    "MLX server call failed (attempt %d/3): %s — retrying in 5s",
                    attempt + 1, e,
                )
                await asyncio.sleep(5)
            else:
                logger.error("MLX server failed after 3 attempts: %s", e)
                raise


async def generate_copy(
    system_prompt: str,
    user_prompt: str,
    **kwargs: Any,
) -> str:
    """Generate ad copy using Kimi K2.5 — NVIDIA NIM (free) or OpenRouter (paid fallback).

    Tries NVIDIA NIM first (free), falls back to OpenRouter if NIM unavailable.
    """
    from config import NVIDIA_NIM_API_KEY, NVIDIA_NIM_BASE_URL, OPENROUTER_API_KEY
    import httpx

    if not NVIDIA_NIM_API_KEY and not OPENROUTER_API_KEY:
        kwargs.setdefault("thinking", False)
        kwargs.setdefault("max_tokens", 4096)
        return await generate_text(system_prompt, user_prompt, **kwargs)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # Try NVIDIA NIM first (FREE), then OpenRouter (paid)
    providers = []
    if NVIDIA_NIM_API_KEY:
        providers.append(("NIM", f"{NVIDIA_NIM_BASE_URL}/chat/completions", NVIDIA_NIM_API_KEY))
    if OPENROUTER_API_KEY:
        providers.append(("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", OPENROUTER_API_KEY))

    for provider_name, url, key in providers:
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                payload = {
                    "model": "moonshotai/kimi-k2.5",
                    "messages": messages,
                    "max_tokens": kwargs.get("max_tokens", 4096),
                    "temperature": kwargs.get("temperature", 0.7),
                    "stream": False,
                }
                if provider_name == "NIM":
                    payload["chat_template_kwargs"] = {"thinking": False}

                resp = await client.post(url, headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                }, json=payload)
                resp.raise_for_status()
                data = resp.json()

            msg = data["choices"][0]["message"]
            result = msg.get("content") or msg.get("reasoning") or ""
            logger.info("generate_copy via %s (%d chars)", provider_name, len(result))
            return result

        except Exception as e:
            logger.warning("generate_copy via %s failed: %s", provider_name, e)
            continue

    raise RuntimeError("All LLM providers failed for generate_copy")
