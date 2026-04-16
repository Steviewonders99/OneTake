"""Managed MLX-LM HTTP server for local model inference.

Spawns ``python -m mlx_lm.server`` as a subprocess, auto-starts on first
request, health-checks continuously, and auto-shuts down after idle timeout.

Usage::

    from mlx_server_manager import mlx_server

    # Ensure server is running before making requests
    await mlx_server.ensure_ready()

    # Server auto-shuts down after IDLE_TIMEOUT_S with no calls to ensure_ready()
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import subprocess
import time

import httpx
from config import (
    LLM_MODEL,
    MLX_SERVER_HEALTH_POLL_S,
    MLX_SERVER_HOST,
    MLX_SERVER_IDLE_TIMEOUT_S,
    MLX_SERVER_PORT,
    MLX_SERVER_STARTUP_TIMEOUT_S,
)

logger = logging.getLogger(__name__)


class MLXServerManager:
    """Manages lifecycle of a local mlx_lm.server subprocess."""

    def __init__(self) -> None:
        self._process: subprocess.Popen | None = None
        self._lock = asyncio.Lock()
        self._last_activity: float = 0
        self._idle_task: asyncio.Task | None = None
        self._host = MLX_SERVER_HOST
        self._port = MLX_SERVER_PORT
        self._model = LLM_MODEL
        self._startup_timeout = MLX_SERVER_STARTUP_TIMEOUT_S
        self._idle_timeout = MLX_SERVER_IDLE_TIMEOUT_S
        self._health_interval = MLX_SERVER_HEALTH_POLL_S

        # Kill any orphaned MLX servers from previous crashed workers
        self._kill_orphans()

    def _kill_orphans(self) -> None:
        """Kill any orphaned mlx_lm.server processes from previous crashed workers.

        This prevents the deadly double-model-loading issue where two 5GB+
        MLX servers run simultaneously, consuming 10GB+ RAM and crashing
        a 48GB machine.
        """
        import os

        try:
            # Find all mlx_lm.server processes
            result = subprocess.run(
                ["pgrep", "-f", "mlx_lm.server"],
                capture_output=True, text=True, timeout=5,
            )
            pids = [int(p) for p in result.stdout.strip().split("\n") if p.strip()]

            if pids:
                logger.warning(
                    "Found %d orphaned MLX server(s): %s — killing them",
                    len(pids), pids,
                )
                for pid in pids:
                    try:
                        os.kill(pid, signal.SIGKILL)
                        logger.info("Killed orphaned MLX server PID %d", pid)
                    except ProcessLookupError:
                        pass
                # Wait for cleanup
                import time
                time.sleep(2)
        except Exception as e:
            logger.debug("Orphan check failed (non-critical): %s", e)

    @property
    def base_url(self) -> str:
        return f"http://{self._host}:{self._port}"

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.poll() is None

    async def ensure_ready(self) -> None:
        """Ensure the MLX server is running and healthy. Starts it if needed."""
        self._last_activity = time.monotonic()

        if self.is_running:
            return

        async with self._lock:
            # Double-check after acquiring lock
            if self.is_running:
                return
            await self._start()

    async def _start(self) -> None:
        """Start the mlx_lm.server subprocess and wait until healthy."""
        logger.info("Starting MLX server: model=%s port=%d", self._model, self._port)

        import sys
        cmd = [
            sys.executable, "-m", "mlx_lm.server",
            "--model", self._model,
            "--host", self._host,
            "--port", str(self._port),
            # CRITICAL: limit concurrency to prevent spawning multiple 5GB processes
            "--pipeline",  # Use pipeline mode (single process)
            "--decode-concurrency", "1",
            "--prompt-concurrency", "1",
            "--prompt-cache-size", "2",  # Limit KV cache entries
            "--max-tokens", "8192",  # Enough for thinking + JSON output
        ]

        # Start in its own process group so we can kill ALL child processes
        # (MLX server spawns worker subprocesses even with --pipeline)
        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid,  # New process group
        )

        logger.info("MLX server process started (PID=%d, PGID=%d)", self._process.pid, os.getpgid(self._process.pid))

        # Register with process manager for clean shutdown
        try:
            from process_manager import ProcessManager
            ProcessManager().register_mlx_server(self._process.pid)
        except Exception:
            pass

        # Poll for health
        start_time = time.monotonic()
        while time.monotonic() - start_time < self._startup_timeout:
            if self._process.poll() is not None:
                stderr = (
                    self._process.stderr.read().decode()
                    if self._process.stderr
                    else ""
                )
                raise RuntimeError(
                    f"MLX server exited during startup: {stderr[:500]}"
                )

            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    resp = await client.get(f"{self.base_url}/v1/models")
                    if resp.status_code == 200:
                        elapsed = time.monotonic() - start_time
                        logger.info("MLX server healthy after %.1fs", elapsed)
                        self._last_activity = time.monotonic()
                        self._start_idle_watcher()
                        return
            except (httpx.ConnectError, httpx.TimeoutException):
                pass

            await asyncio.sleep(self._health_interval)

        # Timeout — clean up and raise
        self._kill()
        raise RuntimeError(
            f"MLX server failed to become healthy within {self._startup_timeout}s"
        )

    def _start_idle_watcher(self) -> None:
        """Start background task that shuts down server after idle timeout."""
        if self._idle_task and not self._idle_task.done():
            return

        async def _watch_idle() -> None:
            while self.is_running:
                await asyncio.sleep(30)  # Check every 30s
                idle_time = time.monotonic() - self._last_activity
                if idle_time > self._idle_timeout:
                    logger.info(
                        "MLX server idle for %.0fs, shutting down", idle_time
                    )
                    self._kill()
                    return

        self._idle_task = asyncio.create_task(_watch_idle())

    def _kill(self) -> None:
        """Kill the ENTIRE MLX server process group (parent + all children)."""
        if not self._process:
            return

        pid = self._process.pid
        logger.info("Stopping MLX server process group (PID=%d)", pid)

        try:
            # Kill the entire process group — catches all spawned child workers
            pgid = os.getpgid(pid)
            os.killpg(pgid, signal.SIGKILL)
            self._process.wait(timeout=5)
            logger.info("MLX server process group killed (PGID=%d)", pgid)
        except (ProcessLookupError, ChildProcessError):
            pass
        except Exception as e:
            logger.warning("Process group kill failed: %s — trying direct kill", e)
            try:
                self._process.kill()
                self._process.wait(timeout=3)
            except Exception:
                pass
        except ProcessLookupError:
            pass
        finally:
            self._process = None

    async def shutdown(self) -> None:
        """Clean shutdown — cancel idle watcher and kill server."""
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
        self._kill()

    async def generate(
        self,
        messages: list[dict],
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        thinking: bool = True,
    ) -> str:
        """Generate text via the MLX HTTP server. Auto-starts if needed.

        Parameters
        ----------
        thinking:
            If True (default), allows Qwen3.5 extended thinking mode.
            The reasoning trace is returned as the output — ideal for
            orchestration tasks (brief generation, template selection,
            creative direction) where the reasoning IS the useful output.

            If False, prepends /no_think to the user message to force
            direct output — ideal for structured JSON responses
            (evaluations, scores, data extraction).
        """
        await self.ensure_ready()
        self._last_activity = time.monotonic()

        # For no-think mode, prepend /no_think to the last user message
        if not thinking:
            messages = [
                {**m, "content": f"/no_think\n{m['content']}"}
                if m.get("role") == "user" and i == len(messages) - 1
                else m
                for i, m in enumerate(messages)
            ]

        # STREAMING mode — tokens arrive continuously, keeping the connection
        # alive. Prevents macOS from killing the process during long generations.
        # The MLX server supports OpenAI-compatible SSE streaming.
        prompt_chars = sum(len(m.get("content", "")) for m in messages)
        logger.info(
            "Sending %d-char prompt to MLX server (thinking=%s, streaming=true)...",
            prompt_chars, thinking,
        )

        import json as _json

        collected_content = ""
        collected_reasoning = ""
        token_count = 0

        async with httpx.AsyncClient(timeout=httpx.Timeout(
            connect=30.0, read=600.0, write=30.0, pool=30.0
        )) as client, client.stream(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            json={
                "model": model or self._model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": True,
            },
        ) as resp:
            resp.raise_for_status()

            async for line in resp.aiter_lines():
                self._last_activity = time.monotonic()

                if not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break

                try:
                    chunk = _json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})

                    if delta.get("content"):
                        collected_content += delta["content"]
                        token_count += 1
                    if delta.get("reasoning"):
                        collected_reasoning += delta["reasoning"]
                        token_count += 1

                    # Log progress every 100 tokens
                    if token_count % 100 == 0 and token_count > 0:
                        logger.debug(
                            "Streaming: %d tokens received (%d content, %d reasoning chars)...",
                            token_count, len(collected_content), len(collected_reasoning),
                        )
                except _json.JSONDecodeError:
                    continue

        logger.info(
            "MLX stream complete: %d tokens, content=%d chars, reasoning=%d chars",
            token_count, len(collected_content), len(collected_reasoning),
        )

        # Combine all output — MLX server may put everything in content
        # (with <think> tags inline) or split into content + reasoning fields.
        raw = collected_content + collected_reasoning

        # Parse <think>...</think> tags from Qwen3.5 output.
        # The actual answer (JSON) comes AFTER the </think> tag.
        if "</think>" in raw:
            parts = raw.split("</think>", 1)
            think_text = parts[0].replace("<think>", "").strip()
            answer_text = parts[1].strip() if len(parts) > 1 else ""

            logger.info(
                "Parsed thinking: %d chars reasoning, %d chars answer",
                len(think_text), len(answer_text),
            )

            # If we have an answer after </think>, return that (it's the JSON)
            if answer_text:
                return answer_text

            # If no answer after </think>, the JSON might be inside the thinking
            return think_text

        # No think tags — return whatever we have
        if raw.strip():
            return raw.strip()
        return collected_content


# Singleton instance
mlx_server = MLXServerManager()
