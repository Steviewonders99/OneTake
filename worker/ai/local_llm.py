"""Local LLM inference via MLX on Apple Silicon.

Primary: HTTP server (managed by MLXServerManager) — persistent, warm, fast
Fallback: Direct in-process mlx_lm (thread-safe GPU lock) — cold start, slower

Models
------
- **Qwen3.5-9B** (``LLM_MODEL``) -- orchestrator, brief generation, template
  selection.
- **Gemma 3 12B** (``COPY_MODEL``) -- multilingual ad copy writer.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

from config import COPY_MODEL, LLM_MODEL

logger = logging.getLogger(__name__)

# Direct in-process fallback
_gpu_lock = threading.RLock()
_models: dict[str, tuple[Any, Any]] = {}


def _get_model(model_name: str) -> tuple[Any, Any]:
    """Lazy-load model for in-process fallback."""
    if model_name not in _models:
        from mlx_lm import load

        logger.info("Loading model in-process: %s", model_name)
        _models[model_name] = load(model_name)
        logger.info("Model %s loaded.", model_name)
    return _models[model_name]


async def generate_text(
    system_prompt: str,
    user_prompt: str,
    model_name: str | None = None,
    max_tokens: int = 4096,
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

    # Try HTTP server first (warm, fast, managed lifecycle)
    try:
        from mlx_server_manager import mlx_server

        return await mlx_server.generate(
            messages=messages,
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            thinking=thinking,
        )
    except Exception as e:
        logger.warning("MLX server unavailable (%s), falling back to in-process", e)

    # Fallback: direct in-process (cold, but always works)
    def _generate() -> str:
        with _gpu_lock:
            from mlx_lm import generate as mlx_generate

            model, tokenizer = _get_model(model_name)
            prompt = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
            )
            return mlx_generate(
                model,
                tokenizer,
                prompt=prompt,
                max_tokens=max_tokens,
            )

    return await asyncio.to_thread(_generate)


async def generate_copy(
    system_prompt: str,
    user_prompt: str,
    **kwargs: Any,
) -> str:
    """Generate ad copy using Gemma 3 12B.

    Convenience wrapper that routes to ``COPY_MODEL``.
    """
    return await generate_text(
        system_prompt, user_prompt, model_name=COPY_MODEL, **kwargs,
    )
