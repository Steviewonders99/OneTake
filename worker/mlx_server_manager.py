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
import signal
import subprocess
import time
from typing import Optional

import httpx

from config import (
    LLM_MODEL,
    MLX_SERVER_HOST,
    MLX_SERVER_IDLE_TIMEOUT_S,
    MLX_SERVER_PORT,
    MLX_SERVER_STARTUP_TIMEOUT_S,
    MLX_SERVER_HEALTH_POLL_S,
)

logger = logging.getLogger(__name__)


class MLXServerManager:
    """Manages lifecycle of a local mlx_lm.server subprocess."""

    def __init__(self) -> None:
        self._process: Optional[subprocess.Popen] = None
        self._lock = asyncio.Lock()
        self._last_activity: float = 0
        self._idle_task: Optional[asyncio.Task] = None
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
        ]

        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        logger.info("MLX server process started (PID=%d)", self._process.pid)

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
        """Gracefully terminate the MLX server process."""
        if not self._process:
            return

        pid = self._process.pid
        logger.info("Stopping MLX server (PID=%d)", pid)

        try:
            self._process.send_signal(signal.SIGTERM)
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning(
                    "MLX server did not stop gracefully, sending SIGKILL"
                )
                self._process.kill()
                self._process.wait(timeout=3)
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

        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json={
                    "model": model or self._model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            msg = data["choices"][0]["message"]
            content = msg.get("content", "")
            reasoning = msg.get("reasoning", "")

            # Qwen3.5 thinking mode: content may be empty while reasoning
            # has the actual useful output. Return whichever has content.
            if content and content.strip():
                return content
            if reasoning and reasoning.strip():
                return reasoning
            return content


# Singleton instance
mlx_server = MLXServerManager()
