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

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def generate_text(
    system_prompt: str,
    user_prompt: str,
    model_name: str | None = None,
    max_tokens: int = 16384,
    temperature: float = 0.7,
    thinking: bool = True,
) -> str:
    """Generate text using NIM Qwen 397B (free) or local MLX (fallback).

    Tries NVIDIA NIM first with Qwen3.5-397B — handles massive prompts
    and thinking mode far better than the local 9B model. Falls back
    to local MLX server if NIM is unavailable.
    """
    import httpx
    from config import NVIDIA_NIM_API_KEY, NVIDIA_NIM_BASE_URL, NVIDIA_NIM_REASONING_MODEL

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # Try NIM Qwen 397B first (FREE, 128K context, handles massive prompts)
    if NVIDIA_NIM_API_KEY:
        try:
            payload = {
                "model": NVIDIA_NIM_REASONING_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
            }
            # Enable thinking for reasoning models (Qwen 397B supports it)
            if thinking:
                payload["chat_template_kwargs"] = {"enable_thinking": True}

            async with httpx.AsyncClient(timeout=600) as client:
                resp = await client.post(
                    f"{NVIDIA_NIM_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {NVIDIA_NIM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            msg = data["choices"][0]["message"]
            # NIM returns content in "content" field, reasoning in "reasoning_content"
            # With thinking enabled, the actual answer is in "content" (may start with \n\n)
            # The thinking trace is in "reasoning_content"
            content = (msg.get("content") or "").strip()
            reasoning = (msg.get("reasoning_content") or msg.get("reasoning") or "").strip()

            # Prefer content (the actual answer), fall back to reasoning if content is empty
            result = content if content else reasoning
            if not result:
                raise ValueError("NIM returned empty content and reasoning")

            finish_reason = data["choices"][0].get("finish_reason", "unknown")
            usage = data.get("usage", {})
            logger.info(
                "generate_text via NIM Qwen-397B (%d chars, finish=%s, tokens=%d/%d)",
                len(result), finish_reason,
                usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
            )
            return result

        except Exception as nim_error:
            logger.error("NIM Qwen-397B failed: %s — retrying NIM (no MLX fallback)", nim_error)

            # Retry NIM once with a different key from the pool
            try:
                from nim_key_pool import get_nim_key
                retry_key = get_nim_key() or NVIDIA_NIM_API_KEY
                payload["temperature"] = min(temperature + 0.1, 1.0)  # Slight temp bump
                async with httpx.AsyncClient(timeout=600) as client:
                    resp = await client.post(
                        f"{NVIDIA_NIM_BASE_URL}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {retry_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                msg = data["choices"][0]["message"]
                content = (msg.get("content") or "").strip()
                reasoning = (msg.get("reasoning_content") or msg.get("reasoning") or "").strip()
                result = content if content else reasoning
                if result:
                    logger.info("NIM retry succeeded (%d chars)", len(result))
                    return result
                raise ValueError("NIM retry returned empty")
            except Exception as retry_error:
                logger.error("NIM retry also failed: %s", retry_error)
                raise nim_error

    raise RuntimeError("No NIM API key configured and MLX fallback unavailable")


async def generate_copy(
    system_prompt: str,
    user_prompt: str,
    **kwargs: Any,
) -> str:
    """Generate ad copy / scripts / overlay text using Gemma 3 27B (creative writing).

    Model routing:
    - Primary: NIM Gemma 3 27B (free, excellent creative writing)
    - Fallback: NIM Kimi K2.5 (free, good general purpose)
    - Last resort: OpenRouter Kimi K2.5 (paid)

    Marketing skills can be injected via the skill_stage kwarg.
    """
    import httpx
    from config import NVIDIA_NIM_API_KEY, NVIDIA_NIM_BASE_URL, NVIDIA_NIM_CREATIVE_MODEL, OPENROUTER_API_KEY

    # Inject marketing skills if stage specified
    skill_stage = kwargs.pop("skill_stage", None)
    if skill_stage:
        from prompts.marketing_skills import get_skills_for_stage
        skills = get_skills_for_stage(skill_stage)
        if skills:
            system_prompt = f"{system_prompt}\n\n{skills}"
            logger.info("Injected '%s' marketing skills (%d chars)", skill_stage, len(skills))

    if not NVIDIA_NIM_API_KEY and not OPENROUTER_API_KEY:
        kwargs.setdefault("thinking", False)
        kwargs.setdefault("max_tokens", 4096)
        return await generate_text(system_prompt, user_prompt, **kwargs)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # Model cascade: Gemma 27B (creative) → Kimi K2.5 (fallback) — NIM only, no paid APIs
    providers = []
    if NVIDIA_NIM_API_KEY:
        providers.append(("NIM-Gemma27B", f"{NVIDIA_NIM_BASE_URL}/chat/completions", NVIDIA_NIM_API_KEY, NVIDIA_NIM_CREATIVE_MODEL))
        providers.append(("NIM-Kimi", f"{NVIDIA_NIM_BASE_URL}/chat/completions", NVIDIA_NIM_API_KEY, "moonshotai/kimi-k2.5"))

    for provider_name, url, key, model in providers:
        try:
            async with httpx.AsyncClient(timeout=600) as client:
                payload = {
                    "model": model,
                    "messages": messages,
                    "max_tokens": kwargs.get("max_tokens", 8192),
                    "temperature": kwargs.get("temperature", 0.7),
                    "stream": False,
                }

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
